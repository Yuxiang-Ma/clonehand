"""The static web demo: exported files, and the in-browser engine against HandSimulation."""

import json
import shutil
import subprocess

import mujoco
import numpy as np
import pytest

from scripts.export_web_demo import build
from src.simulation.engine import MUSIC_MUSCLES, ROOT, HandSimulation, load_model


@pytest.fixture(scope="module")
def files():
    return build()


@pytest.fixture(scope="module")
def web_model(files):
    return mujoco.MjModel.from_xml_string(files["hand.xml"])


def test_demo_publishes_nothing_from_music(files):
    model = json.loads(files["model.json"])
    anatomy = json.loads(files["anatomy.json"])
    music = {f"{name}_r" for name in MUSIC_MUSCLES}
    assert model["counts"] == {"bones": 29, "dofs": 23, "actuators": 39}
    assert not music & {a["id"] for a in model["actuators"]}
    assert not music & set(json.loads(files["physics.json"])["actuators"])
    assert not any(a.get("provider") == "music" for a in anatomy["actuators"])
    assert anatomy["counts"]["model_actuators"] == 39
    assert set(anatomy["edition"]["removed_actuators"]) == music
    for name in MUSIC_MUSCLES:
        assert f"{name}_r" not in files["hand.xml"]
    assert "MUSIC" in model["limitations"][0]


def test_physics_file_needs_no_meshes(web_model):
    assert web_model.nmesh == 0
    assert web_model.nu == 39 and web_model.nv == 23


def test_physics_file_matches_the_runtime_model(web_model):
    reference = load_model(include_music=False)
    # MJCF prints six significant digits.
    np.testing.assert_allclose(web_model.body_mass, reference.body_mass, rtol=1e-5)
    np.testing.assert_allclose(
        web_model.body_inertia, reference.body_inertia, rtol=1e-5, atol=1e-12
    )
    np.testing.assert_array_equal(web_model.jnt_stiffness, reference.jnt_stiffness)
    np.testing.assert_array_equal(web_model.opt.gravity, [0, 0, 0])
    assert web_model.opt.timestep == reference.opt.timestep
    assert web_model.opt.integrator == reference.opt.integrator
    data = {id(m): mujoco.MjData(m) for m in (web_model, reference)}
    for m in (web_model, reference):
        d = data[id(m)]
        d.ctrl[m.actuator("FDS2_r").id] = 1
        d.ctrl[m.actuator("ECRL_r").id] = 0.5
        d.ctrl[m.actuator("PT_r").id] = 0.3
        mujoco.mj_step(m, d, nstep=1500)
        mujoco.mj_forward(m, d)
    web, ref = data[id(web_model)], data[id(reference)]
    np.testing.assert_allclose(web.qpos, ref.qpos, atol=1e-7)
    bones = HandSimulation(include_music=False).bone_geoms
    np.testing.assert_allclose(web.geom_xpos[bones], ref.geom_xpos[bones], atol=1e-6)
    np.testing.assert_allclose(web.geom_xmat[bones], ref.geom_xmat[bones], atol=1e-5)


@pytest.mark.skipif(
    shutil.which("node") is None or not (ROOT / "node_modules/mujoco").is_dir(),
    reason="needs Node and npm install",
)
def test_browser_engine_matches_python(files, tmp_path):
    for name, text in files.items():
        (tmp_path / name).write_text(text)
    controls = {"FDS2_r": 1.0, "EDC3_r": 0.4, "FPL_r": 0.6}
    plan = {"controls": controls, "steps": 16, "ticks": 20}
    result = subprocess.run(
        ["node", "tests/web/run_local_engine.ts", str(tmp_path), json.dumps(plan)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )
    output = json.loads(result.stdout)
    assert output["errors"] == [
        "Excitation must be a finite number between 0 and 1.",
        "Unknown actuator: nope",
        "paused must be true or false.",
    ]
    browser = output["state"]

    sim = HandSimulation(include_music=False)
    sim.set_controls(controls)
    for _ in range(plan["ticks"]):
        sim.advance(plan["steps"])
    python = sim.snapshot()

    assert set(browser) == set(python)
    assert browser["time"] == pytest.approx(python["time"])
    for key in ("excitation", "activation", "qpos", "qvel", "mtu_length", "bone_positions"):
        np.testing.assert_allclose(browser[key], python[key], atol=1e-6, err_msg=key)
    np.testing.assert_allclose(browser["force"], python["force"], rtol=1e-5, atol=1e-4)
    np.testing.assert_allclose(browser["moment_arms"], python["moment_arms"], atol=2e-4)
    # q and -q are the same rotation; compare up to sign.
    b, p = np.array(browser["bone_quaternions"]), np.array(python["bone_quaternions"])
    np.testing.assert_allclose(b * np.sign((b * p).sum(axis=1, keepdims=True)), p, atol=1e-6)
    assert [len(p) for p in browser["paths"]] == [len(p) for p in python["paths"]]
    for b, p in zip(browser["paths"], python["paths"], strict=True):
        np.testing.assert_allclose(b, p, atol=1e-6)

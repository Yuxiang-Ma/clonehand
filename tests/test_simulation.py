import json

import mujoco
import numpy as np
import pytest

from src.simulation.engine import (
    EXCLUDED_ACTUATORS,
    LOCKED_JOINTS,
    ROOT,
    HandSimulation,
    directional_stiffness,
    load_music_muscles,
    load_passive_stiffness,
)

MUSIC = len(load_music_muscles())
needs_music = pytest.mark.skipif(not MUSIC, reason="run scripts/fetch_music.py first")


def test_model_has_expected_scope():
    sim = HandSimulation()
    assert (sim.model.nq, sim.model.nu) == (23, 39 + MUSIC)
    assert len(sim.geometry()["bones"]) == 29


def test_invalid_controls_are_rejected_atomically():
    sim = HandSimulation()
    for value in (-0.1, 1.1, float("nan"), float("inf")):
        with pytest.raises(ValueError):
            sim.set_controls({"FDS2_r": value})
    with pytest.raises(ValueError):
        sim.set_controls({"FDS2_r": 0.5, "nonexistent": 0.4})
    assert np.all(sim.data.ctrl == 0)


def test_activation_lags_excitation_and_relaxes():
    sim = HandSimulation()
    i = sim.model.actuator("FDS2_r").id
    sim.set_controls({"FDS2_r": 0.4})
    assert sim.data.act[i] == 0
    sim.advance(10)
    assert 0 < sim.data.act[i] < 0.4
    sim.relax()
    a = sim.data.act[i]
    sim.advance(10)
    assert 0 < sim.data.act[i] < a
    assert np.all(sim.data.ctrl == 0)


def test_flexor_and_extensor_have_opposite_moment_arms():
    sim = HandSimulation()
    moments = sim.moment_arms()
    joint = sim.model.joint("mcp2_flexion_r").id
    flex = moments[sim.model.actuator("FDS2_r").id, joint]
    ext = moments[sim.model.actuator("EDC2_r").id, joint]
    assert flex > 0
    assert ext < 0


def test_actual_flexor_actuation_changes_joint_motion():
    passive, active = HandSimulation(), HandSimulation()
    active.set_controls({"FDS2_r": 0.4})
    passive.advance(150)
    active.advance(150)
    j = active.model.joint("pm2_flexion_r").qposadr[0]
    assert active.data.qpos[j] > passive.data.qpos[j] + 0.01


def test_pause_and_reset():
    sim = HandSimulation()
    sim.set_controls({"FDS2_r": 0.5})
    sim.advance(20)
    sim.paused = True
    before = sim.data.qpos.copy()
    sim.advance(20)
    np.testing.assert_array_equal(sim.data.qpos, before)
    sim.reset()
    assert sim.paused is True
    assert sim.data.time == 0
    assert np.all(sim.data.ctrl == 0)
    np.testing.assert_allclose(sim.data.qpos, sim.model.qpos0)


def test_multi_muscle_simulation_stays_finite_and_near_joint_limits():
    sim = HandSimulation()
    sim.set_controls({sim.model.actuator(i).name: 0.25 for i in range(sim.model.nu)})
    sim.advance(1500)
    assert sim.data.time == pytest.approx(3)
    assert np.isfinite(sim.data.qpos).all()
    assert np.isfinite(sim.data.qvel).all()
    # MuJoCo limits are soft constraints, not exact clamps.
    assert np.all(sim.data.qpos >= sim.model.jnt_range[:, 0] - 0.15)
    assert np.all(sim.data.qpos <= sim.model.jnt_range[:, 1] + 0.15)


def test_snapshot_geometry_and_moment_arms_are_consistent():
    sim = HandSimulation()
    state = sim.snapshot()
    assert len(state["paths"]) == 39 + MUSIC
    assert all(len(path) >= 2 for path in state["paths"])
    assert len(state["bone_positions"]) == 29
    # A finite difference independently verifies moment-arm sign and units.
    j = sim.model.joint("mcp2_flexion_r").id
    i = sim.model.actuator("FDS2_r").id
    tendon = sim.model.actuator_trnid[i, 0]
    length = sim.data.ten_length[tendon]
    import mujoco

    sim.data.qpos[j] += 1e-6
    mujoco.mj_forward(sim.model, sim.data)
    numerical = -(sim.data.ten_length[tendon] - length) / 1e-6
    assert state["moment_arms"][i][j] == pytest.approx(numerical * 1000, abs=0.05)


def test_scope_excludes_muscles_without_a_hand_attachment():
    sim = HandSimulation()
    assert not set(EXCLUDED_ACTUATORS) & set(sim.actuator_ids)
    joints = {sim.model.joint(i).name for i in range(sim.model.njnt)}
    assert not set(LOCKED_JOINTS) & joints
    anatomy = json.loads((ROOT / "data/anatomy/anatomy.json").read_text())
    in_scope = {a["id"] for a in anatomy["actuators"] if MUSIC or a.get("provider") != "music"}
    assert set(sim.actuator_ids) == in_scope


def test_pronator_influence_is_labelled_as_pronation():
    sim = HandSimulation()
    j = sim.model.joint("pro_sup_r").id
    i = sim.actuator_ids["PT_r"]
    info = sim.metadata()["joints"][j]
    direction = info["positive"] if sim.moment_arms()[i, j] > 0 else info["negative"]
    assert direction == "Pronation"


def test_wrist_extensor_influence_is_labelled_as_extension():
    sim = HandSimulation()
    j = sim.model.joint("flexion_r").id
    i = sim.actuator_ids["ECRB_r"]
    info = sim.metadata()["joints"][j]
    direction = info["positive"] if sim.moment_arms()[i, j] > 0 else info["negative"]
    assert direction == "Extension"


@pytest.mark.parametrize("joint_id", ["cmc_flexion_r", "mp_flexion_r", "ip_flexion_r"])
def test_thumb_flexor_labels_follow_model_coordinates(joint_id):
    sim = HandSimulation()
    j = sim.model.joint(joint_id).id
    i = sim.actuator_ids["FPL_r"]
    info = sim.metadata()["joints"][j]
    direction = info["positive"] if sim.moment_arms()[i, j] > 0 else info["negative"]
    assert direction == "Flexion"


def _settle(controls, seconds=3.0):
    sim = HandSimulation()
    sim.set_controls(controls)
    sim.advance(int(seconds / sim.model.opt.timestep))
    return sim


def test_every_joint_has_documented_passive_stiffness():
    sim = HandSimulation()
    table = load_passive_stiffness()
    sources = {source["id"] for source in table["sources"]}
    names = {sim.model.joint(i).name for i in range(sim.model.njnt)}
    # Locked joints keep their entry for when they are re-enabled.
    assert set(table["joints"]) == names | set(LOCKED_JOINTS)
    for name, entry in table["joints"].items():
        assert min(directional_stiffness(entry)) > 0
        assert entry["basis"] in {"measured", "assumed"}
        assert entry["source_ids"] and set(entry["source_ids"]) <= sources
        if entry["basis"] == "assumed":
            assert entry["notes"]
        if name in LOCKED_JOINTS:
            continue
        joint = sim.model.joint(name).id
        if isinstance(entry["stiffness_nm_per_rad"], dict):
            assert sim.model.jnt_stiffness[joint] == 0
        else:
            assert sim.model.jnt_stiffness[joint] == pytest.approx(entry["stiffness_nm_per_rad"])


@pytest.mark.parametrize("name", ["flexion_r", "deviation_r", "pro_sup_r"])
def test_directional_springs_resist_each_side_with_the_measured_stiffness(name):
    sim = HandSimulation(include_music=False)
    m, d = sim.model, sim.data
    positive, negative = directional_stiffness(load_passive_stiffness()["joints"][name])
    assert positive != negative
    for angle, expected in ((0.2, -positive * 0.2), (-0.2, negative * 0.2), (0.0, 0.0)):
        mujoco.mj_resetData(m, d)
        d.qpos[m.joint(name).qposadr[0]] = angle
        mujoco.mj_forward(m, d)
        # Velocity is zero, so damping adds nothing; the passive force is the spring alone.
        assert d.qfrc_passive[m.joint(name).dofadr[0]] == pytest.approx(expected, abs=1e-9)


def test_relaxed_hand_holds_its_reference_posture():
    sim = _settle({})
    angles = np.abs(np.rad2deg(sim.data.qpos))
    # Known model artifact: RI2_r starts beyond its length range and pulls with ~12 N of
    # passive force at zero activation, so index MCP abduction settles near 7 degrees.
    known = sim.model.joint("mcp2_abduction_r").qposadr[0]
    assert 3 < angles[known] < 10
    assert np.max(np.delete(angles, known)) < 2


def test_full_finger_flexor_excitation_flexes_the_finger():
    sim = _settle({"FDS2_r": 1.0})
    m = sim.model
    assert np.rad2deg(sim.data.qpos[m.joint("pm2_flexion_r").qposadr[0]]) > 45


def test_partial_excitation_gives_partial_motion():
    m = HandSimulation().model
    wrist = m.joint("flexion_r").qposadr[0]
    upper = m.jnt_range[m.joint("flexion_r").id, 1]
    low = _settle({"FCR_r": 0.05}).data.qpos[wrist]
    high = _settle({"FCR_r": 0.2}).data.qpos[wrist]
    assert 0 < low < high
    assert low < 0.8 * upper


@needs_music
@pytest.mark.parametrize(
    ("actuator", "joint", "action"),
    [
        ("APB_r", "cmc_abduction_r", "Abduction"),
        ("FPB_r", "mp_flexion_r", "Flexion"),
        ("AdP_r", "cmc_abduction_r", "Adduction"),
        ("ADM_r", "mcp5_abduction_r", "Ulnar motion"),
        ("FDM_r", "mcp5_flexion_r", "Flexion"),
    ],
)
def test_music_muscles_pull_in_their_anatomical_direction(actuator, joint, action):
    sim = HandSimulation()
    j = sim.model.joint(joint).id
    arm = sim.moment_arms()[sim.actuator_ids[actuator], j]
    info = sim.metadata()["joints"][j]
    assert abs(arm) > 0.002
    assert (info["positive"] if arm > 0 else info["negative"]) == action


@needs_music
def test_music_muscles_are_slack_at_rest():
    sim = HandSimulation()
    for name in ("APB_r", "FPB_r", "AdP_r", "ADM_r", "FDM_r"):
        assert -sim.data.actuator_force[sim.actuator_ids[name]] < 0.5

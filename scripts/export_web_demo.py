"""Write the data the static web demo needs into .demo-data/ (Vite's public dir for `--mode demo`).

The demo runs MuJoCo compiled to WebAssembly in the browser, so it needs the model as a file
instead of a service. It uses MyoHand only: the five MUSIC muscles are left out because MUSIC
has no license, so nothing derived from it may be published.

Outputs, under .demo-data/data/:
  model.json      the same payload as GET /api/model, without MUSIC
  anatomy.json    data/anatomy/anatomy.json with the MUSIC actuators removed
  hand.xml        physics-only MJCF with the runtime settings baked in (see physics_spec)
  physics.json    actuator order and bone geom ids for the in-browser engine
  LICENSE-myohand.txt, NOTICE.txt   licenses for the redistributed model and engine
"""

import argparse
import copy
import json
import shutil
import sys
from pathlib import Path

import mujoco

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.simulation.engine import (  # noqa: E402
    LOCKED_JOINTS,
    ROOT,
    HandSimulation,
    build_spec,
    load_model,
    load_passive_stiffness,
)

OUTPUT = ROOT / ".demo-data"
NOTICE = """Clonehand web demo: third-party components

MyoHand musculoskeletal model (MyoHub/myo_sim, revision 93b0ca8f), Apache-2.0.
  data/hand.xml and data/model.json are derived from it; see LICENSE-myohand.txt.
MuJoCo physics engine, WebAssembly build (npm package "mujoco"), Apache-2.0, Google DeepMind.
three.js, MIT License. IBM Plex Sans (via @fontsource), SIL Open Font License 1.1.

The five MUSIC muscles used by the local app are not included: MUSIC has no license.
"""
DEMO_NOTE = (
    "This browser version runs MyoHand only, with 39 actuators. Abductor and flexor pollicis "
    "brevis, adductor pollicis, and abductor and flexor digiti minimi come from MUSIC, which has "
    "no license, so they run only in the local version of the app."
)


def physics_spec():
    """MyoHand without MUSIC, with load_model()'s runtime settings written into the spec.

    Bone meshes have no contacts and do not set any body's inertia once inertia is explicit, so
    each mesh geom becomes a 1 mm massless sphere at the compiled mesh frame. The browser then
    loads no STL files, and geom_xpos/geom_xmat still give the bone poses the viewer draws.
    """
    compiled = load_model(include_music=False)
    spec = build_spec(include_music=False)
    spec.option.gravity = [0, 0, 0]
    spec.option.timestep = compiled.opt.timestep
    spec.option.integrator = compiled.opt.integrator
    # Directional joints already carry one-sided tendon springs from build_spec().
    for name, entry in load_passive_stiffness()["joints"].items():
        if name not in LOCKED_JOINTS and not isinstance(entry["stiffness_nm_per_rad"], dict):
            spec.joint(name).stiffness = [entry["stiffness_nm_per_rad"], 0, 0]
    for body in spec.bodies[1:]:
        i = compiled.body(body.name).id
        body.explicitinertial = True
        body.mass = compiled.body_mass[i]
        body.ipos = compiled.body_ipos[i]
        body.iquat = compiled.body_iquat[i]
        body.inertia = compiled.body_inertia[i]
    spec.compiler.inertiafromgeom = mujoco.mjtInertiaFromGeom.mjINERTIAFROMGEOM_FALSE
    for index, geom in enumerate(spec.geoms):
        if geom.type != mujoco.mjtGeom.mjGEOM_MESH:
            continue
        geom.type = mujoco.mjtGeom.mjGEOM_SPHERE
        geom.meshname = ""
        geom.size = [0.001, 0, 0]
        geom.pos = compiled.geom_pos[index]
        geom.quat = compiled.geom_quat[index]
        geom.mass = 0
    for mesh in list(spec.meshes):
        spec.delete(mesh)
    return spec


def web_anatomy():
    anatomy = json.loads((ROOT / "data/anatomy/anatomy.json").read_text())
    anatomy = copy.deepcopy(anatomy)
    removed = {a["id"] for a in anatomy["actuators"] if a.get("provider") == "music"}
    anatomy["actuators"] = [a for a in anatomy["actuators"] if a["id"] not in removed]
    for muscle in anatomy["muscles"]:
        muscle["model_actuators"] = [x for x in muscle["model_actuators"] if x not in removed]
    anatomy["counts"]["model_actuators"] = len(anatomy["actuators"])
    anatomy["edition"] = {
        "name": "web-demo",
        "note": DEMO_NOTE,
        "removed_actuators": sorted(removed),
    }
    return anatomy


def build():
    sim = HandSimulation(include_music=False)
    model = sim.metadata()
    model["limitations"].insert(0, DEMO_NOTE)
    spec = physics_spec()
    spec.compile()
    files = {
        "model.json": json.dumps(model, separators=(",", ":")),
        "anatomy.json": json.dumps(web_anatomy(), separators=(",", ":"), ensure_ascii=False),
        "hand.xml": spec.to_xml(),
        "physics.json": json.dumps(
            {
                "actuators": [sim.model.actuator(i).name for i in range(sim.model.nu)],
                "bone_geoms": sim.bone_geoms,
            }
        ),
    }
    files["LICENSE-myohand.txt"] = (ROOT / "models/myohand/LICENSE").read_text()
    files["NOTICE.txt"] = NOTICE
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.parse_args()
    shutil.rmtree(OUTPUT, ignore_errors=True)
    (OUTPUT / "data").mkdir(parents=True)
    for name, text in build().items():
        (OUTPUT / "data" / name).write_text(text)
        print(f"wrote .demo-data/data/{name} ({len(text) / 1e6:.2f} MB)")


if __name__ == "__main__":
    main()

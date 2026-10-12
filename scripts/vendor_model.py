"""Export the pinned MyoHub right hand from a local checkout (see model README)."""

import json
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REVISION = "93b0ca8f4ec90c9899ee7f05fee561e9911da91b"
source = Path(sys.argv[1]).resolve()
revision = subprocess.check_output(
    ["git", "-C", str(source), "rev-parse", "HEAD"], text=True
).strip()
if revision != REVISION:
    raise SystemExit(f"Expected {REVISION}, got {revision}")
sys.path.insert(0, str(source))
from myo_sim.build.compose import build_right_hand_from_arm_spec

spec = build_right_hand_from_arm_spec()
spec.compile()
root = ET.fromstring(spec.to_xml())
root.find("compiler").set("meshdir", ".")
destination = ROOT / "models/myohand"
(destination / "meshes").mkdir(parents=True, exist_ok=True)
for mesh in root.findall("./asset/mesh"):
    filename = Path(mesh.get("file"))
    shutil.copy2(source / "myo_sim/models" / filename, destination / filename)
ET.indent(root)
ET.ElementTree(root).write(destination / "hand.xml", encoding="unicode")
license_text = subprocess.check_output(
    ["git", "-C", str(source), "show", "HEAD:LICENSE"], text=True
)
(destination / "LICENSE").write_text(license_text)
(destination / "provenance.json").write_text(
    json.dumps(
        {
            "repository": "https://github.com/MyoHub/myo_sim",
            "revision": revision,
            "builder": "myo_sim.build.compose.build_right_hand_from_arm_spec",
            "license": "Apache-2.0",
            "export_changes": ["meshdir rewritten to relative path"],
            "runtime_changes": [
                "gravity disabled for supported-hand exploration",
                "timestep 0.002 s; implicitfast integrator",
                "joint limits from models/myohand/joint_ranges.json (14 joints widened toward "
                "published range of motion)",
                "passive joint stiffness from models/myohand/passive_stiffness.json",
                "5 actuators (APB, FPB, AdP, ADM, FDM) grafted from MUSIC commit 1b13b79 when its "
                "local cache exists; unlicensed, not vendored",
            ],
        },
        indent=2,
    )
    + "\n"
)
print(f"Exported {len(root.findall('./asset/mesh'))} meshes to {destination}")

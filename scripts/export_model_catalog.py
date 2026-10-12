"""Generate the exact joint/actuator/tendon catalog from the vendored model."""

import argparse
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import mujoco
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.simulation.engine import HandSimulation, load_joint_ranges


def render():
    sim = HandSimulation()
    model, data = sim.model, sim.data
    meta = sim.metadata()
    xml = ET.parse(ROOT / "models/myohand/hand.xml").getroot()
    tendons = {x.get("name"): x for x in xml.findall("./tendon/spatial")}
    neutral = sim.moment_arms()
    sampled = np.abs(neutral)
    for j in range(model.njnt):
        for fraction in (0.1, 0.5, 0.9):
            data.qpos[:] = model.qpos0
            lo, hi = model.jnt_range[j]
            data.qpos[j] = lo + fraction * (hi - lo)
            mujoco.mj_forward(model, data)
            sampled = np.maximum(sampled, np.abs(sim.moment_arms()))
    sim.reset()
    joints = [
        {
            **joint,
            "range_rad": model.jnt_range[i].tolist(),
            "axis_frame": model.body(int(model.jnt_bodyid[i])).name,
            "reference_rad": float(model.qpos0[i]),
        }
        for i, joint in enumerate(meta["joints"])
    ]
    actuators = []
    # MUSIC muscles are grafted from an unlicensed local cache. Keep their geometry and
    # parameters out of this checked-in catalog so it holds no MUSIC-derived data.
    anatomy = json.loads((ROOT / "data/anatomy/anatomy.json").read_text())
    unlicensed = {a["id"] for a in anatomy["actuators"] if a.get("provider") == "music"}
    for i, actuator in enumerate(meta["actuators"]):
        if actuator["id"] in unlicensed:
            continue
        tendon_id = model.actuator_trnid[i, 0]
        tendon_name = model.tendon(int(tendon_id)).name
        path = []
        if tendon_name not in tendons:
            # Grafted at load time (MUSIC): rebuild the site list from the compiled model.
            start, count = model.tendon_adr[tendon_id], model.tendon_num[tendon_id]
            for w in range(start, start + count):
                site = model.site(int(model.wrap_objid[w]))
                path.append(
                    {
                        "type": "site",
                        "site": site.name,
                        "body": model.body(int(site.bodyid[0])).name,
                        "local_position_m": site.pos.tolist(),
                    }
                )
        for element in tendons.get(tendon_name, []):
            item = {"type": element.tag, **element.attrib}
            if element.tag == "site":
                site = model.site(element.get("site"))
                item["body"] = model.body(int(site.bodyid[0])).name
                item["local_position_m"] = site.pos.tolist()
            path.append(item)
        influences = []
        for j in range(model.nv):
            if sampled[i, j] > 0.0001:
                influences.append(
                    {
                        "joint_id": joints[j]["id"],
                        "neutral_moment_arm_mm": round(float(neutral[i, j] * 1000), 5),
                        "max_sampled_abs_moment_arm_mm": round(float(sampled[i, j] * 1000), 5),
                    }
                )
        actuators.append(
            {
                "id": actuator["id"],
                "tendon_id": tendon_name,
                "origin_site": path[0],
                "insertion_site": path[-1],
                "path": path,
                "affected_dofs": influences,
                "length_range_m": model.actuator_lengthrange[i].tolist(),
                "gain_parameters": model.actuator_gainprm[i].tolist(),
                "activation_time_constants_s": model.actuator_dynprm[i, :2].tolist(),
            }
        )
    result = {
        "source": json.loads((ROOT / "models/myohand/provenance.json").read_text()),
        "coordinate_conventions": {
            "length": "metres",
            "force": "newtons",
            "time": "seconds",
            "angles": "radians internally; range is degrees for display; range_rad is radians",
            "axis": "unit axis in the named local body frame; right-hand positive rotation",
            "passive_stiffness": "N*m/rad as [resisting positive motion, resisting negative motion], linear on each side of reference_rad; basis is measured or assumed (see models/myohand/passive_stiffness.json)",
            "moment_arm": "-d(tendon length)/d(joint angle); mm in this file; positive contraction torque acts along positive joint axis",
            "thumb_flexion": "negative coordinates; positive coordinates extend the thumb",
            "forearm_rotation": "positive pronation, negative supination",
            "finger_ab_adduction": "positive radial, negative ulnar; anatomical abduction/adduction depends on digit",
        },
        "influence_sampling": "Neutral plus 10%, 50%, 90% of each coordinate range, one coordinate at a time. Threshold 0.1 mm. This is a sampled influence graph, not an exhaustive global bound.",
        "counts": {**meta["counts"], "actuators": len(actuators)},
        "omitted_actuators": {
            "ids": sorted(unlicensed),
            "reason": "Grafted from MUSIC (no license) at load time; see scripts/fetch_music.py.",
        },
        "joints": joints,
        "actuators": actuators,
    }
    lines = [
        "# Model coordinates and tendon routes",
        "",
        "Generated from the vendored MJCF by `python scripts/export_model_catalog.py`. The [machine-readable catalog](../data/anatomy/model.json) includes all tendon sites, wrapping references, local attachment coordinates, activation constants, and sampled muscle-to-DOF mappings.",
        "",
        "## Coordinate conventions",
        "",
        "Lengths use metres, forces newtons, and time seconds. MuJoCo stores joint angles in radians; the GUI displays degrees. Each axis is local to its body and uses right-hand positive rotation. Thumb flexion is negative in this model; pronation is positive. Finger radial motion is positive, which is not synonymous with abduction for every digit.",
        "",
        "Moment arms are −d(tendon length)/d(joint angle), displayed in millimetres. Their sign identifies the direction of contractile torque. Actual movement also depends on other muscles, passive forces, inertia, and joint constraints.",
        "",
        "## Joint coordinates",
        "",
        "| Coordinate | Display name | Range (degrees) | Positive direction | Negative direction | Passive stiffness (N·m/rad) |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for joint in joints:
        lo, hi = joint["range"]
        positive, negative = joint["passive_stiffness_nm_per_rad"]
        value = f"{positive:.3g}" if positive == negative else f"+{positive:.3g} / −{negative:.3g}"
        stiffness = f"{value} ({joint['passive_stiffness_basis']})"
        lines.append(
            f"| `{joint['id']}` | {joint['name']} | {lo:.1f} to {hi:.1f} | {joint['positive']} | {joint['negative']} | {stiffness} |"
        )
    lines += [
        "",
        "MyoHand defines joint damping but no joint stiffness. The engine adds linear passive springs toward the reference posture at load time. Where two values are given (+ / −), the spring is stiffer on one side: the first resists motion in the positive direction, the second in the negative direction. Values marked measured come from in-vivo studies of relaxed joints; values marked assumed have no direct measurement. Sources, sample sizes, and simplifications are in [passive_stiffness.json](../models/myohand/passive_stiffness.json).",
        "",
        "Ranges for "
        + ", ".join(
            f"`{name}`"
            for name, entry in load_joint_ranges()["joints"].items()
            if entry["range_deg"] != entry["upstream_deg"]
        )
        + " differ from upstream MyoHand: limits outside normal range of motion were moved toward published means, stopping where a muscle path fails. The upstream values, sources, and reasons are in [joint_ranges.json](../models/myohand/joint_ranges.json); [validation.md](validation.md) compares every limit with published range of motion.",
    ]
    lines += [
        "",
        "## Muscle-to-DOF mapping",
        "",
        result["influence_sampling"],
        "",
        "Values below are neutral-posture signed moment arms in mm; the GUI recomputes them at the current posture. A sampled influence can have a near-zero neutral value.",
        "",
        "| Actuator | Influenced coordinates (neutral moment arm, mm) |",
        "| --- | --- |",
    ]
    for actuator in actuators:
        mappings = "; ".join(
            f"`{a['joint_id']}` {a['neutral_moment_arm_mm']:+.2f}"
            for a in actuator["affected_dofs"]
        )
        lines.append(f"| `{actuator['id']}` | {mappings} |")
    lines += [
        "",
        "## Representation limits",
        "",
        "Joint limits are compliant constraints and may be slightly exceeded under load. The scene uses zero gravity and has no external grasp objects. `RI2_r` starts beyond its length range at the reference posture and produces about 12 N of passive force at zero activation, which holds the relaxed index finger near 7° of radial motion; `RI5_r` starts below its range. Both look like conversion artifacts and are left unmodified. The source includes fixed proximal scaffold bodies and meshes outside the displayed forearm/hand. Muscle paths are model line routes; their thickness in the GUI is illustrative. They are not measured muscle-belly cross sections.",
        "",
        "The model has 23 coordinates, including forearm rotation. It has no independent ring or little-finger CMC coordinate. See [model provenance](../models/myohand/provenance.json), [anatomical inventory](anatomy.md), and [simulator decision](simulator-decision.md).",
        "",
    ]
    return json.dumps(result, indent=2) + "\n", "\n".join(lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    catalog, doc = render()
    for rel, content in [("data/anatomy/model.json", catalog), ("docs/model.md", doc)]:
        path = ROOT / rel
        if args.check:
            if not path.exists() or path.read_text() != content:
                raise SystemExit(f"Stale generated file: {rel}")
        else:
            path.write_text(content)
            print(rel)

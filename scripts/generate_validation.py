"""Generate docs/validation.md: model moment arms and joint ranges against published human data.

Reference values and their sources live in data/validation/references.json. This compares the
MyoHand model without the MUSIC muscles, so the document contains nothing derived from MUSIC.
--include-music prints the MUSIC muscles' moment arms to stdout for local use and writes nothing.
"""

import argparse
import json
import sys
from pathlib import Path

import mujoco
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.simulation.engine import (  # noqa: E402
    ROOT,
    HandSimulation,
    joint_description,
    load_joint_ranges,
)

REFERENCES = ROOT / "data/validation/references.json"
OUTPUT = ROOT / "docs/validation.md"
SAMPLES = 41

# Postures the published values were measured in, expressed in model coordinates (degrees).
POSTURES = {
    "reference": "reference posture (all joints 0°)",
    "range": "mean over the model's range of that joint",
    "finger_sweep": "mean over 0–80° of that joint (abduction: its full model range)",
    "key_pinch": "key pinch: CMC flexion 30°, CMC abduction 0°, MCP flexion 17°",
    "mcp_0": "index MCP at 0°",
    "mcp_30": "index MCP at 30° flexion",
}
KEY_PINCH = {"cmc_flexion_r": -30.0, "cmc_abduction_r": 0.0, "mp_flexion_r": -17.0}

REGIONS = [
    ("Wrist", {"flexion_r", "deviation_r"}),
    ("Forearm rotation", {"pro_sup_r"}),
    ("Thumb", {"cmc_flexion_r", "cmc_abduction_r", "mp_flexion_r", "ip_flexion_r"}),
    ("Index finger", {"mcp2_flexion_r", "mcp2_abduction_r", "pm2_flexion_r", "md2_flexion_r"}),
]

FINDINGS = [
    "**Joint limits now follow normal range of motion where MyoHand's paths allow it.** Upstream "
    "MyoHand stopped ulnar deviation at 10° (people: about 37°; with 25° radial deviation, the "
    "range looked mirrored), wrist flexion and extension at 45° (people: about 66–80°), and "
    "finger hyperextension at 0°, and its thumb MCP extended to 40° but flexed only to 45°. "
    "These limits were moved to the published means. Three stop short because MyoHand's muscle "
    "paths fail beyond them: wrist flexion at 56° (EDC3 starts to flex the wrist at 57°), wrist "
    "extension at 65° (the FDS2 path snaps across its wrapping surface at 65.8°), and "
    "little-finger PIP hyperextension at 11° (the EDC5 path snaps to the palmar side at 11.7°). "
    "The index MCP keeps its 0° stop, because RI2_r's passive pull at rest would otherwise hold "
    "the relaxed index 17° hyperextended.",
    "**The wrist prime movers act in the right directions.** FCR, FCU, ECRL, ECRB, ECU, and APL "
    "match Garland's directions on both wrist axes. APL's moment arms agree in size. The other "
    "five have flexion-extension moment arms 1.3–1.8× Garland's tendon-excursion means (ECU is "
    "the largest at 1.8×); FCR and FCU at 15–16 mm sit between Garland's values and the older "
    "Brand and Hollister data (about 18 mm). FCR's radial deviation moment arm is a third of "
    "Garland's.",
    "**The thumb extrinsics have wrist deviation moment arms 2.5–4× too large** (FPL 21 mm, "
    "EPL 23 mm, against about 5 and 9 mm read from Brand and Hollister's figure). EIP's small "
    "deviation moment arm has the opposite sign to the figure value, which is within reading "
    "error of zero.",
    "**Pronator teres is 1.4–1.6× cadaver values** (11.6 mm against 7.3–8.5 mm). Murray et al. "
    "(1995) found a similar gap in their own model (about 12 mm against 5–7.5 mm). Pronator "
    "quadratus agrees.",
    "**FPL flexes the thumb CMC and MCP too weakly** (6 mm against 14 and 11 mm in Smutz's "
    "data). APL extends the CMC by almost nothing (published: 7 mm). EPL acts in the published "
    "direction at every thumb joint, and FPL agrees at the IP joint. EPB and OP agree on their "
    "main CMC actions; their CMC abduction moment arms are near zero, where Smutz's SDs are "
    "larger than the means.",
    "**Index finger extrinsics agree** with An et al. (1983) at every joint, except EIP at the "
    "PIP (2×). They are 16–33% below Franko et al. (2011), whose values are higher than An's. "
    "Of the intrinsic channels, RI2 matches the first dorsal interosseous, while LU_RB2 and "
    "UI_UB2 have less than half the published MCP flexion moment arm.",
]

NOT_COMPARED = [
    "The five MUSIC muscles (APB, FPB, AdP, ADM, FDM). Smutz 1998 has data for APB, FPB, and AdP, "
    "but MUSIC has no license, so this file must not contain values derived from it. Run "
    "`python scripts/generate_validation.py --include-music` to print their moment arms locally.",
    "Middle, ring, and little fingers: no open primary data were found for their moment arms.",
    "Muscle forces, force-length behavior, activation dynamics, and joint torques. These need "
    "isometric strength data and are not checked here.",
    "Movement: no comparison of simulated motion with recorded human motion.",
]


def moment_arms_at(sim, angles_deg):
    """Moment arms (mm) of every actuator with the given joints set, the others at 0."""
    m, d = sim.model, sim.data
    d.qpos[:] = m.qpos0
    for name, value in angles_deg.items():
        d.qpos[m.joint(name).qposadr[0]] = np.deg2rad(value)
    mujoco.mj_forward(m, d)
    return sim.moment_arms() * 1000


def model_value(sim, actuator, joint, posture):
    m = sim.model
    a, dof = m.actuator(actuator).id, m.joint(joint).dofadr[0]
    if posture == "reference":
        return moment_arms_at(sim, {})[a, dof]
    if posture == "key_pinch":
        return moment_arms_at(sim, KEY_PINCH)[a, dof]
    if posture.startswith("mcp_"):
        return moment_arms_at(sim, {"mcp2_flexion_r": float(posture[4:])})[a, dof]
    low, high = np.rad2deg(m.jnt_range[m.joint(joint).id])
    if posture == "finger_sweep" and "flexion" in joint:
        low, high = max(low, 0.0), min(high, 80.0)
    values = [moment_arms_at(sim, {joint: q})[a, dof] for q in np.linspace(low, high, SAMPLES)]
    return float(np.mean(values))


def verdict(published, model):
    """Agreement rule; stated in the document."""
    if abs(published) < 2:
        return "agrees" if abs(model) < 2 else "reference near zero"
    if np.sign(published) != np.sign(model) and abs(model) >= 2:
        return "**opposite direction**"
    if abs(model) < 2:
        return "model near zero"
    ratio = model / published
    if 2 / 3 <= ratio <= 1.5:
        return "agrees"
    return f"same direction, {ratio:.1f}×"


def spread_text(entry):
    kind, spread = entry.get("spread_kind"), entry.get("spread_mm")
    if spread is None:
        return " (approx.)" if entry.get("approx") else ""
    if kind == "range":
        low, high = sorted(entry["to_model"] * np.array(spread))
        return f" (range {low:.1f} to {high:.1f})"
    return f" ± {spread:g} {kind}"


def degrees(value):
    return f"{round(abs(value), 2):g}°"


def joint_label(joint):
    label, positive, _ = joint_description(joint)
    return f"{label} (+ {positive.lower()})"


def build(sim, references):
    number = {s["id"]: i + 1 for i, s in enumerate(references["sources"])}
    rows = []
    for entry in references["moment_arms"]:
        published = entry["to_model"] * entry["value_mm"]
        model = model_value(sim, entry["actuator"], entry["joint"], entry["posture"])
        rows.append({**entry, "published": published, "model": model})
    for row in rows:
        row["verdict"] = verdict(row["published"], row["model"])

    lines = [
        "# Biomechanical validation",
        "",
        "<!-- Generated by scripts/generate_validation.py from data/validation/references.json. "
        "Do not edit by hand. -->",
        "",
        "This document compares the model with published human and cadaver measurements. It is "
        "separate from the software tests in `tests/`, which check that the code does what it "
        "is meant to do. This file checks whether what the model does matches people.",
        "",
        "Two things are compared: **moment arms** (how strongly each muscle can turn each joint, "
        "−dL/dq in mm) and **joint ranges** (the model's limits against normal range of motion). "
        "The model is MyoHand as this app runs it, without the five MUSIC muscles.",
        "",
        "## Main findings",
        "",
        "SUMMARY",
        "",
        *[f"- {finding}" for finding in FINDINGS],
        "",
        "## Method",
        "",
        "- **Sign conversion.** Each published value is converted into the model's sign "
        "convention (the + direction is named in each table), so a positive number means the "
        "muscle pulls toward the model's + direction.",
        "- **Posture.** Moment arms change with posture, so the model is evaluated in the posture "
        "the study used, or averaged over a range when the study reports range-of-motion means. "
        "Other joints stay at 0°. Postures used:",
        *[f"  - *{key}*: {text}" for key, text in POSTURES.items()],
        "- **Agreement rule.** *Agrees* means same direction and the model within 2/3 to 1.5 "
        "times the published mean, or both values under 2 mm. *Same direction, k×* gives the "
        "ratio model/published when it falls outside that band. *Opposite direction* means the "
        "signs differ and the model value is at least 2 mm. *Model near zero* means the model "
        "value is under 2 mm where the published one is not. Published values under 2 mm are "
        "within measurement noise for most studies, so they are marked *reference near zero* "
        "rather than judged.",
        "- **Spread.** SD, SEM, or the range across specimens is shown as printed. Franko 2011 "
        "reports SEM, which understates between-person variation. Values marked *approx.* were "
        "read off a figure (about ±1 mm).",
        "- **Zero postures may differ.** The model's 0° is not always the posture a study called "
        "neutral, especially at the thumb CMC, where each study defines its own axes.",
        "",
    ]
    counts = {}
    for title, joints in REGIONS:
        region = [r for r in rows if r["joint"] in joints]
        counts[title] = (sum(r["verdict"] == "agrees" for r in region), len(region))
        lines += [
            f"## Moment arms: {title.lower()}",
            "",
            "| Muscle | DOF (model + direction) | Published, mm | Model, mm | Agreement | "
            "Source | Posture |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
        for r in region:
            note = f" ({r['note']})" if r.get("note") else ""
            lines.append(
                f"| {r['actuator']}{note} | {joint_label(r['joint'])} | "
                f"{r['published']:.1f}{spread_text(r)} | {r['model']:.1f} | {r['verdict']} | "
                f"[{number[r['source']]}](#sources) | {r['posture']} |"
            )
        lines.append("")
    summary = ", ".join(f"{title.lower()} {a} of {n}" for title, (a, n) in counts.items())
    lines[lines.index("SUMMARY")] = (
        f"Moment arms that meet the agreement rule below: {summary}. The rest are listed by "
        "region, with the ratio of model to published value."
    )

    lines += [
        "## Joint ranges",
        "",
        "The model's joint limits against normal range of motion. *Below normal* marks a limit "
        "more than one SD under the published mean; *above normal*, more than two SD over it. "
        "*Upstream* is MyoHand's own limit. Limits that were outside normal range in MyoHand "
        "were moved to these same published means "
        "([joint_ranges.json](../models/myohand/joint_ranges.json)), so those rows agree by "
        "construction; the notes say where a limit stops short and why.",
        "",
        "| Motion | Model limit | Upstream | Published mean ± SD | Source | | Note |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    m = sim.model
    overrides = load_joint_ranges()["joints"]
    for entry in references["range_of_motion"]:
        low, high = np.rad2deg(m.jnt_range[m.joint(entry["joint"]).id])
        limit = high if entry["direction"] == "positive" else -low
        override = overrides.get(entry["joint"], {})
        upstream_low, upstream_high = override.get("upstream_deg", (low, high))
        upstream = upstream_high if entry["direction"] == "positive" else -upstream_low
        side = override.get("sides", {}).get(entry["direction"], {})
        note = (
            "path fails beyond (see joint_ranges.json)"
            if "limited_by" in side
            else "kept upstream (see joint_ranges.json)"
            if "kept_upstream" in side
            else "set to published mean"
            if side
            else ""
        )
        groups = [(k, entry[k]) for k in ("women", "men", "all") if k in entry]
        text = "; ".join(
            f"{k} {mean:g} ± {sd:g}" if k != "all" else f"{mean:g} ± {sd:g}"
            for k, (mean, sd) in groups
        )
        below = all(limit < mean - sd for _, (mean, sd) in groups)
        above = all(limit > mean + 2 * sd for _, (mean, sd) in groups)
        flag = "**below normal**" if below else "**above normal**" if above else ""
        lines.append(
            f"| {entry['label']} | {degrees(limit)} | {degrees(upstream)} | {text} | "
            f"[{number[entry['source']]}](#sources) | {flag} | {note} |"
        )
    lines += [
        "",
        "Thumb CMC ranges are not compared: clinical goniometry measures palmar and radial "
        "abduction in planes that do not match the model's CMC axes.",
        "",
        "## Not compared",
        "",
        *[f"- {item}" for item in NOT_COMPARED],
        "",
        "## Sources",
        "",
    ]
    for source in references["sources"]:
        lines.append(
            f"{number[source['id']]}. {source['citation']} <{source['url']}>. "
            f"{source['sample']}. Convention: {source['convention']}. "
            f"Values from: {source['location']}."
        )
    return "\n".join(lines) + "\n"


def print_music():
    sim = HandSimulation(include_music=True)
    names = [n for n in ("APB_r", "FPB_r", "AdP_r", "ADM_r", "FDM_r") if n in sim.actuator_ids]
    if not names:
        print("MUSIC cache not found; run scripts/fetch_music.py first.")
        return
    arms = moment_arms_at(sim, KEY_PINCH)
    joints = ["cmc_flexion_r", "cmc_abduction_r", "mp_flexion_r", "mcp5_flexion_r"]
    print("MUSIC muscles at key pinch, mm, model signs (local only, do not commit):")
    for name in names:
        values = [arms[sim.actuator_ids[name], sim.model.joint(j).dofadr[0]] for j in joints]
        print(name, "  ".join(f"{j}={v:.1f}" for j, v in zip(joints, values, strict=True)))


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="fail if the file is out of date")
    parser.add_argument("--include-music", action="store_true", help="print MUSIC values only")
    args = parser.parse_args()
    if args.include_music:
        print_music()
        return
    text = build(HandSimulation(include_music=False), json.loads(REFERENCES.read_text()))
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text() != text:
            sys.exit("docs/validation.md is out of date; run scripts/generate_validation.py")
        return
    OUTPUT.write_text(text)
    print(f"wrote {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

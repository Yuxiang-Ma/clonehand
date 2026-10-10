"""Generate the anatomy reference from the checked-in JSON inventory."""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/anatomy/anatomy.json"
OUTPUT = ROOT / "docs/anatomy.md"


def render(data):
    sources = {source["id"]: source for source in data["sources"]}

    def citations(ids):
        return ", ".join(f"[{key}]({sources[key]['url']})" for key in ids)

    def cell(value):
        return str(value).replace("|", "\\|").replace("\n", " ")

    def table(headers, rows):
        return [
            "| " + " | ".join(headers) + " |",
            "| " + " | ".join("---" for _ in headers) + " |",
            *("| " + " | ".join(cell(value) for value in row) + " |" for row in rows),
            "",
        ]

    scope = data["scope"]
    counts = data["counts"]
    lines = [
        "# Hand and wrist anatomy",
        "",
        "Generated from [anatomy.json](../data/anatomy/anatomy.json). Edit the JSON, "
        "then run `python scripts/generate_anatomy_docs.py`.",
        "",
        f"This right-side reference contains {counts['bones_total']} bones and "
        f"{counts['anatomical_muscles_total']} anatomical muscles. The simulation uses "
        f"{counts['model_actuators']} independently controlled MyoHand actuators; these "
        "do not map one-to-one to the muscles.",
        "",
        "## Scope and counting rules",
        "",
        scope["boundary"],
        "",
        *[f"- {rule}" for rule in scope["counting_rules"]],
        "",
        "Count references: " + citations(scope["source_ids"]) + ".",
        "",
        "## Bones",
        "",
    ]
    lines += table(
        ["ID", "Bone", "Group", "Function"],
        [(f"`{b['id']}`", b["name"], b["group"], b["function"]) for b in data["bones"]],
    )
    lines += ["Bone reference: " + citations(["openstax_bones"]) + ".", ""]
    lines += [
        "## Muscles",
        "",
        "Attachments below describe reference anatomy. They do not specify the "
        "simulator's attachment coordinates or guarantee its motion. Each row "
        "counts as one anatomical muscle. A dash means no confirmed dedicated "
        "model channel; possible contributions to bundled channels remain unresolved.",
        "",
    ]
    for prefix, heading in [
        ("forearm", f"Forearm (extrinsic): {counts['forearm_muscles']} muscles"),
        ("intrinsic", f"Intrinsic hand: {counts['intrinsic_hand_muscles']} muscles"),
    ]:
        lines += [f"### {heading}", ""]
        lines += table(
            ["Muscle", "Origin", "Insertion", "Function", "Dedicated channels", "Sources"],
            [
                (
                    m["name"],
                    m["origin"],
                    m["insertion"],
                    m["function"],
                    ", ".join(f"`{aid}`" for aid in m["model_actuators"]) or "—",
                    citations(m["source_ids"]),
                )
                for m in data["muscles"]
                if m["group"].startswith(prefix)
            ],
        )
    excluded = scope.get("excluded_muscles", [])
    if excluded:
        lines += [
            "### Out of scope",
            "",
            "These muscles attach only to the arm or forearm bones, so the scope rule "
            "excludes them. They are not counted.",
            "",
        ]
        lines += table(
            ["Muscle", "Origin", "Insertion", "Reason", "Sources"],
            [
                (m["name"], m["origin"], m["insertion"], m["reason"], citations(m["source_ids"]))
                for m in excluded
            ],
        )
    lines += [
        "## Actuator correspondence",
        "",
        "FDS, FDP, and extensor digitorum each have four digital channels. "
        "The `RI`, `LU_RB`, and `UI_UB` labels identify twelve source-model "
        "intrinsic channels. Their exact anatomical membership is unresolved. "
        "Keep those labels when displaying controls; do not rename them as "
        "individual lumbricals or interossei. "
        + citations(["myohand_build", "myohand_tendons"])
        + ".",
        "",
    ]
    lines += table(
        ["Channel", "Display name", "Mapping"],
        [
            (f"`{a['id']}`", a["name"], a["mapping_status"].replace("_", " "))
            for a in data["actuators"]
        ],
    )
    lines += [
        "## Conventions and limitations",
        "",
        "[Model geometry and DOFs](model.md) document the simulator's axes, "
        "limits, local tendon sites, and wrap references. The machine-readable "
        "catalog is [model.json](../data/anatomy/model.json); its source is "
        "[hand.xml](../models/myohand/hand.xml). See "
        "[model provenance](../models/myohand/provenance.json) for the pinned revision.",
        "",
        *[f"- **{key}:** {value}" for key, value in scope["conventions"].items()],
        "",
        *[f"- {value}" for value in scope["variations"] + scope["model_limits"]],
        "",
        "Anatomical influence describes possible actions. Actual movement depends "
        "on posture, coactivation, passive forces, constraints, and contact. "
        "A muscle can produce force without joint motion.",
        "",
        "## Sources",
        "",
        *[f"- [{s['title']}]({s['url']}) (`{s['id']}`)" for s in data["sources"]],
        "",
    ]
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check", action="store_true", help="Fail if the Markdown needs regeneration."
    )
    args = parser.parse_args()
    content = render(json.loads(SOURCE.read_text(encoding="utf-8")))
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != content:
            parser.exit(
                1, "docs/anatomy.md is stale; run python scripts/generate_anatomy_docs.py\n"
            )
        print("docs/anatomy.md matches the anatomy inventory")
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(content, encoding="utf-8")
        print("Generated docs/anatomy.md")


if __name__ == "__main__":
    main()

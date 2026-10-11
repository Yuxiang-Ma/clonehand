"""Check anatomical counting rules and links to the simulation catalog."""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ACTUATORS = set(
    "ECRL_r ECRB_r ECU_r FCR_r FCU_r PL_r PT_r PQ_r "
    "FDS5_r FDS4_r FDS3_r FDS2_r FDP5_r FDP4_r FDP3_r FDP2_r "
    "EDC5_r EDC4_r EDC3_r EDC2_r EDM_r EIP_r EPL_r EPB_r FPL_r "
    "APL_r OP_r RI2_r LU_RB2_r UI_UB2_r RI3_r LU_RB3_r UI_UB3_r "
    "RI4_r LU_RB4_r UI_UB4_r RI5_r LU_RB5_r UI_UB5_r "
    "APB_r FPB_r AdP_r ADM_r FDM_r".split()
)


def inventory():
    return json.loads((ROOT / "data/anatomy/anatomy.json").read_text())


def test_counts_follow_declared_anatomical_scope():
    data = inventory()
    assert data["scope"]["handedness"] == "right"
    assert len(data["bones"]) == data["counts"]["bones_total"] == 29
    assert sum(b["group"] == "forearm" for b in data["bones"]) == 2
    assert sum(b["group"] == "carpal" for b in data["bones"]) == 8
    assert sum(b["group"] == "metacarpal" for b in data["bones"]) == 5
    assert sum(b["group"] == "phalanx" for b in data["bones"]) == 14
    assert len(data["muscles"]) == data["counts"]["anatomical_muscles_total"] == 37
    assert sum(m["group"].startswith("forearm") for m in data["muscles"]) == 18
    assert sum(m["group"].startswith("intrinsic") for m in data["muscles"]) == 19
    assert data["counts"]["intrinsic_hand_muscles"] == 19
    assert data["counts"]["model_actuators"] == len(data["actuators"]) == 44
    # Scope rule: excluded muscles are recorded with a reason and never counted.
    excluded = {m["id"] for m in data["scope"]["excluded_muscles"]}
    assert excluded == {"brachioradialis", "anconeus"}
    assert not excluded & {m["id"] for m in data["muscles"]}
    assert all(m["reason"] and m["source_ids"] for m in data["scope"]["excluded_muscles"])


def test_ids_sources_and_bidirectional_model_links():
    data = inventory()
    sources = {s["id"] for s in data["sources"]}
    muscles = {m["id"]: m for m in data["muscles"]}
    actuators = {a["id"]: a for a in data["actuators"]}
    assert set(actuators) == EXPECTED_ACTUATORS
    for section in ("bones", "muscles", "actuators"):
        entries = data[section]
        assert len({e["id"] for e in entries}) == len(entries)
        for entry in entries:
            assert all(entry[key] for key in ("id", "name", "group", "function"))
            assert entry["source_ids"] and set(entry["source_ids"]) <= sources
    for mid, muscle in muscles.items():
        assert muscle["origin"] and muscle["insertion"]
        for aid in muscle["model_actuators"]:
            assert mid in actuators[aid]["anatomical_muscle_ids"]
    for aid, actuator in actuators.items():
        for mid in actuator["anatomical_muscle_ids"]:
            assert aid in muscles[mid]["model_actuators"]
    assert muscles["palmaris_brevis"]["model_actuators"] == []
    assert muscles["opponens_digiti_minimi"]["model_actuators"] == []
    music = [a for a in actuators.values() if a.get("provider") == "music"]
    assert len(music) == 5 and all(a["source_ids"] == ["music"] for a in music)
    assert len(muscles["flexor_digitorum_profundus"]["model_actuators"]) == 4
    for aid, actuator in actuators.items():
        if aid.startswith(("RI", "LU_RB", "UI_UB")):
            assert actuator["mapping_status"] == "unresolved_bundle"
            assert actuator["anatomical_muscle_ids"] == []
            assert actuator["notes"]


def test_generated_anatomy_document_is_current():
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts/generate_anatomy_docs.py"), "--check"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_muscle_architecture_links_and_sources():
    architecture = json.loads((ROOT / "data/anatomy/muscle_architecture.json").read_text())
    sources = {s["id"] for s in architecture["sources"]}
    for key, muscle in architecture["muscles"].items():
        for field, item in muscle.items():
            assert "value" in item, (key, field)
            if item["value"] is not None and item.get("basis") != "assumed":
                assert item.get("source") in sources, (key, field)
    for actuator in inventory()["actuators"]:
        aid = actuator.get("architecture_id")
        if aid is None:
            assert actuator["architecture_note"]
        else:
            assert aid in architecture["muscles"], actuator["id"]


def test_validation_document_is_current():
    result = subprocess.run(
        [sys.executable, "scripts/generate_validation.py", "--check"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def test_every_muscle_and_bone_has_a_sourced_chinese_name():
    anatomy = json.loads((ROOT / "data/anatomy/anatomy.json").read_text())
    assert "termonline" in {source["id"] for source in anatomy["sources"]}
    for item in anatomy["muscles"] + anatomy["bones"]:
        assert item.get("name_zh"), item["id"]
        assert all("一" <= c <= "鿿" or c.isdigit() for c in item["name_zh"]), item["id"]
        assert "termonline" in item["source_ids"], item["id"]

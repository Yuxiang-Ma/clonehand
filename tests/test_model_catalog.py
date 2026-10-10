import json
from pathlib import Path

from scripts.export_model_catalog import render
from src.simulation.engine import HandSimulation

ROOT = Path(__file__).resolve().parents[1]


def test_model_catalog_references_and_units():
    data = json.loads((ROOT / "data/anatomy/model.json").read_text())
    sim = HandSimulation()
    joints = {j["id"] for j in data["joints"]}
    assert len(joints) == 23
    omitted = set(data["omitted_actuators"]["ids"])
    assert {a["id"] for a in data["actuators"]} == set(sim.actuator_ids) - omitted
    assert omitted == {"APB_r", "FPB_r", "AdP_r", "ADM_r", "FDM_r"}
    for a in data["actuators"]:
        assert len(a["path"]) >= 2
        assert a["origin_site"]["type"] == "site"
        assert a["insertion_site"]["type"] == "site"
        assert all(d["joint_id"] in joints for d in a["affected_dofs"])
    for j in data["joints"]:
        assert len(j["axis"]) == 3
        assert j["range_rad"][0] < j["range_rad"][1]


def test_generated_model_catalog_and_documentation_are_current():
    catalog, documentation = render()
    assert (ROOT / "data/anatomy/model.json").read_text() == catalog
    assert (ROOT / "docs/model.md").read_text() == documentation

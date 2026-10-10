from fastapi.testclient import TestClient

from src.server import app
from src.simulation.engine import load_music_muscles


def next_state(ws, predicate=lambda s: True):
    for _ in range(40):
        message = ws.receive_json()
        if message["type"] == "state" and predicate(message):
            return message
    raise AssertionError("Expected state did not arrive")


def test_model_and_anatomy_endpoints():
    with TestClient(app) as client:
        model = client.get("/api/model")
        assert model.status_code == 200
        data = model.json()
        assert data["counts"] == {
            "bones": 29,
            "dofs": 23,
            "actuators": 39 + len(load_music_muscles()),
        }
        assert len(data["meshes"]) == 29
        assert client.get("/api/anatomy").status_code == 200


def test_socket_validation_and_recovery():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        state = next_state(ws)
        assert state["paused"]
        ws.send_json({"type": "controls", "values": {"FDS2_r": 2}})
        for _ in range(40):
            message = ws.receive_json()
            if message["type"] == "error":
                break
        assert message["type"] == "error"
        ws.send_json({"type": "controls", "values": {"FDS2_r": 0.4}})
        assert max(next_state(ws, lambda s: max(s["excitation"]) == 0.4)["excitation"]) == 0.4
        ws.send_json({"type": "pause", "paused": False})
        assert next_state(ws, lambda s: s["time"] > 0)["time"] > 0
        ws.send_json({"type": "pause", "paused": True})
        next_state(ws, lambda s: s["paused"])
        ws.send_json({"type": "reset"})
        state = next_state(ws, lambda s: s["time"] == 0)
        assert max(state["excitation"]) == 0


def test_sessions_are_independent():
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as a, client.websocket_connect("/ws") as b:
            next_state(a)
            next_state(b)
            a.send_json({"type": "controls", "values": {"FDS2_r": 0.7}})
            next_state(a, lambda s: max(s["excitation"]) == 0.7)
            assert max(next_state(b)["excitation"]) == 0


def test_invalid_pause_type_is_not_coerced():
    with TestClient(app) as client, client.websocket_connect("/ws") as ws:
        next_state(ws)
        ws.send_json({"type": "pause", "paused": "false"})
        for _ in range(40):
            message = ws.receive_json()
            if message["type"] == "error":
                break
        assert message["type"] == "error"
        assert next_state(ws)["paused"]

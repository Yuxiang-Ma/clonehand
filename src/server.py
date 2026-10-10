"""Local service. Each WebSocket owns its simulation state."""

import asyncio
import json
from contextlib import suppress
from functools import lru_cache

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from src.simulation.engine import ROOT, HandSimulation

app = FastAPI(title="Clonehand", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(GZipMiddleware, minimum_size=1000)


@lru_cache(maxsize=1)
def model_payload():
    return HandSimulation().metadata()


@app.get("/api/model")
def get_model():
    return model_payload()


@app.get("/api/anatomy")
def get_anatomy():
    return json.loads((ROOT / "data/anatomy/anatomy.json").read_text())


@app.get("/api/health")
def health():
    return {"status": "ok", "engine": "MuJoCo", "model": "MyoHand"}


@app.websocket("/ws")
async def simulation_socket(websocket: WebSocket):
    await websocket.accept()
    sim = HandSimulation()
    sim.paused = True
    send_lock = asyncio.Lock()

    async def send(payload):
        async with send_lock:
            await websocket.send_json(payload)

    async def publish():
        while True:
            start = asyncio.get_running_loop().time()
            try:
                sim.advance(16)
            except RuntimeError as error:
                await send({"type": "error", "message": str(error)})
            await send(sim.snapshot())
            elapsed = asyncio.get_running_loop().time() - start
            await asyncio.sleep(max(0.001, 0.032 - elapsed))

    publisher = asyncio.create_task(publish())
    try:
        while True:
            try:
                message = await websocket.receive_json()
                if not isinstance(message, dict):
                    raise ValueError("Send a command object.")
                command = message.get("type")
                if command == "controls":
                    sim.set_controls(message.get("values"))
                elif command == "pause":
                    if not isinstance(message.get("paused"), bool):
                        raise ValueError("paused must be true or false.")
                    sim.paused = message["paused"]
                elif command == "relax":
                    sim.relax()
                elif command == "reset":
                    sim.reset()
                else:
                    raise ValueError(f"Unknown command: {command}")
            except (ValueError, TypeError) as error:
                await send({"type": "error", "message": str(error)})
    except WebSocketDisconnect:
        pass
    finally:
        publisher.cancel()
        with suppress(asyncio.CancelledError, WebSocketDisconnect, RuntimeError):
            await publisher


# Built client only; never expose the repository, .venv, or source files.
if (ROOT / "dist/assets").is_dir():
    app.mount("/assets", StaticFiles(directory=ROOT / "dist/assets"), name="assets")


def built_page(name):
    path = ROOT / "dist" / name
    if path.exists():
        return FileResponse(path)
    return JSONResponse(
        {"message": "Build the interface with npm run build, or run npm run dev on port 5173."},
        status_code=503,
    )


@app.get("/")
def index():
    return built_page("index.html")


@app.get("/anatomy.html")
def anatomy_page():
    return built_page("anatomy.html")

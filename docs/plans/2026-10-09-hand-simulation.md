# Hand Simulation Implementation Plan

**Goal:** Deliver a local interactive right-hand musculoskeletal simulator with sourced anatomy, real muscle actuation, and visible joint influence.

**Architecture:** A pinned MyoHand MJCF model runs in MuJoCo. A Python service maintains one simulation per browser connection and streams geometry transforms, tendon paths, activation, and moment arms. Three.js renders the same model; HTML controls provide muscle selection and excitation. Anatomy metadata stays independent of the simulator.

**Tech stack:** Python, MuJoCo, FastAPI, TypeScript, Three.js, Vite, pytest, Playwright.

## Model and research
1. Compare MuJoCo/MyoHand, OpenSim hand models, and visual-only models in `docs/simulator-decision.md`.
2. Vendor a pinned MyoHub/myo_sim hand export into `models/myohand/`, including source license and regeneration instructions.
3. Build `data/anatomy/anatomy.json` with sources and explicit counting conventions; generate `docs/anatomy.md`.

## Simulation and API
1. Write failing tests in `tests/test_simulation.py` for model load, finite stepping, excitation bounds, relaxation, reset, and muscle-to-DOF signs.
2. Implement `src/simulation/engine.py`: independent model state, fixed timestep, muscle excitation, geometry export, and posture-dependent moment arms.
3. Test API validation/session isolation in `tests/test_api.py`; implement `src/server.py` with model metadata and a per-connection simulation stream.
4. Run `.venv/bin/python -m pytest -q`.

## GUI
1. Build `src/gui/main.ts`, `viewer.ts`, and `style.css` around a large 3D specimen view, searchable muscle list, and selected-muscle inspector.
2. Show excitation versus activation, selected versus active paths, joint action direction versus measured angle, and model limits.
3. Include orbit, palm/dorsal views, visibility toggles, multi-muscle controls, relaxation, pause, reset, and a connection error/retry state.
4. Verify the browser flow with Playwright: activation changes paths and joint readings, pause freezes time, reset clears commands, search works, and narrow layouts remain usable.

## Documentation and review
1. Write README setup/run/build/test instructions and model limitations.
2. Review numerical and anatomical assumptions separately from software correctness.
3. Run backend tests, TypeScript checks, production build, and browser smoke tests. Inspect desktop and narrow screenshots in one pass; fix material defects and verify once more.
4. Record the shipped interface in DESIGN.md and provide the local launch URL.

No Git repository is initialized; implementation remains in the supplied workspace.

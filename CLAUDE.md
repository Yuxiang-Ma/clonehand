# CLAUDE.md

@AGENTS.md

AGENTS.md defines scope, deliverables, and contribution rules. This file adds what Claude Code needs to work in this checkout. Product intent is in `PRODUCT.md`; the build plan is in `docs/plans/2026-10-09-hand-simulation.md`.

## Stack

- Physics: MuJoCo 3.x running the vendored MyoHand model (`models/myohand/hand.xml`, MyoHub/myo_sim revision `93b0ca8f`, Apache-2.0). The reasons for choosing it are in `docs/simulator-decision.md`.
- Service: FastAPI (`src/server.py`) on port 8000. `GET /api/model`, `GET /api/anatomy`, `GET /api/health`, and `WS /ws`.
- GUI: TypeScript, Three.js, and Vite (`src/gui/`). Two pages: `index.html` (simulator, `main.ts`) and `anatomy.html` (readable inventory, `anatomy.ts`, built from `/api/anatomy`). The server routes `/` and `/anatomy.html` to `dist/`. The dev server runs on 5173 and proxies `/api` and `/ws` to 8000.
- Python 3.13 in `.venv/`. Node packages are in `node_modules/`.

## Commands

All of these were run and passed on 2026-10-09 unless noted.

```bash
# Python tests (39 tests with the MUSIC cache; the web-engine comparison needs node and npm install). The shell sources ROS Humble, whose pytest plugin
# (launch_testing) needs yaml and crashes collection. Disable plugin autoload:
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest -q

# Lint and format (ruff config in pyproject.toml, line length 100)
.venv/bin/ruff check .
.venv/bin/ruff format --check .

# Generated files must match their sources (tests also enforce this)
.venv/bin/python scripts/generate_anatomy_docs.py --check   # anatomy.json -> docs/anatomy.md
.venv/bin/python scripts/export_model_catalog.py --check    # hand.xml -> data/anatomy/model.json, docs/model.md
.venv/bin/python scripts/generate_validation.py --check     # references.json + model -> docs/validation.md
# Drop --check to regenerate.

# TypeScript
npm run typecheck
npm run build          # tsc + vite build -> dist/ (served by FastAPI at /)

# Run locally (two terminals)
.venv/bin/uvicorn src.server:app --host 127.0.0.1 --port 8000
npm run dev            # http://127.0.0.1:5173
```

`npm run test:browser` (14 Playwright tests) builds, starts uvicorn on port 8765, and drives headless Chromium with SwiftShader WebGL. It needs `npx playwright install chromium` once; the installed Playwright (1.64) wants Chromium build 1248.

`npm run test:demo` (8 Playwright tests) runs `npm run build:demo` and serves `dist-demo/` with a plain static server, then checks that the page never calls `/api` or `/ws`.

`README.md` holds the user-facing setup, run, and test instructions. Keep it in sync with this block.

## MUSIC muscles (unlicensed)

`scripts/fetch_music.py` clones MUSIC (github.com/xupei0610/music, commit `1b13b79`) into `~/.cache/clonehand/` (override with `CLONEHAND_MUSIC_DIR`). `load_music_muscles()` and `add_music_muscles()` in `engine.py` graft APB, FPB, AdP, ADM, and FDM at load time. The user chose this on 2026-10-10 knowing MUSIC has no license: never copy MUSIC files into this repo or publish them. Tests skip MUSIC-specific checks when the cache is missing, and `data/anatomy/model.json` is generated with the cache present. MUSIC names the thumb CMC axes the other way round from MyoHand; MyoHand's names are the anatomically correct ones.

## Static web demo

`npm run build:demo` runs `scripts/export_web_demo.py` (writes `.demo-data/`: `model.json`, `anatomy.json`, a mesh-free `hand.xml` with the runtime settings baked in, `physics.json`, licenses) and then `vite build --mode demo` into `dist-demo/`. In demo mode, `src/gui/link.ts` swaps the WebSocket for a Web Worker (`sim-worker.ts`) that runs `local-engine.ts`, a TypeScript port of `HandSimulation`, on the `mujoco` npm package (official WASM, MuJoCo 3.5.1). The service build aliases `worker-link.ts` to a stub so `dist/` ships no WebAssembly. `tests/test_web_demo.py` runs the TypeScript engine under Node and requires its snapshot to match `HandSimulation` field by field; keep `local-engine.ts` free of TypeScript-only syntax (no parameter properties) so Node's type stripping can run it. The demo omits MUSIC by design. `.github/workflows/pages.yml` checks, builds, and deploys it to GitHub Pages (https://yuxiang-ma.github.io/clonehand/) on every push to `main`; CI never fetches MUSIC. An older private copy is a claude.ai artifact (https://claude.ai/artifact/SDzazSxjA9oPdGD2w9rdBs); that host wraps the page, so republishing there needs `index.html` without its `<html>`/`<head>`/`<body>` tags.

## Validation and design docs

`docs/validation.md` is generated from `data/validation/references.json` (published moment arms and ranges of motion, each with a source) and the model. Add reference values there, never in the markdown. The findings list lives in `FINDINGS` in `scripts/generate_validation.py`; recheck it against the tables whenever the model or references change. `DESIGN.md` records the visual system; `src/gui/style.css` and the material table in `viewer.ts` are normative.

## Belly & tendon view

`muscle_rendering()` in `engine.py` sends each actuator's rest belly length, volume, tendon radius, and which path end is the origin. The GUI (`src/gui/muscle-geometry.ts`) keeps tendon length fixed and assigns all muscle–tendon length change to the belly, at constant volume. Data come from `data/anatomy/muscle_architecture.json`, linked by `architecture_id` in `anatomy.json`. Every field there needs a `source` unless it is marked `"basis": "assumed"`. MuJoCo's own implied fiber/tendon split (from `lengthrange`) is not anatomical; do not use it for drawing.

## Architecture

```
data/anatomy/anatomy.json   hand-authored inventory: scope, counting rules, sources, bones, muscles, actuators
data/anatomy/model.json     GENERATED from hand.xml: joints, axes, limits, tendon sites, sampled moment arms
models/myohand/             vendored MJCF + STL meshes + LICENSE + provenance.json (regenerate via scripts/vendor_model.py)
src/simulation/engine.py    HandSimulation: the Python MuJoCo adapter
src/server.py               one HandSimulation per WebSocket, streams snapshots at ~30 Hz, starts paused
src/gui/local-engine.ts     LocalSimulation: the browser twin of HandSimulation (demo build only); keep the two in step
src/gui/link.ts             WebSocket link, or the worker link (worker-link.ts, sim-worker.ts) in the demo build
src/gui/main.ts             controls, muscle list, inspector, link handling
src/gui/viewer.ts           Three.js scene: bones from streamed transforms, tendon paths
src/gui/types.ts            Model/State shapes; keep in sync with HandSimulation.metadata() and snapshot()
```

Data flow (service build; the demo reads `data/model.json` and talks to the worker with the same messages): the browser fetches `/api/model` (meshes, joints, actuators, limitations) once. It sends `{"type": "controls"|"pause"|"relax"|"reset", ...}` over `/ws` and receives a `state` snapshot each tick: excitation, activation, force, qpos, qvel, moment_arms, bone poses, and tendon paths. Errors are sent as `{"type": "error", "message": ...}` and the session stays open.

Keep the layers separate. `anatomy.json` must not depend on MuJoCo. The engine must not know about the GUI. The GUI reads only what the API sends.

## Domain conventions

- **IDs.** Anatomical muscles use snake_case (`pronator_teres`). Model actuators use the MyoHand names with `_r` (`ECRL_r`, `FDP2_r`). Joints use MJCF names (`mcp2_flexion_r`). Links between the two run both ways: `muscles[].model_actuators` and `actuators[].anatomical_muscle_ids`, each with a `mapping_status`. `tests/test_anatomy.py` checks this.
- **Scope rule (set by the user, 2026-10-10).** A muscle is in scope if at least one end attaches to the hand or a finger, plus the three forearm rotators, which the user restored with forearm rotation (as in MUSIC) for later simulations. That gives 37 anatomical muscles (18 forearm, 19 intrinsic) and 29 bones (27 hand, plus radius and ulna). Brachioradialis and anconeus are listed with reasons in `scope.excluded_muscles` and are not counted.
- **Counting.** The model has 44 actuators (39 without the MUSIC cache) and 23 DOFs. `EXCLUDED_ACTUATORS` and `LOCKED_JOINTS` in `engine.py` can remove actuators or weld joints at load time via `MjSpec`; both are currently empty. Actuators and muscles do not map one-to-one: FDS, FDP, and EDC each have four actuators, and the 12 RI/LU_RB/UI_UB channels are simplified intrinsic bundles.
- **Units.** Metres, newtons, seconds, and radians internally. The GUI shows degrees. Moment arms are −d(tendon length)/d(angle), shown in mm.
- **Signs.** Thumb flexion is negative in this model; pronation and radial deviation are positive. Finger "radial motion" is not always abduction. `joint_description()` in `engine.py` holds the positive and negative labels. Fix wrong labels there, then regenerate the catalog.
- **Excitation and activation.** Controls set excitation in [0, 1]. Activation lags behind it through MuJoCo activation dynamics. The UI must show both and must not present influence (moment arm) as measured motion.
- **Runtime overrides** in `load_model()`: zero gravity, 0.002 s timestep, implicitfast integrator, passive joint stiffness from `models/myohand/passive_stiffness.json`, and the MUSIC graft when the cache exists. They are recorded in `provenance.json` (and in `scripts/vendor_model.py`, which rewrites it) and must stay in sync.
- **Passive stiffness.** Every joint needs an entry with `basis` `measured` or `assumed` and `source_ids`; assumed entries need `notes`. `stiffness_nm_per_rad` is a number (one joint spring) or `{positive, negative}`; the latter becomes two one-sided fixed-tendon springs (`add_one_sided_springs()` in `engine.py`), because MuJoCo's polynomial joint stiffness needs 3.7+ and the browser build is 3.5.1. Without stiffness, any unopposed torque drives joints to their limits, so do not remove it to "match upstream".

## Rules specific to this repo

- Do not hand-edit `data/anatomy/model.json`, `docs/model.md`, or `docs/anatomy.md`. Edit the source (`hand.xml`, `engine.py`, or `anatomy.json`) and regenerate.
- Do not edit `models/myohand/hand.xml` by hand. Re-export from the pinned revision with `scripts/vendor_model.py`. A model change requires rerunning the numerical and mapping tests and updating `provenance.json`.
- New anatomy facts need a `source_ids` entry pointing into `sources`. Mark uncertainty in `notes` rather than presenting it as fact.
- Validate inputs at the engine boundary. `set_controls` rejects the whole update if any value is invalid. Keep that atomicity.
- `src/server.py` serves only `dist/`. Never mount the repo root.

## GUI and documentation skills

AGENTS.md requires the `impeccable` and `no-ai-slop` skills. They are installed for Codex, not for Claude Code, so the Skill tool cannot load them. Read them directly before GUI or documentation work:

- `~/.codex/skills/impeccable/SKILL.md` (plus `reference/`). `.impeccable/` holds its local state and is gitignored.
- `~/.codex/skills/no-ai-slop/SKILL.md`

## Known issues

- Git repository at github.com/Yuxiang-Ma/clonehand, created 2026-10-10 and made public on 2026-10-11 at the user's request. Never commit MUSIC files or values derived from them.
- `RI2_r` starts 38% beyond its length range and pulls ~12 N at zero activation, so the relaxed index rests ~7° radial. `RI5_r` starts below its range. Both are left as upstream artifacts and pinned in `test_relaxed_hand_holds_its_reference_posture`. Fixing them needs a sourced re-derivation, not a hand-tuned override.

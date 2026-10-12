# Clonehand

An interactive right hand and wrist you drive one muscle at a time. MuJoCo runs the MyoHand musculoskeletal model. A browser GUI lets you set each muscle's excitation from 0 to 1, run or pause the simulation, and see the selected muscle's moment arms next to the joint angles the model actually reaches.

The scope is every muscle with at least one end attached to the hand or a finger, plus the three forearm rotators (pronator teres, pronator quadratus, supinator), because the model rotates the forearm: 37 muscles, 18 with bellies in the forearm and 19 inside the hand. Brachioradialis and anconeus act mainly at the elbow and are out of scope. The model has 29 bones, 23 joint degrees of freedom, and 44 muscle actuators (39 from MyoHand, 5 from MUSIC). The actuators are not one per muscle: FDS, FDP, and EDC each have four, and 12 are simplified intrinsic bundles. [docs/anatomy.md](docs/anatomy.md) gives the counting rules.

## Setup

Tested with Python 3.13.5 and Node 24.13.0 on Linux.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm install
npx playwright install chromium   # only for browser tests
.venv/bin/python scripts/fetch_music.py   # optional: adds 5 thumb and little-finger muscles
```

`fetch_music.py` clones the MUSIC hand model (Xu et al. 2026, commit `1b13b79`) into `~/.cache/clonehand/`. **The MUSIC repository has no license.** Its files are not copied into this project. The engine reads five muscle definitions from the cache when it loads, for local use only. Without the cache, the app runs with 39 actuators. Set `CLONEHAND_MUSIC_DIR` to use a different location.

## Web demo (no install)

**Try it: https://yuxiang-ma.github.io/clonehand/**

The web demo runs MuJoCo compiled to WebAssembly inside your browser, so nothing has to be installed or launched. It needs a browser with WebGL. It runs MyoHand with 39 actuators and leaves out the five MUSIC muscles, because MUSIC has no license. Every push to `main` rebuilds and redeploys it (`.github/workflows/pages.yml`), after the lint, typecheck, and Python tests pass.

To build it yourself and serve it from any static host:

```bash
npm run build:demo        # exports model data, then builds dist-demo/
npm run preview:demo      # http://127.0.0.1:4173
```

`dist-demo/` is plain files (about 15 MB, 2.2 MB of it the gzipped physics engine), so any static file host can serve it.

## Run

Production build, served by the Python service:

```bash
npm run build
.venv/bin/uvicorn src.server:app --host 127.0.0.1 --port 8000
# open http://127.0.0.1:8000
```

For GUI development, run the service and the Vite dev server in two terminals:

```bash
.venv/bin/uvicorn src.server:app --host 127.0.0.1 --port 8000
npm run dev            # http://127.0.0.1:5173, proxies /api and /ws to :8000
```

The **Belly & tendon / Paths** switch under the 3D view changes how muscles are drawn. *Belly & tendon*, the default, draws each muscle's fleshy belly at its measured volume and rest length, and its tendon as a pale cord sized from maximum force. The simulated tendon does not stretch, so when a muscle–tendon unit shortens, only the belly gets shorter (and thicker, because its volume stays constant). Belly color shows activation. A belly shortens only when its joints move; at a joint limit, force rises without shortening. The inspector shows the selected muscle's belly and tendon lengths and where each size comes from. *Paths* shows each muscle–tendon route as a line.

The camera buttons next to it look at the palm (the default), the back of the hand (Dorsal), the thumb side (Radial), or the little-finger side (Ulnar); the round arrow returns to the palm. These views are fixed to the forearm's resting position, so pronating or supinating the forearm turns the hand within them. Drag to orbit and scroll to zoom from any of them.

The anatomy inventory is readable at http://127.0.0.1:8000/anatomy.html (also linked from the app under "Model scope & limitations"). It lists every muscle with its attachments, function, sources, and whether the model simulates it, approximates it, or leaves it out. `/api/anatomy` serves the same data as JSON.

The simulation starts paused. Set a slider, then press **Run simulation**. **Relax all** zeroes every excitation and lets activation decay. **Reset** also restores the starting posture and clock.

## Test

```bash
# Python: model, engine, API, anatomy inventory, generated-file freshness
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 .venv/bin/python -m pytest -q

# Browser: builds, starts the service on port 8765, drives the GUI in headless Chromium
npm run test:browser

# Browser, static demo: builds dist-demo/, serves it as plain files on port 8766
npm run test:demo

# Static checks
.venv/bin/ruff check . && .venv/bin/ruff format --check .
npm run typecheck
```

`PYTEST_DISABLE_PLUGIN_AUTOLOAD=1` is needed only if your shell sources ROS. Its `launch_testing` pytest plugin breaks test collection.

Generated files must match their sources. To regenerate after editing `data/anatomy/anatomy.json`, `src/simulation/engine.py`, or `models/myohand/passive_stiffness.json`:

```bash
.venv/bin/python scripts/generate_anatomy_docs.py      # -> docs/anatomy.md
.venv/bin/python scripts/export_model_catalog.py       # -> data/anatomy/model.json, docs/model.md
.venv/bin/python scripts/generate_validation.py        # -> docs/validation.md
```

The browser tests also check the 3D view itself: colors, outlines, and path positions read back from the scene must match the simulation snapshot they were drawn from, and an active muscle must turn red in the rendered image.

## Layout

| Path | Contents |
| --- | --- |
| `data/anatomy/anatomy.json` | Hand-written inventory of bones, muscles, actuators, and sources. Does not depend on MuJoCo. |
| `data/anatomy/muscle_architecture.json` | Published belly length, volume, fiber length, and PCSA per muscle or compartment, with sources and the conflicts between them. Drives the belly view. |
| `data/anatomy/model.json` | Generated joint axes, limits, passive stiffness, tendon routes, and sampled moment arms. |
| `models/myohand/` | Vendored MyoHand MJCF and meshes (MyoHub/myo_sim `93b0ca8f`, Apache-2.0), provenance, the passive stiffness table, and the joint-range changes. |
| `src/simulation/engine.py` | `HandSimulation`, the only code that touches MuJoCo. |
| `src/server.py` | FastAPI: `/api/model`, `/api/anatomy`, `/api/health`, and `/ws`. One simulation per WebSocket. |
| `src/gui/` | TypeScript and Three.js interface. `main.ts` is the simulator; `anatomy.ts` renders the inventory page (`anatomy.html`); `local-engine.ts` and `sim-worker.ts` run the physics in the browser for the web demo. |
| `tests/` | pytest suites; `tests/browser/` holds the Playwright suite. |
| `data/validation/references.json` | Published moment arms and ranges of motion, with sources, used for `docs/validation.md`. |
| `scripts/export_web_demo.py` | Writes the files the static web demo loads (no MUSIC data). |
| `docs/` | Simulator decision, anatomy summary, model catalog, biomechanical validation. |
| `DESIGN.md` | Visual system: colors, type, layout, components. |

## How the simulation differs from the source model

The engine changes four things when it loads `hand.xml`. All are listed in `models/myohand/provenance.json`.

1. **Gravity is off.** The scene represents a supported forearm.
2. **The timestep is 0.002 s and the integrator is implicitfast.**
3. **Passive joint stiffness is added.** MyoHand defines joint damping but no stiffness. Without stiffness, any unopposed torque drives a joint to its limit. Before this change, with FDS2 alone, the forearm pronated 40°, the wrist hit both its flexion and deviation limits, and partial excitation looked the same as full excitation. The engine now adds a linear spring on each joint toward the reference posture. Wrist and forearm values come from Formica et al. 2012 (n=10), with a different stiffness on each side of neutral (for example 0.55 N·m/rad into wrist flexion and 1.02 into extension), applied as two one-sided springs; index MCP flexion from Shi et al. 2020 and Kuo and Deshpande 2012, and PIP from Dionysian et al. 2005. MCP abduction, DIP, and all thumb values are assumptions because no measurement was found. Each joint's basis is labelled in `models/myohand/passive_stiffness.json` and in the GUI.
4. **Five MUSIC muscles are added when the cache exists.** Abductor and flexor pollicis brevis, adductor pollicis, and abductor and flexor digiti minimi are grafted from MUSIC: attachment sites, path, and muscle parameters. MUSIC's bones match MyoHand's to within 0.1 mm. MUSIC swaps the names of the two thumb CMC joints; the moment arms here use MyoHand's names, which match anatomy.

## Known limitations

- **RI2_r is pre-stretched.** In the reference posture, RI2_r is 38% beyond its model length range. It pulls with about 12 N at zero activation, so the relaxed index finger rests near 7° of radial motion. RI5_r starts below its range. Both look like conversion artifacts. They are left unmodified and pinned in `tests/test_simulation.py`.
- **The springs are a simplification.** Each spring is linear, although real passive joint moments rise steeply near the end of range. The only published nonlinear fits (index MCP) have printed coefficients that do not reproduce their own measured moments, so they are not used. The measured wrist and forearm stiffness is also coupled across axes, which the springs ignore. The in-vivo values include passive muscle force, which the muscle model already produces, so part of it (about 25% at the index MCP, per Kuo 2015) is counted twice.
- **Finger joints still reach their limits easily.** Finger stiffness is small (about 0.03 to 0.06 N·m/rad), so moderate excitation can carry a finger joint to its limit. The GUI marks such joints **At limit**.
- **The model leaves things out.** With MUSIC fetched, 23 of the 37 in-scope muscles have their own model channel. The 11 interossei and lumbricals are approximated by 12 combined channels. Opponens digiti minimi (no fifth CMC joint in the model), palmaris brevis (moves only skin), and supinator (in neither MyoHand nor MUSIC) are not modeled, so forearm rotation is driven only by the two pronators plus passive stiffness.
- **MUSIC's muscles are unvalidated and unlicensed.** Their paths are straight lines through 2-3 points with no wrapping. Their maximum forces cite sources that do not contain these muscles. They may only be used locally until the authors publish a license.
- **The belly view is a drawing, not a muscle-shape model.** Every belly is a spindle around its path line, starting at the origin. Flat or fan-shaped muscles (adductor pollicis, first dorsal interosseous) look thicker and narrower than they are. Forearm volumes come from in vivo MRI, while hand volumes come from cadavers, which run smaller. OP, APB, FPB, and AdP have no published belly length, so their bellies are drawn over 80% of the path. Bellies longer than the model path are shortened to fit. The combined channels are sized as the interosseous or lumbrical on that side of the finger; this is an assumption for drawing only. There is also no independent ring or little finger CMC motion, no skin, and no grasp objects. Muscle paths are line routes, not muscle bellies.
- **Moment arms and joint ranges are only partly checked against human data.** [docs/validation.md](docs/validation.md) compares 75 moment arms and 34 joint ranges with cadaver and in vivo measurements. Most moment arms agree in direction and size. MyoHand's joint limits were too tight in places (10° ulnar deviation, 45° wrist flexion and extension, no finger hyperextension), so those limits were moved to published means ([joint_ranges.json](models/myohand/joint_ranges.json)). Three stop short, because MyoHand's muscle paths break beyond them: wrist flexion stops at 56° and extension at 65° (people: about 75° and 70°), and little-finger PIP hyperextension at 11°. The index MCP still cannot hyperextend: lifting that limit would leave the relaxed index bent back 17° by RI2_r's resting pull. Muscle forces and simulated motion have not been compared with human data.

See [docs/simulator-decision.md](docs/simulator-decision.md) for why MuJoCo and MyoHand were chosen, and [docs/model.md](docs/model.md) for coordinate conventions and sign rules.

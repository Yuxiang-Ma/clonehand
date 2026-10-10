# Repository Guidelines

## Project Purpose & Scope

Build an interactive human hand musculoskeletal simulation, including forearm muscles, intrinsic hand muscles, bones, joints, and tendons. Users must control muscle activation and relaxation, observe movement, and understand each muscle’s relationship to joint degrees of freedom (DOFs).

## Required Deliverables

### Anatomy Inventory

Create machine-readable YAML or JSON and a generated Markdown summary. Define anatomical boundaries, handedness, and counting rules before reporting bone and muscle totals; distinguish muscles from modeled actuator subdivisions. Record stable IDs, names, groups, functions, and sources. Include muscle origins, insertions, tendon paths, and affected joints/DOFs; document joint axes, limits, coordinate conventions, and units. Mark uncertainty and simplifications explicitly.

### Simulation & Reusable Models

Compare simulation environments and existing musculoskeletal models or 3D assets before selecting a stack. Evaluate muscle/tendon dynamics, anatomical fidelity, real-time performance, GUI integration, licensing, and maintenance. Cite primary sources and record the decision. Distinguish visual meshes from functional biomechanical models. Prefer suitable reusable models with documented provenance.

### Interactive GUI

Provide per-muscle activation controls (normalized 0–1), relaxation, pause, and reset. Highlight active muscles with a legend; distinguish selection from activation. Show the selected muscle’s name, function, activation, and affected DOFs with action directions. Keep anatomical influence separate from measured motion. Document multi-joint effects, coupled motion, and posture-dependent behavior where modeled.

## Project Structure & Development

Proposed layout: `data/anatomy/`, `models/`, `assets/`, `src/simulation/`, `src/gui/`, `tests/`, and `docs/`. Keep anatomy data independent of simulator adapters and GUI code.

Document verified setup, run, build, and test commands in `README.md` when tooling exists. Follow language-standard style, configure formatting/linting, and use stable anatomical IDs across data, models, and UI.

## GUI & Documentation Style

Use the `impeccable` and `no-ai-slop` skills for GUI and documentation work. Read their instructions first; report missing skills. Favor clear controls, readable typography, accessible states, and direct prose. Avoid generic templates, decorative clutter, hype, and filler.

## Testing & Contribution Guidelines

Validate schema references, count consistency, units, activation bounds, joint limits, numerical stability, and representative muscle-to-DOF behavior. Verify GUI highlighting and displayed mappings against simulation state. Document biomechanical validation separately from software tests; no framework or coverage threshold is established.

Use focused commits with imperative subjects. PRs should explain changes, cite anatomical/model sources, report validation and limitations, link relevant issues, and include screenshots for GUI changes. Preserve asset licenses and exclude secrets and generated artifacts.

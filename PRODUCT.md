# Product

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
Implementation choice under the user's instruction to select a suitable simulator: MuJoCo with a local Python service and a Three.js browser interface. No external hosting is required.

## Users
The repository owner wants to explore human hand movement by actuating forearm and hand muscles. Research fidelity requirements beyond the first working model remain open.

## Product Purpose
Connect muscle excitation to simulated hand motion, visible muscle activation, and joint degrees of freedom. Preserve a sourced anatomy inventory alongside the simulation.

## Operating Context
A local interactive workstation. The first model is a right hand and wrist. It covers muscles with at least one end on the hand or a finger, plus forearm rotation and its rotator muscles. The handedness is an implementation assumption. The user can select and combine muscles, inspect their effects, relax, pause, and reset.

## Capabilities and Constraints
Use an existing licensed musculoskeletal model where practical. Anatomical muscles, modeled actuators, and visual meshes are separate concepts. Show model omissions and simplifications. Do not claim patient-specific accuracy or experimental validation.

## Product Principles
- Display actual simulation state.
- Explain muscle influence separately from resulting motion.
- Keep data, physics, and interface code independent.
- Preserve source references and model provenance.

## Brand Commitments
Use impeccable for the GUI and no-ai-slop for documentation. Use direct language, accessible controls, and restrained visual styling.

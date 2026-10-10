# Simulator selection

Use MuJoCo with MyoHub's MyoHand for the first interactive model. This choice keeps muscle activation, tendon routing, joint motion, and the displayed geometry in one simulation. The GUI is a local browser client, with Python running the physics.

| Candidate | Relevant capabilities | Cost or limitation | Decision |
| --- | --- | --- | --- |
| MuJoCo + MyoHand | Existing articulated geometry, muscle actuators, tendon wrapping, contact dynamics, Python bindings; Apache-2.0 model and engine | Simplified muscle physiology; conversion adjustments; intrinsic muscle bundles do not map one-to-one to named anatomy | Use for this prototype |
| OpenSim + ARMS wrist/hand | Biomechanical analysis tools; published hand/wrist model with functional-task evaluation | A separate adapter would be needed for this browser loop; model-specific licensing and distribution must be checked before reuse | Retain as a comparison and future validation source |
| NIMBLE | Hand surface, bone, and muscle geometry learned from scans | A geometric/deformation model is not a ready muscle-actuated dynamics simulator; asset terms require separate review | Possible future visualization reference |

The selection is an engineering judgment, not a benchmark result. No comparative performance measurements were run. MyoHub is under active development; this repository vendors one exact revision rather than following its main branch automatically.

## What the selected model contains

The exported model has 23 generalized coordinates and 39 muscle actuators. At load time the engine adds five muscles from the MUSIC model when its local cache is present, giving 44 actuators. The scene displays 29 forearm/hand bone meshes. Proximal arm scaffold geometry remains in the source model but is hidden in the GUI. Individual carpal meshes do not imply independent carpal DOFs.

The first scene uses zero gravity to approximate supported-hand exploration without adding a physical support surface. Forearm rotation remains free. The root and proximal arm are fixed. MuJoCo's muscle model has activation dynamics and force–length/velocity behavior; its tendon is inextensible. These properties do not reproduce all muscle and tendon physiology.

The model includes pronators but no dedicated supinator. Its 12 RI/LU_RB/UI_UB channels are simplified intrinsic bundles. The anatomy inventory records named muscles independently; an absent one-to-one mapping must not be interpreted as a missing anatomical muscle or a validated model equivalence. No additional muscle-belly surfaces are fabricated.

## Sources

- [MyoHub model source at the vendored revision](https://github.com/MyoHub/myo_sim/tree/93b0ca8f4ec90c9899ee7f05fee561e9911da91b).
- [MyoHand scope, upstream adjustments, and references](https://github.com/MyoHub/myo_sim/blob/93b0ca8f4ec90c9899ee7f05fee561e9911da91b/myo_sim/models/arm/README_hand.md).
- [MuJoCo muscle-actuator documentation](https://mujoco.readthedocs.io/en/stable/modeling.html#muscle-actuators).
- [MyoSuite environment reference](https://myosuite.readthedocs.io/en/latest/environments.html).
- [McFarland et al.: A Musculoskeletal Model of the Hand and Wrist Capable of Simulating Functional Tasks](https://pmc.ncbi.nlm.nih.gov/articles/PMC10650739/).
- [OpenSim model catalog](https://opensimconfluence.atlassian.net/wiki/spaces/OpenSim/pages/53090607).
- [NIMBLE paper and model description](https://arxiv.org/abs/2202.04533).

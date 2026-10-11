# Model coordinates and tendon routes

Generated from the vendored MJCF by `python scripts/export_model_catalog.py`. The [machine-readable catalog](../data/anatomy/model.json) includes all tendon sites, wrapping references, local attachment coordinates, activation constants, and sampled muscle-to-DOF mappings.

## Coordinate conventions

Lengths use metres, forces newtons, and time seconds. MuJoCo stores joint angles in radians; the GUI displays degrees. Each axis is local to its body and uses right-hand positive rotation. Thumb flexion is negative in this model; pronation is positive. Finger radial motion is positive, which is not synonymous with abduction for every digit.

Moment arms are −d(tendon length)/d(joint angle), displayed in millimetres. Their sign identifies the direction of contractile torque. Actual movement also depends on other muscles, passive forces, inertia, and joint constraints.

## Joint coordinates

| Coordinate | Display name | Range (degrees) | Positive direction | Negative direction | Passive stiffness (N·m/rad) |
| --- | --- | --- | --- | --- | --- |
| `pro_sup_r` | Forearm rotation | -90.0 to 90.0 | Pronation | Supination | +0.24 / −0.186 (measured) |
| `deviation_r` | Wrist deviation | -10.0 to 25.0 | Radial deviation | Ulnar deviation | +1.71 / −1.25 (measured) |
| `flexion_r` | Wrist flexion | -45.0 to 45.0 | Flexion | Extension | +0.554 / −1.02 (measured) |
| `cmc_flexion_r` | Thumb CMC flexion | -44.7 to 40.1 | Extension | Flexion | 0.15 (assumed) |
| `cmc_abduction_r` | Thumb CMC abduction | -28.6 to 44.7 | Abduction | Adduction | 0.15 (assumed) |
| `mp_flexion_r` | Thumb MCP flexion | -45.0 to 40.0 | Extension | Flexion | 0.1 (assumed) |
| `ip_flexion_r` | Thumb IP flexion | -75.0 to 25.0 | Extension | Flexion | 0.05 (assumed) |
| `mcp2_flexion_r` | Index MCP flexion | 0.0 to 90.0 | Flexion | Extension | 0.04 (measured) |
| `mcp2_abduction_r` | Index MCP abduction | -15.0 to 15.0 | Radial motion | Ulnar motion | 0.06 (assumed) |
| `pm2_flexion_r` | Index PIP flexion | 0.0 to 90.0 | Flexion | Extension | 0.029 (measured) |
| `md2_flexion_r` | Index DIP flexion | 0.0 to 90.0 | Flexion | Extension | 0.015 (assumed) |
| `mcp3_flexion_r` | Middle MCP flexion | 0.0 to 90.0 | Flexion | Extension | 0.04 (assumed) |
| `mcp3_abduction_r` | Middle MCP abduction | -15.0 to 15.0 | Radial motion | Ulnar motion | 0.06 (assumed) |
| `pm3_flexion_r` | Middle PIP flexion | 0.0 to 90.0 | Flexion | Extension | 0.029 (measured) |
| `md3_flexion_r` | Middle DIP flexion | 0.0 to 90.0 | Flexion | Extension | 0.015 (assumed) |
| `mcp4_flexion_r` | Ring MCP flexion | 0.0 to 90.0 | Flexion | Extension | 0.04 (assumed) |
| `mcp4_abduction_r` | Ring MCP abduction | -15.0 to 15.0 | Radial motion | Ulnar motion | 0.06 (assumed) |
| `pm4_flexion_r` | Ring PIP flexion | 0.0 to 90.0 | Flexion | Extension | 0.029 (measured) |
| `md4_flexion_r` | Ring DIP flexion | 0.0 to 90.0 | Flexion | Extension | 0.015 (assumed) |
| `mcp5_flexion_r` | Little MCP flexion | 0.0 to 90.0 | Flexion | Extension | 0.04 (assumed) |
| `mcp5_abduction_r` | Little MCP abduction | -15.0 to 15.0 | Radial motion | Ulnar motion | 0.06 (assumed) |
| `pm5_flexion_r` | Little PIP flexion | 0.0 to 90.0 | Flexion | Extension | 0.029 (assumed) |
| `md5_flexion_r` | Little DIP flexion | 0.0 to 90.0 | Flexion | Extension | 0.015 (assumed) |

MyoHand defines joint damping but no joint stiffness. The engine adds linear passive springs toward the reference posture at load time. Where two values are given (+ / −), the spring is stiffer on one side: the first resists motion in the positive direction, the second in the negative direction. Values marked measured come from in-vivo studies of relaxed joints; values marked assumed have no direct measurement. Sources, sample sizes, and simplifications are in [passive_stiffness.json](../models/myohand/passive_stiffness.json).

## Muscle-to-DOF mapping

Neutral plus 10%, 50%, 90% of each coordinate range, one coordinate at a time. Threshold 0.1 mm. This is a sampled influence graph, not an exhaustive global bound.

Values below are neutral-posture signed moment arms in mm; the GUI recomputes them at the current posture. A sampled influence can have a near-zero neutral value.

| Actuator | Influenced coordinates (neutral moment arm, mm) |
| --- | --- |
| `ECRL_r` | `pro_sup_r` -3.56; `deviation_r` +23.64; `flexion_r` -11.66 |
| `ECRB_r` | `pro_sup_r` -1.56; `deviation_r` +14.20; `flexion_r` -15.33 |
| `ECU_r` | `pro_sup_r` -0.68; `deviation_r` -27.81; `flexion_r` -7.55 |
| `FCR_r` | `pro_sup_r` +2.62; `deviation_r` +3.97; `flexion_r` +18.46 |
| `FCU_r` | `pro_sup_r` +1.08; `deviation_r` -10.56; `flexion_r` +18.41 |
| `PL_r` | `pro_sup_r` +3.18; `deviation_r` +7.25; `flexion_r` +25.11 |
| `PT_r` | `pro_sup_r` +11.63 |
| `PQ_r` | `pro_sup_r` +6.97 |
| `FDS5_r` | `pro_sup_r` +1.86; `deviation_r` -0.41; `flexion_r` +15.28; `mcp5_flexion_r` +6.48; `mcp5_abduction_r` -4.02; `pm5_flexion_r` +3.90 |
| `FDS4_r` | `pro_sup_r` +2.19; `deviation_r` +1.31; `flexion_r` +14.86; `mcp4_flexion_r` +6.75; `mcp4_abduction_r` -0.86; `pm4_flexion_r` +3.12 |
| `FDS3_r` | `pro_sup_r` +2.89; `deviation_r` +7.33; `flexion_r` +14.63; `mcp3_flexion_r` +9.51; `mcp3_abduction_r` -1.17; `pm3_flexion_r` +7.03 |
| `FDS2_r` | `pro_sup_r` +3.15; `deviation_r` +9.56; `flexion_r` +14.12; `mcp2_flexion_r` +8.61; `mcp2_abduction_r` +0.74; `pm2_flexion_r` +4.76 |
| `FDP5_r` | `pro_sup_r` +1.86; `deviation_r` +0.93; `flexion_r` +11.60; `mcp5_flexion_r` +5.87; `mcp5_abduction_r` -2.56; `pm5_flexion_r` +4.84; `md5_flexion_r` +2.84 |
| `FDP4_r` | `pro_sup_r` +1.99; `deviation_r` +2.70; `flexion_r` +11.83; `mcp4_flexion_r` +6.58; `mcp4_abduction_r` -3.05; `pm4_flexion_r` +7.14; `md4_flexion_r` +2.30 |
| `FDP3_r` | `pro_sup_r` +2.44; `deviation_r` +5.25; `flexion_r` +11.70; `mcp3_flexion_r` +8.46; `mcp3_abduction_r` -0.43; `pm3_flexion_r` +7.55; `md3_flexion_r` +2.66 |
| `FDP2_r` | `pro_sup_r` +2.58; `deviation_r` +9.62; `flexion_r` +11.60; `mcp2_flexion_r` +9.58; `mcp2_abduction_r` +0.70; `pm2_flexion_r` +6.86; `md2_flexion_r` +4.33 |
| `EDC5_r` | `pro_sup_r` -1.21; `deviation_r` -9.89; `flexion_r` -11.07; `mcp5_flexion_r` -5.90; `mcp5_abduction_r` +3.22; `pm5_flexion_r` -5.31; `md5_flexion_r` -2.99 |
| `EDC4_r` | `pro_sup_r` -1.84; `deviation_r` -9.05; `flexion_r` -17.32; `mcp4_flexion_r` -7.90; `mcp4_abduction_r` +4.38; `pm4_flexion_r` -3.98; `md4_flexion_r` -5.50 |
| `EDC3_r` | `pro_sup_r` -1.70; `deviation_r` -2.20; `flexion_r` -17.84; `mcp3_flexion_r` -9.37; `mcp3_abduction_r` +0.95; `pm3_flexion_r` -5.45; `md3_flexion_r` -3.06 |
| `EDC2_r` | `pro_sup_r` -1.37; `deviation_r` +2.27; `flexion_r` -17.32; `mcp2_flexion_r` -8.73; `mcp2_abduction_r` -0.42; `pm2_flexion_r` -5.21; `md2_flexion_r` -3.57 |
| `EDM_r` | `pro_sup_r` -0.58; `deviation_r` -14.50; `flexion_r` -9.47; `mcp5_flexion_r` -5.73; `mcp5_abduction_r` -0.80; `pm5_flexion_r` -2.95; `md5_flexion_r` -2.31 |
| `EIP_r` | `pro_sup_r` -0.29; `deviation_r` -2.80; `flexion_r` -12.77; `mcp2_flexion_r` -9.23; `mcp2_abduction_r` +1.49; `pm2_flexion_r` -6.52; `md2_flexion_r` -2.68 |
| `EPL_r` | `pro_sup_r` -1.81; `deviation_r` +22.74; `flexion_r` -13.40; `cmc_flexion_r` +6.66; `cmc_abduction_r` -9.01; `mp_flexion_r` +9.02; `ip_flexion_r` +5.16 |
| `EPB_r` | `deviation_r` +34.18; `flexion_r` -1.03; `cmc_flexion_r` +12.48; `cmc_abduction_r` -0.84; `mp_flexion_r` +9.13 |
| `FPL_r` | `deviation_r` +20.82; `flexion_r` +11.21; `cmc_flexion_r` -3.86; `cmc_abduction_r` +1.49; `mp_flexion_r` -7.12; `ip_flexion_r` -8.81 |
| `APL_r` | `deviation_r` +26.82; `flexion_r` +6.81; `cmc_flexion_r` +0.14; `cmc_abduction_r` +2.69 |
| `OP_r` | `cmc_flexion_r` -13.70; `cmc_abduction_r` -0.06 |
| `RI2_r` | `mcp2_flexion_r` -4.23; `mcp2_abduction_r` +5.91 |
| `LU_RB2_r` | `mcp2_flexion_r` +3.05; `mcp2_abduction_r` +6.55; `pm2_flexion_r` -3.48 |
| `UI_UB2_r` | `mcp2_flexion_r` +3.61; `mcp2_abduction_r` -6.73; `pm2_flexion_r` -2.51 |
| `RI3_r` | `mcp3_flexion_r` +3.36; `mcp3_abduction_r` +7.50 |
| `LU_RB3_r` | `mcp3_flexion_r` +2.99; `mcp3_abduction_r` +8.42; `pm3_flexion_r` -1.25 |
| `UI_UB3_r` | `mcp3_flexion_r` +4.62; `mcp3_abduction_r` -4.09; `pm3_flexion_r` -1.29 |
| `RI4_r` | `mcp4_flexion_r` +3.43; `mcp4_abduction_r` +6.95 |
| `LU_RB4_r` | `mcp4_flexion_r` +2.38; `mcp4_abduction_r` +3.77; `pm4_flexion_r` -0.60 |
| `UI_UB4_r` | `mcp4_flexion_r` +2.49; `mcp4_abduction_r` -4.46; `pm4_flexion_r` -2.88 |
| `RI5_r` | `mcp5_flexion_r` +5.71; `mcp5_abduction_r` +3.74 |
| `LU_RB5_r` | `mcp5_flexion_r` +2.85; `mcp5_abduction_r` +6.49; `pm5_flexion_r` -3.76 |
| `UI_UB5_r` | `mcp5_flexion_r` +3.20; `mcp5_abduction_r` -6.37; `pm5_flexion_r` -2.81 |

## Representation limits

Joint limits are compliant constraints and may be slightly exceeded under load. The scene uses zero gravity and has no external grasp objects. `RI2_r` starts beyond its length range at the reference posture and produces about 12 N of passive force at zero activation, which holds the relaxed index finger near 7° of radial motion; `RI5_r` starts below its range. Both look like conversion artifacts and are left unmodified. The source includes fixed proximal scaffold bodies and meshes outside the displayed forearm/hand. Muscle paths are model line routes; their thickness in the GUI is illustrative. They are not measured muscle-belly cross sections.

The model has 23 coordinates, including forearm rotation. It has no independent ring or little-finger CMC coordinate. See [model provenance](../models/myohand/provenance.json), [anatomical inventory](anatomy.md), and [simulator decision](simulator-decision.md).

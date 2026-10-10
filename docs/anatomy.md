# Hand and wrist anatomy

Generated from [anatomy.json](../data/anatomy/anatomy.json). Edit the JSON, then run `python scripts/generate_anatomy_docs.py`.

This right-side reference contains 29 bones and 37 anatomical muscles. The simulation uses 44 independently controlled MyoHand actuators; these do not map one-to-one to the muscles.

## Scope and counting rules

Muscles that move the hand, wrist, and forearm rotation. A muscle is in scope when at least one end attaches to the hand (carpals, metacarpals, phalanges, or palmar soft tissue) or a finger, or when it rotates the forearm (pronator teres, pronator quadratus, supinator), because the simulation includes forearm rotation. Muscles that act mainly at the elbow (brachioradialis, anconeus) are excluded. Bones cover the hand plus the radius and ulna.

- Count 8 carpals, 5 metacarpals, and 14 phalanges as 27 hand bones; add radius and ulna for 29. Include the pisiform among carpals; exclude other sesamoids and accessory bones.
- Count 18 forearm muscles: 8 anterior and 10 posterior. 15 insert on the hand (palmaris longus counts because it inserts into the palmar aponeurosis); pronator teres, pronator quadratus, and supinator are included as forearm rotators.
- Count 19 intrinsic hand muscles: 4 thumb muscles, 3 hypothenar muscles, palmaris brevis, 4 lumbricals, 4 dorsal interossei, and 3 palmar interossei. Adductor pollicis counts once despite two heads.
- Count each named muscle once; FDS, FDP, and extensor digitorum each count once despite four modeled digital actuators. Do not equate anatomical totals with actuator totals.

Count references: [openstax_bones](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb), [forearm_compartments](https://www.ncbi.nlm.nih.gov/books/NBK539784/), [intrinsic_count](https://pubmed.ncbi.nlm.nih.gov/33232025/), [myohand](https://github.com/MyoHub/myo_sim/blob/93b0ca8f4ec90c9899ee7f05fee561e9911da91b/myo_sim/models/arm/README_hand.md), [myohand_build](https://github.com/MyoHub/myo_sim/blob/93b0ca8f4ec90c9899ee7f05fee561e9911da91b/myo_sim/build/hand.py).

## Bones

| ID | Bone | Group | Function |
| --- | --- | --- | --- |
| `radius` | Radius | forearm | Rotating forearm support; wrist articulation. |
| `ulna` | Ulna | forearm | Forearm support; elbow articulation. |
| `scaphoid` | Scaphoid | carpal | Wrist support and articulation. |
| `lunate` | Lunate | carpal | Wrist support and articulation. |
| `triquetrum` | Triquetrum | carpal | Wrist support and articulation. |
| `pisiform` | Pisiform | carpal | Wrist support and articulation. |
| `trapezium` | Trapezium | carpal | Wrist support and articulation. |
| `trapezoid` | Trapezoid | carpal | Wrist support and articulation. |
| `capitate` | Capitate | carpal | Wrist support and articulation. |
| `hamate` | Hamate | carpal | Wrist support and articulation. |
| `metacarpal_1` | Metacarpal 1 | metacarpal | Palm support; digit articulation. |
| `metacarpal_2` | Metacarpal 2 | metacarpal | Palm support; digit articulation. |
| `metacarpal_3` | Metacarpal 3 | metacarpal | Palm support; digit articulation. |
| `metacarpal_4` | Metacarpal 4 | metacarpal | Palm support; digit articulation. |
| `metacarpal_5` | Metacarpal 5 | metacarpal | Palm support; digit articulation. |
| `proximal_phalanx_1` | Digit 1 proximal phalanx | phalanx | Digit support and articulation. |
| `distal_phalanx_1` | Digit 1 distal phalanx | phalanx | Digit support and articulation. |
| `proximal_phalanx_2` | Digit 2 proximal phalanx | phalanx | Digit support and articulation. |
| `middle_phalanx_2` | Digit 2 middle phalanx | phalanx | Digit support and articulation. |
| `distal_phalanx_2` | Digit 2 distal phalanx | phalanx | Digit support and articulation. |
| `proximal_phalanx_3` | Digit 3 proximal phalanx | phalanx | Digit support and articulation. |
| `middle_phalanx_3` | Digit 3 middle phalanx | phalanx | Digit support and articulation. |
| `distal_phalanx_3` | Digit 3 distal phalanx | phalanx | Digit support and articulation. |
| `proximal_phalanx_4` | Digit 4 proximal phalanx | phalanx | Digit support and articulation. |
| `middle_phalanx_4` | Digit 4 middle phalanx | phalanx | Digit support and articulation. |
| `distal_phalanx_4` | Digit 4 distal phalanx | phalanx | Digit support and articulation. |
| `proximal_phalanx_5` | Digit 5 proximal phalanx | phalanx | Digit support and articulation. |
| `middle_phalanx_5` | Digit 5 middle phalanx | phalanx | Digit support and articulation. |
| `distal_phalanx_5` | Digit 5 distal phalanx | phalanx | Digit support and articulation. |

Bone reference: [openstax_bones](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb).

## Muscles

Attachments below describe reference anatomy. They do not specify the simulator's attachment coordinates or guarantee its motion. Each row counts as one anatomical muscle. A dash means no confirmed dedicated model channel; possible contributions to bundled channels remain unresolved.

### Forearm (extrinsic): 18 muscles

| Muscle | Origin | Insertion | Function | Dedicated channels | Sources |
| --- | --- | --- | --- | --- | --- |
| Pronator teres | Humeral medial epicondyle; ulnar coronoid. | Lateral mid-radius. | Pronates forearm; assists elbow flexion. | `PT_r` | [forearm_compartments](https://www.ncbi.nlm.nih.gov/books/NBK539784/) |
| Flexor carpi radialis | Humeral medial epicondyle. | Palmar bases of metacarpals 2–3. | Flexes wrist; radial deviation. | `FCR_r` | [forearm_compartments](https://www.ncbi.nlm.nih.gov/books/NBK539784/) |
| Palmaris longus | Humeral medial epicondyle. | Palmar aponeurosis and flexor retinaculum. | Tenses palmar fascia; assists wrist flexion. | `PL_r` | [forearm_compartments](https://www.ncbi.nlm.nih.gov/books/NBK539784/) |
| Flexor carpi ulnaris | Humeral medial epicondyle; olecranon and posterior ulna. | Pisiform; ligament connections to hamate and metacarpal 5. | Flexes wrist; ulnar deviation. | `FCU_r` | [grays_forearm](https://elsevier-elibrary.com/contents/fullcontent/58750/epubcontent_v2/OEBPS/B9780443066849500573.htm) |
| Flexor digitorum superficialis | Medial epicondyle, coronoid, anterior radius. | Middle phalanges 2–5, through split tendons. | Flexes PIP and MCP joints; assists wrist flexion. | `FDS2_r`, `FDS3_r`, `FDS4_r`, `FDS5_r` | [grays_forearm](https://elsevier-elibrary.com/contents/fullcontent/58750/epubcontent_v2/OEBPS/B9780443066849500573.htm), [grays_students](https://elsevier-elibrary.com/contents/fullcontent/58090/epubcontent_v2/OEBPS/B9780443069529000126A.htm) |
| Flexor digitorum profundus | Proximal ulna and interosseous membrane. | Palmar distal phalanges 2–5. | Flexes DIP, PIP, and MCP joints; assists wrist flexion. | `FDP2_r`, `FDP3_r`, `FDP4_r`, `FDP5_r` | [grays_forearm](https://elsevier-elibrary.com/contents/fullcontent/58750/epubcontent_v2/OEBPS/B9780443066849500573.htm) |
| Flexor pollicis longus | Anterior radius and interosseous membrane. | Palmar distal thumb phalanx. | Flexes thumb IP and MCP joints. | `FPL_r` | [forearm_muscles](https://www.ncbi.nlm.nih.gov/books/NBK536975/) |
| Pronator quadratus | Anterior distal ulna. | Anterior distal radius. | Pronates forearm. | `PQ_r` | [forearm_compartments](https://www.ncbi.nlm.nih.gov/books/NBK539784/) |
| Extensor carpi radialis longus | Distal humeral lateral supracondylar ridge. | Dorsal metacarpal 2 base. | Extends wrist; radial deviation. | `ECRL_r` | [ecrl](https://www.elsevier.com/resources/anatomy/muscular-system/muscles-of-upper-limb/extensor-carpi-radialis-longus/22064) |
| Extensor carpi radialis brevis | Common extensor origin at lateral epicondyle. | Dorsal metacarpal 3 base. | Extends wrist; radial deviation. | `ECRB_r` | [forearm_muscles](https://www.ncbi.nlm.nih.gov/books/NBK536975/), [ecrb_origin](https://pubmed.ncbi.nlm.nih.gov/10530864/) |
| Extensor digitorum | Common extensor origin at lateral epicondyle. | Extensor expansions of digits 2–5. | Extends MCP joints and contributes to IP extension; extends wrist. | `EDC2_r`, `EDC3_r`, `EDC4_r`, `EDC5_r` | [dorsal_forearm](https://pmc.ncbi.nlm.nih.gov/articles/PMC3552760/) |
| Extensor digiti minimi | Humeral lateral epicondyle. | Little-finger extensor expansion. | Extends little finger. | `EDM_r` | [dorsal_forearm](https://pmc.ncbi.nlm.nih.gov/articles/PMC3552760/) |
| Extensor carpi ulnaris | Humeral lateral epicondyle; posterior ulna. | Ulnar metacarpal 5 base. | Extends wrist; ulnar deviation. | `ECU_r` | [dorsal_forearm](https://pmc.ncbi.nlm.nih.gov/articles/PMC3552760/) |
| Abductor pollicis longus | Posterior radius, ulna, interosseous membrane. | Radial metacarpal 1 base. | Abducts and extends thumb at CMC. | `APL_r` | [dorsal_forearm](https://pmc.ncbi.nlm.nih.gov/articles/PMC3552760/) |
| Extensor pollicis brevis | Posterior radius and interosseous membrane. | Dorsal proximal thumb phalanx. | Extends thumb MCP and CMC joints. | `EPB_r` | [uams](https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-upper-limb/) |
| Extensor pollicis longus | Posterior ulna and interosseous membrane. | Dorsal distal thumb phalanx. | Extends thumb IP joint; assists MCP and CMC extension. | `EPL_r` | [uams](https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-upper-limb/) |
| Extensor indicis | Distal posterior ulna and interosseous membrane. | Index-finger extensor expansion. | Extends index finger. | `EIP_r` | [dorsal_forearm](https://pmc.ncbi.nlm.nih.gov/articles/PMC3552760/) |
| Supinator | Lateral epicondyle, proximal ulna, adjacent elbow ligaments. | Proximal radius. | Supinates forearm. | — | [forearm_muscles](https://www.ncbi.nlm.nih.gov/books/NBK536975/) |

### Intrinsic hand: 19 muscles

| Muscle | Origin | Insertion | Function | Dedicated channels | Sources |
| --- | --- | --- | --- | --- | --- |
| Abductor pollicis brevis | Scaphoid, trapezium, flexor retinaculum. | Radial proximal thumb phalanx. | Abducts thumb; assists opposition. | `APB_r` | [uams](https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-upper-limb/) |
| Flexor pollicis brevis | Flexor retinaculum and carpals; head attachments vary. | Radial proximal thumb phalanx via sesamoid. | Flexes thumb MCP joint. | `FPB_r` | [grays_hand](https://elsevier-elibrary.com/contents/fullcontent/58750/epubcontent_v2/OEBPS/B9780443066849500585.htm) |
| Opponens pollicis | Trapezium and flexor retinaculum. | Radial metacarpal 1 shaft. | Opposes thumb through CMC flexion and rotation. | `OP_r` | [uams](https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-upper-limb/) |
| Adductor pollicis | Capitate, bases of metacarpals 2–3, metacarpal 3 shaft. | Ulnar proximal thumb phalanx. | Adducts thumb; assists MCP flexion. | `AdP_r` | [hand_muscles](https://www.ncbi.nlm.nih.gov/books/NBK537229/) |
| Abductor digiti minimi | Pisiform; flexor carpi ulnaris tendon. | Ulnar proximal phalanx 5 and extensor expansion. | Abducts little finger; assists MCP flexion. | `ADM_r` | [grays_students](https://elsevier-elibrary.com/contents/fullcontent/58090/epubcontent_v2/OEBPS/B9780443069529000126A.htm) |
| Flexor digiti minimi brevis | Hamate hook and flexor retinaculum. | Ulnar proximal phalanx 5. | Flexes little-finger MCP joint. | `FDM_r` | [grays_students](https://elsevier-elibrary.com/contents/fullcontent/58090/epubcontent_v2/OEBPS/B9780443069529000126A.htm) |
| Opponens digiti minimi | Hamate hook and flexor retinaculum. | Ulnar metacarpal 5 shaft. | Draws and rotates metacarpal 5 forward for opposition. | — | [grays_students](https://elsevier-elibrary.com/contents/fullcontent/58090/epubcontent_v2/OEBPS/B9780443069529000126A.htm) |
| Palmaris brevis | Palmar aponeurosis and flexor retinaculum. | Skin along ulnar palm. | Wrinkles hypothenar skin; has no direct joint insertion. | — | [palmaris_brevis](https://pmc.ncbi.nlm.nih.gov/articles/PMC5696130/) |
| Lumbrical 1 | Radial FDP tendon for digit 2. | Radial extensor expansion of digit 2. | Flexes MCP 2; extends PIP and DIP 2. | — | [hand_muscles](https://www.ncbi.nlm.nih.gov/books/NBK537229/) |
| Lumbrical 2 | Radial FDP tendon for digit 3. | Radial extensor expansion of digit 3. | Flexes MCP 3; extends PIP and DIP 3. | — | [hand_muscles](https://www.ncbi.nlm.nih.gov/books/NBK537229/) |
| Lumbrical 3 | Adjacent FDP tendons for digits 3–4. | Radial extensor expansion of digit 4. | Flexes MCP 4; extends PIP and DIP 4. | — | [hand_muscles](https://www.ncbi.nlm.nih.gov/books/NBK537229/) |
| Lumbrical 4 | Adjacent FDP tendons for digits 4–5. | Radial extensor expansion of digit 5. | Flexes MCP 5; extends PIP and DIP 5. | — | [hand_muscles](https://www.ncbi.nlm.nih.gov/books/NBK537229/) |
| Dorsal interosseous 1 | Facing shafts of metacarpals 1 and 2. | Radial proximal phalanx and extensor expansion, digit 2. | Abducts digit 2; flexes MCP and extends IP joints. | — | [grays_hand](https://elsevier-elibrary.com/contents/fullcontent/58750/epubcontent_v2/OEBPS/B9780443066849500585.htm) |
| Dorsal interosseous 2 | Facing shafts of metacarpals 2 and 3. | Radial proximal phalanx and extensor expansion, digit 3. | Abducts digit 3; flexes MCP and extends IP joints. | — | [grays_hand](https://elsevier-elibrary.com/contents/fullcontent/58750/epubcontent_v2/OEBPS/B9780443066849500585.htm) |
| Dorsal interosseous 3 | Facing shafts of metacarpals 3 and 4. | Ulnar proximal phalanx and extensor expansion, digit 3. | Abducts digit 3; flexes MCP and extends IP joints. | — | [grays_hand](https://elsevier-elibrary.com/contents/fullcontent/58750/epubcontent_v2/OEBPS/B9780443066849500585.htm) |
| Dorsal interosseous 4 | Facing shafts of metacarpals 4 and 5. | Ulnar proximal phalanx and extensor expansion, digit 4. | Abducts digit 4; flexes MCP and extends IP joints. | — | [grays_hand](https://elsevier-elibrary.com/contents/fullcontent/58750/epubcontent_v2/OEBPS/B9780443066849500585.htm) |
| Palmar interosseous 1 | Ulnar metacarpal 2 shaft. | Ulnar proximal phalanx and extensor expansion, digit 2. | Adducts digit 2; flexes MCP and extends IP joints. | — | [uams](https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-upper-limb/) |
| Palmar interosseous 2 | Radial metacarpal 4 shaft. | Radial proximal phalanx and extensor expansion, digit 4. | Adducts digit 4; flexes MCP and extends IP joints. | — | [uams](https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-upper-limb/) |
| Palmar interosseous 3 | Radial metacarpal 5 shaft. | Radial proximal phalanx and extensor expansion, digit 5. | Adducts digit 5; flexes MCP and extends IP joints. | — | [uams](https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-upper-limb/) |

### Out of scope

These muscles attach only to the arm or forearm bones, so the scope rule excludes them. They are not counted.

| Muscle | Origin | Insertion | Reason | Sources |
| --- | --- | --- | --- | --- |
| Brachioradialis | Humeral lateral supracondylar ridge. | Distal radius near styloid. | Runs from the humerus to the distal radius; it acts mainly at the elbow and does not attach to the hand. | [forearm_muscles](https://www.ncbi.nlm.nih.gov/books/NBK536975/) |
| Anconeus | Humeral lateral epicondyle. | Olecranon and proximal posterior ulna. | Runs from the humerus to the ulna; it acts at the elbow and does not attach to the hand. | [forearm_compartments](https://www.ncbi.nlm.nih.gov/books/NBK539784/) |

## Actuator correspondence

FDS, FDP, and extensor digitorum each have four digital channels. The `RI`, `LU_RB`, and `UI_UB` labels identify twelve source-model intrinsic channels. Their exact anatomical membership is unresolved. Keep those labels when displaying controls; do not rename them as individual lumbricals or interossei. [myohand_build](https://github.com/MyoHub/myo_sim/blob/93b0ca8f4ec90c9899ee7f05fee561e9911da91b/myo_sim/build/hand.py), [myohand_tendons](https://github.com/MyoHub/myo_sim/blob/93b0ca8f4ec90c9899ee7f05fee561e9911da91b/myo_sim/models/arm/assets/myoarm_r_tendon.xml).

| Channel | Display name | Mapping |
| --- | --- | --- |
| `ECRL_r` | Extensor carpi radialis longus | named muscle |
| `ECRB_r` | Extensor carpi radialis brevis | named muscle |
| `ECU_r` | Extensor carpi ulnaris | named muscle |
| `FCR_r` | Flexor carpi radialis | named muscle |
| `FCU_r` | Flexor carpi ulnaris | named muscle |
| `PL_r` | Palmaris longus | named muscle |
| `PT_r` | Pronator teres | named muscle |
| `PQ_r` | Pronator quadratus | named muscle |
| `FDS5_r` | Flexor digitorum superficialis · digit 5 | named muscle |
| `FDS4_r` | Flexor digitorum superficialis · digit 4 | named muscle |
| `FDS3_r` | Flexor digitorum superficialis · digit 3 | named muscle |
| `FDS2_r` | Flexor digitorum superficialis · digit 2 | named muscle |
| `FDP5_r` | Flexor digitorum profundus · digit 5 | named muscle |
| `FDP4_r` | Flexor digitorum profundus · digit 4 | named muscle |
| `FDP3_r` | Flexor digitorum profundus · digit 3 | named muscle |
| `FDP2_r` | Flexor digitorum profundus · digit 2 | named muscle |
| `EDC5_r` | Extensor digitorum · digit 5 | named muscle |
| `EDC4_r` | Extensor digitorum · digit 4 | named muscle |
| `EDC3_r` | Extensor digitorum · digit 3 | named muscle |
| `EDC2_r` | Extensor digitorum · digit 2 | named muscle |
| `EDM_r` | Extensor digiti minimi | named muscle |
| `EIP_r` | Extensor indicis | named muscle |
| `EPL_r` | Extensor pollicis longus | named muscle |
| `EPB_r` | Extensor pollicis brevis | named muscle |
| `FPL_r` | Flexor pollicis longus | named muscle |
| `APL_r` | Abductor pollicis longus | named muscle |
| `OP_r` | Opponens pollicis | named muscle |
| `RI2_r` | Intrinsic channel RI · digit 2 | unresolved bundle |
| `LU_RB2_r` | Intrinsic channel LU_RB · digit 2 | unresolved bundle |
| `UI_UB2_r` | Intrinsic channel UI_UB · digit 2 | unresolved bundle |
| `RI3_r` | Intrinsic channel RI · digit 3 | unresolved bundle |
| `LU_RB3_r` | Intrinsic channel LU_RB · digit 3 | unresolved bundle |
| `UI_UB3_r` | Intrinsic channel UI_UB · digit 3 | unresolved bundle |
| `RI4_r` | Intrinsic channel RI · digit 4 | unresolved bundle |
| `LU_RB4_r` | Intrinsic channel LU_RB · digit 4 | unresolved bundle |
| `UI_UB4_r` | Intrinsic channel UI_UB · digit 4 | unresolved bundle |
| `RI5_r` | Intrinsic channel RI · digit 5 | unresolved bundle |
| `LU_RB5_r` | Intrinsic channel LU_RB · digit 5 | unresolved bundle |
| `UI_UB5_r` | Intrinsic channel UI_UB · digit 5 | unresolved bundle |
| `APB_r` | Abductor pollicis brevis | named muscle |
| `FPB_r` | Flexor pollicis brevis | named muscle |
| `AdP_r` | Adductor pollicis | named muscle |
| `ADM_r` | Abductor digiti minimi | named muscle |
| `FDM_r` | Flexor digiti minimi brevis | named muscle |

## Conventions and limitations

[Model geometry and DOFs](model.md) document the simulator's axes, limits, local tendon sites, and wrap references. The machine-readable catalog is [model.json](../data/anatomy/model.json); its source is [hand.xml](../models/myohand/hand.xml). See [model provenance](../models/myohand/provenance.json) for the pinned revision.

- **digits:** 1 thumb, 2 index, 3 middle, 4 ring, 5 little
- **MCP:** metacarpophalangeal
- **PIP:** proximal interphalangeal
- **DIP:** distal interphalangeal
- **CMC:** carpometacarpal
- **IP:** thumb interphalangeal
- **abduction:** Fingers move away from digit 3; thumb abduction has a different anatomical plane.
- **coordinate_units:** Anatomical descriptions use named directions; numeric model geometry uses metres and joint angles use radians. Refer to the model catalog for axis frames and signs.

- Palmaris longus can be absent; this reference inventory includes it.
- Use the three-palmar-interossei convention; a separately described thumb palmar interosseous and accessory muscles are outside this count.
- Origins and insertions are attachment summaries, not specimen-specific coordinates. Head variants and accessory slips are not enumerated.
- MyoHand has 39 actuators. 5 actuators from MUSIC (APB_r, FPB_r, AdP_r, ADM_r, FDM_r) are added when the MUSIC cache is present, giving 44. Twelve finger intrinsic channels retain bundled model labels because an exact muscle-by-muscle correspondence has not been established.
- Empty model_actuators means no confirmed dedicated actuator; a muscle may contribute to a bundled channel without an established mapping.
- Forearm rotation (pro_sup_r) has two pronator actuators (PT_r, PQ_r) and no supinator, as in MyoHand and MUSIC.
- The anatomical inventory is a research reference. Muscle paths, joint axes, limits, and posture-dependent moment arms must be read from the exported model catalog.

Anatomical influence describes possible actions. Actual movement depends on posture, coactivation, passive forces, constraints, and contact. A muscle can produce force without joint motion.

## Sources

- [OpenStax, Anatomy and Physiology 2e, Bones of the Upper Limb](https://openstax.org/books/anatomy-and-physiology-2e/pages/8-2-bones-of-the-upper-limb) (`openstax_bones`)
- [UAMS Department of Neuroscience, Muscles of the Upper Limb](https://medicine.uams.edu/neuroscience/education/medical-school-courses/human-structure-module/anatomy-tables/muscle-tables/muscles-of-the-upper-limb/) (`uams`)
- [Gray’s Anatomy, forearm chapter (publisher text)](https://elsevier-elibrary.com/contents/fullcontent/58750/epubcontent_v2/OEBPS/B9780443066849500573.htm) (`grays_forearm`)
- [Gray’s Anatomy, hand chapter (publisher text)](https://elsevier-elibrary.com/contents/fullcontent/58750/epubcontent_v2/OEBPS/B9780443066849500585.htm) (`grays_hand`)
- [Gray’s Anatomy for Students, upper limb (publisher text)](https://elsevier-elibrary.com/contents/fullcontent/58090/epubcontent_v2/OEBPS/B9780443069529000126A.htm) (`grays_students`)
- [StatPearls, Anatomy, Shoulder and Upper Limb, Forearm Muscles](https://www.ncbi.nlm.nih.gov/books/NBK536975/) (`forearm_muscles`)
- [StatPearls, Anatomy, Shoulder and Upper Limb, Forearm Compartments](https://www.ncbi.nlm.nih.gov/books/NBK539784/) (`forearm_compartments`)
- [StatPearls, Anatomy, Shoulder and Upper Limb, Hand Muscles](https://www.ncbi.nlm.nih.gov/books/NBK537229/) (`hand_muscles`)
- [Dorsal forearm muscles: US anatomy, pictorial essay](https://pmc.ncbi.nlm.nih.gov/articles/PMC3552760/) (`dorsal_forearm`)
- [Elsevier Complete Anatomy, Extensor Carpi Radialis Longus](https://www.elsevier.com/resources/anatomy/muscular-system/muscles-of-upper-limb/extensor-carpi-radialis-longus/22064) (`ecrl`)
- [Greenbaum et al. (1999), Extensor carpi radialis brevis: an anatomical analysis of its origin](https://pubmed.ncbi.nlm.nih.gov/10530864/) (`ecrb_origin`)
- [Structural and functional anatomy of the palmaris brevis: grasping for answers](https://pmc.ncbi.nlm.nih.gov/articles/PMC5696130/) (`palmaris_brevis`)
- [StatPearls, Intrinsic Hand Deformity](https://pubmed.ncbi.nlm.nih.gov/33232025/) (`intrinsic_count`)
- [MyoSim, MyoHand model documentation](https://github.com/MyoHub/myo_sim/blob/93b0ca8f4ec90c9899ee7f05fee561e9911da91b/myo_sim/models/arm/README_hand.md) (`myohand`)
- [MyoSim, hand composition and actuator selection](https://github.com/MyoHub/myo_sim/blob/93b0ca8f4ec90c9899ee7f05fee561e9911da91b/myo_sim/build/hand.py) (`myohand_build`)
- [MyoSim, right arm tendon definitions](https://github.com/MyoHub/myo_sim/blob/93b0ca8f4ec90c9899ee7f05fee561e9911da91b/myo_sim/models/arm/assets/myoarm_r_tendon.xml) (`myohand_tendons`)
- [Xu P, Ye Y, Sun S, Ding Y, Schumann E, Liu CK. MUSIC: Learning Muscle-Driven Dexterous Hand Control. ACM Trans Graph 45(4), 2026. Model files at github.com/xupei0610/music commit 1b13b79; the repository has no license, so they are used locally and not redistributed.](https://doi.org/10.1145/3811402) (`music`)

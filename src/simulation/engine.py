"""MuJoCo adapter. Geometry, state, and influence all come from one model."""

import json
import math
import os
from functools import lru_cache
from pathlib import Path

import mujoco
import numpy as np

ROOT = Path(__file__).resolve().parents[2]


@lru_cache(maxsize=1)
def load_passive_stiffness():
    return json.loads((ROOT / "models/myohand/passive_stiffness.json").read_text())


def directional_stiffness(entry):
    """(positive, negative) stiffness in N·m/rad: resisting motion in each joint direction."""
    value = entry["stiffness_nm_per_rad"]
    if isinstance(value, dict):
        return value["positive"], value["negative"]
    return value, value


def add_one_sided_springs(spec):
    """Joints whose stiffness differs by direction get two one-sided springs instead.

    Each is a fixed tendon on the joint with a dead band: zero force on one side of the reference
    posture, linear on the other. MuJoCo treats these as passive forces in both the Python and the
    WebAssembly builds (polynomial joint stiffness needs MuJoCo 3.7, newer than the browser build).
    """
    for name, entry in load_passive_stiffness()["joints"].items():
        if name in LOCKED_JOINTS or not isinstance(entry["stiffness_nm_per_rad"], dict):
            continue
        positive, negative = directional_stiffness(entry)
        for side, stiffness, band in (
            ("positive", positive, [-10, 0]),
            ("negative", negative, [0, 10]),
        ):
            tendon = spec.add_tendon(name=f"passive_{name}_{side}")
            tendon.wrap_joint(name, 1.0)
            tendon.stiffness = [stiffness, 0, 0]
            tendon.springlength = band


# Actuators and joints removed at load time. Both are empty: forearm rotation and the two
# pronators are kept, as in MUSIC, because later simulations may need palm-up/down motion.
# Example: EXCLUDED_ACTUATORS = ("PT_r", "PQ_r"); LOCKED_JOINTS = ("pro_sup_r",) locks the
# forearm at neutral.
EXCLUDED_ACTUATORS: tuple[str, ...] = ()
LOCKED_JOINTS: tuple[str, ...] = ()


# MUSIC (Xu et al. 2026) adds five thumb and little-finger muscles to MyoHand. Its repository has
# no license, so it is not vendored: scripts/fetch_music.py clones it into a local cache and the
# muscles are grafted on at load time. Bone frames match MyoHand to within 0.1 mm.
MUSIC_REPOSITORY = "https://github.com/xupei0610/music"
MUSIC_COMMIT = "1b13b795a3ce6af6819ade70efcb00d4bdd6a6ff"
MUSIC_MUSCLES = ("APB", "FPB", "AdP", "ADM", "FDM")
MUSIC_BODIES = {
    "proxph2": "2proxph",
    "proxph3": "3proxph",
    "proxph4": "4proxph",
    "proxph5": "5proxph",
}


def music_directory():
    default = Path.home() / ".cache/clonehand" / f"music-{MUSIC_COMMIT[:7]}"
    return Path(os.environ.get("CLONEHAND_MUSIC_DIR", default))


@lru_cache(maxsize=1)
def load_music_muscles():
    """Return the five MUSIC muscle definitions in MyoHand terms, or [] if MUSIC is not fetched."""
    path = music_directory() / "assets/right_hand_muscle_driven.xml"
    if not path.exists():
        return []
    spec = mujoco.MjSpec.from_file(str(path))
    spec.delete(spec.joint("R:root_joint"))
    music = spec.compile()
    muscles = []
    for name in MUSIC_MUSCLES:
        i = music.actuator(f"R:{name}").id
        tendon = int(music.actuator_trnid[i, 0])
        start, count = music.tendon_adr[tendon], music.tendon_num[tendon]
        sites = []
        for w in range(start, start + count):
            if music.wrap_type[w] != mujoco.mjtWrap.mjWRAP_SITE:
                raise ValueError(f"MUSIC {name} uses a wrap type this loader does not handle.")
            site = int(music.wrap_objid[w])
            body = music.body(int(music.site_bodyid[site])).name.removeprefix("R:")
            sites.append(
                {"body": f"{MUSIC_BODIES.get(body, body)}_r", "pos": music.site_pos[site].tolist()}
            )
        muscles.append(
            {
                "id": f"{name}_r",
                "sites": sites,
                "gainprm": music.actuator_gainprm[i].tolist(),
                "biasprm": music.actuator_biasprm[i].tolist(),
                "dynprm": music.actuator_dynprm[i].tolist(),
                "lengthrange": music.actuator_lengthrange[i].tolist(),
            }
        )
    return muscles


def add_music_muscles(spec):
    for muscle in load_music_muscles():
        tendon = spec.add_tendon(name=muscle["id"].replace("_r", "_tendon_r"))
        tendon.width = 0.002
        for n, site in enumerate(muscle["sites"], start=1):
            name = muscle["id"].replace("_r", f"-P{n}_r")
            spec.body(site["body"]).add_site(name=name, pos=site["pos"])
            tendon.wrap_site(name)
        actuator = spec.add_actuator(name=muscle["id"], target=tendon.name)
        actuator.trntype = mujoco.mjtTrn.mjTRN_TENDON
        actuator.dyntype = mujoco.mjtDyn.mjDYN_MUSCLE
        actuator.gaintype = mujoco.mjtGain.mjGAIN_MUSCLE
        actuator.biastype = mujoco.mjtBias.mjBIAS_MUSCLE
        actuator.gainprm = muscle["gainprm"]
        actuator.biasprm = muscle["biasprm"]
        actuator.dynprm = muscle["dynprm"]
        actuator.lengthrange = muscle["lengthrange"]
        actuator.ctrlrange = [0, 1]
        actuator.ctrllimited = mujoco.mjtLimited.mjLIMITED_TRUE


def build_spec(include_music=True):
    """MyoHand with the load-time edits: excluded actuators, locked joints, MUSIC muscles."""
    spec = mujoco.MjSpec.from_file(str(ROOT / "models/myohand/hand.xml"))
    for name in EXCLUDED_ACTUATORS:
        actuator = spec.actuator(name)
        tendon = actuator.target
        spec.delete(actuator)
        spec.delete(spec.tendon(tendon))
    for name in LOCKED_JOINTS:
        spec.delete(spec.joint(name))
    add_one_sided_springs(spec)
    if include_music:
        add_music_muscles(spec)
    return spec


def apply_runtime_settings(model):
    # A supported-hand exploration scene: no gravity, no external objects.
    model.opt.gravity[:] = 0
    model.opt.timestep = 0.002
    model.opt.integrator = mujoco.mjtIntegrator.mjINT_IMPLICITFAST
    # MyoHand has no joint stiffness, so unopposed torque drives joints to their limits.
    # Add sourced passive springs toward the reference posture (qpos_spring == qpos0).
    # Joints with directional values use the one-sided springs from add_one_sided_springs().
    for name, entry in load_passive_stiffness()["joints"].items():
        if name in LOCKED_JOINTS or isinstance(entry["stiffness_nm_per_rad"], dict):
            continue
        model.jnt_stiffness[model.joint(name).id] = entry["stiffness_nm_per_rad"]


@lru_cache(maxsize=2)
def load_model(include_music=True):
    """The simulated model. include_music=False gives the MyoHand-only model the web demo uses."""
    model = build_spec(include_music).compile()
    apply_runtime_settings(model)
    return model


def joint_description(name):
    base = name.removesuffix("_r")
    fixed = {
        "pro_sup": ("Forearm rotation", "Pronation", "Supination"),
        "deviation": ("Wrist deviation", "Radial deviation", "Ulnar deviation"),
        "flexion": ("Wrist flexion", "Flexion", "Extension"),
        "cmc_flexion": ("Thumb CMC flexion", "Extension", "Flexion"),
        "cmc_abduction": ("Thumb CMC abduction", "Abduction", "Adduction"),
        "mp_flexion": ("Thumb MCP flexion", "Extension", "Flexion"),
        "ip_flexion": ("Thumb IP flexion", "Extension", "Flexion"),
    }
    if base in fixed:
        return fixed[base]
    digits = {"2": "Index", "3": "Middle", "4": "Ring", "5": "Little"}
    for prefix, joint in [("mcp", "MCP"), ("pm", "PIP"), ("md", "DIP")]:
        if base.startswith(prefix):
            digit = base[len(prefix)]
            action = base.split("_")[1]
            positive, negative = (
                ("Flexion", "Extension")
                if action == "flexion"
                else ("Radial motion", "Ulnar motion")
            )
            return f"{digits[digit]} {joint} {action}", positive, negative
    return name, "Positive rotation", "Negative rotation"


# Tendon stress at maximum isometric force, about 32 MPa (Zajac 1989). Used only to size the
# drawn tendon: cross-section area = Fmax / stress.
TENDON_STRESS_PA = 32e6
# Specific tension used to estimate PCSA from Fmax when no measured volume exists.
SPECIFIC_TENSION_PA = 35e4


@lru_cache(maxsize=1)
def load_architecture():
    path = ROOT / "data/anatomy/muscle_architecture.json"
    return json.loads(path.read_text()) if path.exists() else {"muscles": {}, "sources": []}


def body_depth(model, body):
    depth = 0
    while body:
        body = int(model.body_parentid[body])
        depth += 1
    return depth


def muscle_rendering(model, annotations):
    """Belly and tendon dimensions for the anatomical view, one entry per actuator.

    The simulated tendon is inextensible, so the GUI keeps tendon length fixed and assigns every
    change in muscle-tendon length to the belly. Rest belly length and volume come from
    data/anatomy/muscle_architecture.json; each field records whether it was measured or estimated.
    """
    data = mujoco.MjData(model)
    mujoco.mj_forward(model, data)
    muscles = load_architecture()["muscles"]
    result = []
    for i in range(model.nu):
        name = model.actuator(i).name
        reference = float(data.actuator_length[i])
        fmax = float(model.actuator_gainprm[i, 2])
        tendon = int(model.actuator_trnid[i, 0])
        first = int(model.wrap_objid[model.tendon_adr[tendon]])
        last = int(model.wrap_objid[model.tendon_adr[tendon] + model.tendon_num[tendon] - 1])
        start_depth = body_depth(model, int(model.site_bodyid[first]))
        end_depth = body_depth(model, int(model.site_bodyid[last]))
        architecture_id = annotations.get(name, {}).get("architecture_id")
        entry = muscles.get(architecture_id, {})

        def value(field, scale):
            item = entry.get(field)
            return (item["value"] * scale, item.get("source")) if item else (None, None)

        belly, belly_source = value("muscle_length_cm", 0.01)
        belly_basis = "measured"
        if belly is None:
            fraction, _ = value("belly_fraction_of_path", 1)
            belly, belly_basis = (fraction or 0.5) * reference, "assumed"
        if belly > 0.95 * reference:
            # A measured belly longer than the model path: draw it over 95% of the path.
            belly, belly_basis = 0.95 * reference, f"{belly_basis}, shortened to fit the model path"
        volume, volume_source = value("volume_cm3", 1e-6)
        volume_basis = "measured"
        if volume is None:
            pcsa, volume_source = value("pcsa_cm2", 1e-4)
            fiber, _ = value("fiber_length_cm", 0.01)
            if pcsa is not None and fiber is not None:
                volume, volume_basis = pcsa * fiber, "pcsa x fiber length"
            else:
                volume, volume_basis = fmax / SPECIFIC_TENSION_PA * belly, "estimated from Fmax"
        result.append(
            {
                "architecture_id": architecture_id,
                "reference_length_m": reference,
                "belly_rest_length_m": belly,
                "belly_basis": belly_basis,
                "belly_source": belly_source,
                "volume_m3": volume,
                "volume_basis": volume_basis,
                "volume_source": volume_source,
                "tendon_radius_m": math.sqrt(fmax / TENDON_STRESS_PA / math.pi),
                # The belly sits at the origin, taken as the end on the more proximal bone.
                "origin_at_path_start": start_depth <= end_depth,
            }
        )
    return result


# Chinese finger names for per-digit channels such as "Flexor digitorum superficialis · digit 2".
DIGITS_ZH = {"2": "示指", "3": "中指", "4": "环指", "5": "小指"}


class HandSimulation:
    def __init__(self, include_music=True):
        self.model = load_model(include_music)
        self.data = mujoco.MjData(self.model)
        self.paused = False
        self.actuator_ids = {self.model.actuator(i).name: i for i in range(self.model.nu)}
        self.bone_geoms = [
            i
            for i in range(self.model.ngeom)
            if self.model.geom_type[i] == mujoco.mjtGeom.mjGEOM_MESH
            and self.model.geom_group[i] == 0
            and self.model.geom_bodyid[i] >= self.model.body("ulna_r").id
        ]
        mujoco.mj_forward(self.model, self.data)

    def set_controls(self, values):
        if not isinstance(values, dict):
            raise ValueError("Controls must be an object of actuator IDs and values.")
        updates = []
        for name, value in values.items():
            if name not in self.actuator_ids:
                raise ValueError(f"Unknown actuator: {name}")
            if (
                isinstance(value, bool)
                or not isinstance(value, (int, float))
                or not math.isfinite(value)
                or not 0 <= value <= 1
            ):
                raise ValueError("Excitation must be a finite number between 0 and 1.")
            updates.append((self.actuator_ids[name], value))
        for i, value in updates:
            self.data.ctrl[i] = value

    def relax(self):
        self.data.ctrl[:] = 0

    def reset(self):
        mujoco.mj_resetData(self.model, self.data)
        mujoco.mj_forward(self.model, self.data)

    def advance(self, steps=16):
        if self.paused:
            return
        if not isinstance(steps, int) or not 0 <= steps <= 5000:
            raise ValueError("Step count must be an integer from 0 to 5000.")
        old_warnings = self.data.warning.number.copy()
        mujoco.mj_step(self.model, self.data, nstep=steps)
        mujoco.mj_forward(self.model, self.data)
        if not np.isfinite(self.data.qpos).all() or np.any(self.data.warning.number > old_warnings):
            self.paused = True
            self.reset()
            raise RuntimeError(
                "Simulation became unstable and was reset. Reduce excitation and run again."
            )

    def moment_arms(self):
        # MuJoCo stores dl/dq; positive contractile influence is -dl/dq.
        result = np.zeros((self.model.nu, self.model.nv))
        for i in range(self.model.nu):
            start = self.data.moment_rowadr[i]
            end = start + self.data.moment_rownnz[i]
            result[i, self.data.moment_colind[start:end]] = -self.data.actuator_moment[start:end]
        return result

    def snapshot(self):
        d, m = self.data, self.model
        # C storage is (nwrap*2, 3); Python exposes the same buffer as (nwrap, 6).
        wrapped = d.wrap_xpos.reshape(-1, 3)
        paths = []
        for i in range(m.nu):
            tendon = m.actuator_trnid[i, 0]
            start, count = d.ten_wrapadr[tendon], d.ten_wrapnum[tendon]
            paths.append(wrapped[start : start + count].round(7).tolist())
        quaternions = []
        for geom in self.bone_geoms:
            quat = np.empty(4)
            mujoco.mju_mat2Quat(quat, d.geom_xmat[geom])
            quaternions.append(quat.tolist())
        return {
            "type": "state",
            "time": float(d.time),
            "paused": self.paused,
            "excitation": d.ctrl.tolist(),
            "mtu_length": d.actuator_length.tolist(),
            "activation": d.act.tolist(),
            "force": (-d.actuator_force).tolist(),
            "qpos": d.qpos.tolist(),
            "qvel": d.qvel.tolist(),
            "moment_arms": (self.moment_arms() * 1000).round(4).tolist(),
            "bone_positions": d.geom_xpos[self.bone_geoms].tolist(),
            "bone_quaternions": quaternions,
            "paths": paths,
        }

    def geometry(self):
        m = self.model
        mesh_ids = sorted(set(int(m.geom_dataid[g]) for g in self.bone_geoms))
        meshes = []
        for i in mesh_ids:
            v, f = m.mesh_vertadr[i], m.mesh_faceadr[i]
            meshes.append(
                {
                    "id": i,
                    "vertices": m.mesh_vert[v : v + m.mesh_vertnum[i]].ravel().tolist(),
                    "faces": m.mesh_face[f : f + m.mesh_facenum[i]].ravel().tolist(),
                }
            )
        return {
            "bones": [
                {"id": m.geom(g).name, "mesh_id": int(m.geom_dataid[g])} for g in self.bone_geoms
            ],
            "meshes": meshes,
        }

    def metadata(self):
        m = self.model
        anatomy_path = ROOT / "data/anatomy/anatomy.json"
        anatomy = json.loads(anatomy_path.read_text()) if anatomy_path.exists() else {}
        annotations = {a["id"]: a for a in anatomy.get("actuators", [])}
        muscles = {a["id"]: a for a in anatomy.get("muscles", [])}
        actuators = []
        for name in self.actuator_ids:
            info = annotations.get(
                name,
                {
                    "id": name,
                    "name": name,
                    "group": "Model actuator",
                    "function": "See model tendon path.",
                    "notes": "",
                },
            ).copy()
            references = [muscles[x] for x in info.get("anatomical_muscle_ids", []) if x in muscles]
            info["origin"] = (
                "; ".join(dict.fromkeys(x["origin"] for x in references))
                or "Model attachment sites; anatomical bundle mapping unresolved."
            )
            zh = [x["name_zh"] for x in references if x.get("name_zh")]
            if zh and info.get("mapping_status") != "unresolved_bundle":
                digit = DIGITS_ZH.get(info["name"].rpartition("· digit ")[2])
                info["name_zh"] = "、".join(zh) + (f" · {digit}" if digit else "")
            info["insertion"] = (
                "; ".join(dict.fromkeys(x["insertion"] for x in references))
                or "See model tendon route."
            )
            actuators.append(info)
        stiffness = load_passive_stiffness()["joints"]
        joints = []
        for i in range(m.njnt):
            name = m.joint(i).name
            label, positive, negative = joint_description(name)
            joints.append(
                {
                    "id": name,
                    "name": label,
                    "positive": positive,
                    "negative": negative,
                    "range": np.rad2deg(m.jnt_range[i]).tolist(),
                    "axis": m.jnt_axis[i].tolist(),
                    "passive_stiffness_nm_per_rad": directional_stiffness(
                        stiffness.get(name, {"stiffness_nm_per_rad": 0.0})
                    ),
                    "passive_stiffness_basis": stiffness.get(name, {}).get("basis", "none"),
                }
            )
        return {
            **self.geometry(),
            "actuators": actuators,
            "rendering": muscle_rendering(m, annotations),
            "joints": joints,
            "counts": {"bones": len(self.bone_geoms), "dofs": m.nv, "actuators": m.nu},
            "limitations": [
                "Scope is muscles with at least one end on the hand or a finger, plus the three forearm rotators: 37 anatomical muscles. Brachioradialis and anconeus are out of scope.",
                "Actuators are not one per muscle: FDS, FDP, and EDC have four each, and 12 channels bundle the interossei and lumbricals.",
                "Paths show muscle–tendon routing, not muscle-belly volumes. Intrinsic bundles have unresolved anatomical mappings.",
                "Forearm rotation has two pronator actuators and no supinator. Gravity is disabled for supported-hand exploration.",
                "Passive joint stiffness is added as linear springs toward the reference posture; wrist and forearm springs are stiffer on one side, as measured. Wrist, forearm, index MCP flexion, and PIP values are measured population means; the others are assumptions.",
                "RI2_r starts beyond its model length range and pulls with about 12 N at zero activation, so the relaxed index finger rests about 7° toward radial motion.",
                "No independent ring/little CMC motion, deformable skin, or external grasp objects in this scene.",
                "Moment arms describe local mechanical influence at the current posture, not guaranteed movement.",
                "Converted model parameters have not been independently validated against human measurements here.",
            ],
        }

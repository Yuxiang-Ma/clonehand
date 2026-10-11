import type { MainModule, MjData, MjModel } from 'mujoco';
import type { State } from './types';

/** Actuator order and bone geom ids, written by scripts/export_web_demo.py. */
export interface PhysicsIndex {
  actuators: string[];
  bone_geoms: number[];
}

export type Command =
  | { type: 'controls'; values: Record<string, unknown> }
  | { type: 'pause'; paused: unknown }
  | { type: 'relax' }
  | { type: 'reset' };

/** Rotation matrix (row-major 3x3) to quaternion [w, x, y, z], as mju_mat2Quat. */
function matToQuat(m: ArrayLike<number>, offset: number): [number, number, number, number] {
  const [xx, xy, xz, yx, yy, yz, zx, zy, zz] = Array.from({ length: 9 }, (_, i) => m[offset + i]);
  const trace = xx + yy + zz;
  let q: [number, number, number, number];
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    q = [0.25 / s, (zy - yz) * s, (xz - zx) * s, (yx - xy) * s];
  } else if (xx > yy && xx > zz) {
    const s = 2 * Math.sqrt(1 + xx - yy - zz);
    q = [(zy - yz) / s, 0.25 * s, (xy + yx) / s, (xz + zx) / s];
  } else if (yy > zz) {
    const s = 2 * Math.sqrt(1 + yy - xx - zz);
    q = [(xz - zx) / s, (xy + yx) / s, 0.25 * s, (yz + zy) / s];
  } else {
    const s = 2 * Math.sqrt(1 + zz - xx - yy);
    q = [(yx - xy) / s, (xz + zx) / s, (yz + zy) / s, 0.25 * s];
  }
  if (q[0] < 0) q = q.map(value => -value) as typeof q;
  return q;
}

/**
 * The browser twin of HandSimulation in src/simulation/engine.py. Same commands, same input
 * validation, same snapshot shape, so the GUI cannot tell which one it is talking to.
 */
export class LocalSimulation {
  paused = true;
  readonly model: MjModel;
  readonly data: MjData;
  private readonly mj: MainModule;
  private readonly index: PhysicsIndex;
  private readonly ids: Map<string, number>;

  // No parameter properties: Node's type stripping runs this file directly in tests/web/.
  constructor(mj: MainModule, model: MjModel, data: MjData, index: PhysicsIndex) {
    this.mj = mj;
    this.model = model;
    this.data = data;
    this.index = index;
    this.ids = new Map(index.actuators.map((name, i) => [name, i]));
    if (index.actuators.length !== model.nu) throw new Error('Physics index does not match the model.');
    mj.mj_forward(model, data);
  }

  /** Apply a command from the GUI. Throws on invalid input, leaving the state unchanged. */
  handle(command: Command) {
    if (!command || typeof command !== 'object') throw new Error('Send a command object.');
    switch (command.type) {
      case 'controls': return this.setControls(command.values);
      case 'pause':
        if (typeof command.paused !== 'boolean') throw new Error('paused must be true or false.');
        this.paused = command.paused;
        return;
      case 'relax': return this.relax();
      case 'reset': return this.reset();
      default: throw new Error(`Unknown command: ${(command as { type: unknown }).type}`);
    }
  }

  setControls(values: unknown) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Controls must be an object of actuator IDs and values.');
    const updates: [number, number][] = [];
    for (const [name, value] of Object.entries(values)) {
      const id = this.ids.get(name);
      if (id === undefined) throw new Error(`Unknown actuator: ${name}`);
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error('Excitation must be a finite number between 0 and 1.');
      }
      updates.push([id, value]);
    }
    const ctrl = this.data.ctrl as Float64Array;
    for (const [id, value] of updates) ctrl[id] = value;
  }

  relax() {
    (this.data.ctrl as Float64Array).fill(0);
  }

  reset() {
    this.mj.mj_resetData(this.model, this.data);
    this.mj.mj_forward(this.model, this.data);
  }

  private warningCount() {
    const warnings = this.data.warning;
    let total = 0;
    for (let i = 0; i < warnings.size(); i++) {
      const warning = warnings.get(i);
      total += warning?.number ?? 0;
      warning?.delete();
    }
    // The vector is a view into MjData, not a copy; deleting it frees MuJoCo's own memory.
    return total;
  }

  /** Step the model unless paused. Resets and throws if the state stops being finite. */
  advance(steps = 16) {
    if (this.paused) return;
    const before = this.warningCount();
    for (let i = 0; i < steps; i++) this.mj.mj_step(this.model, this.data);
    this.mj.mj_forward(this.model, this.data);
    const finite = (this.data.qpos as Float64Array).every(Number.isFinite);
    if (!finite || this.warningCount() > before) {
      this.paused = true;
      this.reset();
      throw new Error('Simulation became unstable and was reset. Reduce excitation and run again.');
    }
  }

  /** Moment arms in mm: -dL/dq from MuJoCo's sparse actuator_moment. */
  momentArms() {
    const { nu, nv } = this.model;
    const rowadr = this.data.moment_rowadr as Int32Array;
    const rownnz = this.data.moment_rownnz as Int32Array;
    const colind = this.data.moment_colind as Int32Array;
    const moment = this.data.actuator_moment as Float64Array;
    const result: number[][] = [];
    for (let i = 0; i < nu; i++) {
      const row = new Array<number>(nv).fill(0);
      for (let k = rowadr[i]; k < rowadr[i] + rownnz[i]; k++) row[colind[k]] = Math.round(-moment[k] * 1e7) / 1e4;
      result.push(row);
    }
    return result;
  }

  snapshot(): State {
    const { model: m, data: d } = this;
    const wrap = d.wrap_xpos as Float64Array;
    const wrapadr = d.ten_wrapadr as Int32Array;
    const wrapnum = d.ten_wrapnum as Int32Array;
    const trnid = m.actuator_trnid as Int32Array;
    const paths: [number, number, number][][] = [];
    for (let i = 0; i < m.nu; i++) {
      const tendon = trnid[2 * i];
      const points: [number, number, number][] = [];
      for (let k = wrapadr[tendon]; k < wrapadr[tendon] + wrapnum[tendon]; k++) points.push([wrap[3 * k], wrap[3 * k + 1], wrap[3 * k + 2]]);
      paths.push(points);
    }
    const xpos = d.geom_xpos as Float64Array;
    const xmat = d.geom_xmat as Float64Array;
    const force = Array.from(d.actuator_force as Float64Array, value => -value);
    return {
      type: 'state',
      time: d.time,
      paused: this.paused,
      excitation: Array.from(d.ctrl as Float64Array),
      mtu_length: Array.from(d.actuator_length as Float64Array),
      activation: Array.from(d.act as Float64Array),
      force,
      qpos: Array.from(d.qpos as Float64Array),
      qvel: Array.from(d.qvel as Float64Array),
      moment_arms: this.momentArms(),
      bone_positions: this.index.bone_geoms.map(g => [xpos[3 * g], xpos[3 * g + 1], xpos[3 * g + 2]]),
      bone_quaternions: this.index.bone_geoms.map(g => matToQuat(xmat, 9 * g)),
      paths,
    };
  }
}

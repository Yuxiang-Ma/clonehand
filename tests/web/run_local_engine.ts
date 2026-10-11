// Drives src/gui/local-engine.ts (the browser engine) under Node and prints its snapshots as JSON,
// so tests/test_web_demo.py can compare them with HandSimulation. Usage:
//   node tests/web/run_local_engine.ts <data dir> '<{"controls": {...}, "steps": n, "ticks": k}>'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import loadMujoco from 'mujoco';
import { LocalSimulation, type PhysicsIndex } from '../../src/gui/local-engine.ts';

const [directory, plan] = process.argv.slice(2);
const { controls, steps, ticks } = JSON.parse(plan) as { controls: Record<string, number>; steps: number; ticks: number };
const mj = await loadMujoco();
mj.FS.writeFile('/hand.xml', readFileSync(join(directory, 'hand.xml'), 'utf8'));
const index = JSON.parse(readFileSync(join(directory, 'physics.json'), 'utf8')) as PhysicsIndex;
const model = mj.MjModel.mj_loadXML('/hand.xml');
const sim = new LocalSimulation(mj, model, new mj.MjData(model), index);
const errors: string[] = [];
for (const command of [{ type: 'controls', values: { FDS2_r: 2 } }, { type: 'controls', values: { nope: 0.5 } }, { type: 'pause', paused: 'yes' }]) {
  try { sim.handle(command as never); } catch (error) { errors.push((error as Error).message); }
}
sim.handle({ type: 'controls', values: controls });
sim.handle({ type: 'pause', paused: false });
for (let tick = 0; tick < ticks; tick++) sim.advance(steps);
process.stdout.write(JSON.stringify({ engine: mj.mj_versionString(), errors, state: sim.snapshot() }));

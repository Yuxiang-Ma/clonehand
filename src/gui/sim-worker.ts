// Runs MuJoCo (WebAssembly) off the main thread for the static web demo. Speaks the same
// messages as the WebSocket service in src/server.py: commands in, state snapshots out at ~30 Hz.
import loadMujoco from 'mujoco';
import { LocalSimulation, type Command, type PhysicsIndex } from './local-engine';

const scope = self as unknown as { postMessage(message: unknown): void; onmessage: ((event: MessageEvent) => void) | null };
const TICK_MS = 32;
const STEPS_PER_TICK = 16;

async function fetchFile(base: string, name: string) {
  const response = await fetch(new URL(name, base));
  if (!response.ok) throw new Error(`Could not load ${name} (${response.status}).`);
  return response;
}

async function start(base: string) {
  const [mj, xml, index] = await Promise.all([
    loadMujoco(),
    fetchFile(base, 'data/hand.xml').then(response => response.text()),
    fetchFile(base, 'data/physics.json').then(response => response.json() as Promise<PhysicsIndex>),
  ]);
  mj.FS.writeFile('/hand.xml', xml);
  const model = mj.MjModel.mj_loadXML('/hand.xml');
  const data = new mj.MjData(model);
  const sim = new LocalSimulation(mj, model, data, index);

  scope.onmessage = event => {
    try {
      sim.handle(event.data as Command);
    } catch (cause) {
      scope.postMessage({ type: 'error', message: cause instanceof Error ? cause.message : String(cause) });
    }
  };
  scope.postMessage({ type: 'ready', engine: `MuJoCo ${mj.mj_versionString()} (WebAssembly)` });
  setInterval(() => {
    try {
      sim.advance(STEPS_PER_TICK);
    } catch (cause) {
      scope.postMessage({ type: 'error', message: cause instanceof Error ? cause.message : String(cause) });
    }
    scope.postMessage(sim.snapshot());
  }, TICK_MS);
}

scope.onmessage = event => {
  const { type, base } = event.data as { type: string; base: string };
  if (type !== 'start') return;
  start(base).catch(cause => scope.postMessage({
    type: 'fatal',
    message: `The physics engine could not start in this browser: ${cause instanceof Error ? cause.message : String(cause)}`,
  }));
};

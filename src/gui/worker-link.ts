import type { Incoming, LinkHandlers, SimulationLink } from './link';

/** Runs the simulation in a Web Worker (src/gui/sim-worker.ts) for the static web demo. */
export async function workerLink(handlers: LinkHandlers): Promise<SimulationLink> {
  const worker = new Worker(new URL('./sim-worker.ts', import.meta.url), { type: 'module' });
  let ready = false;
  worker.onmessage = event => {
    const message = event.data as Incoming | { type: 'ready' } | { type: 'fatal'; message: string };
    if (message.type === 'ready') { ready = true; return; }
    if (message.type === 'fatal') { handlers.onClose(message.message, false); worker.terminate(); return; }
    handlers.onMessage(message);
  };
  worker.onerror = event => {
    event.preventDefault();
    handlers.onClose(`The physics engine stopped: ${event.message || 'unknown error'}. Reload the page to start again.`, false);
  };
  worker.postMessage({ type: 'start', base: document.baseURI });
  return {
    send(message) { if (ready) worker.postMessage(message); },
    close() { worker.terminate(); },
  };
}

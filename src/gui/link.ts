import type { State } from './types';

/**
 * Where the simulation runs. The default build talks to the Python service over a WebSocket.
 * `vite build --mode demo` produces a static site that runs MuJoCo (WebAssembly) in a worker and
 * reads exported JSON files instead of the /api routes.
 */
export const STANDALONE = import.meta.env.MODE === 'demo';
export const MODEL_URL = STANDALONE ? 'data/model.json' : '/api/model';
export const ANATOMY_URL = STANDALONE ? 'data/anatomy.json' : '/api/anatomy';

export type Incoming = State | { type: 'error'; message: string };

export interface LinkHandlers {
  onMessage(message: Incoming): void;
  /** The link is gone. `retryable` is false when reconnecting cannot help. */
  onClose(message: string, retryable: boolean): void;
}

export interface SimulationLink {
  send(message: unknown): void;
  close(): void;
}

function socketLink(handlers: LinkHandlers): SimulationLink {
  const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  let closed = false;
  socket.onmessage = event => handlers.onMessage(JSON.parse(event.data) as Incoming);
  socket.onerror = () => handlers.onMessage({ type: 'error', message: 'Could not connect to the simulation service. Check that the Python server is running, then reconnect.' });
  socket.onclose = () => { if (!closed) handlers.onClose('Connection lost. Reconnect to start a fresh simulation.', true); };
  return {
    send(message) { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); },
    close() { closed = true; socket.close(); },
  };
}

export async function openLink(handlers: LinkHandlers): Promise<SimulationLink> {
  if (STANDALONE) {
    // Imported only in demo builds, so the server build carries no WebAssembly.
    const { workerLink } = await import('./worker-link');
    return workerLink(handlers);
  }
  return socketLink(handlers);
}

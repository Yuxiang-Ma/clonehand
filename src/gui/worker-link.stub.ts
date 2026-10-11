import type { LinkHandlers, SimulationLink } from './link';

/** Stand-in for worker-link.ts in the service build, which never runs the browser engine. */
export async function workerLink(_handlers: LinkHandlers): Promise<SimulationLink> {
  throw new Error('This build talks to the Python service; the in-browser engine is only in the demo build.');
}

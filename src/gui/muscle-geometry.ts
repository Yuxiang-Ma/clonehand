import * as THREE from 'three';
import type { MuscleRendering } from './types';

/** Points along the belly; rings of vertices around each one. */
export const BELLY_SEGMENTS = 28;
export const BELLY_SIDES = 12;

/**
 * Spindle profile from 0 (ends) to 1 (middle). Bellies taper into their tendons rather than
 * ending in flat discs, and the widest part sits a little toward the origin, as in most
 * fusiform muscles.
 */
export function profile(t: number) {
  return Math.pow(Math.sin(Math.PI * Math.pow(t, 0.85)), 0.75);
}

/** Mean of profile² over [0, 1]; a belly of length L and peak radius R has volume π R² L · this. */
const PROFILE_SQUARED_MEAN = (() => {
  let sum = 0;
  const steps = 400;
  for (let index = 0; index < steps; index++) sum += profile((index + 0.5) / steps) ** 2;
  return sum / steps;
})();

export interface BellySplit {
  /** Current belly length, metres. */
  belly: number;
  /** Tendon length, metres. Constant: the simulated tendon does not stretch. */
  tendon: number;
  /** Belly length divided by its rest length (1 = rest, < 1 = shortened). */
  ratio: number;
  /** Peak belly radius that keeps the belly's volume constant. */
  peakRadius: number;
}

/**
 * Split the current muscle-tendon length into belly and tendon. Tendon length is fixed at its
 * reference-posture value, so every change in total length shows up in the belly.
 */
export function splitMuscle(rendering: MuscleRendering, length: number): BellySplit {
  const tendon = Math.max(0, rendering.reference_length_m - rendering.belly_rest_length_m);
  const belly = THREE.MathUtils.clamp(length - tendon, 0.25 * rendering.belly_rest_length_m, 0.97 * length);
  const peakRadius = Math.sqrt(rendering.volume_m3 / (Math.PI * belly * PROFILE_SQUARED_MEAN));
  return { belly, tendon: length - belly, ratio: belly / rendering.belly_rest_length_m, peakRadius };
}

/** A polyline with arc-length lookup. */
export class Polyline {
  readonly points: THREE.Vector3[];
  readonly cumulative: number[];

  constructor(raw: number[][], reverse: boolean) {
    const ordered = reverse ? [...raw].reverse() : raw;
    this.points = ordered.map(point => new THREE.Vector3().fromArray(point));
    this.cumulative = [0];
    for (let index = 1; index < this.points.length; index++) {
      this.cumulative.push(this.cumulative[index - 1] + this.points[index].distanceTo(this.points[index - 1]));
    }
  }

  get length() { return this.cumulative[this.cumulative.length - 1] ?? 0; }

  at(distance: number, target: THREE.Vector3) {
    const clamped = THREE.MathUtils.clamp(distance, 0, this.length);
    let index = 1;
    while (index < this.cumulative.length - 1 && this.cumulative[index] < clamped) index++;
    const span = this.cumulative[index] - this.cumulative[index - 1] || 1;
    return target.lerpVectors(this.points[index - 1], this.points[index], (clamped - this.cumulative[index - 1]) / span);
  }

  /** Points from `distance` to the end, starting with the interpolated point. */
  tail(distance: number) {
    const result = [this.at(distance, new THREE.Vector3())];
    this.cumulative.forEach((value, index) => { if (value > distance) result.push(this.points[index]); });
    return result;
  }
}

/** Index buffer for a tube of BELLY_SEGMENTS + 1 rings with BELLY_SIDES vertices each. */
export function bellyGeometry() {
  const geometry = new THREE.BufferGeometry();
  const rings = BELLY_SEGMENTS + 1;
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rings * BELLY_SIDES * 3), 3));
  const indices: number[] = [];
  for (let ring = 0; ring < BELLY_SEGMENTS; ring++) {
    for (let side = 0; side < BELLY_SIDES; side++) {
      const a = ring * BELLY_SIDES + side;
      const b = ring * BELLY_SIDES + (side + 1) % BELLY_SIDES;
      const c = a + BELLY_SIDES;
      const d = b + BELLY_SIDES;
      // Counter-clockwise seen from outside, so normals point out of the belly.
      indices.push(a, b, c, b, d, c);
    }
  }
  geometry.setIndex(indices);
  return geometry;
}

const sample = new THREE.Vector3();
const tangent = new THREE.Vector3();
const normal = new THREE.Vector3();
const binormal = new THREE.Vector3();
const previous = new THREE.Vector3();
const next = new THREE.Vector3();

/** Write the belly's vertices along the first `bellyArc` metres of the path. */
export function updateBelly(geometry: THREE.BufferGeometry, path: Polyline, bellyArc: number, peakRadius: number, minimumRadius: number) {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const step = bellyArc / BELLY_SEGMENTS;
  normal.set(0, 0, 0);
  for (let ring = 0; ring <= BELLY_SEGMENTS; ring++) {
    const distance = ring * step;
    path.at(distance, sample);
    path.at(Math.max(0, distance - step * 0.5), previous);
    path.at(distance + step * 0.5, next);
    tangent.subVectors(next, previous);
    if (tangent.lengthSq() < 1e-14) tangent.set(1, 0, 0);
    tangent.normalize();
    // Parallel transport keeps the rings from twisting along a curved path.
    if (normal.lengthSq() === 0) {
      normal.set(0, 0, 1).cross(tangent);
      if (normal.lengthSq() < 1e-6) normal.set(0, 1, 0).cross(tangent);
    } else {
      normal.addScaledVector(tangent, -normal.dot(tangent));
    }
    normal.normalize();
    binormal.crossVectors(tangent, normal);
    const radius = Math.max(minimumRadius, peakRadius * profile(ring / BELLY_SEGMENTS));
    for (let side = 0; side < BELLY_SIDES; side++) {
      const angle = (side / BELLY_SIDES) * Math.PI * 2;
      const offset = ring * BELLY_SIDES + side;
      positions.setXYZ(
        offset,
        sample.x + radius * (Math.cos(angle) * normal.x + Math.sin(angle) * binormal.x),
        sample.y + radius * (Math.cos(angle) * normal.y + Math.sin(angle) * binormal.y),
        sample.z + radius * (Math.cos(angle) * normal.z + Math.sin(angle) * binormal.z),
      );
    }
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
}

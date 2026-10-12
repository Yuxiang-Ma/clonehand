import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Polyline, bellyGeometry, splitMuscle, updateBelly } from './muscle-geometry';
import type { Model, State } from './types';

const COLORS = { selected: 0x166b65, active: 0xc85836, resting: 0x9b958b };
/**
 * Anatomical view, three levels of emphasis:
 * - context: relaxed, unselected muscles are faint and never hide what is behind them;
 * - active: belly red, deeper with activation;
 * - selected: opaque, with a teal outline. Its fill still shows activation, so selection and
 *   activation stay distinguishable.
 */
const MUSCLE = {
  context: new THREE.Color(0xc4aaa3), relaxed: new THREE.Color(0xc98f84), active: new THREE.Color(0xb3261e),
  tendon: new THREE.Color(0x9fb3ba), selected: new THREE.Color(0x166b65),
};
const CONTEXT_OPACITY = { belly: 0.14, tendon: 0.22 };
/** Outline shell thickness around the selected belly, metres. */
const OUTLINE = 0.0013;

export type MuscleView = 'paths' | 'anatomical';

/** Render model geometry in metres; every transform comes from MuJoCo. */
export class HandViewer {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.001, 10);
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private bones: THREE.Mesh[] = [];
  private paths: THREE.InstancedMesh[] = [];
  private selectedOutline: THREE.InstancedMesh;
  private selected = 0;
  private allPaths = true;
  private state?: State;
  private framed = false;
  private center = new THREE.Vector3();
  private extent = 0.5;
  private handCenter = new THREE.Vector3();
  private handExtent = 0.25;
  private transform = new THREE.Object3D();
  private start = new THREE.Vector3();
  private end = new THREE.Vector3();
  private direction = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private pointer = new THREE.Vector2();
  private raycaster = new THREE.Raycaster();
  private down = new THREE.Vector2();
  private view: MuscleView = 'paths';
  private bellies: THREE.Mesh[] = [];
  private tendons: THREE.InstancedMesh[] = [];
  private split: { belly: number; tendon: number; ratio: number }[] = [];
  private outline!: THREE.Mesh;

  constructor(private host: HTMLElement, private model: Model, onSelect: (index: number) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0xf0eee7, 0);
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D right hand. Drag to orbit; scroll to zoom. Camera buttons provide preset views.');
    this.renderer.domElement.setAttribute('role', 'img');
    host.prepend(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 0.05;
    this.controls.maxDistance = 2;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8a79, 2.4));
    const key = new THREE.DirectionalLight(0xfffdf3, 3);
    key.position.set(0.4, -0.8, 1.2);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xe6eeed, 1.7);
    fill.position.set(0.5, 0.8, -0.2);
    this.scene.add(fill);
    const geometries = new Map(model.meshes.map(mesh => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.vertices, 3));
      geometry.setIndex(mesh.faces);
      geometry.computeVertexNormals();
      return [mesh.id, geometry];
    }));
    const boneMaterial = new THREE.MeshStandardMaterial({ color: 0xf0e9d9, roughness: 0.72, metalness: 0 });
    this.bones = model.bones.map(bone => {
      const geometry = geometries.get(bone.mesh_id);
      if (!geometry) throw new Error(`Missing mesh for ${bone.id}`);
      const mesh = new THREE.Mesh(geometry, boneMaterial);
      this.scene.add(mesh);
      return mesh;
    });
    const segmentGeometry = new THREE.CylinderGeometry(1, 1, 1, 7);
    this.paths = model.actuators.map((_, index) => {
      const path = new THREE.InstancedMesh(segmentGeometry, new THREE.MeshStandardMaterial({
        color: COLORS.resting, roughness: 0.65, transparent: true, opacity: 0.3,
      }), 128);
      path.count = 0;
      path.frustumCulled = false;
      path.userData.actuator = index;
      this.scene.add(path);
      return path;
    });
    this.selectedOutline = new THREE.InstancedMesh(segmentGeometry, new THREE.MeshBasicMaterial({
      color: COLORS.selected, transparent: true, opacity: 0.35, depthWrite: false,
    }), 128);
    this.selectedOutline.count = 0;
    this.selectedOutline.frustumCulled = false;
    this.scene.add(this.selectedOutline);
    this.bellies = model.actuators.map((_, index) => {
      const belly = new THREE.Mesh(bellyGeometry(), new THREE.MeshStandardMaterial({
        color: MUSCLE.context, roughness: 0.55, transparent: true, opacity: CONTEXT_OPACITY.belly, depthWrite: false,
      }));
      belly.visible = false;
      belly.frustumCulled = false;
      belly.userData.actuator = index;
      this.scene.add(belly);
      return belly;
    });
    this.tendons = model.actuators.map((_, index) => {
      const tendon = new THREE.InstancedMesh(segmentGeometry, new THREE.MeshStandardMaterial({
        color: MUSCLE.tendon, roughness: 0.35, metalness: 0.05, transparent: true, opacity: CONTEXT_OPACITY.tendon, depthWrite: false,
      }), 128);
      tendon.count = 0;
      tendon.visible = false;
      tendon.frustumCulled = false;
      tendon.userData.actuator = index;
      this.scene.add(tendon);
      return tendon;
    });
    // Back faces of a slightly fatter copy of the selected belly read as an outline.
    this.outline = new THREE.Mesh(bellyGeometry(), new THREE.MeshBasicMaterial({ color: MUSCLE.selected, side: THREE.BackSide }));
    this.outline.visible = false;
    this.outline.frustumCulled = false;
    this.scene.add(this.outline);
    this.renderer.domElement.addEventListener('pointerdown', event => this.down.set(event.clientX, event.clientY));
    this.renderer.domElement.addEventListener('pointerup', event => {
      if (this.down.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) return;
      const bounds = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const targets = [...this.paths, ...this.bellies, ...this.tendons].filter(object => object.visible);
      const hit = this.raycaster.intersectObjects(targets, false)[0];
      if (hit) onSelect(hit.object.userData.actuator);
    });
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  private resize() {
    const { width, height } = this.host.getBoundingClientRect();
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private setSegments(mesh: THREE.InstancedMesh, points: number[][] | THREE.Vector3[], radius: number) {
    mesh.count = Math.min(points.length - 1, 128);
    for (let index = 0; index < mesh.count; index++) {
      const a = points[index];
      const b = points[index + 1];
      if (a instanceof THREE.Vector3) this.start.copy(a); else this.start.fromArray(a);
      if (b instanceof THREE.Vector3) this.end.copy(b); else this.end.fromArray(b);
      this.direction.subVectors(this.end, this.start);
      const length = this.direction.length();
      this.transform.position.copy(this.start).add(this.end).multiplyScalar(0.5);
      this.transform.quaternion.setFromUnitVectors(this.up, this.direction.normalize());
      this.transform.scale.set(radius, length, radius);
      this.transform.updateMatrix();
      mesh.setMatrixAt(index, this.transform.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  update(state: State) {
    this.state = state;
    this.bones.forEach((bone, index) => {
      bone.position.fromArray(state.bone_positions[index]);
      const [w, x, y, z] = state.bone_quaternions[index];
      bone.quaternion.set(x, y, z, w);
    });
    const anatomical = this.view === 'anatomical';
    this.paths.forEach((path, index) => {
      const selected = index === this.selected;
      const active = state.activation[index] > 0.025;
      const shown = this.allPaths || selected || active;
      path.visible = shown && !anatomical;
      this.bellies[index].visible = shown && anatomical;
      this.tendons[index].visible = shown && anatomical;
      if (anatomical) {
        this.drawMuscle(index, state, selected);
        return;
      }
      const material = path.material as THREE.MeshStandardMaterial;
      material.color.setHex(active ? COLORS.active : selected ? COLORS.selected : COLORS.resting);
      material.opacity = active || selected ? 1 : 0.22;
      const radius = active ? 0.0009 + state.activation[index] * 0.0007 : selected ? 0.0011 : 0.0004;
      this.setSegments(path, state.paths[index], radius);
    });
    this.outline.visible = anatomical && this.bellies[this.selected].visible;
    const selectedPoints = state.paths[this.selected];
    this.selectedOutline.visible = !anatomical && state.activation[this.selected] > 0.025;
    this.setSegments(this.selectedOutline, selectedPoints, 0.0022);
    if (!this.framed) {
      this.scene.updateMatrixWorld(true);
      const box = new THREE.Box3();
      this.bones.forEach(bone => box.expandByObject(bone));
      box.getCenter(this.center);
      this.extent = box.getSize(new THREE.Vector3()).length();
      // Hand and wrist only (no radius or ulna), for small screens.
      const hand = new THREE.Box3();
      this.bones.forEach((bone, index) => { if (!/^(radius|ulna)/.test(this.model.bones[index].id)) hand.expandByObject(bone); });
      hand.getCenter(this.handCenter);
      this.handExtent = hand.getSize(new THREE.Vector3()).length();
      this.frame('palm');
      this.framed = true;
    }
  }

  /** Belly drawn from the origin; tendon fills the rest of the path at constant length. */
  private drawMuscle(index: number, state: State, selected: boolean) {
    const rendering = this.model.rendering[index];
    const path = new Polyline(state.paths[index], !rendering.origin_at_path_start);
    const split = splitMuscle(rendering, state.mtu_length[index]);
    this.split[index] = split;
    // The drawn polyline can be slightly shorter than the wrapped length; keep the proportion.
    const bellyArc = path.length * (split.belly / state.mtu_length[index]);
    const tendonRadius = rendering.tendon_radius_m;
    updateBelly(this.bellies[index].geometry, path, bellyArc, split.peakRadius, tendonRadius);
    const activation = Math.min(1, state.activation[index]);
    const active = activation > 0.025;
    const belly = this.bellies[index];
    const material = belly.material as THREE.MeshStandardMaterial;
    const tendon = this.tendons[index];
    const tendonMaterial = tendon.material as THREE.MeshStandardMaterial;
    if (selected) {
      material.color.copy(MUSCLE.relaxed).lerp(MUSCLE.active, activation);
      material.opacity = 1;
      material.transparent = false;
      material.depthWrite = true;
      tendonMaterial.color.copy(MUSCLE.selected);
      tendonMaterial.opacity = 1;
      tendonMaterial.transparent = false;
      tendonMaterial.depthWrite = true;
      updateBelly(this.outline.geometry, path, bellyArc, split.peakRadius + OUTLINE, tendonRadius + OUTLINE);
    } else {
      material.color.copy(active ? MUSCLE.relaxed : MUSCLE.context).lerp(MUSCLE.active, activation);
      material.opacity = active ? 0.45 + 0.4 * activation : CONTEXT_OPACITY.belly;
      material.transparent = true;
      material.depthWrite = false;
      tendonMaterial.color.copy(MUSCLE.tendon);
      tendonMaterial.opacity = active ? 0.75 : CONTEXT_OPACITY.tendon;
      tendonMaterial.transparent = true;
      tendonMaterial.depthWrite = false;
    }
    // Draw faint context last so it tints, rather than hides, the emphasized muscles.
    belly.renderOrder = selected ? 0 : active ? 1 : 2;
    tendon.renderOrder = belly.renderOrder;
    material.needsUpdate = true;
    tendonMaterial.needsUpdate = true;
    this.setSegments(tendon, path.tail(bellyArc), selected ? tendonRadius * 1.3 : tendonRadius);
  }

  /**
   * What the scene draws right now, read back from the Three.js objects, next to the snapshot it
   * was drawn from. The browser tests use this to check highlighting against simulation state.
   */
  describe() {
    const anatomical = this.view === 'anatomical';
    const matrix = new THREE.Matrix4();
    return {
      view: this.view,
      selected: this.selected,
      state: this.state,
      bones: this.bones.map(bone => bone.position.toArray()),
      muscles: this.model.actuators.map((actuator, index) => {
        const object = anatomical ? this.bellies[index] : this.paths[index];
        const material = object.material as THREE.MeshStandardMaterial;
        let firstSegment: number[] | null = null;
        if (!anatomical && this.paths[index].count > 0) {
          this.paths[index].getMatrixAt(0, matrix);
          firstSegment = new THREE.Vector3().setFromMatrixPosition(matrix).toArray();
        }
        const selected = index === this.selected;
        return {
          id: actuator.id,
          visible: object.visible,
          color: `#${material.color.getHexString()}`,
          opacity: material.opacity,
          outlined: selected && (anatomical ? this.outline.visible : this.selectedOutline.visible),
          firstSegment,
        };
      }),
    };
  }

  /** Current belly and tendon lengths (metres) for the anatomical view. */
  muscleSplit(index: number) { return this.split[index]; }

  setView(view: MuscleView) { this.view = view; if (this.state) this.update(this.state); }

  select(index: number) { this.selected = index; if (this.state) this.update(this.state); }
  showAll(show: boolean) { this.allPaths = show; if (this.state) this.update(this.state); }
  showBones(show: boolean) { this.bones.forEach(bone => { bone.visible = show; }); }

  frame(view: 'palm' | 'dorsal' | 'reset') {
    // The source model's forearm runs along X. Keep the fingertips at the top.
    this.camera.up.set(1, 0, 0);
    // Fit the model in whichever direction is tighter, so narrow phone views do not crop it.
    const halfVertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2);
    const halfTight = Math.min(halfVertical, halfVertical * this.camera.aspect);
    // On a phone-sized view the whole forearm leaves the hand tiny, so frame the hand and wrist.
    const compact = this.host.clientWidth < 600 || this.host.clientHeight < 420;
    const center = compact ? this.handCenter : this.center;
    const extent = compact ? this.handExtent * 1.15 : this.extent;
    const distance = extent / (2 * halfTight) * 1.1;
    const direction = view === 'dorsal' ? new THREE.Vector3(0.08, 1, 0.4) : new THREE.Vector3(0.08, -1, 0.4);
    this.camera.position.copy(center).addScaledVector(direction.normalize(), distance);
    this.controls.target.copy(center);
    this.controls.update();
  }
}

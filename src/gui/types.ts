export interface Actuator {
  id: string;
  name: string;
  group: string;
  function: string;
  origin: string;
  insertion: string;
  notes: string | string[];
}

export interface Joint {
  id: string;
  name: string;
  positive: string;
  negative: string;
  range: [number, number];
  axis: [number, number, number];
  passive_stiffness_nm_per_rad: number;
  passive_stiffness_basis: 'measured' | 'assumed' | 'none';
}

export interface MuscleRendering {
  architecture_id: string | null;
  reference_length_m: number;
  belly_rest_length_m: number;
  belly_basis: string;
  belly_source: string | null;
  volume_m3: number;
  volume_basis: string;
  volume_source: string | null;
  tendon_radius_m: number;
  origin_at_path_start: boolean;
}

export interface Model {
  actuators: Actuator[];
  rendering: MuscleRendering[];
  joints: Joint[];
  bones: { id: string; mesh_id: string }[];
  meshes: { id: string; vertices: number[]; faces: number[] }[];
  counts: { bones: number; dofs: number; actuators: number };
  limitations: string[];
}

export interface State {
  type: 'state';
  time: number;
  paused: boolean;
  excitation: number[];
  mtu_length: number[];
  activation: number[];
  force: number[];
  qpos: number[];
  qvel: number[];
  moment_arms: number[][];
  bone_positions: [number, number, number][];
  bone_quaternions: [number, number, number, number][];
  paths: [number, number, number][][];
}

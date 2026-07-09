/** Refraction shape matching the Practice eye components (od = right, os = left). */
export interface EyeSide {
  sph?: string;
  cyl?: string;
  axis?: string;
  add?: string;
  va?: string;
}

export interface EyeRefraction {
  od: EyeSide;
  os: EyeSide;
  pd?: string;
}

export interface EyeData {
  eye: unknown;
  eyeStates: Record<string, unknown>;
  treatmentEntries: unknown[];
  refraction: EyeRefraction | null;
  previousRefraction: EyeRefraction | null;
}

export const emptyRefraction = (): EyeRefraction => ({ od: {}, os: {}, pd: "" });

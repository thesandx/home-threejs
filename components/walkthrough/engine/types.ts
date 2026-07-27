/**
 * Runtime types produced by the builders and consumed by the controls and
 * interaction systems. Kept separate from the plan contracts in
 * `@/types/villa`, which describe *input* data rather than built objects.
 */

import type { Object3D, Vector3 } from 'three';

export type { Collider } from '@/types/villa';

/** A walkable horizontal surface. The controller snaps the player onto the
 *  highest surface beneath them, which is how floors and stair treads work. */
export interface FloorSurface {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

/** A hinged door the player can open. The pivot rotates about its local Y. */
export interface DoorHandle {
  pivot: Object3D;
  closedAngle: number;
  openAngle: number;
  /** Animation progress, 0 = closed, 1 = open. */
  progress: number;
  open: boolean;
  /** World-space position of the leaf centre, for proximity tests. */
  worldPosition: Vector3;
  label: string;
}

/** A togglable interior light group (fixture emissive + light source). */
export interface ToggleLight {
  object: Object3D;
  setOn(on: boolean): void;
  on: boolean;
}

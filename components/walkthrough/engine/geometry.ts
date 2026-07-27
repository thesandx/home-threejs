/**
 * Low-level geometry helpers.
 *
 * The whole house is built from boxes. To keep GPU memory flat we reuse a
 * single unit `BoxGeometry` and scale each mesh, rather than allocating a fresh
 * geometry per wall. That trades a little texture-density accuracy for a large
 * drop in buffer count — the right call for an architectural scene with
 * thousands of panels.
 */

import {
  BoxGeometry,
  CylinderGeometry,
  type Material,
  Mesh,
  type Object3D,
  SphereGeometry,
} from 'three';

/** Shared unit primitives, reused and scaled per instance to keep buffers flat. */
const UNIT_BOX = new BoxGeometry(1, 1, 1);
const UNIT_CYL = new CylinderGeometry(1, 1, 1, 20);
const UNIT_SPHERE = new SphereGeometry(1, 18, 12);

export interface BoxOptions {
  cast?: boolean;
  receive?: boolean;
}

/** A box of the given size centred at (x, y, z). Casts and receives by default. */
export function box(
  w: number,
  h: number,
  d: number,
  material: Material,
  x: number,
  y: number,
  z: number,
  opts: BoxOptions = {},
): Mesh {
  const mesh = new Mesh(UNIT_BOX, material);
  mesh.scale.set(Math.max(w, 1e-4), Math.max(h, 1e-4), Math.max(d, 1e-4));
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.cast ?? true;
  mesh.receiveShadow = opts.receive ?? true;
  return mesh;
}

/** A vertical cylinder of the given radius and height, centred at (x, y, z). */
export function cylinder(
  radius: number,
  height: number,
  material: Material,
  x: number,
  y: number,
  z: number,
  opts: BoxOptions = {},
): Mesh {
  const mesh = new Mesh(UNIT_CYL, material);
  mesh.scale.set(radius, Math.max(height, 1e-4), radius);
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.cast ?? true;
  mesh.receiveShadow = opts.receive ?? true;
  return mesh;
}

/** A sphere (or, when scaled, an ellipsoid) centred at (x, y, z). */
export function sphere(
  radius: number,
  material: Material,
  x: number,
  y: number,
  z: number,
  opts: BoxOptions = {},
): Mesh {
  const mesh = new Mesh(UNIT_SPHERE, material);
  mesh.scale.setScalar(Math.max(radius, 1e-4));
  mesh.position.set(x, y, z);
  mesh.castShadow = opts.cast ?? true;
  mesh.receiveShadow = opts.receive ?? true;
  return mesh;
}

/** Add several children to a parent and return the parent (fluent helper). */
export function addAll(parent: Object3D, children: Object3D[]): Object3D {
  for (const child of children) parent.add(child);
  return parent;
}

/**
 * Static geometry merging.
 *
 * The builders emit one mesh per wall panel, slab, tread, prop and plant —
 * clear to author, but thousands of draw calls to render. This pass bakes every
 * static mesh's world transform into its geometry and merges everything that
 * shares a material (and shadow/tag state) into a handful of large meshes,
 * cutting draw calls by ~100x. Objects tagged `userData.dynamic` (hinged doors,
 * the gate) are left untouched and reparented so they still animate.
 *
 * Tags used by the hide-roof / hide-walls toggles (`roof`, `exteriorWall`) are
 * preserved by bucketing on them, so those features keep working post-merge.
 */

import { type BufferGeometry, Group, type Material, Mesh, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

interface Bucket {
  material: Material;
  cast: boolean;
  roof: boolean;
  ext: boolean;
  geoms: BufferGeometry[];
}

export interface MergeResult {
  group: Group;
  disposables: BufferGeometry[];
}

/** Merge the static meshes of the given roots into one group of batched meshes. */
export function mergeStatic(roots: Object3D[]): MergeResult {
  const container = new Group();
  container.name = 'static-batched';
  const buckets = new Map<string, Bucket>();
  const dynamic: Object3D[] = [];

  const visit = (obj: Object3D): void => {
    for (const child of [...obj.children]) {
      if (child.userData.dynamic) {
        dynamic.push(child);
        continue;
      }
      const mesh = child as Mesh;
      if (mesh.isMesh && !Array.isArray(mesh.material)) {
        const material = mesh.material;
        const roof = child.userData.roof === true;
        const ext = child.userData.exteriorWall === true;
        const cast = mesh.castShadow;
        const key = `${material.uuid}|${cast ? 1 : 0}|${roof ? 1 : 0}|${ext ? 1 : 0}`;
        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { material, cast, roof, ext, geoms: [] };
          buckets.set(key, bucket);
        }
        const geo = mesh.geometry.clone();
        geo.applyMatrix4(mesh.matrixWorld);
        bucket.geoms.push(geo);
      } else {
        visit(child);
      }
    }
  };

  for (const root of roots) {
    root.updateMatrixWorld(true);
    visit(root);
  }

  const disposables: BufferGeometry[] = [];
  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geoms, false);
    for (const geo of bucket.geoms) geo.dispose();
    if (!merged) continue;
    const mesh = new Mesh(merged, bucket.material);
    mesh.castShadow = bucket.cast;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    if (bucket.roof) mesh.userData.roof = true;
    if (bucket.ext) mesh.userData.exteriorWall = true;
    container.add(mesh);
    disposables.push(merged);
  }

  // Reparent dynamic subtrees. Their source parents are untransformed (identity),
  // so moving them to the container preserves their world position.
  for (const node of dynamic) container.add(node);

  return { group: container, disposables };
}

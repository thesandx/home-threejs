/**
 * Scanned PBR texture sets.
 *
 * The procedural canvas textures give the scene structure, but they cannot
 * match the micro-detail of a real material scan — which is what separates a
 * surface that reads as rendered from one that reads as photographed. These are
 * CC0 scans from ambientCG, downloaded and compressed by
 * `scripts/fetch-textures.mjs` (see `public/textures/CREDITS.md`).
 *
 * Loading is deliberately non-blocking. The engine builds and starts with its
 * procedural materials already in place, and each scanned map is swapped in as
 * it arrives, so a slow network delays polish rather than the walkthrough
 * itself. If a file fails to load the procedural texture simply stays.
 */

import {
  type ColorSpace,
  LinearMipmapLinearFilter,
  type MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
} from 'three';

export type TextureSetName =
  'render' | 'wall' | 'teak' | 'paving' | 'concrete' | 'marble' | 'grass';

const BASE = '/textures';
const LINEAR = '' as ColorSpace; // normal and roughness maps are data, not colour

export interface ApplyOptions {
  /** Tiling repeat, in both axes. */
  repeat: number;
  /** Normal map strength. */
  normalScale?: number;
  /**
   * Tint multiplied over the scan's albedo. A scan is a neutral photograph of
   * the material, so the project's colour scheme has to be reapplied here —
   * otherwise every surface renders in the tone of whatever was scanned.
   */
  tint?: number;
}

/**
 * Loads the scanned sets and applies them to materials.
 *
 * One loader instance owns every texture it creates so the engine can dispose
 * them in one call alongside the procedural set.
 */
export class ScannedTextures {
  private readonly loader = new TextureLoader();
  private readonly cache = new Map<string, Texture>();
  private readonly created: Texture[] = [];
  private disposed = false;

  /**
   * A texture instance for one set, map kind and tiling repeat.
   *
   * Repeat lives on the Texture, not the material, so two materials sharing a
   * scan at different repeats need separate instances or the last one to be
   * configured silently wins for both. The file is fetched and decoded once and
   * clones share that `source`, so the extra instances cost no GPU memory.
   */
  private load(
    name: TextureSetName,
    kind: string,
    colorSpace: ColorSpace,
    repeat: number,
  ): Texture {
    const file = `${name}_${kind}`;
    const key = `${file}@${repeat}`;
    const hit = this.cache.get(key);
    if (hit) return hit;

    let base = this.cache.get(file);
    if (!base) {
      base = this.loader.load(`${BASE}/${file}.jpg`);
      base.colorSpace = colorSpace;
      base.wrapS = RepeatWrapping;
      base.wrapT = RepeatWrapping;
      base.anisotropy = 8;
      base.minFilter = LinearMipmapLinearFilter;
      this.cache.set(file, base);
      this.created.push(base);
    }

    const texture = base.clone();
    texture.repeat.set(repeat, repeat);
    texture.needsUpdate = true;
    this.cache.set(key, texture);
    this.created.push(texture);
    return texture;
  }

  /**
   * Swap a scanned set onto a material, replacing whatever procedural maps it
   * currently carries. The old maps stay owned by the material library, which
   * disposes them; this only detaches them.
   */
  apply(material: MeshStandardMaterial, name: TextureSetName, opts: ApplyOptions): void {
    if (this.disposed) return;
    const { repeat, normalScale = 1, tint } = opts;

    const color = this.load(name, 'color', SRGBColorSpace, repeat);
    const normal = this.load(name, 'normal', LINEAR, repeat);
    const rough = this.load(name, 'rough', LINEAR, repeat);

    material.map = color;
    material.normalMap = normal;
    material.normalScale.set(normalScale, normalScale);
    material.roughnessMap = rough;
    // The procedural texture carried the colour scheme in its own pixels; the
    // scan does not, so the tint is reapplied explicitly here.
    if (tint === undefined) material.color.setScalar(1);
    else material.color.setHex(tint);
    material.needsUpdate = true;
  }

  dispose(): void {
    this.disposed = true;
    for (const t of this.created) t.dispose();
    this.created.length = 0;
    this.cache.clear();
  }
}

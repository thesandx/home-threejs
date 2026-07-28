/**
 * Procedural textures, drawn on a 2D canvas at load time.
 *
 * The walkthrough ships no binary assets: every surface texture is generated in
 * the browser from a few noise and pattern primitives. This keeps the bundle
 * small, sidesteps DRACO/GLTF asset hosting, and still gives materials enough
 * grain to read as real under physically based lighting.
 *
 * All generators are pure apart from touching a canvas, and every returned
 * texture is tracked by the caller for disposal.
 */

import {
  CanvasTexture,
  ClampToEdgeWrapping,
  type ColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';

function createCanvas(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context unavailable — cannot generate textures');
  }
  return { canvas, ctx };
}

function finish(
  canvas: HTMLCanvasElement,
  repeat: number,
  colorSpace: ColorSpace = SRGBColorSpace,
): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = colorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Derive a tangent-space normal map from an albedo texture's luminance.
 *
 * Luminance stands in for height — for render, plaster, timber grain and grout
 * lines that holds well, because on all of them the dark pixels *are* the
 * recesses. A Sobel operator gives the surface gradient, which is packed into
 * RGB as the usual (x, y, z) normal. `strength` scales the relief.
 *
 * This is what lifts the materials out of looking painted-on: without a normal
 * map a wall is perfectly flat no matter how detailed its colour is.
 */
export function normalFromCanvas(
  source: HTMLCanvasElement,
  repeat: number,
  strength = 2.2,
): CanvasTexture {
  const size = source.width;
  const src = source.getContext('2d');
  const { canvas, ctx } = createCanvas(size);
  if (!src) return finish(canvas, repeat, NO_COLOR_SPACE);

  const data = src.getImageData(0, 0, size, size).data;
  const out = ctx.createImageData(size, size);
  const lum = (x: number, y: number): number => {
    // Wrap so the normal map tiles exactly like its albedo.
    const xi = ((x % size) + size) % size;
    const yi = ((y % size) + size) % size;
    const i = (yi * size + xi) * 4;
    return (0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!) / 255;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      // Sobel gradients.
      const dx =
        lum(x - 1, y - 1) +
        2 * lum(x - 1, y) +
        lum(x - 1, y + 1) -
        (lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1));
      const dy =
        lum(x - 1, y - 1) +
        2 * lum(x, y - 1) +
        lum(x + 1, y - 1) -
        (lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1));

      let nx = dx * strength;
      let ny = dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;

      const i = (y * size + x) * 4;
      out.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      out.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out.data[i + 2] = Math.round((nz / len) * 0.5 * 255 + 127);
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  // Normal maps are data, never colour — they must not be sRGB-decoded.
  return finish(canvas, repeat, NO_COLOR_SPACE);
}

/**
 * Derive a roughness map from an albedo texture: darker pixels (recesses,
 * grout, grain) read rougher, lighter ones smoother. Wired into the material's
 * green channel by three.js convention.
 */
export function roughnessFromCanvas(
  source: HTMLCanvasElement,
  repeat: number,
  min = 0.55,
  max = 1,
): CanvasTexture {
  const size = source.width;
  const src = source.getContext('2d');
  const { canvas, ctx } = createCanvas(size);
  if (!src) return finish(canvas, repeat, NO_COLOR_SPACE);

  const data = src.getImageData(0, 0, size, size).data;
  const out = ctx.createImageData(size, size);
  for (let i = 0; i < data.length; i += 4) {
    const l = (0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!) / 255;
    const r = Math.round((max - (max - min) * l) * 255);
    out.data[i] = r;
    out.data[i + 1] = r;
    out.data[i + 2] = r;
    out.data[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return finish(canvas, repeat, NO_COLOR_SPACE);
}

/** Linear (non-colour) space marker for data textures. */
const NO_COLOR_SPACE = '' as ColorSpace;

/**
 * A foliage card: a cluster of individual leaves drawn with a transparent
 * background, for crossed-plane vegetation.
 *
 * Sphere-cluster canopies are the loudest "this is CG" signal in an exterior
 * shot, because real foliage has a broken, see-through silhouette. Alpha cards
 * give that silhouette for two triangles apiece.
 */
export function foliageTexture(): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size);
  ctx.clearRect(0, 0, size, size);
  const rnd = mulberry32(64);

  const leaf = (cx: number, cy: number, len: number, angle: number, shade: number): void => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, -len, 0, len);
    const dark = `rgb(${Math.floor(28 + shade * 0.4)},${Math.floor(70 + shade)},${Math.floor(30 + shade * 0.5)})`;
    const light = `rgb(${Math.floor(58 + shade * 0.5)},${Math.floor(112 + shade)},${Math.floor(46 + shade * 0.6)})`;
    g.addColorStop(0, dark);
    g.addColorStop(0.5, light);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, len * 0.34, len, 0, 0, Math.PI * 2);
    ctx.fill();
    // Midrib.
    ctx.strokeStyle = 'rgba(20,50,22,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(0, len);
    ctx.stroke();
    ctx.restore();
  };

  // A rough radial spray of leaves, denser toward the middle.
  for (let i = 0; i < 130; i += 1) {
    const a = rnd() * Math.PI * 2;
    const r = Math.pow(rnd(), 0.65) * size * 0.46;
    const cx = size / 2 + Math.cos(a) * r;
    const cy = size / 2 + Math.sin(a) * r * 0.9;
    leaf(cx, cy, 12 + rnd() * 16, rnd() * Math.PI, rnd() * 60);
  }
  const tex = finish(canvas, 1);
  // A card is a single sprite, never a tile.
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  return tex;
}

/** Deterministic value noise so textures look identical between reloads. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(
  ctx: CanvasRenderingContext2D,
  size: number,
  count: number,
  seed: number,
  alpha: number,
  spread: number,
): void {
  const rnd = mulberry32(seed);
  for (let i = 0; i < count; i += 1) {
    const x = rnd() * size;
    const y = rnd() * size;
    const shade = Math.floor((rnd() - 0.5) * spread);
    ctx.fillStyle = `rgba(${128 + shade},${128 + shade},${128 + shade},${alpha})`;
    ctx.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

/** Fine-grained exterior render stucco (the elevation's cream walls). */
export function stuccoTexture(base: string, repeat: number): CanvasTexture {
  const size = 512;
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, 24000, 11, 0.06, 40);
  return finish(canvas, repeat);
}

/** Warm teak-style wood with vertical grain, for cladding and soffits. */
export function woodTexture(repeat: number, vertical = true): CanvasTexture {
  const size = 512;
  const { canvas, ctx } = createCanvas(size);
  const rnd = mulberry32(37);
  const planks = 6;
  const plankW = size / planks;
  for (let p = 0; p < planks; p += 1) {
    const tone = 92 + Math.floor(rnd() * 26);
    ctx.fillStyle = `rgb(${tone + 26},${Math.floor(tone * 0.62)},${Math.floor(tone * 0.34)})`;
    ctx.fillRect(p * plankW, 0, plankW, size);
    for (let g = 0; g < 60; g += 1) {
      const off = rnd();
      ctx.strokeStyle = `rgba(60,32,14,${0.05 + rnd() * 0.12})`;
      ctx.lineWidth = 0.5 + rnd();
      ctx.beginPath();
      ctx.moveTo(p * plankW + off * plankW, 0);
      ctx.bezierCurveTo(
        p * plankW + off * plankW + (rnd() - 0.5) * 12,
        size * 0.33,
        p * plankW + off * plankW + (rnd() - 0.5) * 12,
        size * 0.66,
        p * plankW + off * plankW + (rnd() - 0.5) * 8,
        size,
      );
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(30,16,6,0.25)';
    ctx.fillRect(p * plankW, 0, 1.5, size);
  }
  const tex = finish(canvas, repeat);
  if (!vertical) {
    tex.rotation = Math.PI / 2;
    tex.center.set(0.5, 0.5);
  }
  return tex;
}

/**
 * Terracotta decking slats with deep shadow gaps, for the projecting window
 * hoods and the balcony louvres. The gaps carry the read at distance, so they
 * are drawn hard-edged and dark rather than softly shaded.
 */
export function slatTexture(repeat: number, boards = 7): CanvasTexture {
  const size = 512;
  const { canvas, ctx } = createCanvas(size);
  const rnd = mulberry32(53);
  const h = size / boards;
  for (let i = 0; i < boards; i += 1) {
    const tone = 126 + Math.floor(rnd() * 26);
    ctx.fillStyle = `rgb(${tone + 44},${Math.floor(tone * 0.53)},${Math.floor(tone * 0.33)})`;
    ctx.fillRect(0, i * h, size, h);
    for (let g = 0; g < 26; g += 1) {
      ctx.strokeStyle = `rgba(70,32,14,${0.04 + rnd() * 0.09})`;
      ctx.lineWidth = 0.6 + rnd();
      const y = i * h + rnd() * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + (rnd() - 0.5) * 3);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(24,10,4,0.72)';
    ctx.fillRect(0, i * h, size, Math.max(2, h * 0.1));
  }
  return finish(canvas, repeat);
}

/** Polished marble with soft grey veins, for floors and the pooja platform. */
export function marbleTexture(repeat: number): CanvasTexture {
  const size = 512;
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = '#f3f1ec';
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(7);
  for (let v = 0; v < 22; v += 1) {
    ctx.strokeStyle = `rgba(150,150,158,${0.12 + rnd() * 0.16})`;
    ctx.lineWidth = 0.6 + rnd() * 1.6;
    ctx.beginPath();
    let x = rnd() * size;
    let y = 0;
    ctx.moveTo(x, y);
    while (y < size) {
      x += (rnd() - 0.5) * 60;
      y += 16 + rnd() * 24;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  speckle(ctx, size, 6000, 99, 0.03, 20);
  return finish(canvas, repeat);
}

/** Large-format matt floor tile with subtle grout lines, for interiors. */
export function tileTexture(base: string, grout: string, repeat: number): CanvasTexture {
  const size = 512;
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, 9000, 5, 0.04, 24);
  ctx.strokeStyle = grout;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size);
  return finish(canvas, repeat);
}

/** Mown lawn for the garden. */
export function grassTexture(repeat: number): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = '#4a7d3a';
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(21);
  for (let i = 0; i < 12000; i += 1) {
    const g = 90 + Math.floor(rnd() * 70);
    ctx.strokeStyle = `rgba(${Math.floor(g * 0.5)},${g},${Math.floor(g * 0.4)},0.5)`;
    ctx.beginPath();
    const x = rnd() * size;
    const y = rnd() * size;
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 3, y - 2 - rnd() * 3);
    ctx.stroke();
  }
  return finish(canvas, repeat);
}

/** Cast-in-place paving for the driveway and street. */
export function pavingTexture(base: string, repeat: number): CanvasTexture {
  const size = 256;
  const { canvas, ctx } = createCanvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  speckle(ctx, size, 5000, 3, 0.05, 30);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);
  return finish(canvas, repeat);
}

/** Convenience: mark a texture as linear (for non-colour data maps). */
export function asLinear(texture: Texture): Texture {
  texture.colorSpace = '' as ColorSpace;
  return texture;
}

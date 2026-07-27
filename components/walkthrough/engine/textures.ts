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

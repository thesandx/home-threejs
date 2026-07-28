/**
 * Floating dust motes.
 *
 * A single additive `Points` cloud drifting slowly through the house volume,
 * catching the light like dust in a sunbeam. It is one draw call and a few
 * hundred points — decorative atmosphere that degrades first under reduced
 * motion (the engine simply stops updating it, leaving a static field).
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Points,
  PointsMaterial,
} from 'three';

import type { Rect } from '@/types/villa';

function softSprite(): CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return new CanvasTexture(canvas);
}

export class Dust {
  readonly points: Points;
  private readonly velocities: Float32Array;
  private readonly geometry: BufferGeometry;
  private readonly material: PointsMaterial;
  private readonly sprite: CanvasTexture;
  private readonly minY = 0.3;
  private readonly maxY: number;

  constructor(bounds: Rect, height: number, count = 320) {
    this.maxY = height;
    const positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    const w = bounds.x1 - bounds.x0;
    const d = bounds.z1 - bounds.z0;
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = bounds.x0 + Math.random() * w;
      positions[i * 3 + 1] = this.minY + Math.random() * (height - this.minY);
      positions[i * 3 + 2] = bounds.z0 + Math.random() * d;
      this.velocities[i * 3] = (Math.random() - 0.5) * 0.04;
      this.velocities[i * 3 + 1] = 0.01 + Math.random() * 0.03;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
    }
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(positions, 3));
    this.geometry.boundingSphere = null;
    this.sprite = softSprite();
    this.material = new PointsMaterial({
      size: 0.05,
      map: this.sprite,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      sizeAttenuation: true,
      blending: AdditiveBlending,
      color: 0xfff2d8,
    });
    this.points = new Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'dust';
  }

  update(dt: number): void {
    const attr = this.geometry.getAttribute('position') as BufferAttribute;
    const pos = attr.array as Float32Array;
    for (let i = 0; i < pos.length; i += 3) {
      const ny = pos[i + 1]! + this.velocities[i + 1]! * dt;
      pos[i] = pos[i]! + this.velocities[i]! * dt;
      pos[i + 1] = ny > this.maxY ? this.minY : ny; // recycle upward drift
      pos[i + 2] = pos[i + 2]! + this.velocities[i + 2]! * dt;
    }
    attr.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.sprite.dispose();
  }
}

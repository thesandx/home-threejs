/**
 * Camera director for every non-walking view.
 *
 * The scene has a single perspective camera. In `first-person` mode the player
 * controller owns it; in every other mode this director owns it and either
 * lets the user orbit (OrbitControls) or animates a scripted move. Modes:
 *
 *   orbit      – drag to inspect the whole house
 *   top        – plan view from directly above
 *   street     – the front-elevation view from the road
 *   drone      – slow high orbit
 *   architect  – steady eye-level dolly across the front
 *   cinematic  – auto tour along a spline through the rooms
 */

import { CatmullRomCurve3, type PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type CameraMode =
  'first-person' | 'orbit' | 'top' | 'street' | 'drone' | 'architect' | 'cinematic';

export interface DirectorContext {
  center: Vector3;
  width: number;
  depth: number;
  height: number;
  frontZ: number;
  tourPoints: Vector3[];
}

export class CameraDirector {
  private readonly orbit: OrbitControls;
  private mode: CameraMode = 'first-person';
  private t = 0;
  private readonly tour: CatmullRomCurve3;
  private readonly tmp = new Vector3();
  private readonly look = new Vector3();

  constructor(
    private readonly camera: PerspectiveCamera,
    domElement: HTMLElement,
    private readonly ctx: DirectorContext,
  ) {
    this.orbit = new OrbitControls(camera, domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.06;
    this.orbit.maxPolarAngle = Math.PI * 0.495;
    this.orbit.minDistance = 6;
    this.orbit.maxDistance = 140;
    this.orbit.target.copy(ctx.center);
    this.orbit.enabled = false;
    const pts = ctx.tourPoints.length >= 2 ? ctx.tourPoints : [ctx.center.clone()];
    this.tour = new CatmullRomCurve3(pts, true, 'catmullrom', 0.4);
  }

  setMode(mode: CameraMode): void {
    this.mode = mode;
    this.orbit.enabled = false;
    const { center, width, depth, height, frontZ } = this.ctx;
    switch (mode) {
      case 'orbit':
        this.camera.position.set(center.x + width, height * 1.3, frontZ - depth * 0.7);
        this.orbit.target.copy(center);
        this.orbit.enabled = true;
        this.orbit.update();
        break;
      case 'top':
        this.camera.position.set(center.x, height + Math.max(width, depth) * 1.6, center.z + 0.01);
        this.camera.lookAt(center.x, 0, center.z);
        break;
      case 'street':
        this.camera.position.set(center.x + 2, 1.7, frontZ - 12);
        this.camera.lookAt(center.x, height * 0.42, center.z * 0.4);
        break;
      case 'drone':
      case 'architect':
      case 'cinematic':
        this.t = 0;
        break;
      case 'first-person':
        break;
      default:
        break;
    }
  }

  update(dt: number): void {
    switch (this.mode) {
      case 'orbit':
        this.orbit.update();
        break;
      case 'drone': {
        this.t += dt * 0.06;
        const r = Math.max(this.ctx.width, this.ctx.depth) * 1.15;
        const y = this.ctx.height * 1.6;
        this.camera.position.set(
          this.ctx.center.x + Math.cos(this.t) * r,
          y,
          this.ctx.center.z + Math.sin(this.t) * r,
        );
        this.camera.lookAt(this.ctx.center);
        break;
      }
      case 'architect': {
        this.t += dt * 0.05;
        const sweep = Math.sin(this.t) * this.ctx.width * 0.5;
        this.camera.position.set(this.ctx.center.x + sweep, 1.65, this.ctx.frontZ - 9);
        this.camera.lookAt(
          this.ctx.center.x - sweep * 0.4,
          this.ctx.height * 0.4,
          this.ctx.center.z,
        );
        break;
      }
      case 'cinematic': {
        this.t = (this.t + dt * 0.012) % 1;
        this.tour.getPointAt(this.t, this.tmp);
        this.tour.getPointAt((this.t + 0.01) % 1, this.look);
        this.camera.position.copy(this.tmp);
        this.camera.lookAt(this.look);
        break;
      }
      default:
        break;
    }
  }

  dispose(): void {
    this.orbit.dispose();
  }
}

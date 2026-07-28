/**
 * First-person player controller.
 *
 * PointerLockControls provides mouse-look and the pointer-lock lifecycle only.
 * Everything physical — walking, running, crouching, jumping, gravity, wall
 * collision and stair stepping — is handled here so it can respect the world's
 * colliders and walkable surfaces.
 *
 * The player is modelled as a vertical capsule: a circle of `RADIUS` in plan,
 * standing `height` tall. Horizontal collision resolves the circle out of every
 * axis-aligned wall box it overlaps; vertical motion snaps the feet onto the
 * highest floor surface within `STEP_UP`, which is what lets the same code walk
 * across a slab and climb a staircase.
 */

import { type PerspectiveCamera, Vector3 } from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

import type { Collider, FloorSurface } from '../types';

const RADIUS = 0.3;
const EYE = 1.7;
const CROUCH_EYE = 1.15;
const WALK = 3.4;
const RUN = 6.4;
const CROUCH = 1.7;
const GRAVITY = 18;
const JUMP = 6.2;
const STEP_UP = 0.42;
const ACCEL = 12;

export class FirstPersonControls {
  readonly pointerLock: PointerLockControls;
  private readonly feet = new Vector3();
  private readonly velocity = new Vector3();
  private readonly wish = new Vector3();
  private readonly forward = new Vector3();
  private readonly right = new Vector3();
  private readonly keys = new Set<string>();
  private verticalV = 0;
  private onGround = true;
  private crouching = false;
  private bob = 0;
  private bobEnabled = true;
  private strideAccum = 0;
  private stepReady = false;
  private enabled = true;

  constructor(
    private readonly camera: PerspectiveCamera,
    domElement: HTMLElement,
    private readonly colliders: Collider[],
    private readonly floors: FloorSurface[],
  ) {
    this.pointerLock = new PointerLockControls(camera, domElement);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  connect(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  disconnect(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
  }

  get locked(): boolean {
    return this.pointerLock.isLocked;
  }

  lock(): void {
    this.pointerLock.lock();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.keys.clear();
  }

  /** Teleport the player's feet to a world position (used by floor/lift jumps). */
  setPosition(x: number, y: number, z: number): void {
    this.feet.set(x, y, z);
    this.verticalV = 0;
    this.camera.position.set(x, y + EYE, z);
  }

  get position(): Vector3 {
    return this.feet;
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  update(dt: number): void {
    if (!this.enabled || !this.locked) return;
    const step = Math.min(dt, 0.05);

    this.camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-5) this.forward.set(0, 0, -1);
    this.forward.normalize();
    this.right.set(this.forward.z, 0, -this.forward.x);

    this.crouching = this.keys.has('KeyC') || this.keys.has('ControlLeft');
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = this.crouching ? CROUCH : running ? RUN : WALK;

    this.wish.set(0, 0, 0);
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.wish.add(this.forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.wish.sub(this.forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.wish.add(this.right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.wish.sub(this.right);
    const moving = this.wish.lengthSq() > 1e-4;
    if (moving) this.wish.normalize().multiplyScalar(speed);

    // Smooth horizontal acceleration toward the wish velocity.
    this.velocity.x += (this.wish.x - this.velocity.x) * Math.min(1, ACCEL * step);
    this.velocity.z += (this.wish.z - this.velocity.z) * Math.min(1, ACCEL * step);

    // Horizontal move, resolved per axis so sliding along walls feels natural.
    this.moveAxis('x', this.velocity.x * step);
    this.moveAxis('z', this.velocity.z * step);

    // Gravity + jump.
    if (this.keys.has('Space') && this.onGround && !this.crouching) {
      this.verticalV = JUMP;
      this.onGround = false;
    }
    this.verticalV -= GRAVITY * step;
    this.feet.y += this.verticalV * step;

    const ground = this.groundHeight(this.feet.x, this.feet.z, this.feet.y);
    if (this.feet.y <= ground) {
      this.feet.y = ground;
      this.verticalV = 0;
      this.onGround = true;
    } else {
      this.onGround = this.feet.y - ground < 0.02;
    }

    // Head bob while walking on the ground.
    const targetEye = this.crouching ? CROUCH_EYE : EYE;
    if (moving && this.onGround) {
      this.bob += step * speed * 1.9;
    } else {
      this.bob *= 0.85;
    }
    const bobY = this.bobEnabled ? Math.sin(this.bob * 2) * 0.035 * (this.onGround ? 1 : 0) : 0;
    this.camera.position.set(this.feet.x, this.feet.y + targetEye + bobY, this.feet.z);

    // Footstep signal: one step per stride length walked on the ground.
    const planar = Math.hypot(this.velocity.x, this.velocity.z);
    if (moving && this.onGround && planar > 0.4) {
      this.strideAccum += planar * step;
      const stride = this.crouching ? 0.55 : 0.72;
      if (this.strideAccum >= stride) {
        this.strideAccum = 0;
        this.stepReady = true;
      }
    } else {
      this.strideAccum = 0;
    }
  }

  /** True once per stride; consumed on read, so the caller triggers one sound. */
  consumeStep(): boolean {
    if (!this.stepReady) return false;
    this.stepReady = false;
    return true;
  }

  setBob(enabled: boolean): void {
    this.bobEnabled = enabled;
  }

  private moveAxis(axis: 'x' | 'z', delta: number): void {
    if (delta === 0) return;
    if (axis === 'x') this.feet.x += delta;
    else this.feet.z += delta;
    this.resolve(axis);
  }

  /** Push the player circle out of any wall box overlapping the given axis. */
  private resolve(axis: 'x' | 'z'): void {
    const headLow = this.feet.y + 0.2;
    const headHigh = this.feet.y + (this.crouching ? CROUCH_EYE : EYE) - 0.1;
    for (const c of this.colliders) {
      if (c.topY <= headLow || c.baseY >= headHigh) continue;
      const nearestX = Math.max(c.minX, Math.min(this.feet.x, c.maxX));
      const nearestZ = Math.max(c.minZ, Math.min(this.feet.z, c.maxZ));
      const dx = this.feet.x - nearestX;
      const dz = this.feet.z - nearestZ;
      if (dx * dx + dz * dz >= RADIUS * RADIUS) continue;
      // Overlapping: push out along the axis we just moved.
      if (axis === 'x') {
        this.feet.x = this.feet.x > (c.minX + c.maxX) / 2 ? c.maxX + RADIUS : c.minX - RADIUS;
      } else {
        this.feet.z = this.feet.z > (c.minZ + c.maxZ) / 2 ? c.maxZ + RADIUS : c.minZ - RADIUS;
      }
    }
  }

  private groundHeight(x: number, z: number, feetY: number): number {
    let best = -Infinity;
    const reach = feetY + STEP_UP;
    for (const f of this.floors) {
      if (x < f.minX - RADIUS || x > f.maxX + RADIUS) continue;
      if (z < f.minZ - RADIUS || z > f.maxZ + RADIUS) continue;
      if (f.y <= reach && f.y > best) best = f.y;
    }
    return best === -Infinity ? -50 : best;
  }
}

/**
 * The walkthrough engine.
 *
 * Owns the renderer, scene, camera and the whole simulation loop, and exposes a
 * small imperative API that the React layer drives (time of day, camera mode,
 * floor, hide roof/walls, interact, screenshot). Everything three.js lives
 * behind this class so the component never imports the library directly and the
 * bundle only loads it in the browser.
 */

import {
  ACESFilmicToneMapping,
  Clock,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';

import { CameraDirector, type CameraMode } from './controls/cameras';
import { FirstPersonControls } from './controls/firstPerson';
import { createEnvironmentMap } from './environment';
import { buildSite } from './exterior/site';
import { furnishHouse } from './furniture';
import { HouseBuilder } from './houseBuilder';
import { DoorSystem } from './interaction/doors';
import { Lighting } from './lighting';
import { MaterialLibrary } from './materials';
import { ENVELOPE, levelFloorY } from './plan';
import { PostFx } from './postfx';
import { Sky } from './sky';
import { TIME_ORDER, type TimeOfDayId } from './timeOfDay';
import type { Collider, DoorHandle, FloorSurface } from './types';

export interface WalkthroughState {
  ready: boolean;
  locked: boolean;
  mode: CameraMode;
  time: TimeOfDayId;
  floor: number;
  interiorOn: boolean;
  roofHidden: boolean;
  wallsHidden: boolean;
  fps: number;
}

export type StateListener = (state: WalkthroughState) => void;

export class WalkthroughEngine {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly clock = new Clock();
  private readonly sky = new Sky();
  private readonly lighting: Lighting;
  private readonly materials = new MaterialLibrary();
  private readonly fp: FirstPersonControls;
  private readonly director: CameraDirector;
  private readonly doors: DoorSystem;
  private readonly postfx: PostFx;
  private readonly spawns = new Map<number, Vector3>();

  private frameHandle = 0;
  private disposed = false;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private lastEmit = 0;
  private listener: StateListener | null = null;
  private readonly resizeObserver: ResizeObserver;
  private readonly focus = new Vector3();

  private state: WalkthroughState = {
    ready: false,
    locked: false,
    mode: 'first-person',
    time: 'afternoon',
    floor: 0,
    interiorOn: false,
    roofHidden: false,
    wallsHidden: false,
    fps: 0,
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.outputColorSpace = SRGBColorSpace;

    const { clientWidth: w, clientHeight: h } = canvas;
    this.camera = new PerspectiveCamera(62, w / Math.max(h, 1), 0.1, 1200);

    this.scene.environment = createEnvironmentMap(this.renderer);
    this.scene.environmentIntensity = 0.22;
    this.scene.add(this.sky.mesh);

    this.lighting = new Lighting(this.scene);

    // Build the world.
    const house = new HouseBuilder(this.materials).build();
    this.scene.add(house.group);
    this.scene.add(furnishHouse(this.materials, house.placedRooms));

    const site = buildSite(this.materials);
    this.scene.add(site.group);

    const colliders: Collider[] = [...house.colliders, ...site.colliders];
    const floors: FloorSurface[] = [...house.floors, ...site.floors];
    const allDoors: DoorHandle[] = [...house.doors, ...site.doors];

    this.lighting.createInteriorLights(house.placedRooms);
    for (const light of this.lighting.interiorLights) this.scene.add(light);

    // Per-floor spawn points at the central dining/hall of each level.
    for (let level = 0; level < ENVELOPE.levels; level += 1) {
      const dining = house.placedRooms.find(
        (p) => p.level === level && (p.room.kind === 'dining' || p.room.kind === 'hall'),
      );
      const c =
        dining?.center ?? new Vector3(ENVELOPE.width / 2, levelFloorY(level), ENVELOPE.depth / 2);
      this.spawns.set(level, new Vector3(c.x, levelFloorY(level), c.z));
    }

    this.fp = new FirstPersonControls(this.camera, canvas, colliders, floors);
    this.doors = new DoorSystem(allDoors);

    this.director = new CameraDirector(this.camera, canvas, {
      center: new Vector3(
        ENVELOPE.width / 2,
        (ENVELOPE.levels * ENVELOPE.levelHeight) / 2,
        ENVELOPE.depth / 2,
      ),
      width: ENVELOPE.width,
      depth: ENVELOPE.depth,
      height: ENVELOPE.levels * ENVELOPE.levelHeight,
      frontZ: -ENVELOPE.frontBalcony,
      tourPoints: this.buildTourPoints(house.placedRooms),
    });

    this.postfx = new PostFx(this.renderer, this.scene, this.camera, w, h);

    // Start the player just inside the front gate, looking at the house.
    this.fp.setPosition(ENVELOPE.width / 2, 0, -ENVELOPE.frontBalcony - 4);
    this.camera.lookAt(ENVELOPE.width / 2, 3, ENVELOPE.depth / 3);

    this.fp.connect();
    this.fp.pointerLock.addEventListener('lock', this.onLock);
    this.fp.pointerLock.addEventListener('unlock', this.onUnlock);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    this.setTime('afternoon');
    this.state.ready = true;
  }

  private buildTourPoints(
    rooms: { room: { kind: string }; center: Vector3; floorY: number; level: number }[],
  ): Vector3[] {
    const order = ['living', 'dining', 'kitchen', 'bedroom', 'pooja', 'balcony'];
    const pts: Vector3[] = [new Vector3(ENVELOPE.width / 2, 2, -ENVELOPE.frontBalcony - 7)];
    for (let level = 0; level < ENVELOPE.levels; level += 1) {
      for (const kind of order) {
        const r = rooms.find((p) => p.level === level && p.room.kind === kind);
        if (r) pts.push(new Vector3(r.center.x, r.floorY + 1.6, r.center.z));
      }
    }
    pts.push(
      new Vector3(
        ENVELOPE.width / 2,
        ENVELOPE.levels * ENVELOPE.levelHeight + 2,
        ENVELOPE.depth / 2,
      ),
    );
    return pts;
  }

  // --- Public API --------------------------------------------------------

  onState(listener: StateListener): void {
    this.listener = listener;
    listener({ ...this.state });
  }

  start(): void {
    const loop = (): void => {
      if (this.disposed) return;
      this.frameHandle = requestAnimationFrame(loop);
      this.tick();
    };
    this.frameHandle = requestAnimationFrame(loop);
  }

  enterFirstPerson(): void {
    this.setCameraMode('first-person');
    this.fp.lock();
  }

  setCameraMode(mode: CameraMode): void {
    this.state.mode = mode;
    if (mode === 'first-person') {
      this.fp.setEnabled(true);
      this.director.setMode('first-person');
    } else {
      this.fp.setEnabled(false);
      if (this.fp.locked) this.fp.pointerLock.unlock();
      this.postfx.setCamera(this.camera);
      this.director.setMode(mode);
    }
    this.emit();
  }

  setTime(time: TimeOfDayId): void {
    this.state.time = time;
    this.lighting.setTime(time);
    this.emit();
  }

  cycleTime(): void {
    const idx = TIME_ORDER.indexOf(this.state.time);
    const next = TIME_ORDER[(idx + 1) % TIME_ORDER.length] ?? 'afternoon';
    this.setTime(next);
  }

  goToFloor(level: number): void {
    const clamped = Math.max(0, Math.min(ENVELOPE.levels - 1, level));
    const spawn = this.spawns.get(clamped);
    if (spawn) this.fp.setPosition(spawn.x, spawn.y + 0.05, spawn.z);
    this.state.floor = clamped;
    if (this.state.mode !== 'first-person') this.setCameraMode('first-person');
    this.emit();
  }

  useLift(): void {
    this.goToFloor((this.state.floor + 1) % ENVELOPE.levels);
  }

  toggleRoof(): void {
    this.state.roofHidden = !this.state.roofHidden;
    this.scene.traverse((o) => {
      if (o.userData.roof) o.visible = !this.state.roofHidden;
    });
    this.emit();
  }

  toggleWalls(): void {
    this.state.wallsHidden = !this.state.wallsHidden;
    this.scene.traverse((o) => {
      if (o.userData.exteriorWall) o.visible = !this.state.wallsHidden;
    });
    this.emit();
  }

  toggleInterior(): void {
    this.state.interiorOn = !this.state.interiorOn;
    this.lighting.toggleInterior(this.state.interiorOn);
    this.emit();
  }

  interact(): void {
    this.doors.interact(this.fp.position);
  }

  screenshot(): string {
    this.postfx.render();
    return this.renderer.domElement.toDataURL('image/png');
  }

  setBloom(on: boolean): void {
    this.postfx.setBloom(on);
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    this.fp.disconnect();
    this.fp.pointerLock.removeEventListener('lock', this.onLock);
    this.fp.pointerLock.removeEventListener('unlock', this.onUnlock);
    this.director.dispose();
    this.postfx.dispose();
    this.lighting.dispose();
    this.materials.dispose();
    this.sky.dispose();
    this.renderer.dispose();
  }

  // --- Loop --------------------------------------------------------------

  private tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.state.mode === 'first-person') this.fp.update(dt);
    else this.director.update(dt);
    this.doors.update(dt);

    this.focus.copy(this.camera.position);
    this.focus.y = Math.max(0, this.focus.y - 1);
    this.lighting.update(dt, this.sky, this.renderer, this.scene, this.focus);

    this.postfx.render();

    // FPS, emitted at ~2 Hz.
    this.fpsAccum += dt;
    this.fpsFrames += 1;
    this.lastEmit += dt;
    if (this.lastEmit > 0.5) {
      this.state.fps = Math.round(this.fpsFrames / this.fpsAccum);
      this.state.locked = this.fp.locked;
      this.state.interiorOn = this.lighting.isInteriorOn;
      this.fpsAccum = 0;
      this.fpsFrames = 0;
      this.lastEmit = 0;
      this.emit();
    }
  }

  private resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.postfx.setSize(w, h);
  }

  private readonly onLock = (): void => {
    this.state.locked = true;
    this.emit();
  };

  private readonly onUnlock = (): void => {
    this.state.locked = false;
    this.emit();
  };

  private emit(): void {
    this.listener?.({ ...this.state });
  }
}

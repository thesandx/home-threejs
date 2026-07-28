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
  type BufferGeometry,
  Clock,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';

import { Soundscape } from './audio/soundscape';
import { CameraDirector, type CameraMode } from './controls/cameras';
import { FirstPersonControls } from './controls/firstPerson';
import { createEnvironmentMap } from './environment';
import { buildSite } from './exterior/site';
import { furnishHouse } from './furniture';
import { HouseBuilder } from './houseBuilder';
import { DoorSystem } from './interaction/doors';
import { Lighting } from './lighting';
import { MaterialLibrary } from './materials';
import { mergeStatic } from './merge';
import { ENVELOPE, levelFloorY } from './plan';
import { PostFx } from './postfx';
import { Sky } from './sky';
import { TIME_ORDER, type TimeOfDayId } from './timeOfDay';
import type { Collider, DoorHandle, FloorSurface } from './types';
import { Dust } from './vfx/dust';

export interface WalkthroughState {
  ready: boolean;
  locked: boolean;
  mode: CameraMode;
  time: TimeOfDayId;
  floor: number;
  interiorOn: boolean;
  roofHidden: boolean;
  wallsHidden: boolean;
  muted: boolean;
  fps: number;
}

export interface EngineOptions {
  /** Ambient hero mode: auto-cinematic, no pointer lock, no player controls. */
  ambient?: boolean;
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
  private readonly audio = new Soundscape();
  private readonly dust: Dust;
  private readonly spawns = new Map<number, Vector3>();
  private readonly ambient: boolean;
  private readonly reducedMotion: boolean;

  private frameHandle = 0;
  private disposed = false;
  private running = true;
  private onscreen = true;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private lastEmit = 0;
  private listener: StateListener | null = null;
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private readonly houseCenter = new Vector3(
    ENVELOPE.width / 2,
    (ENVELOPE.levels * ENVELOPE.levelHeight) / 2,
    ENVELOPE.depth / 2,
  );
  private mergedDisposables: BufferGeometry[] = [];

  private state: WalkthroughState = {
    ready: false,
    locked: false,
    mode: 'first-person',
    time: 'afternoon',
    floor: 0,
    interiorOn: false,
    roofHidden: false,
    wallsHidden: false,
    muted: false,
    fps: 0,
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: EngineOptions = {},
  ) {
    this.ambient = options.ambient ?? false;
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    // Cap at 1.5x device pixels: past that the extra fragments cost more than
    // they show on an already anti-aliased (SMAA) image.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    // The sun is fixed to the house, so shadows are static: render the shadow
    // map only when something changes (time of day, hidden walls), not per frame.
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.outputColorSpace = SRGBColorSpace;

    const { clientWidth: w, clientHeight: h } = canvas;
    this.camera = new PerspectiveCamera(62, w / Math.max(h, 1), 0.1, 1200);

    this.scene.environment = createEnvironmentMap(this.renderer);
    // Enough image-based fill that the deep balcony loggias and the stilt porch
    // read as shaded daylight rather than black holes.
    this.scene.environmentIntensity = 0.42;
    this.scene.add(this.sky.mesh);

    this.lighting = new Lighting(this.scene);

    // Build the world, then batch every static mesh by material so the whole
    // three-storey furnished house draws in a few dozen calls instead of
    // thousands. Hinged doors and the gate are tagged dynamic and stay separate.
    const house = new HouseBuilder(this.materials).build();
    const furniture = furnishHouse(this.materials, house.placedRooms);
    const site = buildSite(this.materials);
    const batched = mergeStatic([house.group, furniture, site.group]);
    this.scene.add(batched.group);
    this.mergedDisposables = batched.disposables;

    const colliders: Collider[] = [...house.colliders, ...site.colliders];
    const floors: FloorSurface[] = [...house.floors, ...site.floors];
    const allDoors: DoorHandle[] = [...house.doors, ...site.doors];

    this.lighting.createInteriorLights(house.placedRooms);
    for (const light of this.lighting.interiorLights) this.scene.add(light);

    // Atmospheric dust drifting through the house volume.
    this.dust = new Dust(
      { x0: 0, z0: 0, x1: ENVELOPE.width, z1: ENVELOPE.depth },
      ENVELOPE.levels * ENVELOPE.levelHeight,
    );
    this.scene.add(this.dust.points);

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

    // Head bob is motion; honour the OS reduced-motion preference.
    this.fp.setBob(!this.reducedMotion);

    // Start the player just inside the front gate, looking at the house.
    this.fp.setPosition(ENVELOPE.width / 2, 0, -ENVELOPE.frontBalcony - 4);
    this.camera.lookAt(ENVELOPE.width / 2, 3, ENVELOPE.depth / 3);

    this.fp.connect();
    this.fp.pointerLock.addEventListener('lock', this.onLock);
    this.fp.pointerLock.addEventListener('unlock', this.onUnlock);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    // Pause the loop when the tab is hidden or the canvas scrolls offscreen.
    document.addEventListener('visibilitychange', this.onVisibility);
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        this.onscreen = entries.some((e) => e.isIntersecting);
        this.syncRunning();
      },
      { threshold: 0.01 },
    );
    this.intersectionObserver.observe(canvas);

    this.setTime('afternoon');

    // Ambient hero: no player, a gentle scripted move (static under reduced motion).
    if (this.ambient) {
      this.setCameraMode(this.reducedMotion ? 'street' : 'cinematic');
    }
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
    this.running = true;
    this.frameHandle = requestAnimationFrame(this.loop);
  }

  private readonly loop = (): void => {
    if (this.disposed || !this.running) return;
    this.frameHandle = requestAnimationFrame(this.loop);
    this.tick();
  };

  /** Pause when the tab is hidden or the canvas is scrolled fully offscreen. */
  private syncRunning(): void {
    const shouldRun = !this.disposed && !document.hidden && this.onscreen;
    if (shouldRun && !this.running) {
      this.running = true;
      this.clock.getDelta(); // discard the idle gap so dt does not spike
      this.frameHandle = requestAnimationFrame(this.loop);
    } else if (!shouldRun && this.running) {
      this.running = false;
      cancelAnimationFrame(this.frameHandle);
    }
  }

  private readonly onVisibility = (): void => this.syncRunning();

  enterFirstPerson(): void {
    this.audio.resume(); // this call comes from a click — unlock audio here
    this.setCameraMode('first-person');
    this.fp.lock();
  }

  toggleMute(): void {
    this.state.muted = !this.state.muted;
    this.audio.setMuted(this.state.muted);
    this.emit();
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
    this.audio.setTime(time);
    this.renderer.shadowMap.needsUpdate = true; // sun angle changed
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
    this.renderer.shadowMap.needsUpdate = true;
    this.emit();
  }

  toggleWalls(): void {
    this.state.wallsHidden = !this.state.wallsHidden;
    this.scene.traverse((o) => {
      if (o.userData.exteriorWall) o.visible = !this.state.wallsHidden;
    });
    this.renderer.shadowMap.needsUpdate = true;
    this.emit();
  }

  toggleInterior(): void {
    this.state.interiorOn = !this.state.interiorOn;
    this.lighting.toggleInterior(this.state.interiorOn);
    this.emit();
  }

  interact(): void {
    const handle = this.doors.interact(this.fp.position);
    if (handle) {
      if (handle.label === 'Gate') this.audio.gate();
      else this.audio.door();
    }
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
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.fp.disconnect();
    this.fp.pointerLock.removeEventListener('lock', this.onLock);
    this.fp.pointerLock.removeEventListener('unlock', this.onUnlock);
    this.director.dispose();
    this.postfx.dispose();
    this.lighting.dispose();
    this.materials.dispose();
    this.sky.dispose();
    this.dust.dispose();
    this.audio.dispose();
    for (const geo of this.mergedDisposables) geo.dispose();
    this.mergedDisposables = [];
    this.renderer.dispose();
  }

  // --- Loop --------------------------------------------------------------

  private tick(): void {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (this.state.mode === 'first-person') {
      this.fp.update(dt);
      if (this.fp.consumeStep()) this.audio.footstep();
    } else {
      this.director.update(dt);
    }
    this.doors.update(dt);
    this.audio.update(dt);
    if (!this.reducedMotion) this.dust.update(dt);

    this.lighting.update(
      dt,
      this.sky,
      this.renderer,
      this.scene,
      this.houseCenter,
      this.camera.position,
    );

    // Renders the static shadow map only on frames where a change asked for it
    // (autoUpdate is off); the renderer clears needsUpdate itself afterwards.
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

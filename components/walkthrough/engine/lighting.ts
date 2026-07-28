/**
 * The lighting rig.
 *
 * One sun (directional, shadow-casting), a hemisphere fill for sky/ground
 * bounce, a low ambient floor, and a set of warm interior point lights that
 * come on for the darker presets. Switching time of day sets a *target*
 * preset; `update` eases the live values toward it every frame so the change
 * plays as a transition. The sun's shadow frustum follows the player so shadow
 * resolution is spent where the camera is.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PointLight,
  type Scene,
  type Vector3,
  type WebGLRenderer,
} from 'three';

import type { Sky } from './sky';
import { sunDirection, TIME_PRESETS, type TimeOfDayId, type TimeOfDayPreset } from './timeOfDay';

interface PlacedRoom {
  room: { kind: string; name: string };
  floorY: number;
  center: Vector3;
}

/** Hard cap on interior point lights shaded per frame — the ones nearest the
 *  camera win. Forward rendering cost scales with active lights, not total. */
const MAX_ACTIVE_LIGHTS = 6;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class Lighting {
  readonly sun = new DirectionalLight(0xffffff, 3);
  readonly hemi = new HemisphereLight(0xffffff, 0x8a7d68, 1);
  readonly ambient = new AmbientLight(0xffffff, 0.35);
  private readonly interior: PointLight[] = [];
  private readonly fog = new FogExp2(0xd4e6f4, 0.004);

  private readonly liveSky = new Color();
  private readonly liveGround = new Color();
  private readonly liveFog = new Color();
  private readonly liveTop = new Color();
  private readonly liveHorizon = new Color();
  private readonly liveBottom = new Color();
  private readonly liveSunColor = new Color();
  private liveHemi = 1;
  private liveAmbient = 0.35;
  private liveSunI = 3;
  private liveFogD = 0.004;
  private liveExposure = 1;
  private interiorOn = false;
  private interiorForced: boolean | null = null;

  private target: TimeOfDayPreset = TIME_PRESETS.afternoon;

  constructor(scene: Scene) {
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const cam = this.sun.shadow.camera;
    cam.near = 1;
    cam.far = 260;
    cam.left = -26;
    cam.right = 26;
    cam.top = 26;
    cam.bottom = -26;
    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.add(this.hemi);
    scene.add(this.ambient);
    scene.fog = this.fog;

    this.snapTo(TIME_PRESETS.afternoon);
  }

  /** Place one warm point light near the ceiling of each enclosed room. */
  createInteriorLights(rooms: PlacedRoom[]): void {
    const skip = new Set(['stair', 'lift', 'balcony', 'terrace']);
    for (const r of rooms) {
      if (skip.has(r.room.kind)) continue;
      const intensity = r.room.kind === 'living' || r.room.kind === 'dining' ? 14 : 8;
      const light = new PointLight(0xffd9a0, 0, 9, 2);
      light.position.set(r.center.x, r.floorY + 2.6, r.center.z);
      light.userData.baseIntensity = intensity;
      this.interior.push(light);
    }
    return;
  }

  get interiorLights(): PointLight[] {
    return this.interior;
  }

  setTime(id: TimeOfDayId): void {
    this.target = TIME_PRESETS[id];
    this.interiorForced = null;
  }

  toggleInterior(on: boolean): void {
    this.interiorForced = on;
  }

  private snapTo(p: TimeOfDayPreset): void {
    this.liveSunColor.copy(p.sunColor);
    this.liveSky.copy(p.hemiSky);
    this.liveGround.copy(p.hemiGround);
    this.liveFog.copy(p.fogColor);
    this.liveTop.copy(p.skyTop);
    this.liveHorizon.copy(p.skyHorizon);
    this.liveBottom.copy(p.skyBottom);
    this.liveHemi = p.hemiIntensity;
    this.liveAmbient = p.ambientIntensity;
    this.liveSunI = p.sunIntensity;
    this.liveFogD = p.fogDensity;
    this.liveExposure = p.exposure;
    this.interiorOn = p.interiorLights;
    this.target = p;
  }

  update(
    dt: number,
    sky: Sky,
    renderer: WebGLRenderer,
    scene: Scene,
    sunFocus: Vector3,
    cameraPos: Vector3,
  ): void {
    const k = Math.min(1, dt * 1.4);
    const p = this.target;
    this.liveSunColor.lerp(p.sunColor, k);
    this.liveSky.lerp(p.hemiSky, k);
    this.liveGround.lerp(p.hemiGround, k);
    this.liveFog.lerp(p.fogColor, k);
    this.liveTop.lerp(p.skyTop, k);
    this.liveHorizon.lerp(p.skyHorizon, k);
    this.liveBottom.lerp(p.skyBottom, k);
    this.liveHemi = lerp(this.liveHemi, p.hemiIntensity, k);
    this.liveAmbient = lerp(this.liveAmbient, p.ambientIntensity, k);
    this.liveSunI = lerp(this.liveSunI, p.sunIntensity, k);
    this.liveFogD = lerp(this.liveFogD, p.fogDensity, k);
    this.liveExposure = lerp(this.liveExposure, p.exposure, k);

    // Apply to lights.
    this.sun.color.copy(this.liveSunColor);
    this.sun.intensity = this.liveSunI;
    this.hemi.color.copy(this.liveSky);
    this.hemi.groundColor.copy(this.liveGround);
    this.hemi.intensity = this.liveHemi;
    this.ambient.intensity = this.liveAmbient;

    // Sun is anchored to the house centre, not the player, so its shadow map is
    // static and can be rendered once per time change instead of every frame.
    const d = sunDirection(p);
    this.sun.position.copy(sunFocus).addScaledVector(d, 120);
    this.sun.target.position.copy(sunFocus);

    // Sky + fog + exposure.
    sky.setGradient(this.liveTop, this.liveHorizon, this.liveBottom);
    sky.setSun(d, this.liveSunColor, this.target.id === 'night' ? 0.006 : 0.02);
    // Cloud cover by mood: heavy when raining, almost none at night.
    const cloud = p.id === 'rainy' ? 1.5 : p.id === 'night' ? 0.25 : 0.85;
    sky.setCloudCover(cloud);
    scene.background = this.liveFog;
    this.fog.color.copy(this.liveFog);
    this.fog.density = this.liveFogD;
    renderer.toneMappingExposure = this.liveExposure;

    // Interior fixtures: only the few nearest the camera stay active, so the
    // forward renderer never shades more than MAX_ACTIVE_LIGHTS point lights at
    // once regardless of how many rooms the house has.
    const wantOn = this.interiorForced ?? p.interiorLights;
    const targetK = Math.min(1, dt * 3);
    const nearest = this.interior
      .slice()
      .sort(
        (a, b) => a.position.distanceToSquared(cameraPos) - b.position.distanceToSquared(cameraPos),
      );
    for (const [i, light] of nearest.entries()) {
      const active = wantOn && i < MAX_ACTIVE_LIGHTS;
      light.visible = active;
      const base = (light.userData.baseIntensity as number | undefined) ?? 8;
      light.intensity = active ? lerp(light.intensity, base, targetK) : 0;
    }
    this.interiorOn = wantOn;
  }

  get isInteriorOn(): boolean {
    return this.interiorOn;
  }

  dispose(): void {
    for (const l of this.interior) l.dispose();
    this.interior.length = 0;
  }
}

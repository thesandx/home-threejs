/**
 * The lighting rig.
 *
 * One sun (directional, shadow-casting), two non-shadowing *indirect* lights
 * that stand in for global illumination, a hemisphere term, a very small
 * ambient floor, and a set of warm interior point lights that come on for the
 * darker presets. Switching time of day sets a *target* preset; `update` eases
 * the live values toward it every frame so the change plays as a transition.
 *
 * Three things here are load-bearing for realism, and each fixes a specific
 * failure the exterior render had:
 *
 * 1. **The shadow camera projection is committed.** `OrthographicCamera` caches
 *    its projection matrix; assigning `left/right/top/bottom` does nothing
 *    until `updateProjectionMatrix()` runs, and three.js never calls it for
 *    you. Without that one line the sun's shadow frustum stayed at its 10 x 10
 *    metre default while this file claimed 52 x 52, so in practice almost
 *    nothing in the scene cast a shadow — which is most of why the exterior
 *    looked flat and lifeless.
 *
 * 2. **Indirect light has direction.** Real shade is not a uniform grey lift.
 *    It is warm light bouncing up off the paving and cool light falling in from
 *    the sky, arriving from opposite hemispheres. `bounce` and `fill` model
 *    exactly that. Because they are directional they still shade form — a
 *    soffit, a reveal and a wall inside the same shadow take different values —
 *    where the large flat `AmbientLight` they replace erased form.
 *
 * 3. **Ambient colour comes from the actual sky.** `SkyEnvironment` re-renders
 *    and pre-filters the sky gradient into `scene.environment` whenever the
 *    live colours move, so the image-based fill always matches the sky overhead
 *    instead of a fixed grey studio box.
 *
 * The sun is anchored to the house, not the player, so the shadow map is static
 * and only re-renders when the time of day changes (see `Engine.setTime`).
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  PointLight,
  type Scene,
  Vector3,
  type WebGLRenderer,
} from 'three';

import type { SkyEnvironment } from './environment';
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

/**
 * Half-width of the sun's orthographic shadow frustum, in metres.
 *
 * The house envelope is about 10 x 13 m and 9 m tall, and the plot with its
 * compound wall and forecourt fits inside about 40 m. Sizing the box to that,
 * rather than the previous 52 m, spends far more of the map on the geometry
 * people actually look at. With the 4096 map below, one shadow texel covers
 * about 10 mm of wall — fine enough that a window reveal throws a crisp edge
 * instead of a soft grey smear.
 */
const SHADOW_EXTENT = 20;

/** Shadow map resolution. The map is static (re-rendered once per time change),
 *  so this costs one 4096 depth pass on a switch, not a per-frame budget. */
const SHADOW_MAP_SIZE = 4096;

/** Distance from the focus at which the sun is parked. */
const SUN_DISTANCE = 120;

/** Seconds between environment re-filters while a transition is easing. */
const ENV_INTERVAL = 0.2;

/** Colour grade handed to the post-processing chain each frame. */
export interface Grade {
  contrast: number;
  saturation: number;
  vignette: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Reference white, used to pull chroma out of the sky fill. */
const WHITE = new Color(0xffffff);

/** Perceptually irrelevant colour difference — under one 8-bit step. */
function colorClose(a: Color, b: Color): boolean {
  return Math.abs(a.r - b.r) < 0.004 && Math.abs(a.g - b.g) < 0.004 && Math.abs(a.b - b.b) < 0.004;
}

export class Lighting {
  readonly sun = new DirectionalLight(0xffffff, 3);
  /**
   * Ground bounce. Arrives from below, tinted by the paving, and lights every
   * downward-facing surface: the balcony plank soffits, the porch ceiling, the
   * underside of the projecting picture frame and the roof fascia.
   */
  readonly bounce = new DirectionalLight(0xd9c9a6, 0.35);
  /**
   * Sky fill from the anti-sun side. Cool, weak, and just enough to stop the
   * elevation facing away from the sun collapsing into one dead value.
   */
  readonly fill = new DirectionalLight(0xbcd6f0, 0.25);
  readonly hemi = new HemisphereLight(0xffffff, 0x8a7d68, 1);
  readonly ambient = new AmbientLight(0xffffff, 0.35);
  private readonly interior: PointLight[] = [];
  private readonly fog = new FogExp2(0xd4e6f4, 0.004);

  private readonly liveSky = new Color();
  private readonly liveGround = new Color();
  private readonly liveBounce = new Color();
  private readonly liveFog = new Color();
  private readonly liveTop = new Color();
  private readonly liveHorizon = new Color();
  private readonly liveBottom = new Color();
  private readonly liveSunColor = new Color();
  /** Scratch: the zenith colour as the environment dome sees it. */
  private readonly envTop = new Color();
  private liveHemi = 1;
  private liveAmbient = 0.35;
  private liveSunI = 3;
  private liveBounceI = 0.35;
  private liveFillI = 0.25;
  private liveEnvI = 0.7;
  private liveFogD = 0.004;
  private liveExposure = 1;
  private liveContrast = 1;
  private liveSaturation = 1;
  private liveVignette = 0.2;
  private interiorOn = false;
  private interiorForced: boolean | null = null;

  /** Scratch vectors, reused so the per-frame path allocates nothing. */
  private readonly scratchDir = new Vector3();
  private readonly scratchBounce = new Vector3();
  private readonly scratchFill = new Vector3();

  /**
   * Environment refresh bookkeeping. Re-filtering the sky costs a real PMREM
   * pass, so it runs on a fixed cadence while a transition eases and stops
   * entirely once the live colours have converged on the target.
   */
  private envCooldown = 0;
  private envDirty = true;

  private target: TimeOfDayPreset = TIME_PRESETS.afternoon;

  constructor(scene: Scene) {
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    // A tight depth range is what lets the small negative bias below work
    // without peter-panning. The sun sits SUN_DISTANCE away, and nothing on the
    // plot is more than about 40 m off the focus along the sun axis.
    const cam = this.sun.shadow.camera;
    cam.near = SUN_DISTANCE - 60;
    cam.far = SUN_DISTANCE + 80;
    cam.left = -SHADOW_EXTENT;
    cam.right = SHADOW_EXTENT;
    cam.top = SHADOW_EXTENT;
    cam.bottom = -SHADOW_EXTENT;
    // Without this the frustum above is inert — see the class comment.
    cam.updateProjectionMatrix();
    // With roughly 10 mm texels the constant bias can stay small; normalBias
    // does the work on grazing surfaces, where a constant bias either leaks
    // acne or detaches the shadow from the thing casting it.
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.normalBias = 0.022;

    // The indirect pair never casts shadows: they stand in for light that has
    // already bounced, so occlusion for them is GTAO's job, not a second and
    // third shadow map's.
    this.bounce.castShadow = false;
    this.fill.castShadow = false;

    scene.add(this.sun);
    scene.add(this.sun.target);
    scene.add(this.bounce);
    scene.add(this.bounce.target);
    scene.add(this.fill);
    scene.add(this.fill.target);
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

  /** The live colour grade, read by the post chain every frame. */
  get grade(): Grade {
    return {
      contrast: this.liveContrast,
      saturation: this.liveSaturation,
      vignette: this.liveVignette,
    };
  }

  setTime(id: TimeOfDayId): void {
    this.target = TIME_PRESETS[id];
    this.interiorForced = null;
    this.envDirty = true;
  }

  toggleInterior(on: boolean): void {
    this.interiorForced = on;
  }

  private snapTo(p: TimeOfDayPreset): void {
    this.liveSunColor.copy(p.sunColor);
    this.liveSky.copy(p.hemiSky);
    this.liveGround.copy(p.hemiGround);
    this.liveBounce.copy(p.bounceColor);
    this.liveFog.copy(p.fogColor);
    this.liveTop.copy(p.skyTop);
    this.liveHorizon.copy(p.skyHorizon);
    this.liveBottom.copy(p.skyBottom);
    this.liveHemi = p.hemiIntensity;
    this.liveAmbient = p.ambientIntensity;
    this.liveSunI = p.sunIntensity;
    this.liveBounceI = p.bounceIntensity;
    this.liveFillI = p.fillIntensity;
    this.liveEnvI = p.environmentIntensity;
    this.liveFogD = p.fogDensity;
    this.liveExposure = p.exposure;
    this.liveContrast = p.contrast;
    this.liveSaturation = p.saturation;
    this.liveVignette = p.vignette;
    this.interiorOn = p.interiorLights;
    this.target = p;
    this.envDirty = true;
  }

  update(
    dt: number,
    sky: Sky,
    env: SkyEnvironment,
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
    this.liveBounce.lerp(p.bounceColor, k);
    this.liveFog.lerp(p.fogColor, k);
    this.liveTop.lerp(p.skyTop, k);
    this.liveHorizon.lerp(p.skyHorizon, k);
    this.liveBottom.lerp(p.skyBottom, k);
    this.liveHemi = lerp(this.liveHemi, p.hemiIntensity, k);
    this.liveAmbient = lerp(this.liveAmbient, p.ambientIntensity, k);
    this.liveSunI = lerp(this.liveSunI, p.sunIntensity, k);
    this.liveBounceI = lerp(this.liveBounceI, p.bounceIntensity, k);
    this.liveFillI = lerp(this.liveFillI, p.fillIntensity, k);
    this.liveEnvI = lerp(this.liveEnvI, p.environmentIntensity, k);
    this.liveFogD = lerp(this.liveFogD, p.fogDensity, k);
    this.liveExposure = lerp(this.liveExposure, p.exposure, k);
    this.liveContrast = lerp(this.liveContrast, p.contrast, k);
    this.liveSaturation = lerp(this.liveSaturation, p.saturation, k);
    this.liveVignette = lerp(this.liveVignette, p.vignette, k);

    // Apply to lights.
    this.sun.color.copy(this.liveSunColor);
    this.sun.intensity = this.liveSunI;
    this.bounce.color.copy(this.liveBounce);
    this.bounce.intensity = this.liveBounceI;
    // The fill carries the sky's hue but only part of its chroma. At full
    // saturation it painted every shadow on the forecourt a hard cyan, which is
    // a stronger blue than skylight ever actually looks once the eye has
    // adapted to a sunlit scene.
    this.fill.color.copy(this.liveSky).lerp(WHITE, 0.45);
    this.fill.intensity = this.liveFillI;
    this.hemi.color.copy(this.liveSky);
    this.hemi.groundColor.copy(this.liveGround);
    this.hemi.intensity = this.liveHemi;
    this.ambient.intensity = this.liveAmbient;

    // Sun is anchored to the house centre, not the player, so its shadow map is
    // static and can be rendered once per time change instead of every frame.
    const d = this.scratchDir.copy(sunDirection(p));
    this.sun.position.copy(sunFocus).addScaledVector(d, SUN_DISTANCE);
    this.sun.target.position.copy(sunFocus);

    // Ground bounce: mostly from straight below, which is how a diffuse bounce
    // off a large flat forecourt actually arrives, tilted a little toward the
    // sun's mirror direction so the sunlit side of the house receives more of
    // it than the shaded side.
    this.scratchBounce.set(d.x * 0.45, -0.88, d.z * 0.45).normalize();
    this.bounce.position.copy(sunFocus).addScaledVector(this.scratchBounce, 60);
    this.bounce.target.position.copy(sunFocus);

    // Sky fill: opposite azimuth, raised enough to reach into the loggias.
    this.scratchFill.set(-d.x, 0.55, -d.z).normalize();
    this.fill.position.copy(sunFocus).addScaledVector(this.scratchFill, 60);
    this.fill.target.position.copy(sunFocus);

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
    scene.environmentIntensity = this.liveEnvI;

    this.refreshEnvironment(dt, env, scene, d);

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

  /**
   * Re-filter the sky into `scene.environment`, but only when it would change
   * the picture.
   *
   * A PMREM pass is far too expensive to run every frame, and pointless when
   * nothing moves. So: mark the environment dirty on a time change, refresh at
   * most every `ENV_INTERVAL` seconds while the eased colours are still
   * visibly travelling, then stop once they have converged.
   */
  private refreshEnvironment(dt: number, env: SkyEnvironment, scene: Scene, d: Vector3): void {
    this.envCooldown -= dt;
    const settled = this.settled();
    if (!this.envDirty && settled) return;
    if (this.envCooldown > 0) return;
    this.envCooldown = ENV_INTERVAL;
    // The sun's contribution is scaled by its own intensity, so night does not
    // get a bright specular sun blob reflected in the glazing.
    const sunEnergy = Math.max(0, this.liveSunI) * 1.8;
    // Pull the zenith part-way toward the horizon before filtering. A real sky
    // hemisphere is dominated, by solid angle, by the pale band near the
    // horizon, not by the saturated blue straight up; feeding the raw zenith
    // colour in painted every open-shade surface — the forecourt tiles most
    // obviously — a cyan that no photograph of this scene would show.
    this.envTop.copy(this.liveTop).lerp(this.liveHorizon, 0.4);
    scene.environment = env.refresh(
      this.envTop,
      this.liveHorizon,
      this.liveBounce,
      d,
      this.liveSunColor,
      sunEnergy,
    );
    if (settled) this.envDirty = false;
  }

  /** True once the eased values sit close enough to the target that another
   *  environment refresh would not be visible. */
  private settled(): boolean {
    const p = this.target;
    return (
      Math.abs(this.liveSunI - p.sunIntensity) < 0.02 &&
      colorClose(this.liveTop, p.skyTop) &&
      colorClose(this.liveHorizon, p.skyHorizon) &&
      colorClose(this.liveBounce, p.bounceColor) &&
      colorClose(this.liveSunColor, p.sunColor)
    );
  }

  get isInteriorOn(): boolean {
    return this.interiorOn;
  }

  dispose(): void {
    for (const l of this.interior) l.dispose();
    this.interior.length = 0;
  }
}

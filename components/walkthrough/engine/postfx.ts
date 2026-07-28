/**
 * Post-processing stack.
 *
 * RenderPass → GTAOPass → UnrealBloomPass → SMAA → OutputPass. The OutputPass
 * applies the ACES filmic tone map and sRGB conversion at the end of the chain
 * (the renderer's own tone mapping is left off so it is not applied twice).
 *
 * GTAO — ground-truth ambient occlusion — is the important one for an
 * architectural scene. A single directional light plus an environment map gives
 * no contact darkening, so every reveal, soffit, jamb and projection renders
 * flat and the image reads as CG. GTAO renders a depth/normal prepass and
 * darkens creases and contact points, which is what puts the window box
 * surrounds, balcony frames and porch soffit into real relief.
 *
 * Bloom stays subtle: enough for the sun disc and the warm fittings, not enough
 * to wash out the render.
 */

import { type Camera, type Scene, Vector2, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/** AO tuned in metres — the scene's unit — so the radius means something. */
const AO_PARAMETERS = {
  radius: 0.55,
  distanceExponent: 1.6,
  thickness: 0.6,
  scale: 1.0,
  samples: 16,
  distanceFallOff: 1.0,
  screenSpaceRadius: false,
} as const;

const DENOISE_PARAMETERS = {
  lumaPhi: 10,
  depthPhi: 2,
  normalPhi: 3,
  radius: 4,
  radiusExponent: 1,
  rings: 2,
  samples: 8,
} as const;

export class PostFx {
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly renderPass: RenderPass;
  private readonly gtaoPass: GTAOPass;
  private bloomEnabled = true;
  private aoEnabled = true;

  constructor(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    width: number,
    height: number,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.setSize(width, height);

    this.renderPass = new RenderPass(scene, camera);
    this.gtaoPass = new GTAOPass(scene, camera, width, height);
    this.gtaoPass.updateGtaoMaterial(AO_PARAMETERS);
    this.gtaoPass.updatePdMaterial(DENOISE_PARAMETERS);
    this.bloomPass = new UnrealBloomPass(new Vector2(width, height), 0.22, 0.5, 1.0);

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.gtaoPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());
  }

  setCamera(camera: Camera): void {
    this.renderPass.camera = camera;
    this.gtaoPass.camera = camera;
  }

  setBloom(enabled: boolean): void {
    this.bloomEnabled = enabled;
    this.bloomPass.enabled = enabled;
    this.bloomPass.strength = enabled ? 0.22 : 0;
  }

  get bloom(): boolean {
    return this.bloomEnabled;
  }

  /** AO is the most expensive pass here, so it is the first thing to drop. */
  setAmbientOcclusion(enabled: boolean): void {
    this.aoEnabled = enabled;
    this.gtaoPass.enabled = enabled;
  }

  get ambientOcclusion(): boolean {
    return this.aoEnabled;
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
    this.gtaoPass.setSize(width, height);
  }

  render(): void {
    this.composer.render();
  }

  dispose(): void {
    this.gtaoPass.dispose();
    this.composer.dispose();
  }
}

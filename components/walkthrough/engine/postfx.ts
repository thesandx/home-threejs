/**
 * Post-processing stack.
 *
 * RenderPass → UnrealBloomPass → SMAA → OutputPass. The OutputPass applies the
 * ACES filmic tone map and sRGB conversion at the end of the chain (the
 * renderer's own tone mapping is left off so it is not applied twice). Bloom is
 * kept subtle — enough to bloom the sun disc, window highlights and warm
 * fixtures without washing the interior out.
 */

import { type Camera, type Scene, Vector2, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export interface PostFxOptions {
  bloom: boolean;
}

export class PostFx {
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  private readonly renderPass: RenderPass;
  private bloomEnabled = true;

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
    this.bloomPass = new UnrealBloomPass(new Vector2(width, height), 0.22, 0.5, 1.0);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());
  }

  setCamera(camera: Camera): void {
    this.renderPass.camera = camera;
  }

  setBloom(enabled: boolean): void {
    this.bloomEnabled = enabled;
    this.bloomPass.enabled = enabled;
    this.bloomPass.strength = enabled ? 0.22 : 0;
  }

  get bloom(): boolean {
    return this.bloomEnabled;
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
  }

  render(): void {
    this.composer.render();
  }

  dispose(): void {
    this.composer.dispose();
  }
}

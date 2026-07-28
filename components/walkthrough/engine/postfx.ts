/**
 * Post-processing stack.
 *
 * RenderPass → GTAOPass → UnrealBloomPass → SMAA → OutputPass → GradePass. The
 * OutputPass applies the ACES filmic tone map and sRGB conversion at the end of
 * the chain (three.js skips tone mapping while rendering into a render target,
 * so it happens once, there, and not on every intermediate pass).
 *
 * The grade runs *after* OutputPass, on display-referred pixels, because that
 * is where a colour grade belongs: contrast and saturation are decisions about
 * the final print, not about scene radiance, and applying them in linear HDR
 * crushes or blows the image unpredictably depending on exposure. It is one
 * full-screen pass of roughly a dozen arithmetic instructions — by far the
 * cheapest thing in this chain, and a large part of what stops the render
 * reading as a flat untouched frame buffer.
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
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import type { Grade } from './lighting';

/**
 * The final colour grade.
 *
 * Four operations, in the order a colourist would apply them:
 *
 * - **Contrast** about 0.5 (mid grey on a display-referred image). An S-curve
 *   would be more filmic still, but a straight pivot keeps the cream stucco off
 *   the clipping point, and the ACES tone map upstream has already supplied the
 *   shoulder.
 * - **Saturation** against Rec. 709 luma, so pushing chroma does not also push
 *   brightness. A small lift is what separates the teak, the charcoal glazing
 *   and the cream render from each other instead of letting them all drift to
 *   the same beige.
 * - **Vignette**, a smooth radial falloff. Nothing else in this list says
 *   "photographed through a lens" as directly, and at these strengths (0.2-0.4)
 *   it is felt rather than seen.
 * - **Dither**, a sub-LSB ordered noise. Wide smooth gradients — this sky, and
 *   any large flat cream wall — band visibly in 8-bit output. One 255th of a
 *   step of noise breaks the banding for no perceptible cost.
 */
const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 1.15 },
    uSaturation: { value: 1.05 },
    uVignette: { value: 0.25 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uVignette;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 c = texel.rgb;

      c = (c - 0.5) * uContrast + 0.5;

      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(luma), c, uSaturation);

      // Radial falloff measured from the frame centre, aspect-agnostic so the
      // corners of a wide viewport darken the same amount as a square one.
      vec2 d = vUv - 0.5;
      float r = dot(d, d) * 2.0;
      c *= 1.0 - uVignette * smoothstep(0.15, 1.0, r);

      // Ordered sub-LSB dither against 8-bit banding in the sky gradient.
      float n = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
      c += (n - 0.5) / 255.0;

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), texel.a);
    }
  `,
} as const;

/** AO tuned in metres — the scene's unit — so the radius means something. */
const AO_PARAMETERS = {
  // Widened from 0.55 m and strengthened once the flat AmbientLight came out of
  // the rig. With a weak uniform term the occlusion had little to occlude, so a
  // gentle setting was all the image could take; now that shade is carried by
  // directional bounce and the sky environment, AO is what darkens the base of
  // the compound piers, the window jambs and the balcony reveals, and it can be
  // pushed to where those contacts actually read as contacts.
  radius: 0.7,
  distanceExponent: 1.6,
  thickness: 0.6,
  scale: 1.15,
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
  private readonly gradePass: ShaderPass;
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
    // ShaderPass clones the descriptor's uniforms, so GRADE_SHADER stays a
    // constant template and each PostFx owns its own uniform objects.
    this.gradePass = new ShaderPass(GRADE_SHADER);

    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.gtaoPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new SMAAPass());
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.gradePass);
  }

  /** Push the time-of-day colour grade. Called every frame; the values ease. */
  setGrade(grade: Grade): void {
    const u = this.gradePass.uniforms;
    if (u.uContrast) u.uContrast.value = grade.contrast;
    if (u.uSaturation) u.uSaturation.value = grade.saturation;
    if (u.uVignette) u.uVignette.value = grade.vignette;
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

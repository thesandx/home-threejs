/**
 * Image-based lighting, generated from the live sky.
 *
 * This is the scene's only source of *indirect* light, and it is the single
 * biggest lever on whether the render reads as a photograph or as CG.
 *
 * The previous implementation pre-filtered three.js's `RoomEnvironment` — a
 * neutral grey studio box. It gave materials something to reflect, but its
 * colour had nothing to do with the sky above the house, so every shaded
 * elevation, every balcony soffit and every window reveal was filled with the
 * same dead grey no matter whether the preset was noon, golden hour or night.
 * Real ambient light is the sky and the ground: a wall in shade is lit blue
 * from above and warm from the paving below, and that colour split is most of
 * what makes a shaded facade look outdoors.
 *
 * So this class renders a miniature of the actual sky — the same three-stop
 * gradient, the same sun direction, plus a ground hemisphere in the paving
 * colour — into a cube map, pre-filters it with the PMREM generator, and hands
 * the result to `scene.environment`. Change the time of day and the indirect
 * fill changes with it, for free, because it is derived from the same numbers
 * that drive the visible sky.
 *
 * Cost: one PMREM pass per refresh, not per frame. `Lighting` throttles refresh
 * while a time-of-day transition is easing and stops once the live values have
 * settled, so a static shot costs nothing at all.
 */

import {
  BackSide,
  Color,
  Mesh,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  type Texture,
  Uniform,
  Vector3,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';

/**
 * The environment dome shader.
 *
 * Deliberately simpler than the visible sky in `sky.ts`: no cloud fBm, because
 * the PMREM pre-filter blurs high-frequency detail away anyway, and a fat
 * low-frequency sun blob because the pre-filter needs energy spread over
 * several texels to produce a smooth specular highlight rather than one hot
 * pixel that aliases as the camera moves.
 */
const ENV_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ENV_FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunEnergy;

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 c;
    if (h > 0.0) {
      // Sky: horizon to zenith. The 0.45 exponent holds a broad bright band
      // just above the horizon, which is where most of the light that reaches
      // a vertical wall actually comes from.
      c = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.45));
    } else {
      // Ground: the paving/grass colour, fading toward the horizon haze. This
      // is the bounce term — it is what fills the balcony soffits and the
      // porch ceiling with warm light instead of leaving them near black.
      c = mix(uHorizon, uGround, clamp(-h * 3.0, 0.0, 1.0));
    }

    // A wide, soft sun. Energy rather than a hard disc: PMREM integrates this
    // into the low-roughness mips as the highlight on glass, steel and gloss.
    float d = max(dot(dir, normalize(uSunDir)), 0.0);
    c += uSunColor * pow(d, 260.0) * uSunEnergy;
    c += uSunColor * pow(d, 6.0) * uSunEnergy * 0.06;

    gl_FragColor = vec4(c, 1.0);
  }
`;

export class SkyEnvironment {
  private readonly pmrem: PMREMGenerator;
  private readonly scene = new Scene();
  private readonly material: ShaderMaterial;
  private readonly dome: Mesh;
  private target: WebGLRenderTarget | null = null;

  constructor(renderer: WebGLRenderer) {
    this.pmrem = new PMREMGenerator(renderer);
    // Compile up front so the first refresh does not stall the frame on shader
    // compilation right when the user switches time of day.
    this.pmrem.compileEquirectangularShader();

    this.material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uTop: new Uniform(new Color(0x3f7fd0)),
        uHorizon: new Uniform(new Color(0xbcd9f0)),
        uGround: new Uniform(new Color(0x9c9280)),
        uSunDir: new Uniform(new Vector3(0, 1, 0)),
        uSunColor: new Uniform(new Color(0xfff6ea)),
        uSunEnergy: new Uniform(6),
      },
      vertexShader: ENV_VERT,
      fragmentShader: ENV_FRAG,
    });
    // A coarse sphere is plenty: the gradient is evaluated per fragment and the
    // PMREM output is only a 256px cube face.
    this.dome = new Mesh(new SphereGeometry(10, 24, 12), this.material);
    this.scene.add(this.dome);
  }

  /**
   * Re-render and pre-filter the environment for the current sky colours.
   *
   * Returns the new texture. The caller assigns it to `scene.environment`; the
   * previous target is disposed here so repeated refreshes during a transition
   * do not leak GPU memory.
   */
  refresh(
    top: Color,
    horizon: Color,
    ground: Color,
    sunDir: Vector3,
    sunColor: Color,
    sunEnergy: number,
  ): Texture {
    const u = this.material.uniforms;
    if (u.uTop) (u.uTop.value as Color).copy(top);
    if (u.uHorizon) (u.uHorizon.value as Color).copy(horizon);
    if (u.uGround) (u.uGround.value as Color).copy(ground);
    if (u.uSunDir) (u.uSunDir.value as Vector3).copy(sunDir);
    if (u.uSunColor) (u.uSunColor.value as Color).copy(sunColor);
    if (u.uSunEnergy) u.uSunEnergy.value = sunEnergy;

    const previous = this.target;
    // Sigma 0: the dome is already smooth, and the PMREM roughness mip chain
    // supplies every blur level the materials sample.
    this.target = this.pmrem.fromScene(this.scene, 0);
    previous?.dispose();
    return this.target.texture;
  }

  dispose(): void {
    this.target?.dispose();
    this.target = null;
    this.dome.geometry.dispose();
    this.material.dispose();
    this.pmrem.dispose();
  }
}

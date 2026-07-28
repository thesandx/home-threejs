/**
 * Sky dome.
 *
 * A large back-faced sphere with a three-stop vertical gradient (zenith →
 * horizon → ground haze) plus a soft sun disc that tracks the light direction.
 * It is cheap, needs no HDR file, and drives believable ambient colour when fed
 * into the environment generator. Colours come from the active time-of-day
 * preset and are updated every frame during transitions.
 */

import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry, Uniform, Vector3 } from 'three';

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 world = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
    gl_Position.z = gl_Position.w; // force to far plane
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunSize;
  uniform float uCloud;

  // Cheap value-noise fBm, enough for soft cumulus banding.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;
    vec3 sky = h > 0.0
      ? mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.55))
      : mix(uHorizon, uBottom, clamp(-h * 2.0, 0.0, 1.0));

    // Clouds, projected onto the dome and faded out toward the horizon so the
    // banding never crawls up the skyline.
    if (h > 0.02) {
      vec2 uv = dir.xz / (h + 0.35) * 1.1;
      float c = fbm(uv * 1.6);
      c = smoothstep(0.52, 0.92, c) * smoothstep(0.02, 0.3, h) * uCloud;
      vec3 lit = mix(vec3(0.86, 0.88, 0.92), uSunColor, 0.25);
      sky = mix(sky, lit, clamp(c, 0.0, 1.0));
    }

    float d = max(dot(dir, normalize(uSunDir)), 0.0);
    float disc = smoothstep(1.0 - uSunSize, 1.0 - uSunSize * 0.25, d);
    float glow = pow(d, 90.0) * 0.6 + pow(d, 8.0) * 0.15;
    sky += uSunColor * (disc + glow);
    gl_FragColor = vec4(sky, 1.0);
  }
`;

export class Sky {
  readonly mesh: Mesh;
  private readonly material: ShaderMaterial;

  constructor(radius = 900) {
    this.material = new ShaderMaterial({
      side: BackSide,
      depthWrite: false,
      uniforms: {
        uTop: new Uniform(new Color(0x3f7fd0)),
        uHorizon: new Uniform(new Color(0xbcd9f0)),
        uBottom: new Uniform(new Color(0xe6eef4)),
        uSunDir: new Uniform(new Vector3(0, 1, 0)),
        uSunColor: new Uniform(new Color(0xfff6ea)),
        uSunSize: new Uniform(0.02),
        uCloud: new Uniform(0.85),
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    this.mesh = new Mesh(new SphereGeometry(radius, 32, 16), this.material);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
  }

  private uniform(name: string): Uniform {
    const u = this.material.uniforms[name];
    if (!u) throw new Error(`Sky uniform ${name} missing`);
    return u as Uniform;
  }

  setGradient(top: Color, horizon: Color, bottom: Color): void {
    (this.uniform('uTop').value as Color).copy(top);
    (this.uniform('uHorizon').value as Color).copy(horizon);
    (this.uniform('uBottom').value as Color).copy(bottom);
  }

  /** Cloud cover, 0 = clear. Overcast presets push this up. */
  setCloudCover(amount: number): void {
    this.uniform('uCloud').value = amount;
  }

  setSun(direction: Vector3, color: Color, size: number): void {
    (this.uniform('uSunDir').value as Vector3).copy(direction);
    (this.uniform('uSunColor').value as Color).copy(color);
    this.uniform('uSunSize').value = size;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

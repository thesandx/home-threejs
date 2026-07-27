/**
 * Image-based lighting.
 *
 * A neutral room environment, pre-filtered with a PMREM generator, provides the
 * soft reflections and indirect fill that make physically based materials read
 * as real — the "global illumination approximation" the brief asks for. It is
 * generated once on the GPU and assigned to `scene.environment`; individual
 * materials pick it up through their `envMap` slot automatically.
 */

import { PMREMGenerator, type Texture, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function createEnvironmentMap(renderer: WebGLRenderer): Texture {
  const pmrem = new PMREMGenerator(renderer);
  const envScene = new RoomEnvironment();
  const target = pmrem.fromScene(envScene, 0.04);
  pmrem.dispose();
  return target.texture;
}

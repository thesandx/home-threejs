/**
 * Time-of-day presets.
 *
 * Each preset is a complete lighting mood: sun direction and colour, sky
 * gradient, ambient fill, the indirect-bounce terms, fog, and the tone/colour
 * grade. The lighting rig (see `lighting.ts`) interpolates between the current
 * and target preset so switching modes reads as a smooth dawn-to-dusk
 * transition rather than a hard cut.
 *
 * Sun direction is authored as elevation and azimuth in degrees, which is how
 * an artist thinks about it, then converted to a unit vector.
 *
 * On the *energy budget*: an exterior daylight scene is dominated by one very
 * bright sun. Earlier revisions of this file spread the budget across a strong
 * ambient and hemisphere term, which lit the shaded elevations almost as much
 * as the sunlit ones — the classic "everything is the same cream value" CG
 * look. The numbers here deliberately push the ratio the other way: a stronger
 * sun, a much weaker uniform ambient, and the shade filled instead by the
 * sky-derived environment map and two directional bounce lights, which have
 * *direction* and *colour* and therefore still model form.
 */

import { Color, Vector3 } from 'three';

export type TimeOfDayId = 'morning' | 'afternoon' | 'golden' | 'evening' | 'night' | 'rainy';

export interface TimeOfDayPreset {
  id: TimeOfDayId;
  label: string;
  sunElevation: number;
  sunAzimuth: number;
  sunColor: Color;
  sunIntensity: number;
  skyTop: Color;
  skyHorizon: Color;
  skyBottom: Color;
  hemiSky: Color;
  hemiGround: Color;
  hemiIntensity: number;
  ambientIntensity: number;
  /**
   * Colour of the ground as the *environment map* sees it — the paving, apron
   * and grass averaged together. This is the light that bounces up into every
   * soffit, reveal and balcony ceiling, so it is authored per preset rather
   * than sampled: warm cream at noon, orange at golden hour, near black at
   * night.
   */
  bounceColor: Color;
  /** Strength of the upward ground-bounce directional light. */
  bounceIntensity: number;
  /** Strength of the cool sky fill opposite the sun. */
  fillIntensity: number;
  /** Multiplier on the sky-derived environment map. */
  environmentIntensity: number;
  fogColor: Color;
  fogDensity: number;
  exposure: number;
  /** Filmic contrast about mid grey. 1 = untouched. */
  contrast: number;
  /** Chroma multiplier applied after contrast. 1 = untouched. */
  saturation: number;
  /** Corner falloff, 0 = none. Sells the "lens" more than any other knob. */
  vignette: number;
  /** Auto-enable warm interior fixtures. */
  interiorLights: boolean;
}

function dir(elevationDeg: number, azimuthDeg: number): Vector3 {
  const el = (elevationDeg * Math.PI) / 180;
  const az = (azimuthDeg * Math.PI) / 180;
  return new Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  ).normalize();
}

export const TIME_PRESETS: Record<TimeOfDayId, TimeOfDayPreset> = {
  morning: {
    id: 'morning',
    label: 'Morning',
    sunElevation: 22,
    sunAzimuth: 95,
    sunColor: new Color(0xfff1dd),
    sunIntensity: 3.4,
    skyTop: new Color(0x4b81cf),
    skyHorizon: new Color(0xcfe3f2),
    skyBottom: new Color(0xe8eef2),
    hemiSky: new Color(0xbcd6f0),
    hemiGround: new Color(0x8a7d68),
    hemiIntensity: 0.24,
    ambientIntensity: 0.03,
    bounceColor: new Color(0xd8c9a8),
    bounceIntensity: 0.32,
    fillIntensity: 0.13,
    environmentIntensity: 0.46,
    fogColor: new Color(0xd6e4ef),
    fogDensity: 0.006,
    exposure: 0.72,
    contrast: 1.15,
    saturation: 1.04,
    vignette: 0.22,
    interiorLights: false,
  },
  afternoon: {
    id: 'afternoon',
    label: 'Afternoon',
    // Dropped from an almost-overhead 66 degrees. A high sun rakes nothing:
    // every vertical surface of the elevation received the same grazing
    // fraction of it, which is why the facade read as one flat cream value.
    // At 38 degrees the picture frame, fins and window boxes throw real
    // shadows across the wall behind them, and the late-afternoon warmth the
    // reference asks for lands on the front elevation.
    sunElevation: 38,
    sunAzimuth: 138,
    sunColor: new Color(0xffeed2),
    sunIntensity: 3.6,
    skyTop: new Color(0x2f74cc),
    skyHorizon: new Color(0xbcd9f0),
    skyBottom: new Color(0xe6eef4),
    hemiSky: new Color(0xaeccec),
    hemiGround: new Color(0x9a8a6c),
    hemiIntensity: 0.26,
    ambientIntensity: 0.03,
    bounceColor: new Color(0xdccfae),
    bounceIntensity: 0.34,
    fillIntensity: 0.13,
    environmentIntensity: 0.48,
    fogColor: new Color(0xd4e6f4),
    fogDensity: 0.0035,
    exposure: 0.68,
    contrast: 1.15,
    saturation: 1.02,
    vignette: 0.24,
    interiorLights: false,
  },
  golden: {
    id: 'golden',
    label: 'Golden Hour',
    sunElevation: 11,
    sunAzimuth: 246,
    sunColor: new Color(0xffb066),
    sunIntensity: 3.6,
    skyTop: new Color(0x39567e),
    skyHorizon: new Color(0xffb877),
    skyBottom: new Color(0xf6d3a3),
    hemiSky: new Color(0xf1b985),
    hemiGround: new Color(0x6b5540),
    hemiIntensity: 0.24,
    ambientIntensity: 0.03,
    bounceColor: new Color(0xd79758),
    bounceIntensity: 0.42,
    fillIntensity: 0.24,
    environmentIntensity: 0.5,
    fogColor: new Color(0xf0c79b),
    fogDensity: 0.007,
    exposure: 0.8,
    contrast: 1.16,
    saturation: 1.1,
    vignette: 0.3,
    interiorLights: true,
  },
  evening: {
    id: 'evening',
    label: 'Evening',
    sunElevation: -3,
    sunAzimuth: 260,
    sunColor: new Color(0xff8a52),
    sunIntensity: 1.1,
    skyTop: new Color(0x22314f),
    skyHorizon: new Color(0xc06a4f),
    skyBottom: new Color(0x6a4a52),
    hemiSky: new Color(0x5a6a8a),
    hemiGround: new Color(0x40382e),
    hemiIntensity: 0.32,
    ambientIntensity: 0.07,
    bounceColor: new Color(0x6b4a3e),
    bounceIntensity: 0.2,
    fillIntensity: 0.3,
    environmentIntensity: 0.85,
    fogColor: new Color(0x7a5560),
    fogDensity: 0.01,
    exposure: 0.95,
    contrast: 1.14,
    saturation: 1.08,
    vignette: 0.34,
    interiorLights: true,
  },
  night: {
    id: 'night',
    label: 'Night',
    sunElevation: 42,
    sunAzimuth: 300,
    sunColor: new Color(0x9fb6e0),
    sunIntensity: 0.22,
    skyTop: new Color(0x070b18),
    skyHorizon: new Color(0x162138),
    skyBottom: new Color(0x1b2236),
    hemiSky: new Color(0x243049),
    hemiGround: new Color(0x0c0f18),
    hemiIntensity: 0.22,
    ambientIntensity: 0.06,
    bounceColor: new Color(0x141a28),
    bounceIntensity: 0.12,
    fillIntensity: 0.1,
    environmentIntensity: 1.0,
    fogColor: new Color(0x0d1424),
    fogDensity: 0.012,
    exposure: 1.15,
    contrast: 1.1,
    saturation: 1.0,
    vignette: 0.4,
    interiorLights: true,
  },
  rainy: {
    id: 'rainy',
    label: 'Rainy',
    // Overcast is the one preset where a large uniform ambient is *correct*:
    // the whole sky dome is the light source, so shadows nearly vanish and the
    // sky-derived environment map carries almost the entire image.
    sunElevation: 40,
    sunAzimuth: 170,
    sunColor: new Color(0xc7cdd4),
    sunIntensity: 0.7,
    skyTop: new Color(0x6b7480),
    skyHorizon: new Color(0x9aa2ab),
    skyBottom: new Color(0xb0b6bc),
    hemiSky: new Color(0x9aa4b0),
    hemiGround: new Color(0x5c5f63),
    hemiIntensity: 0.5,
    ambientIntensity: 0.12,
    bounceColor: new Color(0x6e7175),
    bounceIntensity: 0.22,
    fillIntensity: 0.2,
    environmentIntensity: 1.0,
    fogColor: new Color(0x9aa2ab),
    fogDensity: 0.02,
    exposure: 0.86,
    contrast: 1.08,
    saturation: 0.92,
    vignette: 0.3,
    interiorLights: true,
  },
};

export const TIME_ORDER: TimeOfDayId[] = [
  'morning',
  'afternoon',
  'golden',
  'evening',
  'night',
  'rainy',
];

/** Unit direction from the ground toward the sun for a preset. */
export function sunDirection(preset: TimeOfDayPreset): Vector3 {
  return dir(preset.sunElevation, preset.sunAzimuth);
}

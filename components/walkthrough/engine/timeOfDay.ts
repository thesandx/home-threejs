/**
 * Time-of-day presets.
 *
 * Each preset is a complete lighting mood: sun direction and colour, sky
 * gradient, ambient fill, fog, tone-mapping exposure, and whether interior
 * lights should come on automatically. The lighting rig (see `lighting.ts`)
 * interpolates between the current and target preset so switching modes reads
 * as a smooth dawn-to-dusk transition rather than a hard cut.
 *
 * Sun direction is authored as elevation and azimuth in degrees, which is how
 * an artist thinks about it, then converted to a unit vector. Intensities are
 * tuned for ACES tone mapping — kept low enough that white render walls hold
 * detail instead of clipping.
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
  fogColor: Color;
  fogDensity: number;
  exposure: number;
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
    sunIntensity: 1.9,
    skyTop: new Color(0x5b8fd6),
    skyHorizon: new Color(0xcfe3f2),
    skyBottom: new Color(0xe8eef2),
    hemiSky: new Color(0xbcd6f0),
    hemiGround: new Color(0x8a7d68),
    hemiIntensity: 0.55,
    ambientIntensity: 0.22,
    fogColor: new Color(0xd6e4ef),
    fogDensity: 0.006,
    exposure: 0.82,
    interiorLights: false,
  },
  afternoon: {
    id: 'afternoon',
    label: 'Afternoon',
    sunElevation: 66,
    sunAzimuth: 150,
    sunColor: new Color(0xfff6ea),
    sunIntensity: 2.3,
    skyTop: new Color(0x3f7fd0),
    skyHorizon: new Color(0xbcd9f0),
    skyBottom: new Color(0xe6eef4),
    hemiSky: new Color(0xaeccec),
    hemiGround: new Color(0x8f8368),
    hemiIntensity: 0.58,
    ambientIntensity: 0.24,
    fogColor: new Color(0xd4e6f4),
    fogDensity: 0.004,
    exposure: 0.78,
    interiorLights: false,
  },
  golden: {
    id: 'golden',
    label: 'Golden Hour',
    sunElevation: 9,
    sunAzimuth: 246,
    sunColor: new Color(0xffb066),
    sunIntensity: 2.2,
    skyTop: new Color(0x39567e),
    skyHorizon: new Color(0xffb877),
    skyBottom: new Color(0xf6d3a3),
    hemiSky: new Color(0xf1b985),
    hemiGround: new Color(0x6b5540),
    hemiIntensity: 0.5,
    ambientIntensity: 0.22,
    fogColor: new Color(0xf0c79b),
    fogDensity: 0.007,
    exposure: 0.96,
    interiorLights: true,
  },
  evening: {
    id: 'evening',
    label: 'Evening',
    sunElevation: -3,
    sunAzimuth: 260,
    sunColor: new Color(0xff8a52),
    sunIntensity: 0.9,
    skyTop: new Color(0x22314f),
    skyHorizon: new Color(0xc06a4f),
    skyBottom: new Color(0x6a4a52),
    hemiSky: new Color(0x5a6a8a),
    hemiGround: new Color(0x40382e),
    hemiIntensity: 0.42,
    ambientIntensity: 0.2,
    fogColor: new Color(0x7a5560),
    fogDensity: 0.01,
    exposure: 1.0,
    interiorLights: true,
  },
  night: {
    id: 'night',
    label: 'Night',
    sunElevation: 42,
    sunAzimuth: 300,
    sunColor: new Color(0x9fb6e0),
    sunIntensity: 0.18,
    skyTop: new Color(0x070b18),
    skyHorizon: new Color(0x162138),
    skyBottom: new Color(0x1b2236),
    hemiSky: new Color(0x243049),
    hemiGround: new Color(0x0c0f18),
    hemiIntensity: 0.24,
    ambientIntensity: 0.1,
    fogColor: new Color(0x0d1424),
    fogDensity: 0.012,
    exposure: 1.12,
    interiorLights: true,
  },
  rainy: {
    id: 'rainy',
    label: 'Rainy',
    sunElevation: 40,
    sunAzimuth: 170,
    sunColor: new Color(0xc7cdd4),
    sunIntensity: 0.6,
    skyTop: new Color(0x6b7480),
    skyHorizon: new Color(0x9aa2ab),
    skyBottom: new Color(0xb0b6bc),
    hemiSky: new Color(0x9aa4b0),
    hemiGround: new Color(0x5c5f63),
    hemiIntensity: 0.6,
    ambientIntensity: 0.3,
    fogColor: new Color(0x9aa2ab),
    fogDensity: 0.02,
    exposure: 0.88,
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

/**
 * The 3BHK floor plan, transcribed from the drawing.
 *
 * This is the "First Floor Plan (3BHK)" from the supplied reference: a 32'-0"
 * wide envelope with a front balcony (32' x 8'), a rear balcony (32' x 5'6"),
 * and a repeated residential level stacked three times to match the three-storey
 * front elevation. Room rectangles tile the plan without overlap; walls are
 * derived from their shared edges (see `houseBuilder.ts`), so this file only
 * declares *rooms* and *openings*, never individual wall panels.
 *
 * Positions are authored in feet for direct comparison with the drawing, then
 * converted to metres. Do not invent rooms — every entry here maps to a labelled
 * space on the plan.
 */

import type { LevelPlan, OpeningSpec, Room } from '@/types/villa';

import { ft } from './units';

/** Interior width of the envelope (the drawing's 32'-0" dimension). */
const WIDTH_FT = 32;
/** Interior depth of the main floor, front wall to rear wall. */
const DEPTH_FT = 44;
/** Balcony depths, projecting in front of and behind the main envelope. */
const FRONT_BALCONY_FT = 8;
const REAR_BALCONY_FT = 5.5;
/** Storey clear height (10'-0" typical). */
const LEVEL_HEIGHT_FT = 10;

/** Legend — door and window sizes (feet). */
const DOOR = { w: 3.5, h: 7 } as const; // D
const DOOR1 = { w: 3, h: 7 } as const; // D1
const DOOR2 = { w: 2.5, h: 7 } as const; // D2
const WIN1 = { w: 6, h: 4, sill: 2.5 } as const; // W1
const WIN2 = { w: 4, h: 4, sill: 2.5 } as const; // W2
const WIN3 = { w: 3, h: 4, sill: 3.5 } as const; // W3 (high toilet window)

interface RoomFt {
  id: string;
  name: string;
  kind: Room['kind'];
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/**
 * Room footprints in feet. z = 0 is the front (street) face of the main
 * envelope; balconies extend to negative z (front) and beyond DEPTH_FT (rear).
 */
const ROOMS_FT: RoomFt[] = [
  // Front band
  { id: 'living', name: 'Living Room', kind: 'living', x0: 0, z0: 0, x1: 19, z1: 13 },
  { id: 'guest', name: 'Guest Bed Room', kind: 'bedroom', x0: 19, z0: 0, x1: 32, z1: 8.5 },
  { id: 'utility', name: 'Utility', kind: 'utility', x0: 22, z0: 8.5, x1: 32, z1: 13 },
  { id: 'foyer', name: 'Foyer', kind: 'hall', x0: 19, z0: 8.5, x1: 22, z1: 13 },
  // Middle band
  { id: 'wc-common', name: 'Common Toilet', kind: 'bathroom', x0: 0, z0: 13, x1: 8, z1: 18 },
  { id: 'dining', name: 'Dining Area', kind: 'dining', x0: 11, z0: 13, x1: 22, z1: 29 },
  { id: 'kitchen', name: 'Kitchen', kind: 'kitchen', x0: 22, z0: 13, x1: 32, z1: 24 },
  { id: 'lift', name: 'Lift', kind: 'lift', x0: 0, z0: 18, x1: 5, z1: 23 },
  { id: 'stair', name: 'Staircase', kind: 'stair', x0: 5, z0: 18, x1: 11, z1: 29 },
  { id: 'hall', name: 'Hall', kind: 'hall', x0: 8, z0: 13, x1: 11, z1: 18 },
  { id: 'wc-master', name: 'Att. Toilet', kind: 'bathroom', x0: 0, z0: 24, x1: 8, z1: 29 },
  { id: 'wc-bed2', name: 'Att. Toilet', kind: 'bathroom', x0: 22, z0: 24, x1: 32, z1: 29 },
  // Rear band
  { id: 'master', name: 'Master Bed Room', kind: 'bedroom', x0: 0, z0: 29, x1: 14, z1: 44 },
  { id: 'pooja', name: 'Pooja', kind: 'pooja', x0: 14, z0: 38, x1: 19, z1: 44 },
  { id: 'rear-hall', name: 'Rear Passage', kind: 'hall', x0: 14, z0: 29, x1: 19, z1: 38 },
  { id: 'bed2', name: 'Bed Room 2', kind: 'bedroom', x0: 19, z0: 29, x1: 32, z1: 44 },
  // Balconies
  {
    id: 'balcony-front',
    name: 'Front Balcony',
    kind: 'balcony',
    x0: 0,
    z0: -FRONT_BALCONY_FT,
    x1: 32,
    z1: 0,
  },
  {
    id: 'balcony-rear',
    name: 'Rear Balcony',
    kind: 'balcony',
    x0: 0,
    z0: 44,
    x1: 32,
    z1: 44 + REAR_BALCONY_FT,
  },
];

interface OpeningFt {
  kind: OpeningSpec['kind'];
  x: number;
  z: number;
  size: { w: number; h: number; sill?: number };
}

/**
 * Openings, placed by world point (feet). Each lands on whichever wall segment
 * passes through it. Doors match the plan's D/D1/D2 leaves; windows match
 * W1/W2/W3 and always sit on an exterior wall.
 */
const OPENINGS_FT: OpeningFt[] = [
  // Main entrance and living connections
  { kind: 'door', x: 9.5, z: 0, size: DOOR1 }, // front door to balcony/entry
  { kind: 'archway', x: 9.5, z: 13, size: { w: 6, h: 7.5 } }, // living → dining
  { kind: 'door', x: 19, z: 4, size: DOOR1 }, // living → guest bed
  // Dining hub
  { kind: 'archway', x: 22, z: 20, size: { w: 4, h: 7.5 } }, // dining → kitchen
  { kind: 'door', x: 14, z: 34, size: DOOR }, // dining/hall → master approach
  { kind: 'door', x: 19, z: 34, size: DOOR }, // hall → bed2
  { kind: 'door', x: 16.5, z: 38, size: DOOR }, // hall → pooja
  // Bedrooms to rear balcony
  { kind: 'door', x: 7, z: 44, size: DOOR1 }, // master → rear balcony
  { kind: 'door', x: 25, z: 44, size: DOOR1 }, // bed2 → rear balcony
  // Bathrooms and service
  { kind: 'door', x: 8, z: 15.5, size: DOOR2 }, // common toilet
  { kind: 'door', x: 8, z: 26.5, size: DOOR2 }, // master att. toilet
  { kind: 'door', x: 22, z: 26.5, size: DOOR2 }, // bed2 att. toilet
  { kind: 'door', x: 22, z: 10.5, size: DOOR2 }, // utility
  // Exterior windows (front, facing balcony)
  { kind: 'window', x: 6, z: 0, size: WIN1 }, // living
  { kind: 'window', x: 26, z: 0, size: WIN1 }, // guest bed
  // Exterior windows (rear, facing balcony)
  { kind: 'window', x: 7, z: 44, size: WIN2 }, // master
  { kind: 'window', x: 25, z: 44, size: WIN2 }, // bed2
  // Exterior windows (sides)
  { kind: 'window', x: 0, z: 36, size: WIN2 }, // master side
  { kind: 'window', x: 32, z: 36, size: WIN2 }, // bed2 side
  { kind: 'window', x: 32, z: 4, size: WIN2 }, // guest side
  { kind: 'window', x: 0, z: 15.5, size: WIN3 }, // common toilet
  { kind: 'window', x: 0, z: 26.5, size: WIN3 }, // master toilet
  { kind: 'window', x: 32, z: 26.5, size: WIN3 }, // bed2 toilet
  { kind: 'window', x: 32, z: 18, size: WIN3 }, // kitchen
  { kind: 'window', x: 32, z: 10.5, size: WIN3 }, // utility
];

function buildRooms(): Room[] {
  return ROOMS_FT.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind,
    rect: { x0: ft(r.x0), z0: ft(r.z0), x1: ft(r.x1), z1: ft(r.z1) },
  }));
}

function buildOpenings(): OpeningSpec[] {
  return OPENINGS_FT.map((o) => ({
    kind: o.kind,
    x: ft(o.x),
    z: ft(o.z),
    width: ft(o.size.w),
    height: ft(o.size.h),
    sill: ft(o.size.sill ?? 0),
  }));
}

/** The residential level, repeated on every floor. */
export const LEVEL: LevelPlan = {
  rooms: buildRooms(),
  openings: buildOpenings(),
  bounds: {
    x0: 0,
    z0: ft(-FRONT_BALCONY_FT),
    x1: ft(WIDTH_FT),
    z1: ft(DEPTH_FT + REAR_BALCONY_FT),
  },
  wallHeight: ft(LEVEL_HEIGHT_FT),
};

/** Metric envelope constants other systems (site, cameras) reuse. */
export const ENVELOPE = {
  width: ft(WIDTH_FT),
  depth: ft(DEPTH_FT),
  frontBalcony: ft(FRONT_BALCONY_FT),
  rearBalcony: ft(REAR_BALCONY_FT),
  levelHeight: ft(LEVEL_HEIGHT_FT),
  /** Number of stacked residential levels (ground, first, second). */
  levels: 3,
  /** Slab thickness between levels. */
  slab: ft(0.6),
} as const;

/** Y of the finished floor for a level index (0 = ground). */
export function levelFloorY(level: number): number {
  return level * ENVELOPE.levelHeight;
}

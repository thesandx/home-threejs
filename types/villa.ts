/**
 * Shared contracts for the villa walkthrough.
 *
 * The floor plan is the source of truth. Every measurement in the drawing is
 * imperial (feet and inches); it is converted to metres once, at the edge, by
 * the helpers in `components/walkthrough/engine/units.ts`. Everything below the
 * data layer works in metres so Three.js maths stays in one unit.
 *
 * Coordinate convention (plan space, right-handed, metres):
 *   x → increases to the plan's right (east side of the drawing)
 *   z → increases from the front/street (z = 0) toward the rear (z = +depth)
 *   y → height above the floor slab of the current level
 */

/** An axis-aligned room footprint in plan space (metres). */
export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** The functional role of a room. Drives materials, furniture and lighting. */
export type RoomKind =
  | 'living'
  | 'dining'
  | 'kitchen'
  | 'bedroom'
  | 'bathroom'
  | 'pooja'
  | 'utility'
  | 'lift'
  | 'stair'
  | 'balcony'
  | 'hall'
  | 'terrace';

/** A single room read off the floor plan. */
export interface Room {
  id: string;
  name: string;
  kind: RoomKind;
  rect: Rect;
}

/** What an opening in a wall represents. */
export type OpeningKind = 'door' | 'window' | 'archway';

/**
 * An opening placed by its world position rather than by an offset along a
 * specific wall. The wall builder projects the point onto whichever wall
 * segment passes through it, then punches the hole. This keeps the plan data
 * declarative: move a door by moving its point, not by re-indexing walls.
 */
export interface OpeningSpec {
  kind: OpeningKind;
  /** Plan-space position of the opening centre (metres). */
  x: number;
  z: number;
  /** Clear width of the opening (metres). */
  width: number;
  /** Clear height of the opening (metres). */
  height: number;
  /** Sill height above the floor (metres). Zero for doors and archways. */
  sill: number;
}

/** A straight, axis-aligned wall segment (metres). Endpoints share x or z. */
export interface WallSpec {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  exterior: boolean;
}

/** An axis-aligned solid volume used for player collision (plan space, metres). */
export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Floor-relative base and top of the collider (metres). */
  baseY: number;
  topY: number;
}

/** The complete plan for one repeated residential level. */
export interface LevelPlan {
  rooms: Room[];
  openings: OpeningSpec[];
  /** Overall built envelope including balconies (metres). */
  bounds: Rect;
  /** Interior clear height of the level (metres). */
  wallHeight: number;
}

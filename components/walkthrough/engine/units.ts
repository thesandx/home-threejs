/**
 * Imperial → metric conversion, applied once at the data edge.
 *
 * The architectural drawing is dimensioned in feet and inches. Three.js has no
 * unit, but treating one Three.js unit as one metre keeps physics (gravity,
 * eye height, walk speed) in familiar numbers. Convert here, never in geometry.
 */

/** Metres per foot. */
export const FOOT = 0.3048;

/** Convert feet to metres. */
export function ft(feet: number): number {
  return feet * FOOT;
}

/** Convert feet and inches to metres. */
export function ftIn(feet: number, inches: number): number {
  return (feet + inches / 12) * FOOT;
}

/**
 * The site: everything outside the shell.
 *
 * Ground plane and lawn, the compound (boundary wall + sliding metal gate),
 * the paved driveway and public street, garden planting, and the front-facade
 * accents that give the house its elevation character — the vertical teak
 * cladding tower, the white frame around the stacked balconies, and the
 * entrance canopy. Returns walkable ground, boundary colliders, and the two
 * gate leaves so the door system can open them.
 */

import { Group, Vector3 } from 'three';

import { box, card, cylinder } from '../geometry';
import type { MaterialLibrary } from '../materials';
import { ENVELOPE } from '../plan';
import type { Collider, DoorHandle, FloorSurface } from '../types';
import { buildFacadeDetail } from './facade';

export interface SiteBuild {
  group: Group;
  floors: FloorSurface[];
  colliders: Collider[];
  doors: DoorHandle[];
}

const FRONT_YARD = 5.5;
const SIDE_YARD = 3.0;
const BACK_YARD = 3.0;

export function buildSite(m: MaterialLibrary): SiteBuild {
  const group = new Group();
  group.name = 'site';
  const floors: FloorSurface[] = [];
  const colliders: Collider[] = [];
  const doors: DoorHandle[] = [];

  const W = ENVELOPE.width;
  const D = ENVELOPE.depth;
  const frontZ = -ENVELOPE.frontBalcony;
  const rearZ = D + ENVELOPE.rearBalcony;

  const xL = -SIDE_YARD;
  const xR = W + SIDE_YARD;
  const zFront = frontZ - FRONT_YARD;
  const zBack = rearZ + BACK_YARD;

  // Ground: lawn across the whole plot, then paved driveway and street on top.
  group.add(
    box(
      xR - xL + 16,
      0.1,
      zBack - zFront + 40,
      m.grass,
      (xL + xR) / 2,
      -0.05,
      (zFront + zBack) / 2 - 6,
      { cast: false },
    ),
  );
  floors.push({ minX: xL - 8, maxX: xR + 8, minZ: zFront - 24, maxZ: zBack, y: 0 });

  // Driveway from the gate to the porch.
  group.add(
    box(
      5,
      0.06,
      FRONT_YARD + ENVELOPE.frontBalcony + 0.5,
      m.pavingTile,
      W / 2,
      0.01,
      (zFront + frontZ) / 2,
      { cast: false },
    ),
  );
  // Large-format beige tile forecourt across the frontage, from the compound
  // wall out to the kerb — the elevation shows paving here, never lawn.
  group.add(box(70, 0.05, 4.4, m.pavingTile, W / 2, 0.015, zFront - 2.2, { cast: false }));
  // Kerb upstand at the road edge.
  group.add(box(70, 0.16, 0.22, m.parapet, W / 2, 0.08, zFront - 4.4, { cast: false }));
  // Street beyond the boundary.
  group.add(box(60, 0.04, 9, m.street, W / 2, -0.02, zFront - 6.5, { cast: false }));
  group.add(box(60, 0.05, 0.2, m.paint(0xdadad0), W / 2, 0.02, zFront - 2.2, { cast: false }));

  buildCompound(group, colliders, doors, m, { xL, xR, zFront, W });
  buildGarden(group, m, { xL, xR, zFront, zBack, W, D });
  buildFacade(group, m, W);
  buildNeighbours(group, m, { xL, xR, zFront, W, D });

  return { group, floors, colliders, doors };
}

interface CompoundCtx {
  xL: number;
  xR: number;
  zFront: number;
  W: number;
}

function buildCompound(
  group: Group,
  colliders: Collider[],
  doors: DoorHandle[],
  m: MaterialLibrary,
  ctx: CompoundCtx,
): void {
  const { xL, xR, zFront, W } = ctx;
  const H = 1.8;
  const T = 0.2;
  const gateW = 5;
  const zBack =
    ctx.zFront +
    FRONT_YARD +
    ENVELOPE.frontBalcony +
    ENVELOPE.depth +
    ENVELOPE.rearBalcony +
    BACK_YARD;

  /**
   * A compound-wall run, built the way the real one is: square white piers at
   * regular centres with recessed tan infill panels between them, a flat coping,
   * and an urn lamp finial on each pier.
   */
  const wall = (minX: number, maxX: number, minZ: number, maxZ: number): void => {
    const alongX = maxX - minX > maxZ - minZ;
    const length = alongX ? maxX - minX : maxZ - minZ;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const thick = alongX ? maxZ - minZ : maxX - minX;

    // Recessed tan infill, slightly thinner than the piers.
    group.add(
      box(
        alongX ? length : thick * 0.6,
        H - 0.25,
        alongX ? thick * 0.6 : length,
        m.facadeTan,
        cx,
        (H - 0.25) / 2,
        cz,
      ),
    );
    // Coping over the whole run.
    group.add(
      box(
        alongX ? length : thick + 0.08,
        0.12,
        alongX ? thick + 0.08 : length,
        m.facadeWhite,
        cx,
        H - 0.19,
        cz,
      ),
    );

    // Piers at ~1.5 m centres, as built — closely spaced enough that the wall
    // reads as pier-and-panel rather than one long slab.
    const piers = Math.max(2, Math.round(length / 1.5));
    for (let i = 0; i <= piers; i += 1) {
      const t = i / piers;
      const px = alongX ? minX + t * length : cx;
      const pz = alongX ? cz : minZ + t * length;
      // Slim white pier with a flat projecting cap, as drawn — no finials.
      group.add(box(0.3, H + 0.28, thick + 0.16, m.facadeWhite, px, (H + 0.28) / 2, pz));
      group.add(box(0.42, 0.09, thick + 0.3, m.facadeWhite, px, H + 0.33, pz));
    }
    colliders.push({ minX, maxX, minZ, maxZ, baseY: 0, topY: H });
  };

  // Front wall, split for the gate opening.
  wall(xL, W / 2 - gateW / 2, zFront - T, zFront);
  wall(W / 2 + gateW / 2, xR, zFront - T, zFront);
  // Side and back walls.
  wall(xL - T, xL, zFront, zBack);
  wall(xR, xR + T, zFront, zBack);
  wall(xL, xR, zBack, zBack + T);

  // Gate piers: plain white with a flat cap, matching the boundary piers.
  for (const px of [W / 2 - gateW / 2, W / 2 + gateW / 2]) {
    group.add(box(0.42, 2.25, 0.46, m.facadeWhite, px, 1.125, zFront - T / 2));
    group.add(box(0.54, 0.1, 0.58, m.facadeWhite, px, 2.3, zFront - T / 2));
  }

  // A teak panel with a downlight above it, set into the wall left of the gate.
  const panelX = W / 2 - gateW / 2 - 1.15;
  group.add(box(0.55, 0.95, 0.08, m.teak, panelX, 1.0, zFront - T - 0.04));
  group.add(box(0.16, 0.3, 0.12, m.charcoal, panelX, 1.62, zFront - T - 0.06, { cast: false }));
  group.add(box(0.1, 0.06, 0.08, m.downlight, panelX, 1.46, zFront - T - 0.06, { cast: false }));

  // Two charcoal gate leaves: a band of horizontal slats above a field of
  // close-spaced vertical bars — the pattern drawn on the elevation.
  for (const side of [-1, 1] as const) {
    const pivot = new Group();
    pivot.userData.dynamic = true;
    const hingeX = W / 2 + (side * gateW) / 2;
    pivot.position.set(hingeX, 0, zFront - T / 2);
    const leafW = gateW / 2 - 0.08;
    const dirX = -side; // the leaf extends toward the opening
    const midX = (dirX * leafW) / 2;
    const gateH = 2.0;
    const splitY = gateH * 0.62; // slats above, bars below
    const leaf = new Group();

    // Outer frame.
    leaf.add(box(leafW, 0.08, 0.08, m.charcoal, midX, 0.04, 0));
    leaf.add(box(leafW, 0.08, 0.08, m.charcoal, midX, gateH, 0));
    leaf.add(box(0.08, gateH, 0.08, m.charcoal, dirX * 0.04, gateH / 2, 0));
    leaf.add(box(0.08, gateH, 0.08, m.charcoal, dirX * (leafW - 0.04), gateH / 2, 0));
    leaf.add(box(leafW, 0.07, 0.07, m.charcoal, midX, splitY, 0));

    // Horizontal slat band across the top.
    const slats = 5;
    for (let i = 0; i < slats; i += 1) {
      const sy = splitY + 0.12 + (i * (gateH - splitY - 0.2)) / slats;
      leaf.add(box(leafW - 0.12, 0.07, 0.05, m.charcoal, midX, sy, 0));
    }
    // Close-spaced vertical bars below.
    const bars = Math.max(8, Math.floor(leafW / 0.11));
    for (let i = 1; i < bars; i += 1) {
      const bx = dirX * (i * (leafW / bars));
      leaf.add(box(0.032, splitY - 0.1, 0.045, m.charcoal, bx, splitY / 2 + 0.02, 0));
    }
    pivot.add(leaf);
    group.add(pivot);
    doors.push({
      pivot,
      closedAngle: 0,
      openAngle: side * Math.PI * 0.5,
      progress: 0,
      open: false,
      worldPosition: new Vector3(hingeX + dirX * leafW * 0.5, 1, zFront),
      label: 'Gate',
    });
  }
}

interface GardenCtx {
  xL: number;
  xR: number;
  zFront: number;
  zBack: number;
  W: number;
  D: number;
}

/** Deterministic jitter, so planting is irregular but stable between reloads. */
function rand(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a * 1664525 + 1013904223) % 4294967296;
    return a / 4294967296;
  };
}

function buildGarden(group: Group, m: MaterialLibrary, ctx: GardenCtx): void {
  const { xL, xR, zFront, W, D } = ctx;
  const rnd = rand(2026);

  /**
   * A tree built from crossed alpha-cut foliage cards rather than spheres.
   * Real canopies have a broken, see-through silhouette; a smooth sphere never
   * does, and it is the loudest CG tell in an exterior shot. Several cards are
   * scattered around the crown at varied angles so the tree reads from any
   * viewpoint without ever showing an obviously flat plane.
   */
  const tree = (x: number, z: number, h: number): void => {
    group.add(cylinder(0.09 + rnd() * 0.04, h, m.plantTrunk, x, h / 2, z));
    // A few structural limbs reaching into the crown.
    for (let b = 0; b < 3; b += 1) {
      const a = rnd() * Math.PI * 2;
      group.add(
        cylinder(
          0.04,
          h * 0.4,
          m.plantTrunk,
          x + Math.cos(a) * h * 0.1,
          h * 0.78,
          z + Math.sin(a) * h * 0.1,
        ),
      );
    }
    const cards = 9;
    for (let i = 0; i < cards; i += 1) {
      const a = rnd() * Math.PI * 2;
      const r = h * (0.06 + rnd() * 0.26);
      const cy = h * (0.82 + rnd() * 0.42);
      const s = h * (0.5 + rnd() * 0.34);
      group.add(
        card(s, s, m.leafCard, x + Math.cos(a) * r, cy, z + Math.sin(a) * r, rnd() * Math.PI),
      );
    }
  };

  // Trees framing the plot, kept clear of the driveway.
  tree(xL + 1.2, zFront + 3, 3.4);
  tree(xR - 1.2, zFront + 3, 3.2);
  tree(xL + 1.4, D * 0.6, 3.6);
  tree(xR - 1.4, D * 0.6, 3.6);
  tree(xL + 1.5, D + 4, 3.0);
  tree(xR - 1.5, D + 4, 3.0);

  // Shrub rows along the front boundary planters, size- and position-jittered.
  const shrub = (x: number, z: number): void => {
    for (let i = 0; i < 3; i += 1) {
      const s = 0.6 + rnd() * 0.45;
      group.add(
        card(
          s,
          s,
          m.leafCard,
          x + (rnd() - 0.5) * 0.35,
          0.3 + rnd() * 0.22,
          z + (rnd() - 0.5) * 0.3,
          rnd() * Math.PI,
        ),
      );
    }
  };
  for (let x = xL + 0.6; x < W / 2 - 2.6; x += 0.75) shrub(x, zFront + 0.6);
  for (let x = W / 2 + 2.6; x < xR - 0.4; x += 0.75) shrub(x, zFront + 0.6);
  // Planter boxes flanking the entrance path.
  group.add(box(0.4, 0.5, 4, m.facadeWhite, W / 2 - 2.7, 0.25, zFront + 3));
  group.add(box(0.4, 0.5, 4, m.facadeWhite, W / 2 + 2.7, 0.25, zFront + 3));
}

interface NeighbourCtx {
  xL: number;
  xR: number;
  zFront: number;
  W: number;
  D: number;
}

/**
 * The immediate streetscape.
 *
 * In the reference photographs the plot is hemmed in by neighbouring houses on
 * both sides and across the street, with power poles and overhead lines. That
 * context does as much for believability as the house itself — an isolated villa
 * on an empty lawn always reads as a render, so the neighbours are massed in
 * with punched window grids and left deliberately plainer than the subject.
 */
function buildNeighbours(group: Group, m: MaterialLibrary, ctx: NeighbourCtx): void {
  const { xL, xR, zFront, W, D } = ctx;
  const tones = [0xd8cebb, 0xc2b6a0, 0xcfc4ad, 0xb9ad97];

  const block = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    tone: number,
    windows: boolean,
  ): void => {
    const mat = m.paint(tone);
    group.add(box(w, h, d, mat, cx, h / 2, cz));
    group.add(box(w + 0.3, 0.25, d + 0.3, m.parapet, cx, h + 0.12, cz));
    if (!windows) return;
    // Punched window grid on the face that looks toward the street.
    const rows = Math.max(2, Math.floor(h / 3));
    const cols = Math.max(2, Math.floor(w / 2.2));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const wx = cx - w / 2 + ((c + 0.5) * w) / cols;
        const wy = 1.3 + r * 3;
        group.add(box(0.9, 1.1, 0.08, m.windowSurround, wx, wy, cz - d / 2 - 0.02));
        group.add(box(0.72, 0.92, 0.04, m.glass, wx, wy, cz - d / 2 - 0.07));
      }
    }
  };

  // Terraced neighbours pressed against each side boundary.
  block(xL - 5.2, D * 0.42, 9, 15, 10.5, tones[0]!, true);
  block(xR + 5.2, D * 0.46, 9, 16, 9.6, tones[1]!, true);
  // A taller block set back behind them.
  block(xL - 7.5, D + 12, 11, 12, 12.5, tones[2]!, false);
  block(xR + 7.8, D + 13, 10, 12, 11, tones[3]!, false);
  // Buildings across the street, facing back at the house.
  block(W / 2 - 12, zFront - 22, 12, 12, 9, tones[1]!, false);
  block(W / 2 + 11, zFront - 23, 12, 12, 10, tones[0]!, false);

  // Power poles and a slack overhead line along the kerb — a signature of the
  // street in the references.
  const poleZ = zFront - 3.2;
  for (const px of [W / 2 - 14, W / 2 + 6, W / 2 + 24]) {
    group.add(cylinder(0.11, 8.5, m.parapet, px, 4.25, poleZ));
    group.add(box(1.5, 0.1, 0.1, m.metalDark, px, 8.1, poleZ, { cast: false }));
  }
  for (const [i, px] of [W / 2 - 14, W / 2 + 6].entries()) {
    const next = [W / 2 + 6, W / 2 + 24][i]!;
    const span = next - px;
    group.add(box(span, 0.04, 0.04, m.metalDark, px + span / 2, 7.75, poleZ, { cast: false }));
  }
}

/** The modelled elevation lives in its own module — see `facade.ts`. */
function buildFacade(group: Group, m: MaterialLibrary, _W: number): void {
  group.add(buildFacadeDetail(m));
}

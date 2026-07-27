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

import { box, cylinder, sphere } from '../geometry';
import type { MaterialLibrary } from '../materials';
import { ENVELOPE } from '../plan';
import type { Collider, DoorHandle, FloorSurface } from '../types';

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
      m.driveway,
      W / 2,
      0.01,
      (zFront + frontZ) / 2,
      { cast: false },
    ),
  );
  // Street beyond the boundary.
  group.add(box(60, 0.04, 9, m.street, W / 2, -0.02, zFront - 6.5, { cast: false }));
  group.add(box(60, 0.05, 0.2, m.paint(0xdadad0), W / 2, 0.02, zFront - 2.2, { cast: false }));

  buildCompound(group, colliders, doors, m, { xL, xR, zFront, W });
  buildGarden(group, m, { xL, xR, zFront, zBack, W, D });
  buildFacade(group, m, W);

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

  const wall = (minX: number, maxX: number, minZ: number, maxZ: number): void => {
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    group.add(box(maxX - minX, H, maxZ - minZ, m.boundaryWall, cx, H / 2, cz));
    group.add(box(maxX - minX + 0.08, 0.12, maxZ - minZ + 0.08, m.parapet, cx, H + 0.06, cz));
    colliders.push({ minX, maxX, minZ, maxZ, baseY: 0, topY: H });
  };

  // Front wall, split for the gate opening.
  wall(xL, W / 2 - gateW / 2, zFront - T, zFront);
  wall(W / 2 + gateW / 2, xR, zFront - T, zFront);
  // Side and back walls.
  wall(xL - T, xL, zFront, zBack);
  wall(xR, xR + T, zFront, zBack);
  wall(xL, xR, zBack, zBack + T);

  // Gate piers.
  for (const px of [W / 2 - gateW / 2, W / 2 + gateW / 2]) {
    group.add(box(0.4, 2.1, 0.4, m.boundaryWall, px, 1.05, zFront - T / 2));
    group.add(box(0.5, 0.15, 0.5, m.parapet, px, 2.15, zFront - T / 2));
  }

  // Two sliding/hinged gate leaves of vertical metal slats.
  for (const side of [-1, 1] as const) {
    const pivot = new Group();
    pivot.userData.dynamic = true;
    const hingeX = W / 2 + (side * gateW) / 2;
    pivot.position.set(hingeX, 0, zFront - T / 2);
    const leafW = gateW / 2 - 0.1;
    const dirX = -side; // slats extend toward the gap
    const frame = new Group();
    frame.add(box(leafW, 0.08, 0.06, m.metalDark, (dirX * leafW) / 2, 0.2, 0));
    frame.add(box(leafW, 0.08, 0.06, m.metalDark, (dirX * leafW) / 2, 1.7, 0));
    const slats = Math.floor(leafW / 0.16);
    for (let i = 0; i < slats; i += 1) {
      const lx = dirX * (0.08 + i * 0.16);
      frame.add(box(0.05, 1.7, 0.05, m.metalDark, lx, 0.95, 0));
    }
    pivot.add(frame);
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

function buildGarden(group: Group, m: MaterialLibrary, ctx: GardenCtx): void {
  const { xL, xR, zFront, W, D } = ctx;
  const tree = (x: number, z: number, h: number): void => {
    group.add(cylinder(0.12, h, m.plantTrunk, x, h / 2, z));
    group.add(sphere(h * 0.42, m.plantLeaf, x, h + h * 0.1, z));
    group.add(sphere(h * 0.34, m.plantLeaf, x + h * 0.2, h * 0.9, z));
    group.add(sphere(h * 0.3, m.plantLeaf, x - h * 0.18, h * 0.95, z + 0.2));
  };
  // Trees framing the plot, kept clear of the driveway.
  tree(xL + 1.2, zFront + 3, 3.4);
  tree(xR - 1.2, zFront + 3, 3.2);
  tree(xL + 1.4, D * 0.6, 3.6);
  tree(xR - 1.4, D * 0.6, 3.6);
  tree(xL + 1.5, D + 4, 3.0);
  tree(xR - 1.5, D + 4, 3.0);

  // Shrub rows along the front boundary planters.
  for (let x = xL + 0.6; x < W / 2 - 2.6; x += 0.8) {
    group.add(sphere(0.35, m.plantLeaf, x, 0.35, zFront + 0.6));
  }
  for (let x = W / 2 + 2.6; x < xR - 0.4; x += 0.8) {
    group.add(sphere(0.35, m.plantLeaf, x, 0.35, zFront + 0.6));
  }
  // Planter boxes flanking the entrance path.
  group.add(box(0.4, 0.5, 4, m.boundaryWall, W / 2 - 2.7, 0.25, zFront + 3));
  group.add(box(0.4, 0.5, 4, m.boundaryWall, W / 2 + 2.7, 0.25, zFront + 3));
}

/**
 * Front-facade accents from the elevation: a full-height teak cladding tower on
 * one side, the white frame wrapping the stacked balconies, and the entrance
 * canopy over the porch.
 */
function buildFacade(group: Group, m: MaterialLibrary, W: number): void {
  const totalH = ENVELOPE.levels * ENVELOPE.levelHeight;
  const frontZ = -ENVELOPE.frontBalcony;

  // Teak cladding tower (stacked panels) on the left of the facade.
  for (let i = 0; i < 8; i += 1) {
    group.add(box(1.4, 0.85, 0.12, m.claddingWood, 1.2, 0.9 + i * 1.12, frontZ - 0.06));
  }
  // White vertical fin on the right of the facade.
  group.add(box(0.5, totalH + 0.6, 0.5, m.stuccoWhite, W - 0.6, (totalH + 0.6) / 2, frontZ + 0.2));

  // White frame around the projecting balcony stack (centre of the facade).
  const bx = W / 2;
  const frameOuterW = ENVELOPE.width * 0.42;
  const top = totalH + 0.2;
  group.add(box(frameOuterW, 0.35, 0.35, m.stuccoWhite, bx, top, frontZ - 0.1));
  group.add(box(0.35, top, 0.35, m.stuccoWhite, bx - frameOuterW / 2, top / 2, frontZ - 0.1));
  group.add(box(0.35, top, 0.35, m.stuccoWhite, bx + frameOuterW / 2, top / 2, frontZ - 0.1));

  // Entrance canopy over the ground-floor porch.
  group.add(
    box(frameOuterW, 0.18, 1.4, m.soffitWood, bx, ENVELOPE.levelHeight - 0.4, frontZ - 0.5),
  );
}

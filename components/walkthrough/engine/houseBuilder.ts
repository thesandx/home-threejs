/**
 * Turns the floor plan into building geometry.
 *
 * Pipeline per level:
 *   1. Exterior envelope — the four perimeter walls, with windows and the
 *      front/rear doors punched in.
 *   2. Interior partitions — derived from the shared edges of the room
 *      rectangles, deduplicated, with internal doors and archways punched.
 *   3. Floor and ceiling slabs — one finish + structural pair per room, leaving
 *      the stair shaft open so the flights connect the levels.
 *   4. Stairs — a straight flight rising through the shaft.
 * The top level is capped with a terrace slab, parapet, and stair headroom.
 *
 * Openings are placed by world point (see `plan.ts`); each wall run punches the
 * openings that lie on its line. Solid panels below the player's head become
 * colliders; tread tops and floor finishes become walkable surfaces.
 */

import { Group, type Material, type Mesh, Object3D, Vector3 } from 'three';

import type { Collider, LevelPlan, OpeningSpec, Room } from '@/types/villa';

import { box } from './geometry';
import type { MaterialLibrary } from './materials';
import { ENVELOPE, LEVEL, levelFloorY } from './plan';
import type { DoorHandle, FloorSurface } from './types';

const EXT_THICK = 0.23;
const INT_THICK = 0.12;
const FRAME = 0.06;
const GLASS_T = 0.03;

type Axis = 'x' | 'z';

interface PlacedRoom {
  room: Room;
  level: number;
  floorY: number;
  center: Vector3;
}

export interface HouseBuild {
  group: Group;
  colliders: Collider[];
  floors: FloorSurface[];
  doors: DoorHandle[];
  placedRooms: PlacedRoom[];
}

interface DerivedWall {
  axis: Axis;
  fixed: number;
  a0: number;
  a1: number;
  thickness: number;
  material: Material;
}

export class HouseBuilder {
  private readonly group = new Group();
  private readonly colliders: Collider[] = [];
  private readonly floors: FloorSurface[] = [];
  private readonly doors: DoorHandle[] = [];
  private readonly placedRooms: PlacedRoom[] = [];
  private tagExterior = false;

  constructor(private readonly mats: MaterialLibrary) {
    this.group.name = 'house';
  }

  build(): HouseBuild {
    for (let level = 0; level < ENVELOPE.levels; level += 1) {
      this.buildLevel(LEVEL, level);
    }
    this.buildTerrace();
    return {
      group: this.group,
      colliders: this.colliders,
      floors: this.floors,
      doors: this.doors,
      placedRooms: this.placedRooms,
    };
  }

  private buildLevel(plan: LevelPlan, level: number): void {
    const floorY = levelFloorY(level);
    const h = plan.wallHeight;

    this.buildEnvelope(plan, floorY, h);
    this.buildPartitions(plan, floorY, h);

    for (const room of plan.rooms) {
      this.recordRoom(room, level, floorY);
      if (room.kind === 'stair') continue; // open shaft
      this.buildRoomSlab(room, floorY);
    }
    this.buildStairFlight(floorY, h);
  }

  private recordRoom(room: Room, level: number, floorY: number): void {
    const { x0, z0, x1, z1 } = room.rect;
    this.placedRooms.push({
      room,
      level,
      floorY,
      center: new Vector3((x0 + x1) / 2, floorY, (z0 + z1) / 2),
    });
  }

  // --- Walls -------------------------------------------------------------

  private buildEnvelope(plan: LevelPlan, floorY: number, h: number): void {
    const { x0, x1 } = { x0: 0, x1: ENVELOPE.width };
    const zFront = 0;
    const zRear = ENVELOPE.depth;
    const runs: DerivedWall[] = [
      {
        axis: 'x',
        fixed: zFront,
        a0: x0,
        a1: x1,
        thickness: EXT_THICK,
        material: this.mats.stucco,
      },
      { axis: 'x', fixed: zRear, a0: x0, a1: x1, thickness: EXT_THICK, material: this.mats.stucco },
      {
        axis: 'z',
        fixed: x0,
        a0: zFront,
        a1: zRear,
        thickness: EXT_THICK,
        material: this.mats.stucco,
      },
      {
        axis: 'z',
        fixed: x1,
        a0: zFront,
        a1: zRear,
        thickness: EXT_THICK,
        material: this.mats.stucco,
      },
    ];
    this.tagExterior = true;
    for (const run of runs) this.buildWallRun(run, plan.openings, floorY, h, true);
    this.tagExterior = false;
  }

  private buildPartitions(plan: LevelPlan, floorY: number, h: number): void {
    const walls = derivePartitions(plan.rooms);
    for (const w of walls) {
      this.buildWallRun(
        { ...w, thickness: INT_THICK, material: this.mats.interiorWall },
        plan.openings,
        floorY,
        h,
        false,
      );
    }
  }

  private buildWallRun(
    wall: DerivedWall,
    allOpenings: OpeningSpec[],
    floorY: number,
    h: number,
    exterior: boolean,
  ): void {
    const { axis, fixed, a0, a1, thickness, material } = wall;
    const ops = allOpenings
      .filter((o) => onWall(o, axis, fixed, a0, a1))
      .map((o) => ({ ...o, u: axis === 'x' ? o.x : o.z }))
      .sort((left, right) => left.u - right.u);

    let cursor = a0;
    for (const op of ops) {
      const u0 = Math.max(a0, op.u - op.width / 2);
      const u1 = Math.min(a1, op.u + op.width / 2);
      if (u0 > cursor + 1e-3) {
        this.solidPanel(axis, fixed, cursor, u0, floorY, floorY + h, thickness, material);
      }
      const sill = floorY + op.sill;
      const head = floorY + op.sill + op.height;
      if (op.sill > 1e-3) {
        this.solidPanel(axis, fixed, u0, u1, floorY, sill, thickness, material);
      }
      if (head < floorY + h - 1e-3) {
        this.trimPanel(axis, fixed, u0, u1, head, floorY + h, thickness, material);
      }
      this.fillOpening(op, axis, fixed, u0, u1, sill, head, exterior);
      cursor = Math.max(cursor, u1);
    }
    if (cursor < a1 - 1e-3) {
      this.solidPanel(axis, fixed, cursor, a1, floorY, floorY + h, thickness, material);
    }
  }

  /** A load-bearing panel that reaches the floor: rendered and collidable. */
  private solidPanel(
    axis: Axis,
    fixed: number,
    u0: number,
    u1: number,
    y0: number,
    y1: number,
    t: number,
    material: Material,
  ): void {
    const mesh = this.panelMesh(axis, fixed, u0, u1, y0, y1, t, material);
    this.group.add(mesh);
    if (y1 - y0 > 0.35) {
      this.colliders.push(colliderFor(axis, fixed, u0, u1, t, y0, y1));
    }
  }

  /** A high lintel/spandrel panel: rendered but never collides. */
  private trimPanel(
    axis: Axis,
    fixed: number,
    u0: number,
    u1: number,
    y0: number,
    y1: number,
    t: number,
    material: Material,
  ): void {
    this.group.add(this.panelMesh(axis, fixed, u0, u1, y0, y1, t, material));
  }

  private panelMesh(
    axis: Axis,
    fixed: number,
    u0: number,
    u1: number,
    y0: number,
    y1: number,
    t: number,
    material: Material,
  ): Mesh {
    const len = Math.max(u1 - u0, 1e-3);
    const cy = (y0 + y1) / 2;
    const cu = (u0 + u1) / 2;
    const mesh =
      axis === 'x'
        ? box(len, y1 - y0, t, material, cu, cy, fixed)
        : box(t, y1 - y0, len, material, fixed, cy, cu);
    if (this.tagExterior) mesh.userData.exteriorWall = true;
    return mesh;
  }

  private fillOpening(
    op: OpeningSpec,
    axis: Axis,
    fixed: number,
    u0: number,
    u1: number,
    sill: number,
    head: number,
    exterior: boolean,
  ): void {
    if (op.kind === 'archway') return;
    if (op.kind === 'window') {
      this.addWindow(axis, fixed, u0, u1, sill, head, exterior);
      return;
    }
    this.addDoor(axis, fixed, u0, u1, sill, head, exterior);
  }

  private addWindow(
    axis: Axis,
    fixed: number,
    u0: number,
    u1: number,
    sill: number,
    head: number,
    exterior: boolean,
  ): void {
    const frame = this.mats.frameDark;
    const t = exterior ? EXT_THICK : INT_THICK;
    // Frame: bottom, top, two mullions.
    this.group.add(this.panelMesh(axis, fixed, u0, u1, sill, sill + FRAME, t + 0.02, frame));
    this.group.add(this.panelMesh(axis, fixed, u0, u1, head - FRAME, head, t + 0.02, frame));
    this.group.add(this.panelMesh(axis, fixed, u0, u0 + FRAME, sill, head, t + 0.02, frame));
    this.group.add(this.panelMesh(axis, fixed, u1 - FRAME, u1, sill, head, t + 0.02, frame));
    // Glass.
    const glass = this.panelMesh(
      axis,
      fixed,
      u0 + FRAME,
      u1 - FRAME,
      sill + FRAME,
      head - FRAME,
      GLASS_T,
      this.mats.glass,
    );
    glass.castShadow = false;
    this.group.add(glass);
  }

  private addDoor(
    axis: Axis,
    fixed: number,
    u0: number,
    u1: number,
    sill: number,
    head: number,
    exterior: boolean,
  ): void {
    const t = exterior ? EXT_THICK : INT_THICK;
    const width = u1 - u0;
    const leafH = head - sill;
    // Dark jambs framing the reveal.
    const frame = this.mats.frameDark;
    this.group.add(this.panelMesh(axis, fixed, u0 - FRAME, u0, sill, head, t + 0.02, frame));
    this.group.add(this.panelMesh(axis, fixed, u1, u1 + FRAME, sill, head, t + 0.02, frame));
    // Hinged leaf, pivoting about the jamb at u0.
    const pivot = new Object3D();
    const leaf = box(
      axis === 'x' ? width : 0.05,
      leafH,
      axis === 'x' ? 0.05 : width,
      this.mats.doorWood,
      axis === 'x' ? width / 2 : 0,
      leafH / 2,
      axis === 'x' ? 0 : width / 2,
    );
    pivot.add(leaf);
    pivot.position.set(axis === 'x' ? u0 : fixed, sill, axis === 'x' ? fixed : u0);
    // Brass handle near the free edge.
    const handle = box(
      0.05,
      0.04,
      0.18,
      this.mats.brass,
      axis === 'x' ? width - 0.14 : 0.07,
      leafH / 2,
      axis === 'x' ? 0.07 : width - 0.14,
    );
    handle.castShadow = false;
    pivot.add(handle);
    this.group.add(pivot);

    this.doors.push({
      pivot,
      closedAngle: 0,
      openAngle: axis === 'x' ? -Math.PI * 0.5 : Math.PI * 0.5,
      progress: 0,
      open: false,
      worldPosition: new Vector3(
        axis === 'x' ? u0 + width / 2 : fixed,
        sill + 1,
        axis === 'x' ? fixed : u0 + width / 2,
      ),
      label: 'Door',
    });
  }

  // --- Slabs -------------------------------------------------------------

  private buildRoomSlab(room: Room, floorY: number): void {
    const { x0, z0, x1, z1 } = room.rect;
    const w = x1 - x0;
    const d = z1 - z0;
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const finish = this.floorFinish(room.kind);
    // Finish surface (walkable).
    this.group.add(box(w, 0.03, d, finish, cx, floorY - 0.015, cz, { cast: false }));
    // Structural slab; its underside is the ceiling of the room below.
    const under = room.kind === 'balcony' ? this.mats.soffitWood : this.mats.ceiling;
    this.group.add(box(w, 0.12, d, under, cx, floorY - 0.09, cz, { cast: false }));
    this.floors.push({ minX: x0, maxX: x1, minZ: z0, maxZ: z1, y: floorY });

    if (room.kind === 'balcony') this.buildBalconyRail(room, floorY);
  }

  private floorFinish(kind: Room['kind']): Material {
    switch (kind) {
      case 'bathroom':
        return this.mats.bathroomFloor;
      case 'kitchen':
      case 'utility':
      case 'lift':
        return this.mats.tileFloor;
      case 'balcony':
        return this.mats.tileFloor;
      case 'pooja':
        return this.mats.marbleFloor;
      default:
        return this.mats.marbleFloor;
    }
  }

  private buildBalconyRail(room: Room, floorY: number): void {
    const { x0, z0, x1, z1 } = room.rect;
    const railH = 1.0;
    const glass = this.mats.glassRail;
    const cap = this.mats.steel;
    const front = z0 < 0; // front balcony faces the street
    const outerZ = front ? z0 : z1;
    // Glass panel along the outer edge and returns.
    const edges: Array<[number, number, number, number]> = [
      [x0, outerZ, x1, outerZ],
      [x0, z0, x0, z1],
      [x1, z0, x1, z1],
    ];
    for (const [ex0, ez0, ex1, ez1] of edges) {
      const cxp = (ex0 + ex1) / 2;
      const czp = (ez0 + ez1) / 2;
      const len = Math.hypot(ex1 - ex0, ez1 - ez0);
      const alongX = Math.abs(ex1 - ex0) > Math.abs(ez1 - ez0);
      const panel = box(
        alongX ? len : 0.02,
        railH - 0.12,
        alongX ? 0.02 : len,
        glass,
        cxp,
        floorY + (railH - 0.12) / 2 + 0.02,
        czp,
        { cast: false },
      );
      this.group.add(panel);
      this.group.add(
        box(alongX ? len : 0.05, 0.05, alongX ? 0.05 : len, cap, cxp, floorY + railH, czp),
      );
    }
  }

  // --- Stairs ------------------------------------------------------------

  private buildStairFlight(floorY: number, h: number): void {
    const room = LEVEL.rooms.find((r) => r.kind === 'stair');
    if (!room) return;
    const { x0, x1, z0, z1 } = room.rect;
    const steps = 17;
    const rise = h / steps;
    const runDepth = (z1 - z0 - 0.2) / steps;
    const width = Math.min(x1 - x0 - 0.3, 1.4);
    const cx = (x0 + x1) / 2;
    for (let i = 0; i < steps; i += 1) {
      const treadTop = floorY + (i + 1) * rise;
      // Ascend toward the front (decreasing z), landing near the central hall.
      const zNear = z1 - 0.1 - i * runDepth;
      const zc = zNear - runDepth / 2;
      const solidH = treadTop - floorY + 0.02;
      this.group.add(
        box(width, solidH, runDepth + 0.02, this.mats.marbleFloor, cx, floorY + solidH / 2, zc, {
          cast: true,
        }),
      );
      this.floors.push({
        minX: cx - width / 2,
        maxX: cx + width / 2,
        minZ: zc - runDepth / 2,
        maxZ: zc + runDepth / 2,
        y: treadTop,
      });
    }
    // Stringer wall on the open side for safety and looks.
    this.group.add(
      box(
        0.1,
        h,
        z1 - z0,
        this.mats.interiorWall,
        cx + width / 2 + 0.05,
        floorY + h / 2,
        (z0 + z1) / 2,
        {
          cast: false,
        },
      ),
    );
  }

  // --- Roof / terrace ----------------------------------------------------

  private buildTerrace(): void {
    const roofY = levelFloorY(ENVELOPE.levels);
    const w = ENVELOPE.width;
    const d = ENVELOPE.depth;
    // Roof slab (also the top level's ceiling).
    const slab = box(w, 0.2, d, this.mats.parapet, w / 2, roofY - 0.1, d / 2, { cast: true });
    slab.userData.roof = true;
    this.group.add(slab);
    this.floors.push({ minX: 0, maxX: w, minZ: 0, maxZ: d, y: roofY });

    // Parapet around the perimeter.
    const pH = 1.0;
    const pT = 0.2;
    const perimeter: Array<[number, number, number, number]> = [
      [0, 0, w, pT],
      [0, d - pT, w, pT],
      [0, 0, pT, d],
      [w - pT, 0, pT, d],
    ];
    for (const [px, pz, pw, pd] of perimeter) {
      const mesh = box(pw, pH, pd, this.mats.stuccoWhite, px + pw / 2, roofY + pH / 2, pz + pd / 2);
      this.group.add(mesh);
      this.colliders.push({
        minX: px,
        maxX: px + pw,
        minZ: pz,
        maxZ: pz + pd,
        baseY: roofY,
        topY: roofY + pH,
      });
    }

    // Stair headroom enclosure (mumty) over the shaft, with an open doorway.
    const stair = LEVEL.rooms.find((r) => r.kind === 'stair');
    if (stair) {
      const mH = 2.4;
      const { x0, x1, z0, z1 } = stair.rect;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      this.group.add(
        box(x1 - x0 + 0.4, 0.15, z1 - z0 + 0.4, this.mats.parapet, cx, roofY + mH, cz, {
          cast: true,
        }),
      );
      this.group.add(box(0.15, mH, z1 - z0 + 0.4, this.mats.stucco, x0 - 0.2, roofY + mH / 2, cz));
      this.group.add(box(0.15, mH, z1 - z0 + 0.4, this.mats.stucco, x1 + 0.2, roofY + mH / 2, cz));
      this.group.add(box(x1 - x0 + 0.4, mH, 0.15, this.mats.stucco, cx, roofY + mH / 2, z1 + 0.2));
    }
    // Water tank, a familiar Indian-rooftop silhouette.
    this.group.add(box(1.2, 1.0, 1.2, this.mats.paint(0x2a6ad0), w - 2, roofY + 1.2, 2));
    this.group.add(box(1.3, 0.15, 1.3, this.mats.parapet, w - 2, roofY + 0.35, 2));
  }
}

// --- Free helpers --------------------------------------------------------

/** True when opening `o` lies on the wall line (axis/fixed) within [a0,a1]. */
function onWall(o: OpeningSpec, axis: Axis, fixed: number, a0: number, a1: number): boolean {
  const perp = axis === 'x' ? o.z : o.x;
  const along = axis === 'x' ? o.x : o.z;
  return Math.abs(perp - fixed) < 0.06 && along > a0 - 0.05 && along < a1 + 0.05;
}

function colliderFor(
  axis: Axis,
  fixed: number,
  u0: number,
  u1: number,
  t: number,
  y0: number,
  y1: number,
): Collider {
  if (axis === 'x') {
    return { minX: u0, maxX: u1, minZ: fixed - t / 2, maxZ: fixed + t / 2, baseY: y0, topY: y1 };
  }
  return { minX: fixed - t / 2, maxX: fixed + t / 2, minZ: u0, maxZ: u1, baseY: y0, topY: y1 };
}

/**
 * Derive interior partition walls from room rectangles.
 *
 * Every room contributes its four edges. Edges on the envelope perimeter are
 * dropped (the envelope owns them). Balcony rooms are skipped — they are open.
 * Identical edges from two adjacent rooms collapse to one wall.
 */
function derivePartitions(rooms: Room[]): DerivedWall[] {
  const W = ENVELOPE.width;
  const D = ENVELOPE.depth;
  const seen = new Map<string, DerivedWall>();
  const add = (axis: Axis, fixed: number, a0: number, a1: number): void => {
    const lo = Math.min(a0, a1);
    const hi = Math.max(a0, a1);
    if (hi - lo < 0.1) return;
    const onPerimeter =
      axis === 'x' ? fixed < 0.01 || fixed > D - 0.01 : fixed < 0.01 || fixed > W - 0.01;
    if (onPerimeter) return;
    const key = `${axis}:${round(fixed)}:${round(lo)}:${round(hi)}`;
    if (seen.has(key)) return;
    seen.set(key, { axis, fixed, a0: lo, a1: hi, thickness: INT_THICK, material: undefinedMat() });
  };
  for (const room of rooms) {
    if (room.kind === 'balcony') continue;
    const { x0, z0, x1, z1 } = room.rect;
    add('x', z0, x0, x1);
    add('x', z1, x0, x1);
    add('z', x0, z0, z1);
    add('z', x1, z0, z1);
  }
  return [...seen.values()];
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** Placeholder material slot; replaced by `buildPartitions`. */
function undefinedMat(): Material {
  return null as unknown as Material;
}

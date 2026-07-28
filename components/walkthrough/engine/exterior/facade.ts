/**
 * The front and side elevations, modelled from the reference photographs of the
 * built house ("Sri Sai Dham", Manikonda).
 *
 * The elevation reads as a few strong moves, and this module builds them in the
 * order they stack visually:
 *
 *  1. A stilt porch at ground level — round columns carrying the balcony block
 *     above, with an exposed-joist soffit and the gold name band on its beam.
 *  2. Deep recessed balconies on the upper floors, each wrapped in a thick
 *     near-white L-frame that projects proud of the wall.
 *  3. Dark stained timber balcony soffits with recessed downlights.
 *  4. Full-height terracotta louvre fins closing one end of each balcony.
 *  5. Projecting dark-taupe box surrounds around every window on the solid
 *     bay — the detail that gives the facade its depth.
 *  6. Terracotta slatted hoods stacked up the side wall over its windows.
 *  7. Thin reveal grooves scored into the render, and a dark fascia at the roof.
 *
 * Everything here is static and material-batched by `mergeStatic`, and is tagged
 * `exteriorWall` so the "hide walls" control peels it away with the shell.
 */

import { Group, type Object3D } from 'three';

import { box, cylinder } from '../geometry';
import type { MaterialLibrary } from '../materials';
import { ENVELOPE } from '../plan';

/** Where the balcony void sits across the frontage, as a fraction of width. */
const BALCONY_X0 = 0.06;
const BALCONY_X1 = 0.6;
/** The solid bay to the right of the balcony carries the box windows. */
const SOLID_X0 = 0.63;

const FRAME_T = 0.34; // thickness of the white L-frames
const HOOD_PROJECT = 0.42; // how far the slat hoods stand off the wall
const SURROUND_PROJECT = 0.26; // how far a window box surround projects

function tag(o: Object3D): Object3D {
  o.userData.exteriorWall = true;
  return o;
}

export function buildFacadeDetail(m: MaterialLibrary): Group {
  const g = new Group();
  g.name = 'facade';
  const W = ENVELOPE.width;
  const D = ENVELOPE.depth;
  const H = ENVELOPE.levelHeight;
  const levels = ENVELOPE.levels;
  const frontZ = -ENVELOPE.frontBalcony; // outer face of the balcony block
  const wallZ = 0; // main front wall

  const add = (o: Object3D): void => {
    g.add(tag(o));
  };

  const bx0 = W * BALCONY_X0;
  const bx1 = W * BALCONY_X1;
  const sx0 = W * SOLID_X0;

  buildFieldWalls(add, m, W, sx0, levels, H, wallZ, frontZ);
  buildPorch(add, m, bx0, bx1, H, frontZ, wallZ);
  buildBalconyBlock(add, m, bx0, bx1, levels, H, frontZ, wallZ);
  buildBoxWindows(add, m, sx0, W, levels, H, wallZ);
  buildSlatHoods(add, m, W, D, levels, H);
  buildRevealsAndFascia(add, m, W, D, levels, H);
  g.add(buildBalconyCap(m));

  return g;
}

/**
 * The cream field wall of the solid bay, plus the darker tan accent panel and
 * the pale corner pilaster seen on the right of the elevation.
 */
function buildFieldWalls(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  W: number,
  sx0: number,
  levels: number,
  H: number,
  wallZ: number,
  frontZ: number,
): void {
  const total = levels * H;
  const solidW = W - sx0;

  // Cream field, held just proud of the structural wall so it reads as render.
  add(box(solidW, total, 0.06, m.facadeCream, sx0 + solidW / 2, total / 2, wallZ - 0.03));

  // Darker tan accent panel over the right third, from first floor up.
  const tanW = solidW * 0.42;
  add(
    box(
      tanW,
      total - H * 0.6,
      0.08,
      m.facadeTan,
      W - tanW / 2 - 0.35,
      H * 0.6 + (total - H * 0.6) / 2,
      wallZ - 0.05,
    ),
  );

  // Pale corner pilaster running the full height at the right edge.
  add(box(0.34, total + 0.5, 0.34, m.facadeWhite, W - 0.17, (total + 0.5) / 2, wallZ - 0.12));

  // The tall slender fin that separates the balcony block from the solid bay.
  add(box(0.26, total + 0.4, 0.5, m.facadeWhite, sx0 - 0.16, (total + 0.4) / 2, frontZ + 0.9));
}

/**
 * Ground-level stilt porch: round columns on the balcony line, a beam with the
 * house name, and an exposed-joist soffit under the balcony above.
 */
function buildPorch(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  bx0: number,
  bx1: number,
  H: number,
  frontZ: number,
  wallZ: number,
): void {
  const depth = wallZ - frontZ;
  const width = bx1 - bx0;

  // Round columns carrying the block above.
  for (const cx of [bx0 + 0.35, bx1 - 0.35]) {
    add(cylinder(0.17, H - 0.45, m.facadeWhite, cx, (H - 0.45) / 2, frontZ + 0.35));
    add(box(0.5, 0.14, 0.5, m.facadeWhite, cx, 0.07, frontZ + 0.35)); // base plinth
  }

  // Beam across the porch head — the band that carries the gold lettering.
  add(box(width + 0.5, 0.62, 0.42, m.facadeWhite, (bx0 + bx1) / 2, H - 0.31, frontZ + 0.2));

  // Gold name plate, proud of the beam.
  add(box(width * 0.42, 0.2, 0.04, m.brass, (bx0 + bx1) / 2, H - 0.3, frontZ + 0.42));

  // Exposed joists under the balcony slab, running front to back.
  const joists = Math.max(6, Math.floor(width / 0.55));
  for (let i = 0; i < joists; i += 1) {
    const jx = bx0 + 0.3 + (i * (width - 0.6)) / (joists - 1);
    add(box(0.12, 0.22, depth - 0.5, m.balconyCeiling, jx, H - 0.72, frontZ + depth / 2 + 0.2));
  }
  // Soffit plate the joists sit against.
  add(
    box(
      width,
      0.1,
      depth - 0.3,
      m.facadeWhite,
      (bx0 + bx1) / 2,
      H - 0.58,
      frontZ + depth / 2 + 0.1,
    ),
  );
}

/**
 * The upper balconies: a thick white L-frame wrapping each opening, a dark
 * timber soffit with downlights, and terracotta louvre fins at one end.
 */
function buildBalconyBlock(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  bx0: number,
  bx1: number,
  levels: number,
  H: number,
  frontZ: number,
  wallZ: number,
): void {
  const width = bx1 - bx0;
  const depth = wallZ - frontZ;

  for (let level = 1; level < levels; level += 1) {
    const y0 = level * H;
    const head = y0 + H - 0.5;

    // --- The projecting white L-frame around the opening ---
    // Head band.
    add(
      box(
        width + FRAME_T * 2,
        FRAME_T,
        depth * 0.55,
        m.facadeWhite,
        (bx0 + bx1) / 2,
        head + FRAME_T / 2,
        frontZ + depth * 0.2,
      ),
    );
    // Sill band (the balcony's front edge).
    add(
      box(
        width + FRAME_T * 2,
        FRAME_T * 0.9,
        depth * 0.55,
        m.facadeWhite,
        (bx0 + bx1) / 2,
        y0 - 0.05,
        frontZ + depth * 0.2,
      ),
    );
    // Side jambs.
    for (const jx of [bx0 - FRAME_T / 2, bx1 + FRAME_T / 2]) {
      add(
        box(
          FRAME_T,
          head - y0 + FRAME_T,
          depth * 0.55,
          m.facadeWhite,
          jx,
          (y0 + head) / 2,
          frontZ + depth * 0.2,
        ),
      );
    }

    // --- Dark timber soffit with recessed downlights ---
    add(
      box(
        width - 0.1,
        0.1,
        depth - 0.35,
        m.balconyCeiling,
        (bx0 + bx1) / 2,
        head - 0.06,
        frontZ + depth / 2 + 0.15,
      ),
    );
    const lights = 4;
    for (let i = 0; i < lights; i += 1) {
      const lx = bx0 + (width * (i + 0.5)) / lights;
      add(cylinder(0.055, 0.03, m.brass, lx, head - 0.12, frontZ + depth * 0.45, { cast: false }));
    }

    // --- Glass balustrade with a steel top rail, set at the frame line ---
    const railY = y0 + 0.52;
    add(
      box(width - 0.15, 0.9, 0.025, m.glassRail, (bx0 + bx1) / 2, railY, frontZ + 0.22, {
        cast: false,
      }),
    );
    add(
      box(width - 0.15, 0.055, 0.055, m.steel, (bx0 + bx1) / 2, railY + 0.47, frontZ + 0.22, {
        cast: false,
      }),
    );

    // --- Slender timber louvre fins closing one end of the balcony ---
    // Plain stained timber, not the slatted map: at this width a tiled texture
    // reads as a solid slab instead of a fin.
    const finCount = 9;
    for (let i = 0; i < finCount; i += 1) {
      const fx = bx0 + 0.16 + i * 0.13;
      add(box(0.045, H - 0.62, 0.22, m.woodDark, fx, y0 + (H - 0.62) / 2, frontZ + 0.46));
    }

    // Recessed back wall of the balcony. It is kept light: a deep loggia with a
    // dark soffit otherwise collapses to a black void, which is not how the
    // photographs read — the rear wall clearly catches bounced daylight.
    add(
      box(width, H - 0.55, 0.06, m.facadeCream, (bx0 + bx1) / 2, y0 + (H - 0.55) / 2, wallZ - 0.04),
    );
  }
}

/**
 * Projecting box surrounds on the solid bay's windows — a dark taupe frame that
 * stands proud of the render, with the glazing recessed behind it.
 */
function buildBoxWindows(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  sx0: number,
  W: number,
  levels: number,
  H: number,
  wallZ: number,
): void {
  const bayW = W - sx0;
  // Two windows per level across the solid bay.
  const cols = [sx0 + bayW * 0.32, sx0 + bayW * 0.76];
  const winW = Math.min(1.35, bayW * 0.4);
  const winH = 1.5;

  for (let level = 0; level < levels; level += 1) {
    const sill = level * H + 1.15;
    for (const [i, cx] of cols.entries()) {
      const w = i === 0 ? winW : winW * 0.72; // the outer window is narrower
      const z = wallZ - 0.06;

      // Glazing, recessed.
      add(box(w, winH, 0.03, m.glass, cx, sill + winH / 2, z - 0.02));

      // The projecting box: head, sill and two jambs. Deliberately chunky —
      // the depth of these reveals is what gives the elevation its relief.
      const t = 0.22;
      add(
        box(
          w + t * 2,
          t,
          SURROUND_PROJECT,
          m.windowSurround,
          cx,
          sill + winH + t / 2,
          z - SURROUND_PROJECT / 2,
        ),
      );
      add(
        box(
          w + t * 2,
          t,
          SURROUND_PROJECT + 0.06,
          m.windowSurround,
          cx,
          sill - t / 2,
          z - (SURROUND_PROJECT + 0.06) / 2,
        ),
      );
      for (const jx of [cx - w / 2 - t / 2, cx + w / 2 + t / 2]) {
        add(
          box(
            t,
            winH + t * 2,
            SURROUND_PROJECT,
            m.windowSurround,
            jx,
            sill + winH / 2,
            z - SURROUND_PROJECT / 2,
          ),
        );
      }
      // Light mullion inside the opening.
      add(box(0.05, winH, 0.05, m.facadeWhite, cx, sill + winH / 2, z - 0.03));
    }
  }
}

/**
 * The stack of terracotta slatted hoods over the side-wall windows — the most
 * recognisable detail on the flank elevation.
 */
function buildSlatHoods(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  W: number,
  D: number,
  levels: number,
  H: number,
): void {
  const zPositions = [D * 0.28, D * 0.55, D * 0.8];
  for (const sideX of [0, W]) {
    const dir = sideX === 0 ? -1 : 1; // which way the hood faces
    const faceX = sideX + dir * 0.02;
    for (let level = 0; level < levels; level += 1) {
      for (const [i, z] of zPositions.entries()) {
        if ((i + level) % 2 === 1) continue; // stagger, as built
        const sill = level * H + 1.2;
        const winH = 1.3;
        const winW = 1.1;

        // Recessed dark window behind the hood.
        add(box(0.06, winH, winW, m.windowSurround, faceX, sill + winH / 2, z));
        add(box(0.03, winH - 0.12, winW - 0.12, m.glass, faceX + dir * 0.03, sill + winH / 2, z));

        // The projecting slatted hood, tilted slightly down and out.
        const hood = box(
          HOOD_PROJECT,
          0.5,
          winW + 0.5,
          m.slatWood,
          faceX + (dir * HOOD_PROJECT) / 2,
          sill + winH + 0.28,
          z,
        );
        add(hood);
        // Its underside shadow plate.
        add(
          box(
            HOOD_PROJECT,
            0.06,
            winW + 0.5,
            m.windowSurround,
            faceX + (dir * HOOD_PROJECT) / 2,
            sill + winH + 0.02,
            z,
          ),
        );
      }
    }
  }
}

/** Scored reveal grooves in the render and the dark fascia at the roof line. */
function buildRevealsAndFascia(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  W: number,
  D: number,
  levels: number,
  H: number,
): void {
  const total = levels * H;

  // Groups of thin horizontal grooves high on the side walls.
  for (const sideX of [0.02, W - 0.02]) {
    for (let k = 0; k < 3; k += 1) {
      const y = total - 0.7 - k * 0.16;
      add(box(0.03, 0.035, D * 0.5, m.reveal, sideX, y, D * 0.45));
    }
  }

  // Vertical reveal pair on the front solid bay.
  for (const rx of [W * 0.66, W * 0.69]) {
    add(box(0.035, total * 0.55, 0.03, m.reveal, rx, total * 0.55, -0.055));
  }

  // Dark fascia capping the parapet. It sits on the parapet top (the parapet is
  // 1 m above the roof slab) and follows the real building line — the front
  // plane at z = 0 and both flanks — never floating out at the balcony line.
  const fasciaY = total + 1.02;
  add(box(W + 0.44, 0.09, 0.3, m.windowSurround, W / 2, fasciaY, 0.02));
  add(box(0.3, 0.09, D + 0.44, m.windowSurround, -0.02, fasciaY, D / 2));
  add(box(0.3, 0.09, D + 0.44, m.windowSurround, W + 0.02, fasciaY, D / 2));
  add(box(W + 0.44, 0.09, 0.3, m.windowSurround, W / 2, fasciaY, D - 0.02));
}

/**
 * Caps the projecting balcony block: a slim slab over the top balcony with its
 * own dark edge trim, matching the canopy on the built house.
 */
export function buildBalconyCap(m: MaterialLibrary): Group {
  const g = new Group();
  const W = ENVELOPE.width;
  const H = ENVELOPE.levelHeight;
  const total = ENVELOPE.levels * H;
  const frontZ = -ENVELOPE.frontBalcony;
  const bx0 = W * BALCONY_X0 - FRAME_T;
  const bx1 = W * BALCONY_X1 + FRAME_T;
  const width = bx1 - bx0;
  const depth = -frontZ;

  const slab = box(
    width,
    0.22,
    depth + 0.3,
    m.facadeWhite,
    (bx0 + bx1) / 2,
    total + 0.11,
    frontZ + depth / 2 - 0.15,
  );
  slab.userData.exteriorWall = true;
  g.add(slab);
  const trim = box(
    width + 0.12,
    0.08,
    0.22,
    m.windowSurround,
    (bx0 + bx1) / 2,
    total + 0.24,
    frontZ - 0.06,
  );
  trim.userData.exteriorWall = true;
  g.add(trim);
  return g;
}

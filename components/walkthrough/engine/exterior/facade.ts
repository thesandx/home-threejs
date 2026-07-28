/**
 * The front elevation, modelled directly from the architectural reference
 * render. Proportions below were measured off that image and expressed as
 * fractions of the frontage width, so the composition holds if the plan changes.
 *
 * Reading the elevation left to right:
 *
 *   | white   | stair tower:      | thick white picture-frame  | cream bay:  | white |
 *   | pilaster| teak panels       | wrapping TWO stacked       | two charcoal| fin   |
 *   |         | alternating with  | balconies (teak plank      | box-framed  | with  |
 *   |         | near-black glazing| soffit + downlights +      | windows     | three |
 *   |         |                   | pendant, teak louvres,     |             |grooves|
 *   |         |                   | glass rail + steel toprail)|             |       |
 *
 * Under the frame sits the entrance porch: a lit teak soffit, a timber door and
 * the column that carries the balcony block. A charcoal fascia caps every roof
 * edge. Everything is static, batched by `mergeStatic`, and tagged
 * `exteriorWall` so the "hide walls" control peels it away with the shell.
 */

import { Group, type Object3D } from 'three';

import { box, cylinder } from '../geometry';
import type { MaterialLibrary } from '../materials';
import { ENVELOPE } from '../plan';

// --- Bay divisions, as fractions of the frontage width ---------------------
// Measured off the reference elevation, then mirrored: the street camera looks
// along +z, which puts +x on the left of frame, so the fractions are flipped to
// keep the tower on the viewer's left and the fin on the right, as drawn.
const PILASTER_X0 = 0.928; // white pilaster at the tower's outer edge
const TOWER_X0 = 0.795; // stair tower with the teak cladding
const TOWER_X1 = 0.928;
const FRAME_X0 = 0.301; // outer edges of the white picture-frame
const FRAME_X1 = 0.771;
const BAY_X0 = 0.096; // cream bay carrying the box windows
const BAY_X1 = 0.301;
const FIN_X1 = 0.096; // white grooved fin at the far edge

const FRAME_BAND = 0.58; // width of the white frame's bands
const FRAME_PROJECT = 0.95; // how far the frame stands proud of the balcony

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
  const total = levels * H;
  const frontZ = -ENVELOPE.frontBalcony; // outer face of the balcony block
  const add = (o: Object3D): void => void g.add(tag(o));

  buildFieldAndPilasters(add, m, W, total, H);
  buildStairTower(add, m, W, total, H);
  buildBalconyFrame(add, m, W, H, levels, frontZ);
  buildBoxWindows(add, m, W, levels, H);
  buildGroovedFin(add, m, W, total);
  buildPorch(add, m, W, H, frontZ);
  buildFascia(add, m, W, D, total);
  buildSideDetail(add, m, W, D, levels, H);

  return g;
}

/** The cream render field plus the plain white pilaster at the left edge. */
function buildFieldAndPilasters(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  W: number,
  total: number,
  H: number,
): void {
  // Render field across the whole frontage, held just proud of the structure.
  add(box(W, total, 0.06, m.facadeCream, W / 2, total / 2, -0.03));

  // White pilaster beside the tower, full height and stepping above the roof.
  const pw = W * (1 - PILASTER_X0);
  add(box(pw, total + 0.55, 0.42, m.facadeWhite, W - pw / 2, (total + 0.55) / 2, -0.16));

  // The cream bay behind the box windows is a slightly warmer, rougher render.
  const bayW = W * (BAY_X1 - BAY_X0);
  add(box(bayW, total, 0.05, m.facadeTan, W * BAY_X0 + bayW / 2, total / 2, -0.08));
  void H;
}

/**
 * The stair tower: teak-clad panels alternating up the bay with tall panes of
 * near-black glazing, exactly as the reference stacks them.
 */
function buildStairTower(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  W: number,
  total: number,
  H: number,
): void {
  const x0 = W * TOWER_X0;
  const x1 = W * TOWER_X1;
  const bw = x1 - x0;
  const cx = (x0 + x1) / 2;

  // Recessed dark backing the whole height, so gaps between panels read dark.
  add(box(bw, total, 0.05, m.darkGlazing, cx, total / 2, 0.01));

  // Alternate a clad panel and a glazed panel every half-storey.
  const bandH = H / 2;
  const bands = Math.floor(total / bandH);
  for (let i = 0; i < bands; i += 1) {
    const y0 = i * bandH;
    if (i % 2 === 0) {
      // Teak panel, projecting proud of the glazing line.
      add(box(bw * 0.86, bandH * 0.72, 0.16, m.teak, cx, y0 + bandH * 0.5, -0.11));
    } else {
      // Glazed slot with a slim charcoal frame.
      add(box(bw * 0.78, bandH * 0.78, 0.03, m.darkGlazing, cx, y0 + bandH * 0.5, -0.05));
      add(box(bw * 0.82, 0.05, 0.07, m.charcoal, cx, y0 + bandH * 0.11, -0.06));
      add(box(bw * 0.82, 0.05, 0.07, m.charcoal, cx, y0 + bandH * 0.89, -0.06));
    }
  }
  // Slim white reveals framing the tower on both sides.
  add(box(0.1, total, 0.2, m.facadeWhite, x0 - 0.05, total / 2, -0.09));
  add(box(0.1, total, 0.2, m.facadeWhite, x1 + 0.05, total / 2, -0.09));
}

/**
 * The white picture-frame and the two balconies inside it.
 *
 * The frame is a projecting rectangle outline — two verticals plus a top,
 * middle and bottom band — and each balcony behind it gets a teak plank soffit
 * with three downlights, a pendant lamp, a glass balustrade with a steel top
 * rail, a sliding door with sheer curtains, and teak louvres closing its left.
 */
function buildBalconyFrame(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  W: number,
  H: number,
  levels: number,
  frontZ: number,
): void {
  const x0 = W * FRAME_X0;
  const x1 = W * FRAME_X1;
  const width = x1 - x0;
  const cx = (x0 + x1) / 2;
  // The frame sits forward of the balcony edge so it reads as a picture frame
  // standing proud of the void, which is the elevation's dominant move.
  const zc = frontZ - FRAME_PROJECT / 2 + 0.25;

  const bottomY = H - 0.55; // underside band, below the first balcony
  const topY = levels * H - 0.2; // head band, just under the roof

  // --- Frame bands ---
  add(box(width, FRAME_BAND, FRAME_PROJECT, m.facadeWhite, cx, topY, zc)); // head
  add(box(width, FRAME_BAND, FRAME_PROJECT, m.facadeWhite, cx, bottomY, zc)); // base
  add(box(width, FRAME_BAND * 0.8, FRAME_PROJECT, m.facadeWhite, cx, 2 * H - 0.28, zc)); // mid
  for (const jx of [x0 + FRAME_BAND / 2, x1 - FRAME_BAND / 2]) {
    add(
      box(FRAME_BAND, topY - bottomY, FRAME_PROJECT, m.facadeWhite, jx, (topY + bottomY) / 2, zc),
    );
  }

  // --- One balcony per upper level ---
  const innerX0 = x0 + FRAME_BAND;
  const innerX1 = x1 - FRAME_BAND;
  const innerW = innerX1 - innerX0;
  const innerCx = (innerX0 + innerX1) / 2;
  const depth = -frontZ;

  for (let level = 1; level < levels; level += 1) {
    const floorY = level * H;
    const soffitY = floorY + H - 0.62;

    // Teak plank soffit.
    add(
      box(innerW, 0.1, depth - 0.3, m.teak, innerCx, soffitY, frontZ + depth / 2 + 0.15, {
        cast: false,
      }),
    );
    // Three recessed downlights, as drawn.
    for (let i = 0; i < 3; i += 1) {
      const lx = innerX0 + (innerW * (i + 0.5)) / 3;
      add(
        cylinder(0.07, 0.03, m.downlight, lx, soffitY - 0.06, frontZ + depth * 0.55, {
          cast: false,
        }),
      );
    }
    // Pendant lamp on a slim drop.
    add(
      cylinder(0.012, 0.5, m.charcoal, innerCx, soffitY - 0.3, frontZ + depth * 0.45, {
        cast: false,
      }),
    );
    add(
      cylinder(0.08, 0.14, m.charcoal, innerCx, soffitY - 0.62, frontZ + depth * 0.45, {
        cast: false,
      }),
    );
    add(
      cylinder(0.05, 0.07, m.downlight, innerCx, soffitY - 0.66, frontZ + depth * 0.45, {
        cast: false,
      }),
    );

    // Sliding door with a charcoal frame and sheer curtains behind.
    const doorW = innerW * 0.55;
    const doorH = 2.15;
    add(box(doorW, doorH, 0.04, m.darkGlazing, innerCx, floorY + doorH / 2, -0.02));
    add(box(doorW * 0.92, doorH * 0.9, 0.02, m.curtain, innerCx, floorY + doorH / 2, 0.01));
    add(box(doorW + 0.12, 0.09, 0.1, m.charcoal, innerCx, floorY + doorH, -0.03));
    add(box(0.09, doorH, 0.1, m.charcoal, innerCx - doorW / 2, floorY + doorH / 2, -0.03));
    add(box(0.09, doorH, 0.1, m.charcoal, innerCx + doorW / 2, floorY + doorH / 2, -0.03));
    add(box(0.06, doorH, 0.08, m.charcoal, innerCx, floorY + doorH / 2, -0.04));

    // Glass balustrade with a steel top rail and a lower rail.
    const railH = 1.06;
    add(
      box(innerW, railH - 0.1, 0.02, m.glassRail, innerCx, floorY + railH / 2, frontZ + 0.16, {
        cast: false,
      }),
    );
    add(
      box(innerW + 0.06, 0.05, 0.05, m.steel, innerCx, floorY + railH, frontZ + 0.16, {
        cast: false,
      }),
    );
    add(
      box(innerW + 0.06, 0.03, 0.03, m.steel, innerCx, floorY + railH * 0.52, frontZ + 0.16, {
        cast: false,
      }),
    );

    // Teak louvres closing the left end of the balcony, floor to soffit.
    for (let i = 0; i < 6; i += 1) {
      const fx = innerX0 + 0.1 + i * 0.115;
      add(
        box(
          0.055,
          soffitY - floorY - 0.05,
          0.16,
          m.teak,
          fx,
          (floorY + soffitY) / 2,
          frontZ + 0.42,
        ),
      );
    }
  }
}

/** The cream bay's two charcoal box-framed windows, one per upper level. */
function buildBoxWindows(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  W: number,
  levels: number,
  H: number,
): void {
  const bx0 = W * BAY_X0;
  const bayW = W * (BAY_X1 - BAY_X0);
  const cx = bx0 + bayW * 0.54;
  const winW = Math.min(1.3, bayW * 0.62);
  const winH = 1.45;
  const t = 0.14;
  const proj = 0.2;

  for (let level = 1; level < levels; level += 1) {
    const sill = level * H + 0.95;
    // Glazing with a sheer curtain behind it.
    add(box(winW, winH, 0.03, m.darkGlazing, cx, sill + winH / 2, -0.07));
    add(box(winW * 0.9, winH * 0.9, 0.02, m.curtain, cx, sill + winH / 2, -0.04));
    // Charcoal box surround: head, sill, jambs and a centre mullion.
    add(box(winW + t * 2, t, proj, m.charcoal, cx, sill + winH + t / 2, -proj / 2 - 0.04));
    add(box(winW + t * 2, t, proj, m.charcoal, cx, sill - t / 2, -proj / 2 - 0.04));
    for (const jx of [cx - winW / 2 - t / 2, cx + winW / 2 + t / 2]) {
      add(box(t, winH + t * 2, proj, m.charcoal, jx, sill + winH / 2, -proj / 2 - 0.04));
    }
    add(box(0.06, winH, 0.06, m.charcoal, cx, sill + winH / 2, -0.09));
  }
}

/** The white fin at the right edge, scored with three vertical grooves. */
function buildGroovedFin(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  W: number,
  total: number,
): void {
  const fw = W * FIN_X1;
  const cx = fw / 2;
  const y0 = total * 0.28;
  const h = total * 0.68;

  add(box(fw, h, 0.5, m.facadeWhite, cx, y0 + h / 2, -0.22));
  // Three slim grooves down its face.
  for (let i = 0; i < 3; i += 1) {
    const gx = cx - fw * 0.24 + i * fw * 0.24;
    add(box(0.045, h - 0.5, 0.05, m.reveal, gx, y0 + h / 2, -0.47));
  }
}

/** The entrance porch: lit teak soffit, timber door and the carrying column. */
function buildPorch(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  W: number,
  H: number,
  frontZ: number,
): void {
  const x0 = W * FRAME_X0 + FRAME_BAND;
  const x1 = W * FRAME_X1 - FRAME_BAND;
  const cx = (x0 + x1) / 2;
  const depth = -frontZ;

  // Teak soffit under the balcony block, with downlights.
  add(
    box(x1 - x0, 0.1, depth - 0.4, m.teak, cx, H - 0.72, frontZ + depth / 2 + 0.2, { cast: false }),
  );
  for (let i = 0; i < 3; i += 1) {
    const lx = x0 + ((x1 - x0) * (i + 0.5)) / 3;
    add(cylinder(0.07, 0.03, m.downlight, lx, H - 0.78, frontZ + depth * 0.5, { cast: false }));
  }

  // Column on the right of the porch carrying the frame above.
  add(box(0.3, H - 0.7, 0.3, m.facadeWhite, x1 - 0.15, (H - 0.7) / 2, frontZ + 0.3));

  // Timber entrance door, set back at the house wall, with a side light.
  add(box(1.05, 2.15, 0.08, m.doorWood, cx - 0.3, 1.075, -0.09));
  add(box(0.09, 2.15, 0.1, m.charcoal, cx - 0.87, 1.075, -0.1));
  add(box(0.09, 2.15, 0.1, m.charcoal, cx + 0.27, 1.075, -0.1));
  // Glazed panel beside the door.
  add(box(1.0, 1.9, 0.04, m.darkGlazing, cx + 1.1, 1.15, -0.08));
  // Wall-mounted lamp.
  add(box(0.1, 0.26, 0.1, m.charcoal, x0 - 0.25, 1.95, -0.12, { cast: false }));
  add(box(0.06, 0.1, 0.06, m.downlight, x0 - 0.25, 1.82, -0.12, { cast: false }));
}

/** Charcoal fascia capping the parapet on the front and both flanks. */
function buildFascia(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  W: number,
  D: number,
  total: number,
): void {
  const y = total + 1.02;
  add(box(W + 0.5, 0.12, 0.34, m.charcoal, W / 2, y, 0.02));
  add(box(0.34, 0.12, D + 0.5, m.charcoal, -0.02, y, D / 2));
  add(box(0.34, 0.12, D + 0.5, m.charcoal, W + 0.02, y, D / 2));
  add(box(W + 0.5, 0.12, 0.34, m.charcoal, W / 2, y, D - 0.02));
  // A second, lower fascia over the balcony-frame head, as drawn.
  const fx0 = W * FRAME_X0;
  const fx1 = W * FRAME_X1;
  add(
    box(
      fx1 - fx0 + 0.3,
      0.1,
      0.3,
      m.charcoal,
      (fx0 + fx1) / 2,
      total + 0.16,
      -ENVELOPE.frontBalcony + 0.1,
    ),
  );
}

/** Charcoal box windows repeated down the flank walls. */
function buildSideDetail(
  add: (o: Object3D) => void,
  m: MaterialLibrary,
  W: number,
  D: number,
  levels: number,
  H: number,
): void {
  const zs = [D * 0.3, D * 0.58, D * 0.84];
  for (const sideX of [0, W]) {
    const dir = sideX === 0 ? -1 : 1;
    const face = sideX + dir * 0.03;
    for (let level = 0; level < levels; level += 1) {
      for (const z of zs) {
        const sill = level * H + 1.1;
        const wh = 1.3;
        const ww = 1.0;
        add(box(0.04, wh, ww, m.darkGlazing, face, sill + wh / 2, z));
        const t = 0.13;
        add(box(0.18, t, ww + t * 2, m.charcoal, face + dir * 0.09, sill + wh + t / 2, z));
        add(box(0.18, t, ww + t * 2, m.charcoal, face + dir * 0.09, sill - t / 2, z));
        add(
          box(
            0.18,
            wh + t * 2,
            t,
            m.charcoal,
            face + dir * 0.09,
            sill + wh / 2,
            z - ww / 2 - t / 2,
          ),
        );
        add(
          box(
            0.18,
            wh + t * 2,
            t,
            m.charcoal,
            face + dir * 0.09,
            sill + wh / 2,
            z + ww / 2 + t / 2,
          ),
        );
      }
    }
  }
}

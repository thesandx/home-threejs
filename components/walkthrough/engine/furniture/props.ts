/**
 * Reusable furniture props.
 *
 * Each builder returns a `Group` whose local origin sits on the floor at the
 * piece's centre, so the placement layer only has to position and rotate it.
 * Everything is built from the shared box/cylinder/sphere primitives and the
 * shared material library — no external models — which keeps the whole furnished
 * house within a couple of hundred draw calls.
 */

import { Group, type Object3D } from 'three';

import { box, cylinder, sphere } from '../geometry';
import type { MaterialLibrary } from '../materials';

function group(...children: Object3D[]): Group {
  const g = new Group();
  for (const c of children) g.add(c);
  return g;
}

/** Sectional sofa, L-shaped, facing +z by default. */
export function sofa(m: MaterialLibrary): Group {
  const f = m.fabricLight;
  const g = group(
    box(2.6, 0.35, 0.95, f, 0, 0.2, 0),
    box(2.6, 0.55, 0.2, f, 0, 0.55, -0.42),
    box(0.2, 0.5, 0.95, f, -1.3, 0.45, 0),
    box(0.2, 0.5, 0.95, f, 1.3, 0.45, 0),
    // Chaise return.
    box(0.95, 0.35, 1.4, f, 1.25, 0.2, 0.95),
    box(0.2, 0.5, 1.4, f, 1.7, 0.45, 0.95),
  );
  // Seat cushions.
  for (const x of [-0.85, 0, 0.85]) g.add(box(0.8, 0.18, 0.85, m.cushion, x, 0.44, 0.02));
  g.add(box(0.8, 0.18, 0.85, m.cushion, 1.25, 0.44, 0.95));
  return g;
}

export function coffeeTable(m: MaterialLibrary): Group {
  return group(
    box(1.1, 0.08, 0.6, m.woodDark, 0, 0.4, 0),
    box(0.1, 0.4, 0.1, m.woodDark, -0.45, 0.2, -0.22),
    box(0.1, 0.4, 0.1, m.woodDark, 0.45, 0.2, -0.22),
    box(0.1, 0.4, 0.1, m.woodDark, -0.45, 0.2, 0.22),
    box(0.1, 0.4, 0.1, m.woodDark, 0.45, 0.2, 0.22),
  );
}

/** TV feature wall: media console, panelled backing and a large screen. */
export function tvWall(m: MaterialLibrary, width: number): Group {
  const w = Math.min(width, 3.4);
  const g = group(
    box(w, 2.4, 0.06, m.woodFurniture, 0, 1.4, -0.02),
    box(w * 0.9, 0.4, 0.4, m.woodDark, 0, 0.2, 0.18),
    box(w * 0.62, 0.9, 0.05, m.blackScreen, 0, 1.5, 0.06),
  );
  g.add(box(w * 0.58, 0.82, 0.01, m.paint(0x0b1622), 0, 1.5, 0.085));
  return g;
}

/** Dining table with chairs and a pendant cluster above. */
export function diningSet(m: MaterialLibrary): Group {
  const g = group(
    box(1.9, 0.06, 1.0, m.woodFurniture, 0, 0.75, 0),
    box(1.7, 0.5, 0.1, m.woodDark, 0, 0.45, -0.35),
    box(1.7, 0.5, 0.1, m.woodDark, 0, 0.45, 0.35),
  );
  const seatX = [-0.6, 0, 0.6];
  for (const x of seatX) {
    for (const z of [-0.62, 0.62]) {
      g.add(box(0.42, 0.06, 0.42, m.fabricWarm, x, 0.46, z));
      g.add(box(0.42, 0.5, 0.06, m.fabricWarm, x, 0.72, z + (z < 0 ? -0.18 : 0.18)));
      for (const [lx, lz] of [
        [-0.16, -0.16],
        [0.16, -0.16],
        [-0.16, 0.16],
        [0.16, 0.16],
      ] as const) {
        g.add(box(0.05, 0.46, 0.05, m.woodDark, x + lx, 0.23, z + lz));
      }
    }
  }
  // Pendant lights.
  for (const x of [-0.5, 0, 0.5]) {
    g.add(cylinder(0.001, 1.0, m.metalDark, x, 2.4, 0, { cast: false }));
    const shade = cylinder(0.11, 0.16, m.brass, x, 1.9, 0, { cast: false });
    g.add(shade);
    g.add(sphere(0.05, m.paint(0xfff2d0), x, 1.86, 0, { cast: false }));
  }
  return g;
}

/** Bed with headboard, duvet and pillows. `wide` scales a king vs queen. */
export function bed(m: MaterialLibrary, wide = 1.8): Group {
  const len = 2.1;
  const g = group(
    box(wide, 0.3, len, m.woodDark, 0, 0.2, 0),
    box(wide, 0.18, len - 0.1, m.fabricLight, 0, 0.44, 0.05),
    box(wide, 0.9, 0.1, m.fabricWarm, 0, 0.55, -len / 2 - 0.02),
    // Duvet fold.
    box(wide, 0.06, 0.7, m.cushion, 0, 0.5, len / 2 - 0.45),
  );
  for (const x of [-wide / 4, wide / 4])
    g.add(box(0.55, 0.16, 0.35, m.cushion, x, 0.52, -len / 2 + 0.35));
  return g;
}

export function nightstand(m: MaterialLibrary): Group {
  const g = group(box(0.45, 0.5, 0.4, m.woodFurniture, 0, 0.25, 0));
  g.add(cylinder(0.08, 0.28, m.brass, 0, 0.64, 0, { cast: false }));
  g.add(cylinder(0.12, 0.18, m.paint(0xf3e6c8), 0, 0.86, 0, { cast: false }));
  return g;
}

export function wardrobe(m: MaterialLibrary, width = 2.0): Group {
  const g = group(box(width, 2.4, 0.6, m.woodFurniture, 0, 1.2, 0));
  const doors = Math.max(2, Math.round(width / 0.6));
  for (let i = 0; i < doors; i += 1) {
    const x = -width / 2 + width / doors / 2 + (i * width) / doors;
    g.add(box(width / doors - 0.03, 2.3, 0.03, m.woodDark, x, 1.2, 0.31));
    g.add(cylinder(0.015, 0.3, m.brass, x + width / doors / 2 - 0.06, 1.2, 0.34, { cast: false }));
  }
  return g;
}

export function rug(m: MaterialLibrary, w: number, d: number, hex: number): Group {
  return group(box(w, 0.02, d, m.paint(hex), 0, 0.011, 0, { cast: false }));
}

/** Potted plant; `h` is the overall height. */
export function plant(m: MaterialLibrary, h = 1.4): Group {
  const g = group(cylinder(0.22, 0.4, m.woodDark, 0, 0.2, 0));
  g.add(cylinder(0.05, h - 0.4, m.plantTrunk, 0, 0.4 + (h - 0.4) / 2, 0, { cast: false }));
  const crownY = h - 0.1;
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    g.add(
      sphere(
        0.32,
        m.plantLeaf,
        Math.cos(a) * 0.22,
        crownY - 0.15 + (i % 2) * 0.12,
        Math.sin(a) * 0.22,
      ),
    );
  }
  g.add(sphere(0.36, m.plantLeaf, 0, crownY, 0));
  return g;
}

/** Kitchen run: base + upper cabinets along the -z wall, with appliances. */
export function kitchen(m: MaterialLibrary, length: number): Group {
  const g = new Group();
  const l = Math.min(length, 3.6);
  // Base cabinets + worktop.
  g.add(box(l, 0.85, 0.6, m.woodFurniture, 0, 0.425, 0));
  g.add(box(l, 0.05, 0.65, m.paint(0x2b2b30), 0, 0.88, 0));
  // Upper cabinets.
  g.add(box(l, 0.7, 0.35, m.woodDark, 0, 1.85, -0.12));
  // Sink.
  g.add(box(0.5, 0.06, 0.4, m.steel, -l / 2 + 0.6, 0.9, 0));
  g.add(cylinder(0.02, 0.3, m.steel, -l / 2 + 0.6, 1.05, -0.12, { cast: false }));
  // Cooktop + chimney.
  g.add(box(0.6, 0.02, 0.5, m.blackScreen, l / 2 - 0.7, 0.9, 0));
  g.add(box(0.7, 0.5, 0.4, m.steel, l / 2 - 0.7, 1.7, -0.1));
  // Refrigerator at the end.
  g.add(box(0.7, 1.8, 0.65, m.steel, l / 2 + 0.05, 0.9, 0.4));
  return g;
}

/** Kitchen island (added only when a room is wide enough). */
export function island(m: MaterialLibrary): Group {
  return group(
    box(1.6, 0.9, 0.8, m.woodDark, 0, 0.45, 0),
    box(1.7, 0.05, 0.9, m.marbleFloor, 0, 0.92, 0),
  );
}

/** Bathroom fittings, laid along the far and side walls. */
export function bathroom(m: MaterialLibrary): Group {
  const g = new Group();
  // Vanity + basin + mirror.
  g.add(box(0.9, 0.8, 0.5, m.woodFurniture, 0, 0.4, 0));
  g.add(box(0.95, 0.05, 0.55, m.marbleFloor, 0, 0.82, 0));
  g.add(box(0.4, 0.14, 0.3, m.porcelain, 0, 0.9, 0));
  g.add(box(0.7, 0.9, 0.03, m.glass, 0, 1.5, -0.24));
  // WC.
  g.add(box(0.4, 0.4, 0.6, m.porcelain, 0.9, 0.2, 0.2));
  g.add(box(0.42, 0.5, 0.18, m.porcelain, 0.9, 0.5, -0.05));
  // Shower corner: glass screen + head.
  g.add(box(0.03, 2.0, 1.0, m.glassRail, -0.7, 1.0, 0.5, { cast: false }));
  g.add(cylinder(0.06, 0.05, m.steel, -1.0, 2.0, 0.5, { cast: false }));
  return g;
}

/** Pooja altar: marble platform, back niche, hanging bells and a warm lamp. */
export function poojaAltar(m: MaterialLibrary): Group {
  const g = new Group();
  g.add(box(1.3, 0.5, 0.6, m.marbleFloor, 0, 0.25, 0));
  g.add(box(1.3, 1.6, 0.12, m.woodDark, 0, 1.3, -0.28));
  g.add(box(1.0, 1.0, 0.08, m.paint(0x7a1f1f), 0, 1.2, -0.2));
  g.add(sphere(0.12, m.brass, 0, 0.75, 0.05));
  for (const x of [-0.45, 0.45]) {
    g.add(cylinder(0.001, 0.5, m.metalDark, x, 2.0, -0.1, { cast: false }));
    g.add(cylinder(0.05, 0.12, m.brass, x, 1.7, -0.1, { cast: false }));
  }
  g.add(cylinder(0.08, 0.1, m.brass, 0.35, 0.58, 0.15, { cast: false }));
  return g;
}

/** Outdoor lounge chair for the balconies. */
export function outdoorChair(m: MaterialLibrary): Group {
  return group(
    box(0.7, 0.12, 0.7, m.fabricWarm, 0, 0.35, 0),
    box(0.7, 0.5, 0.1, m.fabricWarm, 0, 0.6, -0.3),
    box(0.08, 0.35, 0.08, m.woodDark, -0.3, 0.17, -0.3),
    box(0.08, 0.35, 0.08, m.woodDark, 0.3, 0.17, -0.3),
    box(0.08, 0.35, 0.08, m.woodDark, -0.3, 0.17, 0.3),
    box(0.08, 0.35, 0.08, m.woodDark, 0.3, 0.17, 0.3),
  );
}

export function sideTableRound(m: MaterialLibrary): Group {
  return group(
    cylinder(0.28, 0.05, m.woodDark, 0, 0.45, 0),
    cylinder(0.04, 0.45, m.metalDark, 0, 0.22, 0, { cast: false }),
  );
}

/**
 * Furnishing pass.
 *
 * Walks the placed rooms of every level and drops the right props into each,
 * scaled and rotated to the room's footprint. Wall-hugging pieces (beds,
 * wardrobes, kitchen runs, vanities, the TV wall, the pooja altar) are pushed
 * against a wall and turned to face the room centre; free-standing pieces sit
 * near the middle. The plan is the source of truth, so nothing is placed in a
 * room the drawing does not have.
 */

import { Group, type Object3D } from 'three';

import type { Room } from '@/types/villa';

import { box, cylinder } from '../geometry';
import type { MaterialLibrary } from '../materials';
import {
  bathroom,
  bed,
  coffeeTable,
  diningSet,
  island,
  kitchen,
  nightstand,
  outdoorChair,
  plant,
  poojaAltar,
  rug,
  sideTableRound,
  sofa,
  tvWall,
  wardrobe,
} from './props';

interface Placed {
  room: Room;
  floorY: number;
}

function put(parent: Group, child: Object3D, x: number, y: number, z: number, rotY = 0): void {
  child.position.set(x, y, z);
  child.rotation.y = rotY;
  parent.add(child);
}

export function furnishHouse(m: MaterialLibrary, rooms: Placed[]): Group {
  const root = new Group();
  root.name = 'furniture';
  for (const placed of rooms) furnishRoom(root, m, placed);
  return root;
}

function furnishRoom(root: Group, m: MaterialLibrary, placed: Placed): void {
  const { room, floorY } = placed;
  const { x0, z0, x1, z1 } = room.rect;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const w = x1 - x0;
  const d = z1 - z0;
  const horizontal = w >= d;

  switch (room.kind) {
    case 'living': {
      put(root, rug(m, Math.min(w - 1, 4), Math.min(d - 1, 3), 0x9c8f79), cx, floorY, cz);
      put(root, sofa(m), cx - 0.4, floorY, cz + 0.6, Math.PI);
      put(root, coffeeTable(m), cx - 0.2, floorY, cz - 0.4);
      put(root, tvWall(m, w * 0.6), cx, floorY, z0 + 0.2, 0);
      put(root, plant(m, 1.7), x1 - 0.6, floorY, z1 - 0.6);
      put(root, plant(m, 1.3), x0 + 0.6, floorY, z1 - 0.6);
      break;
    }
    case 'dining': {
      put(root, diningSet(m), cx, floorY, cz, horizontal ? 0 : Math.PI / 2);
      put(root, plant(m, 1.5), x1 - 0.5, floorY, z0 + 0.5);
      break;
    }
    case 'kitchen': {
      if (horizontal) {
        put(root, kitchen(m, w), cx, floorY, z0 + 0.35, 0);
      } else {
        put(root, kitchen(m, d), x1 - 0.35, floorY, cz, -Math.PI / 2);
      }
      if (w > 3 && d > 3) put(root, island(m), cx, floorY, cz + 0.2);
      break;
    }
    case 'bedroom': {
      const wide = room.id === 'master' ? 1.9 : 1.6;
      put(root, bed(m, wide), cx, floorY, z0 + 1.4, 0);
      put(root, nightstand(m), cx - wide / 2 - 0.35, floorY, z0 + 0.7);
      put(root, nightstand(m), cx + wide / 2 + 0.35, floorY, z0 + 0.7);
      put(root, wardrobe(m, Math.min(w - 1, 2.4)), cx, floorY, z1 - 0.35, Math.PI);
      put(root, rug(m, wide + 1, 2, 0x8a7c66), cx, floorY, z0 + 2.4);
      put(root, plant(m, 1.4), x1 - 0.5, floorY, z1 - 0.6);
      break;
    }
    case 'bathroom': {
      put(root, bathroom(m), x0 + 0.7, floorY, cz, horizontal ? 0 : Math.PI / 2);
      break;
    }
    case 'pooja': {
      put(root, poojaAltar(m), cx, floorY, z1 - 0.4, Math.PI);
      break;
    }
    case 'utility': {
      put(root, washerBlock(m), x0 + 0.6, floorY, cz);
      break;
    }
    case 'balcony': {
      const front = z0 < 0;
      const railZ = front ? z0 + 0.9 : z1 - 0.9;
      put(root, outdoorChair(m), cx - 1.2, floorY, railZ, front ? 0 : Math.PI);
      put(root, sideTableRound(m), cx, floorY, railZ);
      put(root, outdoorChair(m), cx + 1.2, floorY, railZ, front ? 0 : Math.PI);
      for (const px of [x0 + 0.6, x1 - 0.6]) put(root, plant(m, 1.3), px, floorY, cz);
      break;
    }
    default:
      break;
  }
}

/** A simple front-loading washer for the utility room. */
function washerBlock(m: MaterialLibrary): Group {
  const g = new Group();
  g.add(box(0.6, 0.85, 0.6, m.steel, 0, 0.425, 0));
  g.add(cylinder(0.18, 0.05, m.blackScreen, 0, 0.45, 0.31, { cast: false }));
  return g;
}

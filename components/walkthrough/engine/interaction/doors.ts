/**
 * Door interaction.
 *
 * Doors are hinged leaves built by the house builder. This system animates each
 * leaf between closed and open, and opens or closes whichever door is nearest
 * the player when they interact. Proximity beats ray-picking here: the player
 * is usually right in the doorway, and a distance test never misses a thin leaf.
 */

import type { Vector3 } from 'three';

import type { DoorHandle } from '../types';

const REACH = 2.4;
const SPEED = 2.6;

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

export class DoorSystem {
  constructor(private readonly doors: DoorHandle[]) {}

  /** Open or close the door closest to the player, if one is within reach. */
  interact(playerPos: Vector3): boolean {
    let nearest: DoorHandle | null = null;
    let best = REACH * REACH;
    for (const door of this.doors) {
      const dx = door.worldPosition.x - playerPos.x;
      const dz = door.worldPosition.z - playerPos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < best) {
        best = d2;
        nearest = door;
      }
    }
    if (!nearest) return false;
    nearest.open = !nearest.open;
    return true;
  }

  openAll(open: boolean): void {
    for (const door of this.doors) door.open = open;
  }

  update(dt: number): void {
    for (const door of this.doors) {
      const target = door.open ? 1 : 0;
      if (door.progress === target) continue;
      const dir = Math.sign(target - door.progress);
      door.progress = Math.max(0, Math.min(1, door.progress + dir * SPEED * dt));
      const a = door.closedAngle + (door.openAngle - door.closedAngle) * easeInOut(door.progress);
      door.pivot.rotation.y = a;
    }
  }
}

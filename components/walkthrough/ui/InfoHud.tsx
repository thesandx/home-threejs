'use client';

/**
 * Heads-up display: crosshair, a compact status chip, and the help panel.
 *
 * Purely presentational. The crosshair only shows while pointer lock is held,
 * so it doubles as a "you are walking" indicator.
 */

import type { CameraMode } from '../engine/controls/cameras';
import type { TimeOfDayId } from '../engine/timeOfDay';

const TIME_LABEL: Record<TimeOfDayId, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  golden: 'Golden Hour',
  evening: 'Evening',
  night: 'Night',
  rainy: 'Rainy',
};

const MODE_LABEL: Record<CameraMode, string> = {
  'first-person': 'First Person',
  orbit: 'Orbit',
  top: 'Top View',
  street: 'Street',
  drone: 'Drone',
  architect: 'Architect',
  cinematic: 'Cinematic Tour',
};

export interface InfoHudProps {
  locked: boolean;
  mode: CameraMode;
  time: TimeOfDayId;
  floor: number;
  fps: number;
  helpOpen: boolean;
  onCloseHelp: () => void;
}

const FLOORS = ['Ground', 'First', 'Second'];

export function InfoHud({ locked, mode, time, floor, fps, helpOpen, onCloseHelp }: InfoHudProps) {
  return (
    <>
      {locked && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="h-5 w-5 rounded-full border border-white/70 mix-blend-difference" />
        </div>
      )}

      <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-1 text-right">
        <div className="rounded-lg bg-black/45 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-md">
          {MODE_LABEL[mode]} · {TIME_LABEL[time]}
        </div>
        <div className="rounded-lg bg-black/45 px-3 py-1 text-[11px] text-white/60 backdrop-blur-md">
          {FLOORS[floor] ?? 'Ground'} floor · {fps} fps
        </div>
      </div>

      {helpOpen && (
        <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/90 p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Controls</h2>
              <button
                type="button"
                onClick={onCloseHelp}
                className="min-h-9 rounded-lg bg-white/10 px-3 text-sm hover:bg-white/20"
              >
                Close
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm text-white/80">
              <Row k="W A S D / Arrows" v="Walk" />
              <Row k="Mouse" v="Look around" />
              <Row k="Shift" v="Run" />
              <Row k="Space" v="Jump" />
              <Row k="C / Ctrl" v="Crouch" />
              <Row k="E" v="Open the nearest door or gate" />
              <Row k="Esc" v="Release the mouse" />
              <Row k="Camera bar" v="Orbit, drone, top, street & auto tour" />
              <Row k="Roof / Walls" v="Peel the shell to see inside" />
            </dl>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="font-mono text-xs text-amber-300/90">{k}</dt>
      <dd className="text-right text-white/80">{v}</dd>
    </div>
  );
}

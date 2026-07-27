'use client';

/**
 * The on-screen control bar.
 *
 * A presentational component: it renders grouped pill buttons and calls the
 * handlers it is given. It holds no engine reference and imports no three.js,
 * so it stays a tiny client bundle. Labels are declared locally to avoid
 * pulling the engine's runtime modules into the UI chunk.
 *
 * Mobile-first: the groups wrap and every control is at least a 44px touch
 * target, so the bar collapses cleanly onto a phone.
 */

import type { CameraMode } from '../engine/controls/cameras';
import type { TimeOfDayId } from '../engine/timeOfDay';

const TIMES: { id: TimeOfDayId; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'golden', label: 'Golden' },
  { id: 'evening', label: 'Evening' },
  { id: 'night', label: 'Night' },
  { id: 'rainy', label: 'Rainy' },
];

const CAMERAS: { id: CameraMode; label: string }[] = [
  { id: 'first-person', label: 'Walk' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'top', label: 'Top' },
  { id: 'street', label: 'Street' },
  { id: 'drone', label: 'Drone' },
  { id: 'architect', label: 'Architect' },
  { id: 'cinematic', label: 'Cinematic' },
];

const FLOORS = ['Ground', 'First', 'Second'];

export interface ControlBarProps {
  time: TimeOfDayId;
  mode: CameraMode;
  floor: number;
  interiorOn: boolean;
  roofHidden: boolean;
  wallsHidden: boolean;
  onTime: (id: TimeOfDayId) => void;
  onCamera: (id: CameraMode) => void;
  onFloor: (level: number) => void;
  onLift: () => void;
  onToggleRoof: () => void;
  onToggleWalls: () => void;
  onToggleLights: () => void;
  onScreenshot: () => void;
  onHelp: () => void;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-white text-neutral-900 shadow' : 'bg-white/10 text-white/90 hover:bg-white/20'
      }`}
    >
      {children}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-white/50">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function ControlBar(props: ControlBarProps) {
  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-wrap items-end gap-x-5 gap-y-3 rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-md sm:p-4">
      <Group label="Time of day">
        {TIMES.map((t) => (
          <Pill key={t.id} active={props.time === t.id} onClick={() => props.onTime(t.id)}>
            {t.label}
          </Pill>
        ))}
      </Group>

      <Group label="Camera">
        {CAMERAS.map((c) => (
          <Pill key={c.id} active={props.mode === c.id} onClick={() => props.onCamera(c.id)}>
            {c.label}
          </Pill>
        ))}
      </Group>

      <Group label="Floor">
        {FLOORS.map((f, i) => (
          <Pill key={f} active={props.floor === i} onClick={() => props.onFloor(i)}>
            {f}
          </Pill>
        ))}
        <Pill onClick={props.onLift}>Lift ↑</Pill>
      </Group>

      <Group label="View">
        <Pill active={props.roofHidden} onClick={props.onToggleRoof}>
          Roof
        </Pill>
        <Pill active={props.wallsHidden} onClick={props.onToggleWalls}>
          Walls
        </Pill>
        <Pill active={props.interiorOn} onClick={props.onToggleLights}>
          Lights
        </Pill>
      </Group>

      <Group label="Capture">
        <Pill onClick={props.onScreenshot}>📷 Shot</Pill>
        <Pill onClick={props.onHelp}>?</Pill>
      </Group>
    </div>
  );
}

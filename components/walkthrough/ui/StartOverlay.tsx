'use client';

/**
 * The entry / loading overlay.
 *
 * Shown while the scene is loading, and again whenever the player is in
 * first-person mode but pointer lock is not held (on load, or after pressing
 * Esc). Clicking enters the walkthrough and requests pointer lock — the browser
 * requires that request to come from a user gesture, which this button is.
 */

export interface StartOverlayProps {
  ready: boolean;
  progress: number;
  onEnter: () => void;
}

export function StartOverlay({ ready, progress, onEnter }: StartOverlayProps) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 px-6 text-center backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300/90">
        Interactive Architectural Walkthrough
      </p>
      <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
        The Luxury Villa
      </h1>
      <p className="mt-4 max-w-md text-balance text-sm text-white/70 sm:text-base">
        A three-storey 3BHK residence, walkable room by room — every wall, door and balcony placed
        to the floor plan.
      </p>

      {ready ? (
        <button
          type="button"
          onClick={onEnter}
          className="mt-8 min-h-12 rounded-full bg-white px-8 py-3 text-base font-semibold text-neutral-900 shadow-lg transition-transform hover:scale-[1.03] active:scale-95"
        >
          Enter the villa →
        </button>
      ) : (
        <div className="mt-8 w-full max-w-xs">
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-amber-300 transition-[width] duration-200 ease-out"
              style={{ width: `${Math.round(progress)}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-white/70">Building the villa… {Math.round(progress)}%</p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-white/60 sm:text-sm">
        <span>
          <kbd className="font-mono text-white/90">WASD</kbd> move
        </span>
        <span>
          <kbd className="font-mono text-white/90">Mouse</kbd> look
        </span>
        <span>
          <kbd className="font-mono text-white/90">Shift</kbd> run ·{' '}
          <kbd className="font-mono text-white/90">Space</kbd> jump
        </span>
        <span>
          <kbd className="font-mono text-white/90">E</kbd> open doors ·{' '}
          <kbd className="font-mono text-white/90">C</kbd> crouch
        </span>
      </div>
      <p className="mt-6 max-w-sm text-xs text-white/40">
        On a phone or tablet, use the Orbit, Cinematic, Drone or Top camera modes below to explore
        without a keyboard.
      </p>
    </div>
  );
}

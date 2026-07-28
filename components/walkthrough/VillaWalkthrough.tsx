'use client';

/**
 * Client entry point for the walkthrough.
 *
 * Mounts a full-viewport canvas and, in an effect (browser only), dynamically
 * imports the three.js engine and starts it. The dynamic import keeps three.js
 * out of the server render and the initial page chunk.
 *
 * Two variants share one engine:
 *  - `experience` (default): the full interactive walkthrough with UI.
 *  - `ambient`: a self-running cinematic used as the landing-page hero. No UI,
 *    no pointer lock, no audio (nothing to unlock without a gesture).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CameraMode } from './engine/controls/cameras';
import type { WalkthroughEngine, WalkthroughState } from './engine/Engine';
import type { TimeOfDayId } from './engine/timeOfDay';
import { ControlBar } from './ui/ControlBar';
import { InfoHud } from './ui/InfoHud';
import { StartOverlay } from './ui/StartOverlay';

const INITIAL_STATE: WalkthroughState = {
  ready: false,
  locked: false,
  mode: 'first-person',
  time: 'afternoon',
  floor: 0,
  interiorOn: false,
  roofHidden: false,
  wallsHidden: false,
  muted: false,
  fps: 0,
};

export interface VillaWalkthroughProps {
  variant?: 'experience' | 'ambient';
}

export function VillaWalkthrough({ variant = 'experience' }: VillaWalkthroughProps) {
  const ambient = variant === 'ambient';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WalkthroughEngine | null>(null);
  const [state, setState] = useState<WalkthroughState>(INITIAL_STATE);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(8);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: WalkthroughEngine | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const { WalkthroughEngine: Engine } = await import('./engine/Engine');
        if (cancelled) return;
        engine = new Engine(canvas, { ambient });
        engine.onState(setState);
        engine.start();
        engineRef.current = engine;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start the 3D engine.');
      }
    })();

    const onKey = (e: KeyboardEvent): void => {
      if (!ambient && e.code === 'KeyE') engineRef.current?.interact();
    };
    if (!ambient) window.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      if (!ambient) window.removeEventListener('keydown', onKey);
      engine?.dispose();
      engineRef.current = null;
    };
  }, [ambient]);

  // Perceived loading progress: ramp toward 92% until the engine reports ready,
  // then the render snaps it to 100 (no synchronous setState in the effect).
  useEffect(() => {
    if (ambient || state.ready) return;
    const id = window.setInterval(() => {
      setProgress((p) => (p < 92 ? p + Math.max(1, (92 - p) * 0.12) : p));
    }, 120);
    return () => window.clearInterval(id);
  }, [ambient, state.ready]);

  const engine = () => engineRef.current;
  const onEnter = useCallback(() => engine()?.enterFirstPerson(), []);
  const onTime = useCallback((id: TimeOfDayId) => engine()?.setTime(id), []);
  const onCamera = useCallback((mode: CameraMode) => engine()?.setCameraMode(mode), []);
  const onFloor = useCallback((level: number) => engine()?.goToFloor(level), []);
  const onLift = useCallback(() => engine()?.useLift(), []);
  const onToggleRoof = useCallback(() => engine()?.toggleRoof(), []);
  const onToggleWalls = useCallback(() => engine()?.toggleWalls(), []);
  const onToggleLights = useCallback(() => engine()?.toggleInterior(), []);
  const onToggleMute = useCallback(() => engine()?.toggleMute(), []);
  const onScreenshot = useCallback(() => {
    const url = engine()?.screenshot();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'luxury-villa.png';
    a.click();
  }, []);

  // Ambient hero: just the canvas filling its parent, plus a graceful fallback.
  if (ambient) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
        {error && (
          <div
            className="absolute inset-0 bg-gradient-to-b from-neutral-800 to-neutral-950"
            aria-hidden
          />
        )}
      </div>
    );
  }

  const showStart = !error && state.mode === 'first-person' && !state.locked;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-neutral-950">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />

      {error ? (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
          <p className="text-lg font-semibold">This experience needs WebGL</p>
          <p className="max-w-sm text-sm text-white/60">{error}</p>
        </div>
      ) : (
        <>
          <InfoHud
            locked={state.locked}
            mode={state.mode}
            time={state.time}
            floor={state.floor}
            fps={state.fps}
            helpOpen={helpOpen}
            onCloseHelp={() => setHelpOpen(false)}
          />

          {showStart && (
            <StartOverlay
              ready={state.ready}
              progress={state.ready ? 100 : progress}
              onEnter={onEnter}
            />
          )}

          <div className="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4">
            <ControlBar
              time={state.time}
              mode={state.mode}
              floor={state.floor}
              interiorOn={state.interiorOn}
              roofHidden={state.roofHidden}
              wallsHidden={state.wallsHidden}
              muted={state.muted}
              onTime={onTime}
              onCamera={onCamera}
              onFloor={onFloor}
              onLift={onLift}
              onToggleRoof={onToggleRoof}
              onToggleWalls={onToggleWalls}
              onToggleLights={onToggleLights}
              onToggleMute={onToggleMute}
              onScreenshot={onScreenshot}
              onHelp={() => setHelpOpen(true)}
            />
          </div>
        </>
      )}
    </div>
  );
}

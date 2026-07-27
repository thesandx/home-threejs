'use client';

/**
 * Client entry point for the walkthrough.
 *
 * Mounts a full-viewport canvas and, in an effect (browser only), dynamically
 * imports the three.js engine and starts it. The dynamic import is deliberate:
 * it keeps three.js out of the server render and out of the initial page chunk,
 * so the route streams instantly and the ~1 MB engine loads as its own bundle.
 *
 * This component holds the React ↔ engine bridge: engine state flows in through
 * `onState`, user intent flows out through the imperative methods.
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
  fps: 0,
};

export function VillaWalkthrough() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WalkthroughEngine | null>(null);
  const [state, setState] = useState<WalkthroughState>(INITIAL_STATE);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let engine: WalkthroughEngine | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const { WalkthroughEngine: Engine } = await import('./engine/Engine');
        if (cancelled) return;
        engine = new Engine(canvas);
        engine.onState(setState);
        engine.start();
        engineRef.current = engine;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start the 3D engine.');
      }
    })();

    const onKey = (e: KeyboardEvent): void => {
      if (e.code === 'KeyE') engineRef.current?.interact();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', onKey);
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const engine = () => engineRef.current;

  const onEnter = useCallback(() => engine()?.enterFirstPerson(), []);
  const onTime = useCallback((id: TimeOfDayId) => engine()?.setTime(id), []);
  const onCamera = useCallback((mode: CameraMode) => engine()?.setCameraMode(mode), []);
  const onFloor = useCallback((level: number) => engine()?.goToFloor(level), []);
  const onLift = useCallback(() => engine()?.useLift(), []);
  const onToggleRoof = useCallback(() => engine()?.toggleRoof(), []);
  const onToggleWalls = useCallback(() => engine()?.toggleWalls(), []);
  const onToggleLights = useCallback(() => engine()?.toggleInterior(), []);
  const onScreenshot = useCallback(() => {
    const url = engine()?.screenshot();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'luxury-villa.png';
    a.click();
  }, []);

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

          {showStart && <StartOverlay ready={state.ready} onEnter={onEnter} />}

          <div className="absolute inset-x-0 bottom-0 z-10 p-3 sm:p-4">
            <ControlBar
              time={state.time}
              mode={state.mode}
              floor={state.floor}
              interiorOn={state.interiorOn}
              roofHidden={state.roofHidden}
              wallsHidden={state.wallsHidden}
              onTime={onTime}
              onCamera={onCamera}
              onFloor={onFloor}
              onLift={onLift}
              onToggleRoof={onToggleRoof}
              onToggleWalls={onToggleWalls}
              onToggleLights={onToggleLights}
              onScreenshot={onScreenshot}
              onHelp={() => setHelpOpen(true)}
            />
          </div>
        </>
      )}
    </div>
  );
}

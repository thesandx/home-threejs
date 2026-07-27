import Link from 'next/link';

/**
 * Landing page — a Server Component. It ships no JavaScript itself; the heavy
 * three.js walkthrough lives behind the `/walkthrough` route and only loads
 * when the visitor chooses to enter it.
 */
const FEATURES = [
  'First-person walk through every room of the floor plan',
  'Open doors, climb the stairs, step onto the balconies',
  'Morning to night lighting with real-time shadows',
  'Orbit, drone, top, street and auto-cinematic cameras',
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="flex flex-col items-center gap-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-accent">
          Interactive Architectural Visualization
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">The Luxury Villa</h1>
        <p className="text-muted max-w-xl text-balance text-base sm:text-lg">
          A real-time, first-person walkthrough of a three-storey 3BHK residence, built in the
          browser with Three.js — every wall, door and balcony placed to the architectural drawings.
        </p>
      </div>

      <Link
        href="/walkthrough"
        className="min-h-12 rounded-full bg-accent px-8 py-3 text-base font-semibold text-background shadow-lg transition-transform hover:scale-[1.03] active:scale-95"
      >
        Enter the walkthrough →
      </Link>

      <ul className="mt-2 grid w-full max-w-md gap-2 text-left text-sm text-muted sm:text-base">
        {FEATURES.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span aria-hidden className="mt-1 text-accent">
              ◆
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}

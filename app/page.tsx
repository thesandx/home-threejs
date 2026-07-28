import Link from 'next/link';

import { VillaWalkthrough } from '@/components/walkthrough/VillaWalkthrough';

/**
 * Landing page — a Server Component.
 *
 * The hero renders the villa live as an ambient, self-running cinematic behind
 * the headline; the message, CTA and every section are plain semantic HTML that
 * reads correctly before (and without) the 3D canvas. The composed entrance is
 * CSS-only and collapses to an instant under `prefers-reduced-motion`.
 */

const FEATURES = [
  {
    title: 'Walk every room',
    body: 'First-person movement with collision, stair climbing, openable doors, and balconies you can step onto.',
  },
  {
    title: 'Dawn to midnight',
    body: 'Six lighting moods from morning to night and rain, with real-time sun shadows and warm interior fixtures.',
  },
  {
    title: 'Seven cameras',
    body: 'First-person, orbit, top-down, street, drone, architect dolly, and an automatic cinematic tour.',
  },
  {
    title: 'True to the plan',
    body: 'Every wall is derived from the supplied 3BHK drawing — nothing invented, nothing out of place.',
  },
  {
    title: 'Synthesized sound',
    body: 'Ambient birds and wind by day, crickets by night, footsteps and doors — generated live, zero audio files.',
  },
  {
    title: 'Built to run at 60fps',
    body: 'Batched geometry, capped lights, and static shadows keep the whole furnished house drawing in ~170 calls.',
  },
] as const;

const STATS = [
  { value: '3', label: 'Floors + terrace' },
  { value: '13', label: 'Rooms per floor' },
  { value: "32'", label: 'Street frontage' },
  { value: '0', label: 'Asset files loaded' },
] as const;

const STACK = ['Next.js', 'Three.js', 'TypeScript', 'WebGL2', 'Cloud Run'] as const;

export default function HomePage() {
  return (
    <main className="bg-neutral-950 text-white">
      {/* Hero */}
      <section className="relative flex h-[100dvh] min-h-[560px] flex-col overflow-hidden">
        <VillaWalkthrough variant="ambient" />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-neutral-950/70"
        />

        <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
          <span className="text-sm font-semibold tracking-wide">◆ Luxury Villa</span>
          <Link
            href="/walkthrough"
            className="min-h-10 rounded-full border border-white/25 px-4 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
          >
            Launch
          </Link>
        </header>

        <div className="relative z-10 mt-auto px-6 pb-16 sm:px-10 sm:pb-24">
          <p className="animate-rise text-xs font-semibold uppercase tracking-[0.35em] text-amber-300/90">
            Interactive Architectural Visualization
          </p>
          <h1 className="animate-rise delay-1 mt-4 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-tight sm:text-7xl">
            The Luxury Villa
          </h1>
          <p className="animate-rise delay-2 mt-5 max-w-xl text-balance text-base text-white/70 sm:text-lg">
            A real-time, first-person walkthrough of a three-storey 3BHK residence — rendered in
            your browser from the architectural drawings.
          </p>
          <div className="animate-rise delay-3 mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/walkthrough"
              className="min-h-12 rounded-full bg-white px-8 py-3 text-base font-semibold text-neutral-900 shadow-xl transition-transform hover:scale-[1.03] active:scale-95"
            >
              Enter the walkthrough →
            </Link>
            <span className="text-sm text-white/50">WASD to move · mouse to look</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          A premium real-estate walkthrough, not a game.
        </h2>
        <p className="mt-4 max-w-xl text-white/60">
          Cinematic, immersive and accurate — explore the completed home before a brick is laid.
        </p>
        <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="bg-neutral-950 p-6 sm:p-8">
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/60">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Stats */}
      <section className="border-y border-white/10 bg-neutral-900/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-16 sm:px-10 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-semibold tracking-tight text-amber-300 sm:text-5xl">
                {s.value}
              </div>
              <div className="mt-2 text-sm text-white/50">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Tech + CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:px-10 sm:py-28">
        <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything is generated in code.
            </h2>
            <p className="mt-4 text-white/60">
              No downloaded models or textures. The house, materials, lighting and sound are all
              authored procedurally, so the experience loads fast and deploys as a single container.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {STACK.map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-white/15 px-3 py-1 text-sm text-white/70"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href="/walkthrough"
            className="min-h-12 shrink-0 rounded-full bg-amber-300 px-8 py-3 text-base font-semibold text-neutral-950 shadow-xl transition-transform hover:scale-[1.03] active:scale-95"
          >
            Step inside →
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 px-6 py-10 sm:px-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 text-sm text-white/40 sm:flex-row sm:items-center">
          <span>Luxury Villa — interactive architectural visualization.</span>
          <span>Built with Next.js and Three.js.</span>
        </div>
      </footer>
    </main>
  );
}

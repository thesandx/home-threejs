import type { Metadata } from 'next';

import { VillaWalkthrough } from '@/components/walkthrough/VillaWalkthrough';

/**
 * The walkthrough route.
 *
 * A thin Server Component that renders the client experience. All of the
 * three.js code sits inside `VillaWalkthrough`, behind a `'use client'`
 * boundary and a dynamic import, so this route adds nothing to the server
 * bundle and streams immediately.
 */
export const metadata: Metadata = {
  title: 'Villa Walkthrough',
  description:
    'A real-time first-person walkthrough of a three-storey 3BHK luxury villa, built with Three.js.',
};

export default function WalkthroughPage() {
  return <VillaWalkthrough />;
}

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '@/app/page';

/**
 * Smoke test for the landing page.
 *
 * `HomePage` is a synchronous Server Component, so React Testing Library can
 * render it directly. Async Server Components cannot be rendered this way —
 * test their data helpers in `lib/` or `services/` instead. See docs/testing.md.
 */
describe('HomePage', () => {
  it('renders the heading', () => {
    render(<HomePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'The Luxury Villa' })).toBeInTheDocument();
  });

  it('links into the walkthrough route', () => {
    render(<HomePage />);
    const link = screen.getByRole('link', { name: /enter the walkthrough/i });
    expect(link).toHaveAttribute('href', '/walkthrough');
  });
});

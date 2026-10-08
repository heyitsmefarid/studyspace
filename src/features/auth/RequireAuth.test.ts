import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { RequireAuth } from './RequireAuth';

const auth = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  profile: null,
  loading: false,
  error: null as string | null,
  retryAuth: async () => {},
  signOut: async () => {},
}));
vi.mock('./AuthProvider', () => ({ useAuth: () => auth }));

const render = () => renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/notes'] }, createElement(RequireAuth)));

describe('RequireAuth recovery', () => {
  beforeEach(() => { auth.session = null; auth.loading = false; auth.error = null; });

  it('offers retry when a signed-in member profile cannot be loaded', () => {
    auth.session = { user: { id: 'member' } };
    auth.error = "Can't reach StudySpace — check your connection.";
    const html = render();
    expect(html).toContain('role="alert"');
    expect(html).toContain('Try again');
    expect(html).toContain('Log out');
    expect(html).not.toContain("isn&#x27;t part of StudySpace");
  });

  it('offers retry for an unknown session instead of redirecting to login', () => {
    auth.error = 'Something went wrong. Please try again.';
    const html = render();
    expect(html).toContain('Try again');
    expect(html).not.toContain('Log out');
  });
});

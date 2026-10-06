import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router';
import { routes } from './routes';

// Final review I4 / Review Focus #2: the page-entrance wrapper is keyed by the deepest matched route, so navigations
// that must keep the page mounted have to resolve to the same route object (one optional-segment route).
const leaf = (path: string) => matchRoutes(routes, path)!.at(-1)!.route;

describe('routes keep same-page navigations on one route', () => {
  it.each([
    ['/tutor', '/tutor/0f8fad5b-d9cb-469f-a165-70867728950e'],
    ['/notes/a', '/notes/b'],
    ['/settings', '/settings/profile'],
    ['/profile', '/profile/someone'],
  ])('%s and %s share a route', (a, b) => {
    expect(leaf(a)).toBe(leaf(b));
  });
  it('different pages are different routes', () => {
    expect(leaf('/notes')).not.toBe(leaf('/notes/a'));
    expect(leaf('/planner')).not.toBe(leaf('/planner/ai'));
  });
});

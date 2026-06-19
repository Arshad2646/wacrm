import { describe, expect, it } from 'vitest';

import nextConfig from '../../../next.config';

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
};

const privateNoStore =
  'private, no-cache, no-store, max-age=0, must-revalidate';
const publicPageCache =
  'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';

async function loadHeaderRules() {
  const headers = nextConfig.headers;
  if (!headers) return [];
  return (await headers()) as HeaderRule[];
}

function cacheControlFor(rule: HeaderRule) {
  return rule.headers.find(
    (header) => header.key.toLowerCase() === 'cache-control'
  )?.value;
}

describe('Next.js cache headers', () => {
  it('keeps non-API app HTML private by default', async () => {
    const rules = await loadHeaderRules();
    const htmlRule = rules.find(
      (rule) => rule.source === '/:path((?!_next/static|_next/image|api).*)'
    );

    expect(cacheControlFor(htmlRule!)).toBe(privateNoStore);
  });

  it('keeps API responses private and non-cacheable', async () => {
    const rules = await loadHeaderRules();
    const apiRule = rules.find((rule) => rule.source === '/api/:path*');

    expect(cacheControlFor(apiRule!)).toBe(privateNoStore);
  });

  it('only allows public caching for explicitly public pages', async () => {
    const rules = await loadHeaderRules();
    const publicRules = rules.filter(
      (rule) => cacheControlFor(rule) === publicPageCache
    );

    expect(publicRules.map((rule) => rule.source).sort()).toEqual([
      '/',
      '/data-deletion',
      '/privacy',
      '/terms',
    ]);
  });
});

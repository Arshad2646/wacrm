import { afterEach, describe, expect, it, vi } from 'vitest';

import { isConfiguredSuperAdminEmail } from './super-admin';

describe('isConfiguredSuperAdminEmail', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('matches SUPER_ADMIN_EMAILS case-insensitively', () => {
    vi.stubEnv('SUPER_ADMIN_EMAILS', 'Owner@Example.com, ops@example.com ');

    expect(isConfiguredSuperAdminEmail('owner@example.com')).toBe(true);
    expect(isConfiguredSuperAdminEmail('OPS@example.com')).toBe(true);
  });

  it('rejects missing or unlisted emails', () => {
    vi.stubEnv('SUPER_ADMIN_EMAILS', 'owner@example.com');

    expect(isConfiguredSuperAdminEmail(null)).toBe(false);
    expect(isConfiguredSuperAdminEmail('client@example.com')).toBe(false);
  });
});

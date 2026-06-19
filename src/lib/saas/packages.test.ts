import { describe, expect, it } from 'vitest';

import {
  accountAllowsMultipleUsers,
  accountHasAdvancedCrmTools,
  accountHasFullLeads,
  ADVANCED_CRM_TOOLS_FEATURE_FLAG,
  PACKAGE_DEFAULTS,
  leadFlagsForPackage,
  resolvePackageSettings,
} from './packages';

describe('PACKAGE_DEFAULTS', () => {
  it('keeps Starter as auto-replies with Lead Lite only', () => {
    expect(PACKAGE_DEFAULTS.starter).toMatchObject({
      monthlyAiReplyLimit: 1500,
      productLimit: 20,
      leadLiteEnabled: true,
      fullLeadsEnabled: false,
    });
  });

  it('keeps Growth as auto-replies with Full Leads', () => {
    expect(PACKAGE_DEFAULTS.growth).toMatchObject({
      monthlyAiReplyLimit: 5000,
      productLimit: 100,
      leadLiteEnabled: true,
      fullLeadsEnabled: true,
    });
  });
});

describe('leadFlagsForPackage', () => {
  it('does not allow Starter to expose Full Leads even if manual flags are wrong', () => {
    expect(
      leadFlagsForPackage('starter', {
        leadLiteEnabled: false,
        fullLeadsEnabled: true,
      })
    ).toEqual({ leadLiteEnabled: true, fullLeadsEnabled: false });
  });

  it('forces Growth to expose Full Leads', () => {
    expect(
      leadFlagsForPackage('growth', {
        leadLiteEnabled: false,
        fullLeadsEnabled: false,
      })
    ).toEqual({ leadLiteEnabled: true, fullLeadsEnabled: true });
  });

  it('allows Custom to use manual lead flags', () => {
    expect(
      leadFlagsForPackage('custom', {
        leadLiteEnabled: true,
        fullLeadsEnabled: false,
      })
    ).toEqual({ leadLiteEnabled: true, fullLeadsEnabled: false });
  });
});

describe('resolvePackageSettings', () => {
  it('applies Starter defaults when requested', () => {
    expect(
      resolvePackageSettings({
        packageType: 'starter',
        monthlyAiReplyLimit: 9999,
        productLimit: 999,
        leadLiteEnabled: false,
        fullLeadsEnabled: true,
        applyPackageDefaults: true,
      })
    ).toEqual({
      monthlyAiReplyLimit: 1500,
      productLimit: 20,
      leadLiteEnabled: true,
      fullLeadsEnabled: false,
    });
  });

  it('applies Growth defaults when requested', () => {
    expect(
      resolvePackageSettings({
        packageType: 'growth',
        monthlyAiReplyLimit: 1500,
        productLimit: 20,
        leadLiteEnabled: false,
        fullLeadsEnabled: false,
        applyPackageDefaults: true,
      })
    ).toEqual({
      monthlyAiReplyLimit: 5000,
      productLimit: 100,
      leadLiteEnabled: true,
      fullLeadsEnabled: true,
    });
  });

  it('keeps Custom manual even when defaults are requested', () => {
    expect(
      resolvePackageSettings({
        packageType: 'custom',
        monthlyAiReplyLimit: 7500,
        productLimit: 250,
        leadLiteEnabled: true,
        fullLeadsEnabled: true,
        applyPackageDefaults: true,
      })
    ).toEqual({
      monthlyAiReplyLimit: 7500,
      productLimit: 250,
      leadLiteEnabled: true,
      fullLeadsEnabled: true,
    });
  });
});

describe('accountHasAdvancedCrmTools', () => {
  it('keeps Starter out of advanced CRM tools even when the flag is true', () => {
    expect(
      accountHasAdvancedCrmTools({
        package_type: 'starter',
        feature_flags: { [ADVANCED_CRM_TOOLS_FEATURE_FLAG]: true },
      })
    ).toBe(false);
  });

  it('keeps Growth and Custom off by default', () => {
    expect(
      accountHasAdvancedCrmTools({
        package_type: 'growth',
        feature_flags: {},
      })
    ).toBe(false);
    expect(
      accountHasAdvancedCrmTools({
        package_type: 'custom',
        feature_flags: {},
      })
    ).toBe(false);
  });

  it('allows advanced CRM tools for Growth or Custom when explicitly enabled', () => {
    expect(
      accountHasAdvancedCrmTools({
        package_type: 'growth',
        feature_flags: { [ADVANCED_CRM_TOOLS_FEATURE_FLAG]: true },
      })
    ).toBe(true);
    expect(
      accountHasAdvancedCrmTools({
        package_type: 'custom',
        feature_flags: { [ADVANCED_CRM_TOOLS_FEATURE_FLAG]: true },
      })
    ).toBe(true);
  });
});

describe('accountHasFullLeads', () => {
  it('keeps Starter on Lead Lite even when the row flag is wrong', () => {
    expect(
      accountHasFullLeads({
        package_type: 'starter',
        full_leads_enabled: true,
      })
    ).toBe(false);
  });

  it('treats Growth as Full Leads by package rule', () => {
    expect(
      accountHasFullLeads({
        package_type: 'growth',
        full_leads_enabled: false,
      })
    ).toBe(true);
  });

  it('requires Custom to opt into Full Leads', () => {
    expect(
      accountHasFullLeads({
        package_type: 'custom',
        full_leads_enabled: false,
      })
    ).toBe(false);
    expect(
      accountHasFullLeads({
        package_type: 'custom',
        full_leads_enabled: true,
      })
    ).toBe(true);
  });
});

describe('accountAllowsMultipleUsers', () => {
  it('blocks Starter staff invitations', () => {
    expect(accountAllowsMultipleUsers({ package_type: 'starter' })).toBe(false);
  });

  it('allows Growth and Custom staff invitations', () => {
    expect(accountAllowsMultipleUsers({ package_type: 'growth' })).toBe(true);
    expect(accountAllowsMultipleUsers({ package_type: 'custom' })).toBe(true);
  });
});

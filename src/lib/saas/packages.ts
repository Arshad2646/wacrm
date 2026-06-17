export const PACKAGE_TYPES = ['starter', 'growth', 'custom'] as const;

export type PackageType = (typeof PACKAGE_TYPES)[number];

export interface PackageDefaults {
  monthlyAiReplyLimit: number;
  productLimit: number;
  leadLiteEnabled: boolean;
  fullLeadsEnabled: boolean;
}

export interface PackageSettingsInput {
  packageType: PackageType;
  monthlyAiReplyLimit: number;
  productLimit: number;
  leadLiteEnabled: boolean;
  fullLeadsEnabled: boolean;
  applyPackageDefaults: boolean;
}

export interface ResolvedPackageSettings {
  monthlyAiReplyLimit: number;
  productLimit: number;
  leadLiteEnabled: boolean;
  fullLeadsEnabled: boolean;
}

export const ADVANCED_CRM_TOOLS_FEATURE_FLAG = 'advanced_crm_tools_enabled';

export interface AccountFeatureGateInput {
  package_type?: PackageType | null;
  feature_flags?: Record<string, unknown> | null;
}

export const PACKAGE_DEFAULTS: Record<PackageType, PackageDefaults> = {
  starter: {
    monthlyAiReplyLimit: 1500,
    productLimit: 20,
    leadLiteEnabled: true,
    fullLeadsEnabled: false,
  },
  growth: {
    monthlyAiReplyLimit: 5000,
    productLimit: 100,
    leadLiteEnabled: true,
    fullLeadsEnabled: true,
  },
  custom: {
    monthlyAiReplyLimit: 1500,
    productLimit: 20,
    leadLiteEnabled: true,
    fullLeadsEnabled: false,
  },
};

export function isPackageType(value: unknown): value is PackageType {
  return (
    typeof value === 'string' &&
    (PACKAGE_TYPES as readonly string[]).includes(value)
  );
}

export function leadFlagsForPackage(
  packageType: PackageType,
  manual: Pick<PackageDefaults, 'leadLiteEnabled' | 'fullLeadsEnabled'>
): Pick<PackageDefaults, 'leadLiteEnabled' | 'fullLeadsEnabled'> {
  if (packageType === 'starter') {
    return { leadLiteEnabled: true, fullLeadsEnabled: false };
  }
  if (packageType === 'growth') {
    return { leadLiteEnabled: true, fullLeadsEnabled: true };
  }
  return manual;
}

export function resolvePackageSettings({
  packageType,
  monthlyAiReplyLimit,
  productLimit,
  leadLiteEnabled,
  fullLeadsEnabled,
  applyPackageDefaults,
}: PackageSettingsInput): ResolvedPackageSettings {
  if (applyPackageDefaults && packageType !== 'custom') {
    const defaults = PACKAGE_DEFAULTS[packageType];
    return {
      monthlyAiReplyLimit: defaults.monthlyAiReplyLimit,
      productLimit: defaults.productLimit,
      ...leadFlagsForPackage(packageType, {
        leadLiteEnabled: defaults.leadLiteEnabled,
        fullLeadsEnabled: defaults.fullLeadsEnabled,
      }),
    };
  }

  return {
    monthlyAiReplyLimit,
    productLimit,
    ...leadFlagsForPackage(packageType, {
      leadLiteEnabled,
      fullLeadsEnabled,
    }),
  };
}

export function accountHasAdvancedCrmTools(
  account: AccountFeatureGateInput | null | undefined
) {
  if (!account || account.package_type === 'starter') return false;
  return account.feature_flags?.[ADVANCED_CRM_TOOLS_FEATURE_FLAG] === true;
}

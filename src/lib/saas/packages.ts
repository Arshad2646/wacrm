export const PACKAGE_TYPES = ['starter', 'growth', 'custom'] as const;

export type PackageType = (typeof PACKAGE_TYPES)[number];

export interface PackageDefaults {
  monthlyAiReplyLimit: number;
  productLimit: number;
  leadLiteEnabled: boolean;
  fullLeadsEnabled: boolean;
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

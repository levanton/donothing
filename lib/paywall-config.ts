// Single source of truth for paywall identifiers + helpers. Update here
// when renaming RC packages, swapping the anchor product, etc. — the
// paywall components and the usePaywall hook never hardcode these.

import type { PurchasesPackage } from 'react-native-purchases';

export type PlanId = 'monthly' | 'yearly' | 'lifetime';

export type PackagesByPlan = Partial<Record<PlanId, PurchasesPackage>>;

// Maps internal plan IDs to RC package identifiers. RC's `$rc_*` are
// the standard auto-assigned identifiers; if you rename a package in
// the dashboard, mirror the change here.
export const RC_PACKAGE_BY_PLAN: Record<PlanId, string[]> = {
  monthly: ['$rc_monthly'],
  yearly: ['$rc_annual'],
  lifetime: ['$rc_lifetime'],
};

// Win-back product — the discounted annual shown in the promo modal after the
// user dismisses the main paywall. Matched by STORE PRODUCT id (not the RC
// package identifier) so the wiring doesn't depend on what the discount package
// is named in the dashboard. Its first-year price comes from an introductory
// offer on this product; the discount % is computed live from the real prices.
export const WINBACK_PRODUCT_ID = 'yearly_40_discount';

// Builds the CTA button label using Apple-localized prices from RC.
// Yearly stays static because it's a free-trial CTA, not a price CTA.
export function ctaLabel(plan: PlanId, packages: PackagesByPlan): string {
  const monthly = packages.monthly?.product.priceString;
  const lifetime = packages.lifetime?.product.priceString;
  switch (plan) {
    case 'monthly':
      return monthly ? `Subscribe — ${monthly}/mo` : 'Subscribe';
    case 'yearly':
      return 'Try Free for 3 Days';
    case 'lifetime':
      return lifetime ? `Get Lifetime — ${lifetime}` : 'Get Lifetime';
  }
}

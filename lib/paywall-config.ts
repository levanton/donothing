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

// `nothing_yearly` lives in ASC purely so we can render a struck-through
// anchor price on the yearly card. Intentionally not in any RC offering
// — never buyable. Replace this ID if you ever want to swap the anchor.
export const ANCHOR_PRODUCT_ID = 'nothing_yearly';

// Win-back modal package — shown after dismissal of the main paywall.
// Custom RC identifier (not `$rc_*`) so we can wire it without colliding
// with the standard yearly slot. Maps to `nothing_first_year_50_off`.
export const WINBACK_PACKAGE_ID = 'winback_yearly';

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

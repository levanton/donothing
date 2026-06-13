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
export function ctaLabel(plan: PlanId, packages: PackagesByPlan): string {
  const monthly = packages.monthly?.product.priceString;
  const lifetime = packages.lifetime?.product.priceString;
  switch (plan) {
    case 'monthly':
      return monthly ? `Subscribe — ${monthly}/mo` : 'Subscribe';
    case 'yearly': {
      // Only promise a free trial the product ACTUALLY grants — otherwise
      // Apple rejects for misleading terms (and the user gets charged with
      // no trial). The "3 Days" copy is derived from the product's real
      // intro offer, so it self-corrects if App Store Connect ever changes.
      const days = freeTrialDays(packages.yearly);
      if (days) return `Try Free for ${days} Days`;
      const yearly = packages.yearly?.product.priceString;
      return yearly ? `Subscribe — ${yearly}/yr` : 'Subscribe';
    }
    case 'lifetime':
      return lifetime ? `Get Lifetime — ${lifetime}` : 'Get Lifetime';
  }
}

// RC reports an intro/trial period as (periodUnit, periodNumberOfUnits, cycles).
// Normalize the unit to days so the UI can render a single "{N} days free".
const TRIAL_UNIT_DAYS: Record<string, number> = {
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
};

/**
 * The length, in days, of a product's FREE trial — or null when there isn't
 * one. Drives every "{N} days free" string on the paywall so the copy is
 * always backed by the real RevenueCat intro offer (and by extension the
 * App Store Connect configuration), never a hardcoded promise.
 *
 * Returns null for a PAID intro offer: a discounted-but-not-free first period
 * is a discount, not a trial, and must not be advertised as "free".
 */
export function freeTrialDays(pkg?: PurchasesPackage): number | null {
  const intro = pkg?.product.introPrice;
  if (!intro || intro.price > 0) return null;
  const unitDays = TRIAL_UNIT_DAYS[intro.periodUnit] ?? 0;
  const days = unitDays * intro.periodNumberOfUnits * (intro.cycles || 1);
  return days > 0 ? days : null;
}

/**
 * Marketing "was" price for the annual plan: the cost of paying MONTHLY for a
 * whole year (real monthly price × 12), shown struck through next to the real
 * annual price. Unlike an invented markup, this is a genuine, purchasable
 * alternative — the standard, App-Store-safe way to show the annual saving.
 *
 * Hidden (undefined) when there's no monthly plan to compare against, or when
 * the annualized monthly cost isn't actually higher than the annual price —
 * we never fabricate a discount that doesn't exist.
 */
export function annualAnchorPrice(
  monthly?: PurchasesPackage,
  yearly?: PurchasesPackage,
): string | undefined {
  const m = monthly?.product;
  const y = yearly?.product;
  if (!m?.price || !m.priceString || !y?.price) return undefined;
  const annualizedMonthly = m.price * 12;
  if (annualizedMonthly <= y.price) return undefined;
  return formatLikePrice(m.priceString, annualizedMonthly);
}

// Re-render a numeric amount using an existing localized price string as a
// template, preserving its currency symbol, decimal separator and placement
// (e.g. template "3,99 €" + 47.88 → "47,88 €").
function formatLikePrice(template: string, amount: number): string | undefined {
  const token = template.match(/\d[\d.,]*/)?.[0];
  if (!token) return undefined;
  const sep = /,\d{1,2}$/.test(token) ? ',' : '.';
  const decimals = token.includes(sep) ? token.split(sep)[1].length : 0;
  const value = amount.toFixed(decimals).replace('.', sep);
  return template.replace(token, value);
}

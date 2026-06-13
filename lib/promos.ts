// Promo registry — the single source of truth for every discount modal in
// the app. To add a NEW promo, append one object to PROMOS below: set its
// audience, the surfaces it may appear on, the RC product + offer, and its
// copy. Everything else (eligibility, pricing, the signed-offer dance,
// rendering) is handled generically by usePromo() + PromoOffer.
//
// Two offer kinds, because Apple treats them differently:
//  • intro        — an Apple *introductory* offer, redeemable ONCE per
//                   subscription group. Only NEW subscribers are eligible.
//                   Bought with a plain purchasePackage().
//  • promotional  — an Apple *Promotional Offer*, for customers who ALREADY
//                   subscribed (or lapsed). Not blocked by the intro token.
//                   Must be signed first, then bought with the discounted
//                   purchase path. This is the real "win-back".

import { WINBACK_PRODUCT_ID } from '@/lib/paywall-config';

export type PromoSurface = 'paywall' | 'blocksPaused';

// 'new'       → never used the intro for this group (intro-eligible).
// 'returning' → has subscribed before (the everSubscribed flag is set).
export type PromoAudience = 'new' | 'returning';

export type PromoOfferSpec =
  | { kind: 'intro' }
  | { kind: 'promotional'; offerId: string };

// Copy is split into the exact pieces PromoOffer renders: a headline with a
// bold kicker, two bullets, and a CTA with a bold word. `{pct}` inside any
// `bold` string is replaced live with the real discount percent — never
// hardcode the number, the actual deal comes from Apple's prices.
export interface PromoCopy {
  headline: { before: string; bold: string; after: string };
  bullets: [string, string];
  cta: { before: string; bold: string; after: string };
}

export interface PromoDef {
  /** Stable id — used in analytics and as the "already shown" key prefix. */
  id: string;
  /** Master switch. `false` → this promo never surfaces anywhere. */
  enabled: boolean;
  audience: PromoAudience;
  /** Which surfaces are allowed to show it. */
  surfaces: PromoSurface[];
  /** RC store product identifier whose package is purchased. */
  productId: string;
  offer: PromoOfferSpec;
  copy: PromoCopy;
}

export const PROMOS: PromoDef[] = [
  // NEW subscribers — the existing intro win-back shown when the paywall is
  // dismissed. Unchanged behaviour, now expressed declaratively.
  {
    id: 'intro-new',
    enabled: true,
    audience: 'new',
    surfaces: ['paywall'],
    productId: WINBACK_PRODUCT_ID, // 'yearly_40_discount'
    offer: { kind: 'intro' },
    copy: {
      headline: { before: 'What if your first year\nwas ', bold: '{pct}% OFF', after: '?' },
      bullets: ['cancel any time', 'full access'],
      cta: { before: 'Try ', bold: 'nothing', after: ' now' },
    },
  },

  // RETURNING / lapsed subscribers — the real win-back via an Apple
  // Promotional Offer. DISABLED until the offer is live in RevenueCat and
  // the copy/pacing are signed off; flip `enabled` to true to activate.
  {
    id: 'winback-returning',
    enabled: false,
    audience: 'returning',
    surfaces: ['paywall', 'blocksPaused'],
    productId: 'nothing_yearly',
    offer: { kind: 'promotional', offerId: 'nothing_year_50_off' },
    copy: {
      headline: { before: 'Come back to nothing\nyour next year is ', bold: '{pct}% off', after: '' },
      bullets: ['pick up right where you left off', 'cancel any time'],
      cta: { before: 'Try ', bold: 'nothing', after: ' again' },
    },
  },
];

/** Copy with `{pct}` substituted — what PromoOffer actually renders. */
export interface ResolvedPromoCopy {
  headline: { before: string; bold: string; after: string };
  bullets: [string, string];
  cta: { before: string; bold: string; after: string };
}

export function resolvePromoCopy(copy: PromoCopy, discountPct: number): ResolvedPromoCopy {
  const sub = (s: string) => s.replace('{pct}', String(discountPct));
  return {
    headline: {
      before: copy.headline.before,
      bold: sub(copy.headline.bold),
      after: copy.headline.after,
    },
    bullets: [copy.bullets[0], copy.bullets[1]],
    cta: { before: copy.cta.before, bold: copy.cta.bold, after: copy.cta.after },
  };
}

/**
 * Real discount percent from full vs offer price. Returns undefined when the
 * inputs can't yield a sane positive percent — callers then skip the promo
 * rather than advertise a bogus "0% off".
 */
export function computeDiscountPct(fullPrice?: number, offerPrice?: number): number | undefined {
  if (fullPrice == null || offerPrice == null || fullPrice <= 0) return undefined;
  const pct = Math.round((1 - offerPrice / fullPrice) * 100);
  return pct > 0 ? pct : undefined;
}

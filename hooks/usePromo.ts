// Resolves which promo (if any) to show on a given surface, loads its
// pricing, signs the offer when needed, and exposes one purchase handler.
// Both the paywall and the win-back surfaces consume this — the registry
// in lib/promos.ts decides the rest, so adding a promo never touches a hook.

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PurchasesPackage,
  PurchasesPromotionalOffer,
} from 'react-native-purchases';

import { haptics } from '@/lib/haptics';
import { track } from '@/lib/analytics';
import { getDeviceState } from '@/lib/db/settings';
import {
  PROMOS,
  type PromoDef,
  type PromoSurface,
  type ResolvedPromoCopy,
  computeDiscountPct,
  resolvePromoCopy,
} from '@/lib/promos';
import { useAppStore } from '@/lib/store';
import {
  getOfferings,
  getSignedPromoOffer,
  isIntroEligible,
  purchasePackage,
  purchaseWithPromoOffer,
} from '@/lib/subscription';

// Mirrors the store's everSubscribed flag (kept as a literal here, same as
// HomeShell, to avoid a circular import through the store module).
const EVER_SUBSCRIBED_KEY = 'everSubscribed';

export interface ResolvedPromo {
  id: string;
  /** Full (post-offer) localized price, e.g. "$49.99". */
  priceString: string;
  /** Discounted first-year localized price. */
  introPriceString: string;
  discountPct: number;
  copy: ResolvedPromoCopy;
}

interface UsePromoResult {
  promo: ResolvedPromo | null;
  purchasing: boolean;
  purchase: () => Promise<void>;
}

async function isAudienceMatch(def: PromoDef): Promise<boolean> {
  if (def.audience === 'new') {
    // Brand-new: can still redeem the one-per-group intro offer.
    return isIntroEligible(def.productId);
  }
  // Returning: has subscribed at least once before.
  try {
    return getDeviceState(EVER_SUBSCRIBED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * @param surface  which UI is asking (gates the registry by `surfaces`)
 * @param onPurchased fired after a successful purchase so the caller can close
 */
export function usePromo(
  surface: PromoSurface,
  onPurchased: () => void,
): UsePromoResult {
  const [promo, setPromo] = useState<ResolvedPromo | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  // The live RC objects the purchase path needs, kept out of state so a
  // re-render never reaches for a stale package.
  const pkgRef = useRef<PurchasesPackage | null>(null);
  const offerRef = useRef<PurchasesPromotionalOffer | null>(null);
  const defRef = useRef<PromoDef | null>(null);

  useEffect(() => {
    // Nothing enabled for this surface → don't even hit the network. A
    // disabled promo costs literally zero: no RC call, no eligibility check.
    const candidates = PROMOS.filter(
      (def) => def.enabled && def.surfaces.includes(surface),
    );
    if (candidates.length === 0) return;

    let cancelled = false;
    (async () => {
      const offering = await getOfferings();
      if (cancelled || !offering) return;

      for (const def of candidates) {
        if (!(await isAudienceMatch(def))) continue;
        if (cancelled) return;

        const pkg = offering.availablePackages.find(
          (p) => p.product.identifier === def.productId,
        );
        if (!pkg) continue;

        let signedOffer: PurchasesPromotionalOffer | null = null;
        let offerPriceString: string | undefined;
        let offerPrice: number | undefined;

        if (def.offer.kind === 'intro') {
          const intro = pkg.product.introPrice;
          if (!intro) continue;
          offerPriceString = intro.priceString;
          offerPrice = intro.price;
        } else {
          // Promotional: the discount must be on the product AND sign
          // successfully — otherwise we'd promise a price we can't charge.
          const { offerId } = def.offer;
          const discount = pkg.product.discounts?.find(
            (d) => d.identifier === offerId,
          );
          if (!discount) continue;
          signedOffer = await getSignedPromoOffer(pkg.product, offerId);
          if (cancelled) return;
          if (!signedOffer) continue;
          offerPriceString = discount.priceString;
          offerPrice = discount.price;
        }

        const discountPct = computeDiscountPct(pkg.product.price, offerPrice);
        if (discountPct == null || !offerPriceString) continue;

        pkgRef.current = pkg;
        offerRef.current = signedOffer;
        defRef.current = def;
        setPromo({
          id: def.id,
          priceString: pkg.product.priceString,
          introPriceString: offerPriceString,
          discountPct,
          copy: resolvePromoCopy(def.copy, discountPct),
        });
        return; // first match wins
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [surface]);

  const purchase = useCallback(async () => {
    if (purchasing) return;
    const pkg = pkgRef.current;
    const def = defRef.current;
    const offer = offerRef.current;
    if (!pkg || !def) return;

    setPurchasing(true);
    try {
      const result =
        def.offer.kind === 'promotional' && offer
          ? await purchaseWithPromoOffer(pkg, offer)
          : await purchasePackage(pkg);

      if (result === 'active') {
        haptics.success();
        track('purchase_completed', { plan: 'winback', promo: def.id });
        // Optimistic — RC's listener pushes the same status, but updating
        // now lets the caller close without waiting on it.
        await useAppStore.getState().setSubscriptionStatus('active');
        onPurchased();
      } else if (result === 'cancelled') {
        track('purchase_cancelled', { plan: 'winback', promo: def.id });
      } else {
        haptics.error();
        track('purchase_failed', { plan: 'winback', promo: def.id });
      }
    } finally {
      setPurchasing(false);
    }
  }, [onPurchased, purchasing]);

  return { promo, purchasing, purchase };
}

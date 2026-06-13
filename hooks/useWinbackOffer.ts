// Win-back offer plumbing for surfaces OUTSIDE the paywall (e.g. the
// blocks-paused promo on home). Loads the discounted annual package and
// exposes a purchase handler — the same product the paywall's own
// win-back overlay sells (lib/paywall-config WINBACK_PRODUCT_ID), but
// without dragging the whole usePaywall lifecycle along.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PurchasesPackage } from 'react-native-purchases';

import { haptics } from '@/lib/haptics';
import { track } from '@/lib/analytics';
import { WINBACK_PRODUCT_ID } from '@/lib/paywall-config';
import { useAppStore } from '@/lib/store';
import { getOfferings, isIntroEligible, purchasePackage } from '@/lib/subscription';

export function useWinbackOffer(onPurchased: () => void) {
  const [winbackPkg, setWinbackPkg] = useState<PurchasesPackage | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getOfferings().then((offering) => {
      if (cancelled || !offering) return;
      // Match by store product id — robust to whatever the discount
      // package is named in the RC dashboard.
      const pkg = offering.availablePackages.find(
        (p) => p.product.identifier === WINBACK_PRODUCT_ID,
      );
      // Only arm the offer if the user can actually redeem its intro
      // price — Apple grants the intro once per subscription group, so a
      // returning subscriber would be shown a discount they can't get.
      if (pkg) {
        isIntroEligible(pkg.product.identifier).then((eligible) => {
          if (!cancelled && eligible) setWinbackPkg(pkg);
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real discount % computed live from intro vs full price — never
  // hardcoded, the actual deal may not be exactly 40%.
  const discountPct = useMemo(() => {
    const product = winbackPkg?.product;
    const full = product?.price;
    const intro = product?.introPrice?.price;
    if (full == null || intro == null || full <= 0) return undefined;
    return Math.round((1 - intro / full) * 100);
  }, [winbackPkg]);

  const purchase = useCallback(async () => {
    if (purchasing || !winbackPkg) return;
    setPurchasing(true);
    try {
      const result = await purchasePackage(winbackPkg);
      if (result === 'active') {
        haptics.success();
        track('purchase_completed', { plan: 'winback' });
        // Optimistic — RC's listener pushes the same status, but updating
        // now lets the caller close without waiting on it.
        await useAppStore.getState().setSubscriptionStatus('active');
        onPurchased();
      } else if (result === 'cancelled') {
        // System sheet dismissed → stay open so the user can retry.
        track('purchase_cancelled', { plan: 'winback' });
      } else {
        haptics.error();
        track('purchase_failed', { plan: 'winback' });
      }
    } finally {
      setPurchasing(false);
    }
  }, [onPurchased, purchasing, winbackPkg]);

  return { winbackPkg, discountPct, purchasing, purchase };
}

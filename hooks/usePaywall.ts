// Shared paywall logic — used by both the standalone /paywall route and
// the onboarding paywall screen. Keeps the components purely UI: they
// read state from this hook and call its handlers, no RC plumbing in
// the JSX layer.

import { useCallback, useEffect, useState } from 'react';

import { haptics } from '@/lib/haptics';
import {
  ANCHOR_PRODUCT_ID,
  type PackagesByPlan,
  type PlanId,
  RC_PACKAGE_BY_PLAN,
} from '@/lib/paywall-config';
import { useAppStore } from '@/lib/store';
import {
  getOfferings,
  getProductPriceString,
  purchasePackage,
  restorePurchases,
} from '@/lib/subscription';

interface Options {
  // Fired when the paywall should close — after a successful purchase,
  // a successful restore, or when the user skips. Lets the standalone
  // route call router.replace('/'); the onboarding screen call onFinish().
  onClose: () => void;
  // When false, the auto-close watcher is suppressed. Onboarding sets
  // this to its current `isActive` so the paywall doesn't fire onFinish
  // from a screen that isn't currently visible.
  enabled?: boolean;
}

export function usePaywall({ onClose, enabled = true }: Options) {
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
  const [packagesByPlan, setPackagesByPlan] = useState<PackagesByPlan>({});
  const [anchorYearly, setAnchorYearly] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const subscriptionStatus = useAppStore((s) => s.subscriptionStatus);

  // Auto-close once the store flips to 'active'. RC's customerInfo
  // listener can resolve before/after our purchasePackage() returns —
  // we trust the store as source of truth, not the local Promise.
  useEffect(() => {
    if (enabled && subscriptionStatus === 'active') onClose();
  }, [enabled, subscriptionStatus, onClose]);

  // Load packages + anchor price once on mount. The anchor lives outside
  // any RC offering, so it needs its own getProducts call.
  useEffect(() => {
    let cancelled = false;
    getOfferings().then((offering) => {
      if (cancelled || !offering) return;
      const map: PackagesByPlan = {};
      for (const plan of Object.keys(RC_PACKAGE_BY_PLAN) as PlanId[]) {
        const ids = RC_PACKAGE_BY_PLAN[plan];
        const pkg = offering.availablePackages.find((p) =>
          ids.includes(p.identifier),
        );
        if (pkg) map[plan] = pkg;
      }
      setPackagesByPlan(map);
    });
    getProductPriceString(ANCHOR_PRODUCT_ID).then((price) => {
      if (cancelled || !price) return;
      setAnchorYearly(price);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const skip = useCallback(() => {
    haptics.light();
    // Arm the win-back promo. The home screen unwraps `pendingPromoOnHome`
    // once its launch splash settles — otherwise the modal would animate
    // in on top of the still-running splash circle.
    useAppStore.getState().setPendingPromoOnHome(true);
    onClose();
  }, [onClose]);

  const purchase = useCallback(async () => {
    if (purchasing) return;
    const pkg = packagesByPlan[selectedPlan];
    if (!pkg) {
      console.warn('[paywall] no RC package for plan', selectedPlan);
      return;
    }
    haptics.light();
    setPurchasing(true);
    try {
      const result = await purchasePackage(pkg);
      if (result === 'active') {
        haptics.success();
        // Optimistic — RC's listener will push the same status, but we
        // update now so the home screen unwraps without waiting on it.
        await useAppStore.getState().setSubscriptionStatus('active');
        onClose();
      } else if (result !== 'cancelled') {
        haptics.error();
      }
    } finally {
      setPurchasing(false);
    }
  }, [onClose, packagesByPlan, purchasing, selectedPlan]);

  const restore = useCallback(async () => {
    haptics.light();
    const status = await restorePurchases();
    if (status === 'active') {
      haptics.success();
      await useAppStore.getState().setSubscriptionStatus('active');
      onClose();
    }
  }, [onClose]);

  return {
    selectedPlan,
    setSelectedPlan,
    packagesByPlan,
    anchorYearly,
    purchasing,
    skip,
    purchase,
    restore,
  };
}

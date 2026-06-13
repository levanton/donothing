// Shared paywall logic — used by both the standalone /paywall route and
// the onboarding paywall screen. Keeps the components purely UI: they
// read state from this hook and call its handlers, no RC plumbing in
// the JSX layer.

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { haptics } from '@/lib/haptics';
import { track } from '@/lib/analytics';
import { getDeviceState, setDeviceState } from '@/lib/db/settings';
import {
  type PackagesByPlan,
  type PlanId,
  RC_PACKAGE_BY_PLAN,
} from '@/lib/paywall-config';
import { usePromo } from '@/hooks/usePromo';
import { useAppStore } from '@/lib/store';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
} from '@/lib/subscription';

// Device-local tally of how many times the user has dismissed the paywall.
// Used to surface the win-back promo only on every second dismissal rather
// than every time. Never synced — it's pure local UX pacing.
const PAYWALL_SKIP_COUNT_KEY = 'paywallSkipCount';

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
  const [purchasing, setPurchasing] = useState(false);
  const subscriptionStatus = useAppStore((s) => s.subscriptionStatus);

  // Win-back promo — shown ON TOP of the paywall when the user taps the X,
  // instead of closing first and surfacing it later on the home screen.
  // The registry (via usePromo) picks the right offer for this user: the
  // intro discount for new subscribers, or the returning win-back for
  // lapsed ones — whichever is enabled and eligible.
  const [promoVisible, setPromoVisible] = useState(false);
  const closeAfterPromo = useCallback(() => {
    setPromoVisible(false);
    onClose();
  }, [onClose]);
  const {
    promo,
    purchasing: promoPurchasing,
    purchase: promoPurchase,
  } = usePromo('paywall', closeAfterPromo);

  // Auto-close once the store flips to 'active'. RC's customerInfo
  // listener can resolve before/after our purchasePackage() returns —
  // we trust the store as source of truth, not the local Promise.
  useEffect(() => {
    if (enabled && subscriptionStatus === 'active') onClose();
  }, [enabled, subscriptionStatus, onClose]);

  // Top of the conversion funnel.
  useEffect(() => {
    track('paywall_viewed');
  }, []);

  // Load the plan-card packages once on mount. The win-back promo product
  // is loaded separately by usePromo from the same offering.
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
    return () => {
      cancelled = true;
    };
  }, []);

  const skip = useCallback(() => {
    haptics.light();
    track('paywall_skipped');
    // Count every dismissal and only surface the win-back on every SECOND
    // one — showing it each time was too pushy. The tally is persisted so
    // the alternation survives app restarts.
    let count = 0;
    try {
      const prev = parseInt(getDeviceState(PAYWALL_SKIP_COUNT_KEY) ?? '0', 10);
      count = (Number.isFinite(prev) ? prev : 0) + 1;
      setDeviceState(PAYWALL_SKIP_COUNT_KEY, String(count));
    } catch (e) {
      console.warn('[paywall] skip-count read/write failed:', e);
    }
    // Surface the promo on top of the paywall every second dismissal, but
    // only if a promo actually resolved for this user. Otherwise just leave.
    if (promo && count % 2 === 0) {
      setPromoVisible(true);
    } else {
      onClose();
    }
  }, [onClose, promo]);

  // Dismissing the promo means the user has now declined twice — leave the
  // paywall the same way the bare X used to.
  const closePromo = useCallback(() => {
    setPromoVisible(false);
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
        track('purchase_completed', { plan: selectedPlan });
        // Optimistic — RC's listener will push the same status, but we
        // update now so the home screen unwraps without waiting on it.
        await useAppStore.getState().setSubscriptionStatus('active');
        onClose();
      } else if (result === 'cancelled') {
        track('purchase_cancelled', { plan: selectedPlan });
      } else {
        haptics.error();
        track('purchase_failed', { plan: selectedPlan });
      }
    } finally {
      setPurchasing(false);
    }
  }, [onClose, packagesByPlan, purchasing, selectedPlan]);

  const [restoring, setRestoring] = useState(false);

  const restore = useCallback(async () => {
    if (restoring) return;
    haptics.light();
    setRestoring(true);
    try {
      const status = await restorePurchases();
      if (status === 'active') {
        haptics.success();
        track('restore_completed');
        await useAppStore.getState().setSubscriptionStatus('active');
        onClose();
      } else {
        // No active entitlement found (or a network/StoreKit error swallowed
        // inside restorePurchases). Either way the user tapped Restore and
        // got nothing — tell them so it doesn't feel broken. This path is
        // common on reinstall / new device, and silent failure is an App
        // Review flag.
        haptics.error();
        track('restore_failed');
        Alert.alert(
          'Nothing to restore',
          "We couldn't find any previous purchases on this Apple ID. If you subscribed before, make sure you're signed in to the same Apple ID and try again.",
        );
      }
    } finally {
      setRestoring(false);
    }
  }, [onClose, restoring]);

  return {
    selectedPlan,
    setSelectedPlan,
    packagesByPlan,
    purchasing,
    skip,
    purchase,
    restore,
    restoring,
    // Win-back promo (rendered on top of the paywall)
    promoVisible,
    closePromo,
    promoPurchase,
    promoPurchasing,
    promo,
  };
}

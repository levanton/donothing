// Shared paywall logic — used by both the standalone /paywall route and
// the onboarding paywall screen. Keeps the components purely UI: they
// read state from this hook and call its handlers, no RC plumbing in
// the JSX layer.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';

import { haptics } from '@/lib/haptics';
import { getDeviceState, setDeviceState } from '@/lib/db/settings';
import {
  type PackagesByPlan,
  type PlanId,
  RC_PACKAGE_BY_PLAN,
  WINBACK_PRODUCT_ID,
} from '@/lib/paywall-config';
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
  const [winbackPkg, setWinbackPkg] = useState<PurchasesPackage | null>(null);
  const [promoVisible, setPromoVisible] = useState(false);
  const [promoPurchasing, setPromoPurchasing] = useState(false);

  // Auto-close once the store flips to 'active'. RC's customerInfo
  // listener can resolve before/after our purchasePackage() returns —
  // we trust the store as source of truth, not the local Promise.
  useEffect(() => {
    if (enabled && subscriptionStatus === 'active') onClose();
  }, [enabled, subscriptionStatus, onClose]);

  // Load packages once on mount — both the plan cards and the win-back
  // promo product come from the same offering, so one fetch covers both.
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
      // Match by store product id — robust to whatever the discount package
      // is named in the RC dashboard.
      const winback = offering.availablePackages.find(
        (p) => p.product.identifier === WINBACK_PRODUCT_ID,
      );
      if (winback) setWinbackPkg(winback);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real discount % computed live from the win-back product's intro vs full
  // price — never hardcoded, since the actual deal may not be exactly 40%.
  const winbackDiscountPct = useMemo(() => {
    const product = winbackPkg?.product;
    const full = product?.price;
    const intro = product?.introPrice?.price;
    if (full == null || intro == null || full <= 0) return undefined;
    return Math.round((1 - intro / full) * 100);
  }, [winbackPkg]);

  const skip = useCallback(() => {
    haptics.light();
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
    // only if the win-back package actually loaded. Otherwise just leave.
    if (winbackPkg && count % 2 === 0) {
      setPromoVisible(true);
    } else {
      onClose();
    }
  }, [onClose, winbackPkg]);

  // Dismissing the promo means the user has now declined twice — leave the
  // paywall the same way the bare X used to.
  const closePromo = useCallback(() => {
    setPromoVisible(false);
    onClose();
  }, [onClose]);

  const promoPurchase = useCallback(async () => {
    if (promoPurchasing) return;
    if (!winbackPkg) {
      setPromoVisible(false);
      onClose();
      return;
    }
    setPromoPurchasing(true);
    try {
      const result = await purchasePackage(winbackPkg);
      if (result === 'active') {
        haptics.success();
        // Optimistic — the auto-close watcher above also fires on 'active',
        // but we update + close now so there's no flicker.
        await useAppStore.getState().setSubscriptionStatus('active');
        setPromoVisible(false);
        onClose();
      } else if (result !== 'cancelled') {
        // System sheet dismissed → leave the promo open to retry; any other
        // failure (network/storekit) → error haptic.
        haptics.error();
      }
    } finally {
      setPromoPurchasing(false);
    }
  }, [onClose, promoPurchasing, winbackPkg]);

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

  const [restoring, setRestoring] = useState(false);

  const restore = useCallback(async () => {
    if (restoring) return;
    haptics.light();
    setRestoring(true);
    try {
      const status = await restorePurchases();
      if (status === 'active') {
        haptics.success();
        await useAppStore.getState().setSubscriptionStatus('active');
        onClose();
      } else {
        // No active entitlement found (or a network/StoreKit error swallowed
        // inside restorePurchases). Either way the user tapped Restore and
        // got nothing — tell them so it doesn't feel broken. This path is
        // common on reinstall / new device, and silent failure is an App
        // Review flag.
        haptics.error();
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
    winbackPkg,
    winbackDiscountPct,
  };
}

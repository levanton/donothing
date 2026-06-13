import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';

import { KEEP_AWAKE } from '@/constants/keepAwake';
import { useAppStore } from '@/lib/store';
import { getAuth, isBlockActive, onBlockShieldRaised } from '@/lib/screen-time';
import {
  initRevenueCat,
  getCurrentStatus,
  getAppUserId,
  addStatusListener,
} from '@/lib/subscription';
import { identifyUser } from '@/lib/analytics';
import { captureError } from '@/lib/sentry';

/**
 * Wires the home screen to platform/native lifecycle events:
 *  - kicks off `store.init()` then runs the unlock-poll on cold start
 *  - listens for scheduled-block notifications (foreground + tap)
 *  - mirrors the native shield (`onBlockShieldRaised`) into UI state
 *  - serializes AppState bg/fg transitions so a fast toggle can't race
 *    `handleBackground` / `handleForeground`
 *
 * All listeners' `.remove()` calls are wrapped in try/catch — a thrown
 * cleanup leaves duplicates on the next mount (FastRefresh / nav).
 */
export function useAppLifecycle(
  pollBlockUnlock: (cancelledRef: { current: boolean }) => void,
): void {
  const isActiveRef = useRef(true);

  // --- Init: register the RC listener, hydrate store, then poll ---
  useEffect(() => {
    const cancelledRef = { current: false };
    initRevenueCat();
    // Attach the entitlement listener BEFORE the first getCurrentStatus()
    // poll below. RC can push a customerInfo update at any moment; if we
    // polled first and subscribed after, an update landing in that gap
    // would be dropped until the next foreground. Listener-first means we
    // never miss one — the poll just seeds the initial value, and the
    // listener reconciles anything that arrives concurrently.
    const unsub = addStatusListener((status) => {
      useAppStore.getState().setSubscriptionStatus(status);
    });
    // Stitch PostHog's anonymous events to RC's stable (anonymous) app-user
    // id so the onboarding funnel can be joined with real purchase outcomes.
    // Fire-and-forget — analytics linkage must never block startup.
    getAppUserId()
      .then((id) => { if (id) identifyUser(id); })
      .catch((e) => console.error('[lifecycle] analytics identify failed:', e));
    useAppStore
      .getState()
      .init()
      .then(async () => {
        // Resolve subscription status once DB is ready so the transition
        // side-effects (pause/restore blocks) operate on the freshly-loaded
        // scheduledBlocks rather than the empty initial array.
        const status = await getCurrentStatus();
        await useAppStore.getState().setSubscriptionStatus(status);
        pollBlockUnlock(cancelledRef);
      })
      .catch((e) => {
        // Without this, an init() failure (e.g. a migration throwing) is
        // an unhandled rejection: `ready` stays false and the app sits on
        // a dead home screen with zero diagnostics. Capture it so the
        // crash-loop class of bugs is at least visible in Sentry.
        console.error('[lifecycle] store init failed:', e);
        captureError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelledRef.current = true;
      try { unsub(); } catch (e) { console.error('[lifecycle] RC unsub failed:', e); }
    };
  }, [pollBlockUnlock]);

  // --- expo-notifications: scheduled block alerts ---
  useEffect(() => {
    const handleScheduledBlock = async (data: Record<string, unknown>) => {
      if (!(data?.type === 'scheduledBlock' && data?.durationMinutes)) return;
      // Visibility is decided by the ONE door (requestBlockUnlock below):
      // it ignores the request while a session or its celebration owns the
      // screen. The native shield is up either way — after the session
      // ends, the started→false effect in app/index.tsx re-requests.
      // No subscription gate: this notification only exists because the
      // native extension fired a block (its gate passed), so the shield is
      // up — the unlock UI must be reachable regardless of what RC says
      // right now, or the user is stranded behind a blocked phone.
      // Block can only act if Screen Time access is approved AND notifications
      // are granted. If either was revoked after the block was scheduled,
      // skip silently — the gated Settings UI will surface the missing perm.
      const [auth, notif] = await Promise.all([
        getAuth(),
        Notifications.getPermissionsAsync(),
      ]);
      if (auth !== 'approved' || notif.status !== 'granted') {
        console.log('[ScheduledBlock] skipped — missing perms', { auth, notif: notif.status });
        return;
      }
      // Native DeviceActivity raises the shield at intervalDidStart; we
      // only need to mirror the UI. If the user taps the banner from
      // outside the app, this opens the unlock view as they come back in.
      if (useAppStore.getState().requestBlockUnlock(isBlockActive()) === 'shown') {
        activateKeepAwakeAsync(KEEP_AWAKE.BLOCK);
      }
    };

    const sub1 = Notifications.addNotificationReceivedListener((notification) => {
      handleScheduledBlock(notification.request.content.data ?? {});
    });
    const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
      handleScheduledBlock(response.notification.request.content.data ?? {});
    });

    return () => {
      try { sub1.remove(); } catch (e) { console.error('[lifecycle] notif sub1 remove failed:', e); }
      try { sub2.remove(); } catch (e) { console.error('[lifecycle] notif sub2 remove failed:', e); }
    };
  }, []);

  // --- Native shield-raised listener ---
  // The DeviceActivity extension raises the shield natively at the scheduled
  // time and posts a Darwin notification; `onBlockShieldRaised` forwards it
  // here. Darwin notifications fire reliably even to foregrounded apps where
  // the expo-notifications listener silently drops, so this is the source of
  // truth — we just mirror it into the UI.
  useEffect(() => {
    const sub = onBlockShieldRaised(() => {
      // One door (requestBlockUnlock): handles the cold-start race (not
      // ready → 'none'), busy sessions/celebrations ('busy') and the
      // shield check. No subscription gate: hiding the unlock UI based on
      // RC status would strand the user behind blocked apps.
      if (useAppStore.getState().requestBlockUnlock(isBlockActive()) === 'shown') {
        activateKeepAwakeAsync(KEEP_AWAKE.BLOCK);
      }
    });
    return () => {
      try { sub.remove(); } catch (e) { console.error('[lifecycle] shield sub remove failed:', e); }
    };
  }, []);

  // --- AppState bg/fg with serialization ---
  useEffect(() => {
    const cancelledRef = { current: false };
    // Serialize bg/fg transitions — handleBackground is async (it calls
    // pauseSession which freezes the timer + surfaces the interrupt
    // sheet). A fast bg→fg toggle can have foreground run before
    // background's set() lands, leaving stale state for pollBlockUnlock.
    let bgInFlight: Promise<void> | null = null;
    const sub = AppState.addEventListener('change', async (nextState) => {
      // Anything that's not 'active' counts as the user stepping away —
      // App Switcher (swipe-up gesture), Notification Center, Control
      // Center, incoming-call preview, lock-screen unlock animation. The
      // app philosophy is "do nothing", so glancing at any of those breaks
      // the session the same way as backgrounding does.
      if (nextState !== 'active' && isActiveRef.current) {
        isActiveRef.current = false;
        deactivateKeepAwake(KEEP_AWAKE.SESSION);
        bgInFlight = useAppStore.getState().handleBackground();
        try {
          await bgInFlight;
        } finally {
          bgInFlight = null;
        }
      } else if (nextState === 'active' && !isActiveRef.current) {
        isActiveRef.current = true;
        // Wait for any in-flight background cleanup so foreground
        // observes settled state.
        if (bgInFlight) {
          try { await bgInFlight; } catch {}
        }
        useAppStore.getState().handleForeground();
        // Re-arm the session keep-awake dropped on the way out. The session
        // survives a background trip (paused + interrupt sheet), but without
        // this the resumed timer runs with the idle timer live — the phone
        // auto-locks 30–60s into the very stillness the app asks for. The
        // end paths (sheet end/unlock, stop, countdown complete) all
        // deactivate, so this can't leak past the session.
        if (useAppStore.getState().started) {
          activateKeepAwakeAsync(KEEP_AWAKE.SESSION);
        }
        // Refresh subscription on every foreground in case RC didn't
        // push an update while we were backgrounded (renewal, refund,
        // sandbox-expired). Don't await — UI shouldn't block on this.
        getCurrentStatus()
          .then((status) => useAppStore.getState().setSubscriptionStatus(status))
          .catch((e) => console.error('[lifecycle] foreground RC refresh failed:', e));
        // Same retry poll as init — every foreground transition gets
        // the same defensive check, so a backgrounded app coming back
        // during an active block still surfaces the BlockSheet.
        pollBlockUnlock(cancelledRef);
      }
    });
    return () => {
      cancelledRef.current = true;
      try { sub.remove(); } catch (e) { console.error('[lifecycle] AppState sub remove failed:', e); }
    };
  }, [pollBlockUnlock]);
}

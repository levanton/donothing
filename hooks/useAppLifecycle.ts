import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';

import { useAppStore } from '@/lib/store';
import { getAuth, isBlockActive, onBlockShieldRaised } from '@/lib/screen-time';

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

  // --- Init: hydrate store, then poll for an active block ---
  useEffect(() => {
    const cancelledRef = { current: false };
    useAppStore
      .getState()
      .init()
      .then(() => pollBlockUnlock(cancelledRef));
    return () => {
      cancelledRef.current = true;
    };
  }, [pollBlockUnlock]);

  // --- expo-notifications: scheduled block alerts ---
  useEffect(() => {
    const handleScheduledBlock = async (data: Record<string, unknown>) => {
      if (!(data?.type === 'scheduledBlock' && data?.durationMinutes)) return;
      // Don't intrude on an active or paused session — the user is
      // already doing nothing (which is the block's whole point) or
      // mid-decision on the pause sheet. The native shield is up
      // either way, so apps stay locked in the background; we just
      // skip the BlockSheet UI here. After the session ends the
      // started→false useEffect in app/index.tsx polls the shield
      // and surfaces the sheet.
      const state = useAppStore.getState();
      if (state.started || state.paused) {
        return;
      }
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
      activateKeepAwakeAsync('scheduled-block');
      // Native DeviceActivity raises the shield at intervalDidStart; we
      // only need to mirror the UI. If the user taps the banner from
      // outside the app, this opens the unlock view as they come back in.
      useAppStore.getState().showUnlock();
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
      const state = useAppStore.getState();
      // Cold-start race: native extension can fire intervalDidStart before
      // init() finishes loading scheduledBlocks. Skip until the store is
      // ready — init() itself calls showUnlock() if a block is active.
      if (!state.ready) return;
      // Same rule as the notification listener — don't intrude on an
      // active or paused session. Shield stays up natively; the UI
      // surfaces after the session ends.
      if (state.started || state.paused) return;
      if (state.focusStep !== 'hidden') return;
      if (!isBlockActive()) return;
      activateKeepAwakeAsync('scheduled-block');
      state.showUnlock();
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
        deactivateKeepAwake('session');
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

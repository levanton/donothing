import { Entypo, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AccountSheet from '@/components/AccountSheet';
import GoalSliderBar from '@/components/GoalSliderBar';
import BlockSheet from '@/components/BlockSheet';
import HistoryContent from '@/components/HistoryContent';
import AnimatedTimerDisplay from '@/components/AnimatedTimerDisplay';
import DriftingDots from '@/components/DriftingDots';
import PaywallGate from '@/components/PaywallGate';
import PromoOffer from '@/components/promo/PromoOffer';
import SessionCompleteScreen from '@/components/SessionCompleteScreen';
import SessionEndedSheet from '@/components/SessionEndedSheet';
import SettingsContent from '@/components/SettingsContent';
import TimerDisplay from '@/components/TimerDisplay';
import { Fonts } from '@/constants/theme';
import type { ScheduledBlock } from '@/lib/db/types';
import { formatTimeStat } from '@/lib/format';
import {
  forceUnblockAll,
  getAuth,
  isBlockActive,
  onBlockShieldRaised,
} from '@/lib/screen-time';
import { getStats } from '@/lib/stats';
import { useAppStore } from '@/lib/store';
import { palette, themes, type AppTheme } from '@/lib/theme';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';

// Yes-button + orbit slot — kept at 140px so the launch-splash math
// (which lands the splash circle exactly on the measured yes button)
// stays consistent. The orbit ring itself was removed; this is just
// the diameter of the static cream→terracotta yes pill at rest.
const YES_BUTTON_SIZE = 140;

// Pick the block that most recently fired today so the unlock view
// surfaces the unlockGoalMinutes the user configured for it. The shield
// persists until the user unlocks, so "most recent start ≤ now today"
// is the right heuristic — durationMinutes is only an iOS API window,
// not an actual block length.
function findActiveBlock(
  blocks: ScheduledBlock[],
  now: Date,
): ScheduledBlock | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  // iOS/Expo weekday convention: 1=Sun … 7=Sat. JS Date.getDay() is 0=Sun,
  // so we offset by 1 to match what block.weekdays stores.
  const today = now.getDay() + 1;

  let best: ScheduledBlock | null = null;
  let bestStart = -1;
  for (const b of blocks) {
    if (!b.enabled) continue;
    if (b.weekdays.length > 0 && !b.weekdays.includes(today)) continue;
    const start = b.hour * 60 + b.minute;
    if (start > nowMinutes) continue;
    if (start > bestStart) {
      best = b;
      bestStart = start;
    }
  }
  return best;
}

// ===========================================================================
// Main Screen
// ===========================================================================
export default function DoNothingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const elapsed = useAppStore((s) => s.elapsed);
  const themeMode = useAppStore((s) => s.themeMode);
  const weekStats = useAppStore((s) => s.weekStats);
  const ready = useAppStore((s) => s.ready);
  const started = useAppStore((s) => s.started);
  const goalSeconds = useAppStore((s) => s.goalSeconds);
  // sliderMinutes is intentionally NOT subscribed here — every snap
  // would re-render this 1700-line component. The resting timer text
  // and the slider value prop both consume it via small self-
  // subscribing components below, so JS work stays local.
  const focusStep = useAppStore((s) => s.focusStep);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const isSubscribed = useAppStore((s) => s.isSubscribed);

  const accountSheetRef = useRef<BottomSheet>(null);
  const blockSheetRef = useRef<BottomSheet>(null);
  const sessionEndedSheetRef = useRef<BottomSheet>(null);
  const handleOpenAccount = useCallback(() => {
    accountSheetRef.current?.expand();
  }, []);
  const handleDeleteAccount = useCallback(async () => {
    // TODO: wire up real account deletion — clear local DB, detach RevenueCat, etc.
    console.warn('[Account] delete tapped — stub; no-op until wired');
  }, []);

  // Shared element: Journey pill on home ↔ Journey heading in history.
  // We measure both on-screen rects and float a proxy Text that smoothly
  // travels + scales between them, driven by historySlide.
  type Rect = { x: number; y: number; w: number; h: number };
  const journeyBtnRef = useRef<View>(null);
  const [btnRect, setBtnRect] = useState<Rect | null>(null);
  const [headingRect, setHeadingRect] = useState<Rect | null>(null);

  const measureJourneyBtn = useCallback(() => {
    // Home container has translateY = 0 whenever the pill is visible (slide = 0),
    // so measureInWindow gives us the at-rest screen coords directly.
    requestAnimationFrame(() => {
      journeyBtnRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) setBtnRect({ x, y, w, h });
      });
    });
  }, []);

  const handleHeadingLayout = useCallback((rect: Rect) => {
    setHeadingRect(rect);
  }, []);
  const lastSessionId = useAppStore((s) => s.lastSessionId);
  const lastSessionDuration = useAppStore((s) => s.lastSessionDuration);
  const completionVisible = useAppStore((s) => s.completionVisible);
  const sessionEndedVisible = useAppStore((s) => s.sessionEndedVisible);
  const scheduledBlocks = useAppStore((s) => s.scheduledBlocks);

  // Block-waiting state: a scheduled block fired and apps are locked until the
  // user either does nothing for the required time, or force-unlocks.
  const blockWaiting = focusStep === 'done';
  const activeBlock = blockWaiting
    ? findActiveBlock(scheduledBlocks, new Date())
    : null;
  const unlockMin = activeBlock?.unlockGoalMinutes ?? 15;

  const isActiveRef = useRef(true);

  const theme = themes[themeMode];
  const stats = getStats();

  // --- Theme animation ---
  const themeProgress = useSharedValue(0);

  useEffect(() => {
    themeProgress.value = withTiming(themeMode === 'dark' ? 0 : 1, {
      duration: 600,
    });
  }, [themeMode]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      themeProgress.value,
      [0, 1],
      [themes.dark.bg, themes.light.bg],
    ),
  }));

  // --- Entry animations ---
  const timerOpacity = useSharedValue(0.9);

  // Header morph: "Ready to Do|ing| nothing|?|"
  const hideOpacity = useSharedValue(1);
  const hideWidth = useSharedValue(1);
  const showOpacity = useSharedValue(0);
  const showWidth = useSharedValue(0);

  useEffect(() => {
    if (!started) return;
    // Timer fade — kept so the resting timer's slight 0.9 opacity
    // jumps to 1 in the brief moment before the camera covers it.
    timerOpacity.value = withTiming(1, { duration: 1125 });
    // Header text morph (still cosmetically nice even though the
    // camera covers it during the run; matters on close).
    hideOpacity.value = withTiming(0, { duration: 400 });
    hideWidth.value = withTiming(0, { duration: 860 });
    showWidth.value = withTiming(1, { duration: 690 });
    showOpacity.value = withTiming(1, { duration: 1125 });
  }, [started]);

  // --- Countdown complete: auto-end session when timer reaches 00:00 ---
  useEffect(() => {
    if (started && goalSeconds > 0 && elapsed >= goalSeconds) {
      deactivateKeepAwake('session');
      setDistractionFree(false);
      // If a scheduled block is still enforcing a shield, the user has earned
      // their unlock by completing the countdown.
      if (isBlockActive()) {
        forceUnblockAll().catch(() => {});
      }
      useAppStore.getState().completeSession();
    }
  }, [elapsed, started, goalSeconds]);

  // --- Reset main screen visuals while completion overlay is showing ---
  useEffect(() => {
    if (!completionVisible) return;
    timerOpacity.value = withTiming(0.9, { duration: 700 });
    showOpacity.value = withTiming(0, { duration: 400 });
    showWidth.value = withTiming(0, { duration: 860 });
    hideWidth.value = withTiming(1, { duration: 690 });
    hideOpacity.value = withTiming(1, { duration: 1125 });
  }, [completionVisible]);

  // --- Reset main screen visuals when a session was cancelled ---
  useEffect(() => {
    if (!sessionEndedVisible) return;
    setDistractionFree(false);
    timerOpacity.value = 0.9;
    showOpacity.value = 0;
    showWidth.value = 0;
    hideWidth.value = 1;
    hideOpacity.value = 1;
  }, [sessionEndedVisible]);

  const timerEntryStyle = useAnimatedStyle(() => ({
    opacity: timerOpacity.value,
  }));

  // "Ready to " and "?" — fade then collapse
  const hideStyle = useAnimatedStyle(() => ({
    opacity: hideOpacity.value,
    maxWidth: hideWidth.value * 150,
    overflow: 'hidden' as const,
    height: 28,
  }));

  // "ing" — expand then fade in
  const showStyle = useAnimatedStyle(() => ({
    opacity: showOpacity.value,
    maxWidth: showWidth.value * 50,
    overflow: 'hidden' as const,
    height: 28,
  }));

  // --- Goal slider ---
  const SLIDER_W = 300;
  const handleSliderChange = useCallback((mins: number) => {
    const s = useAppStore.getState();
    s.setSliderMinutes(mins);
    s.setGoalFromSlider(mins);
  }, []);

  // Drive the block-state bottom sheet from focusStep === 'done'.
  useEffect(() => {
    if (blockWaiting) {
      blockSheetRef.current?.expand();
    } else {
      blockSheetRef.current?.close();
    }
  }, [blockWaiting]);

  // Drive the session-ended sheet — replaces the old full-screen
  // SessionEndedView with a bottom-sheet that matches BlockSheet's
  // design language. The expand call is deferred to the next frame
  // so the BottomSheet has a tick to mount + measure its content
  // (enableDynamicSizing) before we ask it to animate up — without
  // this, a cold-start with a persisted cancelled session can race
  // and leave the sheet half-mounted.
  useEffect(() => {
    if (sessionEndedVisible) {
      const r = requestAnimationFrame(() => {
        sessionEndedSheetRef.current?.expand();
      });
      return () => cancelAnimationFrame(r);
    }
    sessionEndedSheetRef.current?.close();
  }, [sessionEndedVisible]);

  // --- History slide ---
  const SCREEN_H = Dimensions.get('window').height;
  const historySlide = useSharedValue(0); // 0 = main visible, 1 = history visible
  const historyScrollY = useSharedValue(0);

  // --- Settings slide (from left) ---
  const SCREEN_W = Dimensions.get('window').width;
  const settingsSlide = useSharedValue(0); // 0 = hidden, 1 = visible
  const settingsSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (settingsSlide.value - 1) * SCREEN_W }],
  }));

  const mainSlideStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: -historySlide.value * SCREEN_H },
      { translateX: settingsSlide.value * SCREEN_W },
    ],
  }));

  const historySlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - historySlide.value) * SCREEN_H }],
  }));

  // Pill border fades out in the first half of the swipe — the word has already
  // started travelling via the proxy, leaving the empty border hanging there
  // would look strange.
  const journeyPillStyle = useAnimatedStyle(() => ({
    opacity: interpolate(historySlide.value, [0, 0.5, 1], [1, 0, 0]),
  }));

  // Chevron disappears instantly at the first sign of a swipe — the shared-
  // element morph is enough of a signal; the chevron only hinted at rest.
  const journeyChevronStyle = useAnimatedStyle(() => ({
    opacity: interpolate(historySlide.value, [0, 0.05], [1, 0]),
  }));

  // Shared element — floating Journey label that travels between pill and heading.
  // Both endpoints' centres drive a single translate + scale; the pill/heading
  // texts stay invisible so the proxy is the only glyph the user sees.
  const journeyProxyStyle = useAnimatedStyle(() => {
    if (!btnRect || !headingRect) return { opacity: 0 };
    const p = historySlide.value;
    const s = settingsSlide.value;
    const startCX = btnRect.x + btnRect.w / 2;
    const startCY = btnRect.y + btnRect.h / 2;
    const endCX = headingRect.x + headingRect.w / 2;
    const endCY = headingRect.y + headingRect.h / 2;
    const cx = interpolate(p, [0, 1], [startCX, endCX]);
    const cy = interpolate(p, [0, 1], [startCY, endCY]);
    const scale = interpolate(p, [0, 1], [19 / 32, 1]);
    return {
      opacity: 1,
      // Base position (home ↔ history morph) + sideways offset that follows
      // the home container when Settings slides in from the right. The proxy
      // should feel like it lives on the home screen.
      transform: [
        { translateX: cx - headingRect.w / 2 + s * SCREEN_W },
        { translateY: cy - headingRect.h / 2 },
        { scale },
      ],
    };
  });

  // Swipe up on main → open history
  const mainVerticalPan = Gesture.Pan()
    .enabled(!started)
    .activeOffsetY(-20)
    .failOffsetX([-15, 15])
    .onUpdate((e) => {
      'worklet';
      const drag = -e.translationY / SCREEN_H;
      historySlide.value = Math.max(0, Math.min(1, drag));
    })
    .onEnd((e) => {
      'worklet';
      const shouldOpen = historySlide.value > 0.3 || -e.velocityY > 500;
      historySlide.value = withTiming(shouldOpen ? 1 : 0, { duration: 300 });
    });

  // Swipe left on main → open settings
  const openSettingsJS = useCallback(() => {
    useAppStore.getState().openSettings();
  }, []);
  const mainHorizontalPan = Gesture.Pan()
    .enabled(!started)
    .activeOffsetX(20)
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      'worklet';
      const drag = e.translationX / SCREEN_W;
      settingsSlide.value = Math.max(0, Math.min(1, drag));
    })
    .onEnd((e) => {
      'worklet';
      const shouldOpen = settingsSlide.value > 0.3 || e.velocityX > 500;
      settingsSlide.value = withTiming(shouldOpen ? 1 : 0, { duration: 300 });
      if (shouldOpen) runOnJS(openSettingsJS)();
    });

  const mainPanGesture = Gesture.Exclusive(mainVerticalPan, mainHorizontalPan);

  // Swipe right on settings → close settings (only active when settings is open)
  const closeSettingsJS = useCallback(() => {
    useAppStore.getState().closeSettings();
  }, []);
  const settingsSwipeBack = Gesture.Pan()
    .enabled(settingsOpen)
    .activeOffsetX(-20)
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      'worklet';
      const drag = -e.translationX / SCREEN_W;
      settingsSlide.value = Math.max(0, Math.min(1, 1 - Math.max(0, drag)));
    })
    .onEnd((e) => {
      'worklet';
      const shouldClose = settingsSlide.value < 0.7 || -e.velocityX > 500;
      settingsSlide.value = withTiming(shouldClose ? 0 : 1, { duration: 300 });
      if (shouldClose) {
        runOnJS(closeSettingsJS)();
      }
    });

  // Native gesture for the history ScrollView — lets Pan and Scroll coexist
  const historyScrollNativeGesture = Gesture.Native();

  // Swipe down on history → close (only when scrolled to top)
  const historyPanGesture = Gesture.Pan()
    .activeOffsetY([-10000, 20])
    .simultaneousWithExternalGesture(historyScrollNativeGesture)
    .onUpdate((e) => {
      'worklet';
      if (historyScrollY.value > 5) return;
      const drag = e.translationY / SCREEN_H;
      historySlide.value = Math.max(0, Math.min(1, 1 - Math.max(0, drag)));
    })
    .onEnd((e) => {
      'worklet';
      if (historyScrollY.value > 5) return;
      const shouldClose = historySlide.value < 0.7 || e.velocityY > 500;
      historySlide.value = withTiming(shouldClose ? 0 : 1, { duration: 300 });
    });

  const historyScrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      historyScrollY.value = e.contentOffset.y;
    },
  });

  // Deactivate keep awake when focus ends (unblock only happens on explicit unlock).
  useEffect(() => {
    if (focusStep === 'hidden') {
      deactivateKeepAwake('focus');
      deactivateKeepAwake('scheduled-block');
    }
  }, [focusStep]);

  // If a do-nothing session ends manually (stop button) while a scheduled
  // block's shield is still up, surface the unlock view so the user sees
  // why their apps are locked. Auto-completion already runs forceUnblockAll
  // before flipping started=false; backgrounding sets sessionEndedVisible —
  // both paths are skipped here.
  const prevStartedRef = useRef(started);
  useEffect(() => {
    const wasStarted = prevStartedRef.current;
    prevStartedRef.current = started;
    if (!wasStarted || started) return;
    const state = useAppStore.getState();
    if (state.completionVisible || state.sessionEndedVisible) return;
    if (state.focusStep !== 'hidden') return;
    if (!isBlockActive()) return;
    activateKeepAwakeAsync('scheduled-block');
    state.showUnlock();
  }, [started]);

  // --- Init ---
  useEffect(() => {
    useAppStore
      .getState()
      .init()
      .then(() => {
        // Check if a block is currently active (app was closed during block)
        if (isBlockActive() && useAppStore.getState().focusStep === 'hidden') {
          useAppStore.getState().showUnlock();
        }
      });
  }, []);

  // --- Notification listener for scheduled blocks ---
  useEffect(() => {
    const handleScheduledBlock = async (data: Record<string, unknown>) => {
      if (!(data?.type === 'scheduledBlock' && data?.durationMinutes)) return;
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

    // When notification received while app is in foreground
    const sub1 = Notifications.addNotificationReceivedListener(
      (notification) => {
        handleScheduledBlock(notification.request.content.data ?? {});
      },
    );

    // When user taps notification (app was in background)
    const sub2 = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleScheduledBlock(response.notification.request.content.data ?? {});
      },
    );

    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, []);

  // --- Native shield-raised listener ---
  // The DeviceActivity extension raises the shield natively at the scheduled
  // time and then posts a Darwin notification; we forward that here as
  // `onBlockShieldRaised`. Darwin notifications are delivered synchronously
  // even to foregrounded apps, so this fires reliably in cases where the
  // expo-notifications foreground listener silently drops. The native
  // shield is the source of truth: we just mirror it to the UI, which
  // eliminates polling, timers, debounce bookkeeping, and race windows.
  useEffect(() => {
    const sub = onBlockShieldRaised(() => {
      const state = useAppStore.getState();
      // Cold-start race: native extension can fire intervalDidStart before
      // init() finishes loading scheduledBlocks. Skip until the store is
      // ready — init() itself calls showUnlock() if a block is active.
      if (!state.ready) return;
      if (state.focusStep !== 'hidden') return;
      if (!isBlockActive()) return;
      activateKeepAwakeAsync('scheduled-block');
      state.showUnlock();
    });
    return () => sub.remove();
  }, []);

  // --- AppState ---
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      // Only 'background' ends a session flow. 'inactive' covers Control
      // Center / notification drawer / incoming-call preview — those don't
      // count as leaving the app.
      if (nextState === 'background' && isActiveRef.current) {
        isActiveRef.current = false;
        deactivateKeepAwake('session');
        await useAppStore.getState().handleBackground();
      } else if (nextState === 'active' && !isActiveRef.current) {
        isActiveRef.current = true;
        useAppStore.getState().handleForeground();
        // Check if block is active when returning to foreground
        if (isBlockActive() && useAppStore.getState().focusStep === 'hidden') {
          useAppStore.getState().showUnlock();
        }
      }
    });
    return () => sub.remove();
  }, []);

  // --- Theme toggle ---
  const toggleTheme = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    useAppStore.getState().toggleTheme();
  }, []);

  // --- Settings ---
  const handleSettingsPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    settingsSlide.value = withTiming(1, { duration: 400 });
    useAppStore.getState().openSettings();
  }, []);

  const handleSettingsClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    settingsSlide.value = withTiming(0, { duration: 300 });
    useAppStore.getState().closeSettings();
  }, []);

  // Emergency unlock: bypasses the do-nothing gate. Shown on the block-waiting
  // main screen so the user always has an out.
  const handleForceUnlock = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deactivateKeepAwake('focus');
    deactivateKeepAwake('scheduled-block');
    forceUnblockAll().catch(() => {});
    useAppStore.getState().unlockFocus();
  }, []);

  const handleStartBlockSession = useCallback(
    (minutes: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      activateKeepAwakeAsync('session');
      // Jump the header morph to the "Doing nothing" state so the user doesn't
      // see a flash of "Ready to Do nothing?" when leaving the block-waiting UI.
      hideOpacity.value = 0;
      hideWidth.value = 0;
      showOpacity.value = 1;
      showWidth.value = 1;
      useAppStore.setState({
        focusStep: 'hidden',
        goalSeconds: minutes * 60,
      });
      useAppStore.getState().startSession();
    },
    [hideOpacity, hideWidth, showOpacity, showWidth],
  );

  // --- Launch splash — terracotta fills the screen, then shrinks in place
  // onto the yes button. Animates real width/height (not scale) so the
  // edge stays crisp, and lands exactly on the measured yes-button position
  // so the splash literally becomes the button with no visible handoff.
  const [splashDone, setSplashDone] = useState(false);
  const yesButtonRef = useRef<View>(null);
  const [yesBtnRect, setYesBtnRect] = useState<Rect | null>(null);
  const measureYesButton = useCallback(() => {
    requestAnimationFrame(() => {
      yesButtonRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) setYesBtnRect({ x, y, w, h });
      });
    });
  }, []);

  const { width: SCREEN_W_INIT, height: SCREEN_H_INIT } = Dimensions.get('window');
  const YES_SIZE = 140;
  // Shared values drive the animated style — seeded with safe "cover the
  // screen" defaults so the splash is opaque from the very first frame
  // even before the yes button is measured.
  const splashProgress = useSharedValue(0);
  const splashCenterX = useSharedValue(SCREEN_W_INIT / 2);
  const splashCenterY = useSharedValue(SCREEN_H_INIT / 2);
  const splashInitialSize = useSharedValue(Math.max(SCREEN_W_INIT, SCREEN_H_INIT) * 2.5);

  // Recompute the splash's anchor + cover size once the yes button has been
  // measured. For a circle centred at (cx, cy) to cover the screen we need
  // the radius to reach the farthest corner — so use corner distances, not
  // Manhattan half-extents.
  useEffect(() => {
    if (!yesBtnRect) return;
    const cx = yesBtnRect.x + yesBtnRect.w / 2;
    const cy = yesBtnRect.y + yesBtnRect.h / 2;
    const maxDist = Math.max(
      Math.hypot(cx, cy),
      Math.hypot(SCREEN_W_INIT - cx, cy),
      Math.hypot(cx, SCREEN_H_INIT - cy),
      Math.hypot(SCREEN_W_INIT - cx, SCREEN_H_INIT - cy),
    );
    splashCenterX.value = cx;
    splashCenterY.value = cy;
    splashInitialSize.value = maxDist * 2 + 80;
  }, [yesBtnRect]);

  useEffect(() => {
    if (!ready || splashDone || !yesBtnRect) return;
    splashProgress.value = withDelay(
      200,
      withTiming(
        1,
        { duration: 1200, easing: Easing.bezier(0.16, 1, 0.3, 1) },
        (finished) => {
          if (finished) runOnJS(setSplashDone)(true);
        },
      ),
    );
  }, [ready, splashDone, yesBtnRect]);

  const splashStyle = useAnimatedStyle(() => {
    const size =
      splashInitialSize.value + splashProgress.value * (YES_SIZE - splashInitialSize.value);
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      left: splashCenterX.value - size / 2,
      top: splashCenterY.value - size / 2,
    };
  });
  // The inline yes label stays visible only when the splash is small enough
  // to actually read as the button — fades in over the tail of the anim.
  const splashLabelStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, (splashProgress.value - 0.6) / 0.3)),
  }));

  // --- Terracotta camera --------------------------------------------------
  // When the user taps yes, the terracotta yes button doesn't shrink to a
  // dot anymore — it expands into a full-screen sheet. The whole running
  // experience lives inside that sheet: cream timer, breath orb, phrase.
  // Reuses the splash centre/cover-size math so the geometry is consistent
  // (a circle whose radius reaches the farthest corner from the yes
  // button's measured centre).
  const runExpand = useSharedValue(0);
  // Mount the running UI immediately on start; keep it mounted long
  // enough on stop for the fade-out to play alongside the camera
  // shrinking.
  const [runUiMounted, setRunUiMounted] = useState(false);

  useEffect(() => {
    runExpand.value = withTiming(started ? 1 : 0, {
      // Open slow enough for the terracotta sweep to actually land,
      // close a touch faster — by then the user has already chosen
      // to leave so dawdling reads as "not letting go".
      duration: started ? 1100 : 620,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
    if (started) {
      setRunUiMounted(true);
      return;
    }
    const t = setTimeout(() => setRunUiMounted(false), 640);
    return () => clearTimeout(t);
  }, [started]);

  const terraCameraStyle = useAnimatedStyle(() => {
    // Scale-based animation runs purely on the GPU — no per-frame
    // layout work. The view stays a fixed YES_SIZE circle anchored
    // at the yes button centre; only `transform: scale` changes.
    // Far smoother than animating width/height/borderRadius.
    const maxScale = splashInitialSize.value / YES_SIZE;
    const scale = 1 + runExpand.value * (maxScale - 1);
    return {
      width: YES_SIZE,
      height: YES_SIZE,
      borderRadius: YES_SIZE / 2,
      left: splashCenterX.value - YES_SIZE / 2,
      top: splashCenterY.value - YES_SIZE / 2,
      transform: [{ scale }],
      // Hide the camera entirely at rest so it doesn't sit on top of
      // the yes button at the same 140px size and steal the label.
      opacity: runExpand.value < 0.001 ? 0 : 1,
    };
  });

  // Running UI fades in during the last third of the expansion so the
  // terracotta lands first, then the cream content arrives — feels like
  // the camera "settles" before showing its inside.
  const runUiStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, (runExpand.value - 0.6) / 0.35)),
  }));

  // Distraction-free fade — declared early so its shared value is
  // ready before any animated style closes over it. The actual
  // useEffect that drives it lives below the distractionFree state.
  const distractionFade = useSharedValue(1);
  const distractionStyle = useAnimatedStyle(() => ({
    opacity: distractionFade.value,
  }));

  // --- Distraction-free mode: hide timer & button while running ---
  const [distractionFree, setDistractionFree] = useState(false);

  // Drive the distraction-fade shared value declared above, now that
  // distractionFree is in scope. Smooth tween instead of an instant
  // opacity flip.
  useEffect(() => {
    distractionFade.value = withTiming(distractionFree ? 0 : 1, {
      duration: 720,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [distractionFree]);

  // --- Promo offer modal (for users without subscription) ---
  // Lives in the store so the standalone paywall route can trigger it
  // when the user dismisses without buying.
  const promoVisible = useAppStore((s) => s.promoOfferVisible);
  const handleOpenPromo = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    useAppStore.getState().showPromoOffer();
  }, []);
  const handleClosePromo = useCallback(() => {
    useAppStore.getState().hidePromoOffer();
  }, []);
  const toggleDistractionFree = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDistractionFree((v) => !v);
  }, []);

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    activateKeepAwakeAsync('session');
    useAppStore.getState().startSession();
  }, []);

  const handleStop = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    deactivateKeepAwake('session');
    setDistractionFree(false);
    await useAppStore.getState().stopSession();
    // Camera shrinks back via the runExpand effect; here we just
    // reverse the resting-state visuals: timer fade, header morph.
    timerOpacity.value = withTiming(0.9, { duration: 700 });
    // "ing" disappears
    showOpacity.value = withTiming(0, { duration: 400 });
    showWidth.value = withTiming(0, { duration: 860 });
    // "Ready to " and "?" reappear
    hideWidth.value = withTiming(1, { duration: 690 });
    hideOpacity.value = withTiming(1, { duration: 1125 });
    // Reset elapsed after animations finish
    setTimeout(() => useAppStore.getState().resetElapsed(), 700);
  }, []);

  const handleCompletionClose = useCallback(() => {
    useAppStore.getState().dismissCompletion();
  }, []);

  const handleHistory = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    historySlide.value = withTiming(1, { duration: 500 });
  }, []);

  const handleHistoryClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    historySlide.value = withTiming(0, { duration: 400 });
  }, []);

  if (!ready) {
    // Match the launch splash colour so there is no dark flash between the
    // native splash hiding and the JS splash overlay mounting.
    return (
      <View style={[styles.container, { backgroundColor: palette.terracotta }]} />
    );
  }

  // =========================================================================
  // Main screen — session-ended state shows as a bottom sheet over
  // the resting main UI, not as a full-screen replacement.
  // =========================================================================
  return (
    <View style={[styles.screenStack, { backgroundColor: theme.bg }]}>
      <GestureDetector gesture={mainPanGesture}>
        <Animated.View
          style={[styles.container, animatedContainerStyle, mainSlideStyle]}
        >
          <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

          {/* Settings button — top left */}
          <Pressable
            onPress={handleSettingsPress}
            disabled={started}
            style={[
              styles.lockButton,
              {
                top: insets.top + 12,
                opacity: started ? 0 : 1,
              },
            ]}
            hitSlop={16}
          >
            <Feather
              name='sliders'
              size={24}
              color={theme.text}
              style={{ opacity: 0.9 }}
            />
          </Pressable>

          {/* Dev tools cluster — only in dev builds, hidden while session is active */}
          {__DEV__ && (
            <View
              style={[
                styles.devCluster,
                {
                  top: insets.top + 12,
                  opacity: started ? 0 : 1,
                },
              ]}
              pointerEvents={started ? 'none' : 'auto'}
            >
              <Pressable
                onPress={() => router.push('/onboarding')}
                disabled={started}
                style={styles.devIconBtn}
                hitSlop={12}
              >
                <Feather
                  name='play'
                  size={18}
                  color={theme.text}
                  style={{ opacity: 0.9 }}
                />
              </Pressable>

              <Pressable
                onPress={() =>
                  useAppStore.setState({
                    completionVisible: true,
                    lastSessionId: 'dev-preview',
                    lastSessionDuration: 50 * 60,
                  })
                }
                disabled={started}
                style={styles.devIconBtn}
                hitSlop={12}
              >
                <Feather
                  name='flag'
                  size={18}
                  color={theme.text}
                  style={{ opacity: 0.9 }}
                />
              </Pressable>

              <Pressable
                onPress={() =>
                  useAppStore.setState({
                    sessionEndedVisible: true,
                    cancelReason: 'backgrounded',
                  })
                }
                disabled={started}
                style={styles.devIconBtn}
                hitSlop={12}
              >
                <Feather
                  name='alert-octagon'
                  size={18}
                  color={theme.text}
                  style={{ opacity: 0.9 }}
                />
              </Pressable>

              <Pressable
                onPress={handleOpenPromo}
                disabled={started}
                style={styles.devIconBtn}
                hitSlop={12}
              >
                <Feather
                  name='gift'
                  size={18}
                  color={theme.text}
                  style={{ opacity: 0.9 }}
                />
              </Pressable>

              <Pressable
                onPress={() => {
                  const past = new Date(Date.now() - 60 * 1000);
                  const fakeBlock: ScheduledBlock = {
                    id: 'dev-mock-1min',
                    hour: past.getHours(),
                    minute: past.getMinutes(),
                    durationMinutes: 15,
                    weekdays: [past.getDay() + 1],
                    enabled: true,
                    unlockGoalMinutes: 1,
                  };
                  const existing = useAppStore.getState().scheduledBlocks;
                  useAppStore.setState({
                    scheduledBlocks: [
                      ...existing.filter((b) => b.id !== 'dev-mock-1min'),
                      fakeBlock,
                    ],
                  });
                  useAppStore.getState().showUnlock();
                }}
                disabled={started}
                style={styles.devIconBtn}
                hitSlop={12}
              >
                <Feather
                  name='lock'
                  size={18}
                  color={theme.text}
                  style={{ opacity: 0.9 }}
                />
              </Pressable>
            </View>
          )}

          {/* Header — morphs "Ready to Do·ing nothing?" → "Doing nothing" */}
          <View
            style={[styles.headerRow, { opacity: distractionFree ? 0 : 1 }]}
            pointerEvents={distractionFree ? 'none' : 'auto'}
          >
            <Animated.View style={hideStyle}>
              <Text
                style={[
                  styles.header,
                  { color: theme.text, fontFamily: Fonts!.serif },
                ]}
              >
                Ready to{' '}
              </Text>
            </Animated.View>
            <Text
              style={[
                styles.header,
                { color: theme.text, fontFamily: Fonts!.serif },
              ]}
            >
              Do
            </Text>
            <Animated.View style={showStyle}>
              <Text
                style={[
                  styles.header,
                  { color: theme.text, fontFamily: Fonts!.serif },
                ]}
              >
                ing
              </Text>
            </Animated.View>
            <Text
              style={[
                styles.header,
                { color: theme.text, fontFamily: Fonts!.serif },
              ]}
            >
              {' '}
              nothing
            </Text>
            <Animated.View style={hideStyle}>
              <Text
                style={[
                  styles.header,
                  { color: theme.text, fontFamily: Fonts!.serif },
                ]}
              >
                ?
              </Text>
            </Animated.View>
          </View>

          {/* Theme toggle — top right */}
          <Pressable
            onPress={toggleTheme}
            disabled={started}
            style={[
              styles.themeToggle,
              {
                top: insets.top + 12,
                opacity: started ? 0 : 1,
              },
            ]}
            hitSlop={16}
          >
            <View
              style={[
                styles.themeCircle,
                { backgroundColor: theme.accent, opacity: 0.7 },
              ]}
            />
          </Pressable>

          {/* Timer */}
          <View
            style={{ opacity: distractionFree ? 0 : 1 }}
            pointerEvents={distractionFree ? 'none' : 'auto'}
          >
            <Animated.View style={[timerEntryStyle, styles.centerContent]}>
              {!started ? (
                <RestingTimerText color={theme.text} />
              ) : (
                <TimerDisplay
                  seconds={
                    goalSeconds > 0
                      ? Math.max(0, goalSeconds - elapsed)
                      : elapsed
                  }
                  color={theme.text}
                  fontSize={64}
                  style={{ letterSpacing: 4 }}
                />
              )}
            </Animated.View>
          </View>

          {/* Yes button — static terracotta pill at rest. The old
              orbit-ring + shrink-to-dot animation was removed; the
              terracotta camera now carries the running state, and
              the yes button just sits behind it. */}
          <View
            style={[styles.orbitWrap, { opacity: distractionFree ? 0 : 1 }]}
            pointerEvents={distractionFree ? 'none' : 'auto'}
          >
            <View style={styles.orbitArea}>
              <Pressable
                ref={yesButtonRef}
                onLayout={measureYesButton}
                onPress={handleStart}
                disabled={started}
                style={styles.orbitCenter}
              >
                <View
                  style={[
                    styles.yesButton,
                    { backgroundColor: theme.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.nothingLabel,
                      { color: theme.accentText, fontFamily: Fonts!.serif },
                    ]}
                  >
                    yes
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Goal slider */}
          <View
            style={[
              styles.messageSliderArea,
              { opacity: started ? 0 : 1 },
            ]}
            pointerEvents={started ? 'none' : 'auto'}
          >
            {!started && (
              <View style={styles.goalSliderWrap}>
                <RestingSliderWrap
                  theme={theme}
                  width={SLIDER_W}
                  onChange={handleSliderChange}
                />
              </View>
            )}
          </View>

          {/* Stats — with goal slider overlaid */}
          <Pressable
            onPress={handleHistory}
            disabled={started}
            style={{ opacity: started ? 0 : 1 }}
          >
            <View style={styles.statsColumn}>
              <View style={styles.statRow}>
                <Text
                  style={[
                    styles.statRowLabel,
                    { color: theme.textSecondary, fontFamily: Fonts!.serif },
                  ]}
                >
                  today:
                </Text>
                <View style={styles.statRowValueRow}>
                  <Text
                    style={[
                      styles.statRowValue,
                      { color: theme.text, fontFamily: Fonts!.mono },
                    ]}
                  >
                    {formatTimeStat(stats.today + elapsed).value}
                  </Text>
                  <Text
                    style={[styles.statRowUnit, { color: theme.textTertiary }]}
                  >
                    {formatTimeStat(stats.today + elapsed).unit}
                  </Text>
                </View>
              </View>
              <Text style={[styles.statDot, { color: theme.textTertiary }]}>
                ·
              </Text>
              <View style={styles.statRow}>
                <Text
                  style={[
                    styles.statRowLabel,
                    { color: theme.textSecondary, fontFamily: Fonts!.serif },
                  ]}
                >
                  week:
                </Text>
                <View style={styles.statRowValueRow}>
                  <Text
                    style={[
                      styles.statRowValue,
                      { color: theme.text, fontFamily: Fonts!.mono },
                    ]}
                  >
                    {formatTimeStat(stats.week + elapsed).value}
                  </Text>
                  <Text
                    style={[styles.statRowUnit, { color: theme.textTertiary }]}
                  >
                    {formatTimeStat(stats.week + elapsed).unit}
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>

          {/* Week dots */}
          {weekStats.length > 0 && (
            <View
              style={[
                styles.weekSection,
                { opacity: started ? 0 : 1 },
              ]}
              pointerEvents={started ? 'none' : 'auto'}
            >
              <View style={styles.weekGrid}>
                {weekStats.map((day) => {
                  const maxDur = Math.max(
                    ...weekStats.map((d) => d.duration),
                    1,
                  );
                  const size =
                    day.duration > 0 ? 10 + (day.duration / maxDur) * 20 : 4;
                  return (
                    <View key={day.date} style={styles.weekDayCol}>
                      <View
                        style={{
                          width: size,
                          height: size,
                          borderRadius: size / 2,
                          backgroundColor:
                            day.duration > 0 ? theme.accent : theme.border,
                        }}
                      />
                      <Text
                        style={[
                          styles.weekDayLabel,
                          {
                            color: day.isToday
                              ? theme.text
                              : theme.textTertiary,
                          },
                        ]}
                      >
                        {day.dayName}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Bottom buttons */}
          <View
            style={[
              styles.bottomButtons,
              { bottom: 12, opacity: started ? 0 : 1 },
            ]}
            pointerEvents={started ? 'none' : 'auto'}
          >
            <Animated.View style={journeyPillStyle}>
              <Pressable
                onPress={handleHistory}
                hitSlop={16}
                style={styles.journeyBtn}
              >
                <View
                  ref={journeyBtnRef}
                  onLayout={measureJourneyBtn}
                  collapsable={false}
                >
                  <Text
                    style={[
                      styles.journeyPillText,
                      {
                        color:
                          themeMode === 'dark' ? palette.cream : palette.brown,
                        fontFamily: Fonts!.serif,
                        opacity: 0,
                      },
                    ]}
                  >
                    My Journey
                  </Text>
                </View>
                <Animated.View
                  style={[styles.journeyArrow, journeyChevronStyle]}
                  pointerEvents='none'
                >
                  <Entypo
                    name='chevron-thin-down'
                    size={20}
                    color={
                      themeMode === 'dark' ? palette.cream : palette.brown
                    }
                  />
                </Animated.View>
              </Pressable>
            </Animated.View>
          </View>

          {/* (Running-mode UI — phrase, stop, eye-toggle — now lives in
              the terracotta camera overlay rendered above this stack.
              Nothing renders here while `started` is true.) */}
        </Animated.View>
      </GestureDetector>

      {/* History screen — always rendered, positioned off-screen when hidden */}
      <GestureDetector gesture={historyPanGesture}>
        <Animated.View
          style={[
            styles.historyContainer,
            animatedContainerStyle,
            historySlideStyle,
          ]}
        >
          <HistoryContent
            onClose={handleHistoryClose}
            insets={insets}
            onScroll={historyScrollHandler}
            nativeScrollGesture={historyScrollNativeGesture}
            onHeadingLayout={handleHeadingLayout}
            historySlide={historySlide}
          />
          <PaywallGate
            visible={!isSubscribed}
            themeMode={themeMode}
            insets={insets}
            onClose={handleHistoryClose}
            title='unlock your journey'
            body="Every minute you've reclaimed, at a glance. Join to open Journey and keep the thread of your practice."
          />
        </Animated.View>
      </GestureDetector>

      {/* Settings screen */}
      <GestureDetector gesture={settingsSwipeBack}>
        <Animated.View
          style={[
            styles.historyContainer,
            animatedContainerStyle,
            settingsSlideStyle,
          ]}
        >
          <SettingsContent
            onClose={handleSettingsClose}
            insets={insets}
            onOpenAccount={handleOpenAccount}
          />
          <PaywallGate
            visible={!isSubscribed}
            themeMode={themeMode}
            insets={insets}
            onClose={handleSettingsClose}
            onOpenAccount={handleOpenAccount}
            title='unlock donothing'
            body='Settings, scheduled blocks and Journey open with a membership. Your account stays reachable either way.'
          />
        </Animated.View>
      </GestureDetector>

      {/* Shared account sheet — available from Settings header and from both gates */}
      <AccountSheet
        ref={accountSheetRef}
        theme={theme}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* Block-state sheet — appears when a scheduled block has fired */}
      <BlockSheet
        ref={blockSheetRef}
        theme={theme}
        unlockMin={unlockMin}
        onStart={handleStartBlockSession}
        onUnlock={handleForceUnlock}
      />

      {/* Session-ended sheet — appears when a session was cut short
          (e.g. the app got backgrounded). Replaces the old full-
          screen view with a bottom-sheet so the experience feels
          consistent with BlockSheet. */}
      <SessionEndedSheet
        ref={sessionEndedSheetRef}
        theme={theme}
        onStartAgain={() => useAppStore.getState().dismissSessionEnded()}
      />

      {/* Floating Journey label — the one shared element that morphs between the
        home pill and the Journey heading as the panel slides up. Hidden while
        a session is running or a scheduled block is waiting so the timer UI
        gets the spotlight. */}
      {btnRect && headingRect && !started && !blockWaiting && (
        <Animated.Text
          pointerEvents='none'
          style={[
            styles.journeyProxy,
            {
              color: theme.text,
              fontFamily: Fonts!.serif,
              width: headingRect.w,
              height: headingRect.h,
            },
            journeyProxyStyle,
          ]}
        >
          My Journey
        </Animated.Text>
      )}

      {/* Promo offer — shown to users without an active subscription */}
      <PromoOffer
        visible={promoVisible}
        onClose={handleClosePromo}
        onPurchase={() => {
          // TODO: hook into RevenueCat purchase flow
          handleClosePromo();
        }}
      />

      {/* Countdown completion screen */}
      <SessionCompleteScreen
        visible={completionVisible}
        sessionId={lastSessionId}
        durationSeconds={lastSessionDuration}
        todaySeconds={stats.today}
        themeMode={themeMode}
        yesBtnRect={yesBtnRect}
        onClose={handleCompletionClose}
      />

      {/* Terracotta camera — yes button expanded into a full-screen
          sheet on session start. Crisp width/height animation (not
          scale) so the edges stay sharp during the grow. Always
          mounted; the animated style gates visibility via opacity. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.runCamera,
          { backgroundColor: theme.accent },
          terraCameraStyle,
        ]}
      />

      {/* Running UI — cream-on-terracotta. Stays mounted briefly after
          a session ends so the fade-out reads alongside the camera
          shrinking, then unmounts cleanly. */}
      {runUiMounted && (
        <Animated.View
          style={[styles.runLayer, runUiStyle]}
          pointerEvents="box-none"
        >
          {/* Drifting cream dots — atmospheric layer that floats up
              through the screen, like dust motes in golden-hour
              light. Behind the timer in z-order. Wrapped so the
              hide-toggle fades the whole layer alongside everything
              else, instead of cutting it off mid-motion. */}
          <Animated.View
            style={[StyleSheet.absoluteFill, distractionStyle]}
            pointerEvents="none"
          >
            <DriftingDots active={runUiMounted} color={palette.cream} />
          </Animated.View>

          {/* Big cream timer at vertical centre. Each digit slides
              and fades as it ticks; the whole block fades smoothly
              with the hide-toggle. */}
          <Animated.View
            style={[styles.runCenter, distractionStyle]}
            pointerEvents="none"
          >
            <AnimatedTimerDisplay
              seconds={
                goalSeconds > 0
                  ? Math.max(0, goalSeconds - elapsed)
                  : elapsed
              }
              color={palette.cream}
              fontSize={96}
            />
          </Animated.View>

          {/* Interrupt is the primary action — substantial cream-
              outline pill at the very bottom, reachable thumb. */}
          <Animated.View
            style={[
              styles.runStopWrap,
              { bottom: insets.bottom + 30 },
              distractionStyle,
            ]}
            pointerEvents={distractionFree ? 'none' : 'auto'}
          >
            <Pressable
              onPress={handleStop}
              style={styles.runStopPill}
              hitSlop={12}
            >
              <Text
                style={[
                  styles.runStopLabel,
                  { fontFamily: Fonts!.serif },
                ]}
              >
                interrupt
              </Text>
            </Pressable>
          </Animated.View>

          {/* Hide is secondary — small eye-off icon above the
              interrupt pill, with its hint underneath. Lighter
              border, smaller tap area so it reads as auxiliary. */}
          <Animated.View
            style={[
              styles.runHideStack,
              { bottom: insets.bottom + 110 },
              distractionStyle,
            ]}
            pointerEvents={distractionFree ? 'none' : 'box-none'}
          >
            <Pressable
              onPress={toggleDistractionFree}
              style={styles.runHideIconBtn}
              hitSlop={16}
            >
              <Feather
                name="eye-off"
                size={18}
                color={palette.cream}
                style={{ opacity: 0.78 }}
              />
            </Pressable>
            <Text
              style={[
                styles.runHideHint,
                { fontFamily: Fonts!.serif },
              ]}
            >
              tap so nothing distracts
            </Text>
          </Animated.View>

          {/* Tap-anywhere overlay — only catches taps in distraction-
              free mode, where it toggles distraction-free off. The
              session itself is still controlled by the explicit stop
              link, so no risk of accidental cancellation. */}
          {distractionFree && (
            <Pressable
              onPress={toggleDistractionFree}
              style={StyleSheet.absoluteFillObject}
            />
          )}
        </Animated.View>
      )}

      {/* Launch splash — terracotta sheet that covers the screen and
          shrinks in place onto the measured yes button */}
      {!splashDone && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.splashCircle,
            { backgroundColor: theme.accent },
            splashStyle,
          ]}
        >
          <Animated.View style={[splashLabelStyle, styles.splashLabelWrap]}>
            <Text
              style={[
                styles.splashLabel,
                { color: theme.accentText, fontFamily: Fonts!.serif },
              ]}
            >
              yes
            </Text>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenStack: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  historyContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    width: '100%',
    height: 30,
    marginBottom: 24,
  },
  header: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 1,
    opacity: 0.85,
    fontWeight: '400',
  },
  lockButton: {
    position: 'absolute',
    left: 24,
  },
  themeToggle: {
    position: 'absolute',
    right: 24,
  },
  themeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  timer: {
    fontSize: 64,
    fontWeight: '200',
    letterSpacing: 4,
  },
  orbitCenter: {
    position: 'absolute',
  },
  orbitWrap: {
    width: 280,
    height: YES_BUTTON_SIZE,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitArea: {
    width: YES_BUTTON_SIZE,
    height: YES_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Static terracotta pill — the start screen's primary action.
  // Replaces the old shrink-to-orbit-dot Animated.View.
  yesButton: {
    width: YES_BUTTON_SIZE,
    height: YES_BUTTON_SIZE,
    borderRadius: YES_BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  centerContent: {
    alignItems: 'center',
  },
  statsColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 19,
  },
  statDot: {
    fontSize: 18,
    marginTop: 7,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  statRowLabel: {
    fontSize: 14,
    fontWeight: '300',
  },
  statRowValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statRowValue: {
    fontSize: 26,
    fontWeight: '300',
  },
  statRowUnit: {
    fontSize: 12,
    fontWeight: '300',
    marginLeft: 3,
  },
  weekSection: {
    marginTop: 32,
    width: '100%',
    maxWidth: 280,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 44,
  },
  weekDayCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 6,
  },
  weekDayLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: 12,
    position: 'absolute',
  },
  journeyBtn: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  journeyArrow: {
    alignItems: 'center',
  },
  journeyPillText: {
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  journeyProxy: {
    position: 'absolute',
    left: 0,
    top: 0,
    fontSize: 32,
    fontWeight: '400',
    letterSpacing: 0.5,
    textAlign: 'left',
    zIndex: 110,
  },
  distractionFreeButton: {
    position: 'absolute',
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idlePhraseLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  devCluster: {
    position: 'absolute',
    right: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  devIconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nothingLabel: {
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  splashCircle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
    overflow: 'hidden',
  },
  // Terracotta camera — yes button expanded to fill the screen during
  // a session. Shares the splash's positioning math.
  runCamera: {
    position: 'absolute',
    zIndex: 400,
  },
  runLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 410,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Interrupt is the primary action — substantial cream-outline
  // pill at the bottom, reachable thumb position. Wrapper carries
  // the absolute positioning so the inner Pressable can be wrapped
  // in an Animated.View without losing alignment.
  runStopWrap: {
    position: 'absolute',
    alignSelf: 'center',
    alignItems: 'center',
  },
  runStopPill: {
    minWidth: 152,
    height: 52,
    paddingHorizontal: 28,
    borderRadius: 100,
    borderWidth: 1.4,
    borderColor: 'rgba(249, 242, 224, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runStopLabel: {
    color: palette.cream,
    fontSize: 18,
    letterSpacing: 0.6,
  },
  // Hide is secondary — small icon button above the stop pill, with
  // its hint beneath. Lighter border + half the visual weight.
  runHideStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  runHideIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(249, 242, 224, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runHideHint: {
    color: palette.cream,
    fontSize: 11,
    letterSpacing: 0.3,
    opacity: 0.55,
    marginTop: 8,
    textAlign: 'center',
  },
  splashLabelWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLabel: {
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  messageSliderArea: {
    width: 300,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalSliderWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ── Self-subscribing slider helpers ─────────────────────────────────────
// Both consume `sliderMinutes` directly from the store so the parent
// MainScreen never needs to subscribe — every slider snap re-renders
// only these tiny components, not the whole 1700-line tree.

const RestingTimerText = memo(function RestingTimerText({
  color,
}: {
  color: string;
}) {
  const sliderMinutes = useAppStore((s) => s.sliderMinutes);
  return (
    <Animated.Text
      style={[
        styles.timer,
        { color, fontFamily: Fonts!.mono, textAlign: 'center' },
      ]}
    >
      {`${String(sliderMinutes).padStart(2, '0')}:00`}
    </Animated.Text>
  );
});

interface RestingSliderWrapProps {
  theme: AppTheme;
  width: number;
  onChange: (minutes: number) => void;
}

const RestingSliderWrap = memo(function RestingSliderWrap({
  theme,
  width,
  onChange,
}: RestingSliderWrapProps) {
  const sliderMinutes = useAppStore((s) => s.sliderMinutes);
  return (
    <GoalSliderBar
      theme={theme}
      value={sliderMinutes}
      onChange={onChange}
      width={width}
      maxMinutes={60}
      minMinutes={0}
      ticks={[5, 10, 20, 30, 45]}
      scaleLabels={['0', '5', '10', '20', '30', '45', '60']}
      breakpoints={{ b1Val: 15, b1Pos: 0.25, b2Val: 30, b2Pos: 0.5 }}
      accentColor={theme.accent}
      trackBgColor={theme.text}
      trackStrokeWidth={3.5}
      scaleLabelStyle={{
        color: theme.text,
        fontWeight: '500',
        fontSize: 12,
      }}
      hideLabel
    />
  );
});

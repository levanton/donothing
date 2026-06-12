import { Redirect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AccountSheet from '@/components/AccountSheet';
import BlockSheet from '@/components/BlockSheet';
import HistoryContent from '@/components/HistoryContent';
import SessionCompleteScreen from '@/components/SessionCompleteScreen';
import SessionEndedSheet from '@/components/SessionEndedSheet';
import SettingsContent from '@/components/SettingsContent';
import RunOverlay from '@/components/session/RunOverlay';
import { TutorialController } from '@/components/tutorial';
import { Fonts } from '@/constants/theme';
import { useAppLifecycle } from '@/hooks/useAppLifecycle';
import { useFaceDown } from '@/hooks/useFaceDown';
import { useHeaderMorph } from '@/hooks/useHeaderMorph';
import { useMeasureRect, type MeasuredRect } from '@/hooks/useMeasureRect';
import { useSessionScreen } from '@/hooks/useSessionScreen';
import { useSlideGesture } from '@/hooks/useSlideGesture';
import { findActiveBlock } from '@/lib/active-block';
import { formatTimeStat } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { isBlockActive } from '@/lib/screen-time';
import { getStats } from '@/lib/stats';
import { useAppStore } from '@/lib/store';
import { palette, themes } from '@/lib/theme';
import type BottomSheet from '@gorhom/bottom-sheet';
import HomePane from './HomePane';
import LaunchSplash from './LaunchSplash';

// ===========================================================================
// Home shell — owns the three slide panes (home / history / settings),
// their swipe gestures, the session lifecycle wiring and every overlay
// (run camera, launch splash, sheets, completion screen). The route file
// app/index.tsx just renders this.
// ===========================================================================
export default function HomeShell() {
  const insets = useSafeAreaInsets();

  const elapsed = useAppStore((s) => s.elapsed);
  const themeMode = useAppStore((s) => s.themeMode);
  const weekStats = useAppStore((s) => s.weekStats);
  const ready = useAppStore((s) => s.ready);
  const started = useAppStore((s) => s.started);
  const phase = useAppStore((s) => s.phase);
  const awaitingFaceDown = useAppStore((s) => s.awaitingFaceDown);
  const completionHeld = useAppStore((s) => s.completionHeld);
  // Live face-down reading, readable from effects declared above the
  // sensor hook (refs dodge the TDZ on the hook's return value).
  const faceDownRef = useRef(false);
  const goalSeconds = useAppStore((s) => s.goalSeconds);
  // sliderMinutes is intentionally NOT subscribed here — every snap
  // would re-render this whole shell. The resting timer text and the
  // slider value prop both consume it via small self-subscribing
  // components in HomePane, so JS work stays local.
  const focusStep = useAppStore((s) => s.focusStep);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const onboardingComplete = useAppStore((s) => s.onboardingComplete);
  const tutorialCompleted = useAppStore((s) => s.tutorialCompleted);

  // The spotlight tour runs by itself on the first visit: one quiet second
  // so the user takes the home screen in, then it appears.
  useEffect(() => {
    if (!ready || !onboardingComplete || tutorialCompleted || started) return;
    const t = setTimeout(() => {
      useAppStore.getState().setTutorialPending(true);
    }, 1000);
    return () => clearTimeout(t);
  }, [ready, onboardingComplete, tutorialCompleted, started]);

  // Until that first tour is completed (or skipped), the home screen is
  // locked: no swipes, no taps — the tour drives, the user watches. The
  // shield in HomePane blocks touches; the swipe gestures are gated
  // explicitly.
  const tutorialGate = ready && onboardingComplete && !tutorialCompleted;

  const accountSheetRef = useRef<BottomSheet>(null);
  // BlockSheet and SessionEndedSheet are now driven by a `visible` prop
  // — the previous imperative ref + expand()/close() pattern raced with
  // gorhom's first-paint layout (and `index={-1}` doesn't actually
  // close in v5 because handleSnapToIndex(-1) reads detents[-1]).
  // Both sheets render via BottomSheetModal which handles open/close
  // through the modal portal.
  const handleOpenAccount = useCallback(() => {
    accountSheetRef.current?.expand();
  }, []);

  // Shared element: Journey pill on home ↔ Journey heading in history.
  // We measure both on-screen rects and float a proxy Text that smoothly
  // travels + scales between them, driven by historySlide.
  const journeyBtnRef = useRef<View>(null);
  const { rect: btnRect, measure: measureJourneyBtn } = useMeasureRect(journeyBtnRef);
  const [headingRect, setHeadingRect] = useState<MeasuredRect | null>(null);

  const handleHeadingLayout = useCallback((rect: MeasuredRect) => {
    setHeadingRect(rect);
  }, []);
  const lastSessionId = useAppStore((s) => s.lastSessionId);
  const lastSessionDuration = useAppStore((s) => s.lastSessionDuration);
  const completionVisible = useAppStore((s) => s.completionVisible);
  const sessionEndedVisible = useAppStore((s) => s.sessionEndedVisible);
  const interruptedDuration = useAppStore((s) => s.interruptedDuration);
  const cancelReason = useAppStore((s) => s.cancelReason);
  // True while the user has paused via interrupt — the running UI
  // freezes (timer + dots) and the SessionEndedSheet takes over with
  // the continue / start over / back home actions.
  const paused = useAppStore((s) => s.paused);
  // 'block' when the running session is part of a scheduled-block
  // unlock flow — switches the pause sheet's third action from
  // "back home" (no-op for blocked apps) to "unlock now" so the
  // user always has a usable out.
  const sessionOrigin = useAppStore((s) => s.sessionOrigin);
  const scheduledBlocks = useAppStore((s) => s.scheduledBlocks);

  // Block-waiting state: a scheduled block fired and apps are locked until the
  // user either does nothing for the required time, or force-unlocks.
  const blockWaiting = focusStep === 'done';
  const activeBlock = blockWaiting
    ? findActiveBlock(scheduledBlocks, new Date())
    : null;
  const unlockMin = activeBlock?.unlockGoalMinutes ?? 15;

  const theme = themes[themeMode];
  // 3 synchronous SQLite aggregates — must not run on every render:
  // during a session this component re-renders every second via
  // `elapsed`. weekStats doubles as the store's "sessions changed"
  // trigger (bumped on every save/delete/mood edit), so it's the
  // exact invalidation key; the live-session delta is added in the
  // stats row as `stats.today + elapsed` without touching the DB.
  const stats = useMemo(() => getStats(), [weekStats]);
  // Formatted once per render instead of inline in the JSX — the stats
  // row reads .value and .unit separately, which would double the calls.
  const todayStat = formatTimeStat(stats.today + elapsed);
  const weekStat = formatTimeStat(stats.week + elapsed);
  // Week-dot scale — previously recomputed inside the .map() callback,
  // i.e. O(n²) per render (and this screen re-renders every second
  // during a session).
  const maxDur = Math.max(...weekStats.map((d) => d.duration), 1);

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

  // --- Entry animations: header morph + resting timer opacity ---
  const { timerEntryStyle, hideStyle, showStyle, resetToRest, snapToRunning } =
    useHeaderMorph({ started, completionVisible, sessionEndedVisible });

  // --- Countdown complete: auto-end session when timer reaches 00:00 ---
  useEffect(() => {
    if (started && goalSeconds > 0 && elapsed >= goalSeconds) {
      // A long, warm haptic marks the end — no notification.
      haptics.celebrate();
      // If a scheduled block is still enforcing a shield, the user has earned
      // their unlock by completing the countdown. releaseBlockShield also
      // re-registers every enabled block for its next occurrence — the
      // release itself stops ALL monitors.
      if (isBlockActive()) {
        useAppStore.getState().releaseBlockShield().catch(() => {});
      }
      // If the phone is lying face down, the celebration waits — the
      // success screen greets the user as they pick the phone up.
      useAppStore.getState().completeSession({ holdUntilLift: faceDownRef.current });
    }
  }, [elapsed, started, goalSeconds]);

  // --- Goal slider ---
  // Drag updates only `sliderMinutes` (consumed by two memoised tiny
  // components in HomePane), so the shell never re-renders mid-drag.
  // The actual goal — which a lot of UI subscribes to via `goalSeconds` —
  // is committed once on release.
  const handleSliderChange = useCallback((mins: number) => {
    useAppStore.getState().setSliderMinutes(mins);
  }, []);
  const handleSliderRelease = useCallback((mins: number) => {
    useAppStore.getState().setGoalFromSlider(mins);
  }, []);

  // Read once per render — the splash seeding below and both slide
  // styles share it. Kept inside the component (not module-level) so
  // iPad split-view / rotation still picks up fresh values on re-render.
  const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

  // --- History slide ---
  const historySlide = useSharedValue(0); // 0 = main visible, 1 = history visible
  const historyScrollY = useSharedValue(0);

  // --- Settings slide (from left) ---
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
    // Proxy carries the morph during the transition, then hands off
    // to the real heading inside the ScrollView once the panel is
    // settled (slide = 1). After handoff the heading scrolls along
    // with the rest of the content like normal page content.
    const opacity = interpolate(p, [0.95, 1], [1, 0], 'clamp');
    return {
      opacity,
      transform: [
        { translateX: cx - headingRect.w / 2 + s * SCREEN_W },
        { translateY: cy - headingRect.h / 2 },
        { scale },
      ],
    };
  });

  // Swipe up on main → open history
  const mainVerticalPan = useSlideGesture({
    slide: historySlide,
    direction: 'up',
    mode: 'open',
    unit: SCREEN_H,
    enabled: !started && !tutorialGate,
  });

  // Swipe left on main → open settings (commits via store action)
  const openSettingsJS = useCallback(() => {
    useAppStore.getState().openSettings();
  }, []);
  const mainHorizontalPan = useSlideGesture({
    slide: settingsSlide,
    direction: 'right',
    mode: 'open',
    unit: SCREEN_W,
    enabled: !started && !tutorialGate,
    onCommit: openSettingsJS,
  });

  const mainPanGesture = Gesture.Exclusive(mainVerticalPan, mainHorizontalPan);

  // Swipe right on settings → close (commits via store action)
  const closeSettingsJS = useCallback(() => {
    useAppStore.getState().closeSettings();
  }, []);
  const settingsSwipeBack = useSlideGesture({
    slide: settingsSlide,
    direction: 'left',
    mode: 'close',
    unit: SCREEN_W,
    enabled: settingsOpen,
    failPerpendicular: [-20, 20],
    onCommit: closeSettingsJS,
  });

  // Native gesture for the history ScrollView — lets Pan and Scroll coexist
  const historyScrollNativeGesture = Gesture.Native();

  // Swipe down on history → close (gated on scroll position so the
  // ScrollView can scroll without triggering a dismiss).
  const historyPanGesture = useSlideGesture({
    slide: historySlide,
    direction: 'down',
    mode: 'close',
    unit: SCREEN_H,
    failPerpendicular: null,
    scrollGate: { value: historyScrollY, threshold: 5 },
    simultaneousWith: historyScrollNativeGesture,
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
    // One door: requestBlockUnlock decides (phase must be idle, focus
    // hidden, shield actually up). No subscription gate, deliberately: an
    // active shield means the user's apps ARE blocked right now and this
    // unlock UI is their only way out — entitlement is enforced where
    // blocks get CREATED, not at the exit.
    if (useAppStore.getState().requestBlockUnlock(isBlockActive()) === 'shown') {
      activateKeepAwakeAsync('scheduled-block');
    }
  }, [started]);

  // Whether to surface the BlockSheet on the home screen — true when
  // a scheduled block has fired and the user hasn't unlocked yet.
  // Wrapped in a ref-friendly poll because the native shield state
  // sync isn't always immediate on cold start / foreground transition.
  const checkAndShowBlockUnlock = useCallback(() => {
    // One door: 'busy' (a session/celebration owns the screen) and 'shown'
    // both stop the poll; 'none' keeps it retrying. No subscription gate —
    // see the comment in the started→false effect above.
    const result = useAppStore.getState().requestBlockUnlock(isBlockActive());
    if (result === 'shown') activateKeepAwakeAsync('scheduled-block');
    return result !== 'none';
  }, []);

  // Polls the native shield state up to three times (now, +300ms,
  // +900ms). Native is occasionally slow to surface the shield on
  // a brand-new JS bridge — retrying covers cold start AND backgrounded
  // foreground transitions where the bridge is fresh. Bails the moment
  // either a block surfaces or the gate (started / focusStep) flips.
  const pollBlockUnlock = useCallback(
    (cancelledRef: { current: boolean }) => {
      const tick = () => {
        if (cancelledRef.current) return true;
        return checkAndShowBlockUnlock();
      };
      if (tick()) return;
      setTimeout(() => {
        if (tick()) return;
        setTimeout(tick, 600);
      }, 300);
    },
    [checkAndShowBlockUnlock],
  );

  // Init + notification/shield/AppState listeners live in one hook so
  // this shell stays focused on the home-screen UI. See useAppLifecycle.
  useAppLifecycle(pollBlockUnlock);


  // When a session ends (started: true → false), check the native shield.
  // The lifecycle listeners suppress BlockSheet during sessions to avoid
  // popping over the running UI / pause sheet, so this is the moment we
  // need to surface it if a scheduled block fired in the meantime and
  // the shield is still up. pollBlockUnlock has its own retries to
  // catch any state settle delay.
  const startedRef = useRef(started);
  useEffect(() => {
    const wasStarted = startedRef.current;
    startedRef.current = started;
    if (wasStarted && !started) {
      const cancelledRef = { current: false };
      pollBlockUnlock(cancelledRef);
      return () => {
        cancelledRef.current = true;
      };
    }
  }, [started, pollBlockUnlock]);

  // --- Theme toggle ---
  const toggleTheme = useCallback(() => {
    haptics.light();
    useAppStore.getState().toggleTheme();
  }, []);

  // --- Settings ---
  const handleSettingsPress = useCallback(() => {
    haptics.light();
    settingsSlide.value = withTiming(1, { duration: 400 });
    useAppStore.getState().openSettings();
  }, []);

  const handleSettingsClose = useCallback(() => {
    haptics.light();
    settingsSlide.value = withTiming(0, { duration: 300 });
    useAppStore.getState().closeSettings();
  }, []);

  // Emergency unlock: bypasses the do-nothing gate. Shown on the block-waiting
  // main screen so the user always has an out.
  const handleForceUnlock = useCallback(() => {
    haptics.success();
    deactivateKeepAwake('focus');
    deactivateKeepAwake('scheduled-block');
    useAppStore.getState().releaseBlockShield().catch(() => {});
    useAppStore.getState().unlockFocus();
  }, []);

  const handleStartBlockSession = useCallback(
    (minutes: number) => {
      haptics.medium();
      // Jump the header morph to the "Doing nothing" state so the user doesn't
      // see a flash of "Ready to Do nothing?" when leaving the block-waiting UI.
      snapToRunning();
      // Same reason as handleStart: snap to home so the camera/timer
      // are anchored to the visible screen when the block flow fires
      // while the user was on settings or history.
      settingsSlide.value = 0;
      historySlide.value = 0;
      useAppStore.getState().startBlockSession(minutes);
    },
    [snapToRunning, settingsSlide, historySlide],
  );

  // --- Launch splash + run camera anchor -----------------------------------
  // Both land on the measured yes button: the splash shrinks onto it, the
  // camera expands from it. The shared values live here so the two
  // components stay geometrically consistent.
  const yesButtonRef = useRef<View>(null);
  const { rect: yesBtnRect, measure: measureYesButton } = useMeasureRect(yesButtonRef);

  // Seeded with safe "cover the screen" defaults so the splash is opaque
  // from the very first frame even before the yes button is measured.
  const splashCenterX = useSharedValue(SCREEN_W / 2);
  const splashCenterY = useSharedValue(SCREEN_H / 2);
  const splashInitialSize = useSharedValue(Math.max(SCREEN_W, SCREEN_H) * 2.5);

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
      Math.hypot(SCREEN_W - cx, cy),
      Math.hypot(cx, SCREEN_H - cy),
      Math.hypot(SCREEN_W - cx, SCREEN_H - cy),
    );
    splashCenterX.value = cx;
    splashCenterY.value = cy;
    splashInitialSize.value = maxDist * 2 + 80;
  }, [yesBtnRect]);

  // --- Distraction-free mode: manual "hide everything + go dark" toggle ---

  // Paused / the face-down gate: the running timers are not rendered and
  // the screen is never dimmed — the sheet / the gate instruction must
  // stay readable. Straight from the machine phase.
  const suppressed = phase === 'paused' || phase === 'arming';

  // Face-down is the session's contract: once the phone has been lying
  // face down during a RUNNING session, lifting it pauses — same flow as
  // the pause pill (SessionEndedSheet: continue / start over / end). A
  // session started via the manual fallback (never face down) is exempt —
  // the ref only arms after a real face-down reading.
  const runningGate = started && !awaitingFaceDown && !paused;
  const { faceDown: runningFaceDown } = useFaceDown(runningGate || completionHeld);
  useEffect(() => {
    faceDownRef.current = runningFaceDown;
  }, [runningFaceDown]);
  const wasFaceDownRef = useRef(false);
  useEffect(() => {
    if (!runningGate) {
      wasFaceDownRef.current = false;
      return;
    }
    if (runningFaceDown) {
      wasFaceDownRef.current = true;
      return;
    }
    if (wasFaceDownRef.current) {
      wasFaceDownRef.current = false;
      haptics.light();
      useAppStore.getState().pauseSession();
    }
  }, [runningGate, runningFaceDown]);

  // The held celebration fires the moment the phone comes off the table.
  useEffect(() => {
    if (completionHeld && !runningFaceDown) {
      useAppStore.getState().revealCompletion();
    }
  }, [completionHeld, runningFaceDown]);

  // Screen-dimming controller — owns brightness, the content fade and the
  // tap-to-wake state. See hooks/useSessionScreen. While it's still fading
  // (`!fullyDark`) the UI is untouched so the pause button stays tappable;
  // once fully black, `fullyDark` turns on and we put up a tap-catcher.
  // While face down the backlight drops to true zero.
  const { contentStyle, fullyDark, wake } = useSessionScreen({
    active: started,
    suppressed,
    distractionFree: false,
    faceDown: runningFaceDown,
  });

  const handleStart = useCallback(() => {
    haptics.medium();
    // Snap to home so the running camera + timer aren't drawn at an
    // off-screen anchor when start fires while settings/history slides
    // are still partially open (block-session-from-settings flow).
    settingsSlide.value = 0;
    historySlide.value = 0;
    useAppStore.getState().startSession();
  }, [settingsSlide, historySlide]);

  // Reset the resting-state visuals after a session truly ends.
  const runResetAnimations = useCallback(() => {
    resetToRest();
    setTimeout(() => useAppStore.getState().resetElapsed(), 700);
  }, [resetToRest]);

  const handleStop = useCallback(async () => {
    haptics.light();
    const elapsed = useAppStore.getState().elapsed;
    if (elapsed > 0) {
      // Pause the timer and let the SessionEndedSheet take over with
      // the continue / start over / back home actions. The session
      // stays alive (started: true) so resume can pick up from the
      // frozen elapsed.
      useAppStore.getState().pauseSession();
      return;
    }
    // Nothing elapsed — quick stop straight back to home.
    await useAppStore.getState().stopSession();
    runResetAnimations();
  }, [runResetAnimations]);

  // Stopwatch-mode finish — there's no countdown to auto-complete the
  // session, so the user needs an explicit way to end the run AND see
  // the completion screen. Routes through completeSession (same flow
  // a countdown takes when it hits 00:00) so the celebration cascade,
  // mood dial and farewell beat all run as expected.
  const handleFinishStopwatch = useCallback(async () => {
    haptics.success();
    await useAppStore.getState().completeSession();
  }, []);

  // The resting visuals (the "Ready to Do nothing?" header morph, timer
  // opacity) follow the MACHINE, not individual buttons: whenever the
  // phase comes back to idle — whatever path led there (gate "back",
  // sheet end, unlock, quick stop) — the home screen restores itself.
  // Individual handlers may still call runResetAnimations earlier for
  // snappier feel; the calls are idempotent.
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (phase === 'idle' && prev !== 'idle' && prev !== 'celebrating') {
      runResetAnimations();
    }
  }, [phase, runResetAnimations]);

  // Sheet handlers — only used in the manual pause flow.
  const handleSheetContinue = useCallback(() => {
    useAppStore.getState().resumeSession();
    useAppStore.getState().dismissSessionEnded();
  }, []);

  const handleSheetStartOver = useCallback(() => {
    useAppStore.getState().restartSession();
    useAppStore.getState().dismissSessionEnded();
  }, []);

  const handleSheetEnd = useCallback(async () => {
    await useAppStore.getState().stopSession();
    useAppStore.getState().dismissSessionEnded();
    runResetAnimations();
  }, [runResetAnimations]);

  // Block-flow only — replaces "back home" when the session is part
  // of a scheduled block. Unblocks Screen Time, ends the session
  // (saves what they did), then drops the user back on the home
  // screen. Without this, "back home" would land on a still-blocked
  // device with no way to recover until the next unlock cycle.
  const handleSheetUnlock = useCallback(async () => {
    haptics.success();
    deactivateKeepAwake('focus');
    deactivateKeepAwake('scheduled-block');
    useAppStore.getState().releaseBlockShield().catch(() => {});
    await useAppStore.getState().stopSession();
    useAppStore.getState().dismissSessionEnded();
    runResetAnimations();
  }, [runResetAnimations]);

  const handleCompletionClose = useCallback(() => {
    useAppStore.getState().dismissCompletion();
  }, []);

  const handleDeleteAccount = useCallback(async () => {
    // Close the account sheet + the slides so the user lands on a
    // clean home before the wipe redraws the empty stats. AccountSheet
    // is controlled via its imperative ref since it's a gorhom sheet.
    try { accountSheetRef.current?.close(); } catch {}
    settingsSlide.value = 0;
    historySlide.value = 0;
    try {
      await useAppStore.getState().deleteLocalAccount();
    } catch (e) {
      // deleteLocalAccount rethrows when the SQLite wipe fails — the
      // data is still on disk, so don't pretend it's gone: tell the
      // user the deletion didn't happen and let them retry.
      console.error('[handleDeleteAccount] failed:', e);
      Alert.alert(
        'Deletion failed',
        'Your data could not be deleted. Please try again, or reinstall the app to remove everything.',
      );
    }
  }, [settingsSlide, historySlide]);

  const handleHistory = useCallback(() => {
    haptics.light();
    historySlide.value = withTiming(1, { duration: 500 });
  }, []);

  const handleHistoryClose = useCallback(() => {
    haptics.light();
    historySlide.value = withTiming(0, { duration: 400 });
  }, []);

  // Tutorial drivers — silent (no haptics) so the auto-advance during
  // the tour doesn't feel like the user pressed something.
  const tutorialShowHome = useCallback(() => {
    settingsSlide.value = withTiming(0, { duration: 300 });
    historySlide.value = withTiming(0, { duration: 300 });
    useAppStore.getState().closeSettings();
  }, []);
  const tutorialShowSettings = useCallback(() => {
    settingsSlide.value = withTiming(1, { duration: 400 });
    useAppStore.getState().openSettings();
  }, []);
  const tutorialShowHistory = useCallback(() => {
    historySlide.value = withTiming(1, { duration: 500 });
  }, []);

  if (!ready) {
    // Match the launch splash colour so there is no dark flash between the
    // native splash hiding and the JS splash overlay mounting.
    return (
      <View style={[styles.container, { backgroundColor: palette.terracotta }]} />
    );
  }

  // First launch only: send the user through onboarding until they finish it.
  // `onboardingComplete` is a persisted setting (hydrated into the store on
  // init), so this redirect fires exactly once per install — it's cleared
  // only by a data wipe or reinstall. Once onboarding calls
  // `setOnboardingComplete()` and navigates back to '/', this is false and
  // the home screen renders (then the spotlight tour fires once).
  if (!onboardingComplete) {
    return <Redirect href="/onboarding" />;
  }

  // =========================================================================
  // Main screen — session-ended state shows as a bottom sheet over
  // the resting main UI, not as a full-screen replacement.
  // =========================================================================
  return (
    <View style={[styles.screenStack, { backgroundColor: theme.bg }]}>
      <TutorialController
        showHome={tutorialShowHome}
        showSettings={tutorialShowSettings}
        showHistory={tutorialShowHistory}
      />
      <GestureDetector gesture={mainPanGesture}>
        <Animated.View
          style={[styles.container, animatedContainerStyle, mainSlideStyle]}
        >
          <HomePane
            theme={theme}
            themeMode={themeMode}
            insetsTop={insets.top}
            started={started}
            suppressed={suppressed}
            tutorialGate={tutorialGate}
            elapsed={elapsed}
            goalSeconds={goalSeconds}
            todayStat={todayStat}
            weekStat={weekStat}
            weekStats={weekStats}
            maxDur={maxDur}
            timerEntryStyle={timerEntryStyle}
            hideStyle={hideStyle}
            showStyle={showStyle}
            journeyPillStyle={journeyPillStyle}
            journeyChevronStyle={journeyChevronStyle}
            yesButtonRef={yesButtonRef}
            onYesButtonLayout={measureYesButton}
            journeyBtnRef={journeyBtnRef}
            onJourneyBtnLayout={measureJourneyBtn}
            onSettingsPress={handleSettingsPress}
            onToggleTheme={toggleTheme}
            onStart={handleStart}
            onHistory={handleHistory}
            onSliderChange={handleSliderChange}
            onSliderRelease={handleSliderRelease}
          />
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
        </Animated.View>
      </GestureDetector>

      {/* Camera + running UI ride the same slide transform as the home
          content so the terracotta circle (which is anchored to the
          measured yes-button position on home) doesn't sit pinned at
          screen-centre while the user has swiped to settings/history. */}
      <RunOverlay
        theme={theme}
        insetsBottom={insets.bottom}
        started={started}
        paused={paused}
        awaitingFaceDown={awaitingFaceDown}
        suppressed={suppressed}
        elapsed={elapsed}
        goalSeconds={goalSeconds}
        slideStyle={mainSlideStyle}
        contentStyle={contentStyle}
        centerX={splashCenterX}
        centerY={splashCenterY}
        coverSize={splashInitialSize}
        onPause={handleStop}
        onFinishStopwatch={handleFinishStopwatch}
      />

      {/* While the finished phone still lies face down: a solid curtain so
          nothing (home UI, brightness restore) shows before the reveal. */}
      {completionHeld && <View style={styles.completionHold} />}

      {/* Shared account sheet — available from Settings header and from both gates */}
      <AccountSheet
        ref={accountSheetRef}
        theme={theme}
        onDeleteAccount={handleDeleteAccount}
      />

      {/* Block-state sheet — appears when a scheduled block has fired */}
      <BlockSheet
        visible={blockWaiting}
        theme={theme}
        unlockMin={unlockMin}
        onStart={handleStartBlockSession}
        onUnlock={handleForceUnlock}
      />

      {/* Session-ended sheet — only the manual pause flow
          (continue / start over / back home) shows it. The
          backgrounded recovery sheet was intentionally removed,
          so any non-manual sessionEndedVisible state is treated
          as stale and the sheet stays closed. */}
      <SessionEndedSheet
        visible={phase === 'paused'}
        theme={theme}
        interruptedDuration={interruptedDuration}
        goalSeconds={goalSeconds}
        cancelReason={cancelReason}
        sessionOrigin={sessionOrigin}
        onContinue={handleSheetContinue}
        onStartOver={handleSheetStartOver}
        onEnd={handleSheetEnd}
        onUnlock={handleSheetUnlock}
      />

      {/* Floating Journey label — the one shared element that morphs between the
        home pill and the Journey heading as the panel slides up. Hidden while
        a session is running or a scheduled block is waiting — those overlays
        own the screen and the floating proxy would otherwise peek through. */}
      {btnRect &&
        headingRect &&
        !started &&
        !blockWaiting && (
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

      {/* Countdown completion screen */}
      <SessionCompleteScreen
        visible={completionVisible}
        sessionId={lastSessionId}
        durationSeconds={lastSessionDuration}
        themeMode={themeMode}
        yesBtnRect={yesBtnRect}
        onClose={handleCompletionClose}
        onUnlock={sessionOrigin === 'block' ? handleForceUnlock : undefined}
      />

      {/* Launch splash — terracotta sheet that covers the screen and
          shrinks in place onto the measured yes button. */}
      <LaunchSplash
        ready={ready}
        yesBtnRect={yesBtnRect}
        theme={theme}
        slideStyle={mainSlideStyle}
        centerX={splashCenterX}
        centerY={splashCenterY}
        initialSize={splashInitialSize}
      />

      {/* Once the session has faded the screen fully black, a tap anywhere
          wakes it. Only when fullyDark (so the pause button stays tappable
          while fading) and not in the manual distraction-free toggle (which
          has its own exit). */}
      {fullyDark && (
        <Pressable
          style={[StyleSheet.absoluteFill, styles.wakeCatcher]}
          onPress={wake}
        />
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
    overflow: 'hidden',
  },
  completionHold: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.terracotta,
    zIndex: 60,
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
  wakeCatcher: {
    zIndex: 100,
  },
});

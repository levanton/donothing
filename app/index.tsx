import { Entypo, Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AccountSheet from '@/components/AccountSheet';
import GoalSliderBar from '@/components/GoalSliderBar';
import HistoryContent from '@/components/HistoryContent';
import OrbitRing, { RING_SIZE } from '@/components/OrbitRing';
import PaywallGate from '@/components/PaywallGate';
import SessionCompleteScreen from '@/components/SessionCompleteScreen';
import SessionEndedView from '@/components/SessionEndedView';
import SettingsContent from '@/components/SettingsContent';
import TimerDisplay from '@/components/TimerDisplay';
import { Fonts } from '@/constants/theme';
import type { ScheduledBlock } from '@/lib/db/types';
import { formatTimeStat } from '@/lib/format';
import {
  blockAppsById,
  forceUnblockAll,
  isBlockActive,
  unblockAppsById,
} from '@/lib/screen-time';
import { getStats } from '@/lib/stats';
import { useAppStore } from '@/lib/store';
import { palette, themes } from '@/lib/theme';
import type BottomSheet from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';

const RING_R = 64;

function findActiveBlock(
  blocks: ScheduledBlock[],
  now: Date,
): ScheduledBlock | null {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.getDay();
  for (const b of blocks) {
    if (!b.enabled) continue;
    if (b.weekdays.length > 0 && !b.weekdays.includes(today)) continue;
    const start = b.hour * 60 + b.minute;
    const end = start + b.durationMinutes;
    if (end <= 24 * 60) {
      if (nowMinutes >= start && nowMinutes < end) return b;
    } else {
      if (nowMinutes >= start || nowMinutes < end - 24 * 60) return b;
    }
  }
  return null;
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
  const sliderMinutes = useAppStore((s) => s.sliderMinutes);
  const focusStep = useAppStore((s) => s.focusStep);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const isSubscribed = useAppStore((s) => s.isSubscribed);

  const accountSheetRef = useRef<BottomSheet>(null);
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
  const dotProgress = useSharedValue(0);
  const orbitAmount = useSharedValue(0); // 0 = centered (button), 1 = orbiting (dot)
  const buttonSize = useSharedValue(140); // 140 = button, 12 = dot
  const playIconOpacity = useSharedValue(1);

  // Header morph: "Ready to Do|ing| nothing|?|"
  const hideOpacity = useSharedValue(1);
  const hideWidth = useSharedValue(1);
  const showOpacity = useSharedValue(0);
  const showWidth = useSharedValue(0);

  useEffect(() => {
    if (!started) return;
    // Button shrinks to dot and starts orbiting
    buttonSize.value = withTiming(12, { duration: 600 });
    playIconOpacity.value = withTiming(0, { duration: 300 });
    orbitAmount.value = withTiming(1, { duration: 600 });
    // Timer and ring appear
    timerOpacity.value = withTiming(1, { duration: 1125 });
    // Header text morph
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
        forceUnblockAll([]).catch(() => {});
        unblockAppsById('donothing-scheduled-block').catch(() => {});
      }
      useAppStore.getState().completeSession();
    }
  }, [elapsed, started, goalSeconds]);

  // --- Reset main screen visuals while completion overlay is showing ---
  useEffect(() => {
    if (!completionVisible) return;
    orbitAmount.value = withTiming(0, { duration: 600 });
    buttonSize.value = withTiming(140, { duration: 600 });
    playIconOpacity.value = withTiming(1, { duration: 900 });
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
    orbitAmount.value = 0;
    buttonSize.value = 140;
    playIconOpacity.value = 1;
    timerOpacity.value = 0.9;
    showOpacity.value = 0;
    showWidth.value = 0;
    hideWidth.value = 1;
    hideOpacity.value = 1;
  }, [sessionEndedVisible]);

  const timerEntryStyle = useAnimatedStyle(() => ({
    opacity: timerOpacity.value,
  }));

  const unifiedDotStyle = useAnimatedStyle(() => {
    const rad = dotProgress.value * 2 * Math.PI;
    const orbitX = Math.sin(rad) * RING_R;
    const orbitY = -Math.cos(rad) * RING_R;
    const s = buttonSize.value;
    return {
      width: s,
      height: s,
      borderRadius: s / 2,
      transform: [
        { translateX: orbitAmount.value * orbitX },
        { translateY: orbitAmount.value * orbitY },
      ],
    };
  });

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
    .enabled(!started && !blockWaiting)
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
    .enabled(!started && !blockWaiting)
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

  // Deactivate keep awake when focus ends (unblock only happens on explicit unlock)
  useEffect(() => {
    if (focusStep === 'hidden') {
      deactivateKeepAwake('focus');
      deactivateKeepAwake('scheduled-block');
    }
  }, [focusStep]);

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
    const handleScheduledBlock = (data: Record<string, unknown>) => {
      if (data?.type === 'scheduledBlock' && data?.durationMinutes) {
        const durationSec = (data.durationMinutes as number) * 60;
        blockAppsById('donothing-scheduled-block').catch(() => {});
        activateKeepAwakeAsync('scheduled-block');
        useAppStore.getState().startFocus(durationSec);
      }
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
    forceUnblockAll([]).catch(() => {});
    unblockAppsById('donothing-scheduled-block').catch(() => {});
    useAppStore.getState().unlockFocus();
  }, []);

  const handleStartBlockSession = useCallback(() => {
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
      goalSeconds: unlockMin * 60,
    });
    useAppStore.getState().startSession();
  }, [unlockMin]);

  // --- Distraction-free mode: hide timer & button while running ---
  const [distractionFree, setDistractionFree] = useState(false);
  const toggleDistractionFree = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDistractionFree((v) => !v);
  }, []);

  // --- Debug: manual block toggle ---
  const [debugBlocked, setDebugBlocked] = useState(false);
  const handleDebugBlock = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const anyActive = (() => {
      try {
        return isBlockActive();
      } catch {
        return false;
      }
    })();
    if (debugBlocked || anyActive) {
      const groupIds: string[] = [];
      await forceUnblockAll(groupIds).catch(() => {});
      await unblockAppsById('donothing-scheduled-block').catch(() => {});
      setDebugBlocked(false);
    } else {
      await blockAppsById('donothing-scheduled-block').catch(() => {});
      setDebugBlocked(true);
    }
  }, [debugBlocked]);

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
    // Dot grows back to button
    orbitAmount.value = withTiming(0, { duration: 600 });
    buttonSize.value = withTiming(140, { duration: 600 });
    playIconOpacity.value = withTiming(1, { duration: 900 });
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
    return (
      <View style={[styles.container, { backgroundColor: themes.dark.bg }]} />
    );
  }

  // =========================================================================
  // Session ended — shown when the previous session was cancelled (backgrounded)
  // =========================================================================
  if (sessionEndedVisible) {
    return (
      <SessionEndedView
        themeMode={themeMode}
        onStartAgain={() => useAppStore.getState().dismissSessionEnded()}
      />
    );
  }

  // =========================================================================
  // Main screen
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
            disabled={started || blockWaiting}
            style={[
              styles.lockButton,
              {
                top: insets.top + 12,
                opacity: started || blockWaiting ? 0 : 1,
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
                  opacity: started || blockWaiting ? 0 : 1,
                },
              ]}
              pointerEvents={started || blockWaiting ? 'none' : 'auto'}
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

              {Platform.OS === 'ios' && (
                <Pressable
                  onPress={handleDebugBlock}
                  disabled={started}
                  style={styles.devIconBtn}
                  hitSlop={12}
                >
                  <Feather
                    name={debugBlocked ? 'unlock' : 'lock'}
                    size={18}
                    color={debugBlocked ? theme.accent : theme.text}
                    style={{ opacity: 0.9 }}
                  />
                </Pressable>
              )}

              <Pressable
                onPress={() =>
                  useAppStore.setState({
                    completionVisible: true,
                    lastSessionId: 'dev-preview',
                    lastSessionDuration: 60,
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
            </View>
          )}

          {/* Header — morphs "Ready to Do·ing nothing?" → "Doing nothing", or static "Time to Do nothing." when block is waiting */}
          <View
            style={[styles.headerRow, { opacity: distractionFree ? 0 : 1 }]}
            pointerEvents={distractionFree ? 'none' : 'auto'}
          >
            {blockWaiting ? (
              <Text
                style={[
                  styles.header,
                  { color: theme.text, fontFamily: Fonts!.serif },
                ]}
              >
                Time to Do nothing.
              </Text>
            ) : (
              <>
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
              </>
            )}
          </View>

          {/* Theme toggle — top right */}
          <Pressable
            onPress={toggleTheme}
            disabled={started || blockWaiting}
            style={[
              styles.themeToggle,
              {
                top: insets.top + 12,
                opacity: started || blockWaiting ? 0 : 1,
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
                <Animated.Text
                  style={[
                    styles.timer,
                    {
                      color: theme.text,
                      fontFamily: Fonts!.mono,
                      textAlign: 'center',
                    },
                  ]}
                >
                  {`${String(blockWaiting ? unlockMin : sliderMinutes).padStart(2, '0')}:00`}
                </Animated.Text>
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

          {/* Orbit ring + unified button/dot */}
          <View
            style={[styles.orbitWrap, { opacity: distractionFree ? 0 : 1 }]}
            pointerEvents={distractionFree ? 'none' : 'auto'}
          >
            <View style={styles.orbitArea}>
              <Animated.View style={[styles.orbitCenter, timerEntryStyle]}>
                <OrbitRing
                  color={theme.accent}
                  faintColor={
                    themeMode === 'dark' ? palette.cream : palette.charcoal
                  }
                  elapsed={elapsed}
                  onStop={handleStop}
                  dotProgress={dotProgress}
                />
              </Animated.View>
              {/* Unified element: play button ↔ orbit dot */}
              <Pressable
                onPress={
                  started
                    ? handleStop
                    : blockWaiting
                      ? handleStartBlockSession
                      : handleStart
                }
                style={styles.orbitCenter}
              >
                <Animated.View
                  style={[
                    {
                      backgroundColor: theme.accent,
                      justifyContent: 'center',
                      alignItems: 'center',
                      overflow: 'hidden',
                    },
                    unifiedDotStyle,
                  ]}
                >
                  <Animated.View style={{ opacity: playIconOpacity }}>
                    <Text
                      style={[
                        styles.nothingLabel,
                        { color: theme.accentText, fontFamily: Fonts!.serif },
                      ]}
                    >
                      yes
                    </Text>
                  </Animated.View>
                </Animated.View>
              </Pressable>
            </View>
          </View>

          {/* Goal slider */}
          <View
            style={[
              styles.messageSliderArea,
              { opacity: started || blockWaiting ? 0 : 1 },
            ]}
            pointerEvents={started || blockWaiting ? 'none' : 'auto'}
          >
            {!started && !blockWaiting && (
              <View style={styles.goalSliderWrap}>
                <GoalSliderBar
                  theme={theme}
                  value={sliderMinutes}
                  onChange={handleSliderChange}
                  width={SLIDER_W}
                  maxMinutes={60}
                  minMinutes={0}
                  ticks={[5, 10, 20, 30, 45]}
                  scaleLabels={['0', '5', '10', '20', '30', '45', '60']}
                  breakpoints={{
                    b1Val: 15,
                    b1Pos: 0.25,
                    b2Val: 30,
                    b2Pos: 0.5,
                  }}
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
              </View>
            )}
          </View>

          {/* Stats — with goal slider overlaid */}
          <Pressable
            onPress={handleHistory}
            disabled={started || blockWaiting}
            style={{ opacity: started || blockWaiting ? 0 : 1 }}
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
                { opacity: started || blockWaiting ? 0 : 1 },
              ]}
              pointerEvents={started || blockWaiting ? 'none' : 'auto'}
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
            {blockWaiting ? (
              <Pressable
                onPress={handleForceUnlock}
                hitSlop={16}
                style={[
                  styles.forceUnlockBtn,
                  { borderColor: theme.textTertiary },
                ]}
              >
                <Feather name='unlock' size={15} color={theme.textSecondary} />
                <Text
                  style={[
                    styles.forceUnlockText,
                    { color: theme.textSecondary, fontFamily: Fonts!.serif },
                  ]}
                >
                  unlock now
                </Text>
              </Pressable>
            ) : (
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
                            themeMode === 'dark'
                              ? palette.cream
                              : palette.brown,
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
            )}
          </View>

          {/* Distraction-free toggle — visible only while timer is running */}
          {started && (
            <Pressable
              onPress={toggleDistractionFree}
              style={[
                styles.distractionFreeButton,
                { bottom: insets.bottom + 24, borderColor: theme.border },
              ]}
              hitSlop={16}
            >
              <Feather
                name={distractionFree ? 'eye' : 'eye-off'}
                size={20}
                color={theme.textSecondary}
              />
            </Pressable>
          )}
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

      {/* Floating Journey label — the one shared element that morphs between the
        home pill and the Journey heading as the panel slides up. */}
      {btnRect && headingRect && (
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
        todaySeconds={stats.today}
        themeMode={themeMode}
        onClose={handleCompletionClose}
      />
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
    marginBottom: 24,
  },
  header: {
    fontSize: 22,
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
    height: RING_SIZE,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitArea: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
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
  forceUnlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
  },
  forceUnlockText: {
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 0.5,
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

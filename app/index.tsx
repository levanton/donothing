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
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolateColor,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { themes, palette } from '@/lib/theme';
import { timerDisplay, formatTimeStat } from '@/lib/format';
import { getStats } from '@/lib/stats';
import { useAppStore } from '@/lib/store';
import { blockAppsById, unblockAppsById, isBlockActive, forceUnblockAll } from '@/lib/screen-time';
import OrbitRing, { RING_SIZE } from '@/components/OrbitRing';
import GoalSliderBar, { SLIDER_PAD } from '@/components/GoalSliderBar';
import HistoryContent from '@/components/HistoryContent';
import SettingsContent from '@/components/SettingsContent';
import PillButton from '@/components/PillButton';
import PostSessionReflection from '@/components/PostSessionReflection';
import MilestoneOverlay from '@/components/MilestoneOverlay';
import { MILESTONES } from '@/lib/milestones';
import TimerDisplay from '@/components/TimerDisplay';

const FOCUS_OPTIONS = [
  { label: '15 min', seconds: 15 * 60 },
  { label: '30 min', seconds: 30 * 60 },
  { label: '1 hour', seconds: 60 * 60 },
  { label: '2 hours', seconds: 2 * 60 * 60 },
];

function getMessage(seconds: number): string {
  if (seconds < 10) return '';
  if (seconds < 30) return 'breathe.';
  if (seconds < 60) return 'good. keep going.';
  if (seconds < 180) return "you're doing nothing great.";
  if (seconds < 300) return 'the world can wait.';
  return 'just be.';
}

function getFocusMessage(remaining: number, total: number): string {
  const progress = 1 - remaining / total;
  if (progress < 0.1) return 'settle in.';
  if (progress < 0.25) return 'let go of the urge.';
  if (progress < 0.5) return 'you don\u2019t need your phone.';
  if (progress < 0.75) return 'halfway there.';
  if (progress < 0.9) return 'almost free.';
  return 'just a little more.';
}

const RING_R = 64;

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
  const showGoalSlider = useAppStore((s) => s.showGoalSlider);
  const sliderMinutes = useAppStore((s) => s.sliderMinutes);
  const focusStep = useAppStore((s) => s.focusStep);
  const focusRemaining = useAppStore((s) => s.focusRemaining);
  const focusTotal = useAppStore((s) => s.focusTotal);
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const reflectionVisible = useAppStore((s) => s.reflectionVisible);
  const lastSessionId = useAppStore((s) => s.lastSessionId);
  const milestoneQueue = useAppStore((s) => s.milestoneQueue);

  const isActiveRef = useRef(true);

  const theme = themes[themeMode];
  const stats = getStats();
  const message = getMessage(elapsed);

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
  const orbitAmount = useSharedValue(0);     // 0 = centered (button), 1 = orbiting (dot)
  const buttonSize = useSharedValue(140);     // 140 = button, 12 = dot
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
  const goalSliderX = useSharedValue(0);

  const lastHapticMin = useRef(0);
  const onSliderUpdate = useCallback((mins: number) => {
    if (mins !== lastHapticMin.current) {
      lastHapticMin.current = mins;
      Haptics.selectionAsync();
    }
    useAppStore.getState().setSliderMinutes(mins);
  }, []);

  const onSliderEnd = useCallback((mins: number) => {
    useAppStore.getState().setGoalFromSlider(mins);
  }, []);

  const goalSliderGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const x = Math.max(0, Math.min(1, (e.x - SLIDER_PAD) / (SLIDER_W - SLIDER_PAD * 2)));
      goalSliderX.value = x;
      const mins = Math.round(x * 60);
      runOnJS(onSliderUpdate)(mins);
    })
    .onEnd(() => {
      'worklet';
      const mins = Math.round(goalSliderX.value * 60);
      runOnJS(onSliderEnd)(mins);
    });


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

  // Swipe up on main → open history
  const mainVerticalPan = Gesture.Pan()
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

  const handleGoalToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const s = useAppStore.getState();
    if (s.showGoalSlider) {
      s.cancelGoal();
    } else {
      const mins = s.goalSeconds > 0 ? Math.round(s.goalSeconds / 60) : 10;
      goalSliderX.value = mins / 60;
      s.openGoalSlider();
    }
  }, []);

  // --- Message fade ---
  const messageOpacity = useSharedValue(0);
  const prevMessageRef = useRef('');

  // --- Unlock slider ---
  const UNLOCK_TRACK_W = SCREEN_W * 0.75;
  const UNLOCK_THUMB = 56;
  const UNLOCK_MAX = UNLOCK_TRACK_W - UNLOCK_THUMB - 8;
  const unlockX = useSharedValue(0);
  const unlockStartX = useSharedValue(0);

  const unlockThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: unlockX.value }],
  }));

  const unlockTextStyle = useAnimatedStyle(() => ({
    opacity: 1 - unlockX.value / UNLOCK_MAX,
  }));

  useEffect(() => {
    if (message !== prevMessageRef.current) {
      if (prevMessageRef.current === '') {
        messageOpacity.value = withTiming(1, { duration: 400 });
      } else {
        messageOpacity.value = withSequence(
          withTiming(0, { duration: 200 }),
          withTiming(1, { duration: 200 }),
        );
      }
      prevMessageRef.current = message;
    }
  }, [message]);

  const messageFadeStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
  }));

  // Deactivate keep awake when focus ends (unblock only happens on explicit unlock)
  useEffect(() => {
    if (focusStep === 'hidden') {
      deactivateKeepAwake('focus');
      deactivateKeepAwake('scheduled-block');
    }
  }, [focusStep]);

  // --- Init ---
  useEffect(() => {
    useAppStore.getState().init().then(() => {
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
    const sub1 = Notifications.addNotificationReceivedListener((notification) => {
      handleScheduledBlock(notification.request.content.data ?? {});
    });

    // When user taps notification (app was in background)
    const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
      handleScheduledBlock(response.notification.request.content.data ?? {});
    });

    return () => { sub1.remove(); sub2.remove(); };
  }, []);

  // --- AppState ---
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if ((nextState === 'background' || nextState === 'inactive') && isActiveRef.current) {
        isActiveRef.current = false;
        deactivateKeepAwake('session');
        await useAppStore.getState().handleBackground();
      } else if (nextState === 'active' && !isActiveRef.current) {
        isActiveRef.current = true;
        await useAppStore.getState().handleForeground();
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

  // --- Focus lock ---
  const handleStartFocus = useCallback((seconds: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    activateKeepAwakeAsync('focus');
    useAppStore.getState().startFocus(seconds);
  }, []);

  const cancelFocus = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    deactivateKeepAwake('focus');
    useAppStore.getState().cancelFocus();
  }, []);

  const handleUnlock = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    deactivateKeepAwake('focus');
    deactivateKeepAwake('scheduled-block');
    const groupIds: string[] = [];
    forceUnblockAll(groupIds).catch(() => {});
    unblockAppsById('donothing-scheduled-block').catch(() => {});
    useAppStore.getState().unlockFocus();
  }, []);

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
      try { return isBlockActive(); } catch { return false; }
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

  const handleReflectionDone = useCallback(() => {
    useAppStore.getState().dismissReflection();
  }, []);

  const handleMilestoneDismiss = useCallback(() => {
    useAppStore.getState().dismissMilestone();
  }, []);

  const currentMilestone = milestoneQueue.length > 0
    ? MILESTONES.find((m) => m.id === milestoneQueue[0]) ?? null
    : null;

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
  // Focus done — unlock screen
  // =========================================================================
  if (focusStep === 'done') {
    const doNothingMins = focusTotal > 0 ? Math.round(focusTotal / 60) : 15;

    return (
      <Animated.View style={[styles.container, animatedContainerStyle, { justifyContent: 'space-between', paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

        <View />

        <View style={{ alignItems: 'center' }}>
          <Feather name="lock" size={40} color={theme.textTertiary} style={{ marginBottom: 32 }} />

          <Text
            style={[
              styles.focusMessage,
              { color: theme.text, fontFamily: Fonts!.serif, fontSize: 22, marginBottom: 12 },
            ]}
          >
            your apps are blocked.
          </Text>

          <Text
            style={[
              styles.focusMessage,
              { color: theme.textTertiary, fontFamily: Fonts!.serif, marginBottom: 48 },
            ]}
          >
            do nothing to unlock them.
          </Text>

          <Pressable
            style={[styles.doNothingBtn, { backgroundColor: theme.accent }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              useAppStore.getState().startFocus(doNothingMins * 60);
              activateKeepAwakeAsync('focus');
            }}
          >
            <Text style={{ color: palette.white, fontFamily: Fonts!.serif, fontSize: 17, fontWeight: '400' }}>
              do nothing for {doNothingMins} min
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={handleUnlock}
          hitSlop={16}
        >
          <Text style={{ color: theme.textTertiary, fontFamily: Fonts!.serif, fontSize: 14, fontWeight: '300' }}>
            unlock now
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  // =========================================================================
  // Focus lock overlay — active session
  // =========================================================================
  if (focusStep === 'active') {
    const progress = focusTotal > 0 ? 1 - focusRemaining / focusTotal : 0;
    const focusMsg = getFocusMessage(focusRemaining, focusTotal);
    const ringSize = 200;
    const strokeWidth = 3;

    return (
      <Animated.View style={[styles.container, animatedContainerStyle]}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

        <Text style={[styles.focusLabel, { color: theme.accent }]}>
          FOCUS MODE
        </Text>

        {/* Circular progress */}
        <View style={{ width: ringSize, height: ringSize, marginTop: 24 }}>
          <View
            style={[
              StyleSheet.absoluteFill,
              { alignItems: 'center', justifyContent: 'center' },
            ]}
          >
            <View
              style={{
                width: ringSize,
                height: ringSize,
                borderRadius: ringSize / 2,
                borderWidth: strokeWidth,
                borderColor: theme.cardBorder,
                position: 'absolute',
              }}
            />
          </View>
          <View
            style={[
              StyleSheet.absoluteFill,
              { alignItems: 'center', justifyContent: 'center' },
            ]}
          >
            <Text
              style={[
                styles.focusTimer,
                { color: theme.text, fontFamily: Fonts!.mono },
              ]}
            >
              {timerDisplay(focusRemaining)}
            </Text>
          </View>
        </View>

        {/* Focus message */}
        <Text
          style={[
            styles.focusMessage,
            { color: theme.textSecondary, fontFamily: Fonts!.serif },
          ]}
        >
          {focusMsg}
        </Text>

        {/* Progress bar */}
        <View
          style={[styles.progressTrack, { backgroundColor: theme.subtle }]}
        >
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: theme.dot,
                width: `${Math.min(progress * 100, 100)}%`,
              },
            ]}
          />
        </View>

        {/* Quit button */}
        <Pressable
          onPress={cancelFocus}
          style={[
            styles.quitButton,
            { backgroundColor: theme.accent, borderColor: theme.accent },
          ]}
        >
          <Text style={[styles.quitText, { color: theme.accentText }]}>
            give up
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  // =========================================================================
  // Focus — pick duration
  // =========================================================================
  if (focusStep === 'pickTime') {
    return (
      <Animated.View style={[styles.container, animatedContainerStyle]}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

        <Text
          style={[
            styles.pickerTitle,
            { color: theme.text, fontFamily: Fonts!.serif },
          ]}
        >
          Lock yourself in
        </Text>
        <Text
          style={[
            styles.pickerSubtitle,
            { color: theme.textSecondary, fontFamily: Fonts!.serif },
          ]}
        >
          Choose how long to do nothing
        </Text>

        <View style={styles.pickerOptions}>
          {FOCUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.seconds}
              onPress={() => handleStartFocus(opt.seconds)}
              style={[styles.pickerOption, { borderColor: theme.cardBorder }]}
            >
              <Text style={[styles.pickerOptionText, { color: theme.text }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            useAppStore.getState().cancelFocus();
          }}
          style={styles.pickerCancel}
        >
          <Text
            style={[styles.pickerCancelText, { color: theme.textSecondary }]}
          >
            cancel
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  // =========================================================================
  // Main screen
  // =========================================================================
  return (
    <View style={[styles.screenStack, { backgroundColor: theme.bg }]}>
    <GestureDetector gesture={mainPanGesture}>
    <Animated.View style={[styles.container, animatedContainerStyle, mainSlideStyle]}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

      {/* Settings button — top left */}
      <Pressable
        onPress={handleSettingsPress}
        disabled={started}
        style={[styles.lockButton, { top: insets.top + 12, opacity: started ? 0 : 1 }]}
        hitSlop={16}
      >
        <Feather name="sliders" size={24} color={theme.text} style={{ opacity: 0.9 }} />
      </Pressable>

      {/* Onboarding test button — top right */}
      <Pressable
        onPress={() => router.push('/onboarding')}
        disabled={started}
        style={[styles.lockButton, { top: insets.top + 12, left: undefined, right: 96, opacity: started ? 0 : 1 }]}
        hitSlop={16}
      >
        <Feather name="play" size={20} color={theme.text} style={{ opacity: 0.9 }} />
      </Pressable>

      {/* Debug block button — top right (iOS only) */}
      {Platform.OS === 'ios' && (
        <Pressable
          onPress={handleDebugBlock}
          disabled={started}
          style={[styles.lockButton, { top: insets.top + 12, left: undefined, right: 60, opacity: started ? 0 : 1 }]}
          hitSlop={16}
        >
          <Feather
            name={debugBlocked ? 'unlock' : 'lock'}
            size={20}
            color={debugBlocked ? theme.accent : theme.text}
            style={{ opacity: 0.9 }}
          />
        </Pressable>
      )}

      {/* Header — morphs "Ready to Do·ing nothing?" → "Doing nothing" */}
      <View style={[styles.headerRow, { opacity: distractionFree ? 0 : 1 }]} pointerEvents={distractionFree ? 'none' : 'auto'}>
        <Animated.View style={hideStyle}>
          <Text style={[styles.header, { color: theme.text, fontFamily: Fonts!.serif }]}>
            Ready to{' '}
          </Text>
        </Animated.View>
        <Text style={[styles.header, { color: theme.text, fontFamily: Fonts!.serif }]}>
          Do
        </Text>
        <Animated.View style={showStyle}>
          <Text style={[styles.header, { color: theme.text, fontFamily: Fonts!.serif }]}>
            ing
          </Text>
        </Animated.View>
        <Text style={[styles.header, { color: theme.text, fontFamily: Fonts!.serif }]}>
          {' '}nothing
        </Text>
        <Animated.View style={hideStyle}>
          <Text style={[styles.header, { color: theme.text, fontFamily: Fonts!.serif }]}>
            ?
          </Text>
        </Animated.View>
      </View>

      {/* Theme toggle — top right */}
      <Pressable
        onPress={toggleTheme}
        disabled={started}
        style={[styles.themeToggle, { top: insets.top + 12, opacity: started ? 0 : 1 }]}
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
      <View style={{ opacity: distractionFree ? 0 : 1 }} pointerEvents={distractionFree ? 'none' : 'auto'}>
        <Animated.View style={[timerEntryStyle, styles.centerContent]}>
          {showGoalSlider && !started ? (
            <Animated.Text
              style={[
                styles.timer,
                { color: theme.text, fontFamily: Fonts!.mono, textAlign: 'center' },
              ]}
            >
              {`${String(sliderMinutes).padStart(2, '0')}:00`}
            </Animated.Text>
          ) : (
            <TimerDisplay
              seconds={Math.max(0, goalSeconds - elapsed)}
              color={theme.text}
              fontSize={64}
              style={{ letterSpacing: 4 }}
            />
          )}
        </Animated.View>
      </View>

      {/* Orbit ring + unified button/dot */}
      <View style={[styles.orbitWrap, { opacity: distractionFree ? 0 : 1 }]} pointerEvents={distractionFree ? 'none' : 'auto'}>
      <View style={styles.orbitArea}>
        <Animated.View style={[styles.orbitCenter, timerEntryStyle]}>
          <OrbitRing
            color={theme.accent}
            faintColor={themeMode === 'dark' ? palette.cream : palette.charcoal}
            elapsed={elapsed}
            onStop={handleStop}
            dotProgress={dotProgress}
          />
        </Animated.View>
        {/* Unified element: play button ↔ orbit dot */}
        <Pressable
          onPress={started ? handleStop : handleStart}
          style={styles.orbitCenter}
        >
          <Animated.View
            style={[
              { backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
              unifiedDotStyle,
            ]}
          >
            <Animated.View style={{ opacity: playIconOpacity }}>
              <Text style={[styles.nothingLabel, { color: theme.accentText, fontFamily: Fonts!.serif }]}>
                nothing
              </Text>
            </Animated.View>
          </Animated.View>
        </Pressable>

      </View>

        {/* Duration picker — to the right of play */}
        <Pressable
          onPress={handleGoalToggle}
          disabled={started}
          style={[
            styles.goalButton,
            {
              borderColor: theme.border,
              backgroundColor: showGoalSlider ? theme.border : 'transparent',
              opacity: started ? 0 : 1,
            },
          ]}
          hitSlop={20}
        >
          <Feather name="clock" size={20} color={theme.text} style={{ opacity: 0.9 }} />
        </Pressable>
      </View>

      {/* Message + goal slider overlay */}
      <View style={[styles.messageSliderArea, { opacity: started ? 0 : 1 }]} pointerEvents={started ? 'none' : 'auto'}>
        <Animated.View style={[timerEntryStyle, styles.messageContainer, messageFadeStyle]}>
          <Text
            style={[
              styles.message,
              { color: theme.textSecondary, fontFamily: Fonts!.serif },
            ]}
          >
            {message}
          </Text>
        </Animated.View>
        {showGoalSlider && !started && (
          <GestureDetector gesture={goalSliderGesture}>
            <View style={styles.goalSliderWrap}>
              <GoalSliderBar
                progress={goalSliderX}
                theme={theme}
                width={SLIDER_W}
              />
            </View>
          </GestureDetector>
        )}
      </View>

      {/* Stats — with goal slider overlaid */}
      <Pressable onPress={handleHistory} disabled={started} style={{ opacity: started ? 0 : 1 }}>
        <View style={styles.statsColumn}>
          <View style={styles.statRow}>
            <Text
              style={[styles.statRowLabel, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}
            >
              today:
            </Text>
            <View style={styles.statRowValueRow}>
              <Text
                style={[styles.statRowValue, { color: theme.text, fontFamily: Fonts!.serif }]}
              >
                {formatTimeStat(stats.today + elapsed).value}
              </Text>
              <Text style={[styles.statRowUnit, { color: theme.textTertiary }]}>
                {formatTimeStat(stats.today + elapsed).unit}
              </Text>
            </View>
          </View>
          <Text style={[styles.statDot, { color: theme.textTertiary }]}>·</Text>
          <View style={styles.statRow}>
            <Text
              style={[styles.statRowLabel, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}
            >
              week:
            </Text>
            <View style={styles.statRowValueRow}>
              <Text
                style={[styles.statRowValue, { color: theme.text, fontFamily: Fonts!.serif }]}
              >
                {formatTimeStat(stats.week + elapsed).value}
              </Text>
              <Text style={[styles.statRowUnit, { color: theme.textTertiary }]}>
                {formatTimeStat(stats.week + elapsed).unit}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Week dots */}
      {weekStats.length > 0 && (
        <View style={[styles.weekSection, { opacity: started ? 0 : 1 }]} pointerEvents={started ? 'none' : 'auto'}>
          <View style={styles.weekGrid}>
            {weekStats.map((day) => {
              const maxDur = Math.max(
                ...weekStats.map((d) => d.duration),
                1,
              );
              const size =
                day.duration > 0
                  ? 10 + (day.duration / maxDur) * 20
                  : 4;
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
          { bottom: insets.bottom + 16, opacity: started ? 0 : 1 },
        ]}
        pointerEvents={started ? 'none' : 'auto'}
      >
        <PillButton
          label="Journey"
          onPress={handleHistory}
          color={themeMode === 'dark' ? palette.cream : palette.brown}
          outline
        />
      </View>

      {/* Distraction-free toggle — visible only while timer is running */}
      {started && (
        <Pressable
          onPress={toggleDistractionFree}
          style={[styles.distractionFreeButton, { bottom: insets.bottom + 24, borderColor: theme.border }]}
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
    <Animated.View style={[styles.historyContainer, animatedContainerStyle, historySlideStyle]}>
      <HistoryContent
        onClose={handleHistoryClose}
        insets={insets}
        onScroll={historyScrollHandler}
        nativeScrollGesture={historyScrollNativeGesture}
      />
    </Animated.View>
    </GestureDetector>

    {/* Settings screen */}
    <GestureDetector gesture={settingsSwipeBack}>
    <Animated.View style={[styles.historyContainer, animatedContainerStyle, settingsSlideStyle]}>
      <SettingsContent
        onClose={handleSettingsClose}
        insets={insets}
      />
    </Animated.View>
    </GestureDetector>

    {/* Post-session reflection overlay */}
    <PostSessionReflection
      visible={reflectionVisible}
      sessionId={lastSessionId}
      theme={theme}
      onDone={handleReflectionDone}
    />

    {/* Milestone celebration overlay */}
    <MilestoneOverlay
      milestone={currentMilestone}
      theme={theme}
      onDismiss={handleMilestoneDismiss}
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
  lockIcon: {
    fontSize: 20,
    opacity: 0.25,
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
  messageContainer: {
    height: 24,
    justifyContent: 'center',
  },
  message: {
    fontSize: 17,
    fontWeight: '400',
    fontStyle: 'italic',
    textAlign: 'center',
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
    marginTop: 36,
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
  pillText: {
    fontSize: 15,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  // --- Focus picker ---
  pickerTitle: {
    fontSize: 28,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  pickerSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 40,
  },
  pickerOptions: {
    gap: 12,
    width: '100%',
    maxWidth: 260,
  },
  pickerOption: {
    borderWidth: 1.2,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  pickerOptionText: {
    fontSize: 17,
    fontWeight: '300',
    letterSpacing: 1,
  },
  pickerCancel: {
    marginTop: 32,
    padding: 12,
  },
  pickerCancelText: {
    fontSize: 14,
    fontWeight: '300',
  },
  // --- Focus active ---
  focusLabel: {
    fontSize: 11,
    letterSpacing: 4,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  focusTimer: {
    fontSize: 48,
    fontWeight: '200',
    letterSpacing: 2,
  },
  focusMessage: {
    fontSize: 16,
    fontWeight: '300',
    marginTop: 24,
    textAlign: 'center',
  },
  progressTrack: {
    width: '60%',
    height: 3,
    borderRadius: 1.5,
    marginTop: 40,
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 1.5,
  },
  quitButton: {
    marginTop: 48,
    borderWidth: 1.2,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  quitText: {
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'italic',
  },
  doNothingBtn: {
    borderWidth: 1.2,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  unlockTrack: {
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unlockLabel: {
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 1,
    position: 'absolute',
  },
  unlockThumb: {
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 4,
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
  nothingLabel: {
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  goalButton: {
    position: 'absolute',
    right: 15,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  messageSliderArea: {
    width: 300,
    height: 40,
    marginTop: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalSliderWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

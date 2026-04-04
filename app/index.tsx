import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  type SharedValue,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import Svg, { Circle as SvgCircle } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);
import { Fonts } from '@/constants/theme';
import { themes, palette, ThemeMode } from '@/lib/theme';
import { timerDisplay, formatTimeStat } from '@/lib/format';
import {
  Session,
  loadSessions,
  addSession,
  loadTheme,
  saveTheme,
} from '@/lib/storage';
import { getStats, getWeekStats, WeekDay } from '@/lib/stats';

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

// ---------------------------------------------------------------------------
// Orbit ring — dot traces a circle, colored stroke fills behind it
// ---------------------------------------------------------------------------
const RING_SIZE = 96;
const RING_R = 42;
const RING_STROKE = 3;
const RING_CIRC = 2 * Math.PI * RING_R;
const RING_PERIOD = 15; // seconds per full revolution

function OrbitRing({ color, faintColor, elapsed, onStop, dotProgress }: {
  color: string; faintColor: string; elapsed: number;
  onStop?: () => void; dotProgress: SharedValue<number>;
}) {
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;

  const smoothLap = useSharedValue(0);
  const lastElapsed = useSharedValue(elapsed);

  useEffect(() => {
    lastElapsed.value = elapsed;
  }, [elapsed]);

  useFrameCallback((info) => {
    const fracSecond = (info.timeSinceFirstFrame % 1000) / 1000;
    const totalSeconds = lastElapsed.value + fracSecond;
    dotProgress.value = (totalSeconds % RING_PERIOD) / RING_PERIOD;
    smoothLap.value = Math.floor(totalSeconds / RING_PERIOD);
  });

  const trailingProps = useAnimatedProps(() => ({
    stroke: smoothLap.value % 2 === 0 ? faintColor : color,
  }));

  const leadingProps = useAnimatedProps(() => ({
    stroke: smoothLap.value % 2 === 0 ? color : faintColor,
    strokeDashoffset: RING_CIRC * (1 - dotProgress.value),
  }));

  return (
    <Pressable onPress={onStop} style={styles.orbitContainer}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={RING_R}
          strokeWidth={RING_STROKE}
          fill="none"
          animatedProps={trailingProps}
        />
        <AnimatedCircle
          cx={cx}
          cy={cy}
          r={RING_R}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={`${RING_CIRC}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx}, ${cy}`}
          animatedProps={leadingProps}
        />
      </Svg>
      <View style={styles.orbitCenter}>
        <Feather name="square" size={20} color={color} style={{ opacity: 0.6 }} />
      </View>
    </Pressable>
  );
}

// ===========================================================================
// Main Screen
// ===========================================================================
export default function DoNothingScreen() {
  const insets = useSafeAreaInsets();

  const [elapsed, setElapsed] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [weekStats, setWeekStats] = useState<WeekDay[]>([]);
  const [ready, setReady] = useState(false);
  const [started, setStarted] = useState(false);
  const [goalSeconds, setGoalSeconds] = useState(0);
  const [goalExpanded, setGoalExpanded] = useState(false);
  const [pickerMinutes, setPickerMinutes] = useState(5);

  // Focus lock state
  type FocusStep = 'hidden' | 'pickTime' | 'active';
  const [focusStep, setFocusStep] = useState<FocusStep>('hidden');
  const [focusRemaining, setFocusRemaining] = useState(0);
  const [focusTotal, setFocusTotal] = useState(0);
  const focusEndRef = useRef(0);
  const focusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sessionStartRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(true);
  const startedRef = useRef(false);

  const theme = themes[themeMode];
  const stats = getStats(sessions);
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
  const timerOpacity = useSharedValue(0.15);
  const dotProgress = useSharedValue(0);
  const orbitAmount = useSharedValue(0);     // 0 = centered (button), 1 = orbiting (dot)
  const buttonSize = useSharedValue(88);     // 88 = button, 12 = dot
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

  // --- Goal picker (single element expands from button to card) ---
  const goalExpand = useSharedValue(0);
  const GOAL_TX_COLLAPSED = 72; // offset right from orbitArea center

  const goalAnimStyle = useAnimatedStyle(() => {
    const t = goalExpand.value;
    return {
      width: 44 + t * (260 - 44),
      height: 34 + t * (240 - 34),
      borderRadius: 17 + t * (20 - 17),
      transform: [{ translateX: GOAL_TX_COLLAPSED * (1 - t) }],
    };
  });

  const goalIconOpacityStyle = useAnimatedStyle(() => ({
    opacity: 1 - goalExpand.value,
  }));

  const goalContentOpacityStyle = useAnimatedStyle(() => ({
    opacity: goalExpand.value,
  }));

  const handleGoalOpen = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setGoalExpanded(true);
    goalExpand.value = withTiming(1, { duration: 400 });
  }, []);

  const handleGoalClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    goalExpand.value = withTiming(0, { duration: 350 });
    setTimeout(() => setGoalExpanded(false), 350);
  }, []);

  const handleGoalSet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGoalSeconds(pickerMinutes * 60);
    goalExpand.value = withTiming(0, { duration: 350 });
    setTimeout(() => setGoalExpanded(false), 350);
  }, [pickerMinutes]);

  // --- Message fade ---
  const messageOpacity = useSharedValue(0);
  const prevMessageRef = useRef('');

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

  // --- Timer ---
  const startTimer = useCallback(() => {
    sessionStartRef.current = Date.now();
    setElapsed(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // --- Init ---
  useEffect(() => {
    (async () => {
      const [loadedSessions, loadedTheme] = await Promise.all([
        loadSessions(),
        loadTheme(),
      ]);
      setSessions(loadedSessions);
      setWeekStats(getWeekStats(loadedSessions));
      setThemeMode(loadedTheme);
      setReady(true);
    })();
    return () => stopTimer();
  }, []);

  // --- AppState ---
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (
        (nextState === 'background' || nextState === 'inactive') &&
        isActiveRef.current
      ) {
        isActiveRef.current = false;
        if (startedRef.current) {
          const duration = Math.floor(
            (Date.now() - sessionStartRef.current) / 1000,
          );
          stopTimer();
          setStarted(false);
          startedRef.current = false;
          const updated = await addSession(duration);
          setSessions(updated);
        }
      } else if (nextState === 'active' && !isActiveRef.current) {
        isActiveRef.current = true;
        const loaded = await loadSessions();
        setSessions(loaded);
        setWeekStats(getWeekStats(loaded));
      }
    });
    return () => sub.remove();
  }, [startTimer, stopTimer]);

  // --- Theme toggle ---
  const toggleTheme = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setThemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      return next;
    });
  }, []);

  // --- Focus lock ---
  const handleLockPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFocusStep('pickTime');
  }, []);

  const startFocus = useCallback((seconds: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFocusTotal(seconds);
    setFocusRemaining(seconds);
    setFocusStep('active');
    focusEndRef.current = Date.now() + seconds * 1000;

    if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
    focusIntervalRef.current = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((focusEndRef.current - Date.now()) / 1000),
      );
      setFocusRemaining(left);
      if (left <= 0) {
        if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
        focusIntervalRef.current = null;
        setFocusStep('hidden');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 1000);
  }, []);

  const cancelFocus = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
    focusIntervalRef.current = null;
    setFocusStep('hidden');
    setFocusRemaining(0);
  }, []);

  useEffect(() => {
    return () => {
      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
    };
  }, []);

  const handleStart = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStarted(true);
    startedRef.current = true;
    startTimer();
  }, [startTimer]);

  const handleStop = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const duration = Math.floor((Date.now() - sessionStartRef.current) / 1000);
    stopTimer();
    setStarted(false);
    startedRef.current = false;
    // Don't reset elapsed yet — dot needs current position for animation
    // Dot grows back to button
    orbitAmount.value = withTiming(0, { duration: 600 });
    buttonSize.value = withTiming(88, { duration: 600 });
    playIconOpacity.value = withTiming(1, { duration: 900 });
    timerOpacity.value = withTiming(0.15, { duration: 700 });
    // "ing" disappears
    showOpacity.value = withTiming(0, { duration: 400 });
    showWidth.value = withTiming(0, { duration: 860 });
    // "Ready to " and "?" reappear
    hideWidth.value = withTiming(1, { duration: 690 });
    hideOpacity.value = withTiming(1, { duration: 1125 });
    // Reset elapsed after animations finish
    setTimeout(() => setElapsed(0), 700);
    const updated = await addSession(duration);
    setSessions(updated);
    setWeekStats(getWeekStats(updated));
  }, [stopTimer]);

  const handleHistory = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/history');
  }, []);

  if (!ready) {
    return (
      <View style={[styles.container, { backgroundColor: themes.dark.bg }]} />
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
              onPress={() => startFocus(opt.seconds)}
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
            setFocusStep('hidden');
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
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

      {/* Lock button — top left */}
      <Pressable
        onPress={handleLockPress}
        style={[styles.lockButton, { top: insets.top + 12 }]}
        hitSlop={16}
      >
        <Feather name="lock" size={24} color={theme.text} style={{ opacity: 0.9 }} />
      </Pressable>

      {/* Header — morphs "Ready to Do·ing nothing?" → "Doing nothing" */}
      <View style={styles.headerRow}>
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
        style={[styles.themeToggle, { top: insets.top + 12 }]}
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
      <Animated.View style={[timerEntryStyle, styles.centerContent]}>
        <Animated.Text
          style={[
            styles.timer,
            { color: theme.text, fontFamily: Fonts!.mono, textAlign: 'center' },
          ]}
        >
          {timerDisplay(elapsed)}
        </Animated.Text>
      </Animated.View>

      {/* Orbit ring + unified button/dot + goal button */}
      <View style={styles.orbitRow}>
        <View style={styles.orbitSide} />
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
                { backgroundColor: theme.accent, justifyContent: 'center', alignItems: 'center' },
                unifiedDotStyle,
              ]}
            >
              <Animated.View style={{ opacity: playIconOpacity }}>
                <Feather name="play" size={36} color={theme.accentText} style={{ marginLeft: 4 }} />
              </Animated.View>
            </Animated.View>
          </Pressable>
        </View>
        <View style={styles.orbitSide} />

        {/* Goal button — lives inside orbitArea, absolute, expands to card */}
        {!started && (
          <View style={styles.goalWrapper} pointerEvents="box-none">
            {goalExpanded && (
              <Pressable style={styles.goalBackdrop} onPress={handleGoalClose} />
            )}
            <Pressable
              onPress={goalExpanded ? undefined : handleGoalOpen}
              activeOpacity={1}
            >
              <Animated.View
                style={[
                  styles.goalElement,
                  {
                    borderColor: themeMode === 'dark' ? palette.cream : palette.ink,
                    backgroundColor: theme.bg,
                  },
                  goalAnimStyle,
                ]}
              >
                {/* Collapsed: icon */}
                <Animated.View style={[styles.goalIconWrap, goalIconOpacityStyle]}>
                  {goalSeconds > 0 ? (
                    <Text style={[{ fontSize: 13, color: theme.text, fontFamily: Fonts!.serif }]}>
                      {Math.floor(goalSeconds / 60)}m
                    </Text>
                  ) : (
                    <Feather name="clock" size={14} color={themeMode === 'dark' ? palette.cream : palette.ink} />
                  )}
                </Animated.View>

                {/* Expanded: content */}
                {goalExpanded && (
                  <Animated.View style={[styles.goalContent, goalContentOpacityStyle]}>
                    <Text style={[styles.goalTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
                      Set timer
                    </Text>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPickerMinutes((m) => m < 60 ? m + 1 : m);
                      }}
                      onLongPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setPickerMinutes((m) => Math.max(1, m - 1));
                      }}
                    >
                      <Text style={[styles.goalBigNumber, { color: theme.text, fontFamily: Fonts!.mono }]}>
                        {pickerMinutes}
                      </Text>
                    </Pressable>
                    <Text style={[{ fontSize: 13, color: theme.textTertiary }]}>min</Text>
                    <View style={styles.goalButtons}>
                      <Pressable
                        onPress={handleGoalSet}
                        style={[styles.goalConfirm, { backgroundColor: theme.accent }]}
                      >
                        <Text style={[styles.goalConfirmText, { color: theme.accentText }]}>Set</Text>
                      </Pressable>
                      <Pressable onPress={handleGoalClose}>
                        <Text style={[{ fontSize: 14, color: theme.textSecondary }]}>Cancel</Text>
                      </Pressable>
                    </View>
                  </Animated.View>
                )}
              </Animated.View>
            </Pressable>
          </View>
        )}
      </View>

      {/* Message */}
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

      {/* Stats */}
      <Pressable onPress={handleHistory}>
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
        <View style={styles.weekSection}>
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
          { bottom: insets.bottom + 16 },
        ]}
      >
        <Pressable
          onPress={handleHistory}
          style={[
            styles.pillButton,
            { borderColor: themeMode === 'dark' ? palette.cream : palette.ink },
          ]}
        >
          <Text
            style={[
              styles.pillText,
              { color: themeMode === 'dark' ? palette.cream : palette.ink },
            ]}
          >
            History
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 24,
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
    marginTop: 12,
  },
  message: {
    fontSize: 17,
    fontWeight: '400',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  orbitContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orbitCenter: {
    position: 'absolute',
  },
  orbitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  orbitSide: {
    width: 48,
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
  pillButton: {
    borderWidth: 1.5,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  pillButtonFilled: {
    borderWidth: 0,
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
  goalWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  goalBackdrop: {
    position: 'absolute',
    width: 1000,
    height: 1000,
    left: -500,
    top: -500,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  goalElement: {
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '400',
  },
  goalBigNumber: {
    fontSize: 56,
    fontWeight: '200',
  },
  goalButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 8,
  },
  goalConfirm: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  goalConfirmText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  Share,
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
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { Fonts } from '@/constants/theme';
import { themes, palette, ThemeMode } from '@/lib/theme';
import { timerDisplay, formatTimeShort, formatTimeStat } from '@/lib/format';
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
const RING_MS = 10000;

function OrbitRing({ color, faintColor }: { color: string; faintColor: string }) {
  const [state, setState] = useState({ progress: 0, lap: 0 });
  const startRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const total = Date.now() - startRef.current;
      setState({
        progress: (total % RING_MS) / RING_MS,
        lap: Math.floor(total / RING_MS),
      });
    }, 40);
    return () => clearInterval(id);
  }, []);

  const { progress, lap } = state;
  const isEven = lap % 2 === 0;
  const trailingStroke = isEven ? faintColor : color;
  const leadingStroke = isEven ? color : faintColor;

  const dotAngle = progress * 360 - 90;
  const dotRad = (dotAngle + 90) * (Math.PI / 180);
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const dotX = cx + Math.cos(dotRad - Math.PI / 2) * RING_R - 6;
  const dotY = cy + Math.sin(dotRad - Math.PI / 2) * RING_R - 6;

  return (
    <View style={styles.orbitContainer}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        {/* Full ring — color from previous lap */}
        <SvgCircle
          cx={cx}
          cy={cy}
          r={RING_R}
          stroke={trailingStroke}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        {/* Progress ring — current lap fills over */}
        <SvgCircle
          cx={cx}
          cy={cy}
          r={RING_R}
          stroke={leadingStroke}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={`${RING_CIRC}`}
          strokeDashoffset={RING_CIRC * (1 - progress)}
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx}, ${cy}`}
        />
      </Svg>
      {/* Dot */}
      <View
        style={{
          position: 'absolute',
          left: dotX,
          top: dotY,
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: color,
        }}
      />
    </View>
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
  const timerOpacity = useSharedValue(0);
  const timerTranslateY = useSharedValue(8);
  const statsOpacity = useSharedValue(0);
  const statsTranslateY = useSharedValue(16);
  const shareOpacity = useSharedValue(0);
  const shareTranslateY = useSharedValue(16);

  useEffect(() => {
    if (!ready) return;
    timerOpacity.value = withTiming(1, { duration: 800 });
    timerTranslateY.value = withTiming(0, { duration: 800 });
    statsOpacity.value = withDelay(200, withTiming(1, { duration: 800 }));
    statsTranslateY.value = withDelay(200, withTiming(0, { duration: 800 }));
    shareOpacity.value = withDelay(400, withTiming(1, { duration: 800 }));
    shareTranslateY.value = withDelay(400, withTiming(0, { duration: 800 }));
  }, [ready]);

  const timerEntryStyle = useAnimatedStyle(() => ({
    opacity: timerOpacity.value,
    transform: [{ translateY: timerTranslateY.value }],
  }));

  const statsEntryStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
    transform: [{ translateY: statsTranslateY.value }],
  }));

  const shareEntryStyle = useAnimatedStyle(() => ({
    opacity: shareOpacity.value,
    transform: [{ translateY: shareTranslateY.value }],
  }));

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
      startTimer();
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
        const duration = Math.floor(
          (Date.now() - sessionStartRef.current) / 1000,
        );
        stopTimer();
        const updated = await addSession(duration);
        setSessions(updated);
      } else if (nextState === 'active' && !isActiveRef.current) {
        isActiveRef.current = true;
        const loaded = await loadSessions();
        setSessions(loaded);
        setWeekStats(getWeekStats(loaded));
        startTimer();
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

  // --- Share ---
  const handleShare = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentStats = getStats(sessions);
    const text = [
      `I did nothing for ${formatTimeShort(elapsed)}.`,
      '',
      `Today: ${formatTimeShort(currentStats.today + elapsed)}`,
      `This week: ${formatTimeShort(currentStats.week + elapsed)}`,
      '',
      '\u2601\ufe0f Do Nothing',
    ].join('\n');

    try {
      await Share.share({ message: text });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }, [elapsed, sessions]);

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

      {/* Header */}
      <Text
        style={[
          styles.header,
          { color: theme.text, fontFamily: Fonts!.serif },
        ]}
      >
        Doing nothing
      </Text>

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
      <Animated.Text
        style={[
          styles.timer,
          timerEntryStyle,
          { color: theme.text, fontFamily: Fonts!.mono },
        ]}
      >
        {timerDisplay(elapsed)}
      </Animated.Text>

      {/* Message */}
      <Animated.View style={[styles.messageContainer, messageFadeStyle]}>
        <Text
          style={[
            styles.message,
            { color: theme.textSecondary, fontFamily: Fonts!.serif },
          ]}
        >
          {message}
        </Text>
      </Animated.View>

      {/* Orbit ring */}
      <OrbitRing
        color={theme.accent}
        faintColor={themeMode === 'dark' ? palette.cream : palette.charcoal}
      />

      {/* Stats */}
      <Pressable onPress={handleHistory}>
        <Animated.View style={[styles.statsColumn, statsEntryStyle]}>
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
        </Animated.View>
      </Pressable>

      {/* Week dots */}
      {weekStats.length > 0 && (
        <Animated.View style={[styles.weekSection, shareEntryStyle]}>
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
        </Animated.View>
      )}

      {/* Bottom buttons */}
      <Animated.View
        style={[
          styles.bottomButtons,
          { bottom: insets.bottom + 16 },
          shareEntryStyle,
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
      </Animated.View>
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
  header: {
    fontSize: 22,
    letterSpacing: 1,
    opacity: 0.85,
    fontWeight: '400',
    marginBottom: 24,
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
    marginTop: 24,
  },
  statsColumn: {
    marginTop: 36,
    flexDirection: 'row',
    gap: 24,
  },
  statDot: {
    fontSize: 18,
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
    fontSize: 24,
    fontWeight: '300',
  },
  statRowUnit: {
    fontSize: 12,
    fontWeight: '300',
    marginLeft: 3,
  },
  weekSection: {
    marginTop: 24,
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
});

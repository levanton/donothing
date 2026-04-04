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

import { Fonts } from '@/constants/theme';
import { themes, ThemeMode } from '@/lib/theme';
import { timerDisplay, formatTimeShort, formatTimeStat } from '@/lib/format';
import {
  Session,
  loadSessions,
  addSession,
  loadTheme,
  saveTheme,
} from '@/lib/storage';
import { getStats } from '@/lib/stats';

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
  if (seconds < 180) return "you're doing great.";
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
// Expanding ring component
// ---------------------------------------------------------------------------
function ExpandingRing({ color, delay }: { color: string; delay: number }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: 0 }),
          withTiming(2.5, {
            duration: 3000,
            easing: Easing.out(Easing.quad),
          }),
        ),
        -1,
        false,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.35, { duration: 0 }),
          withTiming(0, { duration: 3000, easing: Easing.out(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width: 60,
          height: 60,
          borderRadius: 30,
          borderWidth: 1.5,
          borderColor: color,
          position: 'absolute',
        },
        animStyle,
      ]}
    />
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
        <Text style={[styles.lockIcon, { color: theme.text }]}>
          {'\uD83D\uDD12'}
        </Text>
      </Pressable>

      {/* Header */}
      <Text
        style={[
          styles.header,
          { color: theme.text, fontFamily: Fonts!.serif },
        ]}
      >
        Do Nothing
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
            { backgroundColor: theme.accent, opacity: 0.25 },
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

      {/* Expanding rings */}
      <View style={styles.ringsContainer}>
        <ExpandingRing color={theme.accent} delay={0} />
        <ExpandingRing color={theme.accent} delay={1000} />
        <ExpandingRing color={theme.accent} delay={2000} />
        <View style={[styles.ringCenter, { backgroundColor: theme.accent }]} />
      </View>

      {/* Stats */}
      <Pressable onPress={handleHistory}>
        <Animated.View style={[styles.statsRow, statsEntryStyle]}>
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statValue,
                { color: theme.text, fontFamily: Fonts!.serif },
              ]}
            >
              {formatTimeStat(stats.today + elapsed)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Today
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statValue,
                { color: theme.text, fontFamily: Fonts!.serif },
              ]}
            >
              {formatTimeStat(stats.week + elapsed)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              This Week
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text
              style={[
                styles.statValue,
                { color: theme.text, fontFamily: Fonts!.serif },
              ]}
            >
              {formatTimeStat(stats.year + elapsed)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              This Year
            </Text>
          </View>
        </Animated.View>
      </Pressable>

      {/* Bottom buttons */}
      <Animated.View style={[styles.bottomButtons, shareEntryStyle]}>
        <Pressable
          onPress={handleHistory}
          style={[styles.pillButton, { borderColor: theme.border }]}
        >
          <Text style={[styles.pillText, { color: theme.text }]}>HISTORY</Text>
        </Pressable>
        <Pressable
          onPress={handleShare}
          style={[
            styles.pillButton,
            styles.pillButtonFilled,
            { backgroundColor: theme.accent, borderColor: theme.accent },
          ]}
        >
          <Text style={[styles.pillText, { color: theme.accentText }]}>
            SHARE
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
  },
  header: {
    fontSize: 28,
    letterSpacing: 1,
    opacity: 0.85,
    fontWeight: '400',
    marginBottom: 32,
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
    marginTop: 16,
  },
  message: {
    fontSize: 17,
    fontWeight: '400',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  ringsContainer: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  ringCenter: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 48,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '400',
  },
  statLabel: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 48,
  },
  pillButton: {
    borderWidth: 1.2,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  pillButtonFilled: {
    borderWidth: 0,
  },
  pillText: {
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '400',
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Share, StyleSheet, Text, View } from 'react-native';
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
import { timerDisplay, formatTimeShort } from '@/lib/format';
import { Session, loadSessions, addSession, loadTheme, saveTheme } from '@/lib/storage';
import { getStats } from '@/lib/stats';

function getMessage(seconds: number): string {
  if (seconds < 10) return '';
  if (seconds < 30) return 'breathe.';
  if (seconds < 60) return 'good. keep going.';
  if (seconds < 180) return "you're doing great.";
  if (seconds < 300) return 'the world can wait.';
  return 'just be.';
}

export default function DoNothingScreen() {
  const insets = useSafeAreaInsets();

  const [elapsed, setElapsed] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);

  const sessionStartRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(true);

  const theme = themes[themeMode];
  const stats = getStats(sessions);
  const message = getMessage(elapsed);

  // --- Theme animation ---
  const themeProgress = useSharedValue(0);

  useEffect(() => {
    themeProgress.value = withTiming(themeMode === 'dark' ? 0 : 1, { duration: 600 });
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

  // --- Breathing dot ---
  const breathScale = useSharedValue(1);
  const breathOpacity = useSharedValue(0.15);

  useEffect(() => {
    breathScale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    breathOpacity.value = withRepeat(
      withSequence(
        withTiming(0.45, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const breathingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathScale.value }],
    opacity: breathOpacity.value,
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
    setThemeMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      saveTheme(next);
      return next;
    });
  }, []);

  // --- Share ---
  const handleShare = useCallback(async () => {
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

  if (!ready) {
    return <View style={[styles.container, { backgroundColor: themes.dark.bg }]} />;
  }

  return (
    <Animated.View style={[styles.container, animatedContainerStyle]}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

      {/* Header */}
      <Text style={[styles.header, { color: theme.text }]}>DO NOTHING</Text>

      {/* Theme toggle */}
      <Pressable
        onPress={toggleTheme}
        style={[styles.themeToggle, { top: insets.top + 12 }]}
        hitSlop={16}
      >
        <View
          style={[
            styles.themeCircle,
            {
              backgroundColor: theme.text,
              opacity: 0.2,
            },
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
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          {message}
        </Text>
      </Animated.View>

      {/* Breathing dot */}
      <Animated.View
        style={[styles.dot, breathingStyle, { backgroundColor: theme.text }]}
      />

      {/* Stats */}
      <Pressable onPress={() => router.push('/history')}>
        <Animated.View style={[styles.statsRow, statsEntryStyle]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatTimeShort(stats.today + elapsed)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Today
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatTimeShort(stats.week + elapsed)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              This Week
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatTimeShort(stats.year + elapsed)}
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
          onPress={() => router.push('/history')}
          style={[styles.pillButton, { borderColor: theme.border }]}
        >
          <Text style={[styles.pillText, { color: theme.text }]}>HISTORY</Text>
        </Pressable>
        <Pressable
          onPress={handleShare}
          style={[styles.pillButton, { borderColor: theme.border }]}
        >
          <Text style={[styles.pillText, { color: theme.text }]}>SHARE</Text>
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
    fontSize: 10,
    letterSpacing: 6,
    opacity: 0.25,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 32,
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
    fontSize: 72,
    fontWeight: '200',
    letterSpacing: 2,
  },
  messageContainer: {
    height: 24,
    justifyContent: 'center',
    marginTop: 16,
  },
  message: {
    fontSize: 16,
    fontWeight: '300',
    textAlign: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 32,
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
    fontSize: 18,
    fontWeight: '300',
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
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  pillText: {
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '500',
  },
});

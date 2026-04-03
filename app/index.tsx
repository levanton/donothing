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

import {
  DeviceActivitySelectionView,
} from 'react-native-device-activity';
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
import {
  checkAvailable,
  getAuth,
  requestAuth,
  blockApps,
  unblockApps,
} from '@/lib/screen-time';

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
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: 1,
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
  type FocusStep = 'hidden' | 'pickApps' | 'pickTime' | 'active';
  const [focusStep, setFocusStep] = useState<FocusStep>('hidden');
  const [focusRemaining, setFocusRemaining] = useState(0);
  const [focusTotal, setFocusTotal] = useState(0);
  const [screenTimeAvailable, setScreenTimeAvailable] = useState(false);
  const [appSelection, setAppSelection] = useState<string | null>(null);
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

  // --- Screen Time availability check ---
  useEffect(() => {
    checkAvailable().then(setScreenTimeAvailable);
  }, []);

  // --- Focus lock ---
  const handleLockPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (!screenTimeAvailable) {
      // Fallback: skip app picker, go straight to time picker
      setFocusStep('pickTime');
      return;
    }

    const auth = await getAuth();
    if (auth === 'approved') {
      setFocusStep('pickApps');
    } else {
      const result = await requestAuth();
      if (result === 'approved') {
        setFocusStep('pickApps');
      } else {
        // Denied — fallback to time-only focus
        setFocusStep('pickTime');
      }
    }
  }, [screenTimeAvailable]);

  const handleAppsPicked = useCallback((selection: string) => {
    setAppSelection(selection);
    setFocusStep('pickTime');
  }, []);

  const startFocus = useCallback(
    async (seconds: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setFocusTotal(seconds);
      setFocusRemaining(seconds);
      setFocusStep('active');
      focusEndRef.current = Date.now() + seconds * 1000;

      // Block apps if selection exists
      if (appSelection && screenTimeAvailable) {
        try {
          await blockApps(appSelection);
        } catch {}
      }

      if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
      focusIntervalRef.current = setInterval(() => {
        const left = Math.max(
          0,
          Math.ceil((focusEndRef.current - Date.now()) / 1000),
        );
        setFocusRemaining(left);
        if (left <= 0) {
          if (focusIntervalRef.current)
            clearInterval(focusIntervalRef.current);
          focusIntervalRef.current = null;
          // Unblock apps
          if (appSelection && screenTimeAvailable) {
            unblockApps(appSelection).catch(() => {});
          }
          setFocusStep('hidden');
          setAppSelection(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }, 1000);
    },
    [appSelection, screenTimeAvailable],
  );

  const cancelFocus = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (focusIntervalRef.current) clearInterval(focusIntervalRef.current);
    focusIntervalRef.current = null;

    // Unblock apps
    if (appSelection && screenTimeAvailable) {
      try {
        await unblockApps(appSelection);
      } catch {}
    }

    setFocusStep('hidden');
    setFocusRemaining(0);
    setAppSelection(null);
  }, [appSelection, screenTimeAvailable]);

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

        <Text style={[styles.focusLabel, { color: theme.textTertiary }]}>
          FOCUS MODE
        </Text>

        {appSelection && (
          <Text style={[styles.focusAppsNote, { color: theme.textTertiary }]}>
            apps blocked
          </Text>
        )}

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
                borderColor: theme.border,
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
        <Text style={[styles.focusMessage, { color: theme.textSecondary }]}>
          {focusMsg}
        </Text>

        {/* Progress bar */}
        <View
          style={[styles.progressTrack, { backgroundColor: theme.border }]}
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
          style={[styles.quitButton, { borderColor: theme.border }]}
        >
          <Text style={[styles.quitText, { color: theme.textSecondary }]}>
            give up
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  // =========================================================================
  // Focus — pick apps to block (Screen Time)
  // =========================================================================
  if (focusStep === 'pickApps') {
    return (
      <Animated.View style={[styles.container, animatedContainerStyle]}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

        <Text style={[styles.pickerTitle, { color: theme.text }]}>
          Block apps
        </Text>
        <Text style={[styles.pickerSubtitle, { color: theme.textSecondary }]}>
          Select apps to block during focus
        </Text>

        <View style={styles.appPickerContainer}>
          <DeviceActivitySelectionView
            style={styles.appPicker}
            onSelectionChange={(event) => {
              const token = event.nativeEvent.familyActivitySelection;
              if (token) handleAppsPicked(token);
            }}
          />
        </View>

        <View style={styles.appPickerButtons}>
          <Pressable
            onPress={() => {
              // Skip app blocking, go to time picker
              setAppSelection(null);
              setFocusStep('pickTime');
            }}
            style={styles.pickerCancel}
          >
            <Text
              style={[styles.pickerCancelText, { color: theme.textSecondary }]}
            >
              skip
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setFocusStep('hidden');
            setAppSelection(null);
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
  // Focus — pick duration
  // =========================================================================
  if (focusStep === 'pickTime') {
    return (
      <Animated.View style={[styles.container, animatedContainerStyle]}>
        <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

        <Text style={[styles.pickerTitle, { color: theme.text }]}>
          Lock yourself in
        </Text>
        <Text style={[styles.pickerSubtitle, { color: theme.textSecondary }]}>
          {appSelection
            ? 'Apps will be blocked. Choose duration.'
            : 'Choose how long to do nothing'}
        </Text>

        <View style={styles.pickerOptions}>
          {FOCUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.seconds}
              onPress={() => startFocus(opt.seconds)}
              style={[styles.pickerOption, { borderColor: theme.border }]}
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
            setAppSelection(null);
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
      <Text style={[styles.header, { color: theme.text }]}>DO NOTHING</Text>

      {/* Theme toggle — top right */}
      <Pressable
        onPress={toggleTheme}
        style={[styles.themeToggle, { top: insets.top + 12 }]}
        hitSlop={16}
      >
        <View
          style={[
            styles.themeCircle,
            { backgroundColor: theme.text, opacity: 0.2 },
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

      {/* Expanding rings */}
      <View style={styles.ringsContainer}>
        <ExpandingRing color={theme.dot} delay={0} />
        <ExpandingRing color={theme.dot} delay={1000} />
        <ExpandingRing color={theme.dot} delay={2000} />
        <View style={[styles.ringCenter, { backgroundColor: theme.dot }]} />
      </View>

      {/* Stats */}
      <Pressable onPress={handleHistory}>
        <Animated.View style={[styles.statsRow, statsEntryStyle]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatTimeStat(stats.today + elapsed)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              Today
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
              {formatTimeStat(stats.week + elapsed)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              This Week
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.text }]}>
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
  ringsContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  ringCenter: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
  // --- Focus picker ---
  pickerTitle: {
    fontSize: 24,
    fontWeight: '200',
    letterSpacing: 1,
  },
  pickerSubtitle: {
    fontSize: 14,
    fontWeight: '300',
    marginTop: 8,
    marginBottom: 40,
  },
  pickerOptions: {
    gap: 12,
    width: '100%',
    maxWidth: 260,
  },
  pickerOption: {
    borderWidth: 1,
    borderRadius: 16,
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
  // --- App picker ---
  appPickerContainer: {
    width: '100%',
    maxWidth: 300,
    height: 340,
    marginBottom: 16,
  },
  appPicker: {
    flex: 1,
  },
  appPickerButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  // --- Focus active ---
  focusAppsNote: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '400',
    textTransform: 'uppercase',
    marginTop: 6,
  },
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
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  quitText: {
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
  },
});

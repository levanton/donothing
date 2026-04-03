import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { themes, ThemeMode } from '@/lib/theme';
import { formatTimeShort, formatTimeStat } from '@/lib/format';
import { loadSessions, loadTheme } from '@/lib/storage';
import { getDailyStats, getStats, DayStats } from '@/lib/stats';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [dailyStats, setDailyStats] = useState<DayStats[]>([]);
  const [totalStats, setTotalStats] = useState({ today: 0, week: 0, year: 0 });
  const [ready, setReady] = useState(false);

  const theme = themes[themeMode];

  const themeProgress = useSharedValue(0);

  useEffect(() => {
    themeProgress.value = withTiming(themeMode === 'dark' ? 0 : 1, { duration: 100 });
  }, [themeMode]);

  const animatedBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      themeProgress.value,
      [0, 1],
      [themes.dark.bg, themes.light.bg],
    ),
  }));

  useEffect(() => {
    (async () => {
      const [sessions, savedTheme] = await Promise.all([
        loadSessions(),
        loadTheme(),
      ]);
      setThemeMode(savedTheme);
      setDailyStats(getDailyStats(sessions));
      setTotalStats(getStats(sessions));
      setReady(true);
    })();
  }, []);

  // Find max duration for bar scaling
  const maxDuration = Math.max(...dailyStats.map((d) => d.duration), 1);

  if (!ready) {
    return <View style={[styles.container, { backgroundColor: themes.dark.bg }]} />;
  }

  return (
    <AnimatedScrollView
      style={[styles.container, animatedBgStyle]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
      ]}
    >
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

      {/* Close button */}
      <Pressable
        onPress={() => router.back()}
        style={styles.closeButton}
        hitSlop={16}
      >
        <Text style={[styles.closeText, { color: theme.textSecondary }]}>
          {'\u2715'}
        </Text>
      </Pressable>

      {/* Title */}
      <Text style={[styles.title, { color: theme.text }]}>History</Text>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: theme.border }]}>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatTimeStat(totalStats.today)}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            Today
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.border }]}>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatTimeStat(totalStats.week)}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            This Week
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.border }]}>
          <Text style={[styles.summaryValue, { color: theme.text }]}>
            {formatTimeStat(totalStats.year)}
          </Text>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
            This Year
          </Text>
        </View>
      </View>

      {/* Daily list */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        DAILY
      </Text>

      {dailyStats.map((day) => (
        <View key={day.date} style={styles.dayRow}>
          <View style={styles.dayInfo}>
            <Text style={[styles.dayLabel, { color: theme.text }]}>
              {day.label}
            </Text>
            <Text style={[styles.dayDuration, { color: theme.textSecondary }]}>
              {day.duration > 0 ? formatTimeShort(day.duration) : '\u2014'}
            </Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
            {day.duration > 0 && (
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: theme.dot,
                    width: `${Math.max((day.duration / maxDuration) * 100, 2)}%`,
                  },
                ]}
              />
            )}
          </View>
        </View>
      ))}
    </AnimatedScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  closeText: {
    fontSize: 20,
    fontWeight: '300',
  },
  title: {
    fontSize: 28,
    fontWeight: '200',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 32,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 40,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '300',
  },
  summaryLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '500',
    marginBottom: 20,
  },
  dayRow: {
    marginBottom: 20,
  },
  dayInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '400',
  },
  dayDuration: {
    fontSize: 14,
    fontWeight: '300',
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
});

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

import { Fonts } from '@/constants/theme';
import { themes, ThemeMode } from '@/lib/theme';
import { formatTimeShort, formatTimeStat } from '@/lib/format';
import { loadSessions, loadTheme } from '@/lib/storage';
import { getDailyStats, getStats, getStreak, DayStats } from '@/lib/stats';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const ZEN_QUOTES = [
  'sitting quietly, doing nothing, spring comes, and the grass grows by itself.',
  'the quieter you become, the more you can hear.',
  'in the midst of movement and chaos, keep stillness inside of you.',
  'silence is the sleep that nourishes wisdom.',
  'do nothing, and everything is done.',
];

function getQuote(): string {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  return ZEN_QUOTES[dayOfYear % ZEN_QUOTES.length];
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [dailyStats, setDailyStats] = useState<DayStats[]>([]);
  const [totalStats, setTotalStats] = useState({ today: 0, week: 0, year: 0 });
  const [streak, setStreak] = useState(0);
  const [ready, setReady] = useState(false);

  const theme = themes[themeMode];
  const quote = getQuote();

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
      setStreak(getStreak(sessions));
      setReady(true);
    })();
  }, []);

  const maxDuration = Math.max(...dailyStats.map((d) => d.duration), 1);
  const totalAll = formatTimeStat(totalStats.year);

  if (!ready) {
    return <View style={[styles.container, { backgroundColor: themes.dark.bg }]} />;
  }

  return (
    <AnimatedScrollView
      style={[styles.container, animatedBgStyle]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 40 },
      ]}
    >
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

      {/* Header row */}
      <View style={styles.headerRow}>
        <Text
          style={[styles.title, { color: theme.text, fontFamily: Fonts!.serif }]}
        >
          History
        </Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={16}
          style={styles.closeButton}
        >
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>
            {'\u2715'}
          </Text>
        </Pressable>
      </View>

      {/* Hero — total time */}
      <View style={[styles.heroCard, { borderColor: theme.border }]}>
        <Text style={[styles.heroLabel, { color: theme.textTertiary }]}>
          total stillness
        </Text>
        <View style={styles.heroValueRow}>
          <Text
            style={[
              styles.heroValue,
              { color: theme.text, fontFamily: Fonts!.serif },
            ]}
          >
            {totalAll.value}
          </Text>
          <Text style={[styles.heroUnit, { color: theme.textTertiary }]}>
            {totalAll.unit}
          </Text>
        </View>
      </View>

      {/* Streak + stats row */}
      <View style={styles.miniStatsRow}>
        <View style={[styles.miniStatCard, { borderColor: theme.border }]}>
          <Text
            style={[
              styles.miniStatValue,
              { color: theme.accent, fontFamily: Fonts!.serif },
            ]}
          >
            {streak}
          </Text>
          <Text style={[styles.miniStatLabel, { color: theme.textSecondary }]}>
            day streak
          </Text>
        </View>
        <View style={[styles.miniStatCard, { borderColor: theme.border }]}>
          {(() => {
            const t = formatTimeStat(totalStats.today);
            return (
              <View style={styles.miniValueRow}>
                <Text
                  style={[
                    styles.miniStatValue,
                    { color: theme.text, fontFamily: Fonts!.serif },
                  ]}
                >
                  {t.value}
                </Text>
                <Text style={[styles.miniStatUnit, { color: theme.textTertiary }]}>
                  {t.unit}
                </Text>
              </View>
            );
          })()}
          <Text style={[styles.miniStatLabel, { color: theme.textSecondary }]}>
            today
          </Text>
        </View>
        <View style={[styles.miniStatCard, { borderColor: theme.border }]}>
          {(() => {
            const w = formatTimeStat(totalStats.week);
            return (
              <View style={styles.miniValueRow}>
                <Text
                  style={[
                    styles.miniStatValue,
                    { color: theme.text, fontFamily: Fonts!.serif },
                  ]}
                >
                  {w.value}
                </Text>
                <Text style={[styles.miniStatUnit, { color: theme.textTertiary }]}>
                  {w.unit}
                </Text>
              </View>
            );
          })()}
          <Text style={[styles.miniStatLabel, { color: theme.textSecondary }]}>
            this week
          </Text>
        </View>
      </View>

      {/* Week dots */}
      <View style={styles.weekSection}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          LAST 7 DAYS
        </Text>
        <View style={styles.weekGrid}>
          {dailyStats.slice(0, 7).map((day) => {
            const size = day.duration > 0
              ? 16 + (day.duration / maxDuration) * 28
              : 6;
            return (
              <View key={day.date} style={styles.weekDayCol}>
                <View
                  style={[
                    styles.weekDot,
                    {
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      backgroundColor: day.duration > 0
                        ? theme.accent
                        : theme.border,
                    },
                  ]}
                />
                <Text
                  style={[styles.weekDayLabel, { color: theme.textTertiary }]}
                >
                  {day.label.slice(0, 3)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Daily list */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
        ALL SESSIONS
      </Text>

      {dailyStats.map((day) => (
        <View
          key={day.date}
          style={[styles.dayRow, { borderBottomColor: theme.border }]}
        >
          <Text
            style={[
              styles.dayLabel,
              { color: theme.text, fontFamily: Fonts!.serif },
            ]}
          >
            {day.label}
          </Text>
          <Text
            style={[
              styles.dayDuration,
              {
                color: day.duration > 0 ? theme.text : theme.textTertiary,
                fontFamily: Fonts!.serif,
              },
            ]}
          >
            {day.duration > 0 ? formatTimeShort(day.duration) : '\u2014'}
          </Text>
        </View>
      ))}

      {/* Zen quote */}
      <View style={styles.quoteContainer}>
        <Text
          style={[
            styles.quoteText,
            { color: theme.textTertiary, fontFamily: Fonts!.serif },
          ]}
        >
          {quote}
        </Text>
      </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 20,
    fontWeight: '300',
  },
  // --- Hero ---
  heroCard: {
    borderWidth: 1.2,
    borderRadius: 20,
    paddingVertical: 28,
    alignItems: 'center',
    marginBottom: 16,
  },
  heroLabel: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '300',
    marginBottom: 8,
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroValue: {
    fontSize: 56,
    fontWeight: '300',
  },
  heroUnit: {
    fontSize: 18,
    fontWeight: '300',
    marginLeft: 4,
  },
  // --- Mini stats ---
  miniStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  miniStatCard: {
    flex: 1,
    borderWidth: 1.2,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  miniValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  miniStatValue: {
    fontSize: 22,
    fontWeight: '400',
  },
  miniStatUnit: {
    fontSize: 11,
    fontWeight: '300',
    marginLeft: 2,
  },
  miniStatLabel: {
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: '300',
    marginTop: 4,
  },
  // --- Week dots ---
  weekSection: {
    marginBottom: 28,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 60,
    paddingHorizontal: 8,
  },
  weekDayCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 8,
  },
  weekDot: {
    // sized dynamically
  },
  weekDayLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  // --- Section ---
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '500',
    marginBottom: 16,
  },
  // --- Day rows ---
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '400',
  },
  dayDuration: {
    fontSize: 16,
    fontWeight: '300',
  },
  // --- Quote ---
  quoteContainer: {
    marginTop: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  quoteText: {
    fontSize: 14,
    fontWeight: '300',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
  },
});

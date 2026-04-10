import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';

import { Fonts } from '@/constants/theme';
import { themes, palette } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import { formatTimeStat } from '@/lib/format';
import { getStats, getStreak } from '@/lib/stats';
import { getDurationSince, getSessionCount, getLongestSessionDuration, getActiveDaysCount, getWeekDurations } from '@/lib/db/sessions';
import ActivityCalendar from './ActivityCalendar';
import MilestonesList from './MilestonesList';
import { useAppStore } from '@/lib/store';

// ── Zen quotes ────────────────────────────────────────────────────────
const ZEN_QUOTES = [
  'sitting quietly, doing nothing, spring comes, and the grass grows by itself.',
  'the quieter you become, the more you can hear.',
  'in the midst of movement and chaos, keep stillness inside of you.',
  'silence is the sleep that nourishes wisdom.',
  'do nothing, and everything is done.',
];

// ── Main component ────────────────────────────────────────────────────
interface HistoryContentProps {
  onClose: () => void;
  insets: { top: number; bottom: number };
  onScroll?: any;
  nativeScrollGesture?: GestureType;
}

export default function HistoryContent({ onClose, insets, onScroll, nativeScrollGesture }: HistoryContentProps) {
  useAppStore((s) => s.weekStats);
  const themeMode = useAppStore((s) => s.themeMode);
  const achievedMilestones = useAppStore((s) => s.achievedMilestones);
  const theme = themes[themeMode];

  const totalStats = getStats();
  const streak = getStreak();
  const totalSessions = getSessionCount();
  const avgSession = totalSessions > 0
    ? formatTimeStat(Math.round(totalStats.year / totalSessions))
    : { value: '0', unit: 'min' };
  const longestSession = formatTimeStat(getLongestSessionDuration());
  const daysActive = getActiveDaysCount();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = getDurationSince(startOfMonth);
  const thisMonthStat = formatTimeStat(thisMonth);

  // Weekly insight
  const weekInsight = useMemo(() => {
    const thisWeekTotal = totalStats.week;
    const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - dayOfWeek * 86400000;
    const lastWeekStart = thisWeekStart - 7 * 86400000;
    const lastWeekDurations = getWeekDurations(lastWeekStart, thisWeekStart);
    let lastWeekTotal = 0;
    lastWeekDurations.forEach((v) => { lastWeekTotal += v; });
    if (thisWeekTotal === 0 && lastWeekTotal === 0) return null;
    if (lastWeekTotal === 0 && thisWeekTotal > 0) return 'a fresh start this week.';
    if (thisWeekTotal === 0) return 'no stillness yet this week.';
    const pct = Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100);
    if (pct > 10) return `${pct}% more stillness than last week.`;
    if (pct < -10) return `${Math.abs(pct)}% less than last week. that's okay.`;
    return 'about the same as last week. steady.';
  }, [totalStats.week]);

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const quote = ZEN_QUOTES[dayOfYear % ZEN_QUOTES.length];

  const content = (
    <Animated.ScrollView
      style={{ flex: 1 }}
      bounces={false}
      overScrollMode="never"
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 40,
      }}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.serif }]}>Journey</Text>
        <Pressable onPress={onClose} hitSlop={16} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>{'\u2715'}</Text>
        </Pressable>
      </View>

      {/* Stats — clean layout */}
      <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.statsBlock}>
        {/* Top row: two big numbers */}
        <View style={styles.statsBigRow}>
          <View style={styles.statsBigCell}>
            <Text style={[styles.statsBigValue, { color: theme.accent, fontFamily: Fonts.serif }]}>
              {streak}
            </Text>
            <Text style={[styles.statsBigLabel, { color: theme.text, fontFamily: Fonts.serif }]}>
              day streak
            </Text>
          </View>
          <View style={[styles.statsDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statsBigCell}>
            <Text style={[styles.statsBigValue, { color: theme.text, fontFamily: Fonts.serif }]}>
              {thisMonthStat.value}
              <Text style={styles.statsBigUnit}> {thisMonthStat.unit}</Text>
            </Text>
            <Text style={[styles.statsBigLabel, { color: theme.text, fontFamily: Fonts.serif }]}>
              this month
            </Text>
          </View>
        </View>

        {/* Insight */}
        {weekInsight && (
          <Text style={[styles.insightText, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>
            {weekInsight}
          </Text>
        )}

        {/* Bottom row: four small stats */}
        <View style={styles.statsSmallRow}>
          <View style={styles.statsSmallCell}>
            <Text style={[styles.statsSmallValue, { color: theme.text, fontFamily: Fonts.serif }]}>
              {avgSession.value}<Text style={styles.statsSmallUnit}> {avgSession.unit}</Text>
            </Text>
            <Text style={[styles.statsSmallLabel, { color: theme.textSecondary }]}>avg session</Text>
          </View>
          <View style={styles.statsSmallCell}>
            <Text style={[styles.statsSmallValue, { color: theme.text, fontFamily: Fonts.serif }]}>
              {longestSession.value}<Text style={styles.statsSmallUnit}> {longestSession.unit}</Text>
            </Text>
            <Text style={[styles.statsSmallLabel, { color: theme.textSecondary }]}>longest</Text>
          </View>
          <View style={styles.statsSmallCell}>
            <Text style={[styles.statsSmallValue, { color: theme.text, fontFamily: Fonts.serif }]}>{totalSessions}</Text>
            <Text style={[styles.statsSmallLabel, { color: theme.textSecondary }]}>sessions</Text>
          </View>
          <View style={styles.statsSmallCell}>
            <Text style={[styles.statsSmallValue, { color: theme.text, fontFamily: Fonts.serif }]}>{daysActive}</Text>
            <Text style={[styles.statsSmallLabel, { color: theme.textSecondary }]}>days active</Text>
          </View>
        </View>
      </Animated.View>

      {/* Calendar */}
      <ActivityCalendar theme={theme} />

      {/* Divider */}
      <View style={styles.dividerOuter}>
        <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
      </View>

      {/* Milestones */}
      <Text style={[styles.sectionLabel, { color: theme.text }]}>MILESTONES</Text>
      <MilestonesList theme={theme} achievedMilestones={achievedMilestones} />

      {/* Footer */}
      <View style={styles.quoteContainer}>
        <Text style={[styles.quoteText, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>{quote}</Text>
      </View>
    </Animated.ScrollView>
  );

  if (nativeScrollGesture) {
    return <GestureDetector gesture={nativeScrollGesture}>{content}</GestureDetector>;
  }
  return content;
}

const styles = StyleSheet.create({
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
  title: { fontSize: 32, fontWeight: '400', letterSpacing: 0.5 },
  closeButton: { padding: 4 },
  closeText: { fontSize: 20, fontWeight: '300' },

  // Stats block
  statsBlock: { marginBottom: 32 },

  // Big stats row
  statsBigRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statsBigCell: { flex: 1, alignItems: 'center' },
  statsBigValue: { fontSize: 48, fontWeight: '200' },
  statsBigUnit: { fontSize: 16, fontWeight: '300' },
  statsBigLabel: { fontSize: 14, fontWeight: '400', marginTop: 2 },
  statsDivider: { width: 1, height: 48, },

  // Insight
  insightText: { fontSize: 15, fontWeight: '400', textAlign: 'center', lineHeight: 22, marginBottom: 20 },

  // Small stats row
  statsSmallRow: { flexDirection: 'row' },
  statsSmallCell: { flex: 1, alignItems: 'center' },
  statsSmallValue: { fontSize: 18, fontWeight: '300' },
  statsSmallUnit: { fontSize: 13, fontWeight: '300' },
  statsSmallLabel: { fontSize: 11, fontWeight: '400', marginTop: 2 },

  // Divider
  dividerOuter: { alignItems: 'center', marginVertical: 28 },
  dividerLine: { width: 40, height: 1 },

  // Section labels
  sectionLabel: { fontSize: 11, letterSpacing: 3, fontWeight: '500', marginBottom: 16 },

  // Footer
  quoteContainer: { marginTop: 40, paddingHorizontal: 16, alignItems: 'center', marginBottom: 20 },
  quoteText: { fontSize: 14, fontWeight: '300', fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
});

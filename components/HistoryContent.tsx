import { Fragment, memo, useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

const SCREEN_W = Dimensions.get('window').width;

import { Fonts } from '@/constants/theme';
import { themes, palette } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import { formatTimeStat } from '@/lib/format';
import { getStats, getStreak, getWeekStats, type WeekDay } from '@/lib/stats';
import { getDurationSince, getSessionCount, getLongestSessionDuration, getWeekDurations } from '@/lib/db/sessions';
import ActivityCalendar from './ActivityCalendar';
import MilestonesList from './MilestonesList';
import { useAppStore } from '@/lib/store';

// ── Hero number ───────────────────────────────────────────────────────
const HeroNumber = memo(function HeroNumber({ value, unit, label, theme }: {
  value: string; unit: string; label: string; theme: AppTheme;
}) {
  return (
    <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.heroContainer}>
      <View style={styles.heroValueRow}>
        <Text style={[styles.heroValue, { color: theme.text, fontFamily: Fonts.serif }]}>{value}</Text>
        {unit ? <Text style={[styles.heroUnit, { color: theme.textTertiary }]}>{unit}</Text> : null}
      </View>
      <Text style={[styles.heroLabel, { color: theme.textTertiary, fontFamily: Fonts.serif }]}>{label}</Text>
    </Animated.View>
  );
});

// ── Week strip (vertical bars) ────────────────────────────────────────
const MAX_BAR_H = 40;
const BAR_W = 6;

const WeekStrip = memo(function WeekStrip({ weekStats, theme }: { weekStats: WeekDay[]; theme: AppTheme }) {
  const maxDur = Math.max(...weekStats.map((d) => d.duration), 1);

  return (
    <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.weekStripContainer}>
      {weekStats.map((day) => {
        const barH = day.duration > 0
          ? 2 + (day.duration / maxDur) * (MAX_BAR_H - 2)
          : 2;
        return (
          <View key={day.date} style={styles.weekStripCol}>
            <Text style={[styles.weekStripDay, { color: day.isToday ? theme.text : theme.textTertiary, fontFamily: Fonts.serif }]}>
              {day.dayName.charAt(0)}
            </Text>
            <View style={styles.weekStripBarArea}>
              <View style={{
                width: BAR_W,
                height: barH,
                borderRadius: BAR_W / 2,
                backgroundColor: day.duration > 0 ? theme.accent : theme.border,
                opacity: day.duration > 0 ? 1 : 0.3,
              }} />
            </View>
          </View>
        );
      })}
    </Animated.View>
  );
});

// ── Secondary stats row ───────────────────────────────────────────────
const SecondaryStats = memo(function SecondaryStats({ items, theme }: {
  items: { value: string; label: string }[]; theme: AppTheme;
}) {
  return (
    <Animated.View entering={FadeIn.delay(350).duration(400)} style={styles.secondaryRow}>
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && <View style={[styles.secondaryDivider, { backgroundColor: theme.border }]} />}
          <View style={styles.secondaryCell}>
            <Text style={[styles.secondaryValue, { color: theme.text, fontFamily: Fonts.serif }]}>{item.value}</Text>
            <Text style={[styles.secondaryLabel, { color: theme.textTertiary }]}>{item.label}</Text>
          </View>
        </Fragment>
      ))}
    </Animated.View>
  );
});

// ── Section divider ───────────────────────────────────────────────────
function SectionDivider({ color }: { color: string }) {
  return (
    <View style={styles.dividerOuter}>
      <View style={[styles.dividerLine, { backgroundColor: color }]} />
    </View>
  );
}

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
  const weekStats = getWeekStats();
  const totalSessions = getSessionCount();
  const avgSession = totalSessions > 0
    ? formatTimeStat(Math.round(totalStats.year / totalSessions))
    : { value: '0', unit: 'min' };
  const longestSession = formatTimeStat(getLongestSessionDuration());

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = getDurationSince(startOfMonth);
  const thisMonthStat = formatTimeStat(thisMonth);

  // Hero: most impressive stat
  const heroStat = useMemo(() => {
    if (streak >= 7) return { value: String(streak), unit: 'days', label: 'current streak' };
    if (thisMonth >= 3600) return { value: thisMonthStat.value, unit: thisMonthStat.unit, label: 'this month' };
    if (streak >= 3) return { value: String(streak), unit: 'days', label: 'streak' };
    return { value: thisMonthStat.value, unit: thisMonthStat.unit, label: 'this month' };
  }, [streak, thisMonth, thisMonthStat]);

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

  const secondaryItems = useMemo(() => [
    { value: `${avgSession.value} ${avgSession.unit}`, label: 'AVG SESSION' },
    { value: `${longestSession.value} ${longestSession.unit}`, label: 'LONGEST' },
    { value: String(totalSessions), label: 'SESSIONS' },
  ], [avgSession, longestSession, totalSessions]);

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

      {/* Surface: emotional impact */}
      <HeroNumber value={heroStat.value} unit={heroStat.unit} label={heroStat.label} theme={theme} />

      {weekInsight && (
        <Animated.Text
          entering={FadeIn.delay(300).duration(400)}
          style={[styles.insightText, { color: theme.textTertiary, fontFamily: Fonts.serif }]}
        >
          {weekInsight}
        </Animated.Text>
      )}

      <SecondaryStats items={secondaryItems} theme={theme} />

      {/* Depth: structure */}
      <SectionDivider color={theme.border} />

      <ActivityCalendar theme={theme} />

      <SectionDivider color={theme.border} />

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>MILESTONES</Text>
      <MilestonesList theme={theme} achievedMilestones={achievedMilestones} />

      {/* Footer */}
      <View style={styles.quoteContainer}>
        <Text style={[styles.quoteText, { color: theme.textTertiary, fontFamily: Fonts.serif }]}>{quote}</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 32, fontWeight: '400', letterSpacing: 0.5 },
  closeButton: { padding: 4 },
  closeText: { fontSize: 20, fontWeight: '300' },

  // Hero number
  heroContainer: { alignItems: 'center', marginBottom: 32 },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroValue: { fontSize: 72, fontWeight: '200' },
  heroUnit: { fontSize: 18, fontWeight: '300', marginLeft: 6 },
  heroLabel: { fontSize: 15, fontWeight: '300', fontStyle: 'italic', marginTop: 4 },

  // Week strip
  weekStripContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 24 },
  weekStripCol: { alignItems: 'center', flex: 1, gap: 8 },
  weekStripDay: { fontSize: 11, fontWeight: '400', letterSpacing: 0.5 },
  weekStripBarArea: { height: MAX_BAR_H, justifyContent: 'flex-end', alignItems: 'center' },

  // Insight
  insightText: { fontSize: 14, fontWeight: '300', fontStyle: 'italic', textAlign: 'center', lineHeight: 22, marginBottom: 48 },

  // Secondary stats
  secondaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  secondaryCell: { flex: 1, alignItems: 'center' },
  secondaryValue: { fontSize: 20, fontWeight: '300' },
  secondaryLabel: { fontSize: 10, fontWeight: '400', letterSpacing: 2, marginTop: 4 },
  secondaryDivider: { width: StyleSheet.hairlineWidth, height: 32, alignSelf: 'center' },

  // Section divider
  dividerOuter: { alignItems: 'center', marginVertical: 40 },
  dividerLine: { width: 40, height: 1 },

  // Section labels
  sectionLabel: { fontSize: 11, letterSpacing: 3, fontWeight: '500', marginBottom: 16 },

  // Footer
  quoteContainer: { marginTop: 48, paddingHorizontal: 16, alignItems: 'center', marginBottom: 20 },
  quoteText: { fontSize: 14, fontWeight: '300', fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
});

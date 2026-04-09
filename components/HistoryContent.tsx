import { Fragment, memo, useMemo } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';

const SCREEN_W = Dimensions.get('window').width;

import { Fonts } from '@/constants/theme';
import { themes, palette } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import { formatTimeStat } from '@/lib/format';
import { getStats, getStreak, getWeekStats, type WeekDay } from '@/lib/stats';
import { getDurationSince, getSessionCount, getLongestSessionDuration, getTotalDuration, getActiveDaysCount, getWeekDurations } from '@/lib/db/sessions';
import ActivityCalendar from './ActivityCalendar';
import MilestonesList from './MilestonesList';
import { useAppStore } from '@/lib/store';

// ── Progress ring for hero ────────────────────────────────────────────
const RING_SIZE = 180;
const RING_STROKE = 4;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

const HeroRing = memo(function HeroRing({ progress, color, trackColor }: {
  progress: number; color: string; trackColor: string;
}) {
  const offset = RING_CIRC * (1 - Math.min(progress, 1));
  return (
    <Svg width={RING_SIZE} height={RING_SIZE} style={styles.heroRing}>
      <Circle
        cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
        stroke={trackColor} strokeWidth={RING_STROKE} fill="none"
      />
      <Circle
        cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
        stroke={color} strokeWidth={RING_STROKE} fill="none"
        strokeLinecap="round"
        strokeDasharray={`${RING_CIRC}`}
        strokeDashoffset={offset}
        rotation={-90} origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
      />
    </Svg>
  );
});

// ── Stat card ─────────────────────────────────────────────────────────
function StatCard({ value, label, accent, theme }: {
  value: string; label: string; accent?: boolean; theme: AppTheme;
}) {
  return (
    <View style={[
      styles.statCard,
      { backgroundColor: accent ? palette.terracotta : theme.subtle },
    ]}>
      <Text style={[
        styles.statCardValue,
        { color: accent ? palette.cream : theme.text, fontFamily: Fonts.serif },
      ]}>
        {value}
      </Text>
      <Text style={[
        styles.statCardLabel,
        { color: accent ? palette.cream + 'CC' : theme.textSecondary },
      ]}>
        {label}
      </Text>
    </View>
  );
}

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
  const totalSessions = getSessionCount();
  const avgSession = totalSessions > 0
    ? formatTimeStat(Math.round(totalStats.year / totalSessions))
    : { value: '0', unit: 'min' };
  const longestSession = formatTimeStat(getLongestSessionDuration());
  const totalDuration = getTotalDuration();
  const totalDurationStat = formatTimeStat(totalDuration);
  const daysActive = getActiveDaysCount();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = getDurationSince(startOfMonth);
  const thisMonthStat = formatTimeStat(thisMonth);

  // Hero: most impressive stat + ring progress
  const heroStat = useMemo(() => {
    if (streak >= 7) {
      return { value: String(streak), unit: 'days', label: 'current streak', progress: streak / 30 };
    }
    if (thisMonth >= 3600) {
      return { value: thisMonthStat.value, unit: thisMonthStat.unit, label: 'this month', progress: thisMonth / (30 * 60) }; // progress toward 30min
    }
    if (streak >= 3) {
      return { value: String(streak), unit: 'days', label: 'streak', progress: streak / 7 };
    }
    return { value: thisMonthStat.value, unit: thisMonthStat.unit, label: 'this month', progress: thisMonth / (15 * 60) };
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

      {/* Hero — big number with progress ring */}
      <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.heroContainer}>
        <HeroRing
          progress={heroStat.progress}
          color={palette.terracotta}
          trackColor={theme.border}
        />
        <View style={styles.heroTextCenter}>
          <View style={styles.heroValueRow}>
            <Text style={[styles.heroValue, { color: theme.text, fontFamily: Fonts.serif }]}>{heroStat.value}</Text>
            <Text style={[styles.heroUnit, { color: theme.text, fontFamily: Fonts.serif }]}>{heroStat.unit}</Text>
          </View>
          <Text style={[styles.heroLabel, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>{heroStat.label}</Text>
        </View>
      </Animated.View>

      {/* Weekly insight */}
      {weekInsight && (
        <Animated.Text
          entering={FadeIn.delay(200).duration(400)}
          style={[styles.insightText, { color: theme.textSecondary, fontFamily: Fonts.serif }]}
        >
          {weekInsight}
        </Animated.Text>
      )}

      {/* Stats grid — 2x2 cards */}
      <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.statsGrid}>
        <StatCard value={`${avgSession.value} ${avgSession.unit}`} label="AVG SESSION" theme={theme} />
        <StatCard value={`${longestSession.value} ${longestSession.unit}`} label="LONGEST" theme={theme} />
        <StatCard value={String(totalSessions)} label="SESSIONS" accent theme={theme} />
        <StatCard value={String(daysActive)} label="DAYS ACTIVE" theme={theme} />
      </Animated.View>

      {/* Calendar */}
      <SectionDivider color={theme.border} />

      <ActivityCalendar theme={theme} />

      {/* Milestones */}
      <SectionDivider color={theme.border} />

      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>MILESTONES</Text>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 32, fontWeight: '400', letterSpacing: 0.5 },
  closeButton: { padding: 4 },
  closeText: { fontSize: 20, fontWeight: '300' },

  // Hero with ring
  heroContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    height: RING_SIZE,
  },
  heroRing: {
    position: 'absolute',
  },
  heroTextCenter: {
    alignItems: 'center',
  },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroValue: { fontSize: 56, fontWeight: '200' },
  heroUnit: { fontSize: 17, fontWeight: '300', marginLeft: 5 },
  heroLabel: { fontSize: 14, fontWeight: '400', marginTop: 2 },

  // Insight
  insightText: { fontSize: 15, fontWeight: '400', textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    width: '47.5%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
  },
  statCardValue: {
    fontSize: 24,
    fontWeight: '300',
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2,
    marginTop: 4,
  },

  // Section divider
  dividerOuter: { alignItems: 'center', marginVertical: 32 },
  dividerLine: { width: 40, height: 1 },

  // Section labels
  sectionLabel: { fontSize: 11, letterSpacing: 3, fontWeight: '500', marginBottom: 16 },

  // Footer
  quoteContainer: { marginTop: 48, paddingHorizontal: 16, alignItems: 'center', marginBottom: 20 },
  quoteText: { fontSize: 14, fontWeight: '300', fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
});

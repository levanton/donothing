import { useCallback, useRef, useState } from 'react';
import { Dimensions, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const SCREEN_W = Dimensions.get('window').width;

import { Fonts } from '@/constants/theme';
import { themes } from '@/lib/theme';
import { formatTimeShort, formatTimeStat } from '@/lib/format';
import { getDailyStats, getStats, getStreak } from '@/lib/stats';
import ActivityCalendar from './ActivityCalendar';
import { useAppStore } from '@/lib/store';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

const ZEN_QUOTES = [
  'sitting quietly, doing nothing, spring comes, and the grass grows by itself.',
  'the quieter you become, the more you can hear.',
  'in the midst of movement and chaos, keep stillness inside of you.',
  'silence is the sleep that nourishes wisdom.',
  'do nothing, and everything is done.',
];

interface HistoryContentProps {
  onClose: () => void;
  insets: { top: number; bottom: number };
  onScroll?: any;
  nativeScrollGesture?: GestureType;
}

export default function HistoryContent({ onClose, insets, onScroll, nativeScrollGesture }: HistoryContentProps) {
  const sessions = useAppStore((s) => s.sessions);
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themes[themeMode];

  const dailyStats = getDailyStats(sessions);
  const totalStats = getStats(sessions);
  const streak = getStreak(sessions);
  const totalAll = formatTimeStat(totalStats.year);
  const avgSession = sessions.length > 0
    ? formatTimeStat(Math.round(totalStats.year / sessions.length))
    : { value: '0', unit: 'min' };
  const longestSession = formatTimeStat(
    sessions.length > 0 ? Math.max(...sessions.map((s) => s.duration)) : 0,
  );

  // Extra stats for page 2
  const totalSessions = sessions.length;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = sessions
    .filter((s) => s.timestamp >= startOfMonth)
    .reduce((sum, s) => sum + s.duration, 0);
  const thisMonthStat = formatTimeStat(thisMonth);

  // Best day
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const d = new Date(s.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDay.set(key, (byDay.get(key) || 0) + s.duration);
  }
  const bestDayDuration = byDay.size > 0 ? Math.max(...byDay.values()) : 0;
  const bestDayStat = formatTimeStat(bestDayDuration);
  const daysActive = byDay.size;

  const [statsPage, setStatsPage] = useState(0);
  const statsScrollRef = useRef<ScrollView>(null);
  const statsPageW = SCREEN_W;

  const onStatsScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / statsPageW);
    setStatsPage(page);
  }, [statsPageW]);

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const quote = ZEN_QUOTES[dayOfYear % ZEN_QUOTES.length];

  const scrollView = (
    <AnimatedScrollView
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
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts!.serif }]}>
          History
        </Text>
        <Pressable onPress={onClose} hitSlop={16} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>{'\u2715'}</Text>
        </Pressable>
      </View>

      <View style={[styles.statsOuter, { borderColor: theme.border }]}>
        <ScrollView
          ref={statsScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onStatsScroll}
          style={styles.statsScroll}
        >
          {/* Page 1 */}
          <View style={[styles.statsPage, { width: statsPageW }]}>
            <View style={styles.statsRow}>
              <View style={styles.totalSection}>
                <View style={styles.totalValueRow}>
                  <Text style={[styles.totalValue, { color: theme.text, fontFamily: Fonts!.serif }]}>{totalAll.value}</Text>
                  <Text style={[styles.totalUnit, { color: theme.textTertiary }]}>{totalAll.unit}</Text>
                </View>
                <Text style={[styles.totalLabel, { color: theme.textTertiary, fontFamily: Fonts!.serif }]}>total stillness</Text>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statCell}>
                  <Text style={[styles.statValue, { color: theme.text, fontFamily: Fonts!.serif }]}>
                    {formatTimeStat(totalStats.week).value}<Text style={[styles.statUnit, { color: theme.textTertiary }]}> {formatTimeStat(totalStats.week).unit}</Text>
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]}>this week</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={[styles.statValue, { color: streak > 0 ? theme.accent : theme.text, fontFamily: Fonts!.serif }]}>{streak}</Text>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]}>day streak</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={[styles.statValue, { color: theme.text, fontFamily: Fonts!.serif }]}>
                    {avgSession.value}<Text style={[styles.statUnit, { color: theme.textTertiary }]}> {avgSession.unit}</Text>
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]}>avg session</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={[styles.statValue, { color: theme.text, fontFamily: Fonts!.serif }]}>
                    {longestSession.value}<Text style={[styles.statUnit, { color: theme.textTertiary }]}> {longestSession.unit}</Text>
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]}>longest</Text>
                </View>
              </View>
            </View>
            <View style={styles.statsArrow}>
              <Feather name="chevron-right" size={18} color={theme.textTertiary} />
            </View>
          </View>

          {/* Page 2 */}
          <View style={[styles.statsPage, { width: statsPageW }]}>
            <View style={[styles.statsArrow, { left: 0, right: undefined }]}>
              <Feather name="chevron-left" size={18} color={theme.textTertiary} />
            </View>
            <View style={styles.statsRow}>
              <View style={styles.totalSection}>
                <View style={styles.totalValueRow}>
                  <Text style={[styles.totalValue, { color: theme.text, fontFamily: Fonts!.serif }]}>{thisMonthStat.value}</Text>
                  <Text style={[styles.totalUnit, { color: theme.textTertiary }]}>{thisMonthStat.unit}</Text>
                </View>
                <Text style={[styles.totalLabel, { color: theme.textTertiary, fontFamily: Fonts!.serif }]}>this month</Text>
              </View>
              <View style={styles.statsGrid}>
                <View style={styles.statCell}>
                  <Text style={[styles.statValue, { color: theme.text, fontFamily: Fonts!.serif }]}>{totalSessions}</Text>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]}>sessions</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={[styles.statValue, { color: theme.text, fontFamily: Fonts!.serif }]}>{daysActive}</Text>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]}>days active</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={[styles.statValue, { color: theme.text, fontFamily: Fonts!.serif }]}>
                    {bestDayStat.value}<Text style={[styles.statUnit, { color: theme.textTertiary }]}> {bestDayStat.unit}</Text>
                  </Text>
                  <Text style={[styles.statLabel, { color: theme.textTertiary }]}>best day</Text>
                </View>
                <View style={styles.statCell}>
                  <Text style={[styles.statValue, { color: theme.text, fontFamily: Fonts!.serif }]}>
                    {formatTimeStat(totalStats.today).value}<Text style={[styles.statUnit, { color: theme.textTertiary }]}> {formatTimeStat(totalStats.today).unit}</Text>
                </Text>
                <Text style={[styles.statLabel, { color: theme.textTertiary }]}>today</Text>
              </View>
            </View>
            </View>
          </View>
        </ScrollView>

        {/* Dots — bottom right */}
        <View style={styles.pageDots}>
          <View style={[styles.dot, { backgroundColor: statsPage === 0 ? theme.text : theme.border }]} />
          <View style={[styles.dot, { backgroundColor: statsPage === 1 ? theme.text : theme.border }]} />
        </View>
      </View>

      <ActivityCalendar sessions={sessions} theme={theme} />

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ALL SESSIONS</Text>
      {dailyStats.map((day) => (
        <View key={day.date} style={[styles.dayRow, { borderBottomColor: theme.border }]}>
          <Text style={[styles.dayLabel, { color: theme.text, fontFamily: Fonts!.serif }]}>{day.label}</Text>
          <Text style={[styles.dayDuration, {
            color: day.duration > 0 ? theme.text : theme.textTertiary,
            fontFamily: Fonts!.serif,
          }]}>
            {day.duration > 0 ? formatTimeShort(day.duration) : '\u2014'}
          </Text>
        </View>
      ))}

      <View style={styles.quoteContainer}>
        <Text style={[styles.quoteText, { color: theme.textTertiary, fontFamily: Fonts!.serif }]}>
          {quote}
        </Text>
      </View>
    </AnimatedScrollView>
  );

  if (nativeScrollGesture) {
    return <GestureDetector gesture={nativeScrollGesture}>{scrollView}</GestureDetector>;
  }
  return scrollView;
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '400', letterSpacing: 0.5 },
  closeButton: { padding: 4 },
  closeText: { fontSize: 20, fontWeight: '300' },
  statsOuter: {
    marginBottom: 32,
    marginHorizontal: -24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  statsScroll: {
    overflow: 'hidden',
  },
  statsPage: {
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsArrow: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 24,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  totalSection: { flex: 1 },
  totalValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  totalValue: { fontSize: 52, fontWeight: '300' },
  totalUnit: { fontSize: 18, fontWeight: '300', marginLeft: 4 },
  totalLabel: { fontSize: 14, fontWeight: '300', fontStyle: 'italic', marginTop: 4 },
  statsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCell: {
    width: '50%',
    paddingVertical: 8,
    paddingLeft: 12,
  },
  statValue: { fontSize: 22, fontWeight: '300' },
  statUnit: { fontSize: 14, fontWeight: '300' },
  statLabel: { fontSize: 13, fontWeight: '300', marginTop: 2 },
  sectionTitle: { fontSize: 11, letterSpacing: 3, fontWeight: '500', marginBottom: 16 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  dayLabel: { fontSize: 16, fontWeight: '400' },
  dayDuration: { fontSize: 16, fontWeight: '300' },
  quoteContainer: { marginTop: 40, paddingHorizontal: 16, alignItems: 'center' },
  quoteText: { fontSize: 14, fontWeight: '300', fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
});

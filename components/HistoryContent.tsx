import { memo, useCallback, useMemo, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const SCREEN_W = Dimensions.get('window').width;

import { Fonts } from '@/constants/theme';
import { themes, palette } from '@/lib/theme';
import { formatTimeShort, formatTimeStat } from '@/lib/format';
import { getDailyStats, getStats, getStreak, type DayStats } from '@/lib/stats';
import { getDurationSince, getSessionCount, getLongestSessionDuration, getActiveDaysCount, getBestDayDuration } from '@/lib/db/sessions';
import ActivityCalendar from './ActivityCalendar';
import { useAppStore } from '@/lib/store';

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<DayStats>);

const DELETE_BTN_W = 80;

const SwipeableDayRow = memo(function SwipeableDayRow({ day, theme, onDelete }: {
  day: DayStats;
  theme: any;
  onDelete: (date: string) => void;
}) {
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);

  const swipe = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-5, 5])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      'worklet';
      const next = startX.value + e.translationX;
      translateX.value = Math.max(-DELETE_BTN_W, Math.min(0, next));
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationX < -40 || e.velocityX < -500) {
        translateX.value = withTiming(-DELETE_BTN_W, { duration: 200 });
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.swipeContainer}>
      <Pressable
        style={[styles.deleteBtn, { backgroundColor: palette.danger }]}
        onPress={() => {
          translateX.value = withTiming(0, { duration: 200 });
          onDelete(day.date);
        }}
      >
        <Text style={styles.deleteBtnText}>Delete</Text>
      </Pressable>
      <GestureDetector gesture={day.duration > 0 ? swipe : Gesture.Manual()}>
        <Animated.View style={[styles.swipeRow, { borderBottomColor: theme.border, backgroundColor: theme.bg }, rowStyle]}>
          <Text style={[styles.dayLabel, { color: theme.text, fontFamily: Fonts!.serif }]}>{day.label}</Text>
          <Text style={[styles.dayDuration, {
            color: day.duration > 0 ? theme.text : theme.textTertiary,
            fontFamily: Fonts!.serif,
          }]}>
            {day.duration > 0 ? formatTimeShort(day.duration) : '\u2014'}
          </Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
});


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
  const deleteSessionsByDate = useAppStore((s) => s.deleteSessionsByDate);
  // Subscribe to weekStats to trigger re-render when session data changes
  useAppStore((s) => s.weekStats);
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themes[themeMode];

  const dailyStats = getDailyStats();
  const totalStats = getStats();
  const streak = getStreak();
  const totalAll = formatTimeStat(totalStats.year);
  const totalSessions = getSessionCount();
  const avgSession = totalSessions > 0
    ? formatTimeStat(Math.round(totalStats.year / totalSessions))
    : { value: '0', unit: 'min' };

  const bestDayStat = formatTimeStat(getBestDayDuration());
  const daysActive = getActiveDaysCount();
  const longestSession = formatTimeStat(getLongestSessionDuration());

  // This month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = getDurationSince(startOfMonth);
  const thisMonthStat = formatTimeStat(thisMonth);

  const [statsPage, setStatsPage] = useState(0);
  const statsTranslateX = useSharedValue(0);

  const setPage = useCallback((p: number) => {
    setStatsPage(p);
    Haptics.selectionAsync();
  }, []);

  const statsSwipe = Gesture.Pan()
    .activeOffsetX([-30, 30])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      'worklet';
      const base = statsPage === 0 ? 0 : -SCREEN_W;
      statsTranslateX.value = base + e.translationX;
    })
    .onEnd((e) => {
      'worklet';
      if (e.translationX < -50 && statsPage === 0) {
        statsTranslateX.value = withTiming(-SCREEN_W, { duration: 250 });
        runOnJS(setPage)(1);
      } else if (e.translationX > 50 && statsPage === 1) {
        statsTranslateX.value = withTiming(0, { duration: 250 });
        runOnJS(setPage)(0);
      } else {
        statsTranslateX.value = withTiming(statsPage === 0 ? 0 : -SCREEN_W, { duration: 250 });
      }
    });

  const statsSlideStyle = useAnimatedStyle(() => ({
    flexDirection: 'row',
    width: SCREEN_W * 2,
    transform: [{ translateX: statsTranslateX.value }],
  }));

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const quote = ZEN_QUOTES[dayOfYear % ZEN_QUOTES.length];

  const renderItem = useCallback(({ item }: { item: DayStats }) => (
    <SwipeableDayRow day={item} theme={theme} onDelete={deleteSessionsByDate} />
  ), [theme, deleteSessionsByDate]);

  const keyExtractor = useCallback((item: DayStats) => item.date, []);

  const listHeader = useMemo(() => (
    <>
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts!.serif }]}>
          History
        </Text>
        <Pressable onPress={onClose} hitSlop={16} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>{'\u2715'}</Text>
        </Pressable>
      </View>

      <View style={[styles.statsOuter, { borderColor: theme.border }]}>
        <GestureDetector gesture={statsSwipe}>
          <Animated.View style={[styles.statsScroll, statsSlideStyle]}>
          {/* Page 1 */}
          <View style={[styles.statsPage, { width: SCREEN_W }]}>
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
          </View>

          {/* Page 2 */}
          <View style={[styles.statsPage, { width: SCREEN_W }]}>
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
          </Animated.View>
        </GestureDetector>

        <View style={styles.pageDots}>
          <View style={[styles.dot, { backgroundColor: statsPage === 0 ? theme.text : theme.border }]} />
          <View style={[styles.dot, { backgroundColor: statsPage === 1 ? theme.text : theme.border }]} />
        </View>
      </View>

      <ActivityCalendar theme={theme} />

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ALL SESSIONS</Text>
    </>
  ), [theme, statsPage, statsSwipe, statsSlideStyle, onClose, thisMonthStat, totalStats, streak, avgSession, longestSession, totalAll, totalSessions, daysActive, bestDayStat]);

  const listFooter = useMemo(() => (
    <View style={styles.quoteContainer}>
      <Text style={[styles.quoteText, { color: theme.textTertiary, fontFamily: Fonts!.serif }]}>
        {quote}
      </Text>
    </View>
  ), [theme.textTertiary, quote]);

  const flatList = (
    <AnimatedFlatList
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
      data={dailyStats}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      ListFooterComponent={listFooter}
    />
  );

  if (nativeScrollGesture) {
    return <GestureDetector gesture={nativeScrollGesture}>{flatList}</GestureDetector>;
  }
  return flatList;
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
    top: 0,
    bottom: 16,
    justifyContent: 'center',
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
  totalValue: { fontSize: 56, fontWeight: '300' },
  totalUnit: { fontSize: 20, fontWeight: '300', marginLeft: 4 },
  totalLabel: { fontSize: 15, fontWeight: '300', fontStyle: 'italic', marginTop: 4 },
  statsGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCell: {
    width: '50%',
    paddingVertical: 10,
    paddingLeft: 12,
  },
  statValue: { fontSize: 24, fontWeight: '300' },
  statUnit: { fontSize: 15, fontWeight: '300' },
  statLabel: { fontSize: 13, fontWeight: '300', marginTop: 3 },
  sectionTitle: { fontSize: 11, letterSpacing: 3, fontWeight: '500', marginBottom: 16 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  swipeContainer: {
    marginHorizontal: -24,
    overflow: 'hidden',
  },
  swipeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dayLabel: { fontSize: 16, fontWeight: '400' },
  dayDuration: { fontSize: 16, fontWeight: '300' },
  deleteBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_BTN_W,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '500',
  },
  quoteContainer: { marginTop: 40, paddingHorizontal: 16, alignItems: 'center' },
  quoteText: { fontSize: 14, fontWeight: '300', fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
});

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import { themes } from '@/lib/theme';
import { formatTimeShort, formatTimeStat } from '@/lib/format';
import { getDailyStats, getStats, getStreak } from '@/lib/stats';
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
}

export default function HistoryContent({ onClose, insets, onScroll }: HistoryContentProps) {
  const sessions = useAppStore((s) => s.sessions);
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themes[themeMode];

  const dailyStats = getDailyStats(sessions);
  const totalStats = getStats(sessions);
  const streak = getStreak(sessions);
  const maxDuration = Math.max(...dailyStats.map((d) => d.duration), 1);
  const totalAll = formatTimeStat(totalStats.year);

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000,
  );
  const quote = ZEN_QUOTES[dayOfYear % ZEN_QUOTES.length];

  return (
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

      <View style={styles.heroSection}>
        <View style={styles.heroValueRow}>
          <Text style={[styles.heroValue, { color: theme.text, fontFamily: Fonts!.serif }]}>
            {totalAll.value}
          </Text>
          <Text style={[styles.heroUnit, { color: theme.textTertiary }]}>
            {totalAll.unit}
          </Text>
        </View>
        <Text style={[styles.heroLabel, { color: theme.textTertiary, fontFamily: Fonts!.serif }]}>
          total stillness
        </Text>
      </View>

      <View style={[styles.inlineStats, { borderColor: theme.border }]}>
        {streak > 0 && (
          <Text style={[styles.inlineStatText, { color: theme.textSecondary }]}>
            <Text style={{ color: theme.accent, fontFamily: Fonts!.serif }}>{streak}</Text>
            {' day streak'}
          </Text>
        )}
        <Text style={[styles.inlineStatText, { color: theme.textSecondary }]}>
          <Text style={{ color: theme.text, fontFamily: Fonts!.serif }}>{formatTimeStat(totalStats.today).value}</Text>
          <Text style={{ color: theme.textTertiary }}> {formatTimeStat(totalStats.today).unit}</Text>
          {' today'}
        </Text>
        <Text style={[styles.inlineStatText, { color: theme.textSecondary }]}>
          <Text style={{ color: theme.text, fontFamily: Fonts!.serif }}>{formatTimeStat(totalStats.week).value}</Text>
          <Text style={{ color: theme.textTertiary }}> {formatTimeStat(totalStats.week).unit}</Text>
          {' this week'}
        </Text>
      </View>

      <View style={styles.weekSection}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>LAST 7 DAYS</Text>
        <View style={styles.weekGrid}>
          {dailyStats.slice(0, 7).map((day) => {
            const size = day.duration > 0 ? 16 + (day.duration / maxDuration) * 28 : 6;
            return (
              <View key={day.date} style={styles.weekDayCol}>
                <View style={{
                  width: size, height: size, borderRadius: size / 2,
                  backgroundColor: day.duration > 0 ? theme.accent : theme.border,
                }} />
                <Text style={[styles.weekDayLabel, { color: theme.textTertiary }]}>
                  {day.label.slice(0, 3)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

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
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '400', letterSpacing: 0.5 },
  closeButton: { padding: 4 },
  closeText: { fontSize: 20, fontWeight: '300' },
  heroSection: { alignItems: 'center', marginBottom: 20 },
  heroLabel: { fontSize: 13, fontWeight: '300', fontStyle: 'italic', marginTop: 4 },
  heroValueRow: { flexDirection: 'row', alignItems: 'baseline' },
  heroValue: { fontSize: 64, fontWeight: '300' },
  heroUnit: { fontSize: 20, fontWeight: '300', marginLeft: 4 },
  inlineStats: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 32, paddingBottom: 24, borderBottomWidth: StyleSheet.hairlineWidth },
  inlineStatText: { fontSize: 13, fontWeight: '300' },
  weekSection: { marginBottom: 28 },
  weekGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 60, paddingHorizontal: 8 },
  weekDayCol: { alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: 8 },
  weekDayLabel: { fontSize: 10, fontWeight: '400', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11, letterSpacing: 3, fontWeight: '500', marginBottom: 16 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  dayLabel: { fontSize: 16, fontWeight: '400' },
  dayDuration: { fontSize: 16, fontWeight: '300' },
  quoteContainer: { marginTop: 40, paddingHorizontal: 16, alignItems: 'center' },
  quoteText: { fontSize: 14, fontWeight: '300', fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
});

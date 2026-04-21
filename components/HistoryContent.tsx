import { useCallback, useEffect, useRef } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, runOnJS, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';

import { Fonts } from '@/constants/theme';
import { themes } from '@/lib/theme';
import { formatTimeStat } from '@/lib/format';
import { getDurationSince, getSessionCount, getLongestSessionDuration } from '@/lib/db/sessions';
import ActivityCalendar from './ActivityCalendar';
import { useAppStore } from '@/lib/store';

const { height: SCREEN_H } = Dimensions.get('window');

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
  onHeadingLayout?: (rect: { x: number; y: number; w: number; h: number }) => void;
  historySlide?: SharedValue<number>;
}

export default function HistoryContent({
  onClose,
  insets,
  onScroll,
  nativeScrollGesture,
  onHeadingLayout,
  historySlide,
}: HistoryContentProps) {
  useAppStore((s) => s.weekStats);
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themes[themeMode];

  const headingRef = useRef<View>(null);
  // Measure window coords and compensate for the panel's current translateY
  // so the stored rect is always the at-rest (slide = 1) position, regardless
  // of when we happen to measure.
  const measureHeading = useCallback(() => {
    if (!onHeadingLayout) return;
    const slide = historySlide?.value ?? 0;
    const panelOffset = (1 - slide) * SCREEN_H;
    headingRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) {
        onHeadingLayout({ x, y: y - panelOffset, w, h });
      }
    });
  }, [onHeadingLayout, historySlide]);

  // Measure once on mount (before user swipes) so the proxy has both endpoints
  // from the first frame.
  useEffect(() => {
    const t = setTimeout(measureHeading, 180);
    return () => clearTimeout(t);
  }, [measureHeading]);

  // Re-measure when the panel is fully open — definitive, even if the first
  // measurement was off due to transform quirks.
  useAnimatedReaction(
    () => {
      'worklet';
      return historySlide ? historySlide.value : 0;
    },
    (slide, prev) => {
      'worklet';
      if (slide > 0.98 && (prev ?? 0) <= 0.98) {
        runOnJS(measureHeading)();
      }
    },
  );

  const totalSessions = getSessionCount();
  const longestSession = formatTimeStat(getLongestSessionDuration());

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const thisMonth = getDurationSince(startOfMonth);
  const thisMonthStat = formatTimeStat(thisMonth);

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
      {/* Header — heading text is kept invisible; a floating proxy in the parent
          renders the word and morphs between this heading and the home pill. */}
      <View style={styles.headerRow}>
        <View ref={headingRef} collapsable={false}>
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.serif, opacity: 0 }]}>
            Journey
          </Text>
        </View>
        <Pressable onPress={onClose} hitSlop={16} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>{'\u2715'}</Text>
        </Pressable>
      </View>

      {/* Stats — month total as hero, two supporting facts beneath */}
      <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.statsBlock}>
        <View style={styles.heroCell}>
          <Text style={[styles.heroValue, { color: theme.text, fontFamily: Fonts.serif }]}>
            {thisMonthStat.value}
            <Text style={styles.heroUnit}> {thisMonthStat.unit}</Text>
          </Text>
          <Text style={[styles.heroLabel, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>
            this month
          </Text>
        </View>

        <View style={styles.factsRow}>
          <Text style={[styles.factText, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>
            longest: <Text style={{ color: theme.text }}>{longestSession.value} {longestSession.unit}</Text>
          </Text>
          <Text style={[styles.factText, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>
            sessions: <Text style={{ color: theme.text }}>{totalSessions}</Text>
          </Text>
        </View>
      </Animated.View>

      {/* Calendar */}
      <ActivityCalendar theme={theme} />

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
  heroCell: { alignItems: 'center', marginBottom: 20 },
  heroValue: { fontSize: 56, fontWeight: '500', letterSpacing: -0.5 },
  heroUnit: { fontSize: 18, fontWeight: '400' },
  heroLabel: { fontSize: 15, fontWeight: '400', marginTop: 4 },
  factsRow: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  factText: { fontSize: 14, fontWeight: '400' },

  // Footer
  quoteContainer: { marginTop: 40, paddingHorizontal: 16, alignItems: 'center', marginBottom: 20 },
  quoteText: { fontSize: 14, fontWeight: '300', fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
});

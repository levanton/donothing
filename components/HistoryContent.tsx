import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';

import { Fonts } from '@/constants/theme';
import { themes, palette } from '@/lib/theme';
import { formatTimeStat } from '@/lib/format';
import {
  getMonthDurations,
  getMonthSessionCount,
  getMonthLongestSession,
} from '@/lib/db/sessions';
import ActivityCalendar from './ActivityCalendar';
import { useAppStore } from '@/lib/store';

const { height: SCREEN_H } = Dimensions.get('window');

const MONTH_NAMES_SHORT = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

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
  const weekStats = useAppStore((s) => s.weekStats);
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themes[themeMode];

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const headingRef = useRef<View>(null);
  // Animated.ScrollView ref — used to reset scroll to top when the
  // panel becomes visible. Without this, the inner ScrollView keeps
  // its previous scroll offset across opens, and the page can land
  // mid-content (or beyond) on entry.
  const scrollRef = useRef<Animated.ScrollView>(null);
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

  // ScrollView only becomes interactive when the panel is fully
  // settled at slide=1. Without this, the user's swipe-up that opens
  // My Journey ALSO bleeds into the rising ScrollView as a scroll-up
  // gesture, so by the time the panel arrives the content is already
  // mid-page. Gating on slide ≥ 0.99 keeps the ScrollView frozen
  // during the slide-in (and slide-out), so only the slide gesture
  // moves things during transitions.
  const [scrollEnabled, setScrollEnabled] = useState(false);

  const resetScroll = useCallback(() => {
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  }, []);

  // Real heading fades in only when the panel is fully open. Until
  // then the morphing proxy in the parent is the visible "My Journey".
  // Once handed off, this heading is part of the scrollable content
  // and will scroll up naturally with the rest of the page.
  const headingFadeStyle = useAnimatedStyle(() => {
    const p = historySlide ? historySlide.value : 0;
    return {
      opacity: interpolate(p, [0.95, 1], [0, 1], 'clamp'),
    };
  });

  useAnimatedReaction(
    () => {
      'worklet';
      return historySlide ? historySlide.value : 0;
    },
    (slide, prev) => {
      'worklet';
      const previous = prev ?? 0;
      // Slide settled at the top → enable scroll.
      if (slide >= 0.99 && previous < 0.99) {
        runOnJS(setScrollEnabled)(true);
        runOnJS(measureHeading)();
      }
      // Slide left the open zone → freeze scroll so the transition
      // never drags the content along.
      if (slide < 0.99 && previous >= 0.99) {
        runOnJS(setScrollEnabled)(false);
      }
      // Fully closed → reset position so the next open starts fresh.
      if (slide < 0.02 && previous >= 0.02) {
        runOnJS(resetScroll)();
      }
    },
  );

  // Per-month stats — recompute whenever the calendar's view changes,
  // and also when sessions mutate (weekStats bumps on add/delete).
  const monthDurationMap = useMemo(
    () => getMonthDurations(viewYear, viewMonth + 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewYear, viewMonth, weekStats],
  );

  const monthDuration = useMemo(() => {
    let total = 0;
    for (const dur of monthDurationMap.values()) total += dur;
    return total;
  }, [monthDurationMap]);

  const monthActiveDays = monthDurationMap.size;
  const monthBestDay = useMemo(() => {
    let max = 0;
    for (const dur of monthDurationMap.values()) {
      if (dur > max) max = dur;
    }
    return max;
  }, [monthDurationMap]);

  const monthSessions = useMemo(
    () => getMonthSessionCount(viewYear, viewMonth + 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewYear, viewMonth, weekStats],
  );
  const monthLongest = useMemo(
    () => getMonthLongestSession(viewYear, viewMonth + 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [viewYear, viewMonth, weekStats],
  );
  const monthAvgSession = monthSessions > 0 ? Math.round(monthDuration / monthSessions) : 0;

  const monthDurationStat = formatTimeStat(monthDuration);
  const longestStat = formatTimeStat(monthLongest);
  const bestDayStat = formatTimeStat(monthBestDay);
  const avgSessionStat = formatTimeStat(monthAvgSession);
  const heroLabel = isCurrentMonth ? 'this month' : MONTH_NAMES_SHORT[viewMonth];

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const quote = ZEN_QUOTES[dayOfYear % ZEN_QUOTES.length];

  const content = (
    <View style={{ flex: 1 }}>
      {/* Hidden measurement anchor for the heading proxy. Sits OUTSIDE
          the ScrollView so its `measureInWindow` is immune to scroll
          drift \u2014 the proxy in the parent uses this rect as the
          "fully-open" target and stays put when the user scrolls the
          calendar/sessions below. Visually invisible (opacity 0); the
          actual heading text inside the ScrollView is also opacity 0
          (just there to occupy layout space). */}
      <View
        ref={headingRef}
        collapsable={false}
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: insets.top + 8,
          left: 24,
          opacity: 0,
        }}
      >
        <Text style={[styles.title, { fontFamily: Fonts.serif }]}>My Journey</Text>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        scrollEnabled={scrollEnabled}
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
        <Animated.Text
          style={[
            styles.title,
            { color: theme.text, fontFamily: Fonts.serif },
            headingFadeStyle,
          ]}
        >
          My Journey
        </Animated.Text>
        <Pressable onPress={onClose} hitSlop={16} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>{'\u2715'}</Text>
        </Pressable>
      </View>

      {/* Stats — two-row 3×2 grid scoped to the calendar's viewed
          month. Top row anchors the headline (month duration + sessions
          + active days) with the hero numeral. Bottom row adds journey
          detail (longest single session, best day, average session) at
          smaller scale. All values mono, all labels serif. */}
      <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.statsBlock}>
        {/* Terracotta accent stripe at the top of the card — gives the
            block an anchor colour and breaks the monotone warm cream. */}
        <View style={styles.statsAccentStripe} />

        <View style={styles.statsRow}>
          <View style={styles.statCellHero}>
            <View style={styles.heroValueWrap}>
              <Text style={[styles.heroValue, { color: palette.terracotta, fontFamily: Fonts.mono }]}>
                {monthDurationStat.value}
              </Text>
              {monthDurationStat.unit ? (
                <Text style={[styles.heroUnit, { color: palette.terracotta, fontFamily: Fonts.serif }]}>
                  {monthDurationStat.unit}
                </Text>
              ) : null}
            </View>
            <View style={styles.statLabelRow}>
              <Feather name="calendar" size={11} color={palette.terracotta} />
              <Text style={[styles.statLabel, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>
                {heroLabel}
              </Text>
            </View>
          </View>

          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: theme.text, fontFamily: Fonts.mono }]}>
              {monthSessions}
            </Text>
            <View style={styles.statLabelRow}>
              <Feather name="hash" size={11} color={palette.terracotta} />
              <Text style={[styles.statLabel, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>
                {monthSessions === 1 ? 'session' : 'sessions'}
              </Text>
            </View>
          </View>

          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

          <View style={styles.statCell}>
            <View style={styles.statValueWrap}>
              <Text style={[styles.statValue, { color: theme.text, fontFamily: Fonts.mono }]}>
                {monthActiveDays}
              </Text>
              <Text style={[styles.statUnit, { color: theme.text, fontFamily: Fonts.serif }]}>
                {monthActiveDays === 1 ? 'day' : 'days'}
              </Text>
            </View>
            <View style={styles.statLabelRow}>
              <Feather name="check-circle" size={11} color={palette.terracotta} />
              <Text style={[styles.statLabel, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>
                active
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.statsRowDivider, { backgroundColor: theme.border }]} />

        <View style={styles.statsRow}>
          <View style={styles.statCellSecondary}>
            <View style={styles.statValueWrap}>
              <Text style={[styles.statValueSm, { color: theme.text, fontFamily: Fonts.mono }]}>
                {longestStat.value}
              </Text>
              {longestStat.unit ? (
                <Text style={[styles.statUnitSm, { color: theme.text, fontFamily: Fonts.serif }]}>
                  {longestStat.unit}
                </Text>
              ) : null}
            </View>
            <View style={styles.statLabelRow}>
              <Feather name="award" size={10} color={palette.terracotta} />
              <Text style={[styles.statLabelSm, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>
                longest
              </Text>
            </View>
          </View>

          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

          <View style={styles.statCellSecondary}>
            <View style={styles.statValueWrap}>
              <Text style={[styles.statValueSm, { color: theme.text, fontFamily: Fonts.mono }]}>
                {bestDayStat.value}
              </Text>
              {bestDayStat.unit ? (
                <Text style={[styles.statUnitSm, { color: theme.text, fontFamily: Fonts.serif }]}>
                  {bestDayStat.unit}
                </Text>
              ) : null}
            </View>
            <View style={styles.statLabelRow}>
              <Feather name="trending-up" size={10} color={palette.terracotta} />
              <Text style={[styles.statLabelSm, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>
                best day
              </Text>
            </View>
          </View>

          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

          <View style={styles.statCellSecondary}>
            <View style={styles.statValueWrap}>
              <Text style={[styles.statValueSm, { color: theme.text, fontFamily: Fonts.mono }]}>
                {avgSessionStat.value}
              </Text>
              {avgSessionStat.unit ? (
                <Text style={[styles.statUnitSm, { color: theme.text, fontFamily: Fonts.serif }]}>
                  {avgSessionStat.unit}
                </Text>
              ) : null}
            </View>
            <View style={styles.statLabelRow}>
              <Feather name="activity" size={10} color={palette.terracotta} />
              <Text style={[styles.statLabelSm, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>
                avg
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Hairline between stats and calendar — gives the page two
          discrete sections without resorting to a card fill. */}
      <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />

      {/* Calendar */}
      <ActivityCalendar
        theme={theme}
        viewYear={viewYear}
        viewMonth={viewMonth}
        onViewChange={(y, m) => { setViewYear(y); setViewMonth(m); }}
        durationMap={monthDurationMap}
      />

      {/* Footer */}
      <View style={styles.quoteContainer}>
        <Text style={[styles.quoteText, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>{quote}</Text>
      </View>
      </Animated.ScrollView>
    </View>
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

  // Stats — three cells share one baseline row, divided by hairlines.
  // Hero gets a wider weight (flex 1.4) so its bigger numeral sits
  // comfortably without crowding; supporting cells (flex 1) feel like
  // siblings rather than afterthoughts. All values mono, all labels
  // serif — same numeric family across the page.
  // Stats card — soft warm-cream fill with rounded corners gives the
  // page a clear "headline panel" instead of stats floating on the
  // background. The fill is *very* subtle (warmCream over the page's
  // cream) so it reads as elevation, not as a heavy box.
  statsBlock: {
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderRadius: 24,
    backgroundColor: palette.warmCream,
    overflow: 'hidden',
  },
  // Terracotta accent line at the very top of the stats card — draws
  // the eye to the headline panel and breaks the warm-cream monotone.
  statsAccentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: palette.terracotta,
    opacity: 0.85,
  },
  // Each stat label sits in a row with its small terracotta icon —
  // gives each metric a quick visual hook so the grid reads as
  // categorised rather than a wall of similar numbers.
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  // Hairline that separates the hero row from the secondary row
  // below. Sits at the same opacity as the vertical column dividers
  // so all rule lines feel like one family.
  statsRowDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 18,
    opacity: 0.6,
  },
  statCellHero: {
    flex: 1.4,
    paddingRight: 14,
  },
  statCell: {
    flex: 1,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  // Secondary row cell — equal flex with no hero bias, smaller font
  // size on the value/unit/label trio inside.
  statCellSecondary: {
    flex: 1,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 6,
    opacity: 0.6,
  },
  heroValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heroValue: {
    fontSize: 64,
    fontWeight: '500',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
    lineHeight: 68,
    includeFontPadding: false,
  },
  heroUnit: {
    fontSize: 16,
    fontWeight: '400',
    marginLeft: 4,
    letterSpacing: 0.2,
  },
  statValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    lineHeight: 34,
    includeFontPadding: false,
  },
  statUnit: {
    fontSize: 13,
    fontWeight: '400',
    marginLeft: 3,
    letterSpacing: 0.2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.5,
    opacity: 0.75,
  },
  // Secondary row metrics — same shape as the hero row but smaller.
  // Numbers stay mono, units stay serif, label stays small caps-y.
  statValueSm: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
    includeFontPadding: false,
  },
  statUnitSm: {
    fontSize: 11,
    fontWeight: '400',
    marginLeft: 2,
    letterSpacing: 0.2,
  },
  statLabelSm: {
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.5,
    opacity: 0.75,
  },
  // Horizontal hairline that visually separates the stats block above
  // from the calendar below. Subtle, no card fill — pure rule line.
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 24,
    opacity: 0.45,
  },

  // Footer
  quoteContainer: { marginTop: 40, paddingHorizontal: 16, alignItems: 'center', marginBottom: 20 },
  quoteText: { fontSize: 14, fontWeight: '300', fontStyle: 'italic', textAlign: 'center', lineHeight: 22 },
});

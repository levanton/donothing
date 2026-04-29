import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import type { GestureType } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';

import { Fonts } from '@/constants/theme';
import { themes, palette } from '@/lib/theme';
import { formatTimeStat } from '@/lib/format';
import { haptics } from '@/lib/haptics';
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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
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

  // Theme-aware card tint. Light: palette.sand — slightly darker tan
  // than the warmCream page bg, so the card still reads as a distinct
  // panel after we adopted warmCream globally. Dark: a slightly-
  // lighter warm-tinted panel above charcoal page bg (cream-on-cream
  // text would be invisible). Both values give a readable, theme-
  // coherent panel that sits clearly above the page.
  const cardBg = themeMode === 'dark' ? '#5A4F44' : palette.sand;

  // Bg fades in as the panel slides up — wider range than the heading
  // (which snaps in at [0.95, 1]) so the bg eases in gradually across
  // the second half of the slide, finishing as the heading settles.
  // Gives a layered entrance: bg first, heading last.
  const cardBgStyle = useAnimatedStyle(() => {
    const p = historySlide ? historySlide.value : 0;
    return {
      opacity: interpolate(p, [0.5, 1], [0, 1], 'clamp'),
    };
  });

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
  const avgSessionStat = formatTimeStat(monthAvgSession);
  const heroLabel = isCurrentMonth ? 'this month' : MONTH_NAMES_SHORT[viewMonth];
  const monthLabel = MONTH_NAMES[viewMonth] + (viewYear !== today.getFullYear() ? ` ${viewYear}` : '');

  const goToPrevMonth = useCallback(() => {
    haptics.select();
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }, [viewYear, viewMonth]);

  const goToNextMonth = useCallback(() => {
    if (isCurrentMonth) return;
    haptics.select();
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }, [viewYear, viewMonth, isCurrentMonth]);

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
          paddingTop: 0,
          paddingBottom: insets.bottom + 40,
        }}
      >
      {/* Stats — two-row card. Top: the hero (month duration) on the
          left, month nav on the right (where sessions+active used to
          sit). Bottom: only the interesting metrics — sessions, active
          days, longest single sit. Best day and avg dropped: best day
          is redundant with the hero on sparse months, avg is derived. */}
      <Animated.View
        entering={FadeIn.delay(100).duration(400)}
        style={[styles.statsBlock, { paddingTop: insets.top + 12 }]}
      >
        {/* Animated bg layer — theme-aware tint that fades in as the
            user scrolls. Sits absolute behind the content. */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { backgroundColor: cardBg }, cardBgStyle]}
        />
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
            <Text style={[styles.closeText, { color: theme.textSecondary }]}>{'✕'}</Text>
          </Pressable>
        </View>

        {/* Top row — two parallel headlines: "this month" duration
            (big terracotta hero) on the left, lifetime "total time"
            (medium hero) on the right, separated by a hairline. */}
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
            <Text style={[styles.statLabel, { color: theme.textSecondary, fontFamily: Fonts.serif, marginTop: 6 }]}>
              {heroLabel}
            </Text>
          </View>

          {/* Right side — a quiet motivational phrase instead of a
              second metric. Echoes the app's "do nothing" tone: every
              minute the user spends in stillness is meaningful, even
              if the totals look small. */}
          <View style={styles.statCellQuote}>
            <Text style={[styles.quotePhrase, { color: theme.text, fontFamily: Fonts.serif }]}>
              {'every minute\nmatters'}
            </Text>
          </View>
        </View>

        <View style={[styles.statsRowDivider, { backgroundColor: theme.border }]} />

        <View style={styles.statsRow}>
          <View style={styles.statCellSecondary}>
            <Text style={[styles.statValueSm, { color: theme.text, fontFamily: Fonts.mono }]}>
              {monthSessions}
            </Text>
            <View style={styles.statLabelRow}>
              <Feather name="hash" size={10} color={palette.terracotta} />
              <Text style={[styles.statLabelSm, { color: theme.textSecondary, fontFamily: Fonts.serif }]}>
                {monthSessions === 1 ? 'session' : 'sessions'}
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
                avg session
              </Text>
            </View>
          </View>

          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />

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
        </View>
      </Animated.View>

      {/* Month switcher — sits flush under the card as a narrow pill
          with the same warm-cream fill, so it reads as part of the
          same panel (a tab hanging out from the bottom). Top corners
          square (attached), bottom corners rounded (free). */}
      <View style={styles.monthPillRow}>
        <View style={[styles.monthPill, { overflow: 'hidden' }]}>
          {/* Animated bg layer — same fade as the card above, so the
              pill reads as a connected piece of the same panel. */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: cardBg }, cardBgStyle]}
          />
          <Pressable onPress={goToPrevMonth} hitSlop={16} style={styles.monthPillBtn}>
            <Feather name="chevron-left" size={18} color={theme.textSecondary} />
          </Pressable>
          <Text style={[styles.monthPillLabel, { color: theme.text, fontFamily: Fonts.serif }]}>
            {monthLabel}
          </Text>
          <Pressable
            onPress={goToNextMonth}
            hitSlop={16}
            disabled={isCurrentMonth}
            style={styles.monthPillBtn}
          >
            <Feather
              name="chevron-right"
              size={18}
              color={isCurrentMonth ? theme.border : theme.textSecondary}
            />
          </Pressable>
        </View>
      </View>

      {/* Below-card content — restored horizontal padding so the
          calendar/footer stay at the page's normal gutter. */}
      <View style={styles.belowCard}>
        {/* Hairline between stats and calendar */}
        <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />

        {/* Calendar */}
        <ActivityCalendar
          theme={theme}
          viewYear={viewYear}
          viewMonth={viewMonth}
          durationMap={monthDurationMap}
        />

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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 38 },
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
  // Full-bleed top hero block. Touches the safe area edge; flat
  // rectangle (no rounded corners). Background fills via an absolute
  // animated layer inside (cardBg + cardBgStyle) so it can fade in
  // with scroll.
  statsBlock: {
    paddingHorizontal: 24,
    paddingBottom: 22,
  },
  // Wrapper for everything below the full-bleed card — restores the
  // page's normal horizontal gutter for calendar and footer.
  belowCard: {
    paddingHorizontal: 24,
  },
  // Hero block — full-width container so the label row beneath the
  // hero number can use space-between for "this month" + "total time".
  heroBlock: {
    width: '100%',
  },
  // Bottom of the hero: tag (icon + month) on the left, "total time"
  // kicker on the right.
  heroLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  heroSectionLabel: {
    fontSize: 12,
    fontWeight: '400',
    letterSpacing: 0.6,
  },
  // Month switcher pill — sits flush under the stats card on the
  // right side, sharing the warm-cream fill so it reads as a tab
  // hanging out of the same panel. Top corners square (attached to
  // the card's bottom edge), bottom corners rounded (free).
  monthPillRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: 24,
    marginBottom: 4,
  },
  // Pill body — applied with theme.subtle bg via style merge below
  // since StyleSheet can't read theme. See render-side spread.
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  monthPillBtn: {
    padding: 2,
  },
  monthPillLabel: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.2,
    minWidth: 56,
    textAlign: 'center',
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
    flex: 1,
    paddingRight: 14,
  },
  // Quote cell — sits where the second metric used to be. Short
  // italic serif phrase, centred both vertically (against the hero
  // on the left) and horizontally within the cell. `alignSelf:
  // stretch` overrides the row's flex-end alignment so the cell fills
  // the row height; `justifyContent: center` then centres the quote
  // vertically within that full height.
  statCellQuote: {
    flex: 1,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quotePhrase: {
    fontSize: 17,
    fontWeight: '400',
    fontStyle: 'italic',
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: 24,
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
  },
  // Horizontal hairline that visually separates the stats block above
  // from the calendar below. Subtle, no card fill — pure rule line.
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 24,
    opacity: 0.45,
  },

});

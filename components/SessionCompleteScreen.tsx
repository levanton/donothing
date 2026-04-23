import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Fonts } from '@/constants/theme';
import { palette, themes, type ThemeMode } from '@/lib/theme';
import MoodDial, { MOOD_DIAL_DISC_DURATION } from '@/components/MoodDial';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const CONTENT_FADE_MS = 500;

const grassImage = require('@/assets/images/sun.png');
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const GRASS_SIZE = Math.min(Math.round(SCREEN_H * 0.24), 220);

// Terracotta reveal disc — starts small at the done-button position and
// grows out to engulf the whole screen, inverting the palette. On close it
// shrinks back onto the yes button on the home screen so the handoff is
// seamless (the home yes button is already terracotta).
const SPLASH_ORIGIN_X = SCREEN_W / 2;
const SPLASH_MAX_SIZE = Math.hypot(SCREEN_W, SCREEN_H) * 2;
const YES_SIZE = 140;

// Body responds in stages. We tier the messaging so a 1-minute pause
// doesn't claim the same benefits as a 30-minute sit. Tiers are ordered
// longest-first; pickBenefits() walks the list and returns the first
// tier the duration crosses.
type Benefit = { icon: string; title: string; sub: string };

// Tiers ordered longest-first; pickBenefits walks the list and returns
// the first set the duration crosses. Minimum session is 1 minute, so
// the 60-second floor is the smallest tier we ever surface.
const BENEFIT_TIERS: Array<{ minSeconds: number; items: Benefit[] }> = [
  {
    minSeconds: 30 * 60,
    items: [
      { icon: 'sleep',           title: 'deep rest achieved',  sub: 'your brain fully recovered' },
      { icon: 'heart-pulse',     title: 'stress dissolved',    sub: 'cortisol back to baseline' },
      { icon: 'spa-outline',     title: 'emotions settled',    sub: 'amygdala calmed down' },
      { icon: 'lightbulb-on',    title: 'creativity unlocked', sub: 'new neural connections forming' },
      { icon: 'archive-outline', title: 'memory consolidated', sub: "today's experiences organized" },
      { icon: 'eye-outline',     title: 'mind cleared',        sub: 'thinking at full capacity' },
    ],
  },
  {
    minSeconds: 20 * 60,
    items: [
      { icon: 'sleep',          title: 'deep rest achieved',  sub: 'equivalent to a power nap' },
      { icon: 'heart-pulse',    title: 'stress dissolved',    sub: 'cortisol back to baseline' },
      { icon: 'spa-outline',    title: 'emotions settled',    sub: 'amygdala activity reduced' },
      { icon: 'lightning-bolt', title: 'focus sharpened',     sub: 'deep attention back online' },
      { icon: 'lightbulb-on',   title: 'creativity unlocked', sub: 'new neural connections forming' },
    ],
  },
  {
    minSeconds: 15 * 60,
    items: [
      { icon: 'heart',          title: 'cortisol dropped',     sub: 'stress hormones significantly down' },
      { icon: 'lightning-bolt', title: 'focus sharpened',      sub: 'attention back online' },
      { icon: 'compass',        title: 'clearer decisions',    sub: 'working memory clear' },
      { icon: 'brain',          title: 'your brain recharged', sub: 'default mode network online' },
      { icon: 'lightbulb-on',   title: 'creativity unlocked',  sub: 'new neural connections forming' },
    ],
  },
  {
    minSeconds: 10 * 60,
    items: [
      { icon: 'heart',          title: 'cortisol dropped',     sub: 'stress hormones easing' },
      { icon: 'lightning-bolt', title: 'focus sharpened',      sub: 'attention coming back' },
      { icon: 'compass',        title: 'clearer decisions',    sub: 'working memory clear' },
      { icon: 'brain',          title: 'your brain recharged', sub: 'default mode network online' },
    ],
  },
  {
    minSeconds: 5 * 60,
    items: [
      { icon: 'heart',          title: 'cortisol dropped',     sub: 'stress hormones easing' },
      { icon: 'lightning-bolt', title: 'focus sharpened',      sub: 'attention coming back' },
      { icon: 'brain',          title: 'your brain recharged', sub: 'default mode network online' },
    ],
  },
  {
    minSeconds: 3 * 60,
    items: [
      { icon: 'weather-windy', title: 'your breath slowed',        sub: 'nervous system calming down' },
      { icon: 'heart',         title: 'cortisol started dropping', sub: 'stress hormones easing' },
      { icon: 'eye-outline',   title: 'attention returning',       sub: 'your brain got a breath' },
    ],
  },
  {
    minSeconds: 60,
    items: [
      { icon: 'weather-windy', title: 'your breath slowed', sub: 'nervous system starting to calm' },
      { icon: 'pause-circle',  title: 'the rush stopped',   sub: 'stress loop interrupted' },
    ],
  },
];

function pickBenefits(seconds: number): Benefit[] {
  for (const tier of BENEFIT_TIERS) {
    if (seconds >= tier.minSeconds) return tier.items;
  }
  return BENEFIT_TIERS[BENEFIT_TIERS.length - 1].items;
}

// Same proportions as the Paywall FeatureCarousel — small narrow
// cards with alternating colored backgrounds.
const BENEFIT_CARD_W = 150;
const BENEFIT_CARD_H = 240;
const BENEFIT_CARD_GAP = 12;

// 6-tone warm-earth palette — refined Mediterranean ceramic feel.
// Order alternates light and dark so neighbouring cards contrast.
const BENEFIT_VARIANTS: Array<{ bg: string; fg: string }> = [
  { bg: '#F0E0BD', fg: palette.brown }, // 0: warm cream (light)
  { bg: '#5C2F2F', fg: palette.cream }, // 1: deep wine (dark)
  { bg: '#C5A572', fg: palette.brown }, // 2: antique gold (light pop)
  { bg: '#7E3A24', fg: palette.cream }, // 3: rich auburn (mid)
  { bg: '#E8B89A', fg: palette.brown }, // 4: peach blush (light)
  { bg: '#3D2516', fg: palette.cream }, // 5: dark cocoa (darkest)
];

function BenefitCard({ item, index }: { item: Benefit; index: number }) {
  const variant = BENEFIT_VARIANTS[index % BENEFIT_VARIANTS.length];
  return (
    <View style={[styles.benefitCardSlide, { backgroundColor: variant.bg }]}>
      <View style={styles.benefitIconWrap}>
        <View style={[styles.benefitIconHalo, { backgroundColor: `${variant.fg}22` }]} />
        <MaterialCommunityIcons name={item.icon as any} size={48} color={variant.fg} />
      </View>
      <Text style={[styles.benefitLabel, { color: variant.fg }]}>
        {item.title}
      </Text>
    </View>
  );
}

interface Props {
  visible: boolean;
  sessionId: string;
  durationSeconds: number;
  todaySeconds: number;
  themeMode: ThemeMode;
  yesBtnRect?: { x: number; y: number; w: number; h: number } | null;
  onClose: () => void;
}

type Locale = 'en' | 'uk';

function pluralizeMinutes(n: number, locale: Locale): string {
  if (locale === 'uk') {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return 'хвилин';
    if (mod10 === 1) return 'хвилина';
    if (mod10 >= 2 && mod10 <= 4) return 'хвилини';
    return 'хвилин';
  }
  return 'min';
}

function formatMinutes(seconds: number, locale: Locale = 'en'): { value: string; unit: string } {
  const m = Math.max(1, Math.round(seconds / 60));
  return { value: String(m), unit: pluralizeMinutes(m, locale) };
}

function SessionCompleteScreen({
  visible,
  sessionId,
  durationSeconds,
  todaySeconds,
  themeMode,
  yesBtnRect,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const isDark = themeMode === 'dark';
  const theme = themes[themeMode];

  const contentOpacity = useSharedValue(0);

  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.94);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(14);
  const titleScale = useSharedValue(0.96);
  const subtitleOpacity = useSharedValue(0);
  const subtitleY = useSharedValue(12);
  const circleBlockOpacity = useSharedValue(0);
  const circleBlockY = useSharedValue(12);
  const closeOpacity = useSharedValue(0);
  const closeY = useSharedValue(14);
  const benefitsOpacity = useSharedValue(0);
  const splashSize = useSharedValue(0);
  const splashCx = useSharedValue(SPLASH_ORIGIN_X);
  const splashCy = useSharedValue(SCREEN_H);

  const [hasInteracted, setHasInteracted] = useState(false);
  const [revealDial, setRevealDial] = useState(false);
  const [phase, setPhase] = useState<'benefits' | 'mood'>('benefits');

  const benefits = useMemo(() => pickBenefits(durationSeconds), [durationSeconds]);
  const revealTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const statusStyle: 'light' | 'dark' = isDark ? 'light' : 'dark';

  const dismissingRef = useRef(false);
  const prevVisibleRef = useRef(false);

  // Reset React state SYNCHRONOUSLY during render the moment visible
  // flips — otherwise the first paint after re-entry uses the previous
  // session's state and the re-open animations never show.
  if (visible && !prevVisibleRef.current) {
    prevVisibleRef.current = true;
    setHasInteracted(false);
    setRevealDial(false);
    setPhase('benefits');
  } else if (!visible && prevVisibleRef.current) {
    prevVisibleRef.current = false;
    setHasInteracted(false);
    setRevealDial(false);
    setPhase('benefits');
  }

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      setHasInteracted(false);
      setRevealDial(false);
      setPhase('benefits');
  
      // Hard-reset every piece first so nothing lingers from a previous
      // session — especially the done button, which must always start
      // hidden when the user lands on this screen.
      closeOpacity.value = 0;
      closeY.value = 14;
      benefitsOpacity.value = 0;
      splashSize.value = 0;
      splashCx.value = SPLASH_ORIGIN_X;
      splashCy.value = SCREEN_H - insets.bottom - 68;
      revealTimersRef.current.forEach(clearTimeout);
      revealTimersRef.current = [];

      // When the screen opens right after a timer ends, the JS thread is
      // briefly busy with DB writes, notification cleanup and week-stats
      // recompute. Giving every intro animation a short head-start keeps
      // the first frames from looking rushed — the splash doesn't begin
      // until that work has settled.
      const INTRO_DELAY = 240;
      splashSize.value = withDelay(
        INTRO_DELAY,
        withTiming(SPLASH_MAX_SIZE, { duration: 820, easing: EASE_OUT }),
      );
      contentOpacity.value = withDelay(
        INTRO_DELAY,
        withTiming(1, { duration: CONTENT_FADE_MS + 120, easing: EASE_OUT }),
      );

      // Beat 1 only here: title + benefits cascade in, then a "next" pill
      // fades in at the bottom. Beat 2 (prompt + dial) is gated on the user
      // tapping next — handleNext drives that transition.
      const base = INTRO_DELAY + 440;
      glowOpacity.value = withDelay(base, withTiming(1, { duration: 1400, easing: EASE_OUT }));
      glowScale.value = withDelay(base, withTiming(1, { duration: 1400, easing: EASE_OUT }));

      titleOpacity.value = withDelay(base, withTiming(1, { duration: 1100, easing: EASE_OUT }));
      titleY.value = withDelay(base, withTiming(0, { duration: 1100, easing: EASE_OUT }));
      titleScale.value = withDelay(base, withTiming(1, { duration: 1200, easing: EASE_OUT }));

      subtitleOpacity.value = withDelay(base + 500, withTiming(1, { duration: 850, easing: EASE_OUT }));
      subtitleY.value = withDelay(base + 500, withTiming(0, { duration: 850, easing: EASE_OUT }));

      // Benefits slider fades in as a single unit — no per-card cascade
      // needed since cards live side-by-side and only one is visible at
      // a time.
      const BENEFITS_START = base + 700;
      benefitsOpacity.value = withDelay(BENEFITS_START, withTiming(1, { duration: 500, easing: EASE_OUT }));

      // "next" pill (driven by closeOpacity — same slot will later host
      // the "done" pill after the user interacts with the dial). Lands a
      // moment after the slider settles so the user sees a card first.
      const NEXT_SHOW = BENEFITS_START + 1100;
      closeOpacity.value = withDelay(NEXT_SHOW, withTiming(1, { duration: 500, easing: EASE_OUT }));
      closeY.value = withDelay(NEXT_SHOW, withTiming(0, { duration: 500, easing: EASE_OUT }));

    } else {
      contentOpacity.value = 0;
      glowOpacity.value = 0;
      glowScale.value = 0.94;
      titleOpacity.value = 0;
      titleY.value = 14;
      titleScale.value = 0.96;
      subtitleOpacity.value = 0;
      subtitleY.value = 12;
      circleBlockOpacity.value = 0;
      circleBlockY.value = 12;
      closeOpacity.value = 0;
      closeY.value = 14;
      benefitsOpacity.value = 0;
      splashSize.value = 0;
      revealTimersRef.current.forEach(clearTimeout);
      revealTimersRef.current = [];
      setHasInteracted(false);
      setRevealDial(false);
    }
  }, [visible]);

  const handleDialInteract = useCallback(() => {
    setHasInteracted(true);
  }, []);

  // Once the user touches the first ring, fade in the done pill. Only
  // fires in the mood phase — during the benefits phase the bottom slot
  // hosts the "next" pill instead.
  useEffect(() => {
    if (!hasInteracted || phase !== 'mood') return;
    closeOpacity.value = withTiming(1, { duration: 520, easing: EASE_OUT });
    closeY.value = withTiming(0, { duration: 520, easing: EASE_OUT });
  }, [hasInteracted, phase]);

  const handleNext = useCallback(() => {
    Haptics.selectionAsync();
    // Beat 1 → Beat 2 transition. Fade out benefits and the next pill,
    // then swap the slot's content to "done" (still invisible) and fade
    // in prompt + dial.
    benefitsOpacity.value = withTiming(0, { duration: 450, easing: EASE_OUT });
    closeOpacity.value = withTiming(0, { duration: 350, easing: EASE_OUT });
    closeY.value = withTiming(14, { duration: 350, easing: EASE_OUT });

    const t1 = setTimeout(() => {
      setPhase('mood');
      circleBlockOpacity.value = withTiming(1, { duration: 700, easing: EASE_OUT });
      circleBlockY.value = withTiming(0, { duration: 700, easing: EASE_OUT });
    }, 380);
    const t2 = setTimeout(() => setRevealDial(true), 380 + 400);
    revealTimersRef.current.push(t1, t2);
  }, []);

  const handleClose = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    Haptics.selectionAsync();

    // Collapse the terracotta disc back onto the home-screen yes button —
    // same shape, same colour, so the handoff is seamless (mirrors the
    // launch splash). If we don't have a measured yes button yet, just
    // shrink to 0 at the current origin.
    const duration = 540;
    if (yesBtnRect) {
      splashCx.value = withTiming(yesBtnRect.x + yesBtnRect.w / 2, { duration, easing: EASE_OUT });
      splashCy.value = withTiming(yesBtnRect.y + yesBtnRect.h / 2, { duration, easing: EASE_OUT });
      splashSize.value = withTiming(YES_SIZE, { duration, easing: EASE_OUT });
    } else {
      splashSize.value = withTiming(0, { duration, easing: EASE_OUT });
    }

    contentOpacity.value = withTiming(0, { duration: 420, easing: EASE_OUT });
    setTimeout(onClose, duration + 20);
  }, [onClose, yesBtnRect]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    pointerEvents: contentOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  const splashAnimStyle = useAnimatedStyle(() => {
    const size = splashSize.value;
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      left: splashCx.value - size / 2,
      top: splashCy.value - size / 2,
    };
  });
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }, { scale: titleScale.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleY.value }],
  }));
  const circleBlockStyle = useAnimatedStyle(() => ({
    opacity: circleBlockOpacity.value,
    transform: [{ translateY: circleBlockY.value }],
  }));
  const closeStyleAnim = useAnimatedStyle(() => ({
    opacity: closeOpacity.value,
    transform: [{ translateY: closeY.value }],
    pointerEvents: closeOpacity.value > 0.5 ? 'auto' : 'none',
  }));
  const benefitsWrapStyle = useAnimatedStyle(() => ({
    opacity: benefitsOpacity.value,
  }));
  const glowWrapStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));


  if (!visible) return null;

  // Screen bg is terracotta, so title / prompt / subtitle / hint (all
  // drawn on that bg) stay cream. The mood circle has flipped: the canvas
  // disc is cream and the user-driven fill is terracotta, so the ring
  // Screen bg is terracotta, so title / prompt / subtitle / hint stay
  // cream. Ring strokes and ring labels stay dark on the cream disc — no
  // colour switch when the fill crosses them.
  const textColor = palette.cream;
  const softText = 'rgba(249, 242, 224, 0.85)';

  const duration = formatMinutes(durationSeconds);
  const today = formatMinutes(todaySeconds);

  return (
    <View style={styles.root}>
      <StatusBar style={statusStyle} />

      {/* Terracotta reveal disc grows from the done-button position to
          cover the screen before any content fades in. */}
      <Animated.View pointerEvents="none" style={[styles.splashCircle, splashAnimStyle]} />

      {/* Content layer — transparent, lives on top of the terracotta disc */}
      <Animated.View style={[StyleSheet.absoluteFillObject, contentStyle]}>
        <View
          style={[
            styles.layout,
            { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 40 },
          ]}
        >
          <View style={styles.centerGroup}>
            <View style={styles.summary}>
              <Animated.View style={[styles.grassWrap, glowWrapStyle]} pointerEvents="none">
                <Image source={grassImage} style={styles.grassImage} fadeDuration={0} />
              </Animated.View>

              <Animated.View style={[styles.titleBlock, titleStyle]}>
                <Text style={[styles.titleNumeral, { color: textColor }]}>
                  {duration.value}
                </Text>
                <Text style={[styles.titleUnit, { color: textColor, fontFamily: Fonts.serif }]}>
                  {duration.unit}
                </Text>
                <Text style={[styles.titleSub, { color: textColor, fontFamily: Fonts.serif }]}>
                  with yourself
                </Text>
              </Animated.View>

              {todaySeconds > durationSeconds && (
                <Animated.Text
                  style={[
                    styles.subtitle,
                    { color: softText, fontFamily: Fonts.serif },
                    subtitleStyle,
                  ]}
                >
                  {`today, that's `}
                  <Text style={styles.subtitleNumeral}>{today.value}</Text>
                  {` ${today.unit}`}
                </Animated.Text>
              )}
            </View>

            <View style={styles.interaction}>
              {/* Beat 2: prompt + dial. Sits in normal flow; benefits
                  layer below overlays this space until it fades out. */}
              <Animated.View style={[styles.promptBlock, circleBlockStyle]}>
                <Text style={[styles.headerChip, { fontFamily: Fonts.serif }]}>
                  how full do you feel
                </Text>
              </Animated.View>

              <MoodDial
                visible={visible}
                reveal={revealDial}
                sessionId={sessionId}
                onInteract={handleDialInteract}
              />

              {/* Beat 1: benefits overlay — absolute so it sits on top of
                  the dial space without pushing layout around. Fades out
                  as Beat 2 fades in. */}
              <Animated.View
                style={[styles.benefitsLayer, benefitsWrapStyle]}
                pointerEvents={phase === 'benefits' ? 'auto' : 'none'}
              >
                <Text style={[styles.headerChip, { fontFamily: Fonts.serif }]}>
                  what changed
                </Text>
                <View style={{ height: BENEFIT_CARD_H }}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    bounces={false}
                    decelerationRate="fast"
                    snapToInterval={BENEFIT_CARD_W + BENEFIT_CARD_GAP}
                    contentContainerStyle={styles.benefitsSliderContent}
                  >
                    {benefits.map((b, i) => (
                      <BenefitCard key={b.title} item={b} index={i} />
                    ))}
                  </ScrollView>
                </View>
              </Animated.View>
            </View>
          </View>

          <Animated.View style={closeStyleAnim}>
            <Pressable onPress={phase === 'benefits' ? handleNext : handleClose}>
              <View style={[styles.doneBtn, { backgroundColor: palette.cream }]}>
                <Text style={[styles.doneLabel, { color: palette.brown, fontFamily: Fonts.serif }]}>
                  {phase === 'benefits' ? 'next' : 'done'}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

export default memo(SessionCompleteScreen);

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
    overflow: 'hidden',
  },
  splashCircle: {
    position: 'absolute',
    backgroundColor: palette.terracotta,
  },
  layout: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  centerGroup: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    alignItems: 'center',
  },
  grassWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  grassImage: {
    width: GRASS_SIZE,
    // sun.png is 780×450, so use its native aspect ratio instead of a
    // square — otherwise contain leaves blank vertical space that reads
    // as an awkward gap between the image and the title below.
    height: GRASS_SIZE * (450 / 780),
    resizeMode: 'contain',
  },
  titleBlock: {
    alignItems: 'center',
  },
  titleNumeral: {
    fontSize: 100,
    fontFamily: Fonts.mono,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    lineHeight: 104,
  },
  titleUnit: {
    fontSize: 26,
    fontWeight: '400',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: -10,
  },
  subtitleNumeral: {
    fontFamily: Fonts.mono,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  titleSub: {
    fontSize: 18,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 6,
    // Italic `f` in "yourself" clips on the right without a trailing pad.
    paddingHorizontal: 6,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginTop: 22,
  },
  interaction: {
    width: '100%',
    alignItems: 'center',
    marginTop: 36,
    position: 'relative',
  },
  benefitsLayer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -32,
    right: -32,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  benefitsSliderContent: {
    paddingHorizontal: 32,
    gap: BENEFIT_CARD_GAP,
    alignItems: 'center',
  },
  benefitCardSlide: {
    width: BENEFIT_CARD_W,
    height: BENEFIT_CARD_H,
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  benefitIconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitIconHalo: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  benefitLabel: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  headerChip: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.brown,
    backgroundColor: palette.cream,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    overflow: 'hidden',
    marginBottom: 16,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  benefitTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 0.1,
    color: palette.brown,
    lineHeight: 32,
  },
  benefitSub: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
    color: palette.brown,
    lineHeight: 22,
  },
  promptBlock: {
    alignItems: 'center',
    marginBottom: 14,
  },
  promptDivider: {
    width: 36,
    height: 1,
    backgroundColor: 'rgba(249, 242, 224, 0.35)',
    marginBottom: 14,
  },
  prompt: {
    fontSize: 17,
    fontWeight: '400',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  doneBtn: {
    borderRadius: 100,
    paddingVertical: 18,
    paddingHorizontal: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  doneLabel: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
});

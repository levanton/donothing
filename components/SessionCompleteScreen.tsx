import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { haptics } from '@/lib/haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Feather } from '@expo/vector-icons';

import { Fonts } from '@/constants/theme';
import { palette, themes, getStatusBarStyle, type ThemeMode } from '@/lib/theme';
import MoodDial, { MOOD_DIAL_DISC_DURATION } from '@/components/MoodDial';


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

// Benefit tier copy + icons live in lib/benefits — the post-session
// screen pulls from there so any other surface (paywall, onboarding,
// reminder card, etc.) can render the same list without duplicating
// the data.
import { pickBenefits } from '@/lib/benefits';
import BenefitCard, {
  BENEFIT_CARD_W,
  BENEFIT_CARD_H,
  BENEFIT_CARD_GAP,
} from '@/components/session-complete/BenefitCard';

interface Props {
  visible: boolean;
  sessionId: string;
  durationSeconds: number;
  todaySeconds: number;
  themeMode: ThemeMode;
  yesBtnRect?: { x: number; y: number; w: number; h: number } | null;
  /** Closes the screen without releasing apps. */
  onClose: () => void;
  /** Optional secondary CTA — closes the screen AND unblocks apps. Shown
      on the farewell phase as "unlock your apps" when provided. */
  onUnlock?: () => void;
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
  onUnlock,
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
  const closeBtnScale = useSharedValue(1);
  const farewellOpacity = useSharedValue(0);
  const farewellY = useSharedValue(12);
  // Title pieces stagger so the numeral lands first, the unit a beat
  // later, then `with yourself` settles in. Without this they all
  // share titleStyle and read as a single opaque block plopping in.
  const titleUnitOp = useSharedValue(0);
  const titleUnitY = useSharedValue(8);
  const titleSubOp = useSharedValue(0);
  const titleSubY = useSharedValue(10);
  // Benefits-phase header `what changed` rises just before the cards
  // cascade in, so the eye lands on the heading first.
  const benefitsHeaderOp = useSharedValue(0);
  const benefitsHeaderY = useSharedValue(8);
  // Mood-phase header `how full do you feel` gets its own gentle rise
  // so it doesn't blink on with the dial — the heading lands first,
  // the dial reveals a beat later.
  const moodHeaderOp = useSharedValue(0);
  const moodHeaderY = useSharedValue(8);
  // Per-element farewell stagger — eyebrow, title, divider, sub, chip
  // and the continue pill each rise + fade in on their own delay so
  // the screen reads as it composes itself piece by piece, not as
  // one block dropping in.
  const fwEyebrowOp = useSharedValue(0);
  const fwEyebrowY = useSharedValue(10);
  const fwTitleOp = useSharedValue(0);
  const fwTitleY = useSharedValue(14);
  const fwTitleScale = useSharedValue(0.94);
  const fwDividerOp = useSharedValue(0);
  const fwDividerW = useSharedValue(0);
  const fwSubOp = useSharedValue(0);
  const fwSubY = useSharedValue(10);
  const fwChipOp = useSharedValue(0);
  const fwChipY = useSharedValue(10);
  const fwContinueOp = useSharedValue(0);
  const fwContinueY = useSharedValue(12);
  const mainContentOpacity = useSharedValue(1);
  const benefitsOpacity = useSharedValue(0);
  const splashSize = useSharedValue(0);
  const splashCx = useSharedValue(SPLASH_ORIGIN_X);
  const splashCy = useSharedValue(SCREEN_H);
  // Slides the sun image down from its mood-screen perch to the
  // farewell-layout anchor while the rings fold up. Title fades alone;
  // only the sun rides this value.
  const sunTranslateY = useSharedValue(0);

  const [hasInteracted, setHasInteracted] = useState(false);
  const [revealDial, setRevealDial] = useState(false);
  const [phase, setPhase] = useState<'benefits' | 'mood' | 'farewell'>('benefits');
  const [dialCollapsing, setDialCollapsing] = useState(false);
  // Drives BenefitCard cascade — flipped true once the benefits layer
  // has started fading in, so cards rise just behind it.
  const [benefitsRevealed, setBenefitsRevealed] = useState(false);

  // Refs on the two sun renders so we can measure the live delta for
  // the sun's mood→farewell glide. Farewell sun is rendered always but
  // hidden — it exists purely to anchor where the moving sun should land.
  const mainSunRef = useRef<View | null>(null);
  const farewellSunRef = useRef<View | null>(null);

  const benefits = useMemo(() => pickBenefits(durationSeconds), [durationSeconds]);
  const revealTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const statusStyle = getStatusBarStyle(isDark);

  const dismissingRef = useRef(false);
  const prevVisibleRef = useRef(false);
  const handleCloseRef = useRef<() => void>(() => {});

  // Reset React state SYNCHRONOUSLY during render the moment visible
  // flips — otherwise the first paint after re-entry uses the previous
  // session's state and the re-open animations never show.
  if (visible && !prevVisibleRef.current) {
    prevVisibleRef.current = true;
    setHasInteracted(false);
    setRevealDial(false);
    setPhase('benefits');
    setDialCollapsing(false);
  } else if (!visible && prevVisibleRef.current) {
    prevVisibleRef.current = false;
    setHasInteracted(false);
    setRevealDial(false);
    setPhase('benefits');
    setDialCollapsing(false);
  }

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      setHasInteracted(false);
      setRevealDial(false);
      setPhase('benefits');
      setDialCollapsing(false);

      // Hard-reset every piece first so nothing lingers from a previous
      // session — especially the done button, which must always start
      // hidden when the user lands on this screen.
      closeOpacity.value = 0;
      closeY.value = 14;
      closeBtnScale.value = 1;
      farewellOpacity.value = 0;
      farewellY.value = 12;
      fwEyebrowOp.value = 0;
      fwEyebrowY.value = 10;
      fwTitleOp.value = 0;
      fwTitleY.value = 14;
      fwTitleScale.value = 0.94;
      fwDividerOp.value = 0;
      fwDividerW.value = 0;
      fwSubOp.value = 0;
      fwSubY.value = 10;
      fwChipOp.value = 0;
      fwChipY.value = 10;
      fwContinueOp.value = 0;
      fwContinueY.value = 12;
      titleUnitOp.value = 0;
      titleUnitY.value = 8;
      titleSubOp.value = 0;
      titleSubY.value = 10;
      benefitsHeaderOp.value = 0;
      benefitsHeaderY.value = 8;
      moodHeaderOp.value = 0;
      moodHeaderY.value = 8;
      setBenefitsRevealed(false);
      mainContentOpacity.value = 1;
      benefitsOpacity.value = 0;
      sunTranslateY.value = 0;
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

      // Numeral leads (it's the line that does the most work). Unit
      // follows ~200ms behind so it reads as `50 …` then `min`, not as
      // `50 min` plopping in whole. `with yourself` settles last.
      titleOpacity.value = withDelay(base, withTiming(1, { duration: 1100, easing: EASE_OUT }));
      titleY.value = withDelay(base, withTiming(0, { duration: 1100, easing: EASE_OUT }));
      titleScale.value = withDelay(base, withTiming(1, { duration: 1200, easing: EASE_OUT }));
      titleUnitOp.value = withDelay(base + 220, withTiming(1, { duration: 700, easing: EASE_OUT }));
      titleUnitY.value = withDelay(base + 220, withTiming(0, { duration: 700, easing: EASE_OUT }));
      titleSubOp.value = withDelay(base + 420, withTiming(1, { duration: 700, easing: EASE_OUT }));
      titleSubY.value = withDelay(base + 420, withTiming(0, { duration: 700, easing: EASE_OUT }));

      subtitleOpacity.value = withDelay(base + 700, withTiming(1, { duration: 700, easing: EASE_OUT }));
      subtitleY.value = withDelay(base + 700, withTiming(0, { duration: 700, easing: EASE_OUT }));

      // Benefits layer fades the whole block in; the header rises in
      // lockstep so the chip doesn't lag behind the wash. Cards wait
      // until the header has fully landed before cascading in — keeps
      // the order header → cards clean instead of overlapping.
      const BENEFITS_START = base + 700;
      benefitsOpacity.value = withDelay(BENEFITS_START, withTiming(1, { duration: 500, easing: EASE_OUT }));
      benefitsHeaderOp.value = withDelay(
        BENEFITS_START,
        withTiming(1, { duration: 480, easing: EASE_OUT }),
      );
      benefitsHeaderY.value = withDelay(
        BENEFITS_START,
        withTiming(0, { duration: 480, easing: EASE_OUT }),
      );
      const cardsTrigger = setTimeout(
        () => setBenefitsRevealed(true),
        BENEFITS_START + 380,
      );
      revealTimersRef.current.push(cardsTrigger);

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
      closeBtnScale.value = 1;
      farewellOpacity.value = 0;
      farewellY.value = 12;
      fwEyebrowOp.value = 0;
      fwEyebrowY.value = 10;
      fwTitleOp.value = 0;
      fwTitleY.value = 14;
      fwTitleScale.value = 0.94;
      fwDividerOp.value = 0;
      fwDividerW.value = 0;
      fwSubOp.value = 0;
      fwSubY.value = 10;
      fwChipOp.value = 0;
      fwChipY.value = 10;
      fwContinueOp.value = 0;
      fwContinueY.value = 12;
      titleUnitOp.value = 0;
      titleUnitY.value = 8;
      titleSubOp.value = 0;
      titleSubY.value = 10;
      benefitsHeaderOp.value = 0;
      benefitsHeaderY.value = 8;
      moodHeaderOp.value = 0;
      moodHeaderY.value = 8;
      benefitsOpacity.value = 0;
      sunTranslateY.value = 0;
      splashSize.value = 0;
      revealTimersRef.current.forEach(clearTimeout);
      revealTimersRef.current = [];
      setHasInteracted(false);
      setRevealDial(false);
      setDialCollapsing(false);
      setBenefitsRevealed(false);
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
    haptics.select();
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
      // The mood-phase heading rises a touch before the dial reveals,
      // so the eye lands on `how full do you feel` first instead of
      // catching the disc grow.
      moodHeaderOp.value = withTiming(1, { duration: 620, easing: EASE_OUT });
      moodHeaderY.value = withTiming(0, { duration: 620, easing: EASE_OUT });
    }, 380);
    const t2 = setTimeout(() => setRevealDial(true), 380 + 400);
    revealTimersRef.current.push(t1, t2);
  }, []);

  const handleUnlock = useCallback(() => {
    haptics.medium();

    // Beat 1 — fold the dial inward. MoodDial reverses its disc-grow
    // (rings retract toward centre, sage fill collapses, hint dissolves);
    // the prompt chip and unlock button fade in lockstep. The sun + title
    // stay still so the user has a stable anchor while the rings fold.
    setDialCollapsing(true);
    circleBlockOpacity.value = withTiming(0, { duration: 480, easing: EASE_OUT });
    closeOpacity.value = withTiming(0, { duration: 420, easing: EASE_OUT });
    closeY.value = withTiming(14, { duration: 420, easing: EASE_OUT });

    // Beat 2 — settle. Title + subtitle fade out, the sun glides down to
    // the farewell layout's hidden anchor, and the farewell texts fade
    // in around it. All three timings start from the SAME measureInWindow
    // callback so they share a start frame — kicking them off
    // synchronously around an async measure leaves a ~50ms gap that
    // shows up as the sun stuttering before it moves.
    const FOLD_MS = 420;
    const SETTLE_MS = 720;
    const t1 = setTimeout(() => {
      titleOpacity.value = withTiming(0, { duration: 360, easing: EASE_OUT });
      subtitleOpacity.value = withTiming(0, { duration: 360, easing: EASE_OUT });
      setPhase('farewell');

      // Snapshot farewellY's current value (still resting at +12 here)
      // so when measureInWindow returns we can subtract the same offset
      // we observe in `fy`. Once we kick off the withTiming below this
      // value will start animating, but the snapshot is what we need.
      const farewellRestingOffset = farewellY.value;

      const startTimings = (deltaY: number) => {
        sunTranslateY.value = withTiming(deltaY, { duration: SETTLE_MS, easing: EASE_OUT });
        farewellY.value = withTiming(0, { duration: SETTLE_MS, easing: EASE_OUT });
        farewellOpacity.value = withTiming(1, { duration: SETTLE_MS, easing: EASE_OUT });

        // Per-element cascade — each line of the farewell rises and
        // fades on its own delay so the screen reads as it composes
        // itself, not as one block dropping in. Times are relative to
        // the moment the sun starts gliding so the texts settle around
        // the sun as it lands.
        const RISE = 700;
        const ease = { easing: EASE_OUT };
        fwEyebrowOp.value = withDelay(120, withTiming(1, { duration: RISE, ...ease }));
        fwEyebrowY.value = withDelay(120, withTiming(0, { duration: RISE, ...ease }));

        fwTitleOp.value = withDelay(260, withTiming(1, { duration: RISE + 80, ...ease }));
        fwTitleY.value = withDelay(260, withTiming(0, { duration: RISE + 80, ...ease }));
        fwTitleScale.value = withDelay(260, withTiming(1, { duration: RISE + 200, ...ease }));

        fwDividerOp.value = withDelay(440, withTiming(1, { duration: 540, ...ease }));
        fwDividerW.value = withDelay(440, withTiming(1, { duration: 700, ...ease }));

        fwSubOp.value = withDelay(560, withTiming(1, { duration: RISE, ...ease }));
        fwSubY.value = withDelay(560, withTiming(0, { duration: RISE, ...ease }));

        fwChipOp.value = withDelay(740, withTiming(1, { duration: RISE, ...ease }));
        fwChipY.value = withDelay(740, withTiming(0, { duration: RISE, ...ease }));

        fwContinueOp.value = withDelay(960, withTiming(1, { duration: RISE, ...ease }));
        fwContinueY.value = withDelay(960, withTiming(0, { duration: RISE, ...ease }));
      };

      const fallback = SCREEN_H * 0.2;
      const main = mainSunRef.current;
      const farewell = farewellSunRef.current;
      if (main && farewell) {
        main.measureInWindow((_mx, my) => {
          farewell.measureInWindow((_fx, fy) => {
            const d = (fy ?? 0) - (my ?? 0) - farewellRestingOffset;
            if (!Number.isFinite(d) || d <= 0) {
              console.warn('[SessionComplete] sun glide measure invalid', { my, fy, d });
              startTimings(fallback);
            } else {
              startTimings(d);
            }
          });
        });
      } else {
        startTimings(fallback);
      }
    }, FOLD_MS);

    revealTimersRef.current.push(t1);
  }, []);

  // Keep handleCloseRef in sync so handleUnlock (memoized with [])
  // always invokes the LATEST handleClose — otherwise it'd capture the
  // first render's version, when yesBtnRect was still null, and the
  // splash would shrink to 0 instead of collapsing onto the yes button.
  const handleClose = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    haptics.select();

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

  handleCloseRef.current = handleClose;

  // Same animation as handleClose, but fires the optional onUnlock first
  // (e.g. forceUnblockAll for block-flow sessions). Used by the secondary
  // "unlock your apps" pill on the farewell phase.
  const handleCloseAndUnlock = useCallback(() => {
    if (dismissingRef.current) return;
    haptics.success();
    onUnlock?.();
    handleCloseRef.current();
  }, [onUnlock]);

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
    transform: [{ translateY: closeY.value }, { scale: closeBtnScale.value }],
    pointerEvents: closeOpacity.value > 0.5 ? 'auto' : 'none',
  }));
  const farewellStyle = useAnimatedStyle(() => ({
    opacity: farewellOpacity.value,
    transform: [{ translateY: farewellY.value }],
  }));
  const fwEyebrowStyle = useAnimatedStyle(() => ({
    opacity: fwEyebrowOp.value,
    transform: [{ translateY: fwEyebrowY.value }],
  }));
  const fwTitleStyle = useAnimatedStyle(() => ({
    opacity: fwTitleOp.value,
    transform: [
      { translateY: fwTitleY.value },
      { scale: fwTitleScale.value },
    ],
  }));
  const fwDividerStyle = useAnimatedStyle(() => ({
    opacity: fwDividerOp.value,
    transform: [{ scaleX: fwDividerW.value }],
  }));
  const fwSubStyle = useAnimatedStyle(() => ({
    opacity: fwSubOp.value,
    transform: [{ translateY: fwSubY.value }],
  }));
  const fwChipStyle = useAnimatedStyle(() => ({
    opacity: fwChipOp.value,
    transform: [{ translateY: fwChipY.value }],
  }));
  const fwContinueStyle = useAnimatedStyle(() => ({
    opacity: fwContinueOp.value,
    transform: [{ translateY: fwContinueY.value }],
  }));
  const benefitsHeaderStyle = useAnimatedStyle(() => ({
    opacity: benefitsHeaderOp.value,
    transform: [{ translateY: benefitsHeaderY.value }],
  }));
  const moodHeaderStyle = useAnimatedStyle(() => ({
    opacity: moodHeaderOp.value,
    transform: [{ translateY: moodHeaderY.value }],
  }));
  const titleUnitStyle = useAnimatedStyle(() => ({
    opacity: titleUnitOp.value,
    transform: [{ translateY: titleUnitY.value }],
  }));
  const titleSubStyle = useAnimatedStyle(() => ({
    opacity: titleSubOp.value,
    transform: [{ translateY: titleSubY.value }],
  }));
  const mainContentStyle = useAnimatedStyle(() => ({
    opacity: mainContentOpacity.value,
  }));
  const benefitsWrapStyle = useAnimatedStyle(() => ({
    opacity: benefitsOpacity.value,
  }));
  const glowWrapStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [
      { translateY: sunTranslateY.value },
      { scale: glowScale.value },
    ],
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
        <Animated.View
          pointerEvents={phase === 'farewell' ? 'none' : 'auto'}
          style={[
            styles.layout,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 },
            mainContentStyle,
          ]}
        >
          <View style={styles.centerGroup}>
            <View style={styles.summary}>
              <Animated.View
                ref={mainSunRef as any}
                style={[styles.grassWrap, glowWrapStyle]}
                pointerEvents="none"
              >
                <Image source={grassImage} style={styles.grassImage} fadeDuration={0} />
              </Animated.View>

              <Animated.View style={[styles.titleBlock, titleStyle]}>
                <Text style={[styles.titleNumeral, { color: textColor }]}>
                  {duration.value}
                </Text>
                <Animated.Text
                  style={[
                    styles.titleUnit,
                    { color: textColor, fontFamily: Fonts.serif },
                    titleUnitStyle,
                  ]}
                >
                  {duration.unit}
                </Animated.Text>
                <Animated.Text
                  style={[
                    styles.titleSub,
                    { color: textColor, fontFamily: Fonts.serif },
                    titleSubStyle,
                  ]}
                >
                  with yourself
                </Animated.Text>
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
                <Animated.Text
                  style={[
                    styles.headerChip,
                    { fontFamily: Fonts.serif },
                    moodHeaderStyle,
                  ]}
                >
                  how full do you feel
                </Animated.Text>
              </Animated.View>

              <MoodDial
                visible={visible}
                reveal={revealDial}
                collapse={dialCollapsing}
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
                <Animated.Text
                  style={[
                    styles.headerChip,
                    { fontFamily: Fonts.serif },
                    benefitsHeaderStyle,
                  ]}
                >
                  what changed
                </Animated.Text>
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
                      <BenefitCard
                        key={b.title}
                        item={b}
                        index={i}
                        revealed={benefitsRevealed}
                      />
                    ))}
                  </ScrollView>
                </View>
              </Animated.View>

            </View>
          </View>

          <Animated.View style={closeStyleAnim}>
            <Pressable
              onPress={phase === 'benefits' ? handleNext : handleUnlock}
              onPressIn={() => {
                closeBtnScale.value = withTiming(0.94, { duration: 90, easing: EASE_OUT });
              }}
              onPressOut={() => {
                closeBtnScale.value = withTiming(1, { duration: 160, easing: EASE_OUT });
              }}
            >
              <View style={[styles.doneBtn, { backgroundColor: palette.cream }]}>
                <Text style={[styles.doneLabel, { color: palette.brown, fontFamily: Fonts.serif }]}>
                  {phase === 'benefits' ? 'next' : 'next'}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        </Animated.View>

        {/* Farewell beat — sole content during the farewell phase, lives
            above the faded-out main layer so nothing else is visible. */}
        <Animated.View
          style={[styles.farewellLayer, farewellStyle]}
          pointerEvents={phase === 'farewell' ? 'auto' : 'none'}
        >
          <View style={styles.farewellCenter}>
            {/* Hidden anchor — reserves the spot the moving sun glides
                into. The visible sun is the one in the main layout, kept
                mounted and translated down so the user perceives a single
                continuous element rather than a cross-fade. */}
            <View ref={farewellSunRef as any} style={styles.farewellSunAnchor} />

            <Animated.Text
              style={[
                styles.farewellEyebrow,
                { color: textColor, fontFamily: Fonts.serif },
                fwEyebrowStyle,
              ]}
            >
              see you tomorrow
            </Animated.Text>

            <Animated.Text
              style={[
                styles.farewellTitle,
                { color: textColor, fontFamily: Fonts.serif },
                fwTitleStyle,
              ]}
            >
              well done
            </Animated.Text>

            <Animated.View style={[styles.farewellDivider, fwDividerStyle]} />

            <Animated.Text
              style={[
                styles.farewellSub,
                { color: textColor, fontFamily: Fonts.serif },
                fwSubStyle,
              ]}
            >
              your apps are open again
            </Animated.Text>

            <Animated.View style={[styles.farewellChip, fwChipStyle]}>
              <Text style={[styles.farewellChipText, { fontFamily: Fonts.serif }]}>
                {duration.value} {duration.unit} • complete
              </Text>
            </Animated.View>
          </View>

          <Animated.View
            style={[
              styles.farewellContinue,
              { bottom: insets.bottom + 40 },
              fwContinueStyle,
            ]}
          >
            {onUnlock ? (
              <View style={styles.farewellButtonRow}>
                <Pressable
                  onPress={() => handleCloseRef.current()}
                  style={({ pressed }) => [
                    styles.farewellSecondaryBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={[styles.farewellSecondaryLabel, { color: palette.cream, fontFamily: Fonts.serif }]}>
                    just done
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleCloseAndUnlock}
                  style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                >
                  <View style={[styles.doneBtn, { backgroundColor: palette.cream }]}>
                    <Feather name="unlock" size={16} color={palette.terracotta} style={styles.doneIcon} />
                    <Text style={[styles.doneLabel, { color: palette.brown, fontFamily: Fonts.serif }]}>
                      unlock your apps
                    </Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => handleCloseRef.current()}
                style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
              >
                <View style={[styles.doneBtn, { backgroundColor: palette.cream }]}>
                  <Text style={[styles.doneLabel, { color: palette.brown, fontFamily: Fonts.serif }]}>
                    done
                  </Text>
                </View>
              </Pressable>
            )}
          </Animated.View>
        </Animated.View>
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
  headerChip: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.brown,
    backgroundColor: palette.cream,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    overflow: 'hidden',
    marginBottom: 27,
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
    flexDirection: 'row',
    borderRadius: 100,
    paddingVertical: 18,
    paddingHorizontal: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  doneIcon: {
    marginTop: 1,
  },
  doneLabel: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
  farewellLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  farewellCenter: {
    alignItems: 'center',
  },
  farewellContinue: {
    position: 'absolute',
    alignSelf: 'center',
  },
  // Two-button layout: secondary "just done" pill above the primary
  // "unlock your apps" pill. Stacking (rather than side-by-side) keeps
  // both buttons full-width, easy thumb targets in the bottom band.
  farewellButtonRow: {
    alignItems: 'center',
    gap: 14,
  },
  farewellSecondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  farewellSecondaryLabel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.4,
    opacity: 0.85,
  },
  farewellSun: {
    width: GRASS_SIZE * 1.1,
    height: GRASS_SIZE * 1.1 * (450 / 780),
    resizeMode: 'contain',
    marginBottom: 22,
  },
  // Same footprint as the moving main sun (no 1.1x scale) so when the
  // shared sun glides in, it covers the anchor exactly. Margin matches
  // the original farewell layout's sun→eyebrow gap.
  farewellSunAnchor: {
    width: GRASS_SIZE,
    height: GRASS_SIZE * (450 / 780),
    marginBottom: 22,
  },
  farewellEyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2.4,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  farewellTitle: {
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    lineHeight: 60,
    marginBottom: 20,
  },
  farewellDivider: {
    width: 44,
    height: 1.5,
    backgroundColor: palette.cream,
    marginBottom: 20,
    borderRadius: 1,
  },
  farewellSub: {
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 28,
  },
  farewellChip: {
    backgroundColor: palette.cream,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 100,
    overflow: 'hidden',
  },
  farewellChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.brown,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
});

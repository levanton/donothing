import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { haptics } from '@/lib/haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  type SharedValue,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

import { palette } from '@/lib/theme';
import { updateSessionMood } from '@/lib/db/sessions';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);

const MOODS = ['still', 'lighter', 'refreshed', 'full'] as const;
export type MoodKey = (typeof MOODS)[number];

const RING_COUNT = MOODS.length;
const RING_STEP = 28;
const RING_MAX = RING_STEP * RING_COUNT;
const RING_BOX_PAD = 28;
const LABEL_OUTSIDE = 5;
const RING_BOX_SIZE = (RING_MAX + RING_BOX_PAD) * 2;
const RING_CENTER = RING_BOX_SIZE / 2;
const DISC_MAX_R = RING_MAX + 24;
const FILL_MIN = 12;
// Sage fill reaches exactly the cream-disc edge at max drag — otherwise
// a thin cream halo peeks out around the sage when "full" is active.
const FILL_MAX = DISC_MAX_R;
const DRAG_TRAVEL = RING_MAX * 2;

// Soft sage-olive — a muted warm green that sits as a calm cool
// complement to the terracotta backdrop without going dramatic.
const FILL_COLOR = '#8FA07A';

// How long the disc takes to sweep from centre out to its max radius.
// Exported so the parent can time the hint fade-in to land right after
// the disc settles.
export const MOOD_DIAL_DISC_DURATION = 1300;
// Reverse animation when the parent flips `collapse`. Faster than the
// reveal — the user has already seen the dial, so a quick fold reads as
// "moving on" rather than "wait for me".
const MOOD_DIAL_COLLAPSE_DURATION = 540;

// 65% along the top arc — keeps the word anchored up-right of centre,
// where it used to live as a TextPath.
const ARC_OFFSET_FRACTION = 0.65;
// Angle from +x axis: top semicircle goes from 180° clockwise to 0°, so
// 65% along lands at (1 - 0.65) * 180° = 63°.
const ARC_ANGLE_RAD = (1 - ARC_OFFSET_FRACTION) * Math.PI;
// Growth as the word flies in. The base bump is modest (motion and
// straightening already carry most of the emphasis), but each mood
// gains an extra step per index so "full" arrives visibly larger than
// "still" at centre — otherwise all four moods read as roughly the
// same size once they're horizontal.
const CENTER_SIZE_BASE = 5;
const CENTER_SIZE_INDEX_STEP = 3;

// Approximate lowercase glyph widths for Georgia, expressed in ems.
// Per-character advance is needed because a uniform spacing either
// overlaps wide letters (r, h) or drifts apart on narrow ones (i, l, t).
// Values were hand-tuned against the four moods; unknown glyphs fall
// back to the default.
const GEORGIA_WIDTH_EMS: Record<string, number> = {
  a: 0.5,  b: 0.56, c: 0.48, d: 0.56, e: 0.5,
  f: 0.36, g: 0.52, h: 0.58, i: 0.3,  j: 0.32,
  k: 0.54, l: 0.3,  m: 0.84, n: 0.58, o: 0.52,
  p: 0.54, q: 0.54, r: 0.42, s: 0.44, t: 0.36,
  u: 0.58, v: 0.52, w: 0.8,  x: 0.52, y: 0.52,
  z: 0.48,
};
const DEFAULT_WIDTH_EM = 0.5;
const LETTER_GAP_PX = 0.5;

// Per-character static layout values: where each glyph sits at the arc
// seat (t=0) and where it lands at the centre seat (t=1). Both arc and
// centre offsets are precomputed once per mood so the morph itself is
// just two lerps + a rotation lerp on the UI thread — no per-frame
// width recomputation.
interface CharLayout {
  ch: string;
  arcX: number;
  arcY: number;
  arcRotDeg: number;
  centerX: number;
}

function buildOffsets(chars: string[], size: number): number[] {
  const widths = chars.map(
    (ch) => (GEORGIA_WIDTH_EMS[ch.toLowerCase()] ?? DEFAULT_WIDTH_EM) * size,
  );
  const totalWidth =
    widths.reduce((a, b) => a + b, 0) + (chars.length - 1) * LETTER_GAP_PX;
  const offsets: number[] = new Array(chars.length);
  let cursor = -totalWidth / 2;
  for (let i = 0; i < chars.length; i++) {
    cursor += widths[i] / 2;
    offsets[i] = cursor;
    cursor += widths[i] / 2 + LETTER_GAP_PX;
  }
  return offsets;
}

function computeCharLayouts(
  mood: string,
  arcR: number,
  arcSize: number,
  centerSize: number,
): CharLayout[] {
  const chars = mood.split('');
  const arcOffsets = buildOffsets(chars, arcSize);
  const centerOffsets = buildOffsets(chars, centerSize);
  return chars.map((ch, c) => {
    const arcAngle = ARC_ANGLE_RAD - arcOffsets[c] / arcR;
    return {
      ch,
      arcX: arcR * Math.cos(arcAngle),
      arcY: -arcR * Math.sin(arcAngle),
      arcRotDeg: 90 - (arcAngle * 180) / Math.PI,
      centerX: centerOffsets[c],
    };
  });
}

// One animated G+Text per character. All four animatable values
// (position, rotation, scale, fill opacity) are derived from the
// parent's shared `t` and `opacity` — so the entire morph runs on the
// UI thread with zero React reconciliation per frame.
//
// We render at fontSize=centerSize and shrink via `scale` instead of
// animating fontSize itself: scale is a GPU transform, fontSize would
// force a text re-layout each frame.
interface MorphCharProps {
  layout: CharLayout;
  arcSize: number;
  centerSize: number;
  t: SharedValue<number>;
  opacity: SharedValue<number>;
  color: string;
}

const MorphChar = memo(function MorphChar({
  layout, arcSize, centerSize, t, opacity, color,
}: MorphCharProps) {
  const { ch, arcX, arcY, arcRotDeg, centerX } = layout;

  const gProps = useAnimatedProps(() => {
    'worklet';
    const tt = t.value;
    const sz = arcSize + (centerSize - arcSize) * tt;
    // yCenterAdjust keeps the centre seat optically centred on y=0; on
    // the arc it would push the baseline into the ring below, so it
    // only ramps in proportion to t.
    const yAdj = sz * 0.3 * tt;
    const x = RING_CENTER + arcX + (centerX - arcX) * tt;
    const y = RING_CENTER + arcY + (0 - arcY) * tt + yAdj;
    const rot = arcRotDeg * (1 - tt);
    const scale = sz / centerSize;
    // Order matters: translate → rotate around translated anchor →
    // scale around the same anchor. That replicates the original
    // `rotate(deg cx cy)` plus textAnchor="middle" geometry.
    return {
      transform: [
        { translateX: x },
        { translateY: y },
        { rotate: `${rot}deg` },
        { scale },
      ],
    };
  });

  const textProps = useAnimatedProps(() => {
    'worklet';
    return { fillOpacity: opacity.value };
  });

  return (
    <AnimatedG animatedProps={gProps}>
      <AnimatedSvgText
        animatedProps={textProps}
        x={0}
        y={0}
        fontSize={centerSize}
        fill={color}
        fontFamily="Georgia"
        textAnchor="middle"
      >
        {ch}
      </AnimatedSvgText>
    </AnimatedG>
  );
});

interface MorphingLabelProps {
  mood: string;
  index: number;
  discR: SharedValue<number>;
  activeStep: SharedValue<number>;
  collapsing: SharedValue<number>;
  color: string;
}

const MorphingLabel = memo(function MorphingLabel({
  mood, index, discR, activeStep, collapsing, color,
}: MorphingLabelProps) {
  const arcR = RING_STEP * (index + 1) + LABEL_OUTSIDE;
  const arcSize = 16 + index * 1.5;
  const centerSize = arcSize + CENTER_SIZE_BASE + index * CENTER_SIZE_INDEX_STEP;

  const layouts = useMemo(
    () => computeCharLayouts(mood, arcR, arcSize, centerSize),
    [mood, arcR, arcSize, centerSize],
  );

  const t = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Opacity: fade in once disc has reached this ring AND we haven't
  // been surpassed yet. Special signal -1 = collapse phase, kill
  // instantly so labels don't ghost over the retracting disc.
  useAnimatedReaction(
    () => {
      const step = activeStep.value;
      const r = discR.value;
      if (collapsing.value) return -1;
      const passed = step > index;
      const introRevealed = r >= RING_STEP * (index + 1);
      return introRevealed && !passed ? 1 : 0;
    },
    (curr, prev) => {
      if (curr === prev) return;
      if (curr === -1) {
        cancelAnimation(opacity);
        opacity.value = 0;
        return;
      }
      opacity.value = withTiming(curr, { duration: 300 }, (finished) => {
        // Once fully invisible while passed, snap t back to 0 so a
        // future re-activation flies in from the arc seat instead of
        // teleporting horizontally.
        if (finished && curr === 0 && activeStep.value > index) {
          t.value = 0;
        }
      });
    },
  );

  // Morph t: 0 (arc seat) → 1 (centre seat) when active. While passed,
  // freeze t at its current value — the label fades out at its last
  // position rather than morphing back to the arc.
  useAnimatedReaction(
    () => {
      const step = activeStep.value;
      if (collapsing.value) return -2;
      if (step > index) return -1;
      return step === index ? 1 : 0;
    },
    (curr, prev) => {
      if (curr === prev) return;
      if (curr === -2) {
        cancelAnimation(t);
        t.value = 0;
        return;
      }
      if (curr === -1) return;
      cancelAnimation(t);
      t.value = withTiming(curr, { duration: curr === 1 ? 520 : 380 });
    },
  );

  return (
    <>
      {layouts.map((layout, c) => (
        <MorphChar
          key={c}
          layout={layout}
          arcSize={arcSize}
          centerSize={centerSize}
          t={t}
          opacity={opacity}
          color={color}
        />
      ))}
    </>
  );
});

interface RingProps {
  index: number;
  discR: SharedValue<number>;
  activeStep: SharedValue<number>;
  stroke: string;
}

const Ring = memo(function Ring({ index, discR, activeStep, stroke }: RingProps) {
  const targetR = RING_STEP * (index + 1);
  const opacity = useSharedValue(1);

  // Hide the ring once the sage fill has reached or passed it — its
  // own outline would otherwise draw a competing dark circle inside
  // the fill.
  useAnimatedReaction(
    () => (activeStep.value >= index ? 1 : 0),
    (curr, prev) => {
      if (curr === prev) return;
      opacity.value = withTiming(curr === 1 ? 0 : 1, { duration: 320 });
    },
  );

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    return {
      r: Math.min(discR.value, targetR),
      strokeOpacity: opacity.value,
    };
  });

  return (
    <AnimatedCircle
      cx={RING_CENTER}
      cy={RING_CENTER}
      animatedProps={animatedProps}
      stroke={stroke}
      strokeWidth={1.6}
      fill="none"
    />
  );
});

interface Props {
  /** Whether the dial container is live (false resets everything). */
  visible: boolean;
  /** Flip to true to trigger the disc-and-rings intro animation. */
  reveal: boolean;
  /** Flip to true to fold the dial back into nothing (mirror of reveal). */
  collapse?: boolean;
  /** Session id used to persist the final mood on drag-end. */
  sessionId: string;
  /** Fires on the first drag that reaches the innermost ring. */
  onInteract: () => void;
}

export default memo(function MoodDial({ visible, reveal, collapse, sessionId, onInteract }: Props) {
  // Drag progress drives the sage fill on the UI thread.
  const progress = useSharedValue(0);
  const dragStart = useSharedValue(0);
  // Discrete step (-1..3) the user has currently dragged into. Read by
  // every Ring and MorphingLabel via useAnimatedReaction, so changes
  // never cross the JS bridge.
  const lastHapticStep = useSharedValue(-1);
  // Rides from 0 to 1 alongside the disc reveal so the sage dot grows
  // from nothing instead of popping in at FILL_MIN.
  const introFill = useSharedValue(0);
  // Direction hint ("← drag →") sitting on the dial. Drives both the
  // hint's own opacity AND a cream wash covering the dial.
  const hintOpacity = useSharedValue(0);
  const hintPulse = useSharedValue(0);
  // Cream-disc radius, animated on the UI thread. Was a JS state in
  // the previous version — every frame triggered a full SVG re-render.
  const discR = useSharedValue(0);
  // Boolean signal (0/1) read by labels to kill themselves instantly
  // during the parent's collapse phase.
  const collapsing = useSharedValue(0);

  const hasInteractedRef = useRef(false);
  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;

  const handleFirstInteract = useCallback(() => {
    if (hasInteractedRef.current) return;
    hasInteractedRef.current = true;
    onInteractRef.current();
    hintOpacity.value = withTiming(0, { duration: 280 });
    cancelAnimation(hintPulse);
    hintPulse.value = withTiming(0, { duration: 220 });
  }, []);

  const commitMood = useCallback(
    (mood: MoodKey) => {
      if (sessionId) updateSessionMood(sessionId, mood);
    },
    [sessionId],
  );

  // Horizontal drag grows the central fill outward; the mood only
  // activates once the fill physically reaches the first ring.
  const circleGesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      dragStart.value = progress.value;
    })
    .onUpdate((e) => {
      'worklet';
      const next = Math.max(0, Math.min(1, dragStart.value + e.translationX / DRAG_TRAVEL));
      progress.value = next;
      const fillR = FILL_MIN + next * (FILL_MAX - FILL_MIN);
      let step = -1;
      for (let j = 0; j < MOODS.length; j++) {
        if (fillR >= RING_STEP * (j + 1)) step = j;
      }
      if (step !== lastHapticStep.value) {
        lastHapticStep.value = step;
        if (step >= 0) {
          runOnJS(haptics.select)();
          runOnJS(handleFirstInteract)();
        }
      }
    })
    .onEnd(() => {
      'worklet';
      const fillR = FILL_MIN + progress.value * (FILL_MAX - FILL_MIN);
      let step = -1;
      for (let j = 0; j < MOODS.length; j++) {
        if (fillR >= RING_STEP * (j + 1)) step = j;
      }
      if (step >= 0) runOnJS(commitMood)(MOODS[step]);
    });

  const filledCircleProps = useAnimatedProps(() => {
    const base = FILL_MIN + progress.value * (FILL_MAX - FILL_MIN);
    return { r: base * introFill.value };
  });

  const discCircleProps = useAnimatedProps(() => {
    return { r: discR.value };
  });

  // Reset everything when the parent closes the screen.
  useEffect(() => {
    if (visible) return;
    cancelAnimation(discR);
    cancelAnimation(introFill);
    cancelAnimation(hintOpacity);
    cancelAnimation(hintPulse);
    discR.value = 0;
    introFill.value = 0;
    hintOpacity.value = 0;
    hintPulse.value = 0;
    progress.value = 0;
    lastHapticStep.value = -1;
    collapsing.value = 0;
    hasInteractedRef.current = false;
  }, [visible]);

  // Reveal — both the disc and the sage dot scale up under withTiming
  // with cubic-out easing, in lockstep, on the UI thread.
  useEffect(() => {
    if (!reveal) return;
    collapsing.value = 0;
    const easing = Easing.out(Easing.cubic);
    discR.value = withTiming(DISC_MAX_R, { duration: MOOD_DIAL_DISC_DURATION, easing });
    introFill.value = withTiming(1, { duration: MOOD_DIAL_DISC_DURATION, easing });

    // Kick the "← drag →" hint in well before the disc is done growing
    // — the rings are visible by ~50% of the growth, so waiting for the
    // full disc duration + 260ms (~1.5s) makes the hint feel late. Land
    // it around 600ms so the affordance shows up while the user's eye
    // is still on the dial.
    const hintTimer = setTimeout(() => {
      if (hasInteractedRef.current) return;
      hintOpacity.value = withTiming(1, { duration: 520 });
      // Continuous ping-pong with smooth in/out easing — auto-reverses
      // around the endpoints so the arrows never "snap" back.
      hintPulse.value = withRepeat(
        withTiming(1, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      );
    }, 600);

    return () => clearTimeout(hintTimer);
  }, [reveal]);

  // Mirror of reveal — disc and sage retract under cubic-out, hint
  // drops alongside. `collapsing=1` immediately tells every label to
  // kill its opacity/morph so nothing ghosts over the shrinking disc.
  useEffect(() => {
    if (!collapse) return;
    collapsing.value = 1;
    const easing = Easing.out(Easing.cubic);
    discR.value = withTiming(0, { duration: MOOD_DIAL_COLLAPSE_DURATION, easing });
    introFill.value = withTiming(0, { duration: MOOD_DIAL_COLLAPSE_DURATION, easing });
    cancelAnimation(hintPulse);
    hintPulse.value = withTiming(0, { duration: 220 });
    hintOpacity.value = withTiming(0, { duration: 280 });
  }, [collapse]);

  // Cream wash over the whole disc. Capped at ~0.42 so rings read as
  // softened rather than hidden — the hint on top stands clear, but the
  // dial doesn't disappear.
  const dimProps = useAnimatedProps(() => ({
    opacity: hintOpacity.value * 0.58,
  }));
  const hintRowStyle = useAnimatedStyle(() => ({
    opacity: hintOpacity.value,
  }));
  const hintLeftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -hintPulse.value * 6 }],
  }));
  const hintRightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: hintPulse.value * 6 }],
  }));

  return (
    <GestureDetector gesture={circleGesture}>
      <View style={styles.track}>
        <Svg
          width={RING_BOX_SIZE}
          height={RING_BOX_SIZE}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <AnimatedCircle
            cx={RING_CENTER}
            cy={RING_CENTER}
            animatedProps={discCircleProps}
            fill={palette.cream}
          />

          <AnimatedCircle
            cx={RING_CENTER}
            cy={RING_CENTER}
            animatedProps={filledCircleProps}
            fill={FILL_COLOR}
            stroke={palette.brown}
            strokeWidth={1.4}
          />

          {Array.from({ length: RING_COUNT }).map((_, i) => (
            <Ring
              key={i}
              index={i}
              discR={discR}
              activeStep={lastHapticStep}
              stroke={palette.brown}
            />
          ))}

          {MOODS.map((mood, i) => (
            <MorphingLabel
              key={mood}
              mood={mood}
              index={i}
              discR={discR}
              activeStep={lastHapticStep}
              collapsing={collapsing}
              color={palette.brown}
            />
          ))}

          {/* Cream wash over the dial during the hint phase — washes
              out the ring strokes and mood labels just enough that the
              "← drag →" hint above reads clearly. */}
          <AnimatedCircle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={DISC_MAX_R}
            fill={palette.cream}
            animatedProps={dimProps}
          />

        </Svg>

        <Animated.View
          pointerEvents="none"
          style={[styles.hintRow, hintRowStyle]}
        >
          <Animated.View style={hintLeftStyle}>
            <Text style={styles.hintArrow}>←</Text>
          </Animated.View>
          <View style={styles.hintTextPill}>
            <Text style={styles.hintText}>drag</Text>
          </View>
          <Animated.View style={hintRightStyle}>
            <Text style={styles.hintArrow}>→</Text>
          </Animated.View>
        </Animated.View>
      </View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  track: {
    width: RING_BOX_SIZE,
    height: RING_BOX_SIZE,
    position: 'relative',
  },
  // "← drag →" centered just below the sage dot. The cream wash behind
  // softens the ring strokes at this y, so the text reads even though a
  // ring passes through the same band.
  hintRow: {
    position: 'absolute',
    // Centred on the disc — top is set to the optical centre minus
    // roughly half the row height so `drag` sits dead-centre on the
    // sage circle rather than below it.
    top: RING_CENTER - 18,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  hintArrow: {
    color: palette.brown,
    fontSize: 30,
    fontFamily: 'Georgia',
    fontWeight: '500',
  },
  hintText: {
    color: palette.brown,
    fontSize: 19,
    fontFamily: 'Georgia',
    fontWeight: '500',
    letterSpacing: 1,
  },
  // Tiny chip behind the word — pulls the eye to the call to action
  // and lifts `drag` off the cream wash without obscuring the rings
  // on either side. Solid warm-sand keeps brown text readable.
  hintTextPill: {
    backgroundColor: '#EBDAB2',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
});

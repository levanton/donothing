import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { palette } from '@/lib/theme';
import { updateSessionMood } from '@/lib/db/sessions';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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

interface MorphingLabelProps {
  mood: string;
  index: number;
  active: boolean;
  passed: boolean;
  introRevealed: boolean;
  /** Parent collapse phase — kill the label immediately when set, so
      the label doesn't linger over a disc that's already shrunk past
      its ring. */
  collapsing: boolean;
  color: string;
}

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

// Each mood is a word rendered glyph-by-glyph so we can interpolate
// position AND rotation per character — t=0 arranges the chars along the
// mood's arc seat (matching what TextPath produced before), t=1 lines
// them up horizontally at the centre of the disc. Between the two, every
// letter smoothly unbends and slides inward, which reads as the same
// word straightening out rather than a new element appearing.
const MorphingLabel = memo(function MorphingLabel({
  mood, index, active, passed, introRevealed, collapsing, color,
}: MorphingLabelProps) {
  const arcR = RING_STEP * (index + 1) + LABEL_OUTSIDE;
  const chars = mood.split('');
  const arcSize = 16 + index * 1.5;
  const centerSize = arcSize + CENTER_SIZE_BASE + index * CENTER_SIZE_INDEX_STEP;

  const [t, setT] = useState(0);
  const [opacity, setOpacity] = useState(0);
  const tRef = useRef(0);
  const opacityRef = useRef(0);
  const tRafRef = useRef(0);
  const opRafRef = useRef(0);

  useEffect(() => {
    // While passed, leave t alone — the label fades out at its current
    // position (the "just disappears" the user asked for). Once fully
    // invisible the opacity effect below snaps t back to 0 so a future
    // re-activation flies in from the arc seat.
    if (passed) return;
    if (tRafRef.current) cancelAnimationFrame(tRafRef.current);
    const from = tRef.current;
    const to = active ? 1 : 0;
    if (from === to) return;
    const duration = active ? 520 : 380;
    const start = Date.now();
    const tick = () => {
      const tt = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - tt, 3);
      const next = from + (to - from) * eased;
      tRef.current = next;
      setT(next);
      if (tt < 1) tRafRef.current = requestAnimationFrame(tick);
      else tRafRef.current = 0;
    };
    tRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (tRafRef.current) cancelAnimationFrame(tRafRef.current);
    };
  }, [active, passed]);

  // Parent collapse phase wins over every other state — kill the label
  // and reset its glide so the user sees the rings retract clean,
  // without text ghosting over a disc that's already shrunk past it.
  useEffect(() => {
    if (!collapsing) return;
    if (opRafRef.current) {
      cancelAnimationFrame(opRafRef.current);
      opRafRef.current = 0;
    }
    if (tRafRef.current) {
      cancelAnimationFrame(tRafRef.current);
      tRafRef.current = 0;
    }
    opacityRef.current = 0;
    setOpacity(0);
    tRef.current = 0;
    setT(0);
  }, [collapsing]);

  useEffect(() => {
    if (collapsing) return;
    if (opRafRef.current) cancelAnimationFrame(opRafRef.current);
    const revealed = introRevealed && !passed;
    const from = opacityRef.current;
    const to = revealed ? 1 : 0;
    if (from === to) return;
    const duration = 300;
    const start = Date.now();
    const tick = () => {
      const tt = Math.min(1, (Date.now() - start) / duration);
      const eased = tt < 0.5 ? 4 * tt * tt * tt : 1 - Math.pow(-2 * tt + 2, 3) / 2;
      const next = from + (to - from) * eased;
      opacityRef.current = next;
      setOpacity(next);
      if (tt < 1) {
        opRafRef.current = requestAnimationFrame(tick);
      } else {
        opRafRef.current = 0;
        // If we just finished fading out while this mood is passed, the
        // label is invisible — quietly snap t back to 0 so the next time
        // this mood activates, its letters fly in from the arc seat
        // again instead of teleporting straight in at centre.
        if (!revealed && passed) {
          tRef.current = 0;
          setT(0);
        }
      }
    };
    opRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (opRafRef.current) cancelAnimationFrame(opRafRef.current);
    };
  }, [introRevealed, passed]);

  if (opacity < 0.01 && !active) return null;

  const size = arcSize + (centerSize - arcSize) * t;
  // yCenterAdjust fixes vertical centring at the centre seat; on the arc
  // it would push the baseline inward (toward the ring below it), so
  // only apply it in proportion to t.
  const yCenterAdjust = size * 0.3 * t;

  // Build per-character centre offsets using real-ish glyph widths so
  // narrow letters (i, l, t) don't drift apart and wide ones (r, h, m)
  // don't collide. Cumulative layout: each char sits next to its
  // neighbour with LETTER_GAP_PX between glyph edges.
  const widths = chars.map(
    (ch) => (GEORGIA_WIDTH_EMS[ch.toLowerCase()] ?? DEFAULT_WIDTH_EM) * size,
  );
  const gapCount = chars.length - 1;
  const totalWidth =
    widths.reduce((a, b) => a + b, 0) + gapCount * LETTER_GAP_PX;
  const offsets: number[] = new Array(chars.length);
  {
    let cursor = -totalWidth / 2;
    for (let i = 0; i < chars.length; i++) {
      cursor += widths[i] / 2;
      offsets[i] = cursor;
      cursor += widths[i] / 2 + LETTER_GAP_PX;
    }
  }

  return (
    <>
      {chars.map((ch, c) => {
        const offsetAlong = offsets[c];

        // Arc seat: each char's centre sits at its own angle along the
        // top semicircle. Earlier chars have larger θ (further left).
        const arcAngle = ARC_ANGLE_RAD - offsetAlong / arcR;
        const arcX = arcR * Math.cos(arcAngle);
        const arcY = -arcR * Math.sin(arcAngle);
        // Rotation that aligns the baseline with the arc tangent at this
        // point — derived from (sin θ, cos θ) being the travel direction.
        const arcRotDeg = 90 - (arcAngle * 180) / Math.PI;

        // Centre seat: straight horizontal line through the disc centre,
        // no per-char rotation.
        const centerX = offsetAlong;
        const centerY = 0;

        const posX = arcX + (centerX - arcX) * t;
        const posY = arcY + (centerY - arcY) * t;
        const rotDeg = arcRotDeg * (1 - t);

        const cx = RING_CENTER + posX;
        const cy = RING_CENTER + posY + yCenterAdjust;

        return (
          <SvgText
            key={c}
            x={cx}
            y={cy}
            transform={`rotate(${rotDeg} ${cx} ${cy})`}
            fillOpacity={opacity}
            fontSize={size}
            fill={color}
            fontFamily="Georgia"
            textAnchor="middle"
          >
            {ch}
          </SvgText>
        );
      })}
    </>
  );
});

interface RingProps {
  index: number;
  discR: number;
  stroke: string;
  hidden: boolean;
}

const Ring = memo(function Ring({ index, discR, stroke, hidden }: RingProps) {
  const targetR = RING_STEP * (index + 1);
  const r = Math.min(discR, targetR);
  const [opacity, setOpacity] = useState(1);
  const opacityRef = useRef(1);

  // Fade out smoothly when the user's fill surpasses this ring (and
  // fade back in if they drag back below it).
  useEffect(() => {
    const from = opacityRef.current;
    const to = hidden ? 0 : 1;
    if (from === to) return;
    const duration = 320;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      opacityRef.current = next;
      setOpacity(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hidden]);

  return (
    <Circle
      cx={RING_CENTER}
      cy={RING_CENTER}
      r={r}
      stroke={stroke}
      strokeOpacity={opacity}
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
  // Continuous 0..1 drag progress — shared value so the terracotta fill
  // can animate on the UI thread while the user drags.
  const progress = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const lastHapticStep = useSharedValue(-1);
  // Rides from 0 to 1 alongside the cream-disc intro reveal so the sage
  // dot grows from nothing instead of popping in at FILL_MIN.
  const introFill = useSharedValue(0);
  // Direction hint ("← drag →") that sits on the dial. Drives both the
  // hint's own opacity AND a cream wash covering the dial — so rings
  // below the hint soften while the hint itself reads crisp. Both fade
  // out together on first interaction.
  const hintOpacity = useSharedValue(0);
  const hintPulse = useSharedValue(0);

  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [discR, setDiscR] = useState(0);
  const discRafRef = useRef(0);
  const discRRef = useRef(0);
  const hasInteractedRef = useRef(false);
  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;

  const setPreviewMood = useCallback((mood: string | null) => {
    setActiveMood(mood);
    if (mood !== null && !hasInteractedRef.current) {
      hasInteractedRef.current = true;
      onInteractRef.current();
      hintOpacity.value = withTiming(0, { duration: 280 });
      cancelAnimation(hintPulse);
      hintPulse.value = withTiming(0, { duration: 220 });
    }
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
          runOnJS(Haptics.selectionAsync)();
          runOnJS(setPreviewMood)(MOODS[step]);
        } else {
          runOnJS(setPreviewMood)(null);
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

  // Reset everything when the parent closes the screen.
  useEffect(() => {
    if (visible) return;
    if (discRafRef.current) {
      cancelAnimationFrame(discRafRef.current);
      discRafRef.current = 0;
    }
    discRRef.current = 0;
    setDiscR(0);
    setActiveMood(null);
    hasInteractedRef.current = false;
    progress.value = 0;
    lastHapticStep.value = -1;
    introFill.value = 0;
    hintOpacity.value = 0;
    cancelAnimation(hintPulse);
    hintPulse.value = 0;
  }, [visible]);

  // Start the disc-grow animation when reveal flips true.
  useEffect(() => {
    if (!reveal) return;
    if (discRafRef.current) cancelAnimationFrame(discRafRef.current);
    const startAt = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - startAt) / MOOD_DIAL_DISC_DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = eased * DISC_MAX_R;
      discRRef.current = next;
      setDiscR(next);
      introFill.value = eased;
      if (t < 1) discRafRef.current = requestAnimationFrame(tick);
      else discRafRef.current = 0;
    };
    discRafRef.current = requestAnimationFrame(tick);

    // After the disc settles, fade in the "← drag →" hint + cream wash
    // and start the arrow pulse. Both fall away on the first drag.
    const hintTimer = setTimeout(() => {
      if (hasInteractedRef.current) return;
      hintOpacity.value = withTiming(1, { duration: 520 });
      // Continuous ping-pong with smooth in/out easing — auto-reverses
      // around the endpoints so the arrows never "snap" back. Truly
      // infinite (-1) and seamless: no central pause from the previous
      // sequence-based pulse.
      hintPulse.value = withRepeat(
        withTiming(1, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
        }),
        -1,
        true,
      );
    }, MOOD_DIAL_DISC_DURATION + 260);

    return () => {
      if (discRafRef.current) {
        cancelAnimationFrame(discRafRef.current);
        discRafRef.current = 0;
      }
      clearTimeout(hintTimer);
    };
  }, [reveal]);

  // Mirror of the reveal animation — when the parent flips collapse on,
  // the disc and sage fill retract back to zero with the same easing.
  // The hint and its cream wash drop alongside so nothing lingers as the
  // rings disappear inward.
  useEffect(() => {
    if (!collapse) return;
    if (discRafRef.current) cancelAnimationFrame(discRafRef.current);
    const startAt = Date.now();
    const startR = discRRef.current;
    const startFill = introFill.value;
    const tick = () => {
      const t = Math.min(1, (Date.now() - startAt) / MOOD_DIAL_COLLAPSE_DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      const factor = 1 - eased;
      const next = startR * factor;
      discRRef.current = next;
      setDiscR(next);
      introFill.value = startFill * factor;
      if (t < 1) discRafRef.current = requestAnimationFrame(tick);
      else discRafRef.current = 0;
    };
    discRafRef.current = requestAnimationFrame(tick);

    cancelAnimation(hintPulse);
    hintPulse.value = withTiming(0, { duration: 220 });
    hintOpacity.value = withTiming(0, { duration: 280 });

    return () => {
      if (discRafRef.current) {
        cancelAnimationFrame(discRafRef.current);
        discRafRef.current = 0;
      }
    };
  }, [collapse]);

  const activeIndex = activeMood ? MOODS.indexOf(activeMood as typeof MOODS[number]) : -1;

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
          <Circle
            cx={RING_CENTER}
            cy={RING_CENTER}
            r={discR}
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
              stroke={palette.brown}
              // Also hide the ring at the current active level — once the
              // sage fill has reached it, the ring stroke would just draw
              // a competing dark circle *inside* the fill. Let the sage's
              // own outline carry the boundary instead.
              hidden={activeIndex >= i}
            />
          ))}

          {MOODS.map((mood, i) => {
            const introRevealed = discR >= RING_STEP * (i + 1);
            const surpassed = activeIndex > i;
            const isActive = i === activeIndex;
            return (
              <MorphingLabel
                key={mood}
                mood={mood}
                index={i}
                active={isActive}
                passed={surpassed}
                introRevealed={introRevealed}
                collapsing={!!collapse}
                color={palette.brown}
              />
            );
          })}

          {/* Cream wash over the dial during the hint phase — washes out
              the ring strokes and mood labels just enough that the
              "← drag →" hint above reads clearly. Fades with the hint. */}
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

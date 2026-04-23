import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { palette } from '@/lib/theme';
import { updateSessionMood } from '@/lib/db/sessions';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MOODS = ['still', 'lighter', 'refreshed', 'full'] as const;

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

interface MorphingLabelProps {
  mood: string;
  index: number;
  active: boolean;
  passed: boolean;
  introRevealed: boolean;
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
  mood, index, active, passed, introRevealed, color,
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

  useEffect(() => {
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
  /** Session id used to persist the final mood on drag-end. */
  sessionId: string;
  /** Fires on the first drag that reaches the innermost ring. */
  onInteract: () => void;
}

export default memo(function MoodDial({ visible, reveal, sessionId, onInteract }: Props) {
  // Continuous 0..1 drag progress — shared value so the terracotta fill
  // can animate on the UI thread while the user drags.
  const progress = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const lastHapticStep = useSharedValue(-1);
  // Rides from 0 to 1 alongside the cream-disc intro reveal so the sage
  // dot grows from nothing instead of popping in at FILL_MIN.
  const introFill = useSharedValue(0);

  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [discR, setDiscR] = useState(0);
  const discRafRef = useRef(0);
  const hasInteractedRef = useRef(false);
  const onInteractRef = useRef(onInteract);
  onInteractRef.current = onInteract;

  const setPreviewMood = useCallback((mood: string | null) => {
    setActiveMood(mood);
    if (mood !== null && !hasInteractedRef.current) {
      hasInteractedRef.current = true;
      onInteractRef.current();
    }
  }, []);

  const commitMood = useCallback(
    (mood: string) => {
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
    setDiscR(0);
    setActiveMood(null);
    hasInteractedRef.current = false;
    progress.value = 0;
    lastHapticStep.value = -1;
    introFill.value = 0;
  }, [visible]);

  // Start the disc-grow animation when reveal flips true.
  useEffect(() => {
    if (!reveal) return;
    if (discRafRef.current) cancelAnimationFrame(discRafRef.current);
    const startAt = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - startAt) / MOOD_DIAL_DISC_DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      setDiscR(eased * DISC_MAX_R);
      introFill.value = eased;
      if (t < 1) discRafRef.current = requestAnimationFrame(tick);
      else discRafRef.current = 0;
    };
    discRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (discRafRef.current) {
        cancelAnimationFrame(discRafRef.current);
        discRafRef.current = 0;
      }
    };
  }, [reveal]);

  const activeIndex = activeMood ? MOODS.indexOf(activeMood as typeof MOODS[number]) : -1;

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
                color={palette.brown}
              />
            );
          })}

        </Svg>
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
});

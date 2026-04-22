import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, Text as SvgText, TextPath } from 'react-native-svg';

import { palette } from '@/lib/theme';
import { updateSessionMood } from '@/lib/db/sessions';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const MOODS = ['still', 'lighter', 'refreshed', 'full'] as const;

const RING_COUNT = MOODS.length;
const RING_STEP = 28;
const RING_MAX = RING_STEP * RING_COUNT;
const RING_BOX_PAD = 28;
const LABEL_OUTSIDE = 4;
const RING_BOX_SIZE = (RING_MAX + RING_BOX_PAD) * 2;
const RING_CENTER = RING_BOX_SIZE / 2;
const DISC_MAX_R = RING_MAX + 24;
const FILL_MIN = 12;
const FILL_MAX = RING_MAX + 22;
const DRAG_TRAVEL = RING_MAX * 2;

// Soft sage-olive — a muted warm green that sits as a calm cool
// complement to the terracotta backdrop without going dramatic.
const FILL_COLOR = '#8FA07A';

// How long the disc takes to sweep from centre out to its max radius.
// Exported so the parent can time the hint fade-in to land right after
// the disc settles.
export const MOOD_DIAL_DISC_DURATION = 1300;

interface MoodLabelProps {
  mood: string;
  index: number;
  active: boolean;
  passed: boolean;
  color: string;
  revealed: boolean;
}

// react-native-svg Text doesn't reliably apply opacity / fontSize through
// reanimated animatedProps, so we drive both through React state + rAF
// and keep the element out of the tree entirely until the first reveal.
const MoodLabel = memo(function MoodLabel({
  mood, index, active, passed, color, revealed,
}: MoodLabelProps) {
  const baseSize = 16 + index * 1.5;
  const [size, setSize] = useState(baseSize);
  const sizeRef = useRef(baseSize);
  const [opacity, setOpacity] = useState(0);
  const opacityRef = useRef(0);

  useEffect(() => {
    const from = sizeRef.current;
    const delta = active ? 4 : passed ? -1 : 0;
    const to = baseSize + delta;
    const duration = 260;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * eased;
      sizeRef.current = next;
      setSize(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, passed, baseSize]);

  useEffect(() => {
    const from = opacityRef.current;
    const to = revealed ? 1 : 0;
    if (from === to) return;
    const duration = 280;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const next = from + (to - from) * eased;
      opacityRef.current = next;
      setOpacity(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [revealed]);

  if (!revealed && opacity < 0.01) return null;

  return (
    <SvgText
      fillOpacity={opacity}
      fontSize={size}
      fill={color}
      fontFamily="Georgia"
      textAnchor="middle"
      letterSpacing={2 + index * 0.5}
    >
      <TextPath href={`#mood-dial-arc-${index}`} startOffset="65%">
        {mood}
      </TextPath>
    </SvgText>
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
    const r = FILL_MIN + progress.value * (FILL_MAX - FILL_MIN);
    return { r };
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
          <Defs>
            {Array.from({ length: RING_COUNT }).map((_, i) => {
              const pr = RING_STEP * (i + 1) + LABEL_OUTSIDE;
              const d = `M ${RING_CENTER - pr} ${RING_CENTER} A ${pr} ${pr} 0 0 1 ${RING_CENTER + pr} ${RING_CENTER}`;
              return <Path key={i} id={`mood-dial-arc-${i}`} d={d} />;
            })}
          </Defs>

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
            strokeOpacity={0.5}
            strokeWidth={1.4}
          />

          {Array.from({ length: RING_COUNT }).map((_, i) => (
            <Ring
              key={i}
              index={i}
              discR={discR}
              stroke={palette.brown}
              hidden={activeIndex > i}
            />
          ))}

          {MOODS.map((mood, i) => {
            // revealed goes false both before the intro reaches the ring
            // AND when the user's fill has surpassed it — MoodLabel's
            // rAF eases the opacity either way.
            const introRevealed = discR >= RING_STEP * (i + 1);
            const surpassed = activeIndex > i;
            const revealed = introRevealed && !surpassed;
            return (
              <MoodLabel
                key={mood}
                mood={mood}
                index={i}
                active={i === activeIndex}
                passed={surpassed}
                color={palette.brown}
                revealed={revealed}
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

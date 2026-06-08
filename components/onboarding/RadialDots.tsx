import { useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { EASE_OUT } from '@/constants/animations';
import { palette } from '@/lib/theme';

// One full, barely-perceptible orbit of the whole dot field (ms).
const ORBIT_PERIOD_MS = 200000;

/**
 * RadialDots — a field of small dots that morphs between two states driven by
 * a single `progress` shared value:
 *
 *   progress 0  →  chaotic scatter across the disc ("now.")
 *   progress 1  →  concentric dotted ring borders around the centre ("what if…")
 *
 * Every dot owns BOTH a scatter coordinate and a ring coordinate and simply
 * interpolates between them, so the same dots reorganise — never a fade swap.
 * Layout is generated from a seeded PRNG, so it is identical on every render
 * (and on both screens), which is what makes the morph read as one continuous
 * element rather than two unrelated dot fields.
 *
 * The central terracotta disc is a plain view — drop an <Image> (or any node)
 * in via `children` to layer artwork on top of the animation later.
 */

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Dot {
  /** Which ring this dot belongs to (0 = innermost) — drives orbit grouping. */
  ring: number;
  // scatter state (progress 0)
  sx: number;
  sy: number;
  sSize: number;
  // ring state (progress 1)
  rx: number;
  ry: number;
  rSize: number;
  /** Static opacity — big dots stay solid; ~half the rest read greyish. */
  opacity: number;
  /** 0..1 — per-dot stagger so the field settles instead of snapping. */
  delay: number;
  /** Reveal fade-in window inside [0,1] — varied start + width so each dot
   *  fades in at its own speed, after the central circle. */
  revStart: number;
  revWindow: number;
}

interface BuildArgs {
  size: number;
  circleRadius: number;
  count: number;
  rings: number;
  seed: number;
}

function buildDots({ size, circleRadius, count, rings, seed }: BuildArgs): Dot[] {
  const rand = mulberry32(seed);
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2;

  // Wider spread for visible contrast: most dots stay small, while ~18% get a
  // chunky accent so a few clearly larger dots punctuate the rings.
  const dotSize = () => {
    const base = 2 + rand() * 2; // ~2 .. 4 (the many small ones)
    const accent = rand() < 0.18 ? 2 + rand() * 2 : 0; // a few +2..4
    return base + accent; // ~2 .. ~8
  };

  // --- ring targets (the structured "border" state) ---
  const targets: { x: number; y: number; size: number; ring: number }[] = [];
  // Innermost ring sits a bit further from the centre; the rest are spread with
  // an equal gap out to the edge, so the spacing between rings is uniform.
  const innerR = circleRadius + size * 0.09;
  const outerR = maxR - size * 0.015;

  for (let r = 0; r < rings; r++) {
    const t = rings === 1 ? 0 : r / (rings - 1);
    const radius = innerR + (outerR - innerR) * t;
    const circumference = 2 * Math.PI * radius;
    // Constant-ish angular density: outer rings hold more dots.
    const n = Math.max(8, Math.round(circumference / (size * 0.044)));
    const angleOffset = rand() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      // A few random gaps so the border breathes rather than reading mechanical.
      if (rand() < 0.07) continue;
      // Tight jitter keeps each ring crisp and clearly circular.
      const angle = angleOffset + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.04;
      const rr = radius + (rand() - 0.5) * size * 0.007;
      targets.push({
        x: cx + Math.cos(angle) * rr,
        y: cy + Math.sin(angle) * rr,
        size: dotSize(),
        ring: r,
      });
    }
  }

  // Thin evenly down to `count` (shuffle then slice keeps all rings represented).
  for (let i = targets.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [targets[i], targets[j]] = [targets[j], targets[i]];
  }
  const kept = targets.slice(0, count);

  // --- chaotic scatter, kept LOCAL to each ring slot ---
  // Every dot starts just a short, capped distance from its own ring position
  // (a random offset within `maxTravel`). Adjacent rings' clouds overlap into a
  // continuous scattered band, so it still reads as chaos — but no dot ever has
  // to fly across the field to find its place.
  const maxTravel = size * 0.1;
  return kept.map((tg) => {
    const ang = rand() * Math.PI * 2;
    const mag = Math.sqrt(rand()) * maxTravel; // uniform over the offset disc
    const sx = tg.x + Math.cos(ang) * mag;
    const sy = tg.y + Math.sin(ang) * mag;

    // Only the small dots may go greyish; anything medium or larger stays solid.
    const isSmall = tg.size < 3.9;
    const opacity = isSmall && rand() < 0.6 ? 0.4 : 1;
    return {
      ring: tg.ring,
      sx,
      sy,
      sSize: 2.2 + rand() * 2.6,
      rx: tg.x,
      ry: tg.y,
      rSize: tg.size,
      opacity,
      delay: rand(),
      // Dots begin after the circle (>=0.18) and each fades at its own speed.
      revStart: 0.18 + rand() * 0.32,
      revWindow: 0.3 + rand() * 0.32,
    };
  });
}

// ── Single dot ────────────────────────────────────────────────────────────
function DotView({
  dot,
  progress,
  reveal,
  color,
}: {
  dot: Dot;
  progress: SharedValue<number>;
  reveal: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    // Morph: each dot eases over its own 0.78-wide window inside [0,1]. A small
    // spread keeps motion cohesive so the rings read as they settle.
    const start = dot.delay * 0.22;
    const local = interpolate(
      progress.value,
      [start, start + 0.78],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const x = dot.sx + (dot.rx - dot.sx) * local;
    const y = dot.sy + (dot.ry - dot.sy) * local;
    const size = dot.sSize + (dot.rSize - dot.sSize) * local;

    // Reveal: pure opacity fade-in, each dot at its own start + speed.
    const rev = interpolate(
      reveal.value,
      [dot.revStart, dot.revStart + dot.revWindow],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      opacity: dot.opacity * rev,
      transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }],
    };
  });

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

// ── One ring's worth of dots, on its own slow orbit ───────────────────────
// Each ring rotates independently: alternating direction and slightly different
// speed, so neighbouring rings drift opposite ways. Rotation runs ONLY while
// `orbiting` (i.e. the rings are formed); otherwise it's held at rest.
function RingGroup({
  dots,
  progress,
  reveal,
  color,
  orbiting,
  period,
  direction,
}: {
  dots: Dot[];
  progress: SharedValue<number>;
  reveal: SharedValue<number>;
  color: string;
  orbiting: boolean;
  period: number;
  direction: 1 | -1;
}) {
  const orbit = useSharedValue(0);

  useEffect(() => {
    if (orbiting) {
      orbit.value = 0;
      orbit.value = withRepeat(
        withTiming(360 * direction, { duration: period, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(orbit);
      orbit.value = withTiming(0, { duration: 600, easing: EASE_OUT });
    }
  }, [orbiting, period, direction]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${orbit.value}deg` }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      {dots.map((dot, i) => (
        <DotView key={i} dot={dot} progress={progress} reveal={reveal} color={color} />
      ))}
    </Animated.View>
  );
}

interface Props {
  /** 0 = scatter, 1 = rings. */
  progress: SharedValue<number>;
  /** Square edge of the whole composition. */
  size: number;
  style?: StyleProp<ViewStyle>;
  dotColor?: string;
  circleColor?: string;
  /** Central circle diameter as a fraction of `size`. */
  circleRatio?: number;
  dotCount?: number;
  rings?: number;
  seed?: number;
  /** When true the rings slowly orbit (i.e. they're formed). */
  orbiting?: boolean;
  /** Artwork to overlay on the central circle (added later by the user). */
  children?: ReactNode;
}

// Per-ring orbit speed multipliers (innermost → outermost). Sign alternates so
// adjacent rings spin opposite ways; magnitudes differ for an organic drift.
const RING_SPEED = [1, -0.78, 0.62, -0.88];

export default function RadialDots({
  progress,
  size,
  style,
  dotColor = palette.brown,
  circleColor = palette.terracotta,
  circleRatio = 0.3,
  dotCount = 160,
  rings = 4,
  seed = 7,
  orbiting = false,
  children,
}: Props) {
  const circleSize = size * circleRatio;
  const circleRadius = circleSize / 2;

  const dots = useMemo(
    () => buildDots({ size, circleRadius, count: dotCount, rings, seed }),
    [size, circleRadius, dotCount, rings, seed],
  );

  // Group dots by ring so each ring can orbit on its own.
  const ringGroups = useMemo(() => {
    const g: Dot[][] = Array.from({ length: rings }, () => []);
    dots.forEach((d) => g[d.ring]?.push(d));
    return g;
  }, [dots, rings]);

  // Plays once on mount (and on every remount when the layer reappears): the
  // dots fade in. The central circle fades in just ahead.
  const reveal = useSharedValue(0);
  useEffect(() => {
    reveal.value = withDelay(120, withTiming(1, { duration: 1400, easing: EASE_OUT }));
  }, []);

  const circleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(reveal.value, [0, 0.35], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[{ width: size, height: size }, style]} pointerEvents="none">
      {ringGroups.map((groupDots, ring) => {
        const speed = RING_SPEED[ring % RING_SPEED.length];
        return (
          <RingGroup
            key={ring}
            dots={groupDots}
            progress={progress}
            reveal={reveal}
            color={dotColor}
            orbiting={orbiting}
            period={ORBIT_PERIOD_MS / Math.abs(speed)}
            direction={speed >= 0 ? 1 : -1}
          />
        );
      })}

      <Animated.View
        style={[
          styles.center,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleRadius,
            marginLeft: -circleRadius,
            marginTop: -circleRadius,
            backgroundColor: circleColor,
          },
          circleStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  center: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

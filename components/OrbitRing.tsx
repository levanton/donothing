import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import Svg, { Circle as SvgCircle } from 'react-native-svg';

export const RING_SIZE = 140;
const RING_R = 64;
const RING_STROKE = 3;
const RING_CIRC = 2 * Math.PI * RING_R;
const RING_PERIOD = 15;

const AnimatedCircle = Animated.createAnimatedComponent(SvgCircle);

interface OrbitRingProps {
  color: string;
  faintColor: string;
  elapsed: number;
  onStop?: () => void;
  dotProgress: SharedValue<number>;
  hideStop?: boolean;
}

export default function OrbitRing({ color, faintColor, elapsed, onStop, dotProgress, hideStop }: OrbitRingProps) {
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;

  const smoothLap = useSharedValue(0);
  const lastElapsed = useSharedValue(elapsed);

  useEffect(() => {
    lastElapsed.value = elapsed;
  }, [elapsed]);

  useFrameCallback((info) => {
    const fracSecond = (info.timeSinceFirstFrame % 1000) / 1000;
    const totalSeconds = lastElapsed.value + fracSecond;
    dotProgress.value = (totalSeconds % RING_PERIOD) / RING_PERIOD;
    smoothLap.value = Math.floor(totalSeconds / RING_PERIOD);
  });

  const trailingProps = useAnimatedProps(() => ({
    stroke: smoothLap.value % 2 === 0 ? faintColor : color,
  }));

  const leadingProps = useAnimatedProps(() => ({
    stroke: smoothLap.value % 2 === 0 ? color : faintColor,
    strokeDashoffset: RING_CIRC * (1 - dotProgress.value),
  }));

  return (
    <Pressable onPress={onStop} style={styles.container}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <AnimatedCircle
          cx={cx} cy={cy} r={RING_R}
          strokeWidth={RING_STROKE} fill="none"
          animatedProps={trailingProps}
        />
        <AnimatedCircle
          cx={cx} cy={cy} r={RING_R}
          strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={`${RING_CIRC}`}
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx}, ${cy}`}
          animatedProps={leadingProps}
        />
      </Svg>
      {!hideStop && (
        <View style={styles.center}>
          <Feather name="square" size={20} color={color} style={{ opacity: 0.6 }} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    position: 'absolute',
  },
});

import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  total: number;
  current: number;
  color: string;
}

function Dot({ active, color }: { active: boolean; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(active ? 0.9 : 0.2, { duration: 300 }),
    transform: [{ scale: withTiming(active ? 1 : 1, { duration: 300 }) }],
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

export default function ProgressDots({ total, current, color }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <Dot key={i} active={i === current} color={color} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

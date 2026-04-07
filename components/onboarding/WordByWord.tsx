import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface Props {
  text: string;
  intervalMs?: number;
  accelerate?: boolean;
  style?: any;
  onComplete?: () => void;
}

function Word({ word, visible, style }: { word: string; visible: boolean; style?: any }) {
  const animStyle = useAnimatedStyle(() => ({
    opacity: withTiming(visible ? 1 : 0, { duration: 350 }),
  }));

  return (
    <Animated.Text style={[styles.word, style, animStyle]}>
      {word}{' '}
    </Animated.Text>
  );
}

export default function WordByWord({
  text,
  intervalMs = 200,
  accelerate = false,
  style,
  onComplete,
}: Props) {
  const words = text.split(' ');
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    let i = 0;
    let cancelled = false;
    const show = () => {
      if (cancelled) return;
      i++;
      setVisibleCount(i);
      if (i < words.length) {
        const delay = accelerate
          ? Math.max(50, intervalMs - i * 8)
          : intervalMs;
        setTimeout(show, delay);
      } else {
        onComplete?.();
      }
    };
    const t = setTimeout(show, intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text]);

  return (
    <View style={[styles.container, style]}>
      {words.map((word, idx) => (
        <Word
          key={`${idx}-${word}`}
          word={word}
          visible={idx < visibleCount}
          style={style}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  word: {
    fontSize: 28,
    fontWeight: '300',
  },
});

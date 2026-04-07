import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import PlaceholderBg from '../PlaceholderBg';
import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function TheTurnScreen({ isActive, onNext, theme }: Props) {
  const [phase, setPhase] = useState(0);
  const dotScale = useSharedValue(1);

  useEffect(() => {
    if (!isActive) {
      setPhase(0);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 500);
    const t2 = setTimeout(() => setPhase(2), 2500);
    const t3 = setTimeout(() => setPhase(3), 4000);
    const t4 = setTimeout(() => setPhase(4), 5500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [isActive]);

  useEffect(() => {
    dotScale.value = withRepeat(
      withTiming(1.3, { duration: 2000 }),
      -1,
      true,
    );
  }, []);

  const breathingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <View style={styles.container}>
      <PlaceholderBg colors={[palette.cream, palette.salmon]} />

      {/* Breathing dot */}
      {phase >= 4 && (
        <Animated.View style={[styles.dot, breathingStyle]} entering={FadeIn.duration(1000)} />
      )}

      <View style={styles.textContainer}>
        {phase >= 1 && (
          <Animated.Text entering={FadeIn.duration(800)} style={styles.intro}>
            What if you just...
          </Animated.Text>
        )}
        {phase >= 2 && (
          <Animated.Text entering={FadeIn.duration(800)} style={styles.main}>
            did nothing?
          </Animated.Text>
        )}
        {phase >= 3 && (
          <Animated.Text entering={FadeIn.duration(600)} style={styles.sub}>
            Like you used to.
          </Animated.Text>
        )}
        {phase >= 4 && (
          <Animated.Text entering={FadeIn.duration(600)} style={styles.bold}>
            Even one minute a day can change everything.
          </Animated.Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  textContainer: {
    gap: 16,
    alignItems: 'center',
  },
  intro: {
    fontSize: 22,
    fontWeight: '300',
    color: palette.brown,
    textAlign: 'center',
    fontFamily: Fonts?.serif,
  },
  main: {
    fontSize: 40,
    fontWeight: '300',
    color: palette.brown,
    textAlign: 'center',
    fontFamily: Fonts?.serif,
  },
  sub: {
    fontSize: 18,
    fontWeight: '400',
    color: palette.brown,
    opacity: 0.7,
    textAlign: 'center',
    fontFamily: Fonts?.serif,
  },
  bold: {
    fontSize: 20,
    fontWeight: '600',
    color: palette.terracotta,
    textAlign: 'center',
    fontFamily: Fonts?.serif,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: palette.terracotta,
    alignSelf: 'center',
    marginBottom: 40,
  },
});

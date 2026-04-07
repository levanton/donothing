import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function TheTurnScreen({ isActive, onNext, theme }: Props) {
  const [phase, setPhase] = useState(0);

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

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        {phase >= 1 && (
          <Animated.Text entering={FadeIn.duration(800)} style={[styles.intro, { color: theme.text }]}>
            What if you just...
          </Animated.Text>
        )}
        {phase >= 2 && (
          <Animated.Text entering={FadeIn.duration(800)} style={[styles.main, { color: theme.text }]}>
            did nothing?
          </Animated.Text>
        )}
        {phase >= 3 && (
          <Animated.View entering={FadeIn.duration(600)} style={styles.sub}>
            <Text style={[styles.subText, { color: theme.text }]}>
              Like you used to.
            </Text>
          </Animated.View>
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
    textAlign: 'center',
    fontFamily: Fonts?.serif,
  },
  main: {
    fontSize: 40,
    fontWeight: '300',
    textAlign: 'center',
    fontFamily: Fonts?.serif,
  },
  sub: {
    opacity: 0.7,
  },
  subText: {
    fontSize: 18,
    fontWeight: '400',
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
});

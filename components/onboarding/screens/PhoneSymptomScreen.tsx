import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function PhoneSymptomScreen({ isActive, onNext, theme }: Props) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setPhase(0);
      return;
    }
    const t1 = setTimeout(() => setPhase(1), 800);
    const t2 = setTimeout(() => setPhase(2), 2200);
    const t3 = setTimeout(() => setPhase(3), 3700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isActive]);

  return (
    <View style={styles.container}>
      <View style={styles.textContainer}>
        {phase >= 1 && (
          <Animated.Text entering={FadeIn.duration(600)} style={styles.line}>
            And in between — you scroll.
          </Animated.Text>
        )}
        {phase >= 2 && (
          <Animated.Text entering={FadeIn.duration(600)} style={[styles.line, styles.dim]}>
            Not because you want to.
          </Animated.Text>
        )}
        {phase >= 3 && (
          <Animated.Text entering={FadeIn.duration(800)} style={styles.line}>
            Because your brain forgot how to just...{'\n'}
            <Animated.Text entering={FadeIn.delay(1500).duration(600)} style={styles.stop}>
              stop.
            </Animated.Text>
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
    minHeight: 200,
    gap: 20,
  },
  line: {
    fontSize: 26,
    fontWeight: '300',
    color: palette.cream,
    textAlign: 'center',
    fontFamily: Fonts?.serif,
  },
  dim: {
    opacity: 0.7,
  },
  stop: {
    fontSize: 36,
    fontWeight: '500',
    color: palette.terracotta,
  },
});

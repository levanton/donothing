import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import WordByWord from '../WordByWord';
import PlaceholderBg from '../PlaceholderBg';
import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function RushingScreen({ isActive, onNext, theme }: Props) {
  const [showBody, setShowBody] = useState(false);

  useEffect(() => {
    setShowBody(false);
  }, [isActive]);

  const handleWordsComplete = () => {
    setTimeout(() => setShowBody(true), 1000);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <PlaceholderBg colors={[palette.cream, '#B8C4C8']} />
      <View style={styles.textContainer}>
        {isActive && (
          <WordByWord
            text="Now you rush to work. Start a task. Run to the store. Cook. Clean. Fix. Reply. Pick up kids. Rush somewhere else."
            intervalMs={100}
            accelerate
            style={{ color: palette.brown, fontFamily: Fonts?.serif, fontSize: 26, fontWeight: '300' }}
            onComplete={handleWordsComplete}
          />
        )}
        {showBody && (
          <Animated.Text
            entering={FadeIn.duration(800)}
            style={styles.body}
          >
            Even when you're not scrolling — you're rushing.
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
  },
  body: {
    marginTop: 32,
    fontSize: 18,
    fontWeight: '400',
    color: palette.brown,
    opacity: 0.8,
    textAlign: 'center',
    fontFamily: Fonts?.serif,
  },
});

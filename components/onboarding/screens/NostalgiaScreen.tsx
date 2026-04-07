import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import WordByWord from '../WordByWord';
import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';

const BODY_LINES = [
  'Lying in the grass.',
  'Staring at clouds.',
  'Dreaming about nothing.',
  'Time just... stopped.',
];

const grassImage = require('@/assets/images/grass.png');

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function NostalgiaScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: insets.top + 16 }]}>
      <View style={styles.imageArea}>
        <Image source={grassImage} style={styles.image} />
      </View>
      <View style={styles.textArea}>
        {isActive && (
          <>
            <WordByWord
              text="Remember being a kid?"
              intervalMs={200}
              style={{ color: theme.text, fontFamily: Fonts?.serif, fontSize: 32, fontWeight: '600', textAlign: 'center', lineHeight: 38 }}
            />
            <View style={{ height: 24 }} />
            {BODY_LINES.map((line, i) => (
              <Animated.Text
                key={i}
                entering={FadeIn.duration(600).delay(800 + i * 400)}
                style={[styles.bodyLine, { color: theme.text }]}
              >
                {line}
              </Animated.Text>
            ))}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
  },
  imageArea: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: 300,
    height: 300,
    resizeMode: 'contain',
  },
  textArea: {
    flex: 2,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 16,
  },
  bodyLine: {
    fontFamily: Fonts?.serif,
    fontSize: 22,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 37,
  },
});

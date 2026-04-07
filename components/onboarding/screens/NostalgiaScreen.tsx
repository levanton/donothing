import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WordByWord from '../WordByWord';
import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';

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
          <WordByWord
            text="Remember being a kid? Lying in the grass. Staring at clouds. Dreaming. Time just... stopped."
            intervalMs={200}
            style={{ color: theme.text, fontFamily: Fonts?.serif, fontSize: 28, fontWeight: '300', textAlign: 'center' }}
          />
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
    width: 240,
    height: 240,
    resizeMode: 'contain',
  },
  textArea: {
    flex: 2,
    justifyContent: 'flex-start',
    paddingTop: 16,
  },
});

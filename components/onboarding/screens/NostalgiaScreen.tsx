import { EASE_IN_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';
import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADING = 'remember\nbeing a kid?';

interface LineSpec {
  text: string;
  bold?: boolean;
  paragraph?: boolean;
}

const LINES: LineSpec[] = [
  { text: 'Lying in the grass.' },
  { text: 'Staring at clouds.' },
  { text: 'Dreaming about nothing.' },
  { text: 'Time just was.', paragraph: true },
  { text: 'Time just… stopped.', bold: true },
];

const ENTER_DELAY = 200;
const ENTER_DURATION = 1100;

const grassImage = require('@/assets/images/grass.png');

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function NostalgiaScreen({ isActive, theme }: Props) {
  const insets = useSafeAreaInsets();

  const enterOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    enterOpacity.value = withDelay(
      ENTER_DELAY,
      withTiming(1, { duration: ENTER_DURATION, easing: EASE_IN_OUT }),
    );
  }, [isActive]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
  }));

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <Animated.View style={[styles.content, enterStyle]}>
        <Text style={[styles.heading, { color: theme.text }]}>{HEADING}</Text>

        <View style={styles.imageArea}>
          <Image source={grassImage} style={styles.image} fadeDuration={0} />
        </View>

        <View style={styles.body}>
          {LINES.map((spec, i) => (
            <Text
              key={i}
              style={[
                styles.line,
                { color: theme.text },
                spec.bold && { fontWeight: '600' },
                spec.paragraph && { marginTop: 18 },
              ]}
            >
              {spec.text}
            </Text>
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 96,
  },
  imageArea: {
    alignItems: 'center',
  },
  image: {
    width: '100%',
    maxWidth: 280,
    aspectRatio: 608 / 592,
    resizeMode: 'contain',
  },
  heading: {
    fontFamily: Fonts?.serif,
    fontSize: 40,
    fontWeight: '500',
    textAlign: 'left',
    lineHeight: 46,
  },
  body: {},
  line: {
    fontFamily: Fonts?.serif,
    fontSize: 21,
    fontWeight: '400',
    textAlign: 'left',
    lineHeight: 30,
  },
});

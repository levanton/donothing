import { useEffect } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { EASE_IN_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';

const rushImage = require('@/assets/images/rush.png');

const HEADING = 'now.';

interface LineSpec {
  text: string;
  bold?: boolean;
  paragraph?: boolean;
}

const LINES: LineSpec[] = [
  { text: 'work. home. errands. repeat.' },
  { text: 'in between — we scroll.' },
  { text: 'not to feel something — but to feel nothing.' },
  { text: 'and it never helps.' },
  { text: 'we’re exhausted.', bold: true },
  { text: 'days, months, years — gone in a blur.', bold: true },
];

const ENTER_DELAY = 200;
const ENTER_DURATION = 1100;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function RushingScreen({ isActive, theme }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const imageSize = Math.min(width * 0.82, 330);

  const enterOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    enterOpacity.value = withDelay(ENTER_DELAY, withTiming(1, { duration: ENTER_DURATION, easing: EASE_IN_OUT }));
  }, [isActive]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom }]}>
        <Animated.View style={[styles.textArea, enterStyle]}>
          <Text style={[styles.heading, { color: theme.text }]}>
            {HEADING}
          </Text>

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

        <Animated.View style={[styles.imageArea, enterStyle]}>
          <Image
            source={rushImage}
            style={[styles.image, { width: imageSize, height: imageSize }]}
            fadeDuration={0}
          />
        </Animated.View>
      </View>
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
    paddingBottom: 24,
    justifyContent: 'center',
  },
  imageArea: {
    alignItems: 'center',
    marginTop: 40,
  },
  image: {
    resizeMode: 'contain',
  },
  textArea: {},
  heading: {
    fontFamily: Fonts?.serif,
    fontSize: 40,
    fontWeight: '500',
    textAlign: 'left',
    lineHeight: 46,
    marginBottom: 14,
  },
  body: {},
  line: {
    fontFamily: Fonts?.serif,
    fontSize: 19,
    fontWeight: '400',
    textAlign: 'left',
    lineHeight: 27,
  },
});

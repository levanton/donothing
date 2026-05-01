import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
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

const HEADING = 'Now.';

interface LineSpec {
  text: string;
  bold?: boolean;
  paragraph?: boolean;
}

const LINES: LineSpec[] = [
  { text: 'Work. Home. Errands. Repeat.' },
  { text: 'In between — we scroll.' },
  { text: 'Not to feel something — but to feel nothing.' },
  { text: 'And it never helps.' },
  { text: 'We’re exhausted.', bold: true },
  { text: 'Days, months, years — gone in a blur.', bold: true },
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
      <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.centerStack}>
          <Animated.View style={[styles.imageArea, enterStyle]}>
            <Image source={rushImage} style={styles.image} fadeDuration={0} />
          </Animated.View>

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
        </View>
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
  },
  centerStack: {
    flex: 1,
    justifyContent: 'center',
  },
  imageArea: {
    alignItems: 'center',
    marginBottom: 56,
  },
  image: {
    width: 270,
    height: 270,
    resizeMode: 'contain',
  },
  textArea: {},
  heading: {
    fontFamily: Fonts?.serif,
    fontSize: 28,
    fontWeight: '500',
    textAlign: 'left',
    lineHeight: 36,
    marginBottom: 14,
  },
  body: {},
  line: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'left',
    lineHeight: 26,
  },
});

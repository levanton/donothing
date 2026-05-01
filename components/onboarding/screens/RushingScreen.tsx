import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { EASE_OUT, EASE_IN_OUT } from '@/constants/animations';
import { Feather } from '@expo/vector-icons';
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

const IMAGE_DELAY = 150;
const IMAGE_DURATION = 800;
const HEADING_DELAY = 500;
const HEADING_DURATION = 700;
const BODY_DELAY = 1000;
const BODY_DURATION = 1100;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function RushingScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();

  const headingOpacity = useSharedValue(0);
  const bodyOpacity = useSharedValue(0);
  const imageOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    imageOpacity.value = withDelay(IMAGE_DELAY, withTiming(1, { duration: IMAGE_DURATION, easing: EASE_IN_OUT }));

    headingOpacity.value = withDelay(HEADING_DELAY, withTiming(1, { duration: HEADING_DURATION, easing: EASE_IN_OUT }));

    bodyOpacity.value = withDelay(BODY_DELAY, withTiming(1, { duration: BODY_DURATION, easing: EASE_IN_OUT }));

    buttonOpacity.value = withDelay(HEADING_DELAY, withTiming(1, { duration: IMAGE_DURATION, easing: EASE_OUT }));
  }, [isActive]);

  const headingStyle = useAnimatedStyle(() => ({
    opacity: headingOpacity.value,
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
  }));

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.centerStack}>
          <Animated.View style={[styles.imageArea, imageStyle]}>
            <Image source={rushImage} style={styles.image} fadeDuration={0} />
          </Animated.View>

          <View style={styles.textArea}>
            <Animated.Text style={[styles.heading, { color: theme.text }, headingStyle]}>
              {HEADING}
            </Animated.Text>

            <Animated.View style={[styles.body, bodyStyle]}>
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
            </Animated.View>
          </View>
        </View>

        <Animated.View style={[styles.buttonArea, buttonAnimStyle]}>
          <Pressable onPress={onNext} style={[styles.circleButton, { borderColor: theme.text }]}>
            <Feather name="arrow-right" size={22} color={theme.text} />
          </Pressable>
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
  buttonArea: {
    alignItems: 'flex-end',
  },
  circleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

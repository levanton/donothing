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
import { palette } from '@/lib/theme';

const whatIfImage = require('@/assets/images/what-if.png');

const HEADING = 'What if…';

interface LineSpec {
  text: string;
  bold?: boolean;
  accent?: boolean;
  paragraph?: boolean;
}

const LINES: LineSpec[] = [
  { text: 'you just stopped?' },
  { text: 'Did nothing. Like you used to.' },
  { text: 'Even one minute a day', paragraph: true },
  { text: 'can change everything.', bold: true, accent: true },
];

const IMAGE_DELAY = 200;
const IMAGE_DURATION = 1300;
const HEADING_DELAY = 800;
const HEADING_DURATION = 1100;
const BODY_DELAY = 1700;
const BODY_DURATION = 1800;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function PhoneSymptomScreen({ isActive, onNext, theme }: Props) {
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
            <Image source={whatIfImage} style={styles.image} fadeDuration={0} />
          </Animated.View>

          <View style={styles.textArea}>
            <Animated.Text style={[styles.heading, { color: palette.terracotta }, headingStyle]}>
              {HEADING}
            </Animated.Text>

            <Animated.View style={[styles.body, bodyStyle]}>
              {LINES.map((spec, i) => (
                <Text
                  key={i}
                  style={[
                    styles.line,
                    { color: spec.accent ? palette.terracotta : theme.text },
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

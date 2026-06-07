import { EASE_IN_OUT } from '@/constants/animations';
import { palette } from '@/lib/theme';
import { useEffect } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_BODY_BOLD, onboardingText } from '../textStyles';

const whatIfImage = require('@/assets/images/what-if.png');

const HEADING = 'what if…';

interface LineSpec {
  text: string;
  bold?: boolean;
  accent?: boolean;
  paragraph?: boolean;
}

const LINES: LineSpec[] = [
  { text: 'you just stopped?' },
  { text: 'did nothing. like you used to.' },
  { text: 'even one minute a day', paragraph: true },
  { text: 'can change everything.', bold: true, accent: true },
];

const ENTER_DELAY = 200;
const ENTER_DURATION = 1100;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function PhoneSymptomScreen({ isActive, theme }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const imageSize = Math.min(width * 0.82, 330);

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
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom },
        ]}
      >
        <Animated.View style={[styles.textArea, enterStyle]}>
          <Text
            style={[
              onboardingText.heading,
              styles.heading,
              { color: theme.text },
            ]}
          >
            {HEADING}
          </Text>

          <View style={styles.body}>
            {LINES.map((spec, i) => (
              <Text
                key={i}
                style={[
                  onboardingText.line,
                  { color: spec.accent ? palette.terracotta : theme.text },
                  spec.bold && ONBOARDING_BODY_BOLD,
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
            source={whatIfImage}
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
    aspectRatio: 939 / 739,

    maxWidth: 360,
  },
  textArea: {},
  heading: {
    marginBottom: 14,
  },
  body: {},
});

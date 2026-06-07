import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import PillButton from '@/components/PillButton';
import { EASE_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const HEADING = 'you’re all set.';

const LINES = [
  'your space to do nothing is ready.',
  'open it anytime. breathe.',
  'and let the rush go quiet.',
];

interface Props {
  isActive: boolean;
  onNext: () => void;
  onFinish: () => void;
  theme: { text: string; bg: string };
}

export default function AllSetScreen({ isActive, onFinish }: Props) {
  const insets = useSafeAreaInsets();

  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.9);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(10);
  const buttonOpacity = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    markOpacity.value = withTiming(1, { duration: 700, easing: EASE_OUT });
    markScale.value = withTiming(1, { duration: 700, easing: EASE_OUT });
    textOpacity.value = withDelay(
      450,
      withTiming(1, { duration: 700, easing: EASE_OUT }),
    );
    textTranslateY.value = withDelay(
      450,
      withTiming(0, { duration: 700, easing: EASE_OUT }),
    );
    buttonOpacity.value = withDelay(
      1000,
      withTiming(1, { duration: 600, easing: EASE_OUT }),
    );
  }, [isActive]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: palette.terracotta }]}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.centerArea}>
          <Animated.View style={[styles.mark, markStyle]}>
            <Feather name="check" size={34} color={palette.terracotta} />
          </Animated.View>

          <Animated.View style={textStyle}>
            <Text style={[styles.heading, { color: palette.cream }]}>
              {HEADING}
            </Text>
            <View style={styles.lines}>
              {LINES.map((line, i) => (
                <Text key={i} style={[styles.line, { color: palette.cream }]}>
                  {line}
                </Text>
              ))}
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonArea, buttonStyle]}>
          <PillButton
            label="start"
            onPress={onFinish}
            variant="filled"
            size="large"
            color={palette.terracotta}
            bg={palette.cream}
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
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.cream,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  heading: {
    fontFamily: Fonts?.serif,
    fontSize: 40,
    fontWeight: '500',
    lineHeight: 46,
    textAlign: 'center',
  },
  lines: {
    marginTop: 16,
    gap: 4,
  },
  line: {
    fontFamily: Fonts?.serif,
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 28,
    textAlign: 'center',
  },
  buttonArea: {
    alignItems: 'center',
    paddingBottom: 24,
  },
});

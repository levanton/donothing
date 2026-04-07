import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import PillButton from '@/components/PillButton';
import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';

interface Props {
  isActive: boolean;
  onFinish: () => void;
  theme: { text: string; bg: string };
}

export default function LetsGoScreen({ isActive, onFinish, theme }: Props) {
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Enso placeholder */}
      <View style={styles.ensoContainer}>
        <View style={[styles.enso, { borderColor: palette.terracotta }]} />
      </View>

      <Text style={[styles.heading, { color: theme.text, fontFamily: Fonts?.serif }]}>
        Ready to do nothing?
      </Text>

      {isActive && (
        <Animated.View entering={FadeIn.delay(400).duration(600)} style={styles.buttonWrap}>
          <Animated.View style={pulseStyle}>
            <PillButton
              label="Start"
              onPress={onFinish}
              color={palette.terracotta}
              filled
              fillColor={palette.terracotta}
              style={styles.button}
            />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  ensoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  enso: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    opacity: 0.6,
  },
  heading: {
    fontSize: 34,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 48,
  },
  buttonWrap: {
    alignItems: 'center',
  },
  button: {
    paddingHorizontal: 64,
    paddingVertical: 18,
  },
});

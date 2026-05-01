import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { EASE_IN_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const ENTER_DELAY = 200;
const ENTER_DURATION = 1100;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function HowItWorksScreen({ isActive, theme }: Props) {
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
      <Animated.View style={[styles.content, enterStyle]}>
        <Text style={[styles.heading, { color: theme.text, fontFamily: Fonts?.serif }]}>
          Nothing is simple.
        </Text>

        <View style={styles.cards}>
          <View style={[styles.card, { backgroundColor: palette.brown }]}>
            <Feather name="lock" size={28} color={palette.cream} style={styles.cardIcon} />
            <Text style={[styles.cardLabel, { color: palette.cream, fontFamily: Fonts?.serif }]}>
              Your apps block
            </Text>
          </View>

          <View style={styles.arrow}>
            <Text style={[styles.arrowText, { color: palette.terracotta, fontFamily: Fonts?.serif }]}>
              →
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: palette.terracotta }]}>
            <Feather name="wind" size={28} color={palette.cream} style={styles.cardIcon} />
            <Text style={[styles.cardLabel, { color: palette.cream, fontFamily: Fonts?.serif }]}>
              Do nothing to unblock
            </Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    alignItems: 'center',
  },
  heading: {
    fontSize: 20,
    fontWeight: '400',
    marginBottom: 32,
    textAlign: 'center',
  },
  cards: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 10,
  },
  card: {
    flex: 1,
    minHeight: 200,
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 20,
    borderRadius: 18,
    justifyContent: 'flex-end',
  },
  cardIcon: {
    position: 'absolute',
    top: 22,
    left: 20,
    opacity: 0.9,
  },
  cardLabel: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.2,
    lineHeight: 28,
    textAlign: 'left',
  },
  arrow: {
    paddingHorizontal: 2,
    alignSelf: 'center',
  },
  arrowText: {
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 34,
  },
});

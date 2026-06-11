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

import { EASE_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import { palette } from '@/lib/theme';
import CtaButton from '../CtaButton';
import { onboardingText } from '../textStyles';

const HEADING = 'good news.';
const SUBTITLE = 'you don’t have to do anything.';

const NOTHINGS = [
  'no pushups.',
  'no reading a book.',
  'no learning a language.',
  'no journaling.',
  'no meditating.',
  'no fixing yourself.',
];

// ── The screen's own logic, animated ───────────────────────────────────────
// This page is a to-do list being struck off. The heading arrives, the
// underline draws itself, then the list rows — ✕ and text together, one
// unit — land one by one with a haptic tick each. The button waits for
// the last row.
const HEADING_MS = 600;
const DIVIDER_AT = 350;
const SUBTITLE_AT = 550;
const LIST_START_MS = 1000;
const ITEM_STEP_MS = 450;
const ITEM_FADE_MS = 350;
const LAST_ITEM_AT = LIST_START_MS + (NOTHINGS.length - 1) * ITEM_STEP_MS;
const BUTTON_AT = LAST_ITEM_AT + ITEM_FADE_MS + 350;

function CrossedItem({
  item,
  index,
  color,
}: {
  item: string;
  index: number;
  color: string;
}) {
  const row = useSharedValue(0);

  const rowAt = LIST_START_MS + index * ITEM_STEP_MS;
  const isLast = index === NOTHINGS.length - 1;

  useEffect(() => {
    row.value = withDelay(
      rowAt,
      withTiming(1, { duration: ITEM_FADE_MS, easing: EASE_OUT }),
    );
    // The strike-off tick — the payoff line gets the firmer tap.
    const t = setTimeout(() => (isLast ? haptics.light() : haptics.select()), rowAt);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: row.value,
    transform: [{ translateY: 6 * (1 - row.value) }],
  }));

  return (
    <Animated.View style={[styles.row, rowStyle]}>
      <Feather name="x" size={16} color={palette.terracotta} />
      <Text style={[styles.rowText, { color }]}>{item}</Text>
    </Animated.View>
  );
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function GoodNewsScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();

  const heading = useSharedValue(0);
  const divider = useSharedValue(0);
  const subtitle = useSharedValue(0);
  const button = useSharedValue(0);

  useEffect(() => {
    if (!isActive) return;
    heading.value = withTiming(1, { duration: HEADING_MS, easing: EASE_OUT });
    divider.value = withDelay(
      DIVIDER_AT,
      withTiming(1, { duration: 300, easing: EASE_OUT }),
    );
    subtitle.value = withDelay(
      SUBTITLE_AT,
      withTiming(1, { duration: 400, easing: EASE_OUT }),
    );
    button.value = withDelay(
      BUTTON_AT,
      withTiming(1, { duration: 500, easing: EASE_OUT }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const headingStyle = useAnimatedStyle(() => ({
    opacity: heading.value,
    transform: [{ translateY: 12 * (1 - heading.value) }],
  }));

  // The underline draws itself from the left.
  const dividerStyle = useAnimatedStyle(() => ({
    width: 44 * divider.value,
    opacity: divider.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitle.value,
    transform: [{ translateY: 8 * (1 - subtitle.value) }],
  }));

  const buttonStyle = useAnimatedStyle(() => ({
    opacity: button.value,
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.spacer} />

        <View>
          <Animated.Text
            style={[onboardingText.heading, { color: theme.text }, headingStyle]}
          >
            {HEADING}
          </Animated.Text>
          <Animated.View
            style={[
              styles.divider,
              { backgroundColor: palette.terracotta },
              dividerStyle,
            ]}
          />

          <Animated.Text
            style={[
              onboardingText.line,
              styles.subtitle,
              { color: theme.text },
              subtitleStyle,
            ]}
          >
            {SUBTITLE}
          </Animated.Text>

          <View style={styles.list}>
            {NOTHINGS.map((item, i) => (
              <CrossedItem key={i} item={item} index={i} color={theme.text} />
            ))}
          </View>
        </View>

        <View style={styles.spacer} />

        <Animated.View style={[styles.buttonArea, buttonStyle]}>
          <CtaButton label="try nothing" onPress={onNext} />
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
  spacer: {
    flex: 1,
  },
  divider: {
    height: 2,
    borderRadius: 1,
    marginTop: 14,
    marginBottom: 18,
  },
  subtitle: {
    marginBottom: 18,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    fontFamily: Fonts?.serif,
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 26,
  },
  buttonArea: {
    alignItems: 'center',
    paddingBottom: 24,
    gap: 18,
  },
});

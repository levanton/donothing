import { useEffect, type ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { palette } from '@/lib/theme';
import { EASE_OUT } from '@/constants/animations';
import type { Benefit } from '@/lib/benefits';

// Same proportions as the Paywall FeatureCarousel — small narrow
// cards with alternating colored backgrounds.
export const BENEFIT_CARD_W = 150;
export const BENEFIT_CARD_H = 240;
export const BENEFIT_CARD_GAP = 12;

// 6-tone warm-earth palette — refined Mediterranean ceramic feel.
// Order alternates light and dark so neighbouring cards contrast.
const VARIANTS: Array<{ bg: string; fg: string }> = [
  { bg: '#F0E0BD', fg: palette.brown }, // 0: warm cream (light)
  { bg: '#5C2F2F', fg: palette.cream }, // 1: deep wine (dark)
  { bg: '#C5A572', fg: palette.brown }, // 2: antique gold (light pop)
  { bg: '#7E3A24', fg: palette.cream }, // 3: rich auburn (mid)
  { bg: '#E8B89A', fg: palette.brown }, // 4: peach blush (light)
  { bg: '#3D2516', fg: palette.cream }, // 5: dark cocoa (darkest)
];

interface BenefitCardProps {
  item: Benefit;
  index: number;
  revealed: boolean;
}

/**
 * One slide in the post-session benefits carousel. Each card rises,
 * scales and fades on its own delay so the slider composes itself
 * left-to-right rather than dropping in as a block.
 */
export default function BenefitCard({ item, index, revealed }: BenefitCardProps) {
  const variant = VARIANTS[index % VARIANTS.length];

  // Scale gives the cards a sense of "stepping forward" — without it
  // the cascade reads as a flat fade.
  const op = useSharedValue(0);
  const y = useSharedValue(18);
  const scale = useSharedValue(0.94);
  useEffect(() => {
    if (!revealed) {
      op.value = 0;
      y.value = 18;
      scale.value = 0.94;
      return;
    }
    const delay = index * 130;
    op.value = withDelay(delay, withTiming(1, { duration: 560, easing: EASE_OUT }));
    y.value = withDelay(delay, withTiming(0, { duration: 560, easing: EASE_OUT }));
    scale.value = withDelay(delay, withTiming(1, { duration: 620, easing: EASE_OUT }));
  }, [revealed, index]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: y.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[styles.card, { backgroundColor: variant.bg }, cardStyle]}
    >
      <View style={styles.iconWrap}>
        <View style={[styles.iconHalo, { backgroundColor: `${variant.fg}22` }]} />
        <MaterialCommunityIcons
          name={item.icon as ComponentProps<typeof MaterialCommunityIcons>['name']}
          size={48}
          color={variant.fg}
        />
      </View>
      <Text style={[styles.label, { color: variant.fg }]}>
        {item.title}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: BENEFIT_CARD_W,
    height: BENEFIT_CARD_H,
    borderRadius: 20,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  iconWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHalo: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';

interface PlanCardProps {
  name: string;
  price: string;
  oldPrice?: string;
  subtitle?: string;
  badge?: string;
  variant?: 'default' | 'dark';
  isSelected: boolean;
  onSelect: () => void;
}

export default function PlanCard({
  name,
  price,
  oldPrice,
  subtitle,
  badge,
  variant = 'default',
  isSelected,
  onSelect,
}: PlanCardProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect();
  };

  const hasDetail = !!subtitle || !!oldPrice;
  const isDark = variant === 'dark';

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.card,
        isDark
          ? styles.cardDark
          : isSelected
            ? styles.cardSelected
            : styles.cardUnselected,
      ]}
    >
      {/* Radio dot — only when selected, absolute so it doesn't shift content */}
      {isSelected && <View style={[styles.radioDot, isDark && styles.radioDotDark]} />}

      {hasDetail ? (
        <View style={styles.detailContent}>
          {subtitle ? (
            <Text style={styles.subtitleLine}>
              <Text style={styles.subtitleLight}>First 3 days </Text>
              <Text style={styles.subtitleBold}>FREE!</Text>
            </Text>
          ) : null}
          <View style={styles.priceLine}>
            <Text style={styles.afterLabel}>After Trial: </Text>
            {oldPrice ? (
              <View style={styles.oldPriceWrap}>
                <Text style={styles.oldPrice}>{oldPrice}</Text>
                <View style={styles.strikethrough} />
              </View>
            ) : null}
            <Text style={styles.priceDetail}>{'  '}{price}</Text>
          </View>
        </View>
      ) : (
        <Text style={[styles.simpleLine, isSelected && styles.simpleLineSelected, isDark && styles.simpleLineDark]}>
          {name}: {price}
        </Text>
      )}

      {/* Badge */}
      {badge ? (
        <View style={[styles.badge, isSelected && styles.badgeSelected]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 24,
    overflow: 'visible',
  },
  cardSelected: {
    borderWidth: 1.5,
    borderColor: palette.terracotta,
    backgroundColor: `${palette.terracotta}0D`,
  },
  cardUnselected: {
    borderWidth: 1.5,
    borderColor: `${palette.brown}20`,
    backgroundColor: `${palette.brown}06`,
  },
  cardDark: {
    borderWidth: 1.5,
    borderColor: palette.charcoal,
    backgroundColor: palette.charcoal,
  },
  // Simple plan (one-liner)
  simpleLine: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    fontFamily: Fonts.serif,
    color: palette.brown,
    textAlign: 'center',
  },
  simpleLineSelected: {
    fontWeight: '600',
  },
  simpleLineDark: {
    color: palette.cream,
  },
  // Radio dot (shown only when selected, absolute positioned)
  radioDot: {
    position: 'absolute',
    left: 18,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.terracotta,
  },
  radioDotDark: {
    backgroundColor: palette.cream,
  },
  // Detail plan (multi-line)
  detailContent: {
    flex: 1,
    gap: 2,
    paddingLeft: 30,
    paddingRight: 30,
  },
  subtitleLine: {
    fontSize: 16,
  },
  subtitleLight: {
    fontWeight: '400',
    color: palette.brown,
  },
  subtitleBold: {
    fontWeight: '400',
    color: palette.brown,
    textDecorationLine: 'underline',
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  afterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: palette.brown,
  },
  oldPriceWrap: {
    justifyContent: 'center',
  },
  oldPrice: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.mono,
    color: palette.terracotta,
  },
  strikethrough: {
    position: 'absolute',
    left: -2,
    right: -2,
    height: 2.5,
    backgroundColor: palette.terracotta,
    top: '50%',
  },
  priceDetail: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.mono,
    color: palette.brown,
  },
  // Badge
  badge: {
    position: 'absolute',
    top: -11,
    right: 16,
    backgroundColor: palette.salmon,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSelected: {
    backgroundColor: palette.terracotta,
  },
  badgeText: {
    color: palette.cream,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

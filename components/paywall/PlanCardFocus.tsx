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

      {isDark ? (
        <>
          <Text style={[styles.simpleLine, styles.simpleLineDark, { textAlign: 'left', paddingLeft: 30 }]}>
            Pay once <Text style={styles.priceDetailDark}>{price}</Text>,{'\n'}own forever
          </Text>
          {badge ? (
            <View style={styles.limitedTag}>
              <Text style={styles.limitedTagText}>{badge} offer</Text>
            </View>
          ) : null}
        </>
      ) : hasDetail ? (
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
        <Text style={[styles.simpleLine, isSelected && styles.simpleLineSelected]}>
          <Text style={styles.simpleName}>{name}:</Text> <Text style={styles.simplePrice}>{price}</Text>
        </Text>
      )}

      {/* Badge (floating, for non-dark cards) */}
      {badge && !isDark ? (
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
    borderColor: '#2C4A3E',
    backgroundColor: '#2C4A3E',
  },
  // Simple plan (one-liner)
  simpleLine: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    fontFamily: Fonts.serif,
    color: palette.brown,
    textAlign: 'center',
  },
  simpleLineSelected: {},
  simpleName: {
    fontWeight: '600',
  },
  simplePrice: {
    fontFamily: Fonts.mono,
  },
  simpleLineDark: {
    color: palette.cream,
  },
  limitedTag: {
    borderWidth: 1.5,
    borderColor: `${palette.cream}40`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 10,
  },
  limitedTagText: {
    color: palette.salmon,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
  detailContentDark: {
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
  subtitleLineDark: {},
  subtitleLightDark: {
    color: `${palette.cream}BB`,
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
    fontWeight: '400',
    fontFamily: Fonts.mono,
    color: palette.brown,
  },
  priceDetailDark: {
    color: palette.cream,
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Fonts.mono,
  },
  // Badge
  badge: {
    position: 'absolute',
    top: -11,
    right: 16,
    backgroundColor: palette.terracotta,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSelected: {},
  badgeText: {
    color: palette.cream,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});

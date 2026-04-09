import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';

interface PlanCardProps {
  planName: string;
  price: string;
  period?: string;
  oldPrice?: string;
  trialText?: string;
  badge?: string;
  badgeColor?: string;
  accentColor?: string;
  isRecommended?: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

export default function PlanCard({
  planName,
  price,
  period,
  oldPrice,
  trialText,
  badge,
  badgeColor = palette.terracotta,
  accentColor = palette.terracotta,
  isRecommended,
  isSelected,
  onSelect,
}: PlanCardProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.card,
        isSelected
          ? [styles.cardSelected, { borderColor: accentColor, backgroundColor: `${accentColor}0D` }]
          : styles.cardUnselected,
        isRecommended && styles.cardRecommended,
      ]}
    >
      {/* Radio circle — always visible */}
      <View style={[styles.radio, isSelected && { borderColor: accentColor }]}>
        {isSelected && <View style={[styles.radioFill, { backgroundColor: accentColor }]} />}
      </View>

      {/* Name + subtitle column */}
      <View style={styles.nameColumn}>
        <Text style={styles.planName}>{planName}</Text>
        {trialText ? (
          <Text style={[styles.trialText, isSelected && { color: accentColor }]}>
            {trialText.split(/(FREE|forever)/i).map((part, i) =>
              /^(FREE|forever)$/i.test(part) ? (
                <Text key={i} style={styles.trialHighlight}>{part}</Text>
              ) : part
            )}
          </Text>
        ) : null}
      </View>

      {/* Price column */}
      <View style={styles.priceColumn}>
        {oldPrice ? (
          <View style={styles.oldPriceWrap}>
            <Text style={styles.oldPrice}>{oldPrice}</Text>
            <View style={[styles.strikethrough, { backgroundColor: accentColor }]} />
          </View>
        ) : null}
        <Text style={styles.priceRow}>
          <Text style={[styles.price, isSelected && { color: accentColor }]}>{price}</Text>
          {period ? <Text style={styles.period}>{period}</Text> : null}
        </Text>
      </View>

      {/* Badge */}
      {badge ? (
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
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
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingLeft: 48,
    overflow: 'visible',
  },
  cardSelected: {
    borderWidth: 2,
  },
  cardUnselected: {
    borderWidth: 1.5,
    borderColor: `${palette.brown}18`,
    backgroundColor: palette.cream,
  },
  cardRecommended: {
    marginHorizontal: -4,
    shadowColor: palette.terracotta,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  // Radio
  radio: {
    position: 'absolute',
    left: 16,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: `${palette.brown}4D`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Name column
  nameColumn: {
    flex: 1,
    gap: 2,
  },
  planName: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.serif,
    color: palette.brown,
  },
  trialText: {
    fontSize: 13,
    fontWeight: '400',
    color: `${palette.brown}90`,
  },
  trialHighlight: {
    fontSize: 15,
    fontWeight: '400',
    textTransform: 'uppercase',
  },
  // Price column
  priceColumn: {
    alignItems: 'flex-end',
    gap: 2,
  },
  oldPriceWrap: {
    justifyContent: 'center',
  },
  oldPrice: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Fonts.mono,
    color: palette.terracotta,
  },
  strikethrough: {
    position: 'absolute',
    left: -2,
    right: -2,
    height: 2,
    top: '50%',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: Fonts.mono,
    color: palette.brown,
  },
  period: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: Fonts.mono,
    color: `${palette.brown}80`,
  },
  // Badge
  badge: {
    position: 'absolute',
    top: -10,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    color: palette.cream,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

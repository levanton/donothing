import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PlanCardProps {
  name: string;
  price: string;
  subtitle?: string;
  badge?: string;
  isSelected: boolean;
  onSelect: () => void;
}

export default function PlanCard({
  name,
  price,
  subtitle,
  badge,
  isSelected,
  onSelect,
}: PlanCardProps) {
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(isSelected ? 1.02 : 1, { damping: 15, stiffness: 200 }) }],
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[
        styles.card,
        isSelected ? styles.cardSelected : styles.cardUnselected,
        animatedStyle,
      ]}
    >
      {/* Left accent bar */}
      {isSelected && <View style={styles.accentBar} />}

      {/* Plan info */}
      <View style={styles.content}>
        <Text style={[styles.name, isSelected && styles.nameSelected]}>{name}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, isSelected && styles.subtitleSelected]}>{subtitle}</Text>
        ) : null}
      </View>

      {/* Price + check */}
      <View style={styles.priceWrap}>
        <Text style={[styles.price, isSelected && styles.priceSelected]}>
          {price}
        </Text>
        {isSelected && (
          <View style={styles.check}>
            <Feather name="check" size={14} color={palette.cream} />
          </View>
        )}
      </View>

      {/* Badge */}
      {badge ? (
        <View style={[styles.badge, isSelected && styles.badgeSelected]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 22,
    paddingLeft: 22,
    overflow: 'visible',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: palette.terracotta,
    backgroundColor: `${palette.terracotta}0D`,
  },
  cardUnselected: {
    borderWidth: 1.5,
    borderColor: `${palette.brown}15`,
    backgroundColor: `${palette.brown}06`,
  },
  accentBar: {
    position: 'absolute',
    left: 8,
    top: 12,
    bottom: 12,
    width: 3.5,
    borderRadius: 2,
    backgroundColor: palette.terracotta,
  },
  content: {
    flex: 1,
    gap: 3,
    paddingLeft: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: '500',
    fontFamily: Fonts.serif,
    color: palette.brown,
  },
  nameSelected: {
    color: palette.brown,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: `${palette.brown}80`,
  },
  subtitleSelected: {
    color: palette.terracotta,
  },
  priceWrap: {
    alignItems: 'flex-end',
    gap: 6,
  },
  price: {
    fontSize: 18,
    fontWeight: '500',
    fontFamily: Fonts.mono,
    color: `${palette.brown}80`,
  },
  priceSelected: {
    color: palette.terracotta,
    fontWeight: '600',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: palette.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

/**
 * The onboarding primary CTA — one shared pill, two faces: `outline`
 * (default — no fill, dark border and label) and `filled` (solid
 * terracotta with cream label, for the screens whose CTA is the star).
 */
export default function CtaButton({
  label,
  onPress,
  color = palette.brown,
  variant = 'outline',
  style,
}: {
  label: string;
  onPress: () => void;
  /** Outline border + label colour — e.g. cream on the dark quiz screens. */
  color?: string;
  variant?: 'outline' | 'filled';
  style?: StyleProp<ViewStyle>;
}) {
  const filled = variant === 'filled';
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.button,
        filled
          ? { backgroundColor: palette.terracotta, borderColor: palette.terracotta }
          : { borderColor: color },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.label, { color: filled ? palette.cream : color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 100,
    borderWidth: 1.5,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  label: {
    fontFamily: Fonts?.serif,
    fontSize: 19,
    fontWeight: '400',
  },
});

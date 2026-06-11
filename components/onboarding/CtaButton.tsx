import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

/**
 * The onboarding primary CTA — one shared pill for every "begin" /
 * "try nothing" / "bring my minute back" across the flow: big, outlined
 * (no fill — the bg shows through), dark border and dark label.
 */
export default function CtaButton({
  label,
  onPress,
  color = palette.brown,
  style,
}: {
  label: string;
  onPress: () => void;
  /** Border + label colour — e.g. cream on the dark quiz screens. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, { borderColor: color }, style]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
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

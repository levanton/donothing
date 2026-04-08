import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { palette } from '@/lib/theme';

type Variant = 'outline' | 'filled' | 'chip';
type Size = 'small' | 'medium' | 'large';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  /** Text & border color for outline; bg color for filled */
  color: string;
  variant?: Variant;
  size?: Size;
  /** Override background color (for filled/chip) */
  bg?: string;
  flex?: boolean;
  style?: ViewStyle;

  // Legacy props — kept for backwards compatibility
  filled?: boolean;
  fillColor?: string;
  chipBg?: string;
  small?: boolean;
  outline?: boolean;
}

export default function PillButton({
  label, onPress, color,
  variant: variantProp, size: sizeProp, bg,
  flex, style,
  // legacy
  filled, fillColor, chipBg, small, outline,
}: PillButtonProps) {
  // Resolve variant from legacy props if not explicitly set
  const variant: Variant = variantProp ?? (outline ? 'outline' : filled ? 'filled' : 'chip');
  const size: Size = sizeProp ?? (small ? 'small' : 'medium');

  const sizeStyle = SIZE_STYLES[size];

  if (variant === 'outline') {
    const bgColor = bg ?? 'transparent';
    return (
      <Pressable
        onPress={onPress}
        style={[styles.base, sizeStyle.outline, flex && { flex: 1 }, { borderColor: color, backgroundColor: bgColor }, style]}
      >
        <Text style={[styles.baseText, sizeStyle.text, { color }]}>{label}</Text>
      </Pressable>
    );
  }

  if (variant === 'filled') {
    const bgColor = bg ?? fillColor ?? color;
    const textColor = bg ? color : palette.cream;
    return (
      <Pressable
        onPress={onPress}
        style={[styles.base, sizeStyle.filled, flex && { flex: 1 }, { backgroundColor: bgColor, borderColor: bgColor }, style]}
      >
        <Text style={[styles.baseText, sizeStyle.text, { color: textColor }]}>{label}</Text>
      </Pressable>
    );
  }

  // chip
  const bgColor = bg ?? chipBg ?? palette.cream;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, sizeStyle.chip, flex && { flex: 1 }, { backgroundColor: bgColor, borderColor: bgColor }, style]}
    >
      <Text style={[styles.baseText, sizeStyle.text, { color: filled ? palette.cream : palette.charcoal }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
  },
  baseText: {
    fontWeight: '400',
    letterSpacing: 0.3,
  },
});

const SIZE_STYLES = {
  small: StyleSheet.create({
    outline: { borderWidth: 1.5, borderRadius: 100, paddingVertical: 8, paddingHorizontal: 16 },
    filled: { borderWidth: 0, borderRadius: 100, paddingVertical: 8, paddingHorizontal: 16 },
    chip: { borderWidth: 0, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
    text: { fontSize: 12 },
  }),
  medium: StyleSheet.create({
    outline: { borderWidth: 1.5, borderRadius: 100, paddingVertical: 14, paddingHorizontal: 28 },
    filled: { borderWidth: 0, borderRadius: 100, paddingVertical: 14, paddingHorizontal: 28 },
    chip: { borderWidth: 0, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 18 },
    text: { fontSize: 16 },
  }),
  large: StyleSheet.create({
    outline: { borderWidth: 1.5, borderRadius: 100, paddingVertical: 14, paddingHorizontal: 48 },
    filled: { borderWidth: 0, borderRadius: 100, paddingVertical: 14, paddingHorizontal: 48 },
    chip: { borderWidth: 0, borderRadius: 100, paddingVertical: 14, paddingHorizontal: 48 },
    text: { fontSize: 18 },
  }),
};

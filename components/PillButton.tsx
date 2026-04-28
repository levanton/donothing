import { Pressable, StyleSheet, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { palette } from '@/lib/theme';

type Variant = 'outline' | 'filled' | 'chip';
type Size = 'small' | 'medium' | 'large';
type FeatherName = ComponentProps<typeof Feather>['name'];

interface PillButtonProps {
  label: string;
  onPress: () => void;
  /** Text & border color for outline; bg color for filled */
  color: string;
  variant?: Variant;
  size?: Size;
  /** Override background color (for filled/chip) */
  bg?: string;
  /** Optional leading icon (Feather name). */
  icon?: FeatherName;
  flex?: boolean;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;

  // Legacy boolean shortcuts — both call sites use `outline` / `filled`
  // instead of `variant="..."`. Kept; the rest were removed as dead.
  filled?: boolean;
  outline?: boolean;
}

const ICON_SIZE_BY_SIZE: Record<Size, number> = { small: 14, medium: 16, large: 18 };
const GAP_BY_SIZE: Record<Size, number> = { small: 6, medium: 8, large: 10 };

export default function PillButton({
  label, onPress, color,
  variant: variantProp, size: sizeProp, bg,
  icon, flex, style, labelStyle,
  filled, outline,
}: PillButtonProps) {
  const variant: Variant = variantProp ?? (outline ? 'outline' : filled ? 'filled' : 'chip');
  const size: Size = sizeProp ?? 'medium';

  const sizeStyle = SIZE_STYLES[size];

  const renderInner = (textColor: string) => {
    const text = (
      <Text style={[styles.baseText, sizeStyle.text, { color: textColor }, labelStyle]}>{label}</Text>
    );
    if (!icon) return text;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP_BY_SIZE[size] }}>
        <Feather name={icon} size={ICON_SIZE_BY_SIZE[size]} color={textColor} />
        {text}
      </View>
    );
  };

  if (variant === 'outline') {
    const bgColor = bg ?? 'transparent';
    return (
      <Pressable
        onPress={onPress}
        style={[styles.base, sizeStyle.outline, flex && { flex: 1 }, { borderColor: color, backgroundColor: bgColor }, style]}
      >
        {renderInner(color)}
      </Pressable>
    );
  }

  if (variant === 'filled') {
    const bgColor = bg ?? color;
    const textColor = bg ? color : palette.cream;
    return (
      <Pressable
        onPress={onPress}
        style={[styles.base, sizeStyle.filled, flex && { flex: 1 }, { backgroundColor: bgColor, borderColor: bgColor }, style]}
      >
        {renderInner(textColor)}
      </Pressable>
    );
  }

  // chip
  const bgColor = bg ?? palette.cream;
  const chipTextColor = filled ? palette.cream : palette.charcoal;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, sizeStyle.chip, flex && { flex: 1 }, { backgroundColor: bgColor, borderColor: bgColor }, style]}
    >
      {renderInner(chipTextColor)}
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
    outline: { borderWidth: 1.75, borderRadius: 100, paddingVertical: 10, paddingHorizontal: 24, alignSelf: 'flex-end' },
    filled: { borderWidth: 0, borderRadius: 100, paddingVertical: 10, paddingHorizontal: 24, alignSelf: 'flex-end' },
    chip: { borderWidth: 0, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, alignSelf: 'flex-end' },
    text: { fontSize: 14, fontWeight: '500' },
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

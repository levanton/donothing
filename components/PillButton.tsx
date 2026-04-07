import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { palette } from '@/lib/theme';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  color: string;
  filled?: boolean;
  fillColor?: string;
  flex?: boolean;
  small?: boolean;
  outline?: boolean;
  style?: ViewStyle;
}

export default function PillButton({ label, onPress, color, filled, fillColor, flex, small, outline, style }: PillButtonProps) {
  // Outline pill — border + text in `color`, transparent bg
  if (outline) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.pill, small && styles.chipSmall, flex && { flex: 1 }, { borderColor: color }, style]}
      >
        <Text style={[styles.pillText, small && styles.textSmall, { color }]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  // Chip — filled bg, rounded rect
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        small && styles.chipSmall,
        flex && { flex: 1 },
        filled
          ? { backgroundColor: fillColor ?? color, borderColor: fillColor ?? color }
          : { backgroundColor: palette.cream, borderColor: palette.cream },
        style,
      ]}
    >
      <Text style={[
        styles.text,
        small && styles.textSmall,
        { color: filled ? palette.cream : palette.charcoal },
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 0,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  chipSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: {
    fontSize: 14,
    letterSpacing: 0.3,
    fontWeight: '400',
  },
  textSmall: {
    fontSize: 12,
  },
  pill: {
    borderWidth: 1.5,
    borderRadius: 100,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  pillText: {
    fontSize: 16,
    letterSpacing: 0.3,
    fontWeight: '400',
  },
});

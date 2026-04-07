import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { palette } from '@/lib/theme';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  color: string;
  filled?: boolean;
  fillColor?: string;
  flex?: boolean;
  small?: boolean;
  blur?: boolean;
  style?: ViewStyle;
}

export default function PillButton({ label, onPress, color, filled, fillColor, flex, small, blur, style }: PillButtonProps) {
  if (blur) {
    return (
      <Pressable
        onPress={onPress}
        style={[styles.blurPill, small && styles.pillSmall, flex && { flex: 1 }, { borderColor: color }, style]}
      >
        <BlurView intensity={40} tint="default" style={StyleSheet.absoluteFill} />
        <Text style={[styles.text, small && styles.textSmall, { color }]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        small && styles.pillSmall,
        flex && { flex: 1 },
        filled
          ? { backgroundColor: fillColor ?? color, borderColor: fillColor ?? color }
          : { borderColor: color },
        style,
      ]}
    >
      <Text style={[
        styles.text,
        small && styles.textSmall,
        { color: filled ? palette.white : color },
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1.5,
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 25,
    alignItems: 'center',
  },
  pillSmall: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  text: {
    fontSize: 16,
    letterSpacing: 0.5,
    fontWeight: '400',
  },
  textSmall: {
    fontSize: 13,
  },
  blurPill: {
    borderWidth: 1.5,
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 25,
    alignItems: 'center',
    overflow: 'hidden',
  },
});

import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  color: string;
  filled?: boolean;
  fillColor?: string;
  flex?: boolean;
  small?: boolean;
  style?: ViewStyle;
}

export default function PillButton({ label, onPress, color, filled, fillColor, flex, small, style }: PillButtonProps) {
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
        { color: filled ? '#fff' : color },
      ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1.5,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  pillSmall: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  text: {
    fontSize: 15,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  textSmall: {
    fontSize: 13,
  },
});

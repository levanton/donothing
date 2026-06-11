import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { palette } from '@/lib/theme';

/**
 * The onboarding "next" arrow — a filled brand circle (the outline version
 * disappeared into the bg). Positioning is the caller's job via `style`.
 */
export default function CircleNextButton({
  onPress,
  style,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, style]}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Continue"
    >
      <Feather name="arrow-right" size={22} color={palette.cream} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: palette.terracotta,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

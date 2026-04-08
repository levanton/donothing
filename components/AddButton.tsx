import { Pressable, StyleSheet, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { AppTheme } from '@/lib/theme';

interface Props {
  label: string;
  onPress: () => void;
  theme: AppTheme;
  disabled?: boolean;
}

export default function AddButton({ label, onPress, theme, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, { borderColor: theme.textTertiary, opacity: disabled ? 0.4 : 1 }]}
    >
      <Feather name="plus" size={14} color={theme.text} />
      <Text style={[styles.text, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderRadius: 100,
  },
  text: { fontSize: 14, fontWeight: '300' },
});

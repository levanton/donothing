import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { palette } from '@/lib/theme';

interface Props {
  options: string[];
  selected: string[];
  onSelect: (selected: string[]) => void;
  multi?: boolean;
  color: string;
  chipBg?: string;
  small?: boolean;
}

export default function ChipSelect({
  options,
  selected,
  onSelect,
  multi = false,
  color,
  chipBg,
  small = false,
}: Props) {
  const handlePress = (opt: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (multi) {
      const next = selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt];
      onSelect(next);
    } else {
      onSelect([opt]);
    }
  };

  return (
    <View style={styles.container}>
      {options.map((opt, idx) => {
        const isSelected = selected.includes(opt);
        return (
          <Animated.View
            key={opt}
            entering={FadeInDown.delay(idx * 100).duration(400)}
          >
            <Pressable
              onPress={() => handlePress(opt)}
              style={[
                styles.chip,
                small && styles.chipSmall,
                isSelected
                  ? { backgroundColor: palette.terracotta, borderColor: palette.terracotta }
                  : { backgroundColor: chipBg ?? palette.cream, borderColor: chipBg ?? palette.cream },
              ]}
            >
              <Text style={[
                styles.text,
                small && styles.textSmall,
                { color: isSelected ? palette.cream : palette.charcoal },
              ]}>
                {opt}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  chip: {
    borderWidth: 0,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginBottom: 2,
  },
  chipSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  text: {
    fontSize: 16,
    letterSpacing: 0.3,
    fontWeight: '400',
  },
  textSmall: {
    fontSize: 12,
  },
});

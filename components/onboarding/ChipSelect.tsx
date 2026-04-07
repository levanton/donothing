import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import PillButton from '@/components/PillButton';
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
      {options.map((opt, idx) => (
        <Animated.View
          key={opt}
          entering={FadeInDown.delay(idx * 100).duration(400)}
        >
          <PillButton
            label={opt}
            onPress={() => handlePress(opt)}
            color={color}
            filled={selected.includes(opt)}
            fillColor={palette.terracotta}
            chipBg={chipBg}
            small={small}
            style={styles.chip}
          />
        </Animated.View>
      ))}
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
    marginBottom: 2,
  },
});

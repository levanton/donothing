import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ChipSelect from '../ChipSelect';
import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';
import { SCREENS, GOAL_BY_SCREEN_TIME } from '@/lib/onboarding-data';

const screen = SCREENS.find((s) => s.id === 'setGoal')!;

interface Props {
  isActive: boolean;
  onNext: () => void;
  selected: string[];
  onSelect: (val: string[]) => void;
  screenTimeAnswer: string;
  theme: { text: string; bg: string };
}

export default function SetGoalScreen({
  isActive,
  onNext,
  selected,
  onSelect,
  screenTimeAnswer,
  theme,
}: Props) {
  // Pre-select based on screen time answer
  useEffect(() => {
    if (isActive && selected.length === 0 && screenTimeAnswer) {
      const recommended = GOAL_BY_SCREEN_TIME[screenTimeAnswer];
      if (recommended) {
        onSelect([`${recommended}m`]);
      }
    }
  }, [isActive, screenTimeAnswer]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.heading, { color: theme.text, fontFamily: Fonts?.serif }]}>
        {screen.heading}
      </Text>
      <Text style={[styles.body, { color: theme.text }]}>
        {screen.body}
      </Text>

      <View style={styles.chips}>
        {isActive && (
          <ChipSelect
            options={screen.options!}
            selected={selected}
            onSelect={onSelect}
            color={theme.text}
            chipBg={palette.white}
          />
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 36,
  },
  chips: {
    minHeight: 80,
  },
});

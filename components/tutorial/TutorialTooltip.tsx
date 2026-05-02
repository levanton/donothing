import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCopilot, type TooltipProps } from 'react-native-copilot';
import { useAppStore } from '@/lib/store';
import { themes } from '@/lib/theme';
import { Fonts } from '@/constants/theme';
import { TUTORIAL_TOTAL_STEPS } from '@/lib/tutorial/steps';

// Pill-shaped tooltip painted in the app's terracotta accent. Layout:
// step text on top, then a thin progress bar with a small cream "next"
// chip tucked to its right (becomes "done" on the last step). Tapping
// the chip advances the tour; the chip is the only interactive bit so
// the user always knows where to press.

export function TutorialTooltip(_: TooltipProps) {
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themes[themeMode];
  const { currentStep, currentStepNumber, isLastStep, goToNext, stop } = useCopilot();

  if (!currentStep) return null;

  const progress = Math.max(0, Math.min(1, currentStepNumber / TUTORIAL_TOTAL_STEPS));
  const label = isLastStep ? 'done' : 'next';

  return (
    <View style={[styles.pill, { backgroundColor: theme.accent }]}>
      <Text style={[styles.text, { color: theme.accentText }]}>
        {currentStep.text}
      </Text>
      <View style={styles.bottomRow}>
        <View style={[styles.progressTrack, { backgroundColor: `${theme.accentText}33` }]}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: theme.accentText, width: `${progress * 100}%` },
            ]}
          />
        </View>
        <Pressable
          onPress={() => {
            if (isLastStep) {
              void stop();
            } else {
              void goToNext();
            }
          }}
          hitSlop={10}
          style={({ pressed }) => [
            styles.chip,
            {
              backgroundColor: theme.accentText,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.chipLabel, { color: theme.accent }]}>{label}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 22,
    paddingLeft: 18,
    paddingRight: 6,
    paddingTop: 14,
    paddingBottom: 6,
  },
  text: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 22,
    paddingRight: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginLeft: 4,
  },
  progressFill: {
    height: 5,
    borderRadius: 2.5,
  },
  chip: {
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 999,
  },
  chipLabel: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    letterSpacing: 0.4,
  },
});

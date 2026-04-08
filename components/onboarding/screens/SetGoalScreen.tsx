import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import GoalSliderBar from '@/components/GoalSliderBar';
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
  // Parse initial value from parent's string[] state
  const [localMinutes, setLocalMinutes] = useState(() => {
    if (selected.length > 0) return parseInt(selected[0]) || 0;
    return 0;
  });

  // Pre-select based on screen time answer
  useEffect(() => {
    if (isActive && selected.length === 0 && screenTimeAnswer) {
      const recommended = GOAL_BY_SCREEN_TIME[screenTimeAnswer];
      if (recommended) {
        setLocalMinutes(recommended);
        onSelect([`${recommended}m`]);
      }
    }
  }, [isActive, screenTimeAnswer]);

  const handleSliderChange = useCallback((minutes: number) => {
    setLocalMinutes(minutes);
    if (minutes > 0) {
      onSelect([`${minutes}m`]);
    } else {
      onSelect([]);
    }
  }, [onSelect]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Center section: heading + value */}
      <View style={styles.center}>
        <Text style={[styles.heading, { color: theme.text, fontFamily: Fonts?.serif }]}>
          {screen.heading}
        </Text>
        <Text style={[styles.body, { color: theme.text }]}>
          {screen.body}
        </Text>
        <View style={styles.valueRow}>
          <View style={styles.valueParts}>
            <Text style={[styles.valueNumber, { color: theme.text, fontFamily: Fonts?.serif }]}>
              {localMinutes}
            </Text>
            <Text style={[styles.valueUnit, { color: theme.text, fontFamily: Fonts?.serif }]}>
              {' '}min
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom section: slider */}
      <View style={styles.slider}>
        {isActive && (
          <GoalSliderBar
            value={localMinutes}
            onChange={handleSliderChange}
            theme={theme}
            maxMinutes={90}
            ticks={[5, 10, 15, 30, 45, 60]}
            scaleLabels={['0', '5', '10', '15', '30', '45', '60', '90']}
            accentColor={palette.terracotta}
            hideLabel
            sliderHeight={36}
            thumbRadius={10}
            trackStrokeWidth={3}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
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
  },
  valueRow: {
    alignItems: 'center',
    marginTop: 40,
  },
  valueParts: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  valueNumber: {
    fontSize: 72,
    fontWeight: '300',
  },
  valueUnit: {
    fontSize: 28,
    fontWeight: '300',
  },
  slider: {
    marginTop: 80,
    paddingBottom: 40,
  },
});

import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';
import { GOAL_MINUTES } from '@/lib/onboarding-data';

interface Props {
  isActive: boolean;
  onNext: () => void;
  painPoints: string[];
  screenTime: string;
  goal: string;
  theme: { text: string; bg: string };
}

export default function PersonalizedResultScreen({
  isActive,
  onNext,
  painPoints,
  screenTime,
  goal,
  theme,
}: Props) {
  const goalMinutes = GOAL_MINUTES[goal] ?? (parseInt(goal) || 5);

  const lines = [
    { icon: 'target' as const, text: `Goal: ${goalMinutes} min/day` },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.heading, { color: theme.text, fontFamily: Fonts?.serif }]}>
        Your plan is ready.
      </Text>

      <View style={styles.card}>
        {isActive &&
          lines.map((line, idx) => (
            <Animated.View
              key={line.text}
              entering={FadeInUp.delay(idx * 300 + 200).duration(500)}
              style={styles.lineRow}
            >
              <Feather name="check" size={20} color={palette.terracotta} />
              <View style={styles.lineContent}>
                <Feather name={line.icon} size={16} color={theme.text} />
                <Text style={[styles.lineText, { color: theme.text }]}>{line.text}</Text>
              </View>
            </Animated.View>
          ))}
      </View>

      {isActive && (
        <Animated.Text
          entering={FadeInUp.delay(900).duration(600)}
          style={[styles.personalized, { color: theme.text }]}
        >
          Based on your {screenTime || '4–5h'} screen time, even {goalMinutes} minutes of nothing will make a difference.
        </Animated.Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  heading: {
    fontSize: 32,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 40,
  },
  card: {
    gap: 20,
    marginBottom: 40,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  lineText: {
    fontSize: 18,
    fontWeight: '400',
  },
  personalized: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Fonts?.serif,
  },
});

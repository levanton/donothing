import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';
import { HOW_IT_WORKS_STEPS } from '@/lib/onboarding-data';

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function HowItWorksScreen({ isActive, onNext, theme }: Props) {
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.heading, { color: theme.text, fontFamily: Fonts?.serif }]}>
        Here's how it works
      </Text>

      <View style={styles.steps}>
        {isActive &&
          HOW_IT_WORKS_STEPS.map((step, idx) => (
            <Animated.View
              key={step.text}
              entering={FadeInUp.delay(idx * 400).duration(500)}
              style={styles.stepRow}
            >
              <View style={[styles.iconCircle, { borderColor: theme.text }]}>
                <Feather name={step.icon} size={20} color={theme.text} />
              </View>
              <Text style={[styles.stepText, { color: theme.text, fontFamily: Fonts?.serif }]}>
                {step.text}
              </Text>
            </Animated.View>
          ))}
      </View>
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
    fontSize: 24,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 48,
    opacity: 0.7,
  },
  steps: {
    gap: 28,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  stepText: {
    fontSize: 22,
    fontWeight: '300',
    flex: 1,
  },
});

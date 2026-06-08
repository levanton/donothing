import { palette } from '@/lib/theme';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_BODY_BOLD, onboardingText } from '../textStyles';

const HEADING = 'what if…';

interface LineSpec {
  text: string;
  bold?: boolean;
  accent?: boolean;
  paragraph?: boolean;
}

const LINES: LineSpec[] = [
  { text: 'you just stopped?' },
  { text: 'did nothing. like you used to.' },
  { text: 'even one minute a day', paragraph: true },
  { text: 'can change everything.', bold: true, accent: true },
];

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function PhoneSymptomScreen({ theme }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 72, paddingBottom: insets.bottom },
        ]}
      >
        <Text style={[onboardingText.heading, styles.heading, { color: theme.text }]}>
          {HEADING}
        </Text>

        <View style={styles.body}>
          {LINES.map((spec, i) => (
            <Text
              key={i}
              style={[
                onboardingText.line,
                { color: spec.accent ? palette.terracotta : theme.text },
                spec.bold && ONBOARDING_BODY_BOLD,
                spec.paragraph && { marginTop: 18 },
              ]}
            >
              {spec.text}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 24,
    justifyContent: 'flex-start',
  },
  heading: {
    marginBottom: 14,
  },
  body: {},
});

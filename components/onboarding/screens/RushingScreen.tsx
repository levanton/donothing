import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_BODY_BOLD, onboardingText } from '../textStyles';

const HEADING = 'now.';

interface LineSpec {
  text: string;
  bold?: boolean;
  paragraph?: boolean;
}

const LINES: LineSpec[] = [
  { text: 'so much to do.' },
  { text: 'so many things calling.' },
  { text: 'so much pressure.' },
  { text: 'it keeps us busy.', paragraph: true },
  { text: 'but never really here.' },
  { text: 'days, months, years — gone in a blur.', bold: true, paragraph: true },
];

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function RushingScreen({ theme }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.content, { paddingTop: insets.top + 72, paddingBottom: insets.bottom }]}>
        <Text style={[onboardingText.heading, styles.heading, { color: theme.text }]}>
          {HEADING}
        </Text>

        <View style={styles.body}>
          {LINES.map((spec, i) => (
            <Text
              key={i}
              style={[
                onboardingText.line,
                { color: theme.text },
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

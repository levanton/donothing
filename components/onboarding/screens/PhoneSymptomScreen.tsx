import { palette } from '@/lib/theme';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ONBOARDING_BODY_BOLD, onboardingText } from '../textStyles';
import { getDotFieldLayout } from '../dotFieldLayout';

const HEADING = 'what if…';

interface LineSpec {
  text: string;
  bold?: boolean;
  accent?: boolean;
  paragraph?: boolean;
}

const LINES: LineSpec[] = [
  { text: 'for one minute,' },
  { text: 'you stopped.' },
  { text: 'put the world on pause.', paragraph: true },
  { text: 'and just be.' },
  { text: 'even one minute a day', paragraph: true },
  { text: 'can change your life.', bold: true, accent: true },
];

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function PhoneSymptomScreen({ theme }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const field = getDotFieldLayout(width, height);

  // No own background: the route container already paints the page bg. An
  // opaque sheet here would ride up with the page and cover the outgoing
  // "now." text during the hand-off.
  return (
    <View style={styles.container}>
      {/* The dot field sits in the upper band here, so the text fills the
          space below it, clear of the bottom continue pill. */}
      <View
        style={[
          styles.content,
          {
            top: field.highTop + field.size,
            paddingBottom: insets.bottom + 104,
          },
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  heading: {
    marginBottom: 14,
  },
  body: {},
});

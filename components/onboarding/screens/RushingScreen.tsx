import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onboardingText } from '../textStyles';
import { getDotFieldLayout } from '../dotFieldLayout';
import { buildSchedule, Word, type Cadence, type WordLine } from '../WordReveal';

const HEADING = 'now.';

// The rush, embodied: words snap in fast and relentless — the opposite of
// the nostalgia screen's lazy melt. The rapid trail of selection ticks under
// the fingers IS the restlessness the copy describes.
const CADENCE: Cadence = {
  startMs: 800,
  wordStepMs: 130,
  linePauseMs: 200,
  paragraphPauseMs: 500,
  fadeMs: 350,
  settleScale: 1.03,
};
const HEADING_DELAY_MS = 300;
// The final line breaks the tempo: after all the hurry, "days, months,
// years — gone in a blur." lands slow and heavy, every word a thud.
const FINAL_LINE_STEP_MS = 320;

const LINES: WordLine[] = [
  { words: [{ text: 'so' }, { text: 'much' }, { text: 'to' }, { text: 'do.' }] },
  { words: [{ text: 'so' }, { text: 'many' }, { text: 'things' }, { text: 'calling.' }] },
  { words: [{ text: 'so' }, { text: 'much' }, { text: 'pressure.' }] },
  { words: [{ text: 'it' }, { text: 'keeps' }, { text: 'us' }, { text: 'busy.' }], paragraph: true },
  { words: [{ text: 'but' }, { text: 'never' }, { text: 'really' }, { text: 'here.' }] },
  {
    words: [
      { text: 'days,', strong: true },
      { text: 'months,', strong: true },
      { text: 'years —', strong: true },
      // The payoff arrives as one piece — a blur doesn't come word by word.
      { text: 'gone in a blur.', strong: true },
    ],
    paragraph: true,
    stepMs: FINAL_LINE_STEP_MS,
  },
];

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function RushingScreen({ theme }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const fieldTop = getDotFieldLayout(width, height).lowTop;

  const schedule = useMemo(() => buildSchedule(LINES, CADENCE), []);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 72, height: fieldTop },
        ]}
      >
        <Text style={[onboardingText.heading, styles.heading, { color: theme.text }]}>
          <Word text={HEADING} delay={HEADING_DELAY_MS} cadence={CADENCE} />
        </Text>

        <View style={styles.body}>
          {LINES.map((line, li) => (
            <Text
              key={li}
              style={[
                onboardingText.line,
                { color: theme.text },
                line.paragraph && styles.paragraph,
              ]}
            >
              {line.words.map((w, wi) => (
                <Word key={wi} text={w.text} delay={schedule[li][wi]} cadence={CADENCE} strong={w.strong} />
              ))}
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
    paddingHorizontal: 32,
    paddingBottom: 44,
    justifyContent: 'flex-end',
  },
  heading: {
    marginBottom: 14,
  },
  body: {},
  paragraph: {
    marginTop: 18,
  },
});

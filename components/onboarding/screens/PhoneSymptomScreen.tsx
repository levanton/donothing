import { StyleSheet, View } from 'react-native';

import { DOT_MORPH_MS } from '../dotFieldLayout';
import {
  buildTimetable,
  TeleprompterColumn,
  type TypeLineSpec,
} from '../TypeReveal';

// One flat column — 'what if…' is simply the first line. Same teleprompter
// as the other acts; the dot field stays put in the lower band, so this
// act's focal line sits higher, above it.
const LINES: TypeLineSpec[] = [
  { segs: [{ text: 'what if…' }] },
  { segs: [{ text: 'you could stop time again?' }] },
  { segs: [{ text: 'one minute.' }] },
  { segs: [{ text: 'no phone. no plans.' }] },
  { segs: [{ text: 'just you.' }] },
  { segs: [{ text: 'even one minute a day' }] },
  { segs: [{ text: 'can change everything.', strong: true, accent: true }], stepMs: 65 },
];

// The act fades in over the resting dot field — typing starts after a
// breath.
const START_MS = 1400;

const TIMETABLE = buildTimetable(LINES, START_MS);

/** When the dots resolve into rings: the exact moment the payoff line
 *  ("can change everything.") starts typing — the order forms underneath
 *  the words as they land. */
const LAST = TIMETABLE.lines[TIMETABLE.lines.length - 1];
export const WHATIF_RINGS_AT_MS = LAST.glideAt + LAST.glideDur;

/** When the whole 'what if…' performance is over: text typed AND the
 *  scatter→rings morph has settled. */
export const WHATIF_DONE_MS = Math.max(
  TIMETABLE.end,
  WHATIF_RINGS_AT_MS + DOT_MORPH_MS,
);

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function PhoneSymptomScreen({ theme }: Props) {
  // No own background: the route container already paints the page bg, and
  // the persistent dot field must stay visible under the swapping acts.
  return (
    <View style={styles.container}>
      <TeleprompterColumn timetable={TIMETABLE} color={theme.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

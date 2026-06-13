import { StyleSheet, View } from 'react-native';

import { buildTimetable, TeleprompterColumn, type TypeLineSpec } from '../TypeReveal';

// One flat column — 'now.' is simply the first line. The act keeps its own
// dramaturgy: the turn ("but never really here.") and the payoff line type
// slower — each letter a heavier beat.
const LINES: TypeLineSpec[] = [
  { segs: [{ text: 'now.' }] },
  { segs: [{ text: 'one more task.' }] },
  { segs: [{ text: 'one more message.' }] },
  { segs: [{ text: 'one more day gone.' }] },
  { segs: [{ text: 'it keeps us busy.' }] },
  { segs: [{ text: 'but never really here.' }], stepMs: 65 },
  // The payoff lands in two breaths — the dash stays with the clause it
  // belongs to (never the start of a line), then the blur falls on its own.
  { segs: [{ text: 'days, months, years —', strong: true }], stepMs: 80 },
  { segs: [{ text: 'gone in a blur.', strong: true }], stepMs: 80 },
];

// The act crossfades in — typing starts once the fade has settled.
const START_MS = 1400;

const TIMETABLE = buildTimetable(LINES, START_MS);

/** The dot field arrives WITH the last line — it starts trickling in the
 *  moment the payoff line begins typing. The text stays put; the field
 *  has its own area. */
const LAST = TIMETABLE.lines[TIMETABLE.lines.length - 1];
export const NOW_DOTS_DELAY_MS = LAST.glideAt + LAST.glideDur;
/** Duration of the field's rise from below. */
export const NOW_DOTS_ENTER_MS = 1100;
/** When the whole 'now.' performance is over: the rise has landed and the
 *  field's dots have finished trickling in (3200 = RadialDots' reveal). */
export const NOW_DONE_MS = NOW_DOTS_DELAY_MS + 3200;

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function RushingScreen({ theme }: Props) {
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <TeleprompterColumn timetable={TIMETABLE} color={theme.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

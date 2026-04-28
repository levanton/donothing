import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

interface EyebrowChipProps {
  text: string;
  /** Pill background. Defaults to warm sand to match BlockSheet /
   *  SessionEndedSheet. */
  bg?: string;
  /** Text colour. Defaults to brown. */
  color?: string;
}

/**
 * Tracked uppercase serif label on a soft pill — used as the eyebrow
 * label on sheets ("YOUR APPS ARE LOCKED", "PAUSED"). Encapsulates the
 * shared styling so spacing and typography stay consistent across
 * sheets.
 */
export default function EyebrowChip({
  text,
  bg = palette.sand,
  color = palette.brown,
}: EyebrowChipProps) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color, fontFamily: Fonts!.serif }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});

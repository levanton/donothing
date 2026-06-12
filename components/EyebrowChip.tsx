import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
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
  /** Optional leading icon (Feather name), drawn in the text colour. */
  icon?: ComponentProps<typeof Feather>['name'];
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
  icon,
}: EyebrowChipProps) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon && <Feather name={icon} size={11} color={color} />}
      <Text style={[styles.text, { color, fontFamily: Fonts!.serif }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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

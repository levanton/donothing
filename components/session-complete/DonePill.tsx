import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

type FeatherName = ComponentProps<typeof Feather>['name'];

interface DonePillProps {
  label: string;
  /** Optional leading icon. */
  icon?: FeatherName;
  /** Pill background. Defaults to cream so it pops against terracotta. */
  bg?: string;
  /** Label colour. Defaults to brown. */
  fg?: string;
  /** Icon colour. Defaults to terracotta. */
  iconColor?: string;
}

/**
 * Cream pill used as the primary "next" button on the SessionComplete
 * screen — main action through benefits/mood phases AND the unlock
 * /done buttons on the farewell beat. Encapsulates the shared shadow,
 * radius and label typography so the three call sites stay aligned.
 */
export default function DonePill({
  label,
  icon,
  bg = palette.cream,
  fg = palette.brown,
  iconColor = palette.terracotta,
}: DonePillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon && (
        <Feather name={icon} size={16} color={iconColor} style={styles.icon} />
      )}
      <Text style={[styles.label, { color: fg, fontFamily: Fonts.serif }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    borderRadius: 100,
    paddingVertical: 18,
    paddingHorizontal: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
  },
  icon: {
    marginTop: 1,
  },
  label: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.6,
  },
});

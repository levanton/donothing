import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import { formatTime12, WEEKDAY_VALUES, WEEKDAY_SHORT } from '@/components/TimePicker';

interface Props {
  hour: number;
  minute: number;
  weekdays?: number[];
  enabled: boolean;
  theme: AppTheme;
  onPress?: () => void;
  onToggle?: () => void;
  onRemove?: () => void;
  /** Extra label below time, e.g. "do nothing for 15 min" */
  subtitle?: string;
}

export default function ReminderCard({
  hour,
  minute,
  weekdays,
  enabled,
  theme,
  onPress,
  onToggle,
  onRemove,
  subtitle,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { borderColor: enabled ? theme.accent : theme.textTertiary }]}
    >
      <View style={styles.cardContent}>
        <Text style={[styles.cardTime, {
          color: enabled ? theme.accent : theme.text,
          fontFamily: Fonts.mono,
        }]}>
          {formatTime12(hour, minute)}
        </Text>
        {subtitle && (
          <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        )}
        <View style={styles.cardDays}>
          {WEEKDAY_VALUES.map((day, i) => {
            const active = !weekdays?.length || weekdays.includes(day);
            return (
              <View key={day} style={styles.cardDayCol}>
                <View style={[styles.cardDot, {
                  backgroundColor: active ? theme.text : 'transparent',
                  borderColor: active ? theme.text : theme.textTertiary,
                }]} />
                <Text style={[styles.cardDayText, {
                  color: active ? theme.text : theme.textTertiary,
                }]}>
                  {WEEKDAY_SHORT[i]}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.cardActions}>
        {onToggle && (
          <Switch
            value={enabled}
            onValueChange={onToggle}
            trackColor={{ false: theme.textTertiary, true: theme.accent }}
            thumbColor={palette.white}
            ios_backgroundColor={enabled ? theme.accent : theme.textTertiary}
            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
          />
        )}
        {onRemove && (
          <Pressable onPress={onRemove} hitSlop={12}>
            <Feather name="x" size={16} color={theme.textTertiary} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.2,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: { gap: 4 },
  cardTime: { fontSize: 28, fontWeight: '300' },
  cardLabel: { fontSize: 12, fontWeight: '300', fontStyle: 'italic' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardDays: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  cardDayCol: {
    alignItems: 'center',
    gap: 2,
  },
  cardDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 2.75,
    borderWidth: 1,
  },
  cardDayText: {
    fontSize: 8,
    fontWeight: '400',
  },
});

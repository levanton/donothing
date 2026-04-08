import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';
import PillButton from '@/components/PillButton';

// ── Weekday helpers ─────────────────────────────────────────────────────
// Expo convention: 1=Sun … 7=Sat, display Mon-first
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const WEEKDAY_SHORT = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
export const WEEKDAY_VALUES = [2, 3, 4, 5, 6, 7, 1]; // Mon…Sun in Expo weekday numbers
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

export function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatTime12(hour: number, minute: number) {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${pad(minute)} ${ampm}`;
}

export function splitTime12(hour: number, minute: number) {
  const h = hour % 12 || 12;
  return { time: `${h}:${pad(minute)}`, ampm: hour < 12 ? 'am' : 'pm' };
}

export function weekdaysLabel(days: number[]): string {
  if (!days.length || days.length === 7) return 'every day';
  const set = new Set(days);
  if (days.length === 5 && [2, 3, 4, 5, 6].every((d) => set.has(d))) return 'weekdays';
  if (days.length === 2 && set.has(1) && set.has(7)) return 'weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return WEEKDAY_VALUES.filter((d) => set.has(d)).map((d) => names[d - 1]).join(', ');
}

// ── TimePickerContent ───────────────────────────────────────────────────
interface TimePickerProps {
  onConfirm: (hour: number, minute: number, weekdays: number[]) => void;
  onCancel: () => void;
  theme: AppTheme;
  title?: string;
  initialHour?: number;
  initialMinute?: number;
  initialDays?: number[];
}

export default function TimePickerContent({
  onConfirm,
  onCancel,
  theme,
  title,
  initialHour,
  initialMinute,
  initialDays,
}: TimePickerProps) {
  const [hour, setHour] = useState(initialHour ?? 9);
  const [minute, setMinute] = useState(initialMinute ?? 0);
  const [selectedDays, setSelectedDays] = useState<number[]>(initialDays ?? ALL_DAYS);

  const toggleDay = (day: number) => {
    Haptics.selectionAsync();
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  };

  const incHour = () => { Haptics.selectionAsync(); setHour((h) => (h + 1) % 24); };
  const decHour = () => { Haptics.selectionAsync(); setHour((h) => (h - 1 + 24) % 24); };
  const incMin = () => { Haptics.selectionAsync(); setMinute((m) => (m + 5) % 60); };
  const decMin = () => { Haptics.selectionAsync(); setMinute((m) => (m - 5 + 60) % 60); };

  return (
    <View style={styles.sheetContent}>
      <Text style={[styles.sheetTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
        {title ?? 'Add reminder'}
      </Text>
      <View style={styles.sheetPickerRow}>
        <View style={styles.sheetPickerCol}>
          <Pressable onPress={incHour} hitSlop={12} style={styles.sheetArrow}>
            <Feather name="chevron-up" size={24} color={theme.textSecondary} />
          </Pressable>
          <Text style={[styles.sheetPickerValue, { color: theme.text, fontFamily: Fonts!.mono }]}>
            {pad(hour)}
          </Text>
          <Pressable onPress={decHour} hitSlop={12} style={styles.sheetArrow}>
            <Feather name="chevron-down" size={24} color={theme.textSecondary} />
          </Pressable>
        </View>
        <Text style={[styles.sheetColon, { color: theme.textTertiary }]}>:</Text>
        <View style={styles.sheetPickerCol}>
          <Pressable onPress={incMin} hitSlop={12} style={styles.sheetArrow}>
            <Feather name="chevron-up" size={24} color={theme.textSecondary} />
          </Pressable>
          <Text style={[styles.sheetPickerValue, { color: theme.text, fontFamily: Fonts!.mono }]}>
            {pad(minute)}
          </Text>
          <Pressable onPress={decMin} hitSlop={12} style={styles.sheetArrow}>
            <Feather name="chevron-down" size={24} color={theme.textSecondary} />
          </Pressable>
        </View>
      </View>
      <View style={styles.dayRow}>
        {WEEKDAY_LABELS.map((label, i) => {
          const day = WEEKDAY_VALUES[i];
          const active = selectedDays.includes(day);
          return (
            <Pressable key={day} onPress={() => toggleDay(day)} hitSlop={4}>
              <View style={[
                styles.dayCircle,
                active
                  ? { backgroundColor: theme.text, borderColor: theme.text }
                  : { backgroundColor: 'transparent', borderColor: theme.textTertiary },
              ]}>
                <Text style={[
                  styles.dayLabel,
                  { color: active ? theme.bg : theme.textSecondary },
                ]}>
                  {label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={{ height: 24 }} />
      <View style={styles.sheetButtons}>
        <PillButton label="cancel" onPress={onCancel} color={theme.textSecondary} outline flex />
        <PillButton label="save" onPress={() => onConfirm(hour, minute, selectedDays)} color={theme.accent} filled flex />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '400',
    marginBottom: 24,
  },
  sheetPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  sheetPickerCol: {
    alignItems: 'center',
    gap: 8,
  },
  sheetArrow: {
    padding: 4,
  },
  sheetPickerValue: {
    fontSize: 36,
    fontWeight: '200',
  },
  sheetColon: {
    fontSize: 36,
    fontWeight: '200',
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dayRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  dayCircle: {
    width: 40,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});

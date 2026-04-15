import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';
import type { BlockGroup } from '@/lib/db/types';
import PillButton from '@/components/PillButton';
import TimeRangeSlider from '@/components/TimeRangeSlider';
import { ALL_DAYS, WEEKDAY_LABELS, WEEKDAY_VALUES } from '@/components/TimePicker';

const MIN_DURATION = 15;
const STEP = 5;

interface BlockPickerProps {
  onConfirm: (hour: number, minute: number, duration: number, weekdays: number[], groupId: string | null) => void;
  onCancel: () => void;
  theme: AppTheme;
  title?: string;
  initialHour?: number;
  initialMinute?: number;
  initialDuration?: number;
  initialDays?: number[];
  initialGroupId?: string | null;
  groups: BlockGroup[];
}

function snap(v: number) {
  return Math.round(v / STEP) * STEP;
}

export default function BlockPickerContent({
  onConfirm,
  onCancel,
  theme,
  title,
  initialHour,
  initialMinute,
  initialDuration,
  initialDays,
  initialGroupId,
  groups,
}: BlockPickerProps) {
  const initStart = snap((initialHour ?? 14) * 60 + (initialMinute ?? 0));
  const initEnd = Math.min(24 * 60, initStart + Math.max(MIN_DURATION, snap(initialDuration ?? MIN_DURATION)));

  const [startMinutes, setStartMinutes] = useState(initStart);
  const [endMinutes, setEndMinutes] = useState(initEnd);
  const [selectedDays, setSelectedDays] = useState<number[]>(initialDays ?? ALL_DAYS);
  const [groupId, setGroupId] = useState<string | null>(initialGroupId ?? null);

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

  const handleRangeChange = (start: number, end: number) => {
    setStartMinutes(start);
    setEndMinutes(end);
  };

  const handleConfirm = () => {
    const hour = Math.floor(startMinutes / 60);
    const minute = startMinutes % 60;
    const duration = Math.max(MIN_DURATION, endMinutes - startMinutes);
    onConfirm(hour, minute, duration, selectedDays, groupId);
  };

  return (
    <View style={styles.sheetContent}>
      <Text style={[styles.sheetTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
        {title ?? 'Add screen block'}
      </Text>

      <TimeRangeSlider
        startMinutes={startMinutes}
        endMinutes={endMinutes}
        onChange={handleRangeChange}
        theme={theme}
        step={STEP}
        minGap={MIN_DURATION}
      />

      <View style={{ height: 20 }} />

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
      <View style={{ height: 16 }} />

      <Text style={[styles.sheetFieldLabel, { color: theme.textTertiary }]}>APPS</Text>
      <View style={styles.groupChipRow}>
        {[{ id: null as string | null, name: 'All apps' }, ...groups].map((g) => {
          const active = groupId === g.id;
          return (
            <Pressable
              key={g.id ?? '__all'}
              onPress={() => {
                Haptics.selectionAsync();
                setGroupId(g.id);
              }}
              style={[styles.groupChip, {
                borderColor: active ? theme.accent : theme.textTertiary,
                backgroundColor: active ? theme.accent : 'transparent',
              }]}
            >
              <Text style={[styles.groupChipLabel, {
                color: active ? theme.accentText : theme.textSecondary,
              }]}>
                {g.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: 24 }} />
      <View style={styles.sheetButtons}>
        <PillButton label="cancel" onPress={onCancel} color={theme.textSecondary} outline flex />
        <PillButton label="add" onPress={handleConfirm} color={theme.accent} filled flex />
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
  sheetButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  sheetFieldLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    marginBottom: 10,
    alignSelf: 'flex-start',
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
  groupChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  groupChip: {
    borderWidth: 1.2,
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  groupChipLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
});

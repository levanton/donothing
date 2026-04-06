import { useState, useMemo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import { formatTimeShort } from '@/lib/format';
import { getMonthDurations } from '@/lib/db/sessions';
import { useAppStore } from '@/lib/store';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface ActivityCalendarProps {
  theme: any;
}

export default function ActivityCalendar({ theme }: ActivityCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Subscribe to weekStats so calendar re-renders when session data changes
  const weekStats = useAppStore((s) => s.weekStats);

  const todayKey = dateKey(today);
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  // Build session duration map from DB
  // weekStats in deps ensures recalculation when sessions change
  const durationMap = useMemo(() => {
    return getMonthDurations(viewYear, viewMonth + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, weekStats]);

  // Find max duration for the viewed month (for proportional intensity)
  const maxDuration = useMemo(() => {
    let max = 0;
    for (const dur of durationMap.values()) {
      if (dur > max) max = dur;
    }
    return max || 1;
  }, [durationMap]);

  // Build calendar grid for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Monday = 0, Sunday = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: Array<{ day: number; key: string } | null> = [];

    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
      cells.push(null);
    }

    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      cells.push({ day: d, key: dateKey(date) });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const goToPrevMonth = useCallback(() => {
    Haptics.selectionAsync();
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDate(null);
  }, [viewYear, viewMonth]);

  const goToNextMonth = useCallback(() => {
    if (isCurrentMonth) return;
    Haptics.selectionAsync();
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDate(null);
  }, [viewYear, viewMonth, isCurrentMonth]);

  const selectedDuration = selectedDate ? durationMap.get(selectedDate) || 0 : 0;

  return (
    <View style={styles.container}>
      {/* Month navigation */}
      <View style={styles.monthRow}>
        <Pressable onPress={goToPrevMonth} hitSlop={16}>
          <Feather name="chevron-left" size={20} color={theme.textSecondary} />
        </Pressable>
        <Text style={[styles.monthLabel, { color: theme.text, fontFamily: Fonts!.serif }]}>
          {MONTH_NAMES[viewMonth]}{!isCurrentMonth || viewYear !== today.getFullYear() ? ` ${viewYear}` : ''}
        </Text>
        <Pressable onPress={goToNextMonth} hitSlop={16}>
          <Feather
            name="chevron-right"
            size={20}
            color={isCurrentMonth ? theme.border : theme.textSecondary}
          />
        </Pressable>
      </View>

      {/* Day-of-week headers */}
      <View style={styles.weekHeader}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={[styles.weekHeaderLabel, { color: theme.textTertiary }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.grid}>
        {calendarDays.map((cell, i) => {
          if (!cell) {
            return <View key={`empty-${i}`} style={styles.cell} />;
          }

          const duration = durationMap.get(cell.key) || 0;
          const isToday = cell.key === todayKey;
          const isSelected = cell.key === selectedDate;
          const isFuture = cell.key > todayKey;
          const intensity = duration > 0 ? 0.2 + 0.8 * (duration / maxDuration) : 0;

          return (
            <Pressable
              key={cell.key}
              style={styles.cell}
              onPress={() => {
                if (isFuture) return;
                Haptics.selectionAsync();
                setSelectedDate(isSelected ? null : cell.key);
              }}
            >
              <View style={[
                styles.dayCircle,
                isSelected && { borderWidth: 1, borderColor: theme.text },
              ]}>
                {duration > 0 && (
                  <View style={[styles.activityBubble, {
                    width: Math.max(24, 8 + intensity * 28),
                    height: Math.max(24, 8 + intensity * 28),
                    borderRadius: Math.max(24, 8 + intensity * 28) / 2,
                    backgroundColor: theme.accent,
                  }]} />
                )}
                <Text style={[
                  styles.dayNumber,
                  {
                    color: isFuture ? theme.border : duration > 0 ? palette.white : theme.text,
                    fontFamily: Fonts!.serif,
                  },
                ]}>
                  {cell.day}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Selected day detail */}
      {selectedDate && (
        <View style={[styles.selectedDetail, { backgroundColor: theme.accent + '15', borderColor: theme.accent + '30' }]}>
          <Text style={[styles.selectedDate, { color: theme.text, fontFamily: Fonts!.serif }]}>
            {formatSelectedDate(selectedDate)}
          </Text>
          <Text style={[styles.selectedDuration, { color: selectedDuration > 0 ? theme.accent : theme.textTertiary, fontFamily: Fonts!.serif }]}>
            {selectedDuration > 0 ? formatTimeShort(selectedDuration) : 'no sessions'}
          </Text>
        </View>
      )}
    </View>
  );
}

function formatSelectedDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '400',
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekHeaderLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '300',
    zIndex: 1,
    position: 'absolute',
  },
  activityBubble: {
    position: 'absolute',
  },
  selectedDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  selectedDate: {
    fontSize: 16,
    fontWeight: '400',
  },
  selectedDuration: {
    fontSize: 20,
    fontWeight: '300',
  },
});

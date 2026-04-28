import { useState, useMemo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import { palette, type AppTheme } from '@/lib/theme';
import { formatTimeShort } from '@/lib/format';
import { getMonthDurations, getSessionsByDateRange } from '@/lib/db/sessions';
import type { Session } from '@/lib/db/types';
import { useAppStore } from '@/lib/store';
import { WEEKDAY_LABELS } from '@/lib/weekdays';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

interface ActivityCalendarProps {
  theme: AppTheme;
}

export default function ActivityCalendar({ theme }: ActivityCalendarProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const weekStats = useAppStore((s) => s.weekStats);
  const deleteSessionsByDate = useAppStore((s) => s.deleteSessionsByDate);
  const deleteSession = useAppStore((s) => s.deleteSession);

  const todayKey = dateKey(today);
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const durationMap = useMemo(() => {
    return getMonthDurations(viewYear, viewMonth + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, weekStats]);

  const maxDuration = useMemo(() => {
    let max = 0;
    for (const dur of durationMap.values()) {
      if (dur > max) max = dur;
    }
    return max || 1;
  }, [durationMap]);

  const selectedSessions = useMemo(() => {
    if (!selectedDate) return [];
    const [y, m, d] = selectedDate.split('-').map(Number);
    const startOfDay = new Date(y, m - 1, d).getTime();
    const endOfDay = startOfDay + 86400000;
    return getSessionsByDateRange(startOfDay, endOfDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, weekStats]);

  const selectedDuration = selectedDate ? durationMap.get(selectedDate) || 0 : 0;

  // Full month grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const cells: Array<{ day: number; key: string } | null> = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      cells.push({ day: d, key: dateKey(date) });
    }
    return cells;
  }, [viewYear, viewMonth]);

  const goToPrevMonth = useCallback(() => {
    Haptics.selectionAsync();
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
    setSelectedDate(null);
  }, [viewYear, viewMonth]);

  const goToNextMonth = useCallback(() => {
    if (isCurrentMonth) return;
    Haptics.selectionAsync();
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
    setSelectedDate(null);
  }, [viewYear, viewMonth, isCurrentMonth]);

  const handleDeleteDay = useCallback(() => {
    if (!selectedDate) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteSessionsByDate(selectedDate);
    setSelectedDate(null);
  }, [selectedDate, deleteSessionsByDate]);

  const handleDeleteSession = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    deleteSession(id);
  }, [deleteSession]);

  // ── Render a day cell ───────────────────────────────────────────────
  const renderDayCell = (cell: { day: number; key: string } | null, i: number) => {
    if (!cell) return <View key={`empty-${i}`} style={styles.cell} />;

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
          <Text style={[styles.dayNumber, {
            color: isFuture ? theme.border : duration > 0 ? palette.white : theme.text,
            fontFamily: Fonts!.serif,
          }]}>
            {cell.day}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header — month name with prev/next navigation */}
      <View style={styles.headerRow}>
        <View style={styles.monthNav}>
          <Pressable onPress={goToPrevMonth} hitSlop={16}>
            <Feather name="chevron-left" size={20} color={theme.textSecondary} />
          </Pressable>
          <Text style={[styles.monthLabel, { color: theme.text, fontFamily: Fonts!.serif }]}>
            {MONTH_NAMES[viewMonth]}{!isCurrentMonth || viewYear !== today.getFullYear() ? ` ${viewYear}` : ''}
          </Text>
          <Pressable onPress={goToNextMonth} hitSlop={16}>
            <Feather name="chevron-right" size={20} color={isCurrentMonth ? theme.border : theme.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Day-of-week headers */}
      <View style={styles.dayHeaders}>
        {WEEKDAY_LABELS.map((d) => (
          <Text key={d} style={[styles.dayHeaderLabel, { color: theme.textTertiary }]}>{d}</Text>
        ))}
      </View>

      <View style={styles.grid}>
        {calendarDays.map((cell, i) => renderDayCell(cell, i))}
      </View>


      {/* Selected day detail */}
      {selectedDate && (
        <Animated.View
          entering={FadeIn.duration(250)}
          style={[styles.selectedDetail, { backgroundColor: theme.subtle, borderColor: theme.cardBorder }]}
        >
          <View style={styles.selectedHeader}>
            <View>
              <Text style={[styles.selectedDate, { color: theme.text, fontFamily: Fonts!.serif }]}>
                {formatSelectedDate(selectedDate)}
              </Text>
              <Text style={[styles.selectedTotal, { color: selectedDuration > 0 ? theme.accent : theme.textTertiary, fontFamily: Fonts!.serif }]}>
                {selectedDuration > 0 ? formatTimeShort(selectedDuration) : 'no sessions'}
              </Text>
            </View>
            {selectedSessions.length > 0 && (
              <Pressable onPress={handleDeleteDay} hitSlop={12}>
                <Feather name="trash-2" size={16} color={theme.textTertiary} />
              </Pressable>
            )}
          </View>

          {selectedSessions.length > 0 && (
            <View style={[styles.sessionsList, { borderTopColor: theme.border }]}>
              {selectedSessions.map((session, idx) => (
                <Animated.View
                  key={session.id}
                  entering={FadeInDown.delay(idx * 60).duration(200)}
                  style={[
                    styles.sessionRow,
                    idx < selectedSessions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
                  ]}
                >
                  <Text style={[styles.sessionTime, { color: theme.textTertiary, fontFamily: Fonts.mono }]}>
                    {formatTime(session.timestamp)}
                  </Text>
                  <Text style={[styles.sessionDuration, { color: theme.text, fontFamily: Fonts!.serif }]}>
                    {formatTimeShort(session.duration)}
                  </Text>
                  {session.mood && (
                    <View style={[styles.sessionMood, { backgroundColor: theme.accent + '20' }]}>
                      <Text style={[styles.sessionMoodText, { color: theme.accent, fontFamily: Fonts!.serif }]}>
                        {session.mood}
                      </Text>
                    </View>
                  )}
                  <Pressable onPress={() => handleDeleteSession(session.id)} hitSlop={10} style={styles.sessionDelete}>
                    <Feather name="x" size={14} color={theme.textTertiary} />
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>
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
  container: { marginBottom: 28 },

  // Headers
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 16 },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthLabel: { fontSize: 18, fontWeight: '400' },

  dayHeaders: { flexDirection: 'row', marginBottom: 8 },
  dayHeaderLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '400', letterSpacing: 0.5 },

  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  dayNumber: { fontSize: 15, fontWeight: '300', zIndex: 1, position: 'absolute' },
  activityBubble: { position: 'absolute' },


  // Selected day detail
  selectedDetail: { marginTop: 16, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  selectedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  selectedDate: { fontSize: 15, fontWeight: '400' },
  selectedTotal: { fontSize: 22, fontWeight: '300', marginTop: 2 },

  // Sessions
  sessionsList: { marginTop: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  sessionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12 },
  sessionTime: { fontSize: 12, fontWeight: '300', width: 64 },
  sessionDuration: { fontSize: 15, fontWeight: '300', flex: 1 },
  sessionMood: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  sessionMoodText: { fontSize: 11, fontWeight: '500' },
  sessionDelete: { padding: 4, marginLeft: 4 },
});

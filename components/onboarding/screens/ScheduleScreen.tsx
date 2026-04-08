import { useCallback, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type BottomSheet from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { palette, themes } from '@/lib/theme';
import { Fonts } from '@/constants/theme';
import PickerSheet from '@/components/PickerSheet';
import TimePickerContent, {
  formatTime12,
  WEEKDAY_VALUES,
  WEEKDAY_SHORT,
  ALL_DAYS,
} from '@/components/TimePicker';

export interface ReminderDraft {
  id: string;
  hour: number;
  minute: number;
  weekdays: number[];
  enabled: boolean;
}

const DEFAULT_REMINDERS: ReminderDraft[] = [
  { id: 'morning', hour: 8, minute: 0, weekdays: ALL_DAYS, enabled: true },
  { id: 'afternoon', hour: 13, minute: 0, weekdays: ALL_DAYS, enabled: false },
  { id: 'evening', hour: 21, minute: 0, weekdays: ALL_DAYS, enabled: false },
];

export interface ScheduleSheetHandle {
  renderSheet: () => React.ReactNode;
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  reminders: ReminderDraft[];
  onRemindersChange: (reminders: ReminderDraft[]) => void;
  theme: { text: string; bg: string };
}

let nextId = 1;

const ScheduleScreen = forwardRef<ScheduleSheetHandle, Props>(function ScheduleScreen({
  isActive,
  onNext,
  reminders,
  onRemindersChange,
  theme,
}, ref) {
  const insets = useSafeAreaInsets();
  const [editingId, setEditingId] = useState<string | null>(null);
  const sheetRef = useRef<BottomSheet>(null);

  const fullTheme = themes.light;

  const toggleReminder = useCallback((id: string) => {
    Haptics.selectionAsync();
    onRemindersChange(
      reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  }, [reminders, onRemindersChange]);

  const removeReminder = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRemindersChange(reminders.filter((r) => r.id !== id));
  }, [reminders, onRemindersChange]);

  const openEditor = useCallback((id: string | null) => {
    setEditingId(id);
    sheetRef.current?.expand();
  }, []);

  const closeSheet = useCallback(() => {
    sheetRef.current?.close();
  }, []);

  const handleConfirm = useCallback((hour: number, minute: number, weekdays: number[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (editingId) {
      onRemindersChange(
        reminders.map((r) =>
          r.id === editingId ? { ...r, hour, minute, weekdays } : r,
        ),
      );
    } else {
      onRemindersChange([
        ...reminders,
        { id: `custom-${nextId++}`, hour, minute, weekdays, enabled: true },
      ]);
    }
    sheetRef.current?.close();
  }, [editingId, reminders, onRemindersChange]);

  const editingReminder = editingId ? reminders.find((r) => r.id === editingId) : null;

  useImperativeHandle(ref, () => ({
    renderSheet: () => (
      <PickerSheet ref={sheetRef} theme={fullTheme} onDismiss={() => setEditingId(null)}>
        <TimePickerContent
          key={editingId ?? 'new'}
          theme={fullTheme}
          title={editingId ? 'Edit reminder' : 'Add reminder'}
          initialHour={editingReminder?.hour}
          initialMinute={editingReminder?.minute}
          initialDays={editingReminder?.weekdays}
          onConfirm={handleConfirm}
          onCancel={closeSheet}
        />
      </PickerSheet>
    ),
  }), [editingId, editingReminder, fullTheme, handleConfirm, closeSheet]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 100 }]}
      bounces={false}
      overScrollMode="never"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.heading, { color: theme.text, fontFamily: Fonts.serif }]}>
        Set your reminders
      </Text>
      <Text style={[styles.body, { color: theme.text }]}>
        We'll remind you to pause and do nothing.
      </Text>

      {isActive && (
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <Text style={[styles.tapHint, { color: palette.terracotta }]}>
            tap any time to edit
          </Text>

          {reminders.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => openEditor(r.id)}
              style={[styles.card, {
                borderColor: r.enabled ? fullTheme.accent : fullTheme.textTertiary,
              }]}
            >
              <View style={styles.cardContent}>
                <Text style={[styles.cardTime, {
                  color: r.enabled ? fullTheme.accent : theme.text,
                  fontFamily: Fonts.mono,
                }]}>
                  {formatTime12(r.hour, r.minute)}
                </Text>
                <View style={styles.cardDays}>
                  {WEEKDAY_VALUES.map((day, i) => {
                    const active = !r.weekdays?.length || r.weekdays.includes(day);
                    return (
                      <View key={day} style={styles.cardDayCol}>
                        <View style={[styles.cardDot, {
                          backgroundColor: active ? theme.text : 'transparent',
                          borderColor: active ? theme.text : fullTheme.textTertiary,
                        }]} />
                        <Text style={[styles.cardDayText, {
                          color: active ? theme.text : fullTheme.textTertiary,
                        }]}>
                          {WEEKDAY_SHORT[i]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
              <View style={styles.cardActions}>
                <Switch
                  value={r.enabled}
                  onValueChange={() => toggleReminder(r.id)}
                  trackColor={{ false: fullTheme.textTertiary, true: fullTheme.accent }}
                  thumbColor={palette.white}
                  ios_backgroundColor={r.enabled ? fullTheme.accent : fullTheme.textTertiary}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
                {reminders.length > 1 && (
                  <Pressable onPress={() => removeReminder(r.id)} hitSlop={12}>
                    <Feather name="x" size={16} color={fullTheme.textTertiary} />
                  </Pressable>
                )}
              </View>
            </Pressable>
          ))}

          <Pressable
            onPress={() => openEditor(null)}
            style={[styles.addButton, { borderColor: fullTheme.textTertiary }]}
          >
            <Feather name="plus" size={14} color={theme.text} />
            <Text style={[styles.addButtonText, { color: theme.text }]}>add reminder</Text>
          </Pressable>
        </Animated.View>
      )}

      {reminders.some((r) => r.enabled) && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.hint}>
          <Text style={[styles.hintText, { color: theme.text }]}>
            We'll ask permission to send a gentle reminder.
          </Text>
        </Animated.View>
      )}
    </ScrollView>
  );
});

export default ScheduleScreen;

export { DEFAULT_REMINDERS };

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: '300',
    textAlign: 'left',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    textAlign: 'left',
    opacity: 0.6,
    marginBottom: 28,
  },
  tapHint: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'left',
    marginBottom: 12,
  },
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
  cardTime: { fontSize: 20, fontWeight: '300' },
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
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1,
  },
  cardDayText: {
    fontSize: 8,
    fontWeight: '400',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderRadius: 100,
  },
  addButtonText: { fontSize: 14, fontWeight: '300' },
  hint: {
    marginTop: 24,
  },
  hintText: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'left',
  },
});

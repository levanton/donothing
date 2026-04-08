import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { palette, themes } from '@/lib/theme';
import { Fonts } from '@/constants/theme';
import ReminderCard from '@/components/ReminderCard';
import PillButton from '@/components/PillButton';
import { ALL_DAYS } from '@/components/TimePicker';

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

interface Props {
  isActive: boolean;
  onNext: () => void;
  reminders: ReminderDraft[];
  onRemindersChange: (reminders: ReminderDraft[]) => void;
  onEditReminder: (id: string | null) => void;
  theme: { text: string; bg: string };
}

export default function ScheduleScreen({
  isActive,
  onNext,
  reminders,
  onRemindersChange,
  onEditReminder,
  theme,
}: Props) {
  const insets = useSafeAreaInsets();
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
      <Text style={[styles.body, { color: fullTheme.textSecondary }]}>
        We'll remind you to pause and do nothing.
      </Text>

      {isActive && (
        <Animated.View entering={FadeInDown.duration(500).delay(200)}>
          <Text style={[styles.tapHint, { color: palette.terracotta }]}>
            tap any time to edit
          </Text>

          {reminders.map((r) => (
            <ReminderCard
              key={r.id}
              hour={r.hour}
              minute={r.minute}
              weekdays={r.weekdays}
              enabled={r.enabled}
              theme={fullTheme}
              onPress={() => onEditReminder(r.id)}
              onToggle={() => toggleReminder(r.id)}
              onRemove={reminders.length > 1 ? () => removeReminder(r.id) : undefined}
            />
          ))}

          <PillButton label="+ add reminder" onPress={() => onEditReminder(null)} color={theme.text} variant="outline" size="small" />
        </Animated.View>
      )}

      {reminders.some((r) => r.enabled) && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.hint}>
          <Text style={[styles.hintText, { color: fullTheme.textSecondary }]}>
            We'll ask permission to send a gentle reminder.
          </Text>
        </Animated.View>
      )}
    </ScrollView>
  );
}

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
    marginBottom: 28,
  },
  tapHint: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'left',
    marginBottom: 12,
  },
  hint: {
    marginTop: 24,
  },
  hintText: {
    fontSize: 14,
    textAlign: 'left',
  },
});

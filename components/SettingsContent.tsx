import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DeviceActivitySelectionViewPersisted } from 'react-native-device-activity';

import { Fonts } from '@/constants/theme';
import { AppTheme, themes } from '@/lib/theme';
import { useAppStore } from '@/lib/store';

const BLOCK_SELECTION_ID = 'donothing-scheduled-block';

interface SettingsContentProps {
  onClose: () => void;
  insets: { top: number; bottom: number };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatTime12(hour: number, minute: number) {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${pad(minute)} ${ampm}`;
}

// Simple inline time picker with increment/decrement
function TimePicker({ onConfirm, onCancel, theme }: {
  onConfirm: (hour: number, minute: number) => void;
  onCancel: () => void;
  theme: AppTheme;
}) {
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);

  const incHour = () => { Haptics.selectionAsync(); setHour((h) => (h + 1) % 24); };
  const decHour = () => { Haptics.selectionAsync(); setHour((h) => (h - 1 + 24) % 24); };
  const incMin = () => { Haptics.selectionAsync(); setMinute((m) => (m + 5) % 60); };
  const decMin = () => { Haptics.selectionAsync(); setMinute((m) => (m - 5 + 60) % 60); };

  return (
    <View style={[styles.pickerRow, { borderColor: theme.border }]}>
      <View style={styles.pickerCol}>
        <Pressable onPress={incHour} hitSlop={8}>
          <Feather name="chevron-up" size={20} color={theme.textSecondary} />
        </Pressable>
        <Text style={[styles.pickerValue, { color: theme.text, fontFamily: Fonts!.mono }]}>
          {pad(hour)}
        </Text>
        <Pressable onPress={decHour} hitSlop={8}>
          <Feather name="chevron-down" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <Text style={[styles.pickerColon, { color: theme.textTertiary }]}>:</Text>
      <View style={styles.pickerCol}>
        <Pressable onPress={incMin} hitSlop={8}>
          <Feather name="chevron-up" size={20} color={theme.textSecondary} />
        </Pressable>
        <Text style={[styles.pickerValue, { color: theme.text, fontFamily: Fonts!.mono }]}>
          {pad(minute)}
        </Text>
        <Pressable onPress={decMin} hitSlop={8}>
          <Feather name="chevron-down" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.pickerActions}>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={[styles.pickerCancel, { color: theme.textTertiary }]}>cancel</Text>
        </Pressable>
        <Pressable onPress={() => onConfirm(hour, minute)} hitSlop={8}>
          <Text style={[styles.pickerConfirm, { color: theme.accent }]}>add</Text>
        </Pressable>
      </View>
    </View>
  );
}

// Duration picker for scheduled blocks
function DurationBlockPicker({ onConfirm, onCancel, theme }: {
  onConfirm: (hour: number, minute: number, duration: number) => void;
  onCancel: () => void;
  theme: AppTheme;
}) {
  const [hour, setHour] = useState(14);
  const [minute, setMinute] = useState(0);
  const [duration, setDuration] = useState(15);

  const incHour = () => { Haptics.selectionAsync(); setHour((h) => (h + 1) % 24); };
  const decHour = () => { Haptics.selectionAsync(); setHour((h) => (h - 1 + 24) % 24); };
  const incMin = () => { Haptics.selectionAsync(); setMinute((m) => (m + 5) % 60); };
  const decMin = () => { Haptics.selectionAsync(); setMinute((m) => (m - 5 + 60) % 60); };
  const incDur = () => { Haptics.selectionAsync(); setDuration((d) => Math.min(120, d + 5)); };
  const decDur = () => { Haptics.selectionAsync(); setDuration((d) => Math.max(5, d - 5)); };

  return (
    <View style={[styles.pickerRow, { borderColor: theme.border }]}>
      <View style={styles.pickerCol}>
        <Pressable onPress={incHour} hitSlop={8}>
          <Feather name="chevron-up" size={20} color={theme.textSecondary} />
        </Pressable>
        <Text style={[styles.pickerValue, { color: theme.text, fontFamily: Fonts!.mono }]}>
          {pad(hour)}
        </Text>
        <Pressable onPress={decHour} hitSlop={8}>
          <Feather name="chevron-down" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <Text style={[styles.pickerColon, { color: theme.textTertiary }]}>:</Text>
      <View style={styles.pickerCol}>
        <Pressable onPress={incMin} hitSlop={8}>
          <Feather name="chevron-up" size={20} color={theme.textSecondary} />
        </Pressable>
        <Text style={[styles.pickerValue, { color: theme.text, fontFamily: Fonts!.mono }]}>
          {pad(minute)}
        </Text>
        <Pressable onPress={decMin} hitSlop={8}>
          <Feather name="chevron-down" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <View style={[styles.pickerCol, { marginLeft: 12 }]}>
        <Pressable onPress={incDur} hitSlop={8}>
          <Feather name="chevron-up" size={20} color={theme.textSecondary} />
        </Pressable>
        <Text style={[styles.pickerValue, { color: theme.text, fontFamily: Fonts!.mono }]}>
          {duration}m
        </Text>
        <Pressable onPress={decDur} hitSlop={8}>
          <Feather name="chevron-down" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.pickerActions}>
        <Pressable onPress={onCancel} hitSlop={8}>
          <Text style={[styles.pickerCancel, { color: theme.textTertiary }]}>cancel</Text>
        </Pressable>
        <Pressable onPress={() => onConfirm(hour, minute, duration)} hitSlop={8}>
          <Text style={[styles.pickerConfirm, { color: theme.accent }]}>add</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SettingsContent({ onClose, insets }: SettingsContentProps) {
  const themeMode = useAppStore((s) => s.themeMode);
  const dailyGoalMinutes = useAppStore((s) => s.dailyGoalMinutes);
  const reminders = useAppStore((s) => s.reminders);
  const scheduledBlocks = useAppStore((s) => s.scheduledBlocks);
  const theme = themes[themeMode];

  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);

  const store = useAppStore.getState;

  const handleGoalChange = (delta: number) => {
    Haptics.selectionAsync();
    const next = Math.max(0, Math.min(120, dailyGoalMinutes + delta));
    store().setDailyGoal(next);
  };

  const handleAddReminder = (hour: number, minute: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store().addReminder(hour, minute);
    setShowReminderPicker(false);
  };

  const handleAddBlock = (hour: number, minute: number, duration: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store().addScheduledBlock(hour, minute, duration);
    setShowBlockPicker(false);
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      bounces={false}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 40,
      }}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts!.serif }]}>
          Settings
        </Text>
        <Pressable onPress={onClose} hitSlop={16} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>{'\u2715'}</Text>
        </Pressable>
      </View>

      {/* Daily Goal */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DAILY GOAL</Text>
      <View style={[styles.goalRow, { borderColor: theme.border }]}>
        <Pressable onPress={() => handleGoalChange(-5)} hitSlop={12} style={styles.stepperBtn}>
          <Feather name="minus" size={18} color={theme.textSecondary} />
        </Pressable>
        <Text style={[styles.goalValue, { color: theme.text, fontFamily: Fonts!.serif }]}>
          {dailyGoalMinutes === 0 ? 'not set' : `${dailyGoalMinutes} min`}
        </Text>
        <Pressable onPress={() => handleGoalChange(5)} hitSlop={12} style={styles.stepperBtn}>
          <Feather name="plus" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>
      <Text style={[styles.sectionHint, { color: theme.textTertiary }]}>
        {dailyGoalMinutes > 0
          ? `Do nothing for ${dailyGoalMinutes} min every day`
          : 'Set a daily goal to track your progress'}
      </Text>

      {/* Reminders */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 32 }]}>
        REMINDERS
      </Text>
      {reminders.map((r) => (
        <View key={r.id} style={[styles.itemRow, { borderColor: theme.border }]}>
          <Text style={[styles.itemTime, { color: theme.text, fontFamily: Fonts!.mono }]}>
            {formatTime12(r.hour, r.minute)}
          </Text>
          <View style={styles.itemActions}>
            <Switch
              value={r.enabled}
              onValueChange={() => {
                Haptics.selectionAsync();
                store().toggleReminder(r.id);
              }}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor="#fff"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                store().removeReminder(r.id);
              }}
              hitSlop={12}
            >
              <Feather name="trash-2" size={16} color={theme.textTertiary} />
            </Pressable>
          </View>
        </View>
      ))}
      {showReminderPicker ? (
        <TimePicker
          theme={theme}
          onConfirm={handleAddReminder}
          onCancel={() => setShowReminderPicker(false)}
        />
      ) : (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowReminderPicker(true);
          }}
          style={[styles.addButton, { borderColor: theme.border }]}
        >
          <Feather name="plus" size={16} color={theme.textSecondary} />
          <Text style={[styles.addButtonText, { color: theme.textSecondary }]}>add reminder</Text>
        </Pressable>
      )}

      {/* App selection for blocking */}
      {Platform.OS === 'ios' && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 32 }]}>
            APPS TO BLOCK
          </Text>
          <Text style={[styles.sectionHint, { color: theme.textTertiary, marginTop: -8, marginBottom: 12 }]}>
            Select which apps to block during scheduled sessions
          </Text>
          <View style={[styles.pickerContainer, { borderColor: theme.border }]}>
            <DeviceActivitySelectionViewPersisted
              familyActivitySelectionId={BLOCK_SELECTION_ID}
              headerText="Choose apps to block"
              footerText=""
              style={{ height: 60 }}
            />
          </View>
        </>
      )}

      {/* Scheduled Blocking */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 32 }]}>
        SCREEN BLOCK
      </Text>
      <Text style={[styles.sectionHint, { color: theme.textTertiary, marginTop: -8, marginBottom: 12 }]}>
        Block apps at set times every day
      </Text>
      {scheduledBlocks.map((b) => (
        <View key={b.id} style={[styles.itemRow, { borderColor: theme.border }]}>
          <View>
            <Text style={[styles.itemTime, { color: theme.text, fontFamily: Fonts!.mono }]}>
              {formatTime12(b.hour, b.minute)}
            </Text>
            <Text style={[styles.itemSub, { color: theme.textTertiary }]}>
              {b.durationMinutes} min
            </Text>
          </View>
          <View style={styles.itemActions}>
            <Switch
              value={b.enabled}
              onValueChange={() => {
                Haptics.selectionAsync();
                store().toggleScheduledBlock(b.id);
              }}
              trackColor={{ false: theme.border, true: theme.accent }}
              thumbColor="#fff"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                store().removeScheduledBlock(b.id);
              }}
              hitSlop={12}
            >
              <Feather name="trash-2" size={16} color={theme.textTertiary} />
            </Pressable>
          </View>
        </View>
      ))}
      {showBlockPicker ? (
        <DurationBlockPicker
          theme={theme}
          onConfirm={handleAddBlock}
          onCancel={() => setShowBlockPicker(false)}
        />
      ) : (
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowBlockPicker(true);
          }}
          style={[styles.addButton, { borderColor: theme.border }]}
        >
          <Feather name="plus" size={16} color={theme.textSecondary} />
          <Text style={[styles.addButtonText, { color: theme.textSecondary }]}>add block</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '400', letterSpacing: 0.5 },
  closeButton: { padding: 4 },
  closeText: { fontSize: 20, fontWeight: '300' },
  sectionTitle: { fontSize: 11, letterSpacing: 3, fontWeight: '500', marginBottom: 12 },
  sectionHint: { fontSize: 13, fontWeight: '300', fontStyle: 'italic', marginBottom: 4 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    marginBottom: 8,
  },
  stepperBtn: { padding: 8 },
  goalValue: { fontSize: 22, fontWeight: '300', minWidth: 80, textAlign: 'center' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemTime: { fontSize: 17, fontWeight: '300' },
  itemSub: { fontSize: 12, fontWeight: '300', marginTop: 2 },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  addButtonText: { fontSize: 14, fontWeight: '300' },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  pickerCol: { alignItems: 'center', gap: 4 },
  pickerValue: { fontSize: 22, fontWeight: '300' },
  pickerColon: { fontSize: 22, fontWeight: '300', marginBottom: 2 },
  pickerActions: { marginLeft: 16, gap: 8, alignItems: 'center' },
  pickerCancel: { fontSize: 13, fontWeight: '300' },
  pickerConfirm: { fontSize: 14, fontWeight: '500' },
  pickerContainer: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 4,
  },
});

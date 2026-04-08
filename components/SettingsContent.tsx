import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence } from 'react-native-reanimated';
import type BottomSheet from '@gorhom/bottom-sheet';
import PickerSheet from '@/components/PickerSheet';
import { activitySelectionMetadata } from 'react-native-device-activity';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DeviceActivitySelectionSheetViewPersisted } from 'react-native-device-activity';

import { Fonts } from '@/constants/theme';
import { AppTheme, themes, palette } from '@/lib/theme';
import GoalSliderBar from './GoalSliderBar';
import { useAppStore } from '@/lib/store';
import type { Reminder, ScheduledBlock } from '@/lib/db/types';
import { requestAuth } from '@/lib/screen-time';
import PillButton from '@/components/PillButton';
import ReminderCard from '@/components/ReminderCard';
import AddButton from '@/components/AddButton';
import TimePickerContent, { formatTime12, WEEKDAY_LABELS, WEEKDAY_VALUES, WEEKDAY_SHORT, ALL_DAYS } from '@/components/TimePicker';

const BLOCK_SELECTION_ID = 'donothing-scheduled-block';

interface SettingsContentProps {
  onClose: () => void;
  insets: { top: number; bottom: number };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

// Duration block picker content for bottom sheet
function BlockPickerContent({ onConfirm, onCancel, theme, title, initialHour, initialMinute, initialDuration, initialDays }: {
  onConfirm: (hour: number, minute: number, duration: number, weekdays: number[]) => void;
  onCancel: () => void;
  theme: AppTheme;
  title?: string;
  initialHour?: number;
  initialMinute?: number;
  initialDuration?: number;
  initialDays?: number[];
}) {
  const [hour, setHour] = useState(initialHour ?? 14);
  const [minute, setMinute] = useState(initialMinute ?? 0);
  const [duration, setDuration] = useState(initialDuration ?? 15);
  const [selectedDays, setSelectedDays] = useState<number[]>(initialDays ?? ALL_DAYS);
  const MIN_DURATION = 15;

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
  const incDur = () => { Haptics.selectionAsync(); setDuration((d) => Math.min(120, d + 5)); };
  const decDur = () => { Haptics.selectionAsync(); setDuration((d) => Math.max(MIN_DURATION, d - 5)); };

  return (
    <View style={styles.sheetContent}>
      <Text style={[styles.sheetTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
        {title ?? 'Add screen block'}
      </Text>
      <View style={styles.sheetPickerRow}>
        <View style={styles.sheetPickerCol}>
          <Text style={[styles.sheetLabel, { color: theme.textTertiary }]}>hour</Text>
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
          <Text style={[styles.sheetLabel, { color: theme.textTertiary }]}>min</Text>
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
        <View style={{ width: 20 }} />
        <View style={styles.sheetPickerCol}>
          <Text style={[styles.sheetLabel, { color: theme.textTertiary }]}>do nothing</Text>
          <Pressable onPress={incDur} hitSlop={12} style={styles.sheetArrow}>
            <Feather name="chevron-up" size={24} color={theme.textSecondary} />
          </Pressable>
          <Text style={[styles.sheetPickerValue, { color: theme.text, fontFamily: Fonts!.mono }]}>
            {duration}m
          </Text>
          <Pressable onPress={decDur} hitSlop={12} style={styles.sheetArrow}>
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
        <PillButton label="add" onPress={() => onConfirm(hour, minute, duration, selectedDays)} color={theme.accent} filled flex />
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
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ScheduledBlock | null>(null);
  const [showAppPicker, setShowAppPicker] = useState(false);
  const [appCount, setAppCount] = useState(() => {
    if (Platform.OS !== 'ios') return 0;
    try {
      const meta = activitySelectionMetadata({ activitySelectionId: BLOCK_SELECTION_ID });
      return (meta?.applicationCount ?? 0) + (meta?.categoryCount ?? 0);
    } catch { return 0; }
  });

  const reminderSheetRef = useRef<BottomSheet>(null);
  const blockSheetRef = useRef<BottomSheet>(null);


  const store = useAppStore.getState;

  // Block button animation
  const lockScale = useSharedValue(1);
  const lockRotate = useSharedValue(0);
  const lockCircleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lockScale.value }],
  }));

  const lockIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${lockRotate.value}deg` }],
  }));

  const handleGoalChange = (minutes: number) => {
    store().setDailyGoal(minutes);
  };

  const handleConfirmReminder = (hour: number, minute: number, weekdays: number[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (editingReminder) {
      store().editReminder(editingReminder.id, hour, minute, weekdays);
    } else {
      store().addReminder(hour, minute, weekdays);
    }
    reminderSheetRef.current?.close();
  };

  const handleConfirmBlock = (hour: number, minute: number, duration: number, weekdays: number[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (editingBlock) {
      store().editScheduledBlock(editingBlock.id, hour, minute, duration, weekdays);
    } else {
      store().addScheduledBlock(hour, minute, duration, weekdays);
    }
    blockSheetRef.current?.close();
  };

  return (
    <>
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
      <Text style={[styles.sectionHint, { color: theme.textTertiary }]}>
        {dailyGoalMinutes > 0
          ? `Do nothing for ${dailyGoalMinutes} min every day`
          : 'Set a daily goal to track your progress'}
      </Text>
      <GoalSliderBar
        value={dailyGoalMinutes}
        onChange={handleGoalChange}
        theme={theme}
        maxMinutes={90}
        ticks={[5, 10, 15, 30, 45, 60]}
        scaleLabels={['0', '5', '10', '15', '30', '45', '60', '90']}
        accentColor={theme.accent}
      />

      {/* Reminders */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 32 }]}>
        REMINDERS
      </Text>
      {reminders.length === 0 && (
        <View style={[styles.emptyCard, { borderColor: theme.textTertiary }]}>
          <Feather name="bell-off" size={22} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            No reminders yet
          </Text>
          <Text style={[styles.emptySub, { color: theme.textTertiary }]}>
            Add one to remember to pause
          </Text>
        </View>
      )}
      {reminders.map((r) => (
        <ReminderCard
          key={r.id}
          hour={r.hour}
          minute={r.minute}
          weekdays={r.weekdays}
          enabled={r.enabled}
          theme={theme}
          onPress={() => {
            Haptics.selectionAsync();
            setEditingReminder(r);
            reminderSheetRef.current?.expand();
          }}
          onToggle={() => {
            Haptics.selectionAsync();
            store().toggleReminder(r.id);
          }}
          onRemove={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            store().removeReminder(r.id);
          }}
        />
      ))}
      <AddButton
        label="add reminder"
        theme={theme}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setEditingReminder(null);
          setShowReminderPicker(true);
          reminderSheetRef.current?.expand();
        }}
      />

      {/* App selection for blocking */}
      {Platform.OS === 'ios' && (
        <>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            APPS TO BLOCK
          </Text>
          <View style={styles.blockRow}>
            <View style={styles.blockTextCol}>
              <Text style={[styles.blockTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
                {appCount > 0 ? `${appCount} apps blocked` : 'No apps blocked'}
              </Text>
              <Text style={[styles.blockSub, { color: theme.textTertiary }]}>
                {appCount > 0 ? 'tap lock to change' : 'tap lock to select'}
              </Text>
            </View>
            <Pressable
              onPressIn={() => {
                lockScale.value = withTiming(0.9, { duration: 100 });
              }}
              onPressOut={() => {
                lockScale.value = withTiming(1, { duration: 200 });
              }}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                lockRotate.value = withSequence(
                  withTiming(-20, { duration: 100 }),
                  withTiming(15, { duration: 100 }),
                  withTiming(0, { duration: 150 }),
                );
                const status = await requestAuth();
                if (status === 'approved') setShowAppPicker(true);
              }}
            >
              <Animated.View
                style={[styles.lockCircle, lockCircleStyle, appCount > 0
                  ? { backgroundColor: theme.accent, borderColor: theme.accent }
                  : { backgroundColor: 'transparent', borderColor: theme.text },
                ]}
              >
                <Animated.View style={lockIconStyle}>
                  <Feather
                    name={appCount > 0 ? 'lock' : 'unlock'}
                    size={20}
                    color={appCount > 0 ? theme.accentText : theme.text}
                  />
                </Animated.View>
              </Animated.View>
            </Pressable>
          </View>
          {showAppPicker && (
            <DeviceActivitySelectionSheetViewPersisted
              familyActivitySelectionId={BLOCK_SELECTION_ID}
              headerText="Choose apps to block"
              footerText=""
              onSelectionChange={(e) => {
                const meta = e.nativeEvent;
                setAppCount((meta.applicationCount ?? 0) + (meta.categoryCount ?? 0));
              }}
              onDismissRequest={() => setShowAppPicker(false)}
              style={{ height: 1, width: 1, position: 'absolute', top: -9999 }}
            />
          )}
        </>
      )}

      {/* Scheduled Blocking */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 32 }]}>
        SCREEN BLOCK
      </Text>
      {scheduledBlocks.length === 0 && (
        <View style={[styles.emptyCard, { borderColor: theme.textTertiary }]}>
          <Feather name="smartphone" size={22} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            No scheduled blocks yet
          </Text>
          <Text style={[styles.emptySub, { color: theme.textTertiary }]}>
            Schedule time to block distractions
          </Text>
        </View>
      )}
      {scheduledBlocks.map((b) => {
        const disabled = appCount === 0;
        const active = b.enabled && !disabled;
        return (
          <Pressable
            key={b.id}
            onPress={() => {
              if (disabled) return;
              Haptics.selectionAsync();
              setEditingBlock(b);
              blockSheetRef.current?.expand();
            }}
            style={[styles.card, {
              borderColor: active ? theme.accent : theme.border,
              opacity: disabled ? 0.4 : 1,
            }]}
          >
            <View style={styles.cardContent}>
              <Text style={[styles.cardTime, { color: active ? theme.accent : theme.text, fontFamily: Fonts!.mono }]}>
                {formatTime12(b.hour, b.minute)}
              </Text>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
                do nothing for {b.durationMinutes} min
              </Text>
              <View style={styles.cardDays}>
                {WEEKDAY_VALUES.map((day, i) => {
                  const dayActive = !b.weekdays?.length || b.weekdays.includes(day);
                  return (
                    <View key={day} style={styles.cardDayCol}>
                      <View style={[styles.cardDot, {
                        backgroundColor: dayActive ? theme.text : 'transparent',
                        borderColor: dayActive ? theme.text : theme.textTertiary,
                      }]} />
                      <Text style={[styles.cardDayText, { color: dayActive ? theme.text : theme.textTertiary }]}>
                        {WEEKDAY_SHORT[i]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={styles.cardActions}>
              <Switch
                value={active}
                disabled={disabled}
                onValueChange={() => {
                  Haptics.selectionAsync();
                  store().toggleScheduledBlock(b.id);
                }}
                trackColor={{ false: theme.textTertiary, true: theme.accent }}
                thumbColor={palette.white}
                ios_backgroundColor={active ? theme.accent : theme.textTertiary}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  store().removeScheduledBlock(b.id);
                }}
                hitSlop={12}
              >
                <Feather name="x" size={16} color={theme.textTertiary} />
              </Pressable>
            </View>
          </Pressable>
        );
      })}
      <AddButton
        label="add block"
        theme={theme}
        disabled={appCount === 0}
        onPress={() => {
          if (appCount === 0) return;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setEditingBlock(null);
          setShowBlockPicker(true);
          blockSheetRef.current?.expand();
        }}
      />
    </ScrollView>

    {/* Bottom sheet for reminder picker */}
    <PickerSheet
      ref={reminderSheetRef}
      theme={theme}
      onDismiss={() => { setShowReminderPicker(false); setEditingReminder(null); }}
    >
      <TimePickerContent
        key={editingReminder?.id ?? 'new'}
        theme={theme}
        title={editingReminder ? 'Edit reminder' : 'Add reminder'}
        initialHour={editingReminder?.hour}
        initialMinute={editingReminder?.minute}
        initialDays={editingReminder?.weekdays}
        onConfirm={handleConfirmReminder}
        onCancel={() => reminderSheetRef.current?.close()}
      />
    </PickerSheet>

    {/* Bottom sheet for block picker */}
    <PickerSheet
      ref={blockSheetRef}
      theme={theme}
      onDismiss={() => { setShowBlockPicker(false); setEditingBlock(null); }}
    >
      <BlockPickerContent
        key={editingBlock?.id ?? 'new'}
        theme={theme}
        title={editingBlock ? 'Edit screen block' : 'Add screen block'}
        initialHour={editingBlock?.hour}
        initialMinute={editingBlock?.minute}
        initialDuration={editingBlock?.durationMinutes}
        initialDays={editingBlock?.weekdays}
        onConfirm={handleConfirmBlock}
        onCancel={() => blockSheetRef.current?.close()}
      />
    </PickerSheet>
    </>
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
    borderWidth: 1.2,
    borderRadius: 16,
    marginBottom: 8,
  },
  stepperBtn: { padding: 8 },
  goalValue: { fontSize: 22, fontWeight: '300', minWidth: 80, textAlign: 'center' },

  // Card style for reminders & blocks
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


  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 4,
  },
  lockCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockTextCol: {
    flex: 1,
    gap: 2,
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: '300',
  },
  blockSub: {
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
  },

  divider: { height: StyleSheet.hairlineWidth, marginVertical: 28 },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 18,
    marginBottom: 10,
    alignItems: 'center',
    gap: 6,
    opacity: 0.85,
  },
  emptyTitle: { fontSize: 15, fontWeight: '400' },
  emptySub: { fontSize: 12, fontWeight: '300', fontStyle: 'italic' },

  // Bottom sheet content
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
  sheetLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1,
    textTransform: 'uppercase',
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
  dayHint: {
    fontSize: 12,
    fontWeight: '300',
    fontStyle: 'italic',
    marginBottom: 24,
  },
});

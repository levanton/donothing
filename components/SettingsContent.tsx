import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { activitySelectionMetadata } from 'react-native-device-activity';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { DeviceActivitySelectionSheetViewPersisted } from 'react-native-device-activity';

import { Fonts } from '@/constants/theme';
import { AppTheme, themes } from '@/lib/theme';
import GoalSliderBar from './GoalSliderBar';
import { useAppStore } from '@/lib/store';
import { requestAuth } from '@/lib/screen-time';
import PillButton from '@/components/PillButton';

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

// No custom BottomSheet needed — using @gorhom/bottom-sheet

// Time picker content for bottom sheet
function TimePickerContent({ onConfirm, onCancel, theme }: {
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
    <View style={styles.sheetContent}>
      <Text style={[styles.sheetTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
        Add reminder
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
      <View style={styles.sheetButtons}>
        <PillButton label="cancel" onPress={onCancel} color={theme.textSecondary} flex />
        <PillButton label="add" onPress={() => onConfirm(hour, minute)} color={theme.accent} filled flex />
      </View>
    </View>
  );
}

// Duration block picker content for bottom sheet
function BlockPickerContent({ onConfirm, onCancel, theme }: {
  onConfirm: (hour: number, minute: number, duration: number) => void;
  onCancel: () => void;
  theme: AppTheme;
}) {
  const [hour, setHour] = useState(14);
  const [minute, setMinute] = useState(0);
  const [duration, setDuration] = useState(15);
  const MIN_DURATION = 15;

  const incHour = () => { Haptics.selectionAsync(); setHour((h) => (h + 1) % 24); };
  const decHour = () => { Haptics.selectionAsync(); setHour((h) => (h - 1 + 24) % 24); };
  const incMin = () => { Haptics.selectionAsync(); setMinute((m) => (m + 5) % 60); };
  const decMin = () => { Haptics.selectionAsync(); setMinute((m) => (m - 5 + 60) % 60); };
  const incDur = () => { Haptics.selectionAsync(); setDuration((d) => Math.min(120, d + 5)); };
  const decDur = () => { Haptics.selectionAsync(); setDuration((d) => Math.max(MIN_DURATION, d - 5)); };

  return (
    <View style={styles.sheetContent}>
      <Text style={[styles.sheetTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
        Add screen block
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
      <View style={styles.sheetButtons}>
        <PillButton label="cancel" onPress={onCancel} color={theme.textSecondary} flex />
        <PillButton label="add" onPress={() => onConfirm(hour, minute, duration)} color={theme.accent} filled flex />
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

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.3} />,
    [],
  );

  const store = useAppStore.getState;

  const handleGoalChange = (minutes: number) => {
    store().setDailyGoal(minutes);
  };

  const handleAddReminder = (hour: number, minute: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store().addReminder(hour, minute);
    reminderSheetRef.current?.close();
  };

  const handleAddBlock = (hour: number, minute: number, duration: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    store().addScheduledBlock(hour, minute, duration);
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
      {reminders.map((r) => (
        <Pressable
          key={r.id}
          onPress={() => {
            Haptics.selectionAsync();
            store().toggleReminder(r.id);
          }}
          style={[styles.card, { borderColor: r.enabled ? theme.accent : theme.textTertiary }]}
        >
          <View style={styles.cardContent}>
            <Text style={[styles.cardTime, { color: r.enabled ? theme.accent : theme.text, fontFamily: Fonts!.mono }]}>
              {formatTime12(r.hour, r.minute)}
            </Text>
            <Text style={[styles.cardLabel, { color: theme.textTertiary }]}>
              daily reminder
            </Text>
          </View>
          <View style={styles.cardActions}>
            <Switch
              value={r.enabled}
              onValueChange={() => {
                Haptics.selectionAsync();
                store().toggleReminder(r.id);
              }}
              trackColor={{ false: theme.textTertiary, true: theme.accent }}
              thumbColor="#fff"
              ios_backgroundColor={r.enabled ? theme.accent : theme.textTertiary}
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                store().removeReminder(r.id);
              }}
              hitSlop={12}
            >
              <Feather name="x" size={16} color={theme.textTertiary} />
            </Pressable>
          </View>
        </Pressable>
      ))}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowReminderPicker(true);
          reminderSheetRef.current?.expand();
        }}
        style={[styles.addButton, { borderColor: theme.textTertiary }]}
      >
        <Feather name="plus" size={14} color={theme.text} />
        <Text style={[styles.addButtonText, { color: theme.text }]}>add reminder</Text>
      </Pressable>

      {/* App selection for blocking */}
      {Platform.OS === 'ios' && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 32 }]}>
            APPS TO BLOCK
          </Text>
          <Pressable
            onPress={async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const status = await requestAuth();
              if (status === 'approved') {
                setShowAppPicker(true);
              }
            }}
            style={[styles.selectAppsBtn, {
              borderColor: appCount > 0 ? theme.text : theme.border,
              backgroundColor: appCount > 0 ? theme.text : 'transparent',
            }]}
          >
            <Feather name="smartphone" size={18} color={appCount > 0 ? theme.bg : theme.textSecondary} />
            <Text style={[styles.selectAppsText, { color: appCount > 0 ? theme.bg : theme.textSecondary }]}>
              {appCount > 0 ? `${appCount} selected — tap to change` : 'Select apps'}
            </Text>
          </Pressable>
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
      {scheduledBlocks.map((b) => (
        <Pressable
          key={b.id}
          onPress={() => {
            Haptics.selectionAsync();
            store().toggleScheduledBlock(b.id);
          }}
          style={[styles.card, { borderColor: b.enabled ? theme.accent : theme.textTertiary }]}
        >
          <View style={styles.cardContent}>
            <Text style={[styles.cardTime, { color: b.enabled ? theme.accent : theme.text, fontFamily: Fonts!.mono }]}>
              {formatTime12(b.hour, b.minute)}
            </Text>
            <Text style={[styles.cardLabel, { color: theme.textTertiary }]}>
              do nothing for {b.durationMinutes} min
            </Text>
          </View>
          <View style={styles.cardActions}>
            <Switch
              value={b.enabled}
              onValueChange={() => {
                Haptics.selectionAsync();
                store().toggleScheduledBlock(b.id);
              }}
              trackColor={{ false: theme.textTertiary, true: theme.accent }}
              thumbColor="#fff"
              ios_backgroundColor={b.enabled ? theme.accent : theme.textTertiary}
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
      ))}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowBlockPicker(true);
          blockSheetRef.current?.expand();
        }}
        style={[styles.addButton, { borderColor: theme.textTertiary }]}
      >
        <Feather name="plus" size={14} color={theme.text} />
        <Text style={[styles.addButtonText, { color: theme.text }]}>add block</Text>
      </Pressable>
    </ScrollView>

    {/* Bottom sheet for reminder picker */}
    <BottomSheet
      ref={reminderSheetRef}
      index={-1}
      enableDynamicSizing
      enablePanDownToClose
      enableOverDrag={false}
      onChange={(i) => { if (i === -1) setShowReminderPicker(false); }}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
      backgroundStyle={{ backgroundColor: theme.bg, borderRadius: 24 }}
    >
      <BottomSheetView style={[styles.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
        <TimePickerContent
          theme={theme}
          onConfirm={handleAddReminder}
          onCancel={() => reminderSheetRef.current?.close()}
        />
      </BottomSheetView>
    </BottomSheet>

    {/* Bottom sheet for block picker */}
    <BottomSheet
      ref={blockSheetRef}
      index={-1}
      enableDynamicSizing
      enablePanDownToClose
      enableOverDrag={false}
      onChange={(i) => { if (i === -1) setShowBlockPicker(false); }}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
      backgroundStyle={{ backgroundColor: theme.bg, borderRadius: 24 }}
    >
      <BottomSheetView style={[styles.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
        <BlockPickerContent
          theme={theme}
          onConfirm={handleAddBlock}
          onCancel={() => blockSheetRef.current?.close()}
        />
      </BottomSheetView>
    </BottomSheet>
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
  cardTime: { fontSize: 20, fontWeight: '300' },
  cardLabel: { fontSize: 12, fontWeight: '300', fontStyle: 'italic' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },


  selectAppsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1.2,
    borderRadius: 12,
    marginBottom: 4,
  },
  selectAppsText: { fontSize: 15, fontWeight: '300' },

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
});

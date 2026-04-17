import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { Fonts } from '@/constants/theme';
import { CARD_BORDER_WIDTH, type AppTheme } from '@/lib/theme';
import type { BlockGroup } from '@/lib/db/types';
import PillButton from '@/components/PillButton';
import GoalSliderBar from '@/components/GoalSliderBar';
import { ALL_DAYS, WEEKDAY_LABELS, WEEKDAY_VALUES } from '@/components/TimePicker';

const MIN_DURATION = 15;
const STEP = 5;
const UNLOCK_OPTIONS = [1, 3, 5, 10, 15] as const;
const DEFAULT_UNLOCK = 5;
const SHEET_PAD = 24;
const MINUTES_PER_DAY = 24 * 60;

interface BlockPickerProps {
  onConfirm: (
    hour: number,
    minute: number,
    duration: number,
    weekdays: number[],
    groupId: string | null,
    unlockGoalMinutes: number,
  ) => void;
  onCancel: () => void;
  theme: AppTheme;
  title?: string;
  initialHour?: number;
  initialMinute?: number;
  initialDuration?: number;
  initialDays?: number[];
  initialGroupId?: string | null;
  initialUnlockGoal?: number;
  groups?: BlockGroup[];
}

function snap(v: number) {
  return Math.round(v / STEP) * STEP;
}

function dateFromMinutes(m: number): Date {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function formatTime(m: number) {
  const c = ((Math.round(m) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad2(Math.floor(c / 60))}:${pad2(c % 60)}`;
}

export default function BlockPickerContent({
  onConfirm,
  onCancel,
  theme,
  title,
  initialHour,
  initialMinute,
  initialDays,
  initialUnlockGoal,
}: BlockPickerProps) {
  const initStart = snap((initialHour ?? 14) * 60 + (initialMinute ?? 0));

  const [startMinutes, setStartMinutes] = useState(initStart);
  const [selectedDays, setSelectedDays] = useState<number[]>(initialDays ?? ALL_DAYS);
  const [unlockGoal, setUnlockGoal] = useState<number>(initialUnlockGoal ?? DEFAULT_UNLOCK);

  const isLight = theme.bg === '#F9F2E0';
  const strongBorder = theme.text;
  const softDivider = isLight ? '#CFC4AF' : '#6B6B68';

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

  const onStartChange = (_e: DateTimePickerEvent, d?: Date) => {
    if (!d) return;
    const m = snap(d.getHours() * 60 + d.getMinutes());
    setStartMinutes(m);
  };

  const handleConfirm = () => {
    const hour = Math.floor(startMinutes / 60);
    const minute = startMinutes % 60;
    // Block runs until manually unlocked — use full-day duration sentinel
    onConfirm(hour, minute, 1439, selectedDays, null, unlockGoal);
  };

  return (
    <BottomSheetScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
    >
      <Text style={[styles.sheetTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
        {title ?? 'Add screen block'}
      </Text>

      {/* 1. UNLOCK GOAL */}
      <View style={styles.unlockHeader}>
        <View style={styles.unlockHeaderText}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: Fonts!.serif, marginBottom: 4 }]}>
            Unlock goal
          </Text>
          <Text style={[styles.sectionHint, { color: theme.textSecondary, fontFamily: Fonts!.serif, marginBottom: 0 }]}>
            Do nothing for this long to lift the block
          </Text>
        </View>
        <View style={styles.unlockValueWrap}>
          <Text style={[styles.unlockValue, { color: theme.accent, fontFamily: Fonts!.serif }]}>
            {unlockGoal}
          </Text>
          <Text style={[styles.unlockUnit, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
            min
          </Text>
        </View>
      </View>
      <View style={styles.unlockSliderWrap}>
        <GoalSliderBar
          value={unlockGoal}
          onChange={setUnlockGoal}
          theme={theme}
          maxMinutes={90}
          breakpoints={{ b1Val: 15, b1Pos: 0.33, b2Val: 45, b2Pos: 0.67 }}
          ticks={[5, 10, 30, 60, 75]}
          scaleLabels={['0', '15', '45', '90']}
          accentColor={theme.accent}
          trackBgColor={theme.text}
          trackStrokeWidth={3.5}
          scaleLabelStyle={{ color: theme.text, fontWeight: '500', fontSize: 12 }}
          hideLabel
        />
      </View>

      <View style={[styles.divider, { backgroundColor: softDivider }]} />

      {/* 2. TIME */}
      <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
        Time
      </Text>
      <Text style={[styles.sectionHint, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
        When blocking starts each day
      </Text>
      <View style={[styles.timeCard, { borderColor: strongBorder }]}>
        <View style={styles.timeRow}>
          <Text style={[styles.selectedAppName, { color: theme.text, fontFamily: Fonts!.mono, fontWeight: '400' }]}>Starts at</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={dateFromMinutes(startMinutes)}
              mode="time"
              display="compact"
              minuteInterval={5}
              onChange={onStartChange}
              themeVariant={theme.bg === '#F9F2E0' ? 'light' : 'dark'}
              accentColor={theme.accent}
            />
          ) : (
            <Text style={[styles.timeRowValue, { color: theme.text, fontFamily: Fonts!.mono }]}>
              {formatTime(startMinutes)}
            </Text>
          )}
        </View>
        <View style={[styles.timeDivider, { backgroundColor: softDivider }]} />
        <View style={styles.daysSection}>
          <Text style={[styles.daysLabel, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
            on these days
          </Text>
          <View style={styles.dayRow}>
            {WEEKDAY_LABELS.map((label, i) => {
              const day = WEEKDAY_VALUES[i];
              const active = selectedDays.includes(day);
              return (
                <Pressable key={day} onPress={() => toggleDay(day)} hitSlop={4} style={styles.dayPressable}>
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
        </View>
      </View>

      <View style={{ height: 44 }} />
      <View style={styles.sheetButtons}>
        <PillButton label="cancel" onPress={onCancel} color={theme.textSecondary} outline flex />
        <PillButton label="add" onPress={handleConfirm} color={theme.accent} filled flex />
      </View>
    </BottomSheetScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: SHEET_PAD,
    paddingTop: 8,
    paddingBottom: 40,
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '400',
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
    marginBottom: 14,
  },
  unlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  unlockHeaderText: {
    flex: 1,
  },
  unlockValueWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  unlockValue: {
    fontSize: 64,
    fontWeight: '300',
    letterSpacing: -1,
    lineHeight: 64,
    includeFontPadding: false,
  },
  unlockUnit: {
    fontSize: 14,
    fontWeight: '300',
    fontStyle: 'italic',
  },
  unlockSliderWrap: {
    marginTop: 16,
    marginHorizontal: -4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 28,
  },
  selectedAppName: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  timeCard: {
    borderWidth: CARD_BORDER_WIDTH,
    borderRadius: 16,
    overflow: 'hidden',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  timeDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  timeRowLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  timeRowValue: {
    fontSize: 17,
    fontWeight: '400',
  },
  daysSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  daysLabel: {
    fontSize: 15,
    fontWeight: '300',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 4,
  },
  dayPressable: {
    flex: 1,
  },
  dayCircle: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 100,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});

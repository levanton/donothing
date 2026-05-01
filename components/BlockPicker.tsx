import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { haptics } from '@/lib/haptics';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { Fonts } from '@/constants/theme';
import { palette, type AppTheme } from '@/lib/theme';
import { pad2 } from '@/lib/format';
import { ALL_DAYS, WEEKDAY_LABELS, WEEKDAY_VALUES } from '@/lib/weekdays';
import PillButton from '@/components/PillButton';
import GoalSliderBar from '@/components/GoalSliderBar';

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
    unlockGoalMinutes: number,
  ) => void;
  onCancel: () => void;
  theme: AppTheme;
  title?: string;
  initialHour?: number;
  initialMinute?: number;
  initialDuration?: number;
  initialDays?: number[];
  initialUnlockGoal?: number;
}

function snap(v: number) {
  return Math.round(v / STEP) * STEP;
}

function dateFromMinutes(m: number): Date {
  const d = new Date();
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
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
  // For new blocks, default to 2 hours from now (rounded to 5 min) so the
  // schedule is safely in the future and doesn't trigger the too-close alert.
  const defaultStart = (() => {
    const now = new Date();
    const m = snap((now.getHours() * 60 + now.getMinutes()) + 120);
    return m % MINUTES_PER_DAY;
  })();
  const initStart = initialHour !== undefined
    ? snap(initialHour * 60 + (initialMinute ?? 0))
    : defaultStart;

  const [startMinutes, setStartMinutes] = useState(initStart);
  // Empty `initialDays` is treated as "every day" everywhere else (card
  // display, native scheduling). Mirror that here so the chip row reflects
  // the same intent, otherwise the user opens the sheet and sees nothing
  // selected on a block that was visibly running every day.
  const [selectedDays, setSelectedDays] = useState<number[]>(
    initialDays && initialDays.length > 0 ? initialDays : ALL_DAYS,
  );
  const [unlockGoal, setUnlockGoal] = useState<number>(initialUnlockGoal ?? DEFAULT_UNLOCK);

  const isLight = theme.bg !== palette.charcoal;
  const strongBorder = theme.text;
  const softDivider = isLight ? '#CFC4AF' : '#6B6B68';

  const toggleDay = (day: number) => {
    haptics.select();
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
    // Trigger fires at start; block persists until user unlocks. A short interval
    // avoids the wrap where iOS sees "now" as inside the window and fires immediately.
    // Defensive: if every chip somehow ended up off, fall back to all days
    // so the block actually runs. The toggle logic prevents this in normal
    // use, but a stale prop or programmatic change could leave it empty.
    const days = selectedDays.length > 0 ? selectedDays : ALL_DAYS;
    onConfirm(hour, minute, 15, days, unlockGoal);
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
            Nothing to unlock
          </Text>
          <Text style={[styles.sectionHint, { color: theme.textSecondary, fontFamily: Fonts!.serif, marginBottom: 0 }]}>
            Do nothing for this long.
          </Text>
        </View>
        <View style={styles.unlockValueWrap}>
          <Text style={[styles.unlockValue, { color: theme.accent, fontFamily: Fonts!.mono }]}>
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
          maxMinutes={60}
          minMinutes={1}
          breakpoints={{ b1Val: 15, b1Pos: 1 / 2, b2Val: 30, b2Pos: 2 / 3, b3Val: 45, b3Pos: 5 / 6 }}
          ticks={[5, 10, 15, 30, 45]}
          scaleLabels={['1', '5', '10', '15', '30', '45', '60']}
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
              themeVariant={isLight ? 'light' : 'dark'}
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
            {selectedDays.length === WEEKDAY_VALUES.length ? 'every day' : 'on these days'}
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
                      : { backgroundColor: 'transparent', borderColor: theme.textTertiary, opacity: 0.9 },
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
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  timeCard: {
    overflow: 'hidden',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    minHeight: 52,
  },
  timeDivider: {
    height: StyleSheet.hairlineWidth,
  },
  timeRowLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  timeRowValue: {
    fontSize: 18,
    fontWeight: '400',
  },
  daysSection: {
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
    fontSize: 13,
    fontWeight: '500',
  },
});

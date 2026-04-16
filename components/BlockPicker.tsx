import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';
import type { BlockGroup } from '@/lib/db/types';
import PillButton from '@/components/PillButton';
import { ALL_DAYS, WEEKDAY_LABELS, WEEKDAY_VALUES } from '@/components/TimePicker';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  groups: BlockGroup[];
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
  initialDuration,
  initialDays,
  initialGroupId,
  initialUnlockGoal,
  groups,
}: BlockPickerProps) {
  const initStart = snap((initialHour ?? 14) * 60 + (initialMinute ?? 0));
  const initDur = Math.max(MIN_DURATION, snap(initialDuration ?? MIN_DURATION));
  const initEnd = (initStart + initDur) % MINUTES_PER_DAY;

  const [startMinutes, setStartMinutes] = useState(initStart);
  const [endMinutes, setEndMinutes] = useState(initEnd);
  const [selectedDays, setSelectedDays] = useState<number[]>(initialDays ?? ALL_DAYS);
  const [groupId, setGroupId] = useState<string | null>(initialGroupId ?? null);
  const [unlockGoal, setUnlockGoal] = useState<number>(initialUnlockGoal ?? DEFAULT_UNLOCK);
  const [appsExpanded, setAppsExpanded] = useState(false);

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

  const onEndChange = (_e: DateTimePickerEvent, d?: Date) => {
    if (!d) return;
    const m = snap(d.getHours() * 60 + d.getMinutes());
    setEndMinutes(m);
  };

  const handleConfirm = () => {
    const hour = Math.floor(startMinutes / 60);
    const minute = startMinutes % 60;
    const rawDur = endMinutes >= startMinutes
      ? endMinutes - startMinutes
      : endMinutes + MINUTES_PER_DAY - startMinutes;
    const duration = Math.max(MIN_DURATION, rawDur);
    onConfirm(hour, minute, duration, selectedDays, groupId, unlockGoal);
  };

  const appItems = [
    { id: null as string | null, name: 'All apps' },
    ...groups.map((g) => ({ id: g.id as string | null, name: g.name })),
  ];
  const selectedAppName = appItems.find((it) => it.id === groupId)?.name ?? 'All apps';

  const toggleAppsExpanded = () => {
    Haptics.selectionAsync();
    setAppsExpanded((v) => !v);
  };

  const pickGroup = (id: string | null) => {
    Haptics.selectionAsync();
    setGroupId(id);
    setAppsExpanded(false);
  };

  const selectedAppIndex = Math.max(0, appItems.findIndex((it) => it.id === groupId));

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

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* 2. APPS */}
      <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
        Apps
      </Text>
      <Text style={[styles.sectionHint, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
        Which list of apps to block
      </Text>
      <Animated.View
        layout={LinearTransition.duration(260)}
        style={[styles.timeCard, { borderColor: theme.border }]}
      >
        {!appsExpanded ? (
          <AnimatedPressable
            key="collapsed"
            onPress={toggleAppsExpanded}
            style={styles.timeRow}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
          >
            <Text style={[styles.timeRowLabel, { color: theme.text, fontFamily: Fonts!.serif }]}>
              {selectedAppName}
            </Text>
            <Text style={[styles.appsChangeLabel, { color: theme.accent, fontFamily: Fonts!.serif }]}>
              change
            </Text>
          </AnimatedPressable>
        ) : (
          appItems.map((item, i) => {
            const active = item.id === groupId;
            const dist = Math.abs(i - selectedAppIndex);
            const delay = i === selectedAppIndex ? 0 : 60 + dist * 40;
            return (
              <Animated.View
                key={item.id ?? '__null'}
                entering={FadeIn.delay(delay).duration(220)}
                exiting={FadeOut.duration(120)}
              >
                {i > 0 && <View style={[styles.timeDivider, { backgroundColor: theme.border }]} />}
                <Pressable onPress={() => pickGroup(item.id)} style={styles.timeRow}>
                  <Text style={[
                    styles.timeRowLabel,
                    { color: active ? theme.accent : theme.text, fontFamily: Fonts!.serif },
                  ]}>
                    {item.name}
                  </Text>
                  {active && <Feather name="check" size={18} color={theme.accent} />}
                </Pressable>
              </Animated.View>
            );
          })
        )}
      </Animated.View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {/* 3. TIME — native iOS compact time picker rows */}
      <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
        Time
      </Text>
      <Text style={[styles.sectionHint, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
        When the block window starts and ends
      </Text>
      <View style={[styles.timeCard, { borderColor: theme.border }]}>
        <View style={styles.timeRow}>
          <Text style={[styles.timeRowLabel, { color: theme.text, fontFamily: Fonts!.serif }]}>Starts</Text>
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
        <View style={[styles.timeDivider, { backgroundColor: theme.border }]} />
        <View style={styles.timeRow}>
          <Text style={[styles.timeRowLabel, { color: theme.text, fontFamily: Fonts!.serif }]}>Ends</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={dateFromMinutes(endMinutes)}
              mode="time"
              display="compact"
              minuteInterval={5}
              onChange={onEndChange}
              themeVariant={theme.bg === '#F9F2E0' ? 'light' : 'dark'}
              accentColor={theme.accent}
            />
          ) : (
            <Text style={[styles.timeRowValue, { color: theme.text, fontFamily: Fonts!.mono }]}>
              {formatTime(endMinutes)}
            </Text>
          )}
        </View>
      </View>

      <Text style={[styles.dayRowLabel, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
        on these days
      </Text>
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
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 28,
  },
  appsChangeLabel: {
    fontSize: 15,
    fontWeight: '400',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1.2,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chipLabel: {
    fontSize: 15,
    fontWeight: '400',
  },
  timeCard: {
    borderWidth: 1,
    borderRadius: 14,
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
  dayRowLabel: {
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
    marginTop: 16,
    marginBottom: 10,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  dayCircle: {
    width: 44,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
});

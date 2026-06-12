import { Entypo, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo, type RefObject } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

import GoalSliderBar from '@/components/GoalSliderBar';
import TimerDisplay from '@/components/TimerDisplay';
import { TutorialStepWrapper } from '@/components/tutorial';
import { Fonts } from '@/constants/theme';
import { haptics } from '@/lib/haptics';
import type { WeekDay } from '@/lib/stats';
import { useAppStore } from '@/lib/store';
import {
  getStatusBarStyle,
  palette,
  type AppTheme,
  type ThemeMode,
} from '@/lib/theme';
import { YES_BUTTON_SIZE } from './constants';

// Goal slider width — drag updates only `sliderMinutes` (consumed by two
// memoised tiny components below), so the shell never re-renders mid-drag.
const SLIDER_W = 300;

interface TimeStat {
  value: string;
  unit: string;
}

interface HomePaneProps {
  theme: AppTheme;
  themeMode: ThemeMode;
  insetsTop: number;
  started: boolean;
  /** True while the pause sheet / face-down gate owns the screen — the
   *  resting timer is hidden so it doesn't peek out from under the
   *  fading camera and duplicate the sheet's MM:SS. */
  suppressed: boolean;
  tutorialGate: boolean;
  elapsed: number;
  goalSeconds: number;
  todayStat: TimeStat;
  weekStat: TimeStat;
  weekStats: WeekDay[];
  maxDur: number;
  /** Entry animations — owned by HomeShell (useHeaderMorph) because the
   *  session lifecycle drives them from outside this pane. */
  timerEntryStyle: AnimatedStyle<ViewStyle>;
  hideStyle: AnimatedStyle<ViewStyle>;
  showStyle: AnimatedStyle<ViewStyle>;
  /** Journey shared-element styles — owned by HomeShell because they
   *  read the slide values the swipe gestures drive. */
  journeyPillStyle: AnimatedStyle<ViewStyle>;
  journeyChevronStyle: AnimatedStyle<ViewStyle>;
  /** Measured refs — HomeShell owns the rects: the yes button anchors
   *  the splash + run camera, the journey pill anchors the shared
   *  element proxy. */
  yesButtonRef: RefObject<View | null>;
  onYesButtonLayout: () => void;
  journeyBtnRef: RefObject<View | null>;
  onJourneyBtnLayout: () => void;
  onSettingsPress: () => void;
  onToggleTheme: () => void;
  onStart: () => void;
  onHistory: () => void;
  onSliderChange: (minutes: number) => void;
  onSliderRelease: (minutes: number) => void;
}

/**
 * The resting home screen content: header morph, timer, yes button,
 * goal slider, stats, week dots and the journey pill. Rendered inside
 * HomeShell's main slide pane (the Animated.View that carries the
 * swipe transforms) — returns a fragment so the layout container
 * stays in the shell.
 */
export default function HomePane({
  theme,
  themeMode,
  insetsTop,
  started,
  suppressed,
  tutorialGate,
  elapsed,
  goalSeconds,
  todayStat,
  weekStat,
  weekStats,
  maxDur,
  timerEntryStyle,
  hideStyle,
  showStyle,
  journeyPillStyle,
  journeyChevronStyle,
  yesButtonRef,
  onYesButtonLayout,
  journeyBtnRef,
  onJourneyBtnLayout,
  onSettingsPress,
  onToggleTheme,
  onStart,
  onHistory,
  onSliderChange,
  onSliderRelease,
}: HomePaneProps) {
  return (
    <>
      <StatusBar style={getStatusBarStyle(themeMode)} />

      {/* Settings button — top left */}
      <TutorialStepWrapper
        name="home.settings"
        style={[
          styles.lockButton,
          {
            top: insetsTop + 12,
            opacity: started ? 0 : 1,
          },
        ]}
      >
        <Pressable
          onPress={onSettingsPress}
          disabled={started}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Settings"
        >
          <Feather
            name='sliders'
            size={24}
            color={theme.text}
            style={{ opacity: 0.9 }}
          />
        </Pressable>
      </TutorialStepWrapper>

      {/* Header — morphs "Ready to Do·ing nothing?" → "Doing nothing" */}
      <View
        style={styles.headerRow}
      >
        <Animated.View style={hideStyle}>
          <Text
            style={[
              styles.header,
              { color: theme.text, fontFamily: Fonts!.serif },
            ]}
          >
            Ready to{' '}
          </Text>
        </Animated.View>
        <Text
          style={[
            styles.header,
            { color: theme.text, fontFamily: Fonts!.serif },
          ]}
        >
          Do
        </Text>
        <Animated.View style={showStyle}>
          <Text
            style={[
              styles.header,
              { color: theme.text, fontFamily: Fonts!.serif },
            ]}
          >
            ing
          </Text>
        </Animated.View>
        <Text
          style={[
            styles.header,
            { color: theme.text, fontFamily: Fonts!.serif },
          ]}
        >
          {' '}
          nothing
        </Text>
        <Animated.View style={hideStyle}>
          <Text
            style={[
              styles.header,
              { color: theme.text, fontFamily: Fonts!.serif },
            ]}
          >
            ?
          </Text>
        </Animated.View>
      </View>

      {/* Replay onboarding — top right, next to the theme toggle */}
      <Pressable
        onPress={() => {
          haptics.light();
          router.push('/onboarding');
        }}
        disabled={started}
        accessibilityRole="button"
        accessibilityLabel="Replay onboarding"
        style={[
          styles.onboardingButton,
          {
            top: insetsTop + 12,
            opacity: started ? 0 : 1,
          },
        ]}
        hitSlop={16}
      >
        <Feather
          name="rotate-ccw"
          size={20}
          color={theme.text}
          style={{ opacity: 0.9 }}
        />
      </Pressable>

      {/* Theme toggle — top right */}
      <Pressable
        onPress={onToggleTheme}
        disabled={started}
        accessibilityRole="button"
        accessibilityLabel={
          themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
        }
        style={[
          styles.themeToggle,
          {
            top: insetsTop + 12,
            opacity: started ? 0 : 1,
          },
        ]}
        hitSlop={16}
      >
        <View
          style={[
            styles.themeCircle,
            { backgroundColor: theme.accent, opacity: 0.7 },
          ]}
        />
      </Pressable>

      {/* Timer + yes button + goal slider — grouped under one
          spotlight so the tutorial reads as "this is the do-nothing
          control" instead of three separate rings stacked vertically. */}
      <TutorialStepWrapper name="home.timer" style={styles.heroGroup}>
        {/* Timer — also hidden while the interrupt sheet is up (paused /
            lock-triggered sessionEndedVisible) so it doesn't peek out from
            under the fading camera and duplicate the sheet's MM:SS. */}
        <View
          style={{ opacity: suppressed ? 0 : 1 }}
          pointerEvents={suppressed ? 'none' : 'auto'}
        >
          <Animated.View style={[timerEntryStyle, styles.centerContent]}>
            {!started ? (
              <RestingTimerText color={theme.text} />
            ) : (
              <TimerDisplay
                seconds={
                  goalSeconds > 0
                    ? Math.max(0, goalSeconds - elapsed)
                    : elapsed
                }
                color={theme.text}
                fontSize={64}
                style={{ letterSpacing: 4 }}
              />
            )}
          </Animated.View>
        </View>

        {/* Yes button — static terracotta pill at rest. */}
        <View
          style={styles.orbitWrap}
        >
          <View style={styles.orbitArea}>
            <View style={styles.orbitCenter}>
              <Pressable
                ref={yesButtonRef}
                onLayout={onYesButtonLayout}
                onPress={onStart}
                disabled={started}
                accessibilityRole="button"
                accessibilityLabel="Yes, start doing nothing"
              >
                <View
                  style={[
                    styles.yesButton,
                    { backgroundColor: theme.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.nothingLabel,
                      { color: theme.accentText, fontFamily: Fonts!.serif },
                    ]}
                  >
                    yes
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Goal slider */}
        <View
          style={[
            styles.messageSliderArea,
            { opacity: started ? 0 : 1 },
          ]}
          pointerEvents={started ? 'none' : 'auto'}
        >
          {!started && (
            <View style={styles.goalSliderWrap}>
              <RestingSliderWrap
                theme={theme}
                width={SLIDER_W}
                onChange={onSliderChange}
                onRelease={onSliderRelease}
              />
            </View>
          )}
        </View>
      </TutorialStepWrapper>

      {/* Stats — with goal slider overlaid */}
      <Pressable
        onPress={onHistory}
        disabled={started}
        style={{ opacity: started ? 0 : 1 }}
        accessibilityRole="button"
        accessibilityLabel={`Today ${todayStat.value} ${todayStat.unit}, this week ${weekStat.value} ${weekStat.unit}`}
        accessibilityHint="Opens your journey"
      >
        <View style={styles.statsColumn}>
          <View style={styles.statRow}>
            <Text
              style={[
                styles.statRowLabel,
                { color: theme.textSecondary, fontFamily: Fonts!.serif },
              ]}
            >
              today:
            </Text>
            <View style={styles.statRowValueRow}>
              <Text
                style={[
                  styles.statRowValue,
                  { color: theme.text, fontFamily: Fonts!.mono },
                ]}
              >
                {todayStat.value}
              </Text>
              <Text
                style={[styles.statRowUnit, { color: theme.textTertiary }]}
              >
                {todayStat.unit}
              </Text>
            </View>
          </View>
          <Text style={[styles.statDot, { color: theme.textTertiary }]}>
            ·
          </Text>
          <View style={styles.statRow}>
            <Text
              style={[
                styles.statRowLabel,
                { color: theme.textSecondary, fontFamily: Fonts!.serif },
              ]}
            >
              week:
            </Text>
            <View style={styles.statRowValueRow}>
              <Text
                style={[
                  styles.statRowValue,
                  { color: theme.text, fontFamily: Fonts!.mono },
                ]}
              >
                {weekStat.value}
              </Text>
              <Text
                style={[styles.statRowUnit, { color: theme.textTertiary }]}
              >
                {weekStat.unit}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {/* Week dots */}
      {weekStats.length > 0 && (
        <View
          style={[
            styles.weekSection,
            { opacity: started ? 0 : 1 },
          ]}
        >
          <View style={styles.weekGrid}>
            {weekStats.map((day) => {
              const size =
                day.duration > 0 ? 10 + (day.duration / maxDur) * 20 : 4;
              return (
                <View key={day.date} style={styles.weekDayCol}>
                  <View
                    style={{
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      backgroundColor:
                        day.duration > 0 ? theme.accent : theme.border,
                    }}
                  />
                  <Text
                    style={[
                      styles.weekDayLabel,
                      {
                        color: day.isToday
                          ? theme.text
                          : theme.textTertiary,
                      },
                    ]}
                  >
                    {day.dayName}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Bottom buttons */}
      <View
        style={[
          styles.bottomButtons,
          { bottom: 12, opacity: started ? 0 : 1 },
        ]}
        pointerEvents={started ? 'none' : 'auto'}
      >
        <TutorialStepWrapper name="home.journey">
          <Animated.View style={journeyPillStyle}>
            <Pressable
              onPress={onHistory}
              hitSlop={16}
              style={styles.journeyBtn}
              accessibilityRole="button"
              accessibilityLabel="My Journey"
            >
              <View
                ref={journeyBtnRef}
                onLayout={onJourneyBtnLayout}
                collapsable={false}
              >
                <Text
                  style={[
                    styles.journeyPillText,
                    {
                      color:
                        themeMode === 'dark' ? palette.cream : palette.brown,
                      fontFamily: Fonts!.serif,
                      opacity: 0,
                    },
                  ]}
                >
                  My Journey
                </Text>
              </View>
              <Animated.View
                style={[styles.journeyArrow, journeyChevronStyle]}
                pointerEvents='none'
              >
                <Entypo
                  name='chevron-thin-down'
                  size={20}
                  color={
                    themeMode === 'dark' ? palette.cream : palette.brown
                  }
                />
              </Animated.View>
            </Pressable>
          </Animated.View>
        </TutorialStepWrapper>
      </View>

      {/* (Running-mode UI — phrase, stop, eye-toggle — lives in the
          terracotta camera overlay rendered above this pane.
          Nothing renders here while `started` is true.) */}

      {/* First-run shield — swallows every tap until the tour is done.
          The copilot tooltips render in a portal above this. */}
      {tutorialGate && <View style={styles.tutorialShield} />}
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    width: '100%',
    height: 30,
    marginBottom: 24,
  },
  header: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 1,
    opacity: 0.85,
    fontWeight: '400',
  },
  lockButton: {
    position: 'absolute',
    left: 24,
  },
  tutorialShield: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  themeToggle: {
    position: 'absolute',
    right: 24,
  },
  onboardingButton: {
    position: 'absolute',
    right: 64,
  },
  themeCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  timer: {
    fontSize: 64,
    fontWeight: '200',
    letterSpacing: 4,
  },
  // Combined wrapper for timer + yes-button + slider so the tutorial
  // can spotlight all three as one logical control.
  heroGroup: {
    alignItems: 'center',
  },
  orbitCenter: {
    position: 'absolute',
  },
  orbitWrap: {
    width: 280,
    height: YES_BUTTON_SIZE,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitArea: {
    width: YES_BUTTON_SIZE,
    height: YES_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Static terracotta pill — the start screen's primary action.
  yesButton: {
    width: YES_BUTTON_SIZE,
    height: YES_BUTTON_SIZE,
    borderRadius: YES_BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  centerContent: {
    alignItems: 'center',
  },
  statsColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 19,
  },
  statDot: {
    fontSize: 18,
    marginTop: 7,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  statRowLabel: {
    fontSize: 14,
    fontWeight: '300',
  },
  statRowValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statRowValue: {
    fontSize: 26,
    fontWeight: '300',
  },
  statRowUnit: {
    fontSize: 12,
    fontWeight: '300',
    marginLeft: 3,
  },
  weekSection: {
    marginTop: 32,
    width: '100%',
    maxWidth: 280,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 44,
  },
  weekDayCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 6,
  },
  weekDayLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: 12,
    position: 'absolute',
  },
  journeyBtn: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  journeyArrow: {
    alignItems: 'center',
  },
  journeyPillText: {
    fontSize: 19,
    fontWeight: '400',
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  nothingLabel: {
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  messageSliderArea: {
    width: 300,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalSliderWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ── Self-subscribing slider helpers ─────────────────────────────────────
// Both consume `sliderMinutes` directly from the store so the parent
// shell never needs to subscribe — every slider snap re-renders only
// these tiny components, not the whole home tree.

const RestingTimerText = memo(function RestingTimerText({
  color,
}: {
  color: string;
}) {
  const sliderMinutes = useAppStore((s) => s.sliderMinutes);
  return (
    <Animated.Text
      style={[
        styles.timer,
        { color, fontFamily: Fonts!.mono, textAlign: 'center' },
      ]}
    >
      {`${String(sliderMinutes).padStart(2, '0')}:00`}
    </Animated.Text>
  );
});

interface RestingSliderWrapProps {
  theme: AppTheme;
  width: number;
  onChange: (minutes: number) => void;
  onRelease: (minutes: number) => void;
}

const RestingSliderWrap = memo(function RestingSliderWrap({
  theme,
  width,
  onChange,
  onRelease,
}: RestingSliderWrapProps) {
  const sliderMinutes = useAppStore((s) => s.sliderMinutes);
  return (
    <GoalSliderBar
      theme={theme}
      value={sliderMinutes}
      onChange={onChange}
      onRelease={onRelease}
      width={width}
      maxMinutes={60}
      minMinutes={1}
      allowInfinity
      ticks={[1, 5, 10, 15, 30, 45, 60]}
      scaleLabels={['1', '5', '10', '15', '30', '45', '60']}
      breakpoints={{ b1Val: 15, b1Pos: 1 / 2, b2Val: 30, b2Pos: 2 / 3, b3Val: 45, b3Pos: 5 / 6 }}
      accessibilityLabel="Session goal"
      accentColor={theme.accent}
      trackBgColor={theme.text}
      trackStrokeWidth={3.5}
      scaleLabelStyle={{
        color: theme.text,
        fontWeight: '500',
        fontSize: 12,
      }}
      hideLabel
    />
  );
});

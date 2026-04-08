import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { themes, palette } from '@/lib/theme';
import { useAppStore } from '@/lib/store';
import { setSetting } from '@/lib/db/settings';
import { insertReminder } from '@/lib/db/reminders';
import { getAllReminders } from '@/lib/db/reminders';
import { requestPermission, syncReminders } from '@/lib/notifications';
import { SCREENS, GOAL_MINUTES } from '@/lib/onboarding-data';
import { DEFAULT_REMINDERS } from '@/components/onboarding/screens/ScheduleScreen';
import type { ReminderDraft } from '@/components/onboarding/screens/ScheduleScreen';
import PickerSheet from '@/components/PickerSheet';
import TimePickerContent from '@/components/TimePicker';
import type BottomSheet from '@gorhom/bottom-sheet';

import PillButton from '@/components/PillButton';

// Screens
import NostalgiaScreen from '@/components/onboarding/screens/NostalgiaScreen';
import EvidenceScreen from '@/components/onboarding/screens/EvidenceScreen';
import RushingScreen from '@/components/onboarding/screens/RushingScreen';
import PhoneSymptomScreen from '@/components/onboarding/screens/PhoneSymptomScreen';
import PainQuizScreen from '@/components/onboarding/screens/PainQuizScreen';
import ScreenTimeQuizScreen from '@/components/onboarding/screens/ScreenTimeQuizScreen';
import HowItWorksScreen from '@/components/onboarding/screens/HowItWorksScreen';
import SetGoalScreen from '@/components/onboarding/screens/SetGoalScreen';
import ScheduleScreen from '@/components/onboarding/screens/ScheduleScreen';
import ScreenTimeStatsScreen from '@/components/onboarding/screens/ScreenTimeStatsScreen';
import TryNothingScreen from '@/components/onboarding/screens/TryNothingScreen';
import FirstMinuteDoneScreen from '@/components/onboarding/screens/FirstMinuteDoneScreen';
import DailyBenefitsScreen from '@/components/onboarding/screens/DailyBenefitsScreen';
import PersonalizedResultScreen from '@/components/onboarding/screens/PersonalizedResultScreen';

const __DEV_JUMP__ = __DEV__;

const TOTAL_PAGES = SCREENS.length + 3; // +3 for ScreenTimeStats, TryNothing, FirstMinuteDone, DailyBenefits

const PAGE_NAMES = [
  '0 Nostalgia',
  '1 Rushing',
  '2 Evidence',
  '3 PhoneSymptom',
  '4 PainQuiz',
  '5 ScreenTimeQuiz',
  '6 ScreenTimeStats',
  '7 TryNothing',
  '8 FirstMinuteDone',
  '9 DailyBenefits',
  '10 HowItWorks',
  '11 SetGoal',
  '12 Schedule',
  '13 PersonalizedResult',
];

function getPageBg(page: number): string {
  switch (page) {
    case 4:  // PainQuiz
    case 5:  // ScreenTimeQuiz
      return palette.charcoal;
    case 7:  // TryNothing
      return palette.cream;
    case 8:  // FirstMinuteDone
      return palette.terracotta;
    case 9:  // DailyBenefits
      return palette.charcoal;
    default:
      return palette.cream;
  }
}

export default function OnboardingRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(0);

  // Quiz state
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [screenTime, setScreenTime] = useState<string[]>([]);
  const [goal, setGoal] = useState<string[]>([]);
  const [reminders, setReminders] = useState<ReminderDraft[]>(DEFAULT_REMINDERS);
  const [showJumper, setShowJumper] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const reminderSheetRef = useRef<BottomSheet>(null);

  const editingReminder = editingReminderId ? reminders.find((r) => r.id === editingReminderId) : null;

  const handleEditReminder = useCallback((id: string | null) => {
    setEditingReminderId(id);
    reminderSheetRef.current?.expand();
  }, []);

  const handleConfirmReminder = useCallback((hour: number, minute: number, weekdays: number[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (editingReminderId) {
      setReminders((prev) =>
        prev.map((r) => r.id === editingReminderId ? { ...r, hour, minute, weekdays } : r),
      );
    } else {
      setReminders((prev) => [
        ...prev,
        { id: `custom-${Date.now()}`, hour, minute, weekdays, enabled: true },
      ]);
    }
    reminderSheetRef.current?.close();
  }, [editingReminderId]);

  // Pages 6, 7, 8, 9 are extra screens not in SCREENS array
  const screenIndex = (() => {
    if (currentPage <= 5) return currentPage;
    if (currentPage === 6) return -1; // ScreenTimeStats
    if (currentPage === 7) return -1; // TryNothing
    if (currentPage === 8) return -1; // FirstMinuteDone
    if (currentPage === 9) return -1; // DailyBenefits
    return currentPage - 3;           // rest offset by 3
  })();
  const currentScreen = screenIndex >= 0 ? SCREENS[screenIndex] : null;

  // Onboarding always uses custom themes, independent of phone setting
  const darkScreenIds = ['painQuiz', 'screenTimeQuiz'];
  const isDarkOverride = darkScreenIds.includes(currentScreen?.id ?? '') || currentPage === 9;
  const screenTheme = isDarkOverride ? themes.dark : themes.light;

  // Can advance: quiz/setup screens require selection
  const canAdvance = (() => {
    switch (currentScreen?.id) {
      case 'painQuiz':
        return painPoints.length > 0;
      case 'screenTimeQuiz':
        return screenTime.length > 0;
      case 'setGoal':
        return goal.length > 0;
      case 'schedule':
        return reminders.some((r) => r.enabled);
      default:
        return true;
    }
  })();

  const goNext = useCallback(async () => {
    if (currentPage < TOTAL_PAGES - 1) {
      // Request notification permission when leaving schedule screen
      if (currentScreen?.id === 'schedule') {
        await requestPermission();
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, currentScreen]);

  const handleFinish = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Save quiz answers
    if (painPoints.length > 0) {
      setSetting('onboarding_painPoints', JSON.stringify(painPoints));
    }
    if (screenTime.length > 0) {
      setSetting('onboarding_screenTime', screenTime[0]);
    }
    const enabledReminders = reminders.filter((r) => r.enabled);
    if (enabledReminders.length > 0) {
      setSetting('onboarding_reminderSlot', JSON.stringify(enabledReminders));
    }

    // Set daily goal
    if (goal.length > 0) {
      const minutes = GOAL_MINUTES[goal[0]] ?? (parseInt(goal[0]) || 5);
      await useAppStore.getState().setDailyGoal(minutes);
    }

    // Set up reminders for all enabled drafts
    if (enabledReminders.length > 0) {
      const status = await requestPermission();
      if (status === 'granted') {
        for (const draft of enabledReminders) {
          insertReminder(draft.hour, draft.minute, draft.weekdays);
        }
        const savedReminders = getAllReminders();
        await syncReminders(savedReminders);
        useAppStore.setState({ reminders: savedReminders });
      }
    }

    // Mark onboarding complete
    useAppStore.getState().setOnboardingComplete();

    // Navigate to main and start session
    router.replace('/');
    setTimeout(() => {
      useAppStore.getState().startSession();
    }, 500);
  }, [painPoints, screenTime, goal, reminders, router]);

  const isLastScreen = currentPage === TOTAL_PAGES - 1;
  // Screens with their own navigation buttons (no shared Continue)
  const extraOwnButton = [6, 7, 8, 9]; // ScreenTimeStats, TryNothing, FirstMinuteDone, DailyBenefits
  const hasOwnButton = ['nostalgia', 'rushing', 'evidence', 'phoneSymptom'].includes(currentScreen?.id ?? '') || extraOwnButton.includes(currentPage);
  const showBottomButton = !hasOwnButton && canAdvance;

  const renderScreen = () => {
    const props = { isActive: true, onNext: goNext, theme: screenTheme };
    switch (currentPage) {
      case 0: return <NostalgiaScreen {...props} />;
      case 1: return <RushingScreen {...props} />;
      case 2: return <EvidenceScreen {...props} />;
      case 3: return <PhoneSymptomScreen {...props} />;
      case 4: return <PainQuizScreen {...props} selected={painPoints} onSelect={setPainPoints} />;
      case 5: return <ScreenTimeQuizScreen {...props} selected={screenTime} onSelect={setScreenTime} />;
      case 6: return <ScreenTimeStatsScreen {...props} screenTimeAnswer={screenTime[0] ?? ''} />;
      case 7: return <TryNothingScreen {...props} />;
      case 8: return <FirstMinuteDoneScreen {...props} />;
      case 9: return <DailyBenefitsScreen {...props} />;
      case 10: return <HowItWorksScreen {...props} />;
      case 11: return <SetGoalScreen {...props} selected={goal} onSelect={setGoal} screenTimeAnswer={screenTime[0] ?? ''} />;
      case 12: return <ScheduleScreen {...props} reminders={reminders} onRemindersChange={setReminders} onEditReminder={handleEditReminder} />;
      case 13: return <PersonalizedResultScreen {...props} painPoints={painPoints} screenTime={screenTime[0] ?? ''} goal={goal[0] ?? '5m'} reminders={reminders} />;
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getPageBg(currentPage) }]}>
      <StatusBar style={isDarkOverride ? 'light' : 'dark'} />

      <Animated.View
        key={currentPage}
        entering={FadeIn.duration(400)}
        exiting={FadeOut.duration(200)}
        style={styles.page}
      >
        {renderScreen()}
      </Animated.View>

      {/* Bottom Continue button */}
      {showBottomButton && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.bottomButton, { paddingBottom: insets.bottom + 24 }]}
        >
          <PillButton
            label={isLastScreen ? 'Start' : 'Continue'}
            onPress={isLastScreen ? handleFinish : goNext}
            color={isLastScreen ? palette.terracotta : screenTheme.text}
            variant={isLastScreen ? 'filled' : 'outline'}
          />
        </Animated.View>
      )}

      {/* Back button on second screen (no progress bar) */}
      {currentPage === 1 && (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCurrentPage(0); }}
          style={[styles.backButton, { position: 'absolute', top: insets.top + 10, left: 16 }]}
          hitSlop={16}
        >
          <Feather name="chevron-left" size={22} color={screenTheme.text} style={{ opacity: 0.6 }} />
        </Pressable>
      )}

      {/* Top bar: back button + progress (hidden on first two screens) */}
      {currentPage >= 2 && (
        <View style={[styles.topBar, { top: insets.top + 10 }]}>
          {currentPage > 0 ? (
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCurrentPage(currentPage - 1); }}
              style={styles.backButton}
              hitSlop={16}
            >
              <Feather name="chevron-left" size={22} color={[8, 9].includes(currentPage) ? palette.cream : screenTheme.text} style={{ opacity: 0.6 }} />
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
          {![7, 8, 9].includes(currentPage) && (
            <View style={[styles.progressTrack, { backgroundColor: 'rgba(68,68,68,0.12)' }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: palette.terracotta,
                    width: `${((currentPage + 1) / TOTAL_PAGES) * 100}%`,
                  },
                ]}
              />
            </View>
          )}
        </View>
      )}

      {/* Schedule reminder picker — at top level so it's above Continue button */}
      {currentPage === 12 && (
        <PickerSheet ref={reminderSheetRef} theme={themes.light} onDismiss={() => setEditingReminderId(null)}>
          <TimePickerContent
            key={editingReminderId ?? 'new'}
            theme={themes.light}
            title={editingReminderId ? 'Edit reminder' : 'Add reminder'}
            initialHour={editingReminder?.hour}
            initialMinute={editingReminder?.minute}
            initialDays={editingReminder?.weekdays}
            onConfirm={handleConfirmReminder}
            onCancel={() => reminderSheetRef.current?.close()}
          />
        </PickerSheet>
      )}

      {/* DEV: Page jumper button */}
      {__DEV_JUMP__ && (
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); setShowJumper(true); }}
          style={[styles.jumperButton, { bottom: insets.bottom + 8 }]}
        >
          <Text style={styles.jumperButtonText}>{currentPage}</Text>
        </Pressable>
      )}
      {__DEV_JUMP__ && (
        <Modal visible={showJumper} animationType="fade" transparent onRequestClose={() => setShowJumper(false)}>
          <Pressable style={styles.jumperOverlay} onPress={() => setShowJumper(false)}>
            <Pressable style={[styles.jumperSheet, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.jumperTitle}>Jump to page</Text>
              <ScrollView style={styles.jumperScroll} bounces={false}>
                {PAGE_NAMES.map((name, i) => (
                  <Pressable
                    key={i}
                    onPress={() => { setCurrentPage(i); setShowJumper(false); Haptics.selectionAsync(); }}
                    style={[styles.jumperRow, currentPage === i && styles.jumperRowActive]}
                  >
                    <Text style={[styles.jumperText, currentPage === i && styles.jumperTextActive]}>
                      {name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  bottomButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 23,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backPlaceholder: {
    width: 28,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: 5,
  },
  jumperButton: {
    position: 'absolute',
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumperButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.brown,
  },
  jumperOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  jumperSheet: {
    backgroundColor: palette.cream,
    borderRadius: 20,
    paddingTop: 20,
    width: '80%',
    maxHeight: '70%',
  },
  jumperTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    color: palette.brown,
  },
  jumperScroll: {
    paddingHorizontal: 8,
  },
  jumperRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  jumperRowActive: {
    backgroundColor: palette.terracotta + '20',
  },
  jumperText: {
    fontSize: 14,
    color: palette.brown,
  },
  jumperTextActive: {
    color: palette.terracotta,
    fontWeight: '600',
  },
});

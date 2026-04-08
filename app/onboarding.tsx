import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
import { SCREENS, GOAL_MINUTES, SCHEDULE_HOURS } from '@/lib/onboarding-data';

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
import PersonalizedResultScreen from '@/components/onboarding/screens/PersonalizedResultScreen';
import LetsGoScreen from '@/components/onboarding/screens/LetsGoScreen';

const TOTAL_PAGES = SCREENS.length + 2; // +2 for ScreenTimeStats, TryNothing (FirstMinuteDone replaces TheTurn)

export default function OnboardingRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentPage, setCurrentPage] = useState(0);

  // Quiz state
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [screenTime, setScreenTime] = useState<string[]>([]);
  const [goal, setGoal] = useState<string[]>([]);
  const [scheduleSlot, setScheduleSlot] = useState<string[]>([]);

  // Pages 6, 7, 8 are extra screens not in SCREENS array
  const screenIndex = (() => {
    if (currentPage <= 5) return currentPage;
    if (currentPage === 6) return -1; // ScreenTimeStats
    if (currentPage === 7) return -1; // TryNothing
    if (currentPage === 8) return -1; // FirstMinuteDone
    return currentPage - 2;           // rest offset by 2 (TheTurn removed, 3 extra - 1 removed = 2)
  })();
  const currentScreen = screenIndex >= 0 ? SCREENS[screenIndex] : null;

  // Onboarding always uses custom themes, independent of phone setting
  const darkScreenIds = ['painQuiz', 'screenTimeQuiz'];
  const isDarkOverride = darkScreenIds.includes(currentScreen?.id ?? '');
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
        return scheduleSlot.length > 0;
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
    if (scheduleSlot.length > 0) {
      setSetting('onboarding_reminderSlot', scheduleSlot[0]);
    }

    // Set daily goal
    if (goal.length > 0) {
      const minutes = GOAL_MINUTES[goal[0]] ?? 5;
      await useAppStore.getState().setDailyGoal(minutes);
    }

    // Set up reminder — insert directly to avoid Alert on denied permissions
    if (scheduleSlot.length > 0) {
      const slot = SCHEDULE_HOURS[scheduleSlot[0]];
      if (slot) {
        const status = await requestPermission();
        if (status === 'granted') {
          insertReminder(slot.hour, slot.minute, [1, 2, 3, 4, 5, 6, 7]);
          const reminders = getAllReminders();
          await syncReminders(reminders);
          useAppStore.setState({ reminders });
        }
      }
    }

    // Mark onboarding complete
    useAppStore.getState().setOnboardingComplete();

    // Navigate to main and start session
    router.replace('/');
    setTimeout(() => {
      useAppStore.getState().startSession();
    }, 500);
  }, [painPoints, screenTime, goal, scheduleSlot, router]);

  // Last screen (LetsGo) has its own button
  const isLastScreen = currentPage === TOTAL_PAGES - 1;
  // Quiz/setup screens have their own Continue button
  // Screens with their own navigation buttons (no shared Continue)
  const extraOwnButton = [6, 7, 8]; // ScreenTimeStats, TryNothing, FirstMinuteDone
  const hasOwnButton = ['nostalgia', 'rushing', 'evidence', 'phoneSymptom'].includes(currentScreen?.id ?? '') || extraOwnButton.includes(currentPage);
  const showBottomButton = !isLastScreen && !hasOwnButton && canAdvance;

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
      case 9: return <HowItWorksScreen {...props} />;
      case 10: return <SetGoalScreen {...props} selected={goal} onSelect={setGoal} screenTimeAnswer={screenTime[0] ?? ''} />;
      case 11: return <ScheduleScreen {...props} selected={scheduleSlot} onSelect={setScheduleSlot} />;
      case 12: return <PersonalizedResultScreen {...props} painPoints={painPoints} screenTime={screenTime[0] ?? ''} goal={goal[0] ?? '5m'} scheduleSlot={scheduleSlot[0] ?? ''} />;
      case 13: return <LetsGoScreen isActive onFinish={handleFinish} theme={screenTheme} />;
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: screenTheme.bg }]}>
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
            label="Continue"
            onPress={goNext}
            color={screenTheme.text}
            outline
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
              <Feather name="chevron-left" size={22} color={screenTheme.text} style={{ opacity: 0.6 }} />
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
          {currentPage !== 7 && (
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
});

import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

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
import RushingScreen from '@/components/onboarding/screens/RushingScreen';
import PhoneSymptomScreen from '@/components/onboarding/screens/PhoneSymptomScreen';
import PainQuizScreen from '@/components/onboarding/screens/PainQuizScreen';
import ScreenTimeQuizScreen from '@/components/onboarding/screens/ScreenTimeQuizScreen';
import TheTurnScreen from '@/components/onboarding/screens/TheTurnScreen';
import HowItWorksScreen from '@/components/onboarding/screens/HowItWorksScreen';
import SetGoalScreen from '@/components/onboarding/screens/SetGoalScreen';
import ScheduleScreen from '@/components/onboarding/screens/ScheduleScreen';
import PersonalizedResultScreen from '@/components/onboarding/screens/PersonalizedResultScreen';
import LetsGoScreen from '@/components/onboarding/screens/LetsGoScreen';

const TOTAL_PAGES = SCREENS.length; // 11

export default function OnboardingRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themes[themeMode];

  const [currentPage, setCurrentPage] = useState(0);

  // Quiz state
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [screenTime, setScreenTime] = useState<string[]>([]);
  const [goal, setGoal] = useState<string[]>([]);
  const [scheduleSlot, setScheduleSlot] = useState<string[]>([]);

  const currentScreen = SCREENS[currentPage];

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

  const goNext = useCallback(() => {
    if (currentPage < TOTAL_PAGES - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage]);

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
  const isLastScreen = currentScreen?.id === 'letsGo';
  // Quiz/setup screens have their own Continue button
  const hasOwnButton = ['painQuiz', 'screenTimeQuiz', 'setGoal', 'schedule'].includes(currentScreen?.id ?? '');
  const showBottomButton = !isLastScreen && !hasOwnButton;

  const renderScreen = () => {
    const props = { isActive: true, onNext: goNext, theme };
    switch (currentPage) {
      case 0: return <NostalgiaScreen {...props} />;
      case 1: return <RushingScreen {...props} />;
      case 2: return <PhoneSymptomScreen {...props} />;
      case 3: return <PainQuizScreen {...props} selected={painPoints} onSelect={setPainPoints} />;
      case 4: return <ScreenTimeQuizScreen {...props} selected={screenTime} onSelect={setScreenTime} />;
      case 5: return <TheTurnScreen {...props} />;
      case 6: return <HowItWorksScreen {...props} />;
      case 7: return <SetGoalScreen {...props} selected={goal} onSelect={setGoal} screenTimeAnswer={screenTime[0] ?? ''} />;
      case 8: return <ScheduleScreen {...props} selected={scheduleSlot} onSelect={setScheduleSlot} />;
      case 9: return <PersonalizedResultScreen {...props} painPoints={painPoints} screenTime={screenTime[0] ?? ''} goal={goal[0] ?? '5m'} scheduleSlot={scheduleSlot[0] ?? ''} />;
      case 10: return <LetsGoScreen isActive onFinish={handleFinish} theme={theme} />;
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />

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
        <View style={[styles.bottomButton, { paddingBottom: insets.bottom + 24 }]}>
          <PillButton
            label="Continue"
            onPress={goNext}
            color={theme.text}
          />
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
});

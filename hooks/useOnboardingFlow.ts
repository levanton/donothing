import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { haptics } from '@/lib/haptics';
import { track, registerProps } from '@/lib/analytics';

import { themes } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import { PAGES } from '@/lib/onboarding-data';
import type { OnboardingPage } from '@/lib/onboarding-data';
import { saveOnboardingData } from '@/lib/onboarding-persistence';

export interface OnboardingFlow {
  currentIndex: number;
  currentPage: OnboardingPage;
  totalPages: number;
  progress: number;
  isLastScreen: boolean;
  canAdvance: boolean;
  goNext: () => void;
  goBack: () => void;
  jumpTo: (index: number) => void;
  /** Persist answers + leave onboarding. Called by the final screen. */
  finish: () => void;

  painPoints: string[];
  setPainPoints: (v: string[]) => void;
  screenTime: string[];
  setScreenTime: (v: string[]) => void;
  age: string[];
  setAge: (v: string[]) => void;

  screenTheme: AppTheme;
  isDark: boolean;
}

export function useOnboardingFlow(): OnboardingFlow {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);

  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [screenTime, setScreenTime] = useState<string[]>([]);
  const [age, setAge] = useState<string[]>([]);

  const currentPage = PAGES[currentIndex];
  const totalPages = PAGES.length;
  const isLastScreen = currentIndex === totalPages - 1;
  const progress = (currentIndex + 1) / totalPages;

  const screenTheme = themes[currentPage.theme];
  const isDark = currentPage.theme === 'dark';

  // Analytics: fire once when onboarding opens, then on every screen view, so
  // the full funnel (started → per-screen drop-off → completed) is queryable.
  useEffect(() => {
    track('onboarding_started');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    track('onboarding_screen_viewed', { screen: currentPage.id, index: currentIndex });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage.id]);

  const canAdvance = (() => {
    switch (currentPage.id) {
      case 'painQuiz':
        return painPoints.length > 0;
      case 'screenTimeQuiz':
        return screenTime.length > 0;
      case 'ageQuiz':
        return age.length > 0;
      default:
        return true;
    }
  })();

  const goNext = useCallback(() => {
    if (currentIndex < totalPages - 1) {
      // Capture the quiz answer as the user leaves the screen — as an event
      // (response distribution) and as a super property (so the rest of the
      // funnel + conversion can be segmented by it).
      if (currentPage.id === 'painQuiz' && painPoints.length > 0) {
        track('onboarding_pain_answered', { painPoints });
        registerProps({ pain_points: painPoints });
      } else if (currentPage.id === 'screenTimeQuiz' && screenTime.length > 0) {
        track('onboarding_screentime_answered', { screenTime: screenTime[0] });
        registerProps({ screen_time: screenTime[0] });
      } else if (currentPage.id === 'ageQuiz' && age.length > 0) {
        track('onboarding_age_answered', { age: age[0] });
        registerProps({ age_band: age[0] });
      }
      haptics.light();
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, totalPages, currentPage.id, painPoints, screenTime, age]);

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      haptics.light();
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const jumpTo = useCallback((index: number) => {
    setCurrentIndex(index);
    haptics.select();
  }, []);

  const finish = useCallback(async () => {
    haptics.success();
    try {
      await saveOnboardingData({ painPoints, screenTime, router });
      track('onboarding_completed', {
        painPoints,
        screenTime: screenTime[0],
        age: age[0],
      });
    } catch (e) {
      // Persistence failed (disk full, DB locked, etc.). Stay on this
      // screen so the user can retry — marking onboarding complete now
      // would lose their answers and skip the flow on next launch.
      console.error('[onboarding] save failed:', e);
      Alert.alert(
        'Could not save',
        'Something went wrong saving your answers. Please try again.',
      );
    }
  }, [painPoints, screenTime, age, router]);

  return {
    currentIndex,
    currentPage,
    totalPages,
    progress,
    isLastScreen,
    canAdvance,
    goNext,
    goBack,
    jumpTo,
    finish,
    painPoints,
    setPainPoints,
    screenTime,
    setScreenTime,
    age,
    setAge,
    screenTheme,
    isDark,
  };
}

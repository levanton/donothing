import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { haptics } from '@/lib/haptics';

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
      haptics.light();
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, totalPages]);

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
  }, [painPoints, screenTime, router]);

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

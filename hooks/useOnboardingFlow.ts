import { useCallback, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { themes } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import { PAGES } from '@/lib/onboarding-data';
import type { OnboardingPage } from '@/lib/onboarding-data';

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

  painPoints: string[];
  setPainPoints: (v: string[]) => void;
  screenTime: string[];
  setScreenTime: (v: string[]) => void;
  goal: string[];
  setGoal: (v: string[]) => void;

  screenTheme: AppTheme;
  isDark: boolean;
}

export function useOnboardingFlow(): OnboardingFlow {
  const [currentIndex, setCurrentIndex] = useState(0);

  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [screenTime, setScreenTime] = useState<string[]>([]);
  const [goal, setGoal] = useState<string[]>([]);

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
      case 'setGoal':
        return goal.length > 0;
      default:
        return true;
    }
  })();

  const goNext = useCallback(() => {
    if (currentIndex < totalPages - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex, totalPages]);

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

  const jumpTo = useCallback((index: number) => {
    setCurrentIndex(index);
    Haptics.selectionAsync();
  }, []);

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
    painPoints,
    setPainPoints,
    screenTime,
    setScreenTime,
    goal,
    setGoal,
    screenTheme,
    isDark,
  };
}

import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import type BottomSheet from '@gorhom/bottom-sheet';

import { themes } from '@/lib/theme';
import type { AppTheme } from '@/lib/theme';
import { PAGES } from '@/lib/onboarding-data';
import type { OnboardingPage } from '@/lib/onboarding-data';
import { DEFAULT_REMINDERS } from '@/components/onboarding/screens/ScheduleScreen';
import type { ReminderDraft } from '@/components/onboarding/screens/ScheduleScreen';

export interface OnboardingFlow {
  // Navigation
  currentIndex: number;
  currentPage: OnboardingPage;
  totalPages: number;
  progress: number;
  isLastScreen: boolean;
  canAdvance: boolean;
  goNext: () => void;
  goBack: () => void;
  jumpTo: (index: number) => void;

  // Quiz state
  painPoints: string[];
  setPainPoints: (v: string[]) => void;
  screenTime: string[];
  setScreenTime: (v: string[]) => void;
  goal: string[];
  setGoal: (v: string[]) => void;

  // Reminder state
  reminders: ReminderDraft[];
  setReminders: React.Dispatch<React.SetStateAction<ReminderDraft[]>>;
  editingReminderId: string | null;
  editingReminder: ReminderDraft | undefined;
  handleEditReminder: (id: string | null) => void;
  handleConfirmReminder: (hour: number, minute: number, weekdays: number[]) => void;
  reminderSheetRef: React.RefObject<BottomSheet | null>;

  // Theme
  screenTheme: AppTheme;
  isDark: boolean;
}

export function useOnboardingFlow(): OnboardingFlow {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Quiz state
  const [painPoints, setPainPoints] = useState<string[]>([]);
  const [screenTime, setScreenTime] = useState<string[]>([]);
  const [goal, setGoal] = useState<string[]>([]);

  // Reminder state
  const [reminders, setReminders] = useState<ReminderDraft[]>(DEFAULT_REMINDERS);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const reminderSheetRef = useRef<BottomSheet>(null);

  const currentPage = PAGES[currentIndex];
  const totalPages = PAGES.length;
  const isLastScreen = currentIndex === totalPages - 1;
  const progress = (currentIndex + 1) / totalPages;

  const screenTheme = themes[currentPage.theme];
  const isDark = currentPage.theme === 'dark';

  // Validation: quiz/setup screens require selection
  const canAdvance = (() => {
    switch (currentPage.id) {
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

  // Reminder editing
  const editingReminder = editingReminderId
    ? reminders.find((r) => r.id === editingReminderId)
    : undefined;

  const handleEditReminder = useCallback((id: string | null) => {
    setEditingReminderId(id);
    reminderSheetRef.current?.expand();
  }, []);

  const handleConfirmReminder = useCallback(
    (hour: number, minute: number, weekdays: number[]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (editingReminderId) {
        setReminders((prev) =>
          prev.map((r) =>
            r.id === editingReminderId ? { ...r, hour, minute, weekdays } : r,
          ),
        );
      } else {
        setReminders((prev) => [
          ...prev,
          { id: `custom-${Date.now()}`, hour, minute, weekdays, enabled: true },
        ]);
      }
      reminderSheetRef.current?.close();
    },
    [editingReminderId],
  );

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
    reminders,
    setReminders,
    editingReminderId,
    editingReminder,
    handleEditReminder,
    handleConfirmReminder,
    reminderSheetRef,
    screenTheme,
    isDark,
  };
}

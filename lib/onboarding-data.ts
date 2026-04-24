// Onboarding screen definitions (v1 — Main, Status = Ready only)

import { palette } from '@/lib/theme';
import type { ThemeMode } from '@/lib/theme';

export type ScreenType = 'story' | 'quiz' | 'info' | 'setup' | 'cta';

export interface OnboardingScreen {
  id: string;
  type: ScreenType;
  heading: string;
  body?: string;
  options?: string[];
  multi?: boolean; // multi-select quiz
}

export const SCREENS: OnboardingScreen[] = [
  {
    id: 'nostalgia',
    type: 'story',
    heading: 'Remember being a kid? Lying in the grass. Staring at clouds. Dreaming. Time just... stopped.',
  },
  {
    id: 'rushing',
    type: 'story',
    heading: 'Now you rush to work. Start a task. Run to the store. Cook. Clean. Fix. Reply. Pick up kids. Rush somewhere else.',
    body: 'Even when you\'re not scrolling — you\'re rushing.',
  },
  {
    id: 'evidence',
    type: 'story',
    heading: 'The Evidence',
  },
  {
    id: 'phoneSymptom',
    type: 'story',
    heading: 'And in between — you scroll. Not because you want to. Because your brain forgot how to just... stop.',
  },
  {
    id: 'painQuiz',
    type: 'quiz',
    heading: 'What bothers you most?',
    options: [
      'I scroll too much',
      'I can\'t stop rushing',
      'I don\'t have time for myself',
      'I feel anxious and overwhelmed',
      'I want better sleep',
      'I want to be more present',
    ],
    multi: true,
  },
  {
    id: 'screenTimeQuiz',
    type: 'quiz',
    heading: 'How many hours a day on your phone?',
    options: ['2–3h', '4–5h', '6–7h', '8+'],
  },
  {
    id: 'theTurn',
    type: 'story',
    heading: 'What if you just... did nothing? Like you used to. Even one minute a day can change everything.',
  },
  {
    id: 'howItWorks',
    type: 'info',
    heading: 'Open. Start. Put your phone down. Breathe. That\'s it.',
  },
  {
    id: 'setGoal',
    type: 'setup',
    heading: 'How much nothing per day?',
    body: 'Start small. You can always increase later.',
    options: ['1m', '5m', '10m', '15m', '30m'],
  },
  {
    id: 'personalResult',
    type: 'info',
    heading: 'Your plan is ready.',
  },
];

// Goal recommendation based on screen time answer
export const GOAL_BY_SCREEN_TIME: Record<string, number> = {
  '2–3h': 5,
  '4–5h': 10,
  '6–7h': 15,
  '8+': 15,
};

// Goal option label → minutes
export const GOAL_MINUTES: Record<string, number> = {
  '1m': 1,
  '5m': 5,
  '10m': 10,
  '15m': 15,
  '30m': 30,
};

// ── Flat page list — single source of truth for the onboarding flow ──────

export type PageId =
  | 'nostalgia' | 'rushing' | 'evidence' | 'phoneSymptom'
  | 'painQuiz' | 'screenTimeQuiz'
  | 'screenTimeStats' | 'tryNothing' | 'firstMinuteDone' | 'dailyBenefits'
  | 'testimonials' | 'howItWorks' | 'setGoal' | 'personalResult'
  | 'paywall';

export interface OnboardingPage {
  id: PageId;
  bg: string;
  theme: ThemeMode;
  hasOwnButton: boolean;
  showProgress: boolean;
  showBackButton: boolean;
}

export const PAGES: OnboardingPage[] = [
  { id: 'nostalgia',       bg: palette.cream,      theme: 'light', hasOwnButton: true,  showProgress: false, showBackButton: false },
  { id: 'rushing',         bg: palette.cream,      theme: 'light', hasOwnButton: true,  showProgress: false, showBackButton: true  },
  { id: 'evidence',        bg: palette.cream,      theme: 'light', hasOwnButton: true,  showProgress: true,  showBackButton: true  },
  { id: 'phoneSymptom',    bg: palette.cream,      theme: 'light', hasOwnButton: true,  showProgress: true,  showBackButton: true  },
  { id: 'painQuiz',        bg: palette.charcoal,   theme: 'dark',  hasOwnButton: false, showProgress: true,  showBackButton: true  },
  { id: 'screenTimeQuiz',  bg: palette.charcoal,   theme: 'dark',  hasOwnButton: false, showProgress: true,  showBackButton: true  },
  { id: 'screenTimeStats', bg: palette.cream,      theme: 'light', hasOwnButton: true,  showProgress: true,  showBackButton: true  },
  { id: 'tryNothing',      bg: palette.cream,      theme: 'light', hasOwnButton: true,  showProgress: false, showBackButton: true  },
  { id: 'firstMinuteDone', bg: palette.terracotta, theme: 'light', hasOwnButton: true,  showProgress: false, showBackButton: true  },
  { id: 'dailyBenefits',   bg: palette.charcoal,   theme: 'dark',  hasOwnButton: true,  showProgress: false, showBackButton: true  },
  { id: 'testimonials',    bg: palette.cream,      theme: 'light', hasOwnButton: true,  showProgress: true,  showBackButton: true  },
  { id: 'howItWorks',      bg: palette.cream,      theme: 'light', hasOwnButton: false, showProgress: true,  showBackButton: true  },
  { id: 'setGoal',         bg: palette.cream,      theme: 'light', hasOwnButton: false, showProgress: true,  showBackButton: true  },
  { id: 'personalResult',  bg: palette.cream,      theme: 'light', hasOwnButton: false, showProgress: true,  showBackButton: true  },
  { id: 'paywall',          bg: palette.cream,      theme: 'light', hasOwnButton: true,  showProgress: false, showBackButton: false },
];

// How-it-works steps with Feather icon names
export const HOW_IT_WORKS_STEPS = [
  { text: 'Open.', icon: 'smartphone' as const },
  { text: 'Start.', icon: 'play' as const },
  { text: 'Put your phone down.', icon: 'arrow-down' as const },
  { text: 'Breathe.', icon: 'wind' as const },
  { text: 'That\'s it.', icon: 'check' as const },
];

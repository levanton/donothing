// Onboarding screen definitions (v1 — Main, Status = Ready only)

import { palette, APP_BG } from '@/lib/theme';
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
      'I can\'t focus',
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
    heading: 'How many hours a day\non your phone?',
    options: ['2–3h', '4–5h', '6–7h', '8+'],
  },
  {
    id: 'ageQuiz',
    type: 'quiz',
    heading: 'How old are you? Roughly.',
    options: ['Under 18', '18–24', '25–34', '35–44', '45–54', '55+'],
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
    id: 'personalResult',
    type: 'info',
    heading: 'Your plan is ready.',
  },
];

// ── Flat page list — single source of truth for the onboarding flow ──────

export type PageId =
  | 'welcome'
  | 'nostalgia' | 'rushing' | 'evidence' | 'phoneSymptom'
  | 'painQuiz' | 'screenTimeQuiz' | 'ageQuiz'
  | 'screenTimeStats' | 'tryNothing' | 'firstMinuteDone' | 'dailyBenefits'
  | 'testimonials' | 'howItWorks' | 'permissions' | 'personalResult'
  | 'paywall';

export interface OnboardingPage {
  id: PageId;
  bg: string;
  theme: ThemeMode;
  hasOwnButton: boolean;
  /** Render a bottom-right circular arrow button (rendered in the shell, above
   *  the sliding view, so it stays put across page transitions). */
  hasCircleNext?: boolean;
  showProgress: boolean;
  showBackButton: boolean;
}

export const PAGES: OnboardingPage[] = [
  { id: 'welcome',         bg: APP_BG,             theme: 'light', hasOwnButton: true,  showProgress: false, showBackButton: false },
  { id: 'nostalgia',       bg: APP_BG,             theme: 'light', hasOwnButton: true,  hasCircleNext: true, showProgress: false, showBackButton: false },
  { id: 'rushing',         bg: APP_BG,             theme: 'light', hasOwnButton: true,  hasCircleNext: true, showProgress: false, showBackButton: true  },
  { id: 'phoneSymptom',    bg: APP_BG,             theme: 'light', hasOwnButton: false, showProgress: false, showBackButton: true  },
  { id: 'painQuiz',        bg: palette.charcoal,   theme: 'dark',  hasOwnButton: false, showProgress: true,  showBackButton: true  },
  { id: 'screenTimeQuiz',  bg: palette.charcoal,   theme: 'dark',  hasOwnButton: false, showProgress: true,  showBackButton: true  },
  { id: 'ageQuiz',         bg: palette.charcoal,   theme: 'dark',  hasOwnButton: false, showProgress: true,  showBackButton: true  },
  { id: 'screenTimeStats', bg: APP_BG,             theme: 'light', hasOwnButton: true,  showProgress: true,  showBackButton: true  },
  { id: 'tryNothing',      bg: palette.terracotta, theme: 'light', hasOwnButton: true,  showProgress: false, showBackButton: true  },
  { id: 'firstMinuteDone', bg: palette.terracotta, theme: 'light', hasOwnButton: true,  showProgress: false, showBackButton: true  },
  { id: 'evidence',        bg: APP_BG,             theme: 'light', hasOwnButton: true,  showProgress: false, showBackButton: true  },
  { id: 'howItWorks',      bg: APP_BG,             theme: 'light', hasOwnButton: false, showProgress: false, showBackButton: true  },
  { id: 'permissions',     bg: APP_BG,             theme: 'light', hasOwnButton: false, showProgress: true,  showBackButton: true  },
  { id: 'personalResult',  bg: APP_BG,             theme: 'light', hasOwnButton: true,  showProgress: true,  showBackButton: true  },
  { id: 'paywall',         bg: APP_BG,             theme: 'light', hasOwnButton: true,  showProgress: false, showBackButton: false },
];

import type { ReactNode } from 'react';

import type { PageId } from '@/lib/onboarding-data';
import type { OnboardingFlow } from '@/hooks/useOnboardingFlow';

import WelcomeScreen from './WelcomeScreen';
import NostalgiaScreen from './NostalgiaScreen';
import RushingScreen from './RushingScreen';
import EvidenceScreen from './EvidenceScreen';
import PhoneSymptomScreen from './PhoneSymptomScreen';
import PainQuizScreen from './PainQuizScreen';
import ScreenTimeQuizScreen from './ScreenTimeQuizScreen';
import AgeQuizScreen from './AgeQuizScreen';
import ScreenTimeStatsScreen from './ScreenTimeStatsScreen';
import TryNothingScreen from './TryNothingScreen';
import FirstMinuteDoneScreen from './FirstMinuteDoneScreen';
import DailyBenefitsScreen from './DailyBenefitsScreen';
import TestimonialsScreen from './TestimonialsScreen';
import HowItWorksScreen from './HowItWorksScreen';
import PermissionsScreen from './PermissionsScreen';
import PersonalizedResultScreen from './PersonalizedResultScreen';
import PaywallScreen from './PaywallScreen';

// Props every screen receives. Screens with extra needs (quiz answers,
// skip/finish callbacks) pull them straight from `flow` in their entry below.
const base = (flow: OnboardingFlow) => ({
  isActive: true,
  onNext: flow.goNext,
  theme: flow.screenTheme,
});

/**
 * Single source of truth: page id → how to render it.
 *
 * To add a screen:
 *   1. create its file in this folder
 *   2. add one entry here
 *   3. add it to PAGES in lib/onboarding-data.ts
 *
 * Because this is `Record<PageId, …>`, TypeScript fails the build if a page
 * is registered in PAGES but missing here (or vice versa) — no silent gaps,
 * no switch statement to keep in sync.
 */
export const SCREEN_REGISTRY: Record<PageId, (flow: OnboardingFlow) => ReactNode> = {
  welcome:         (f) => <WelcomeScreen {...base(f)} />,
  nostalgia:       (f) => <NostalgiaScreen {...base(f)} />,
  rushing:         (f) => <RushingScreen {...base(f)} />,
  evidence:        (f) => <EvidenceScreen {...base(f)} />,
  phoneSymptom:    (f) => <PhoneSymptomScreen {...base(f)} />,
  painQuiz:        (f) => <PainQuizScreen {...base(f)} selected={f.painPoints} onSelect={f.setPainPoints} />,
  screenTimeQuiz:  (f) => <ScreenTimeQuizScreen {...base(f)} selected={f.screenTime} onSelect={f.setScreenTime} />,
  ageQuiz:         (f) => <AgeQuizScreen {...base(f)} selected={f.age} onSelect={f.setAge} />,
  screenTimeStats: (f) => <ScreenTimeStatsScreen {...base(f)} screenTimeAnswer={f.screenTime[0] ?? ''} ageAnswer={f.age[0] ?? ''} />,
  tryNothing:      (f) => <TryNothingScreen {...base(f)} onSkip={() => f.jumpTo(f.currentIndex + 2)} />,
  firstMinuteDone: (f) => <FirstMinuteDoneScreen {...base(f)} />,
  dailyBenefits:   (f) => <DailyBenefitsScreen {...base(f)} />,
  testimonials:    (f) => <TestimonialsScreen {...base(f)} />,
  howItWorks:      (f) => <HowItWorksScreen {...base(f)} />,
  permissions:     (f) => <PermissionsScreen {...base(f)} />,
  personalResult:  (f) => <PersonalizedResultScreen {...base(f)} />,
  paywall:         (f) => <PaywallScreen {...base(f)} onFinish={f.finish} />,
};

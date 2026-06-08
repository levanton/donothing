import type { ReactNode } from 'react';

import type { PageId } from '@/lib/onboarding-data';
import type { OnboardingFlow } from '@/hooks/useOnboardingFlow';
import { fadeEnter, fadeExit } from '../transitions';

import WelcomeScreen from './WelcomeScreen';
import NostalgiaScreen from './NostalgiaScreen';
import RushingScreen from './RushingScreen';
import EvidenceScreen from './EvidenceScreen';
import PhoneSymptomScreen from './PhoneSymptomScreen';
import PainQuizScreen from './PainQuizScreen';
import ScreenTimeQuizScreen from './ScreenTimeQuizScreen';
import AgeQuizScreen from './AgeQuizScreen';
import ScreenTimeStatsScreen from './ScreenTimeStatsScreen';
import GoodNewsScreen from './GoodNewsScreen';
import TryNothingScreen from './TryNothingScreen';
import FirstMinuteDoneScreen from './FirstMinuteDoneScreen';
import DailyBenefitsScreen from './DailyBenefitsScreen';
import TestimonialsScreen from './TestimonialsScreen';
import HowItWorksScreen from './HowItWorksScreen';
import PermissionsScreen from './PermissionsScreen';
import PersonalizedResultScreen from './PersonalizedResultScreen';
import PaywallScreen from './PaywallScreen';
import AllSetScreen from './AllSetScreen';

// Props every screen receives. Screens with extra needs (quiz answers,
// skip/finish callbacks) pull them straight from `flow` in their entry below.
const base = (flow: OnboardingFlow) => ({
  isActive: true,
  onNext: flow.goNext,
  theme: flow.screenTheme,
});

interface ScreenEntry {
  render: (flow: OnboardingFlow) => ReactNode;
  /** Page-mount animation. */
  enter: unknown;
  /** Page-unmount animation. */
  exit: unknown;
}

/**
 * Single source of truth: page id → how to render it AND how it animates
 * in/out. The route reads `enter`/`exit` straight from here, so there is no
 * animation logic in app/onboarding.tsx anymore.
 *
 * To add a screen: create its file, add one entry here, add it to PAGES.
 * `Record<PageId, …>` makes TypeScript fail the build on any gap.
 */
export const SCREEN_REGISTRY: Record<PageId, ScreenEntry> = {
  welcome:         { render: (f) => <WelcomeScreen {...base(f)} />,        enter: fadeEnter,  exit: fadeExit },
  nostalgia:       { render: (f) => <NostalgiaScreen {...base(f)} />,      enter: fadeEnter,  exit: fadeExit },
  // 'now.' → 'what if…' share the persistent RadialDots layer: pages cross-fade
  // while the dots stay put and morph beneath.
  rushing:         { render: (f) => <RushingScreen {...base(f)} />,        enter: fadeEnter,  exit: fadeExit },
  evidence:        { render: (f) => <EvidenceScreen {...base(f)} />,       enter: fadeEnter,  exit: fadeExit },
  phoneSymptom:    { render: (f) => <PhoneSymptomScreen {...base(f)} />,   enter: fadeEnter,  exit: fadeExit },
  painQuiz:        { render: (f) => <PainQuizScreen {...base(f)} selected={f.painPoints} onSelect={f.setPainPoints} />, enter: fadeEnter, exit: fadeExit },
  screenTimeQuiz:  { render: (f) => <ScreenTimeQuizScreen {...base(f)} selected={f.screenTime} onSelect={f.setScreenTime} />, enter: fadeEnter, exit: fadeExit },
  ageQuiz:         { render: (f) => <AgeQuizScreen {...base(f)} selected={f.age} onSelect={f.setAge} />, enter: fadeEnter, exit: fadeExit },
  screenTimeStats: { render: (f) => <ScreenTimeStatsScreen {...base(f)} screenTimeAnswer={f.screenTime[0] ?? ''} ageAnswer={f.age[0] ?? ''} />, enter: fadeEnter, exit: fadeExit },
  goodNews:        { render: (f) => <GoodNewsScreen {...base(f)} />,        enter: fadeEnter,  exit: fadeExit },
  tryNothing:      { render: (f) => <TryNothingScreen {...base(f)} onSkip={() => f.jumpTo(f.currentIndex + 2)} />, enter: fadeEnter, exit: fadeExit },
  firstMinuteDone: { render: (f) => <FirstMinuteDoneScreen {...base(f)} />, enter: fadeEnter, exit: fadeExit },
  dailyBenefits:   { render: (f) => <DailyBenefitsScreen {...base(f)} />,   enter: fadeEnter, exit: fadeExit },
  testimonials:    { render: (f) => <TestimonialsScreen {...base(f)} />,    enter: fadeEnter, exit: fadeExit },
  howItWorks:      { render: (f) => <HowItWorksScreen {...base(f)} />,      enter: fadeEnter, exit: fadeExit },
  permissions:     { render: (f) => <PermissionsScreen {...base(f)} />,     enter: fadeEnter, exit: fadeExit },
  personalResult:  { render: (f) => <PersonalizedResultScreen {...base(f)} />, enter: fadeEnter, exit: fadeExit },
  paywall:         { render: (f) => <PaywallScreen {...base(f)} onFinish={f.goNext} />, enter: fadeEnter, exit: fadeExit },
  allSet:          { render: (f) => <AllSetScreen {...base(f)} onFinish={f.finish} />, enter: fadeEnter, exit: fadeExit },
};

import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { haptics } from '@/lib/haptics';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { palette, getStatusBarStyle } from '@/lib/theme';
import { PAGES } from '@/lib/onboarding-data';
import { saveOnboardingData } from '@/lib/onboarding-persistence';
import { useOnboardingFlow } from '@/hooks/useOnboardingFlow';
import PillButton from '@/components/PillButton';

// Screens
import NostalgiaScreen from '@/components/onboarding/screens/NostalgiaScreen';
import EvidenceScreen from '@/components/onboarding/screens/EvidenceScreen';
import RushingScreen from '@/components/onboarding/screens/RushingScreen';
import PhoneSymptomScreen from '@/components/onboarding/screens/PhoneSymptomScreen';
import PainQuizScreen from '@/components/onboarding/screens/PainQuizScreen';
import ScreenTimeQuizScreen from '@/components/onboarding/screens/ScreenTimeQuizScreen';
import AgeQuizScreen from '@/components/onboarding/screens/AgeQuizScreen';
import PermissionsScreen from '@/components/onboarding/screens/PermissionsScreen';
import HowItWorksScreen from '@/components/onboarding/screens/HowItWorksScreen';
import ScreenTimeStatsScreen from '@/components/onboarding/screens/ScreenTimeStatsScreen';
import TryNothingScreen from '@/components/onboarding/screens/TryNothingScreen';
import FirstMinuteDoneScreen from '@/components/onboarding/screens/FirstMinuteDoneScreen';
import DailyBenefitsScreen from '@/components/onboarding/screens/DailyBenefitsScreen';
import PersonalizedResultScreen from '@/components/onboarding/screens/PersonalizedResultScreen';
import TestimonialsScreen from '@/components/onboarding/screens/TestimonialsScreen';
import PaywallScreen from '@/components/onboarding/screens/PaywallScreen';

const __DEV_JUMP__ = __DEV__;

export default function OnboardingRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flow = useOnboardingFlow();
  const [showJumper, setShowJumper] = useState(false);

  const { currentPage, currentIndex, screenTheme, isDark } = flow;

  // Back button uses cream on dark/terracotta backgrounds
  const backColor = currentPage.bg === palette.terracotta || isDark
    ? palette.cream
    : screenTheme.text;

  const handleFinish = useCallback(async () => {
    haptics.success();
    try {
      await saveOnboardingData({
        painPoints: flow.painPoints,
        screenTime: flow.screenTime,
        router,
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
  }, [flow.painPoints, flow.screenTime, router]);

  const showBottomButton = !currentPage.hasOwnButton && flow.canAdvance;

  const renderScreen = () => {
    const props = { isActive: true, onNext: flow.goNext, theme: screenTheme };
    switch (currentPage.id) {
      case 'nostalgia':       return <NostalgiaScreen {...props} />;
      case 'rushing':         return <RushingScreen {...props} />;
      case 'evidence':        return <EvidenceScreen {...props} />;
      case 'phoneSymptom':    return <PhoneSymptomScreen {...props} />;
      case 'painQuiz':        return <PainQuizScreen {...props} selected={flow.painPoints} onSelect={flow.setPainPoints} />;
      case 'screenTimeQuiz':  return <ScreenTimeQuizScreen {...props} selected={flow.screenTime} onSelect={flow.setScreenTime} />;
      case 'ageQuiz':         return <AgeQuizScreen {...props} selected={flow.age} onSelect={flow.setAge} />;
      case 'screenTimeStats': return <ScreenTimeStatsScreen {...props} screenTimeAnswer={flow.screenTime[0] ?? ''} ageAnswer={flow.age[0] ?? ''} />;
      case 'tryNothing':      return <TryNothingScreen {...props} onSkip={() => flow.jumpTo(currentIndex + 2)} />;
      case 'firstMinuteDone': return <FirstMinuteDoneScreen {...props} />;
      case 'dailyBenefits':   return <DailyBenefitsScreen {...props} />;
      case 'testimonials':    return <TestimonialsScreen {...props} />;
      case 'howItWorks':      return <HowItWorksScreen {...props} />;
      case 'permissions':     return <PermissionsScreen {...props} />;
      case 'personalResult':  return <PersonalizedResultScreen {...props} />;
      case 'paywall':         return <PaywallScreen {...props} onFinish={handleFinish} />;
      default:                return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: currentPage.bg }]}>
      <StatusBar style={getStatusBarStyle(isDark)} />

      <Animated.View
        key={currentIndex}
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
            label={flow.isLastScreen ? 'Start' : 'Continue'}
            onPress={flow.isLastScreen ? handleFinish : flow.goNext}
            color={flow.isLastScreen ? palette.terracotta : screenTheme.text}
            variant={flow.isLastScreen ? 'filled' : 'outline'}
          />
        </Animated.View>
      )}

      {/* Top bar: back button + progress */}
      {currentPage.showBackButton && (
        <View style={[styles.topBar, { top: insets.top + 10 }]}>
          <Pressable
            onPress={flow.goBack}
            style={styles.backButton}
            hitSlop={16}
          >
            <Feather name="chevron-left" size={22} color={backColor} />
          </Pressable>
          {currentPage.showProgress && (
            <View style={[styles.progressTrack, { backgroundColor: palette.charcoal + '1F' }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: palette.terracotta,
                    width: `${flow.progress * 100}%`,
                  },
                ]}
              />
            </View>
          )}
        </View>
      )}

      {/* DEV: Page jumper */}
      {__DEV_JUMP__ && (
        <Pressable
          onPress={() => { haptics.heavy(); setShowJumper(true); }}
          style={[styles.jumperButton, { bottom: insets.bottom + 8 }]}
        >
          <Text style={styles.jumperButtonText}>{currentIndex}</Text>
        </Pressable>
      )}
      {__DEV_JUMP__ && (
        <Modal visible={showJumper} animationType="fade" transparent onRequestClose={() => setShowJumper(false)}>
          <Pressable style={styles.jumperOverlay} onPress={() => setShowJumper(false)}>
            <Pressable style={[styles.jumperSheet, { paddingBottom: insets.bottom + 16 }]}>
              <Text style={styles.jumperTitle}>Jump to page</Text>
              <ScrollView style={styles.jumperScroll} bounces={false}>
                {PAGES.map((page, i) => (
                  <Pressable
                    key={page.id}
                    onPress={() => { flow.jumpTo(i); setShowJumper(false); }}
                    style={[styles.jumperRow, currentIndex === i && styles.jumperRowActive]}
                  >
                    <Text style={[styles.jumperText, currentIndex === i && styles.jumperTextActive]}>
                      {i} {page.id}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
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
  jumperButton: {
    position: 'absolute',
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumperButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: palette.brown,
  },
  jumperOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  jumperSheet: {
    backgroundColor: palette.cream,
    borderRadius: 20,
    paddingTop: 20,
    width: '80%',
    maxHeight: '70%',
  },
  jumperTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
    color: palette.brown,
  },
  jumperScroll: {
    paddingHorizontal: 8,
  },
  jumperRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  jumperRowActive: {
    backgroundColor: palette.terracotta + '20',
  },
  jumperText: {
    fontSize: 14,
    color: palette.brown,
  },
  jumperTextActive: {
    color: palette.terracotta,
    fontWeight: '600',
  },
});

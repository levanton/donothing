import { Pressable, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { palette, getStatusBarStyle } from '@/lib/theme';
import { useOnboardingFlow } from '@/hooks/useOnboardingFlow';
import { SCREEN_REGISTRY } from '@/components/onboarding/screens/registry';
import PillButton from '@/components/PillButton';

export default function OnboardingRoute() {
  const insets = useSafeAreaInsets();
  const flow = useOnboardingFlow();

  const { currentPage, currentIndex, screenTheme, isDark } = flow;

  // Back button uses cream on dark/terracotta backgrounds
  const backColor = currentPage.bg === palette.terracotta || isDark
    ? palette.cream
    : screenTheme.text;

  const showBottomButton = !currentPage.hasOwnButton && flow.canAdvance;
  const screen = SCREEN_REGISTRY[currentPage.id];

  return (
    <View style={[styles.container, { backgroundColor: currentPage.bg }]}>
      <StatusBar style={getStatusBarStyle(isDark)} />

      <Animated.View
        key={currentIndex}
        entering={screen.enter as never}
        exiting={screen.exit as never}
        style={styles.page}
      >
        {screen.render(flow)}
      </Animated.View>

      {/* Bottom Continue button. */}
      {showBottomButton && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.bottomButton, { paddingBottom: insets.bottom + 24 }]}
        >
          <PillButton
            label={flow.isLastScreen ? 'start' : 'continue'}
            onPress={flow.isLastScreen ? flow.finish : flow.goNext}
            color={flow.isLastScreen ? palette.terracotta : screenTheme.text}
            variant={flow.isLastScreen ? 'filled' : 'outline'}
          />
        </Animated.View>
      )}

      {/* Circle next arrow — rendered above the sliding view so it stays put
          while page content slides in/out. */}
      {currentPage.hasCircleNext && (
        <Pressable
          onPress={flow.goNext}
          style={[styles.circleNext, { bottom: insets.bottom + 24, borderColor: screenTheme.text }]}
          hitSlop={12}
        >
          <Feather name="arrow-right" size={22} color={screenTheme.text} />
        </Pressable>
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
  circleNext: {
    position: 'absolute',
    right: 32,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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
});

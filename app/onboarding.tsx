import { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { EASE_IN_OUT } from '@/constants/animations';
import { palette, getStatusBarStyle } from '@/lib/theme';
import { useOnboardingFlow } from '@/hooks/useOnboardingFlow';
import { SCREEN_REGISTRY } from '@/components/onboarding/screens/registry';
import RadialDots from '@/components/onboarding/RadialDots';
import {
  DOT_MORPH_MS,
  getDotFieldLayout,
} from '@/components/onboarding/dotFieldLayout';
import PillButton from '@/components/PillButton';

// Pages that share the persistent RadialDots layer. Kept adjacent in PAGES so
// the dot field never unmounts between them — it morphs scatter → rings while
// gliding from the lower band ("now.") to the upper band ("what if…").
const DOT_SCATTER_PAGE = 'rushing'; // "now."   → progress 0, lower band
const DOT_RINGS_PAGE = 'phoneSymptom'; // "what if…" → progress 1, upper band

export default function OnboardingRoute() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const flow = useOnboardingFlow();

  const { currentPage, currentIndex, screenTheme, isDark } = flow;

  // ── Shared dot field ────────────────────────────────────────────────────
  // One RadialDots instance lives across the "now." ↔ "what if…" pair. It is
  // rendered as a sibling of the swapping page (not inside the keyed view) so
  // it survives the transition and morphs instead of remounting.
  const isDotScreen =
    currentPage.id === DOT_SCATTER_PAGE || currentPage.id === DOT_RINGS_PAGE;
  const dotProgress = useSharedValue(currentPage.id === DOT_RINGS_PAGE ? 1 : 0);
  const dotField = getDotFieldLayout(width, height);
  const dotFieldSize = dotField.size;

  // The field travels between the bands as the morph progresses: progress 0
  // keeps it in the lower band ("now."), progress 1 lifts it to the upper
  // band ("what if…") — one timing drives both the morph and the journey.
  const dotTravel = dotField.highTop - dotField.lowTop;
  const dotLayerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dotProgress.value * dotTravel }],
  }));

  useEffect(() => {
    if (currentPage.id === DOT_SCATTER_PAGE) {
      dotProgress.value = withTiming(0, { duration: DOT_MORPH_MS, easing: EASE_IN_OUT });
    } else if (currentPage.id === DOT_RINGS_PAGE) {
      dotProgress.value = withTiming(1, { duration: DOT_MORPH_MS, easing: EASE_IN_OUT });
    }
  }, [currentPage.id]);

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

      {/* Persistent dot field shared by the "now." ↔ "what if…" screens. It
          starts in the lower band (text above it), then glides to the upper
          band on "what if…" (text below it) while morphing scatter → rings. */}
      {isDotScreen && (
        <Animated.View
          exiting={FadeOut.duration(300)}
          pointerEvents="none"
          style={[
            styles.dotLayer,
            {
              left: dotField.left,
              top: dotField.lowTop,
              width: dotFieldSize,
              height: dotFieldSize,
            },
            dotLayerStyle,
          ]}
        >
          <RadialDots
            progress={dotProgress}
            size={dotFieldSize}
            orbiting={currentPage.id === DOT_RINGS_PAGE}
          />
        </Animated.View>
      )}

      {/* Bottom Continue button. On "what if…" it waits for the ride-up
          hand-off to finish before fading in. */}
      {showBottomButton && (
        <Animated.View
          entering={
            currentPage.id === DOT_RINGS_PAGE
              ? FadeIn.duration(400).delay(DOT_MORPH_MS)
              : FadeIn.duration(400)
          }
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
  dotLayer: {
    position: 'absolute',
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

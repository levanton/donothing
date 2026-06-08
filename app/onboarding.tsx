import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptics } from '@/lib/haptics';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { EASE_IN_OUT } from '@/constants/animations';
import { palette, getStatusBarStyle } from '@/lib/theme';
import { PAGES } from '@/lib/onboarding-data';
import { useOnboardingFlow } from '@/hooks/useOnboardingFlow';
import { SCREEN_REGISTRY } from '@/components/onboarding/screens/registry';
import RadialDots from '@/components/onboarding/RadialDots';
import PillButton from '@/components/PillButton';

const busyImage = require('@/assets/images/busy.png');

// Pages that share the persistent RadialDots layer. Kept adjacent in PAGES so
// the dot field never unmounts between them — it morphs scatter → rings.
const DOT_SCATTER_PAGE = 'rushing'; // "now."   → progress 0
const DOT_RINGS_PAGE = 'phoneSymptom'; // "what if…" → progress 1
// Dot morph duration — kept in sync with morphFade{Enter,Exit} (transitions.ts)
// so the dots reorganise exactly as the screens cross-fade.
const DOT_MORPH_MS = 1200;

const __DEV_JUMP__ = false && __DEV__;

export default function OnboardingRoute() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const flow = useOnboardingFlow();
  const [showJumper, setShowJumper] = useState(false);

  const { currentPage, currentIndex, screenTheme, isDark } = flow;

  // ── Shared dot field ────────────────────────────────────────────────────
  // One RadialDots instance lives across the "now." ↔ "what if…" pair. It is
  // rendered as a sibling of the swapping page (not inside the keyed view) so
  // it survives the transition and morphs instead of remounting.
  const isDotScreen =
    currentPage.id === DOT_SCATTER_PAGE || currentPage.id === DOT_RINGS_PAGE;
  const dotProgress = useSharedValue(currentPage.id === DOT_RINGS_PAGE ? 1 : 0);
  const dotFieldSize = Math.min(width * 0.9, height * 0.44, 350) * 0.9;

  // Fades the busy overlay in when the dot screen first appears.
  const busyReveal = useSharedValue(0);

  useEffect(() => {
    if (currentPage.id === DOT_SCATTER_PAGE) {
      dotProgress.value = withTiming(0, { duration: DOT_MORPH_MS, easing: EASE_IN_OUT });
      // Let the dots reveal first; the busy overlay fades in ~halfway through.
      busyReveal.value = 0;
      busyReveal.value = withDelay(750, withTiming(1, { duration: 800, easing: EASE_IN_OUT }));
    } else if (currentPage.id === DOT_RINGS_PAGE) {
      dotProgress.value = withTiming(1, { duration: DOT_MORPH_MS, easing: EASE_IN_OUT });
    }
  }, [currentPage.id]);

  // "busy" overlay sits over the dot field on "now." (chaos) and fades out as
  // we move to "what if…", revealing the ordered rings beneath. `busyReveal`
  // gives it a gentle fade-in on arrival instead of popping in.
  const busyStyle = useAnimatedStyle(() => ({
    opacity:
      busyReveal.value *
      interpolate(dotProgress.value, [0, 0.55], [0.85, 0], Extrapolation.CLAMP),
  }));

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

      {/* Persistent dot field shared by the "now." ↔ "what if…" screens. Sits
          in the lower band above the page bg; the text lives above it and the
          buttons below, so nothing overlaps. */}
      {isDotScreen && (
        <Animated.View
          exiting={FadeOut.duration(300)}
          pointerEvents="none"
          style={[
            styles.dotLayer,
            {
              left: (width - dotFieldSize) / 2,
              top: height * 0.67 - dotFieldSize / 2,
              width: dotFieldSize,
              height: dotFieldSize,
            },
          ]}
        >
          <RadialDots
            progress={dotProgress}
            size={dotFieldSize}
            orbiting={currentPage.id === DOT_RINGS_PAGE}
          />
          <Animated.Image
            source={busyImage}
            resizeMode="contain"
            style={[
              {
                position: 'absolute',
                width: 400,
                height: 400,
                left: (dotFieldSize - 400) / 2,
                top: (dotFieldSize - 400) / 2,
              },
              busyStyle,
            ]}
          />
        </Animated.View>
      )}

      {/* Bottom Continue button */}
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

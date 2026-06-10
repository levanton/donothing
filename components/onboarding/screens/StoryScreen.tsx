import { useEffect, useState, type ComponentType } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { EASE_IN_OUT } from '@/constants/animations';
import { track } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';
import PillButton from '@/components/PillButton';
import RadialDots from '../RadialDots';
import { DOT_MORPH_MS, getDotFieldLayout } from '../dotFieldLayout';
import {
  fadeEnter,
  fadeExit,
  rideWithDotsEnter,
  rideWithDotsExit,
} from '../transitions';
import NostalgiaScreen from './NostalgiaScreen';
import RushingScreen, {
  NOW_DOTS_DELAY_MS,
  NOW_DOTS_ENTER_MS,
} from './RushingScreen';
import PhoneSymptomScreen from './PhoneSymptomScreen';

/**
 * StoryScreen — ONE onboarding page on which the whole opening tale plays
 * out, act by act: 'remember?' → 'now.' → 'what if…'.
 *
 * The acts are the existing narrative screens, unchanged — words melting in,
 * the child illustration rising from below the text, the to-do lines
 * dropping in, the dot field. What used to be three pages glued together by
 * a persistent layer in the route is now just internal state here: tapping
 * the arrow advances the act, and every hand-off is the same upward stream
 * as before — the old act rides up and dissolves out the top while the new
 * one emerges from below. The dot field appears with 'now.' and glides to
 * the upper band on 'what if…' while morphing scatter → rings; the continue
 * pill waits for that ride to finish.
 */

interface ScreenProps {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

interface ActEntry {
  /** Legacy screen id — kept so the analytics funnel stays comparable. */
  id: string;
  Act: ComponentType<ScreenProps>;
  enter: unknown;
  exit: unknown;
}

const ACTS: ActEntry[] = [
  // 'remember?' fades in softly; each later hand-off is one upward stream.
  { id: 'nostalgia',    Act: NostalgiaScreen,    enter: fadeEnter,         exit: rideWithDotsExit },
  { id: 'rushing',      Act: RushingScreen,      enter: rideWithDotsEnter, exit: rideWithDotsExit },
  { id: 'phoneSymptom', Act: PhoneSymptomScreen, enter: rideWithDotsEnter, exit: fadeExit },
];

const LAST_ACT = ACTS.length - 1;

// The dot field arrives on 'now.' the same way the picture arrives on
// 'remember?': it rises from below while its dots trickle in, pushing the
// act's text up (the push lives in RushingScreen, timed off the same
// constants).
const DOT_RISE_PX = 96;

const dotFieldEnter: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: {
      transform: [{ translateY: DOT_RISE_PX }],
    },
    animations: {
      transform: [
        { translateY: withTiming(0, { duration: NOW_DOTS_ENTER_MS, easing: EASE_IN_OUT }) },
      ],
    },
  };
};

export default function StoryScreen({ isActive, onNext, theme }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [act, setAct] = useState(0);

  // 'now.': hold the dot field back until the act's text has landed, then
  // bring it in from below. If the user skips ahead to 'what if…' before
  // that moment, the field comes in right away — it's the centrepiece there.
  const [dotsOn, setDotsOn] = useState(false);
  useEffect(() => {
    if (act === 0) {
      setDotsOn(false);
      return;
    }
    if (dotsOn) return;
    if (act === LAST_ACT) {
      setDotsOn(true);
      return;
    }
    const t = setTimeout(() => setDotsOn(true), NOW_DOTS_DELAY_MS);
    return () => clearTimeout(t);
  }, [act, dotsOn]);

  // ── Dot field ───────────────────────────────────────────────────────────
  // One RadialDots instance lives across the 'now.' ↔ 'what if…' acts. It is
  // a sibling of the swapping act view, so it survives the hand-off and
  // morphs instead of remounting. It travels between the bands as the morph
  // progresses: progress 0 keeps it in the lower band ('now.'), progress 1
  // lifts it to the upper band ('what if…') — one timing drives both.
  const dotField = getDotFieldLayout(width, height);
  const dotTravel = dotField.highTop - dotField.lowTop;
  const dotProgress = useSharedValue(0);
  const dotLayerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dotProgress.value * dotTravel }],
  }));

  useEffect(() => {
    dotProgress.value = withTiming(act === LAST_ACT ? 1 : 0, {
      duration: DOT_MORPH_MS,
      easing: EASE_IN_OUT,
    });
  }, [act]);

  // The flow logs this page once as 'story'; the inner acts keep reporting
  // under their old screen ids so the funnel stays comparable.
  useEffect(() => {
    if (act > 0) {
      track('onboarding_screen_viewed', { screen: ACTS[act].id, act: act + 1 });
    }
  }, [act]);

  const goAct = (next: number) => {
    haptics.light();
    setAct(next);
  };

  const { Act, enter, exit } = ACTS[act];

  return (
    <View style={styles.container}>
      <Animated.View
        key={act}
        entering={enter as never}
        exiting={exit as never}
        style={styles.page}
      >
        <Act isActive={isActive} onNext={onNext} theme={theme} />
      </Animated.View>

      {/* The dot field arrives after the 'now.' text — rising from below
          while its dots trickle in (the inner view owns the rise; the outer
          one owns the band-to-band travel) — then glides to the upper band
          while morphing scatter → rings on 'what if…'. */}
      {act > 0 && dotsOn && (
        <Animated.View
          exiting={FadeOut.duration(300)}
          pointerEvents="none"
          style={[
            styles.dotLayer,
            {
              left: dotField.left,
              top: dotField.lowTop,
              width: dotField.size,
              height: dotField.size,
            },
            dotLayerStyle,
          ]}
        >
          <Animated.View entering={dotFieldEnter as never}>
            <RadialDots
              progress={dotProgress}
              size={dotField.size}
              orbiting={act === LAST_ACT}
            />
          </Animated.View>
        </Animated.View>
      )}

      {/* Circle arrow drives the acts; on the last act it's the continue
          pill instead, and it waits for the ride-up hand-off to finish. */}
      {act < LAST_ACT && (
        <Pressable
          onPress={() => goAct(act + 1)}
          style={[
            styles.circleNext,
            { bottom: insets.bottom + 24, borderColor: theme.text },
          ]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Feather name="arrow-right" size={22} color={theme.text} />
        </Pressable>
      )}

      {act === LAST_ACT && (
        <Animated.View
          entering={FadeIn.duration(400).delay(DOT_MORPH_MS)}
          style={[styles.bottomButton, { paddingBottom: insets.bottom + 24 }]}
        >
          <PillButton
            label="continue"
            onPress={onNext}
            color={theme.text}
            variant="outline"
          />
        </Animated.View>
      )}

      {/* Back between acts — the first act has nowhere to go back to. */}
      {act > 0 && (
        <Pressable
          onPress={() => goAct(act - 1)}
          style={[styles.backButton, { top: insets.top + 10 }]}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={22} color={theme.text} />
        </Pressable>
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
  backButton: {
    position: 'absolute',
    left: 16,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

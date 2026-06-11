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
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { EASE_IN_OUT } from '@/constants/animations';
import { track } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';
import PillButton from '@/components/PillButton';
import RadialDots from '../RadialDots';
import { DOT_MORPH_MS, getDotFieldLayout } from '../dotFieldLayout';
import { fadeEnter, fadeExit } from '../transitions';
import NostalgiaScreen, { NOSTALGIA_DONE_MS } from './NostalgiaScreen';
import RushingScreen, {
  NOW_DONE_MS,
  NOW_DOTS_DELAY_MS,
} from './RushingScreen';
import PhoneSymptomScreen, {
  WHATIF_DONE_MS,
  WHATIF_RINGS_AT_MS,
} from './PhoneSymptomScreen';

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
  // Acts hand off by pure crossfade — the outgoing text (and the picture)
  // simply dissolve in place, nothing travels.
  { id: 'nostalgia',    Act: NostalgiaScreen,    enter: fadeEnter, exit: fadeExit },
  { id: 'rushing',      Act: RushingScreen,      enter: fadeEnter, exit: fadeExit },
  { id: 'phoneSymptom', Act: PhoneSymptomScreen, enter: fadeEnter, exit: fadeExit },
];

const LAST_ACT = ACTS.length - 1;


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
  // One RadialDots instance lives across the 'now.' ↔ 'what if…' acts,
  // always below the text in the lower band — it never travels. It is a
  // sibling of the swapping act view, so it survives the hand-off. On
  // 'what if…' the scatter resolves into rings as the payoff line is about
  // to type; going back dissolves them again.
  const dotField = getDotFieldLayout(width, height);
  const dotProgress = useSharedValue(0);
  const [ringsOn, setRingsOn] = useState(false);

  useEffect(() => {
    if (act !== LAST_ACT) {
      setRingsOn(false);
      dotProgress.value = withTiming(0, { duration: 600, easing: EASE_IN_OUT });
      return;
    }
    const t = setTimeout(() => {
      setRingsOn(true);
      dotProgress.value = withTiming(1, {
        duration: DOT_MORPH_MS,
        easing: EASE_IN_OUT,
      });
    }, WHATIF_RINGS_AT_MS);
    return () => clearTimeout(t);
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

  // The arrow waits for the act's performance to finish — no exit door
  // while the story is still telling itself. (Re-arms when the user goes
  // back, since acts replay from scratch.)
  const [arrowReady, setArrowReady] = useState(false);
  useEffect(() => {
    if (act >= LAST_ACT) {
      setArrowReady(true);
      return;
    }
    setArrowReady(false);
    const t = setTimeout(
      () => setArrowReady(true),
      act === 0 ? NOSTALGIA_DONE_MS : NOW_DONE_MS,
    );
    return () => clearTimeout(t);
  }, [act]);

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

      {/* The dot field arrives after the 'now.' text — in place, purely by
          opacity (its dots trickle in one by one) — and stays in the media
          zone, under the text, for the rest of the story. */}
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
          ]}
        >
          <RadialDots
            progress={dotProgress}
            size={dotField.size}
            orbiting={ringsOn}
          />
        </Animated.View>
      )}

      {/* Circle arrow drives the acts; on the last act it's the continue
          pill instead, and it waits for the ride-up hand-off to finish. */}
      {act < LAST_ACT && arrowReady && (
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.circleNextWrap, { bottom: insets.bottom + 24 }]}
        >
          <Pressable
            onPress={() => goAct(act + 1)}
            style={[styles.circleNext, { borderColor: theme.text }]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            <Feather name="arrow-right" size={22} color={theme.text} />
          </Pressable>
        </Animated.View>
      )}

      {act === LAST_ACT && (
        <Animated.View
          entering={FadeIn.duration(400).delay(WHATIF_DONE_MS)}
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
  circleNextWrap: {
    position: 'absolute',
    right: 32,
  },
  circleNext: {
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

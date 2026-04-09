import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';
import { palette } from '@/lib/theme';
import { updateSessionMood } from '@/lib/db/sessions';

const MOODS = ['calm', 'restless', 'refreshed', 'grateful', 'lighter'] as const;
const AFFIRMS = ['beautiful.', 'noted.', 'thank you.'];

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

interface Props {
  visible: boolean;
  sessionId: string;
  theme: AppTheme;
  onDone: () => void;
}

function PostSessionReflection({ visible, sessionId, theme, onDone }: Props) {
  const [phase, setPhase] = useState<'ask' | 'affirm'>('ask');
  const [affirm, setAffirm] = useState(AFFIRMS[0]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const containerOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.6);
  const ringOpacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setPhase('ask');
      setSelectedMood(null);

      // Fade in container
      containerOpacity.value = withTiming(1, { duration: 500 });

      // Breathing ring appears
      ringOpacity.value = withTiming(0.15, { duration: 800 });
      ringScale.value = withTiming(1, { duration: 800, easing: EASE_OUT });

      // Start breathing loop after entrance
      setTimeout(() => {
        ringScale.value = withRepeat(
          withSequence(
            withTiming(1.06, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.94, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          ),
          -1,
          false,
        );
      }, 900);
    } else {
      containerOpacity.value = 0;
      ringOpacity.value = 0;
      ringScale.value = 0.6;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const animatedContainer = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
    pointerEvents: containerOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  const animatedRing = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const dismiss = useCallback(() => {
    ringOpacity.value = withTiming(0, { duration: 300 });
    containerOpacity.value = withTiming(0, { duration: 400 });
    setTimeout(onDone, 430);
  }, [onDone]);

  const handleMood = useCallback(
    (mood: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedMood(mood);
      if (sessionId) updateSessionMood(sessionId, mood);

      // Ring pulses on selection
      ringScale.value = withSequence(
        withTiming(1.15, { duration: 200 }),
        withTiming(1, { duration: 400 }),
      );
      ringOpacity.value = withTiming(0.25, { duration: 200 });

      setAffirm(AFFIRMS[Math.floor(Math.random() * AFFIRMS.length)]);
      setPhase('affirm');
      timerRef.current = setTimeout(dismiss, 1600);
    },
    [sessionId, dismiss],
  );

  const handleSkip = useCallback(() => {
    Haptics.selectionAsync();
    dismiss();
  }, [dismiss]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.overlay, { backgroundColor: theme.bg }, animatedContainer]}
    >
      {/* Breathing ring */}
      <Animated.View
        style={[
          styles.ring,
          { borderColor: theme.accent },
          animatedRing,
        ]}
      />

      <Pressable style={styles.touchArea} onPress={handleSkip}>
        {phase === 'ask' && (
          <View style={styles.content}>
            <Animated.Text
              entering={FadeIn.delay(200).duration(600)}
              style={[styles.question, { color: theme.text, fontFamily: Fonts.serif }]}
            >
              how do you feel?
            </Animated.Text>

            <View style={styles.chips}>
              {MOODS.map((mood, idx) => {
                const isSelected = selectedMood === mood;
                return (
                  <Animated.View
                    key={mood}
                    entering={FadeInDown.delay(500 + idx * 100)
                      .duration(400)
                      .easing(EASE_OUT)}
                  >
                    <Pressable
                      onPress={() => handleMood(mood)}
                      style={[
                        styles.chip,
                        isSelected
                          ? { backgroundColor: palette.terracotta }
                          : { backgroundColor: theme.subtle },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected ? palette.cream : theme.text,
                            fontFamily: Fonts.serif,
                          },
                        ]}
                      >
                        {mood}
                      </Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        )}

        {phase === 'affirm' && (
          <Animated.Text
            entering={FadeIn.duration(500)}
            style={[styles.affirmText, { color: theme.accent, fontFamily: Fonts.serif }]}
          >
            {affirm}
          </Animated.Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

export default memo(PostSessionReflection);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  ring: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    alignSelf: 'center',
    top: '50%',
    marginTop: -110,
  },
  touchArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  question: {
    fontSize: 24,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.5,
    marginBottom: 36,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  chipText: {
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  affirmText: {
    fontSize: 32,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
});

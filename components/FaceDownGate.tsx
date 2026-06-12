import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import { useFaceDown } from '@/hooks/useFaceDown';
import { haptics } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import { palette } from '@/lib/theme';

// The session start ritual, shown over the terracotta layer while the
// session is armed: "put me face down." The accelerometer starts the
// clock the moment the phone settles face down. Two guarantees:
//   - it can NEVER strand the user: if the sensor is unavailable (or just
//     hasn't triggered) a manual "start anyway" appears after a few
//     seconds;
//   - it never false-starts: the detector requires a sustained face-down
//     reading (see useFaceDown's hold window).
const FALLBACK_AFTER_MS = 7000;

export default function FaceDownGate() {
  const beginCountdown = useAppStore((s) => s.beginCountdown);
  const stopSession = useAppStore((s) => s.stopSession);
  const { faceDown, available } = useFaceDown(true);

  // The clock starts the instant the phone settles face down. The strong
  // haptic confirmation lives in beginCountdown — felt through the table.
  const begunRef = useRef(false);
  useEffect(() => {
    if (!faceDown || begunRef.current) return;
    begunRef.current = true;
    beginCountdown();
  }, [faceDown, beginCountdown]);

  // Escape hatch — sensors missing, thick case, whatever: never strand.
  const [fallbackVisible, setFallbackVisible] = useState(false);
  useEffect(() => {
    if (!available) {
      setFallbackVisible(true);
      return;
    }
    const t = setTimeout(() => setFallbackVisible(true), FALLBACK_AFTER_MS);
    return () => clearTimeout(t);
  }, [available]);

  // The big timer (rendered by the home screen) sits at the absolute
  // centre — the gate's texts frame it: instruction above, hint below.
  return (
    <Animated.View
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(400)}
      style={styles.container}
    >
      <View style={styles.above} pointerEvents="none">
        <Text style={[styles.title, { fontFamily: Fonts!.serif }]}>
          place your phone face down
        </Text>
      </View>

      <View style={styles.below}>
        <Text style={[styles.hint, { fontFamily: Fonts!.serif }]}>
          you’ll hear a chime when it’s done — even on silent.
        </Text>

        {fallbackVisible && (
          <Animated.View entering={FadeIn.duration(500)}>
            <Pressable
              onPress={() => {
                haptics.light();
                beginCountdown();
              }}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Start without flipping"
              style={styles.fallbackBtn}
            >
              <Text style={[styles.fallbackText, { fontFamily: Fonts!.serif }]}>
                can’t flip it? tap to start
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>

      <Pressable
        onPress={() => {
          haptics.light();
          void stopSession();
        }}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        style={styles.cancelBtn}
      >
        <Text style={[styles.cancelText, { fontFamily: Fonts!.serif }]}>back</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  above: {
    // Just above the centred timer digits.
    position: 'absolute',
    left: 40,
    right: 40,
    bottom: '62%',
    alignItems: 'center',
  },
  below: {
    // Just below the centred timer digits.
    position: 'absolute',
    left: 40,
    right: 40,
    top: '60%',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 30,
    color: palette.cream,
    textAlign: 'center',
  },
  hint: {
    fontSize: 16,
    lineHeight: 23,
    color: palette.cream,
    textAlign: 'center',
    maxWidth: 280,
  },
  fallbackBtn: {
    marginTop: 18,
    borderWidth: 1.5,
    borderColor: palette.cream,
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  fallbackText: {
    fontSize: 15,
    color: palette.cream,
  },
  cancelBtn: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelText: {
    fontSize: 16,
    color: palette.cream,
  },
});

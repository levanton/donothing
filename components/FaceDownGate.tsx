import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GhostButton from '@/components/GhostButton';
import { Fonts } from '@/constants/theme';
import { useFaceDown } from '@/hooks/useFaceDown';
import { haptics } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import { palette } from '@/lib/theme';

// The session start ritual, active over the terracotta layer while the
// session is armed: "put me face down." The accelerometer starts the
// clock the moment the phone settles face down; the detector requires a
// sustained face-down reading (see useFaceDown's hold window) so it
// never false-starts. The instruction + illustration render inside
// RunOverlay's centred column (above the timer) so the whole gate reads
// as one vertically centred group — this component owns the sensor
// logic and the bottom controls. Two guarantees:
//   - it can NEVER strand the user: if the sensor is unavailable a
//     manual "tap to start" appears — but ONLY then, never on a timer,
//     so a healthy sensor never offers a way to skip the ritual;
//   - it never false-starts (the sustained-reading hold window).
export default function FaceDownGate() {
  const insets = useSafeAreaInsets();
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

  return (
    <Animated.View
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(400)}
      style={styles.container}
      pointerEvents="box-none"
    >
      <View
        style={[styles.bottomStack, { bottom: insets.bottom + 30 }]}
        pointerEvents="box-none"
      >
        {/* Dead-sensor escape hatch — the only path into a session when
            the accelerometer can't report face-down. Never shown while
            the sensor is healthy. */}
        {!available && (
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

        <GhostButton
          label="back"
          onPress={() => {
            haptics.light();
            void stopSession();
          }}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  // Bottom controls column — anchored at the same optical height as the
  // running state's pause pill (insetsBottom + 30, applied inline) so
  // the bottom control doesn't jump when the gate clears into the
  // session. The fallback, when present, stacks above the back pill.
  bottomStack: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 14,
  },
  fallbackBtn: {
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
});

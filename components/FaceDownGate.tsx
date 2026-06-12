import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PillButton from '@/components/PillButton';
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
// logic and the back pill.
// NOTE: the dead-sensor manual-start fallback was removed for now; if
// the accelerometer is unavailable the only way out is "back".
export default function FaceDownGate() {
  const insets = useSafeAreaInsets();
  const beginCountdown = useAppStore((s) => s.beginCountdown);
  const stopSession = useAppStore((s) => s.stopSession);
  const { faceDown } = useFaceDown(true);

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
      <PillButton
        label="back"
        onPress={() => {
          haptics.light();
          void stopSession();
        }}
        outline
        size="large"
        color="rgba(249, 242, 224, 0.4)"
        style={[styles.cancelBtn, { bottom: insets.bottom + 30 }]}
        labelStyle={[styles.cancelText, { fontFamily: Fonts!.serif }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  cancelBtn: {
    // Same optical height as the running state's pause pill
    // (insetsBottom + 30, applied inline) so the bottom control doesn't
    // jump when the gate clears into the session.
    position: 'absolute',
    alignSelf: 'center',
  },
  cancelText: {
    color: palette.cream,
  },
});

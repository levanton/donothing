import { useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import PillButton from '@/components/PillButton';
import { Fonts } from '@/constants/theme';
import { useFaceDown } from '@/hooks/useFaceDown';
import { haptics } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import { palette } from '@/lib/theme';

const phoneDownImage = require('@/assets/images/phone-down.png');

// The session start ritual, shown over the terracotta layer while the
// session is armed: "put me face down." The accelerometer starts the
// clock the moment the phone settles face down. Two guarantees:
//   - it can NEVER strand the user: if the sensor is unavailable a manual
//     "start anyway" appears — but ONLY then, never on a timer, so a healthy
//     sensor never offers a way to skip the ritual;
//   - it never false-starts: the detector requires a sustained face-down
//     reading (see useFaceDown's hold window).
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

  // The big timer (rendered by the home screen) sits at the absolute
  // centre — the instruction sits above it; the dead-sensor fallback below.
  return (
    <Animated.View
      entering={FadeIn.duration(600)}
      exiting={FadeOut.duration(400)}
      style={styles.container}
    >
      <View style={styles.above} pointerEvents="none">
        <Text style={[styles.title, { fontFamily: Fonts!.mono }]}>
          place your phone{'\n'}face down
        </Text>
        <Image source={phoneDownImage} style={styles.illustration} fadeDuration={0} />
      </View>

      <View style={styles.below}>
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
      </View>

      <PillButton
        label="back"
        onPress={() => {
          haptics.light();
          void stopSession();
        }}
        outline
        size="large"
        color="rgba(249, 242, 224, 0.4)"
        style={styles.cancelBtn}
        labelStyle={[styles.cancelText, { fontFamily: Fonts!.serif }]}
      />
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
  },
  title: {
    fontSize: 20,
    fontWeight: '300',
    color: palette.cream,
    textAlign: 'center',
  },
  illustration: {
    // The source PNG is 3:2; keep the footprint modest so the instruction
    // block still clears the centred timer digits below it.
    width: 240,
    height: 160,
    marginTop: 16,
    resizeMode: 'contain',
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
  cancelBtn: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
  },
  cancelText: {
    color: palette.cream,
  },
});

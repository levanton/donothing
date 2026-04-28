import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { Ref } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import DonePill from '@/components/session-complete/DonePill';

// Mirror of the main file's GRASS_SIZE — kept in sync so the hidden
// anchor here has the exact same footprint as the sun illustration in
// the main layer (the sun glides into this anchor via measureInWindow).
const SCREEN_H = Dimensions.get('window').height;
const GRASS_SIZE = Math.min(Math.round(SCREEN_H * 0.24), 220);

interface FarewellPhaseProps {
  /** Cream/cream-on-terracotta text colour. */
  textColor: string;
  /** Pre-formatted session duration shown in the chip. */
  duration: { value: string; unit: string };
  /** Bottom safe-area inset — used to lift the continue pill off the
   *  home indicator. */
  bottomInset: number;
  /** Ref the parent attaches to the hidden "anchor" view. The shared sun
   *  in the main layer measures against this ref to compute its glide
   *  delta — without the anchor the sun has nowhere to land. */
  sunAnchorRef: Ref<View>;
  /** Whether this layer should accept touches. */
  pointerEventsActive: boolean;

  // Animated styles — driven by SharedValues that live in the parent
  // (the parent owns the timeline and resets). Typed as plain styles
  // because reanimated's AnimatedStyle<ViewStyle> can't be passed to
  // <Animated.Text> directly without complaining about TextStyle vs
  // ViewStyle, even though it works at runtime.
  layerStyle: StyleProp<ViewStyle>;
  eyebrowStyle: StyleProp<TextStyle>;
  titleStyle: StyleProp<TextStyle>;
  dividerStyle: StyleProp<ViewStyle>;
  subStyle: StyleProp<TextStyle>;
  chipStyle: StyleProp<ViewStyle>;
  continueStyle: StyleProp<ViewStyle>;

  /** "just done" — close without unlocking. */
  onClose: () => void;
  /** Optional "unlock your apps" — close + release apps. When omitted,
   *  the farewell shows a single "done" pill. */
  onUnlock?: () => void;
}

/**
 * The third beat on SessionCompleteScreen — the sun has glided down
 * from the mood phase into a hidden anchor here, the rest of the
 * content (eyebrow / title / divider / sub / duration chip) cascades
 * in around it. Bottom row: either two pills (just-done + unlock-your-
 * apps) when `onUnlock` is wired, or a single "done" pill.
 *
 * All animations are owned by the parent — this component is a pure
 * renderer of the farewell layer. Keeps the parent file slimmer and
 * the layer's layout/typography in one place.
 */
export default function FarewellPhase({
  textColor,
  duration,
  bottomInset,
  sunAnchorRef,
  pointerEventsActive,
  layerStyle,
  eyebrowStyle,
  titleStyle,
  dividerStyle,
  subStyle,
  chipStyle,
  continueStyle,
  onClose,
  onUnlock,
}: FarewellPhaseProps) {
  return (
    <Animated.View
      style={[styles.layer, layerStyle]}
      pointerEvents={pointerEventsActive ? 'auto' : 'none'}
    >
      <View style={styles.center}>
        {/* Hidden anchor — reserves the spot the moving sun glides into. */}
        <View ref={sunAnchorRef} style={styles.sunAnchor} />

        <Animated.Text
          style={[styles.eyebrow, { color: textColor, fontFamily: Fonts.serif }, eyebrowStyle]}
        >
          see you tomorrow
        </Animated.Text>

        <Animated.Text
          style={[styles.title, { color: textColor, fontFamily: Fonts.serif }, titleStyle]}
        >
          well done
        </Animated.Text>

        <Animated.View style={[styles.divider, dividerStyle]} />

        <Animated.Text
          style={[styles.sub, { color: textColor, fontFamily: Fonts.serif }, subStyle]}
        >
          your apps are open again
        </Animated.Text>

        <Animated.View style={[styles.chip, chipStyle]}>
          <Text style={[styles.chipText, { fontFamily: Fonts.serif }]}>
            {duration.value} {duration.unit} • complete
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.continue, { bottom: bottomInset + 40 }, continueStyle]}
      >
        {onUnlock ? (
          <View style={styles.buttonRow}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.secondaryBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text
                style={[
                  styles.secondaryLabel,
                  { color: palette.cream, fontFamily: Fonts.serif },
                ]}
              >
                just done
              </Text>
            </Pressable>
            <Pressable
              onPress={onUnlock}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            >
              <DonePill icon="unlock" label="unlock your apps" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
          >
            <DonePill label="done" />
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  center: {
    alignItems: 'center',
  },
  // Same footprint as the moving main sun (no 1.1x scale) so when the
  // shared sun glides in, it covers the anchor exactly. Margin matches
  // the original farewell layout's sun→eyebrow gap.
  sunAnchor: {
    width: GRASS_SIZE,
    height: GRASS_SIZE * (450 / 780),
    marginBottom: 22,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2.4,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  title: {
    fontSize: 56,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
    lineHeight: 60,
    marginBottom: 20,
  },
  divider: {
    width: 44,
    height: 1.5,
    backgroundColor: palette.cream,
    marginBottom: 20,
    borderRadius: 1,
  },
  sub: {
    fontSize: 18,
    fontWeight: '400',
    letterSpacing: 0.3,
    textAlign: 'center',
    marginBottom: 28,
  },
  chip: {
    backgroundColor: palette.cream,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 100,
    overflow: 'hidden',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.brown,
    letterSpacing: 0.4,
  },
  continue: {
    position: 'absolute',
    alignSelf: 'center',
  },
  buttonRow: {
    alignItems: 'center',
    gap: 14,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.4,
    opacity: 0.85,
  },
});

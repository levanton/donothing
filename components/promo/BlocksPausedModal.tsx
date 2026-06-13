import { memo, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';

import PromoOffer from '@/components/promo/PromoOffer';
import { EASE_OUT } from '@/constants/animations';
import { Fonts } from '@/constants/theme';
import { usePromo } from '@/hooks/usePromo';
import { track } from '@/lib/analytics';
import { haptics } from '@/lib/haptics';
import { palette } from '@/lib/theme';

// The hourglass — "paused" embodied; the gift stays reserved for the
// win-back beat behind this card. Trimmed copy: the original sits in a
// square canvas with huge transparent margins that `contain` would
// otherwise reserve as empty space.
const HERO_IMAGE = require('@/assets/images/pause-trimmed.png');

interface Props {
  visible: boolean;
  /** Dismiss the whole flow (pitch + win-back). */
  onClose: () => void;
}

/**
 * "Your blocks are paused" promo — shown once per lapse episode when an
 * expired subscriber with enabled blocks opens the app. Two beats:
 * the pitch (gift-tone reminder that the blocks are saved, CTA to the
 * paywall), and — if they dismiss the pitch — the win-back discount
 * (the same PromoOffer the paywall uses).
 */
function BlocksPausedModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'pitch' | 'winback'>('pitch');
  const { promo, purchasing, purchase } = usePromo('blocksPaused', onClose);

  useEffect(() => {
    if (visible) {
      setStep('pitch');
      track('blocks_paused_promo_viewed');
    }
  }, [visible]);

  const pitchVisible = visible && step === 'pitch';

  const backdropOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(40);
  useEffect(() => {
    if (pitchVisible) {
      backdropOpacity.value = withTiming(1, { duration: 240, easing: EASE_OUT });
      cardOpacity.value = withTiming(1, { duration: 320, easing: EASE_OUT });
      cardY.value = withTiming(0, { duration: 480, easing: EASE_OUT });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200, easing: EASE_OUT });
      cardOpacity.value = withTiming(0, { duration: 200, easing: EASE_OUT });
      cardY.value = withTiming(40, { duration: 240, easing: EASE_OUT });
    }
  }, [pitchVisible, backdropOpacity, cardOpacity, cardY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));

  const handleRenew = () => {
    haptics.medium();
    track('blocks_paused_promo_renew_tapped');
    onClose();
    router.push('/paywall');
  };

  // Declining the pitch earns the discount beat — but only if a win-back
  // promo actually resolved for this user; otherwise just leave quietly.
  const handleDismissPitch = () => {
    haptics.select();
    track('blocks_paused_promo_dismissed');
    if (promo) {
      setStep('winback');
    } else {
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <>
      <Animated.View
        style={[styles.root, backdropStyle]}
        pointerEvents={pitchVisible ? 'auto' : 'none'}
      >
        <View style={styles.backdrop}>
          <BlurView
            intensity={18}
            tint="dark"
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.tint} pointerEvents="none" />
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={handleDismissPitch}
          />
          <Animated.View
            style={[
              styles.card,
              {
                marginTop: insets.top + 16,
                marginBottom: insets.bottom + 16,
              },
              cardStyle,
            ]}
          >
            <Image
              source={HERO_IMAGE}
              style={styles.hero}
              resizeMode="contain"
              fadeDuration={0}
            />

            <Pressable
              onPress={handleDismissPitch}
              hitSlop={16}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={22} color={palette.cream} />
            </Pressable>

            <View style={styles.content}>
              <Text style={[styles.headline, { fontFamily: Fonts!.serif }]}>
                your blocks{'\n'}
                <Text style={styles.headlineBold}>are paused</Text>
              </Text>

              <View style={styles.bullets}>
                <View style={styles.bulletRow}>
                  <Feather name="check" size={16} color={palette.cream} />
                  <Text style={[styles.bulletText, { fontFamily: Fonts!.serif }]}>
                    saved, not gone
                  </Text>
                </View>
                <View style={styles.bulletRow}>
                  <Feather name="check" size={16} color={palette.cream} />
                  <Text style={[styles.bulletText, { fontFamily: Fonts!.serif }]}>
                    back the moment you renew
                  </Text>
                </View>
              </View>

              <Pressable onPress={handleRenew} style={styles.cta}>
                <Text style={[styles.ctaText, { fontFamily: Fonts!.serif }]}>
                  renew membership
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Win-back beat — the registry-resolved discount offer, reused. */}
      <PromoOffer
        visible={visible && step === 'winback'}
        onClose={onClose}
        onPurchase={purchasing ? undefined : purchase}
        priceString={promo?.priceString}
        introPriceString={promo?.introPriceString}
        discountPct={promo?.discountPct}
        copy={promo?.copy}
      />
    </>
  );
}

export default memo(BlocksPausedModal);

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },
  backdrop: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 20, 20, 0.15)',
  },
  card: {
    backgroundColor: palette.terracotta,
    borderRadius: 28,
    paddingBottom: 22,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 22,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  // Mirrors PromoOffer's card anatomy — flush-top hero, left-aligned
  // serif headline with a bold kicker, check bullets, cream CTA — so
  // the pitch and the win-back read as two beats of one promo voice.
  hero: {
    // Trimmed artwork is ~2.15:1 — size the box to the same ratio so
    // the hourglass fills it edge to edge with no phantom padding.
    width: 248,
    height: 115,
    alignSelf: 'center',
    marginTop: 49,
    marginBottom: 25,
  },
  headline: {
    color: palette.cream,
    fontSize: 24,
    fontWeight: '400',
    lineHeight: 30,
    letterSpacing: 0.2,
  },
  headlineBold: {
    fontWeight: '700',
  },
  bullets: {
    marginTop: 16,
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletText: {
    color: palette.cream,
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
    // Long lines wrap instead of clipping at the card edge.
    flexShrink: 1,
  },
  cta: {
    marginTop: 20,
    backgroundColor: palette.cream,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: palette.brown,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});

import { memo, useEffect } from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Asset } from 'expo-asset';

import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const HERO_IMAGE = require('@/assets/images/present.png');
// Kick off decode at module load so the bitmap is ready the first time
// the modal opens — otherwise iOS shows a brief blank frame.
Asset.fromModule(HERO_IMAGE).downloadAsync().catch(() => {});

interface Props {
  visible: boolean;
  onClose: () => void;
  onPurchase?: () => void;
}

function PromoOffer({ visible, onClose, onPurchase }: Props) {
  const insets = useSafeAreaInsets();

  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(40);
  const cardScale = useSharedValue(0.96);

  useEffect(() => {
    if (visible) {
      cardOpacity.value = withTiming(1, { duration: 320, easing: EASE_OUT });
      cardY.value = withTiming(0, { duration: 480, easing: EASE_OUT });
      cardScale.value = withTiming(1, { duration: 480, easing: EASE_OUT });
    } else {
      cardOpacity.value = 0;
      cardY.value = 40;
      cardScale.value = 0.96;
    }
  }, [visible]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }, { scale: cardScale.value }],
  }));

  const handleClose = () => {
    Haptics.selectionAsync();
    onClose();
  };

  const handlePurchase = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onPurchase?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent
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
          onPress={handleClose}
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
          {/* Hero illustration — flush to the very top of the card */}
          <Image
            source={HERO_IMAGE}
            style={styles.hero}
            resizeMode="contain"
            fadeDuration={0}
          />

          {/* Close X — floats over the image */}
          <Pressable
            onPress={handleClose}
            hitSlop={16}
            style={styles.closeBtn}
          >
            <Feather name="x" size={22} color={palette.cream} />
          </Pressable>

          <View style={styles.content}>
            {/* Headline */}
            <Text style={[styles.headline, { fontFamily: Fonts!.serif }]}>
              What if your first year{'\n'}was{' '}
              <Text style={styles.headlineBold}>HALF OFF</Text>?
            </Text>

            {/* Bullet list */}
            <View style={styles.bullets}>
              <View style={styles.bulletRow}>
                <Feather name="check" size={16} color={palette.cream} />
                <Text style={[styles.bulletText, { fontFamily: Fonts!.serif }]}>
                  cancel any time
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Feather name="check" size={16} color={palette.cream} />
                <Text style={[styles.bulletText, { fontFamily: Fonts!.serif }]}>
                  unlimited access
                </Text>
              </View>
            </View>

            {/* Price card */}
            <View style={styles.priceCard}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.priceTitle, { fontFamily: Fonts!.serif }]}>
                  First year
                </Text>
                <Text
                  style={[styles.priceSubtitle, { fontFamily: Fonts!.serif }]}
                >
                  Then 49,99 USD/year
                </Text>
              </View>
              <View style={styles.priceRight}>
                <Text style={[styles.priceOld, { fontFamily: Fonts!.mono }]}>
                  49,99
                </Text>
                <Text style={[styles.priceValue, { fontFamily: Fonts!.mono }]}>
                  22,99 USD
                </Text>
              </View>
            </View>

            {/* CTA */}
            <Pressable onPress={handlePurchase} style={styles.cta}>
              <Text style={[styles.ctaText, { fontFamily: Fonts!.serif }]}>
                Try{' '}
                <Text style={styles.ctaTextBold}>nothing</Text> now
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

export default memo(PromoOffer);

const styles = StyleSheet.create({
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
  hero: {
    width: 240,
    height: 220,
    alignSelf: 'center',
    marginTop: 0,
    marginBottom: 12,
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
  },
  priceCard: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(249, 242, 224, 0.55)',
    backgroundColor: 'rgba(249, 242, 224, 0.06)',
  },
  priceTitle: {
    color: palette.cream,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  priceSubtitle: {
    color: palette.cream,
    fontSize: 14,
    fontWeight: '300',
    opacity: 0.85,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  priceRight: {
    alignItems: 'flex-end',
  },
  priceOld: {
    color: palette.cream,
    fontSize: 15,
    fontWeight: '400',
    opacity: 0.7,
    letterSpacing: 0.3,
    textDecorationLine: 'line-through',
    marginBottom: 3,
  },
  priceValue: {
    color: palette.cream,
    fontSize: 19,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  cta: {
    marginTop: 14,
    backgroundColor: palette.cream,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: palette.brown,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  ctaTextBold: {
    fontWeight: '700',
    color: palette.terracotta,
  },
});

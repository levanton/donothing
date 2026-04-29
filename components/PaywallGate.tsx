import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { haptics } from '@/lib/haptics';

import { Fonts } from '@/constants/theme';
import { themes, type ThemeMode } from '@/lib/theme';
import PillButton from '@/components/PillButton';

interface Props {
  /** When true, the gate takes over the screen — content is blocked. */
  visible: boolean;
  themeMode: ThemeMode;
  insets: { top: number; bottom: number };
  onClose?: () => void;
  onOpenAccount?: () => void;
  /** Short line that hints at the feature being gated. */
  title?: string;
  body?: string;
}


function PaywallGate({
  visible,
  themeMode,
  insets,
  onClose,
  onOpenAccount,
  title = 'unlock Nothing',
  body = 'Join to open Journey, schedule screen blocks and everything that keeps you away from the screen.',
}: Props) {
  const theme = themes[themeMode];
  const router = useRouter();
  const isDark = themeMode === 'dark';

  const opacity = useSharedValue(0);
  const cardScale = useSharedValue(0.96);
  const cardY = useSharedValue(16);
  const headerOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 360, easing: EASE_OUT });
      headerOpacity.value = withTiming(1, { duration: 500, easing: EASE_OUT });
      cardScale.value = withTiming(1, { duration: 600, easing: EASE_OUT });
      cardY.value = withTiming(0, { duration: 600, easing: EASE_OUT });
    } else {
      opacity.value = withTiming(0, { duration: 220, easing: EASE_OUT });
      headerOpacity.value = 0;
      cardScale.value = 0.96;
      cardY.value = 16;
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    pointerEvents: opacity.value > 0.01 ? 'auto' : 'none',
  }));
  const headerStyle = useAnimatedStyle(() => ({ opacity: headerOpacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: cardY.value }, { scale: cardScale.value }],
  }));

  if (!visible) return null;

  const handleOpen = () => {
    haptics.light();
    router.push('/paywall');
  };

  const handleAccount = () => {
    haptics.select();
    onOpenAccount?.();
  };

  const handleClose = () => {
    haptics.select();
    onClose?.();
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, styles.root, backdropStyle]}
      pointerEvents="auto"
    >
      <BlurView
        intensity={36}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(249, 242, 224, 0.35)' },
        ]}
      />

      {/* Header — Account on left, close on right. Stays reachable even
          without a subscription so the user can still manage the app. */}
      <Animated.View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, paddingHorizontal: 24 },
          headerStyle,
        ]}
      >
        {onOpenAccount ? (
          <PillButton
            label="My account"
            onPress={handleAccount}
            color={theme.text}
            variant="outline"
            size="small"
            style={{
              alignSelf: 'flex-start',
              borderWidth: 1.2,
              paddingVertical: 6,
              paddingHorizontal: 14,
            }}
          />
        ) : <View />}
        {onClose ? (
          <Pressable onPress={handleClose} hitSlop={16} style={styles.closeBtn}>
            <Text style={[styles.closeX, { color: theme.textSecondary }]}>{'\u2715'}</Text>
          </Pressable>
        ) : null}
      </Animated.View>

      {/* Centered content — typography-first, no boxy card */}
      <View style={styles.centerWrap} pointerEvents="box-none">
        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts!.serif }]}>
            {title}
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
            {body}
          </Text>

          <View style={styles.btnWrap}>
            <PillButton
              label="see plans"
              onPress={handleOpen}
              color={theme.accent}
              variant="filled"
              size="large"
              style={{ paddingHorizontal: 44 }}
              labelStyle={{ letterSpacing: 0.5 }}
            />
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export default memo(PaywallGate);

const styles = StyleSheet.create({
  root: {
    zIndex: 140,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeBtn: { padding: 4 },
  closeX: { fontSize: 20, fontWeight: '300' },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 24,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  btnWrap: {
    alignItems: 'center',
  },
});

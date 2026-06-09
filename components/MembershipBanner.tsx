import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';
import { useAppStore } from '@/lib/store';

interface Props {
  title: string;
  subtitle: string;
  onPress: () => void;
}

/**
 * Membership prompt shown on premium screens (Settings blocks, Journey) when
 * the user isn't subscribed. Same chip style as the permission banners, with
 * the paywall illustration in place of an icon. Tapping opens the paywall.
 * The screen keeps its content visible but locked (dimmed + non-interactive).
 */
export default function MembershipBanner({ title, subtitle, onPress }: Props) {
  const themeMode = useAppStore((s) => s.themeMode);
  const isDark = themeMode === 'dark';

  return (
    <Animated.View entering={FadeInDown.duration(450)}>
      <Pressable
        onPress={onPress}
        style={[
          styles.banner,
          { backgroundColor: isDark ? 'rgba(194, 103, 73, 0.92)' : 'rgba(194, 103, 73, 0.45)' },
        ]}
      >
        <Image
          source={require('@/assets/images/paywall-image.png')}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.text}>
          <Text
            style={[
              styles.title,
              { color: isDark ? palette.cream : palette.brown, fontFamily: Fonts!.serif },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.sub,
              { color: isDark ? palette.cream : 'rgba(51, 52, 49, 0.75)', fontFamily: Fonts!.serif },
            ]}
          >
            {subtitle}
          </Text>
        </View>
        <Feather name="unlock" size={20} color={isDark ? palette.cream : palette.brown} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 28,
    gap: 14,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  text: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  sub: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: 0.15,
  },
});

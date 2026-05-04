import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

interface Props {
  visible: boolean;
  label?: string;
}

export default function PurchasingOverlay({ visible, label = 'Processing your subscription...' }: Props) {
  if (!visible) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(160)}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="auto"
    >
      <BlurView
        intensity={28}
        tint="light"
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: 'rgba(249, 242, 224, 0.45)' },
        ]}
      />
      <View style={styles.content}>
        <ActivityIndicator size="large" color={palette.terracotta} />
        <Text style={styles.label}>{label}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingHorizontal: 32,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.mono,
    color: palette.brown,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});

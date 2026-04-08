import { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getTodayIndex(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function FirstMinuteDoneScreen({ isActive, onNext }: Props) {
  const insets = useSafeAreaInsets();
  const todayIdx = getTodayIndex();

  const imageOpacity = useSharedValue(0);
  const imageTranslateY = useSharedValue(16);
  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.88);
  const bodyOpacity = useSharedValue(0);
  const bodyTranslateY = useSharedValue(10);
  const weekOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);

  useEffect(() => {
    if (!isActive) return;
    // Image first
    imageOpacity.value = withDelay(200, withTiming(1, { duration: 800, easing: EASE_OUT }));
    imageTranslateY.value = withDelay(200, withTiming(0, { duration: 800, easing: EASE_OUT }));
    // Then title
    titleOpacity.value = withDelay(700, withTiming(1, { duration: 800, easing: EASE_OUT }));
    titleScale.value = withDelay(700, withTiming(1, { duration: 800, easing: EASE_OUT }));
    // Then body
    bodyOpacity.value = withDelay(1300, withTiming(1, { duration: 700, easing: EASE_OUT }));
    bodyTranslateY.value = withDelay(1300, withTiming(0, { duration: 700, easing: EASE_OUT }));
    // Then week
    weekOpacity.value = withDelay(2000, withTiming(1, { duration: 800, easing: EASE_OUT }));
    // Then button
    buttonOpacity.value = withDelay(2700, withTiming(1, { duration: 600, easing: EASE_OUT }));
    buttonTranslateY.value = withDelay(2700, withTiming(0, { duration: 600, easing: EASE_OUT }));
  }, [isActive]);

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ translateY: imageTranslateY.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyOpacity.value,
    transform: [{ translateY: bodyTranslateY.value }],
  }));

  const weekStyle = useAnimatedStyle(() => ({
    opacity: weekOpacity.value,
  }));

  const buttonAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: palette.terracotta }]}>
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        <View style={styles.centerArea}>
          <Animated.View style={[imageStyle, { alignItems: 'center' }]}>
            <Image
              source={require('@/assets/images/sun.png')}
              style={styles.sunImage}
              resizeMode="contain"
            />
          </Animated.View>
          <Animated.View style={[titleStyle, { alignItems: 'center' }]}>
            <Text style={[styles.title, { color: palette.cream }]}>
              You did it.
            </Text>
            <Text style={[styles.subtitle, { color: palette.cream }]}>
              One minute of nothing.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.bodyArea, bodyStyle]}>
            {[
              { icon: 'heart', text: 'Cortisol dropped' },
              { icon: 'zap', text: 'Focus sharpened' },
              { icon: 'compass', text: 'Clearer decisions' },
              { icon: 'brain', text: 'Brain recharging', isMci: true },
            ].map((item, i) => (
              <View key={i} style={styles.factRow}>
                <View style={styles.factIcon}>
                  {item.isMci ? (
                    <MaterialCommunityIcons name={item.icon as any} size={18} color={palette.terracotta} />
                  ) : (
                    <Feather name={item.icon as any} size={16} color={palette.terracotta} />
                  )}
                </View>
                <Text style={[styles.factText, { color: palette.cream }]}>
                  {item.text}
                </Text>
              </View>
            ))}
          </Animated.View>

          <Animated.View style={[styles.weekArea, weekStyle]}>
            <View style={styles.weekGrid}>
              {DAYS.map((day, i) => {
                const isToday = i === todayIdx;
                const done = isToday;
                const size = done ? 20 : 4;
                return (
                  <View key={day} style={styles.weekDayCol}>
                    <View
                      style={{
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: done ? palette.cream : palette.cream + 'BB',
                      }}
                    />
                    <Text
                      style={[
                        styles.weekDayLabel,
                        { color: isToday ? palette.cream : palette.cream + 'CC' },
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={[styles.streakHint, { color: palette.cream }]}>
              Day 1. Let's fill the rest.
            </Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonArea, { paddingBottom: 24 }, buttonAnimStyle]}>
          <Pressable onPress={onNext} style={[styles.circleButton, { borderColor: palette.cream }]}>
            <Feather name="arrow-right" size={22} color={palette.cream} />
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sunImage: {
    width: 180,
    height: 180,
    marginBottom: 20,
  },
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 48,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts?.serif,
    fontSize: 22,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: 8,
  },
  bodyArea: {
    marginTop: 28,
    gap: 10,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  factIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: palette.cream,
    opacity: 0.85,
    justifyContent: 'center',
    alignItems: 'center',
  },
  factText: {
    fontFamily: Fonts?.serif,
    fontSize: 20,
    fontWeight: '500',
  },
  weekArea: {
    marginTop: 48,
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 44,
    width: '100%',
  },
  weekDayCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 6,
  },
  weekDayLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  streakHint: {
    fontFamily: Fonts?.serif,
    fontSize: 14,
    fontWeight: '300',
    marginTop: 16,
  },
  buttonArea: {
    alignItems: 'flex-end',
  },
  circleButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

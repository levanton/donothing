import { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import PillButton from '@/components/PillButton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import * as Haptics from 'expo-haptics';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';


const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const FACTS = [
  { icon: 'heart', text: 'Cortisol dropped', isMci: false },
  { icon: 'zap', text: 'Focus sharpened', isMci: false },
  { icon: 'compass', text: 'Clearer decisions', isMci: false },
  { icon: 'brain', text: 'Brain recharging', isMci: true },
];

function getTodayIndex(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function FactRow({ icon, text, isMci, delay, onAppear }: {
  icon: string; text: string; isMci: boolean; delay: number; onAppear: () => void;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const translateX = useSharedValue(-20);
  const onAppearRef = useRef(onAppear);
  onAppearRef.current = onAppear;

  useEffect(() => {
    const d = delay;
    opacity.value = withDelay(d, withTiming(1, { duration: 500, easing: EASE_OUT }));
    translateX.value = withDelay(d, withTiming(0, { duration: 500, easing: EASE_OUT }));
    scale.value = withDelay(d, withTiming(1, { duration: 500, easing: EASE_OUT }));
    const t = setTimeout(() => onAppearRef.current(), d);
    return () => clearTimeout(t);
  }, [delay]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[styles.factRow, style]}>
      <View style={styles.factIcon}>
        {isMci ? (
          <MaterialCommunityIcons name={icon as any} size={18} color={palette.terracotta} />
        ) : (
          <Feather name={icon as any} size={16} color={palette.terracotta} />
        )}
      </View>
      <Text style={[styles.factText, { color: palette.cream }]}>
        {text}
      </Text>
      <Feather name="check" size={16} color={'#FFFFFF'} style={{ marginLeft: 4 }} />
    </Animated.View>
  );
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
  const weekOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);

  useEffect(() => {
    if (!isActive) return;
    imageOpacity.value = withDelay(200, withTiming(1, { duration: 800, easing: EASE_OUT }));
    imageTranslateY.value = withDelay(200, withTiming(0, { duration: 800, easing: EASE_OUT }));
    titleOpacity.value = withDelay(700, withTiming(1, { duration: 800, easing: EASE_OUT }));
    titleScale.value = withDelay(700, withTiming(1, { duration: 800, easing: EASE_OUT }));
    // Facts: 1300, 1600, 1900, 2200
    // Week after facts
    weekOpacity.value = withDelay(2700, withTiming(1, { duration: 800, easing: EASE_OUT }));
    buttonOpacity.value = withDelay(3300, withTiming(1, { duration: 600, easing: EASE_OUT }));
    buttonTranslateY.value = withDelay(3300, withTiming(0, { duration: 600, easing: EASE_OUT }));
  }, [isActive]);

  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageOpacity.value,
    transform: [{ translateY: imageTranslateY.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
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

          {isActive && (
            <View style={styles.bodyArea}>
              {FACTS.map((item, i) => (
                <FactRow
                  key={i}
                  icon={item.icon}
                  text={item.text}
                  isMci={item.isMci}
                  delay={1300 + i * 300}
                  onAppear={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                />
              ))}
            </View>
          )}

          <Animated.View style={[styles.weekCard, weekStyle]}>
            <Text style={[styles.streakHint, { color: palette.charcoal }]}>
              Day 1. Let's fill the rest.
            </Text>
            <View style={styles.weekGrid}>
              {DAYS.map((day, i) => {
                const isToday = i === todayIdx;
                const done = isToday;
                const size = done ? 24 : 6;
                return (
                  <View key={day} style={styles.weekDayCol}>
                    <View
                      style={{
                        width: size,
                        height: size,
                        borderRadius: size / 2,
                        backgroundColor: done ? palette.charcoal : palette.charcoal + '30',
                      }}
                    />
                    <Text
                      style={[
                        styles.weekDayLabel,
                        { color: isToday ? palette.charcoal : palette.charcoal + '80' },
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.buttonArea, { paddingBottom: 24 }, buttonAnimStyle]}>
          <PillButton label="continue" onPress={onNext} variant="filled" size="large" color={palette.terracotta} bg={palette.cream} />
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
    width: 190,
    height: 190,
    marginBottom: -12,
  },
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 42,
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
    marginTop: 32,
    gap: 12,
    alignSelf: 'center',
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  weekCard: {
    marginTop: 36,
    width: '100%',
    backgroundColor: palette.cream,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  streakHint: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '400',
    marginBottom: 16,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 52,
    width: '100%',
  },
  weekDayCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    gap: 8,
  },
  weekDayLabel: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  buttonArea: {
    alignItems: 'center',
  },
});

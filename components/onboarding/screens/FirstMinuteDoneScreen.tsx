import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

const EASE_OUT = Easing.bezier(0.25, 0.1, 0.25, 1);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getTodayIndex(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1; // Mon=0, Sun=6
}

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function FirstMinuteDoneScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();
  const todayIdx = getTodayIndex();

  const titleOpacity = useSharedValue(0);
  const titleScale = useSharedValue(0.92);
  const bodyOpacity = useSharedValue(0);
  const bodyTranslateY = useSharedValue(10);
  const weekOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);

  useEffect(() => {
    if (!isActive) return;
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 800, easing: EASE_OUT }));
    titleScale.value = withDelay(300, withTiming(1, { duration: 800, easing: EASE_OUT }));
    bodyOpacity.value = withDelay(1000, withTiming(1, { duration: 700, easing: EASE_OUT }));
    bodyTranslateY.value = withDelay(1000, withTiming(0, { duration: 700, easing: EASE_OUT }));
    weekOpacity.value = withDelay(1800, withTiming(1, { duration: 800, easing: EASE_OUT }));
    buttonOpacity.value = withDelay(2600, withTiming(1, { duration: 600, easing: EASE_OUT }));
    buttonTranslateY.value = withDelay(2600, withTiming(0, { duration: 600, easing: EASE_OUT }));
  }, [isActive]);

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
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
        <View style={styles.centerArea}>
          <Animated.View style={titleStyle}>
            <Text style={[styles.title, { color: palette.terracotta }]}>
              1 min
            </Text>
            <Text style={[styles.subtitle, { color: theme.text }]}>
              of nothing. Done.
            </Text>
          </Animated.View>

          <Animated.View style={[styles.bodyArea, bodyStyle]}>
            <Text style={[styles.body, { color: theme.text }]}>
              That's your first step.{'\n'}Let's keep it going.
            </Text>
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
                        backgroundColor: done ? palette.terracotta : palette.charcoal + '20',
                      }}
                    />
                    <Text
                      style={[
                        styles.weekDayLabel,
                        { color: isToday ? theme.text : theme.text + '80' },
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
          <Pressable onPress={onNext} style={[styles.circleButton, { borderColor: theme.text }]}>
            <Feather name="arrow-right" size={22} color={theme.text} />
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
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 56,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts?.serif,
    fontSize: 24,
    fontWeight: '300',
    textAlign: 'center',
    marginTop: 8,
  },
  bodyArea: {
    marginTop: 32,
  },
  body: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 26,
    opacity: 0.6,
  },
  weekArea: {
    marginTop: 48,
    width: '100%',
    maxWidth: 280,
  },
  weekGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 44,
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

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';


interface Testimonial {
  name: string;
  text: string;
  duration: string;
  bg: string;
  textColor: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Sarah M.',
    text: 'I used to check my phone 200 times a day. Now I start every morning with 5 minutes of nothing. My kids noticed before I did — "Mom, you actually look at us now."',
    duration: '3 months',
    bg: palette.terracotta,
    textColor: palette.cream,
  },
  {
    name: 'James K.',
    text: 'My therapist told me to "just sit with my thoughts." I had no idea how. This app literally teaches you to do nothing. Sounds dumb. Changed my sleep completely.',
    duration: '6 weeks',
    bg: palette.charcoal,
    textColor: palette.cream,
  },
  {
    name: 'Priya R.',
    text: 'I deleted Instagram, TikTok, Twitter — nothing stuck. Then I tried doing nothing for one minute. That one minute did what deleting apps couldn\'t.',
    duration: '2 months',
    bg: palette.salmon,
    textColor: palette.brown,
  },
  {
    name: 'Tom W.',
    text: 'I\'m a software engineer. My brain never stops. 10 minutes of nothing a day and I solve problems faster than when I was grinding 14 hours straight.',
    duration: '4 months',
    bg: palette.terracotta,
    textColor: palette.cream,
  },
  {
    name: 'Elena V.',
    text: 'I was skeptical. "An app that does nothing?" But the first time I sat still for 5 minutes without reaching for my phone, I cried. I didn\'t know how wound up I was.',
    duration: '5 weeks',
    bg: palette.charcoal,
    textColor: palette.cream,
  },
];

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function TestimonialsScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = width * 0.72;
  const cardHeight = cardWidth * 1.15;

  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);
  const lastSnapIndex = React.useRef(0);

  React.useEffect(() => {
    if (!isActive) return;
    buttonOpacity.value = withDelay(1600, withTiming(1, { duration: 700, easing: EASE_OUT }));
    buttonTranslateY.value = withDelay(1600, withTiming(0, { duration: 700, easing: EASE_OUT }));
  }, [isActive]);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  const handleScrollEnd = React.useCallback((e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + 12));
    if (index !== lastSnapIndex.current) {
      lastSnapIndex.current = index;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [cardWidth]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingBottom: insets.bottom }]}>
      <View style={styles.centerArea}>
        <Animated.View entering={FadeIn.duration(900)}>
          <Text style={[styles.title, { color: theme.text }]}>
            Real people.{'\n'}Real nothing.
          </Text>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(900).delay(500)}>
          <Text style={[styles.subtitle, { color: theme.text }]}>
            What happened when they stopped.
          </Text>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(1100).delay(1000)} style={{ height: cardHeight }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.sliderContent}
            decelerationRate="fast"
            snapToInterval={cardWidth + 12}
            onMomentumScrollEnd={handleScrollEnd}
          >
            {TESTIMONIALS.map((t, i) => (
              <View
                key={i}
                style={[
                  styles.card,
                  {
                    width: cardWidth,
                    height: cardHeight,
                    backgroundColor: t.bg,
                  },
                ]}
              >
                <Text style={[styles.quote, { color: t.textColor }]}>{'\u201C'}</Text>
                <Text style={[styles.text, { color: t.textColor }]}>{t.text}</Text>
                <View style={styles.cardBottom}>
                  <View style={[styles.avatar, { backgroundColor: t.textColor + '25' }]}>
                    <Text style={[styles.avatarText, { color: t.textColor }]}>
                      {t.name[0]}
                    </Text>
                  </View>
                  <View>
                    <Text style={[styles.name, { color: t.textColor }]}>{t.name}</Text>
                    <Text style={[styles.duration, { color: t.textColor }]}>{t.duration}</Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>

      <Animated.View style={[styles.buttonArea, { paddingBottom: 24 }, buttonAnimStyle]}>
        <Pressable onPress={onNext} style={[styles.circleButton, { borderColor: theme.text }]}>
          <Feather name="arrow-right" size={22} color={theme.text} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerArea: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 34,
    fontWeight: '400',
    textAlign: 'left',
    paddingHorizontal: 24,
  },
  subtitle: {
    fontFamily: Fonts?.serif,
    fontSize: 17,
    fontWeight: '400',
    textAlign: 'left',
    marginTop: 8,
    marginBottom: 40,
    paddingHorizontal: 24,
  },
  sliderContent: {
    paddingHorizontal: 24,
    gap: 12,
    alignItems: 'center',
  },
  card: {
    borderRadius: 20,
    padding: 22,
    justifyContent: 'space-between',
  },
  quote: {
    fontFamily: Fonts?.serif,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
    opacity: 0.3,
  },
  text: {
    fontFamily: Fonts?.serif,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    flex: 1,
    marginTop: 4,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: Fonts?.serif,
    fontSize: 16,
    fontWeight: '600',
  },
  name: {
    fontFamily: Fonts?.serif,
    fontSize: 15,
    fontWeight: '600',
  },
  duration: {
    fontFamily: Fonts?.mono,
    fontSize: 13,
    fontWeight: '300',
    opacity: 0.7,
    marginTop: 1,
  },
  buttonArea: {
    alignItems: 'flex-end',
    paddingHorizontal: 32,
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

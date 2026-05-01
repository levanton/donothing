import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, useSharedValue, useAnimatedStyle, withTiming, withDelay } from 'react-native-reanimated';
import { EASE_OUT } from '@/constants/animations';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';


interface Fact {
  stat: string;
  line: string;
  body: string;
  src: string;
  url: string;
}

// Card colour cycle. Reordering FACTS no longer touches colours — the
// position in the array picks the theme. Add/remove themes here to
// re-skin the whole carousel.
interface CardTheme {
  bg: string;
  textColor: string;
  accentColor: string;
}

const CARD_THEMES: CardTheme[] = [
  { bg: palette.terracotta, textColor: palette.cream, accentColor: palette.cream },
  { bg: palette.salmon,     textColor: palette.brown, accentColor: palette.brown },
  { bg: palette.charcoal,   textColor: palette.cream, accentColor: palette.cream },
];

const FACTS: Fact[] = [
  {
    stat: '5h 16m',
    line: 'per day on your phone',
    body: 'More than double what doctors recommend. A 14% increase from last year — before counting tablets or TV.',
    src: 'harmonyhit.com · 2025',
    url: 'https://www.harmonyhit.com/phone-screen-time-statistics/',
  },
  {
    stat: 'Rest',
    line: '= better ideas',
    body: 'J.K. Rowling dreamed up Harry Potter during 4 boring hours on a train. Your brain does its best work when you stop.',
    src: 'UCLan · 2014',
    url: 'https://www.sci-tech-today.com/stats/cell-phone-smartphone-addiction-statistics/',
  },
  {
    stat: '43 sec',
    line: 'your attention span now',
    body: '12 seconds shorter than two years ago. We switch tasks 566 times per workday. Never finishing a thought.',
    src: 'Gloria Mark · 2023',
    url: 'https://www.sci-tech-today.com/stats/cell-phone-smartphone-addiction-statistics/',
  },
  {
    stat: '82%',
    line: 'at risk of burnout',
    body: 'Gen Z peaks at 25 — seventeen years earlier than before. Doing nothing isn\'t laziness. It\'s recovery.',
    src: 'Mercer · 2024',
    url: 'https://www.sci-tech-today.com/stats/cell-phone-smartphone-addiction-statistics/',
  },
  {
    stat: '150×',
    line: 'a day you check it',
    body: 'Every 10 minutes. Silencing it makes it worse — anxiety of missing something makes you check even more.',
    src: 'slicktext.com · 2026',
    url: 'https://www.slicktext.com/blog/smartphone-addiction-statistics/',
  },
  {
    stat: '70',
    line: 'days a year — gone',
    body: '1 day per week, 6 per month, 70 per year. Over two months of your life, every year, scrolling.',
    src: 'addictionhelp.com · 2025',
    url: 'https://www.addictionhelp.com/phone-addiction/statistics/',
  },
  {
    stat: '23 min',
    line: 'to refocus after one ping',
    body: 'Even a 3-second notification resets your focus clock. Every buzz, every banner — deep work never begins.',
    src: 'UC Irvine · 2023',
    url: 'https://www.sci-tech-today.com/stats/cell-phone-smartphone-addiction-statistics/',
  },
  {
    stat: '−IQ',
    line: 'phone nearby = dumber',
    body: 'Even face down, silent — your brain wastes energy resisting the urge to check it.',
    src: 'UT Austin · 2017',
    url: 'https://www.sci-tech-today.com/stats/cell-phone-smartphone-addiction-statistics/',
  },
  {
    stat: '55%',
    line: 'wish their partner would look up',
    body: '70% say phones interfere with relationships daily. We\'re physically present but mentally scrolling.',
    src: 'harmonyhit.com · 2025',
    url: 'https://www.harmonyhit.com/phone-screen-time-statistics/',
  },
  {
    stat: '76%',
    line: 'panic without their phone',
    body: 'It\'s called nomophobia. 88% check within 10 min of waking. 4 in 5 addicts wish they weren\'t.',
    src: 'Reviews.org · 2025',
    url: 'https://www.harmonyhit.com/phone-screen-time-statistics/',
  },
  {
    stat: '53%',
    line: 'want to change',
    body: '33% more than two years ago. The desire is real. You\'re here. The first step is small.',
    src: 'harmonyhit.com · 2025',
    url: 'https://www.harmonyhit.com/phone-screen-time-statistics/',
  },
];

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function EvidenceScreen({ isActive, onNext, theme }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cardWidth = width * 0.52;
  const cardHeight = cardWidth * 1.45;

  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(12);

  React.useEffect(() => {
    if (!isActive) return;
    buttonOpacity.value = withDelay(1600, withTiming(1, { duration: 700, easing: EASE_OUT }));
    buttonTranslateY.value = withDelay(1600, withTiming(0, { duration: 700, easing: EASE_OUT }));
  }, [isActive]);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingBottom: insets.bottom }]}>
      <View style={styles.centerArea}>
        <Animated.View entering={FadeIn.duration(900)}>
          <Text style={[styles.title, { color: theme.text }]}>
            The Facts
          </Text>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(900).delay(500)}>
          <Text style={[styles.subtitle, { color: theme.text }]}>
            What we lose by never stopping — and what we could gain by doing nothing
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
          >
            {FACTS.map((f, i) => {
              const cardTheme = CARD_THEMES[i % CARD_THEMES.length];
              return (
                <Pressable
                  key={i}
                  onPress={() => Linking.openURL(f.url)}
                  style={[
                    styles.card,
                    {
                      width: cardWidth,
                      height: cardHeight,
                      backgroundColor: cardTheme.bg,
                    },
                  ]}
                >
                  <Text style={[styles.stat, { color: cardTheme.textColor }]}>{f.stat}</Text>
                  <Text style={[styles.line, { color: cardTheme.textColor }]}>{f.line}</Text>
                  <View style={styles.cardBottom}>
                    <Text style={[styles.body, { color: cardTheme.accentColor }]}>{f.body}</Text>
                    <View style={[styles.srcChip, { borderColor: cardTheme.accentColor }]}>
                      <Text style={[styles.src, { color: cardTheme.accentColor }]}>{f.src}</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
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
    padding: 18,
    justifyContent: 'space-between',
  },
  stat: {
    fontFamily: Fonts?.serif,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
  },
  line: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 24,
    marginTop: 6,
  },
  cardBottom: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  body: {
    fontFamily: Fonts?.serif,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    marginBottom: 10,
  },
  srcChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  src: {
    fontFamily: Fonts?.serif,
    fontSize: 11,
    fontWeight: '500',
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

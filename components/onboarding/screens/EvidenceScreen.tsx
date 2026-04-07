import { Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Fonts } from '@/constants/theme';
import { palette } from '@/lib/theme';

interface Fact {
  stat: string;
  line: string;
  body: string;
  src: string;
  url: string;
  bg: string;
  textColor: string;
  accentColor: string;
}

const FACTS: Fact[] = [
  {
    stat: '5h 16m',
    line: 'per day on your phone',
    body: 'More than double what doctors recommend. A 14% increase from last year — before counting tablets or TV.',
    src: 'harmonyhit.com · 2025',
    url: 'https://www.harmonyhit.com/phone-screen-time-statistics/',
    bg: '#CF644D',
    textColor: '#F9F2E0',
    accentColor: '#F9F2E0',
  },
  {
    stat: '150×',
    line: 'a day you check it',
    body: 'Every 10 minutes. Silencing it makes it worse — anxiety of missing something makes you check even more.',
    src: 'slicktext.com · 2026',
    url: 'https://www.slicktext.com/blog/smartphone-addiction-statistics/',
    bg: '#333431',
    textColor: '#F9F2E0',
    accentColor: '#F9F2E0',
  },
  {
    stat: '70',
    line: 'days a year — gone',
    body: '1 day per week, 6 per month, 70 per year. Over two months of your life, every year, scrolling.',
    src: 'addictionhelp.com · 2025',
    url: 'https://www.addictionhelp.com/phone-addiction/statistics/',
    bg: '#E8A99A',
    textColor: '#333431',
    accentColor: '#333431',
  },
  {
    stat: '23 min',
    line: 'to refocus after one ping',
    body: 'Even a 3-second notification resets your focus clock. Every buzz, every banner — deep work never begins.',
    src: 'UC Irvine · 2023',
    url: 'https://www.sci-tech-today.com/stats/cell-phone-smartphone-addiction-statistics/',
    bg: '#CF644D',
    textColor: '#F9F2E0',
    accentColor: '#F9F2E0',
  },
  {
    stat: '−IQ',
    line: 'phone nearby = dumber',
    body: 'Even face down, silent — your brain wastes energy resisting the urge to check it.',
    src: 'UT Austin · 2017',
    url: 'https://www.sci-tech-today.com/stats/cell-phone-smartphone-addiction-statistics/',
    bg: '#333431',
    textColor: '#F9F2E0',
    accentColor: '#F9F2E0',
  },
  {
    stat: '55%',
    line: 'wish their partner would look up',
    body: '70% say phones interfere with relationships daily. We\'re physically present but mentally scrolling.',
    src: 'harmonyhit.com · 2025',
    url: 'https://www.harmonyhit.com/phone-screen-time-statistics/',
    bg: '#E8A99A',
    textColor: '#333431',
    accentColor: '#333431',
  },
  {
    stat: '76%',
    line: 'panic without their phone',
    body: 'It\'s called nomophobia. 88% check within 10 min of waking. 4 in 5 addicts wish they weren\'t.',
    src: 'Reviews.org · 2025',
    url: 'https://www.harmonyhit.com/phone-screen-time-statistics/',
    bg: '#CF644D',
    textColor: '#F9F2E0',
    accentColor: '#F9F2E0',
  },
  {
    stat: '43 sec',
    line: 'your attention span now',
    body: '12 seconds shorter than two years ago. We switch tasks 566 times per workday. Never finishing a thought.',
    src: 'Gloria Mark · 2023',
    url: 'https://www.sci-tech-today.com/stats/cell-phone-smartphone-addiction-statistics/',
    bg: '#333431',
    textColor: '#F9F2E0',
    accentColor: '#F9F2E0',
  },
  {
    stat: '82%',
    line: 'at risk of burnout',
    body: 'Gen Z peaks at 25 — seventeen years earlier than before. Doing nothing isn\'t laziness. It\'s recovery.',
    src: 'Mercer · 2024',
    url: 'https://www.sci-tech-today.com/stats/cell-phone-smartphone-addiction-statistics/',
    bg: '#E8A99A',
    textColor: '#333431',
    accentColor: '#333431',
  },
  {
    stat: 'Rest',
    line: '= better ideas',
    body: 'J.K. Rowling dreamed up Harry Potter during 4 boring hours on a train. Your brain does its best work when you stop.',
    src: 'UCLan · 2014',
    url: 'https://www.sci-tech-today.com/stats/cell-phone-smartphone-addiction-statistics/',
    bg: '#CF644D',
    textColor: '#F9F2E0',
    accentColor: '#F9F2E0',
  },
  {
    stat: '53%',
    line: 'want to change',
    body: '33% more than two years ago. The desire is real. You\'re here. The first step is small.',
    src: 'harmonyhit.com · 2025',
    url: 'https://www.harmonyhit.com/phone-screen-time-statistics/',
    bg: '#333431',
    textColor: '#F9F2E0',
    accentColor: '#F9F2E0',
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

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ flex: 1 }} />
      <Animated.Text
        entering={FadeIn.duration(600)}
        style={[styles.title, { color: theme.text }]}
      >
        The Facts
      </Animated.Text>
      <Animated.Text
        entering={FadeIn.duration(600).delay(200)}
        style={[styles.subtitle, { color: theme.text }]}
      >
        What we lose by never stopping — and what we could gain by doing nothing
      </Animated.Text>
      <Animated.View entering={FadeIn.duration(800).delay(300)} style={{ height: cardHeight }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={styles.sliderContent}
          decelerationRate="fast"
          snapToInterval={cardWidth + 12}
        >
          {FACTS.map((f, i) => (
            <Pressable
              key={i}
              onPress={() => Linking.openURL(f.url)}
              style={[
                styles.card,
                {
                  width: cardWidth,
                  height: cardHeight,
                  backgroundColor: f.bg,
                },
              ]}
            >
              <Text style={[styles.stat, { color: f.textColor }]}>{f.stat}</Text>
              <Text style={[styles.line, { color: f.textColor }]}>{f.line}</Text>
              <View style={styles.cardBottom}>
                <Text style={[styles.body, { color: f.accentColor }]}>{f.body}</Text>
                <View style={[styles.srcChip, { borderColor: f.accentColor }]}>
                  <Text style={[styles.src, { color: f.accentColor }]}>{f.src}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </Animated.View>
      <View style={{ flex: 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontFamily: Fonts?.serif,
    fontSize: 34,
    fontWeight: '400',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts?.serif,
    fontSize: 17,
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.7,
    marginTop: 8,
    marginBottom: 40,
    paddingHorizontal: 40,
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
});

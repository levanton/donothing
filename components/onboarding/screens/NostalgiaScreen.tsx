import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ONBOARDING_BODY_BOLD, onboardingText } from '../textStyles';

const HEADING = 'remember?';

interface LineSpec {
  /** Plain line. */
  text?: string;
  /** Normal-weight lead + a bolder keyword, e.g. "no " + "rush." */
  lead?: string;
  strong?: string;
  /** Extra space above this line, on top of the list gap. */
  paragraph?: boolean;
}

const LINES: LineSpec[] = [
  { text: 'lying in the grass.' },
  { text: 'staring at clouds.' },
  { text: 'dreaming about nothing.' },
  { lead: 'no ', strong: 'rush.', paragraph: true },
  { lead: 'no ', strong: 'goals.' },
  { lead: 'no ', strong: 'phone.' },
];

const grassImage = require('@/assets/images/child.png');

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: { text: string; bg: string };
}

export default function NostalgiaScreen({ theme }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // A bit bigger than before, but scales down on small screens.
  const imageSize = Math.min(width * 0.68, 280);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 32,
        },
      ]}
    >
      <Text style={[onboardingText.heading, { color: theme.text }]}>
        {HEADING}
      </Text>

      <Image
        source={grassImage}
        style={[styles.image, { width: imageSize, height: imageSize }]}
        resizeMode='contain'
        fadeDuration={0}
      />

      <View>
        {LINES.map((spec, i) => (
          <Text
            key={i}
            style={[
              onboardingText.line,
              { color: theme.text },
              spec.paragraph && styles.paragraph,
            ]}
          >
            {spec.strong ? (
              <>
                {spec.lead}
                <Text style={ONBOARDING_BODY_BOLD}>{spec.strong}</Text>
              </>
            ) : (
              spec.text
            )}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
    gap: 28,
  },
  image: {
    alignSelf: 'center',
  },
  paragraph: {
    marginTop: 20,
  },
});

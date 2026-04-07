import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import ChipSelect from '../ChipSelect';
import { palette } from '@/lib/theme';
import { Fonts } from '@/constants/theme';
import { SCREENS } from '@/lib/onboarding-data';
import { requestPermission } from '@/lib/notifications';

const screen = SCREENS.find((s) => s.id === 'schedule')!;

interface Props {
  isActive: boolean;
  onNext: () => void;
  selected: string[];
  onSelect: (val: string[]) => void;
  theme: { text: string; bg: string };
}

export default function ScheduleScreen({ isActive, onNext, selected, onSelect, theme }: Props) {
  const handleContinue = useCallback(async () => {
    await requestPermission();
    onNext();
  }, [onNext]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.heading, { color: theme.text, fontFamily: Fonts?.serif }]}>
        {screen.heading}
      </Text>
      <Text style={[styles.body, { color: theme.text }]}>
        {screen.body}
      </Text>

      <View style={styles.chips}>
        {isActive && (
          <ChipSelect
            options={screen.options!}
            selected={selected}
            onSelect={onSelect}
            color={theme.text}
            chipBg={palette.white}
          />
        )}
      </View>

      {selected.length > 0 && (
        <Animated.View entering={FadeIn.duration(400)} style={styles.permissionHint}>
          <Text style={[styles.hintText, { color: theme.text }]}>
            We'll need your permission to send a gentle reminder.
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: '300',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 36,
  },
  chips: {
    minHeight: 140,
  },
  permissionHint: {
    marginTop: 24,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
  },
});

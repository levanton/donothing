import { forwardRef, useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { haptics } from '@/lib/haptics';

import PickerSheet from './PickerSheet';
import PillButton from './PillButton';
import { Fonts } from '@/constants/theme';
import { useAppStore } from '@/lib/store';
import { themes } from '@/lib/theme';

type Phase = 'ask' | 'rate';

interface ReviewSheetProps {
  onRate: () => void;
  onDismiss?: () => void;
}

const ReviewSheet = forwardRef<BottomSheet, ReviewSheetProps>(({ onRate, onDismiss }, ref) => {
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themes[themeMode];
  const [phase, setPhase] = useState<Phase>('ask');
  const innerRef = useRef<BottomSheet>(null);

  const sheetRef = (ref as React.RefObject<BottomSheet>) ?? innerRef;

  const dismiss = useCallback(() => {
    sheetRef.current?.close();
  }, [sheetRef]);

  const handleYes = useCallback(() => {
    haptics.select();
    setPhase('rate');
  }, []);

  const handleNo = useCallback(() => {
    haptics.select();
    dismiss();
  }, [dismiss]);

  const handleRate = useCallback(() => {
    haptics.success();
    onRate();
    dismiss();
  }, [onRate, dismiss]);

  const handleDismiss = useCallback(() => {
    setPhase('ask');
    onDismiss?.();
  }, [onDismiss]);

  return (
    <PickerSheet ref={sheetRef} theme={theme} onDismiss={handleDismiss}>
      <View style={styles.content}>
        {phase === 'ask' ? (
          <>
            <Text style={[styles.question, { color: theme.text, fontFamily: Fonts!.serif }]}>
              Do you like this app?
            </Text>
            <PillButton
              label="Yes"
              onPress={handleYes}
              color={theme.accentText}
              variant="filled"
              bg={theme.accent}
              style={styles.button}
            />
            <PillButton
              label="No"
              onPress={handleNo}
              color={theme.text}
              variant="outline"
              style={styles.button}
            />
          </>
        ) : (
          <>
            <Text style={[styles.question, { color: theme.text, fontFamily: Fonts!.serif }]}>
              Wonderful! Would you help us grow{'\n'}by rating the app?
            </Text>
            <PillButton
              label="Rate the app"
              onPress={handleRate}
              color={theme.accentText}
              variant="filled"
              bg={theme.accent}
              style={styles.button}
            />
            <PillButton
              label="Cancel"
              onPress={handleNo}
              color={theme.text}
              variant="outline"
              style={styles.button}
            />
          </>
        )}
      </View>
    </PickerSheet>
  );
});

ReviewSheet.displayName = 'ReviewSheet';

export default ReviewSheet;

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 32,
    paddingTop: 8,
    alignItems: 'center',
  },
  question: {
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 26,
  },
  button: {
    minWidth: 200,
    marginBottom: 12,
  },
});

import { forwardRef, useCallback, type ReactNode } from 'react';
import { Keyboard } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppTheme } from '@/lib/theme';

interface Props {
  theme: AppTheme;
  onDismiss?: () => void;
  children: ReactNode;
}

const PickerSheet = forwardRef<BottomSheet, Props>(({ theme, onDismiss, children }, ref) => {
  const insets = useSafeAreaInsets();

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.3} />,
    [],
  );

  return (
    <BottomSheet
      ref={ref}
      index={-1}
      enableDynamicSizing
      enablePanDownToClose
      enableOverDrag={false}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onAnimate={(_from, to) => { if (to === -1) Keyboard.dismiss(); }}
      onChange={(i) => { if (i === -1) onDismiss?.(); }}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
      backgroundStyle={{ backgroundColor: theme.bg, borderRadius: 24 }}
    >
      <BottomSheetView style={{ paddingBottom: insets.bottom + 24 }}>
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
});

PickerSheet.displayName = 'PickerSheet';

export default PickerSheet;

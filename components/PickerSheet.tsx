import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from 'react';
import { Keyboard, Platform } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppTheme } from '@/lib/theme';

interface Props {
  theme: AppTheme;
  onDismiss?: () => void;
  children: ReactNode;
  /** Fixed snap points. When provided, dynamic sizing is disabled. */
  snapPoints?: (string | number)[];
}

const PickerSheet = forwardRef<BottomSheet, Props>(({ theme, onDismiss, children, snapPoints }, ref) => {
  const insets = useSafeAreaInsets();
  const internalRef = useRef<BottomSheet>(null);
  const isOpenRef = useRef(false);

  useImperativeHandle(ref, () => internalRef.current as BottomSheet, []);

  // Known gorhom/bottom-sheet v5 bug: with dynamic sizing, the sheet stays
  // stuck at the expanded position after the keyboard dismisses. Workaround
  // from github issue #2509: on keyboardDidHide, snap back to index 0.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const sub = Keyboard.addListener('keyboardDidHide', () => {
      if (isOpenRef.current) {
        internalRef.current?.snapToIndex(0);
      }
    });
    return () => sub.remove();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.3} />,
    [],
  );

  return (
    <BottomSheet
      ref={internalRef}
      index={-1}
      snapPoints={snapPoints}
      enableDynamicSizing={snapPoints ? false : true}
      enablePanDownToClose
      enableOverDrag={false}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      onAnimate={(_from, to) => { if (to === -1) Keyboard.dismiss(); }}
      onChange={(i) => {
        isOpenRef.current = i >= 0;
        if (i === -1) onDismiss?.();
      }}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: theme.border }}
      backgroundStyle={{ backgroundColor: theme.bg, borderRadius: 24 }}
    >
      <BottomSheetView style={snapPoints
        ? { flex: 1, height: '100%', paddingBottom: insets.bottom + 24 }
        : { paddingBottom: insets.bottom + 24 }
      }>
        {children}
      </BottomSheetView>
    </BottomSheet>
  );
});

PickerSheet.displayName = 'PickerSheet';

export default PickerSheet;

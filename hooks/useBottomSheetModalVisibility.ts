import { useEffect, type RefObject } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

/**
 * Drives a `BottomSheetModal` ref's `present()` / `dismiss()` from a
 * boolean prop. Replaces the inline `useEffect(() => { if (visible)
 * ref.current?.present(); else ref.current?.dismiss(); }, [visible])`
 * boilerplate that was duplicated across BlockSheet, SessionEndedSheet
 * and AlertModal.
 */
export function useBottomSheetModalVisibility(
  ref: RefObject<BottomSheetModal | null>,
  visible: boolean,
): void {
  useEffect(() => {
    if (visible) ref.current?.present();
    else ref.current?.dismiss();
  }, [visible, ref]);
}

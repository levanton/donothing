import { useEffect, useMemo, useRef } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';
import PillButton from '@/components/PillButton';

type IconName = 'clock' | 'alert-triangle' | 'info';

interface Props {
  visible: boolean;
  theme: AppTheme;
  title: string;
  message: string;
  closeLabel?: string;
  onClose: () => void;
  icon?: IconName;
}

export default function AlertModal({
  visible,
  theme,
  title,
  message,
  closeLabel = 'ok',
  onClose,
  icon = 'alert-triangle',
}: Props) {
  const sheetRef = useRef<BottomSheetModal>(null);

  // Sit the card near the bottom third of the screen.
  const bottomInset = useMemo(() => {
    const { height } = Dimensions.get('window');
    return Math.max(40, Math.round(height * 0.14));
  }, []);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const renderBackdrop = (props: any) => (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={0.5}
      pressBehavior="close"
    />
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      detached
      bottomInset={bottomInset}
      enablePanDownToClose
      enableOverDrag={false}
      backdropComponent={renderBackdrop}
      stackBehavior="push"
      onDismiss={() => {
        if (visible) onClose();
      }}
      handleComponent={null}
      backgroundStyle={{
        backgroundColor: theme.bg,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: theme.border,
      }}
      style={styles.sheetStyle}
    >
      <BottomSheetView>
        <View style={styles.content}>
          <View style={[styles.iconWrap, { backgroundColor: theme.subtle }]}>
            <Feather name={icon} size={22} color={theme.accent} />
          </View>
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts!.serif }]}>
            {title}
          </Text>
          <Text style={[styles.message, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
            {message}
          </Text>
          <View style={styles.btnRow}>
            <PillButton
              label={closeLabel}
              onPress={onClose}
              color={theme.text}
              outline
            />
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetStyle: {
    marginHorizontal: 32,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 20,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  btnRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
});

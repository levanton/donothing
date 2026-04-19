import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';

interface Props {
  visible: boolean;
  theme: AppTheme;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AlertModal({
  visible,
  theme,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.border }]}
          onPress={() => {}}
        >
          <Text style={[styles.title, { color: theme.text, fontFamily: Fonts!.serif }]}>
            {title}
          </Text>
          <Text style={[styles.message, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
            {message}
          </Text>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.buttons}>
            <Pressable onPress={onCancel} style={styles.btn} hitSlop={4}>
              <Text style={[styles.btnText, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
                {cancelLabel}
              </Text>
            </Pressable>
            <View style={[styles.vDivider, { backgroundColor: theme.border }]} />
            <Pressable onPress={onConfirm} style={styles.btn} hitSlop={4}>
              <Text style={[styles.btnText, { color: theme.accent, fontFamily: Fonts!.serif, fontWeight: '600' }]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 22,
    overflow: 'hidden',
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '300',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    lineHeight: 20,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  vDivider: {
    width: StyleSheet.hairlineWidth,
  },
  buttons: {
    flexDirection: 'row',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
  },
});

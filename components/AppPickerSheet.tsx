import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type BottomSheet from '@gorhom/bottom-sheet';
import {
  DeviceActivitySelectionViewPersisted,
  activitySelectionMetadata,
  getFamilyActivitySelectionId,
  setFamilyActivitySelectionId,
} from 'react-native-device-activity';
import * as Haptics from 'expo-haptics';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';
import PickerSheet from '@/components/PickerSheet';
import PillButton from '@/components/PillButton';

interface Props {
  theme: AppTheme;
  /** Active selection id. `null` closes the sheet. */
  selectionId: string | null;
  title: string;
  /** Called when the sheet fully closes. `reason` tells you how. */
  onClose: (reason: 'save' | 'cancel') => void;
}

export default function AppPickerSheet({ theme, selectionId, title, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapshotRef = useRef<string>('');
  const committedRef = useRef(false);

  const [counts, setCounts] = useState({ apps: 0, cats: 0, web: 0 });

  const summary = (() => {
    const { apps, cats, web } = counts;
    const parts: string[] = [];
    if (apps > 0) parts.push(apps === 1 ? '1 app' : `${apps} apps`);
    if (cats > 0) parts.push(cats === 1 ? '1 category' : `${cats} categories`);
    if (web > 0) parts.push(web === 1 ? '1 site' : `${web} sites`);
    return parts.length === 0 ? 'nothing selected' : `${parts.join(' · ')} selected`;
  })();

  // Open / close based on selectionId. Snapshot existing persisted selection
  // so Cancel (incl. swipe-dismiss) can restore it.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    if (selectionId) {
      try {
        snapshotRef.current = getFamilyActivitySelectionId(selectionId) ?? '';
        const meta = activitySelectionMetadata({ activitySelectionId: selectionId });
        setCounts({
          apps: meta?.applicationCount ?? 0,
          cats: meta?.categoryCount ?? 0,
          web: meta?.webDomainCount ?? 0,
        });
      } catch {
        snapshotRef.current = '';
        setCounts({ apps: 0, cats: 0, web: 0 });
      }
      committedRef.current = false;
      sheetRef.current?.expand();
    } else {
      sheetRef.current?.close();
    }
  }, [selectionId]);

  const finish = (reason: 'save' | 'cancel') => {
    if (committedRef.current) return;
    committedRef.current = true;
    if (reason === 'cancel' && selectionId) {
      // Restore snapshot. Empty snapshot still works — writes an empty string
      // entry that the native helpers treat as no selection.
      try {
        setFamilyActivitySelectionId({
          id: selectionId,
          familyActivitySelection: snapshotRef.current,
        });
      } catch {}
    }
    onClose(reason);
  };

  return (
    <PickerSheet
      ref={sheetRef}
      theme={theme}
      snapPoints={['92%']}
      onDismiss={() => finish('cancel')}
    >
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts!.serif }]} numberOfLines={1}>
          {title}
        </Text>

        <View style={[styles.pickerWrap, { borderColor: theme.border }]}>
          {selectionId && (
            <DeviceActivitySelectionViewPersisted
              familyActivitySelectionId={selectionId}
              includeEntireCategory={false}
              onSelectionChange={(e) => {
                const meta = e.nativeEvent;
                setCounts({
                  apps: meta.applicationCount ?? 0,
                  cats: meta.categoryCount ?? 0,
                  web: meta.webDomainCount ?? 0,
                });
              }}
              style={{ flex: 1 }}
            />
          )}
        </View>

        <Text style={[styles.countLabel, { color: theme.textTertiary }]}>
          {summary}
        </Text>

        <View style={styles.buttonRow}>
          <PillButton
            label="cancel"
            color={theme.textSecondary}
            outline
            flex
            onPress={() => {
              Haptics.selectionAsync();
              finish('cancel');
            }}
          />
          <PillButton
            label="save"
            color={theme.accent}
            filled
            flex
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              finish('save');
            }}
          />
        </View>
      </View>
    </PickerSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '400',
    marginBottom: 14,
    textAlign: 'center',
  },
  pickerWrap: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
  },
  countLabel: {
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
});

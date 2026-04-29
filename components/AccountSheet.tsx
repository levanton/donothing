import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type BottomSheet from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { haptics } from '@/lib/haptics';
import Constants from 'expo-constants';

import { Fonts } from '@/constants/theme';
import { palette, type AppTheme } from '@/lib/theme';
import PickerSheet from '@/components/PickerSheet';

// TODO: replace with real URLs before App Store submission
const TERMS_URL = 'https://nothing.app/terms';
const PRIVACY_URL = 'https://nothing.app/privacy';
const SUPPORT_EMAIL = 'mailto:support@nothing.app';
const IOS_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';
// TODO: drop in the real App Store ID once it's minted
const APP_STORE_WRITE_REVIEW = 'itms-apps://apps.apple.com/app/id0000000000?action=write-review';

interface Props {
  theme: AppTheme;
  onDismiss?: () => void;
  onDeleteAccount?: () => void | Promise<void>;
  /** Wire to Purchases.restorePurchases() once react-native-purchases lands. */
  onRestorePurchases?: () => Promise<{ restored: boolean } | void>;
}

const AccountSheet = forwardRef<BottomSheet, Props>(({ theme, onDismiss, onDeleteAccount, onRestorePurchases }, ref) => {
  const sheetRef = useRef<BottomSheet>(null);
  useImperativeHandle(ref, () => sheetRef.current as BottomSheet, []);

  const [restoring, setRestoring] = useState(false);

  const openUrl = async (url: string) => {
    haptics.select();
    try { await Linking.openURL(url); } catch {}
  };

  const handleRestore = async () => {
    if (restoring) return;
    haptics.select();
    setRestoring(true);
    try {
      if (onRestorePurchases) {
        const result = await onRestorePurchases();
        const restored = result?.restored === true;
        Alert.alert(
          restored ? 'Purchases restored' : 'Nothing to restore',
          restored
            ? 'Your previous purchase has been reactivated.'
            : "We couldn't find any prior purchases on this Apple ID.",
        );
      } else {
        // Purchases SDK isn't wired up yet — keep the affordance visible
        // so Apple review sees it and fill in behaviour when ready.
        Alert.alert('Restore purchases', 'Purchase restore will be available once subscriptions go live.');
      }
    } catch {
      Alert.alert('Restore failed', 'Check your connection and try again.');
    } finally {
      setRestoring(false);
    }
  };

  const handleRate = async () => {
    haptics.select();
    try { await Linking.openURL(APP_STORE_WRITE_REVIEW); } catch {}
  };

  const handleDelete = () => {
    haptics.medium();
    Alert.alert(
      'Delete account?',
      "All your sessions, schedules and preferences will be removed. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try { await onDeleteAccount?.(); } catch {}
          },
        },
      ],
    );
  };

  const version = Constants.expoConfig?.version ?? '';
  const build = Platform.select<string | undefined>({
    ios: Constants.expoConfig?.ios?.buildNumber,
    default: undefined,
  });
  const versionLabel = version ? (build ? `v${version} · build ${build}` : `v${version}`) : '';

  return (
    <PickerSheet ref={sheetRef} theme={theme} onDismiss={onDismiss}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts!.serif }]}>
          Account
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
          Purchases, legal and account actions
        </Text>

        <View style={[styles.group, { borderColor: theme.border }]}>
          <Row
            icon="refresh-ccw"
            label={restoring ? 'Restoring…' : 'Restore purchases'}
            theme={theme}
            onPress={handleRestore}
            isLast={false}
            trailing={restoring ? <ActivityIndicator size="small" color={theme.textTertiary} /> : undefined}
          />
          <Row
            icon="credit-card"
            label="Manage subscription"
            theme={theme}
            onPress={() => openUrl(IOS_SUBSCRIPTIONS_URL)}
            isLast
          />
        </View>

        <View style={[styles.group, { borderColor: theme.border, marginTop: 20 }]}>
          <Row
            icon="file-text"
            label="Terms of Use"
            theme={theme}
            onPress={() => openUrl(TERMS_URL)}
            isLast={false}
          />
          <Row
            icon="shield"
            label="Privacy Policy"
            theme={theme}
            onPress={() => openUrl(PRIVACY_URL)}
            isLast={false}
          />
          <Row
            icon="mail"
            label="Contact support"
            theme={theme}
            onPress={() => openUrl(SUPPORT_EMAIL)}
            isLast={false}
          />
          <Row
            icon="star"
            label="Rate Nothing"
            theme={theme}
            onPress={handleRate}
            isLast
          />
        </View>

        <View style={[styles.group, { borderColor: theme.border, marginTop: 20 }]}>
          <Row
            icon="trash-2"
            label="Delete account"
            theme={theme}
            color={palette.danger}
            onPress={handleDelete}
            isLast
          />
        </View>

        {versionLabel ? (
          <Text style={[styles.version, { color: theme.textTertiary, fontFamily: Fonts!.mono }]}>
            {versionLabel}
          </Text>
        ) : null}
      </View>
    </PickerSheet>
  );
});

AccountSheet.displayName = 'AccountSheet';
export default AccountSheet;

interface RowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  theme: AppTheme;
  color?: string;
  onPress: () => void;
  isLast: boolean;
  trailing?: React.ReactNode;
}

function Row({ icon, label, theme, color, onPress, isLast, trailing }: RowProps) {
  const tint = color ?? theme.text;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.row,
        !isLast && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
    >
      <Feather name={icon} size={18} color={tint} />
      <Text style={[styles.rowLabel, { color: tint, fontFamily: Fonts!.serif }]}>
        {label}
      </Text>
      {trailing ?? <Feather name="chevron-right" size={18} color={theme.textTertiary} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '300',
    fontStyle: 'italic',
    letterSpacing: 0.2,
    marginTop: 4,
    marginBottom: 24,
  },
  group: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  version: {
    fontSize: 12,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 24,
  },
});

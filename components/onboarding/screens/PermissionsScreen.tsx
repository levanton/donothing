import { useEffect } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Fonts } from '@/constants/theme';
import { palette, type AppTheme } from '@/lib/theme';
import { usePermissionBanners } from '@/hooks/usePermissionBanners';

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: AppTheme;
}

interface CardSpec {
  id: 'notif' | 'screenTime';
  icon: 'bell' | 'smartphone';
  title: string;
  body: string;
  granted: boolean;
  cardBg: string;
  onPress: () => void;
}

export default function PermissionsScreen({ isActive, onNext, theme }: Props) {
  const {
    authStatus,
    notifStatus,
    handleNotifTap,
    handleScreenTimeBannerTap,
  } = usePermissionBanners();

  const isLight = theme.bg !== palette.charcoal;
  const notifGranted = notifStatus === 'granted';
  const stGranted = authStatus === 'approved';

  const allCards: CardSpec[] = [
    {
      id: 'notif',
      icon: 'bell',
      title: 'Notifications',
      body: 'So we can gently remind you when a block starts and when your minute is up.',
      granted: notifGranted,
      cardBg: isLight
        ? 'rgba(232, 169, 154, 0.55)'
        : 'rgba(232, 169, 154, 0.95)',
      onPress: handleNotifTap,
    },
    {
      id: 'screenTime',
      icon: 'smartphone',
      title: 'Screen Time access',
      body: 'Required to lock and unlock your apps for you. We never see your activity.',
      granted: stGranted,
      cardBg: isLight
        ? 'rgba(224, 166, 83, 0.5)'
        : 'rgba(224, 166, 83, 0.95)',
      onPress: handleScreenTimeBannerTap,
    },
  ];

  const cards = allCards.filter((c) => !c.granted);

  useEffect(() => {
    if (!isActive) return;
    if (Platform.OS !== 'ios') return;
    if (notifGranted && stGranted) {
      const t = setTimeout(onNext, 350);
      return () => clearTimeout(t);
    }
  }, [isActive, notifGranted, stGranted, onNext]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: theme.text, fontFamily: Fonts?.serif }]}>
          A couple of permissions.
        </Text>
        <Text style={[styles.subtitle, { color: theme.text, fontFamily: Fonts?.serif }]}>
          We need these to lock your apps on schedule and let you know when it's time to pause.
        </Text>

        {Platform.OS !== 'ios' ? (
          <View style={[styles.card, { backgroundColor: theme.subtle }]}>
            <Text style={[styles.title, { color: palette.brown, fontFamily: Fonts?.serif }]}>
              Skip ahead
            </Text>
            <Text style={[styles.body, { color: 'rgba(51, 52, 49, 0.75)', fontFamily: Fonts?.serif }]}>
              Permissions are an iOS thing. Tap continue.
            </Text>
          </View>
        ) : (
          cards.map((c) => (
            <Pressable
              key={c.id}
              onPress={c.granted ? undefined : c.onPress}
              disabled={c.granted}
              style={[styles.card, { backgroundColor: c.cardBg }, c.granted && styles.cardGranted]}
            >
              <View style={[styles.iconWrap, { backgroundColor: theme.bg }]}>
                <Feather name={c.icon} size={20} color={palette.brown} />
              </View>
              <View style={styles.textCol}>
                <Text style={[styles.title, { color: palette.brown, fontFamily: Fonts?.serif }]}>
                  {c.title}
                </Text>
                <Text style={[styles.body, { color: 'rgba(51, 52, 49, 0.75)', fontFamily: Fonts?.serif }]}>
                  {c.body}
                </Text>
              </View>
              {c.granted ? (
                <View style={styles.checkWrap}>
                  <Feather name="check" size={18} color={palette.brown} />
                </View>
              ) : (
                <Feather name="chevron-right" size={18} color="rgba(51, 52, 49, 0.55)" />
              )}
            </Pressable>
          ))
        )}

        <Text style={[styles.footnote, { color: theme.text, fontFamily: Fonts?.serif }]}>
          You can change these any time in Settings.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 110,
    paddingBottom: 140,
  },
  heading: {
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: -0.4,
    lineHeight: 38,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '300',
    lineHeight: 24,
    marginBottom: 32,
    opacity: 0.75,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    gap: 14,
  },
  cardGranted: {
    opacity: 0.55,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  body: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: 0.15,
  },
  checkWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footnote: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
    textAlign: 'center',
    opacity: 0.6,
  },
});

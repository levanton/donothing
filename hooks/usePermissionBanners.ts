import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { haptics } from '@/lib/haptics';
import { getAuth, requestAuth, type AuthStatus } from '@/lib/screen-time';

type NotifStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Settings banners for the two iOS permissions the app actually needs:
 * - Notifications (so scheduled blocks fire alerts)
 * - Screen Time / FamilyControls (so the shield can be raised)
 *
 * Each banner fades in only when its permission is missing, taps deep-link
 * to system Settings (or trigger the in-app prompt for `undetermined`).
 * AppState 'active' transitions re-poll both, so flipping the toggle in
 * Settings.app and coming back updates the banner without a restart.
 */
export function usePermissionBanners() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('notDetermined');
  const [notifStatus, setNotifStatus] = useState<NotifStatus | null>(null);

  const notifBannerOpacity = useSharedValue(0);
  const notifBannerY = useSharedValue(10);
  const stBannerOpacity = useSharedValue(0);
  const stBannerY = useSharedValue(10);

  const checkNotifStatus = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === 'granted') setNotifStatus('granted');
      else if (status === 'denied') setNotifStatus('denied');
      else setNotifStatus('undetermined');
    } catch {}
  }, []);

  const checkAuthStatus = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    try {
      const s = await getAuth();
      setAuthStatus(s);
    } catch {}
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    checkAuthStatus();
    checkNotifStatus();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        checkNotifStatus();
        checkAuthStatus();
      }
    });
    return () => sub.remove();
  }, [checkNotifStatus, checkAuthStatus]);

  // Fade each banner in once we know the user hasn't granted that permission
  useEffect(() => {
    if (notifStatus === 'denied' || notifStatus === 'undetermined') {
      notifBannerOpacity.value = withDelay(120, withTiming(1, { duration: 550, easing: Easing.out(Easing.ease) }));
      notifBannerY.value = withDelay(120, withTiming(0, { duration: 550, easing: Easing.out(Easing.ease) }));
    } else {
      notifBannerOpacity.value = 0;
      notifBannerY.value = 10;
    }
  }, [notifStatus]);

  useEffect(() => {
    if (authStatus === 'denied' || authStatus === 'notDetermined') {
      stBannerOpacity.value = withDelay(180, withTiming(1, { duration: 550, easing: Easing.out(Easing.ease) }));
      stBannerY.value = withDelay(180, withTiming(0, { duration: 550, easing: Easing.out(Easing.ease) }));
    } else {
      stBannerOpacity.value = 0;
      stBannerY.value = 10;
    }
  }, [authStatus]);

  const notifBannerStyle = useAnimatedStyle(() => ({
    opacity: notifBannerOpacity.value,
    transform: [{ translateY: notifBannerY.value }],
  }));
  const stBannerStyle = useAnimatedStyle(() => ({
    opacity: stBannerOpacity.value,
    transform: [{ translateY: stBannerY.value }],
  }));

  const handleNotifTap = useCallback(async () => {
    haptics.select();
    if (notifStatus === 'undetermined') {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        setNotifStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined');
      } catch {}
    } else if (notifStatus === 'denied') {
      try { await Linking.openSettings(); } catch {}
    }
  }, [notifStatus]);

  const handleScreenTimeBannerTap = useCallback(async () => {
    haptics.select();
    if (authStatus === 'denied') {
      try { await Linking.openSettings(); } catch {}
    } else {
      const status = await requestAuth();
      setAuthStatus(status);
    }
  }, [authStatus]);

  return {
    authStatus,
    notifStatus,
    notifBannerStyle,
    stBannerStyle,
    handleNotifTap,
    handleScreenTimeBannerTap,
  };
}

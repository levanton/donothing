import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type BottomSheet from '@gorhom/bottom-sheet';
import PickerSheet from '@/components/PickerSheet';
import {
  activitySelectionMetadata,
} from 'react-native-device-activity';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import AppLabelsView from 'app-labels';
import AppPickerSheet from '@/components/AppPickerSheet';

import { Fonts } from '@/constants/theme';
import { themes, palette, CARD_BORDER_WIDTH } from '@/lib/theme';
import { useAppStore } from '@/lib/store';
import type { ScheduledBlock } from '@/lib/db/types';
import { getAuth, requestAuth, type AuthStatus } from '@/lib/screen-time';
import PillButton from '@/components/PillButton';
import { formatTime12, WEEKDAY_VALUES, WEEKDAY_SHORT } from '@/components/TimePicker';
import BlockPickerContent from '@/components/BlockPicker';
import AlertModal from '@/components/AlertModal';

interface PendingBlockParams {
  hour: number;
  minute: number;
  duration: number;
  weekdays: number[];
  groupId: string | null;
  unlockGoalMinutes: number;
  conflictTime?: string | null;
}

const NEVER_BLOCK_SELECTION_ID = 'donothing-never-block';

function countFromMeta(meta: {
  applicationCount?: number;
  categoryCount?: number;
  webDomainCount?: number;
} | null | undefined): number {
  return (meta?.applicationCount ?? 0) + (meta?.categoryCount ?? 0) + (meta?.webDomainCount ?? 0);
}

interface SettingsContentProps {
  onClose: () => void;
  insets: { top: number; bottom: number };
}

export default function SettingsContent({ onClose, insets }: SettingsContentProps) {
  const themeMode = useAppStore((s) => s.themeMode);
  const scheduledBlocks = useAppStore((s) => s.scheduledBlocks);
  const theme = themes[themeMode];

  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ScheduledBlock | null>(null);
  const [showNeverBlockPicker, setShowNeverBlockPicker] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('notDetermined');

  // iOS notification permission — banner appears when not granted
  type NotifStatus = 'granted' | 'denied' | 'undetermined';
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
    Haptics.selectionAsync();
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
    Haptics.selectionAsync();
    if (authStatus === 'denied') {
      try { await Linking.openSettings(); } catch {}
    } else {
      const status = await requestAuth();
      setAuthStatus(status);
    }
  }, [authStatus]);

  const readCount = (id: string) => {
    if (Platform.OS !== 'ios') return 0;
    try {
      const meta = activitySelectionMetadata({ activitySelectionId: id });
      return countFromMeta(meta);
    } catch { return 0; }
  };

  const [neverBlockCount, setNeverBlockCount] = useState(() => readCount(NEVER_BLOCK_SELECTION_ID));

  const blockSheetRef = useRef<BottomSheet>(null);

  const store = useAppStore.getState;

  const [pendingBlock, setPendingBlock] = useState<PendingBlockParams | null>(null);

  const commitBlock = (p: PendingBlockParams) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (editingBlock) {
      store().editScheduledBlock(editingBlock.id, p.hour, p.minute, p.duration, p.weekdays, p.groupId, p.unlockGoalMinutes);
    } else {
      store().addScheduledBlock(p.hour, p.minute, p.duration, p.weekdays, p.groupId, p.unlockGoalMinutes);
    }
    blockSheetRef.current?.close();
  };

  const handleConfirmBlock = (hour: number, minute: number, duration: number, weekdays: number[], groupId: string | null, unlockGoalMinutes: number) => {
    const params: PendingBlockParams = { hour, minute, duration, weekdays, groupId, unlockGoalMinutes };
    const startMin = hour * 60 + minute;

    // Reject blocks sitting within an hour of an existing one (wall-clock,
    // circular over 24h). Catches duplicates and near-duplicates.
    let conflictTime: string | null = null;
    for (const b of scheduledBlocks) {
      if (editingBlock && editingBlock.id === b.id) continue;
      const otherMin = b.hour * 60 + b.minute;
      const d = Math.abs(startMin - otherMin);
      const circular = Math.min(d, 24 * 60 - d);
      if (circular < 60) {
        conflictTime = formatTime12(b.hour, b.minute);
        break;
      }
    }

    if (conflictTime) {
      setPendingBlock({ ...params, conflictTime });
      return;
    }
    commitBlock(params);
  };

  return (
    <>
    <ScrollView
      style={{ flex: 1 }}
      bounces={false}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 40,
      }}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={onClose} hitSlop={16} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>{'\u2715'}</Text>
        </Pressable>
      </View>

      {/* Notification permission banner — shown first so it's impossible to miss */}
      {Platform.OS === 'ios' && (notifStatus === 'denied' || notifStatus === 'undetermined') && (
        <Animated.View style={notifBannerStyle}>
          <Pressable
            onPress={handleNotifTap}
            style={[
              styles.notifBanner,
              {
                backgroundColor: 'rgba(232, 169, 154, 0.6)',
                marginBottom: (authStatus === 'denied' || authStatus === 'notDetermined') ? 12 : 28,
              },
            ]}
          >
            <View style={[styles.notifIconWrap, { backgroundColor: 'rgba(232, 169, 154, 0.9)' }]}>
              <Feather name="bell-off" size={18} color={theme.text} />
            </View>
            <View style={styles.notifText}>
              <Text style={[styles.notifTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
                {notifStatus === 'denied' ? 'Notifications are off' : 'Enable notifications'}
              </Text>
              <Text style={[styles.notifSub, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
                {notifStatus === 'denied'
                  ? "We can't remind you about blocks or session ends. Tap to turn them on."
                  : "So we can gently remind you about scheduled blocks and session ends."}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>
      )}

      {/* Screen Time permission banner — amber-tinted to differ from notif salmon */}
      {Platform.OS === 'ios' && (authStatus === 'denied' || authStatus === 'notDetermined') && (
        <Animated.View style={stBannerStyle}>
          <Pressable
            onPress={handleScreenTimeBannerTap}
            style={[styles.notifBanner, { backgroundColor: 'rgba(224, 166, 83, 0.55)' }]}
          >
            <View style={[styles.notifIconWrap, { backgroundColor: 'rgba(224, 166, 83, 0.9)' }]}>
              <Feather name="smartphone" size={18} color={theme.text} />
            </View>
            <View style={styles.notifText}>
              <Text style={[styles.notifTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
                {authStatus === 'denied' ? 'Screen Time access is off' : 'Enable Screen Time access'}
              </Text>
              <Text style={[styles.notifSub, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
                {authStatus === 'denied'
                  ? "Without it we can't block or unblock apps for you. Tap to turn it on."
                  : "We need it to schedule app blocks. Tap to grant access."}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </Pressable>
        </Animated.View>
      )}

      {/* Screen block */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderText}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
            Screen block
          </Text>
          <Text style={[styles.sectionHint, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
            Block all apps at a set time, unlock by doing nothing
          </Text>
        </View>
      </View>
      {scheduledBlocks.length === 0 && (
        <View style={[styles.emptyCard, { borderColor: theme.textTertiary }]}>
          <Feather name="smartphone" size={22} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
            No scheduled blocks yet
          </Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
            Schedule time to block distractions
          </Text>
        </View>
      )}
      {scheduledBlocks.map((b) => {
        const active = b.enabled;
        return (
          <Pressable
            key={b.id}
            onPress={() => {
              Haptics.selectionAsync();
              setEditingBlock(b);
              blockSheetRef.current?.expand();
            }}
            style={[styles.card, {
              borderColor: active ? theme.accent : theme.text,
            }]}
          >
            <View style={styles.cardContent}>
              <Text style={[styles.cardTime, { color: active ? theme.accent : theme.text, fontFamily: Fonts!.mono }]}>
                {formatTime12(b.hour, b.minute)}
              </Text>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
                <Text style={{ fontFamily: Fonts!.mono, fontWeight: '600', fontStyle: 'normal', color: theme.text }}>
                  {b.unlockGoalMinutes} min
                </Text>
                {' nothing to unlock'}
              </Text>
              <View style={styles.cardDays}>
                {WEEKDAY_VALUES.map((day, i) => {
                  const dayActive = !b.weekdays?.length || b.weekdays.includes(day);
                  return (
                    <View key={day} style={styles.cardDayCol}>
                      <View style={[styles.cardDot, {
                        backgroundColor: dayActive ? theme.text : 'transparent',
                        borderColor: dayActive ? theme.text : theme.textTertiary,
                      }]} />
                      <Text style={[styles.cardDayText, { color: dayActive ? theme.text : theme.textTertiary }]}>
                        {WEEKDAY_SHORT[i]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={styles.cardActions}>
              <Switch
                value={active}
                onValueChange={() => {
                  Haptics.selectionAsync();
                  store().toggleScheduledBlock(b.id);
                }}
                trackColor={{ false: theme.textTertiary, true: theme.accent }}
                thumbColor={palette.white}
                ios_backgroundColor={active ? theme.accent : theme.textTertiary}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  store().removeScheduledBlock(b.id);
                }}
                hitSlop={12}
              >
                <Feather name="x" size={16} color={theme.textTertiary} />
              </Pressable>
            </View>
          </Pressable>
        );
      })}
      <PillButton
        label="+ add block"
        color={theme.text}
        variant="outline"
        size="small"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setEditingBlock(null);
          setShowBlockPicker(true);
          blockSheetRef.current?.expand();
        }}
      />

      {/* Always allowed */}
      {Platform.OS === 'ios' && (
        <>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
                Always allowed
              </Text>
              <Text style={[styles.sectionHint, { color: theme.textSecondary, fontFamily: Fonts!.serif }]}>
                These stay unlocked during any block
              </Text>
            </View>
            {neverBlockCount > 0 && (
              <Pressable
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  const status = await requestAuth();
                  if (status === 'approved') setShowNeverBlockPicker(true);
                }}
                hitSlop={10}
                style={[styles.changeChip, { borderColor: theme.text }]}
              >
                <Feather name="edit-2" size={12} color={theme.text} />
                <Text style={[styles.changeChipLabel, { color: theme.text }]}>edit</Text>
              </Pressable>
            )}
          </View>
          {neverBlockCount > 0 ? (
            <View
              style={{
                height: 240,
                borderWidth: 1,
                borderColor: theme.border,
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              <AppLabelsView
                activitySelectionId={NEVER_BLOCK_SELECTION_ID}
                iconSize={44}
                layout="list"
                tintColor={theme.text}
                ringColor={theme.bg}
                style={{ flex: 1 }}
              />
            </View>
          ) : (
            <Pressable
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const status = await requestAuth();
                if (status === 'approved') setShowNeverBlockPicker(true);
              }}
              style={[styles.allowEmpty, { borderColor: theme.textTertiary }]}
            >
              <View style={[styles.allowEmptyIcon, { backgroundColor: theme.border }]}>
                <Feather name="plus" size={20} color={theme.textSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.allowEmptyTitle, { color: theme.text, fontFamily: Fonts!.serif }]}>
                  Allow some apps
                </Text>
                <Text style={[styles.allowEmptySub, { color: theme.textTertiary }]}>
                  Pick apps that stay usable while blocking
                </Text>
              </View>
            </Pressable>
          )}
        </>
      )}
    </ScrollView>

    {/* Bottom sheet for block picker */}
    <PickerSheet
      ref={blockSheetRef}
      theme={theme}
      onDismiss={() => { setShowBlockPicker(false); setEditingBlock(null); }}
    >
      <BlockPickerContent
        key={editingBlock?.id ?? 'new'}
        theme={theme}
        title={editingBlock ? 'Edit screen block' : 'Add screen block'}
        initialHour={editingBlock?.hour}
        initialMinute={editingBlock?.minute}
        initialDays={editingBlock?.weekdays}
        initialUnlockGoal={editingBlock?.unlockGoalMinutes}
        onConfirm={handleConfirmBlock}
        onCancel={() => blockSheetRef.current?.close()}
      />
    </PickerSheet>

    {/* Inter-block spacing warning — blocking (no override) */}
    <AlertModal
      visible={pendingBlock !== null}
      theme={theme}
      icon="clock"
      title="Too close to another block"
      message={
        pendingBlock?.conflictTime
          ? `You already have a block at ${pendingBlock.conflictTime}. Blocks must be at least an hour apart.`
          : ''
      }
      closeLabel="got it"
      onClose={() => setPendingBlock(null)}
    />

    {/* App picker: never-block */}
    <AppPickerSheet
      theme={theme}
      selectionId={showNeverBlockPicker ? NEVER_BLOCK_SELECTION_ID : null}
      title="Never block"
      onClose={() => {
        try {
          const meta = activitySelectionMetadata({ activitySelectionId: NEVER_BLOCK_SELECTION_ID });
          setNeverBlockCount(countFromMeta(meta));
        } catch {}
        setShowNeverBlockPicker(false);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '400', letterSpacing: 0.5 },
  closeButton: { padding: 4 },
  closeText: { fontSize: 20, fontWeight: '300' },

  notifBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 28,
    gap: 14,
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifText: { flex: 1 },
  notifTitle: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  notifSub: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    letterSpacing: 0.15,
  },

  sectionTitle: { fontSize: 24, fontWeight: '400' },
  sectionHint: { fontSize: 14, fontWeight: '300', fontStyle: 'italic' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  sectionHeaderText: { flex: 1, gap: 4 },

  // Card style for reminders & blocks
  card: {
    borderWidth: CARD_BORDER_WIDTH,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: { gap: 4 },
  cardTime: { fontSize: 28, fontWeight: '500' },
  cardLabel: { fontSize: 14, fontWeight: '300' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },


  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 4,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: CARD_BORDER_WIDTH,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  labelGrid: {
    width: '100%',
    marginTop: 4,
    marginBottom: 8,
  },
  allowEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: CARD_BORDER_WIDTH,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  allowEmptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allowEmptyTitle: {
    fontSize: 17,
    fontWeight: '400',
  },
  allowEmptySub: {
    fontSize: 12,
    fontWeight: '300',
    fontStyle: 'italic',
    marginTop: 2,
  },
  changeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  changeChipLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  groupSub: {
    fontSize: 12,
    fontWeight: '300',
    fontStyle: 'italic',
    marginTop: 2,
  },
  blockTextCol: {
    flex: 1,
    gap: 2,
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: '300',
  },
  blockSub: {
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
  },

  divider: { height: StyleSheet.hairlineWidth, marginVertical: 36 },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 18,
    marginBottom: 10,
    alignItems: 'center',
    gap: 6,
    opacity: 0.85,
  },
  emptyTitle: { fontSize: 15, fontWeight: '400' },
  emptySub: { fontSize: 12, fontWeight: '300', fontStyle: 'italic' },

  cardDays: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 8,
  },
  cardDayCol: {
    alignItems: 'center',
    gap: 3,
  },
  cardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
  },
  cardDayText: {
    fontSize: 11,
    fontWeight: '400',
  },
});

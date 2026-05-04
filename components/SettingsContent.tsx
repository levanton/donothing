import { useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type BottomSheet from '@gorhom/bottom-sheet';
import PickerSheet from '@/components/PickerSheet';
import { activitySelectionMetadata } from 'react-native-device-activity';
import { Feather } from '@expo/vector-icons';
import { haptics } from '@/lib/haptics';
import AppLabelsView from 'app-labels';
import AppPickerSheet from '@/components/AppPickerSheet';

import { Fonts } from '@/constants/theme';
import { themes, palette, CARD_BORDER_WIDTH } from '@/lib/theme';
import { useAppStore } from '@/lib/store';
import { usePermissionBanners } from '@/hooks/usePermissionBanners';
import { requestAuth, NEVER_BLOCK_SELECTION_ID } from '@/lib/screen-time';
import type { ScheduledBlock } from '@/lib/db/types';
import PillButton from '@/components/PillButton';
import { formatTime12, WEEKDAY_VALUES, WEEKDAY_SHORT } from '@/components/TimePicker';
import BlockPickerContent from '@/components/BlockPicker';
import AlertModal from '@/components/AlertModal';
import { findBlockConflict, MIN_BLOCK_GAP_LABEL } from '@/lib/block-conflict';
import { TutorialStepWrapper } from '@/components/tutorial';

interface PendingBlockParams {
  hour: number;
  minute: number;
  duration: number;
  weekdays: number[];
  unlockGoalMinutes: number;
  conflictTime?: string | null;
}

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
  onOpenAccount: () => void;
}

export default function SettingsContent({ onClose, insets, onOpenAccount }: SettingsContentProps) {
  const themeMode = useAppStore((s) => s.themeMode);
  const scheduledBlocks = useAppStore((s) => s.scheduledBlocks);
  const theme = themes[themeMode];
  const isDark = themeMode === 'dark';

  const [editingBlock, setEditingBlock] = useState<ScheduledBlock | null>(null);
  const [showNeverBlockPicker, setShowNeverBlockPicker] = useState(false);

  const {
    authStatus,
    notifStatus,
    notifBannerStyle,
    stBannerStyle,
    handleNotifTap,
    handleScreenTimeBannerTap,
  } = usePermissionBanners();

  const readCount = (id: string) => {
    if (Platform.OS !== 'ios') return 0;
    try {
      const meta = activitySelectionMetadata({ activitySelectionId: id });
      return countFromMeta(meta);
    } catch { return 0; }
  };

  const [neverBlockCount, setNeverBlockCount] = useState(() => readCount(NEVER_BLOCK_SELECTION_ID));

  const blockSheetRef = useRef<BottomSheet>(null);

  const handleOpenAccount = () => {
    haptics.select();
    onOpenAccount();
  };

  const store = useAppStore.getState;

  const [pendingBlock, setPendingBlock] = useState<PendingBlockParams | null>(null);

  const commitBlock = (p: PendingBlockParams) => {
    haptics.light();
    const op = editingBlock
      ? store().editScheduledBlock(editingBlock.id, p.hour, p.minute, p.duration, p.weekdays, p.unlockGoalMinutes)
      : store().addScheduledBlock(p.hour, p.minute, p.duration, p.weekdays, p.unlockGoalMinutes);
    op.catch((e) => {
      // editScheduledBlock rolls back on native fail and rethrows. Surface
      // it to the user so they don't think the change took effect.
      console.error('[Settings] commitBlock failed:', e);
      Alert.alert(
        'Could not update block',
        'Check Screen Time permissions and try again.',
      );
    });
    blockSheetRef.current?.close();
  };

  const handleConfirmBlock = (hour: number, minute: number, duration: number, weekdays: number[], unlockGoalMinutes: number) => {
    const params: PendingBlockParams = { hour, minute, duration, weekdays, unlockGoalMinutes };
    const conflictTime = findBlockConflict(scheduledBlocks, hour, minute, editingBlock?.id);
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
        <PillButton
          label="My account"
          onPress={handleOpenAccount}
          color={theme.text}
          variant="outline"
          size="small"
          style={{
            alignSelf: 'flex-start',
            borderWidth: 1.2,
            paddingVertical: 6,
            paddingHorizontal: 14,
          }}
        />
        <Pressable onPress={onClose} hitSlop={16} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>{'\u2715'}</Text>
        </Pressable>
      </View>

      {/* Notification permission banner — shown first so it's impossible to miss.
          Banner is its own warm chip regardless of theme: saturated peach/amber
          background with dark text so it stays readable on cream AND charcoal. */}
      {Platform.OS === 'ios' && (notifStatus === 'denied' || notifStatus === 'undetermined') && (
        <Animated.View style={notifBannerStyle}>
          <Pressable
            onPress={handleNotifTap}
            style={[
              styles.notifBanner,
              {
                backgroundColor: isDark ? 'rgba(232, 169, 154, 0.95)' : 'rgba(232, 169, 154, 0.6)',
                marginBottom: (authStatus === 'denied' || authStatus === 'notDetermined') ? 12 : 28,
              },
            ]}
          >
            <View style={[styles.notifIconWrap, { backgroundColor: palette.white }]}>
              <Feather name="bell-off" size={18} color={palette.brown} />
            </View>
            <View style={styles.notifText}>
              <Text style={[styles.notifTitle, { color: palette.brown, fontFamily: Fonts!.serif }]}>
                {notifStatus === 'denied' ? 'Notifications are off' : 'Enable notifications'}
              </Text>
              <Text style={[styles.notifSub, { color: 'rgba(51, 52, 49, 0.75)', fontFamily: Fonts!.serif }]}>
                {notifStatus === 'denied'
                  ? "We can't remind you about blocks or session ends. Tap to turn them on."
                  : "So we can gently remind you about scheduled blocks and session ends."}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="rgba(51, 52, 49, 0.55)" />
          </Pressable>
        </Animated.View>
      )}

      {/* Screen Time permission banner — amber-tinted to differ from notif salmon */}
      {Platform.OS === 'ios' && (authStatus === 'denied' || authStatus === 'notDetermined') && (
        <Animated.View style={stBannerStyle}>
          <Pressable
            onPress={handleScreenTimeBannerTap}
            style={[
              styles.notifBanner,
              { backgroundColor: isDark ? 'rgba(224, 166, 83, 0.95)' : 'rgba(224, 166, 83, 0.55)' },
            ]}
          >
            <View style={[styles.notifIconWrap, { backgroundColor: palette.white }]}>
              <Feather name="smartphone" size={18} color={palette.brown} />
            </View>
            <View style={styles.notifText}>
              <Text style={[styles.notifTitle, { color: palette.brown, fontFamily: Fonts!.serif }]}>
                {authStatus === 'denied' ? 'Screen Time access is off' : 'Enable Screen Time access'}
              </Text>
              <Text style={[styles.notifSub, { color: 'rgba(51, 52, 49, 0.75)', fontFamily: Fonts!.serif }]}>
                {authStatus === 'denied'
                  ? "Without it we can't block or unblock apps for you. Tap to turn it on."
                  : "We need it to schedule app blocks. Tap to grant access."}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="rgba(51, 52, 49, 0.55)" />
          </Pressable>
        </Animated.View>
      )}

      {/* Screen block + Always allowed — gated behind iOS Screen Time and
          Notifications permissions. When either is missing the whole block
          reads as inactive and rejects touches until the banners above are
          dismissed by granting access. */}
      <View
        pointerEvents={
          Platform.OS === 'ios' && (authStatus !== 'approved' || notifStatus !== 'granted')
            ? 'none'
            : 'auto'
        }
        style={{
          opacity:
            Platform.OS === 'ios' && (authStatus !== 'approved' || notifStatus !== 'granted')
              ? 0.4
              : 1,
        }}
      >
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
              haptics.select();
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
                {' nothing'}
              </Text>
              <View style={styles.cardDays}>
                {WEEKDAY_VALUES.map((day, i) => {
                  const dayActive = b.weekdays.includes(day);
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
                  haptics.select();
                  store().toggleScheduledBlock(b.id);
                }}
                trackColor={{ false: theme.textTertiary, true: theme.accent }}
                thumbColor={palette.white}
                ios_backgroundColor={active ? theme.accent : theme.textTertiary}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
              <Pressable
                onPress={() => {
                  haptics.light();
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
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <PillButton
          label="+ add block"
          color={theme.text}
          variant="outline"
          size="small"
          onPress={() => {
            haptics.light();
            setEditingBlock(null);
            blockSheetRef.current?.expand();
          }}
        />
      </View>

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
                  haptics.light();
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
          <TutorialStepWrapper name="settings.allowed">
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
                  haptics.light();
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
          </TutorialStepWrapper>
        </>
      )}
      </View>
    </ScrollView>

    {/* Bottom sheet for block picker */}
    <PickerSheet
      ref={blockSheetRef}
      theme={theme}
      onDismiss={() => { setEditingBlock(null); }}
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
          ? `You already have a block at ${pendingBlock.conflictTime}. Blocks must be at least ${MIN_BLOCK_GAP_LABEL} apart.`
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
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

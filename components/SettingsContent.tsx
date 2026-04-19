import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import type BottomSheet from '@gorhom/bottom-sheet';
import PickerSheet from '@/components/PickerSheet';
import {
  activitySelectionMetadata,
} from 'react-native-device-activity';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
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

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    getAuth().then(setAuthStatus).catch(() => {});
  }, []);

  const handleAuthTap = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const status = await requestAuth();
    setAuthStatus(status);
  };

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

  const handleConfirmBlock = (hour: number, minute: number, duration: number, weekdays: number[], groupId: string | null, unlockGoalMinutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (editingBlock) {
      store().editScheduledBlock(editingBlock.id, hour, minute, duration, weekdays, groupId, unlockGoalMinutes);
    } else {
      store().addScheduledBlock(hour, minute, duration, weekdays, groupId, unlockGoalMinutes);
    }
    blockSheetRef.current?.close();
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
        {Platform.OS === 'ios' && (
          <Pressable
            onPress={handleAuthTap}
            disabled={authStatus === 'approved'}
            hitSlop={8}
            style={[styles.authLock, authStatus === 'approved'
              ? { backgroundColor: theme.accent, borderColor: theme.accent }
              : { backgroundColor: 'transparent', borderColor: theme.text },
            ]}
          >
            <Feather
              name="lock"
              size={18}
              color={authStatus === 'approved' ? theme.accentText : theme.text}
            />
          </Pressable>
        )}
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
                {'goal '}
                <Text style={{ fontFamily: Fonts!.mono, fontWeight: '600', fontStyle: 'normal', color: theme.text }}>
                  {b.unlockGoalMinutes} min
                </Text>
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
                style={[styles.changeChip, { borderColor: theme.accent }]}
              >
                <Feather name="edit-2" size={11} color={theme.accent} />
                <Text style={[styles.changeChipLabel, { color: theme.accent }]}>edit</Text>
              </Pressable>
            )}
          </View>
          {neverBlockCount > 0 ? (
            <View
              style={{
                height: 360,
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
  cardLabel: { fontSize: 14, fontWeight: '300', fontStyle: 'italic' },
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
    gap: 4,
    borderWidth: 1.2,
    borderRadius: 100,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  changeChipLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  authLock: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
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

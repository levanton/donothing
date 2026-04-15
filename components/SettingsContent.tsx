import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type BottomSheet from '@gorhom/bottom-sheet';
import PickerSheet from '@/components/PickerSheet';
import {
  activitySelectionMetadata,
  getFamilyActivitySelectionId,
  setFamilyActivitySelectionId,
} from 'react-native-device-activity';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AppLabelsView from 'app-labels';
import AppPickerSheet from '@/components/AppPickerSheet';

import { Fonts } from '@/constants/theme';
import { AppTheme, themes, palette } from '@/lib/theme';
import GoalSliderBar from './GoalSliderBar';
import GoalWheel from './GoalWheel';
import { useAppStore } from '@/lib/store';
import type { Reminder, ScheduledBlock, BlockGroup } from '@/lib/db/types';
import { getAuth, requestAuth, type AuthStatus } from '@/lib/screen-time';
import PillButton from '@/components/PillButton';
import ReminderCard from '@/components/ReminderCard';
import TimePickerContent, { formatTime12, WEEKDAY_LABELS, WEEKDAY_VALUES, WEEKDAY_SHORT, ALL_DAYS } from '@/components/TimePicker';
import BlockPickerContent from '@/components/BlockPicker';

const BLOCK_SELECTION_ID = 'donothing-scheduled-block';
const NEVER_BLOCK_SELECTION_ID = 'donothing-never-block';
const DRAFT_GROUP_ID = '__draft';

interface SettingsContentProps {
  onClose: () => void;
  insets: { top: number; bottom: number };
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function GroupEditorContent({
  theme,
  group,
  initialName,
  hasApps,
  onSave,
  onDelete,
  onCancel,
  onOpenPicker,
}: {
  theme: AppTheme;
  group: BlockGroup;
  initialName: string;
  hasApps: boolean;
  onSave: (name: string) => void;
  onDelete: () => void;
  onCancel: () => void;
  onOpenPicker: () => void;
}) {
  const [name, setName] = useState(initialName);
  return (
    <View style={styles.editorContent}>
      <View style={styles.editorHeader}>
        <Text style={[styles.sheetTitle, { color: theme.text, fontFamily: Fonts!.serif, flex: 1, textAlign: 'left', marginBottom: 0 }]}>
          {initialName ? 'Edit list' : 'New list'}
        </Text>
        {initialName ? (
          <Pressable
            onPress={onDelete}
            hitSlop={10}
            style={[styles.deleteIconBtn, { backgroundColor: palette.terracotta }]}
          >
            <Feather name="trash-2" size={16} color={palette.cream} />
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.sheetFieldLabel, { color: theme.textTertiary, marginTop: 8 }]}>NAME</Text>
      <BottomSheetTextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Social, Games"
        placeholderTextColor={theme.textTertiary}
        style={[styles.nameInput, {
          color: theme.text,
          borderColor: theme.border,
          fontFamily: Fonts!.serif,
        }]}
        maxLength={40}
        returnKeyType="done"
      />

      <View style={styles.editorRow}>
        <Text style={[styles.sheetFieldLabel, { color: theme.textTertiary }]}>APPS</Text>
        {hasApps && (
          <Pressable
            onPress={onOpenPicker}
            hitSlop={8}
            style={[styles.editorEditBtn, { borderColor: theme.accent }]}
          >
            <Feather name="edit-2" size={12} color={theme.accent} />
            <Text style={[styles.editorEditLabel, { color: theme.accent }]}>change</Text>
          </Pressable>
        )}
      </View>

      {hasApps ? (
        <View style={[styles.editorGridWrap, { borderColor: theme.border }]}>
          <AppLabelsView
            activitySelectionId={`donothing-group-${group.id}`}
            iconSize={28}
            layout="list"
            tintColor={theme.text}
            ringColor={theme.bg}
            style={styles.editorGrid}
          />
        </View>
      ) : (
        <Pressable
          onPress={onOpenPicker}
          style={[styles.editorEmpty, { borderColor: theme.textTertiary }]}
        >
          <Feather name="plus-circle" size={22} color={theme.textSecondary} />
          <Text style={[styles.editorEmptyLabel, { color: theme.textSecondary }]}>
            Choose apps to block
          </Text>
        </Pressable>
      )}

      <View style={{ height: 20 }} />
      <View style={styles.sheetButtons}>
        <PillButton label="cancel" onPress={onCancel} color={theme.textSecondary} outline flex />
        <PillButton label="save" onPress={() => onSave(name.trim() || initialName)} color={theme.accent} filled flex />
      </View>
    </View>
  );
}

export default function SettingsContent({ onClose, insets }: SettingsContentProps) {
  const themeMode = useAppStore((s) => s.themeMode);
  const dailyGoalMinutes = useAppStore((s) => s.dailyGoalMinutes);
  const reminders = useAppStore((s) => s.reminders);
  const scheduledBlocks = useAppStore((s) => s.scheduledBlocks);
  const blockGroups = useAppStore((s) => s.blockGroups);
  const theme = themes[themeMode];

  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [editingBlock, setEditingBlock] = useState<ScheduledBlock | null>(null);
  const [pickerGroupId, setPickerGroupId] = useState<string | null>(null);
  const [showNeverBlockPicker, setShowNeverBlockPicker] = useState(false);
  const [editingGroup, setEditingGroup] = useState<BlockGroup | null>(null);
  const [createdFresh, setCreatedFresh] = useState(false);
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
      return (meta?.applicationCount ?? 0) + (meta?.categoryCount ?? 0);
    } catch { return 0; }
  };

  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [neverBlockCount, setNeverBlockCount] = useState(() => readCount(NEVER_BLOCK_SELECTION_ID));

  // Refresh counts for all groups whenever the list changes
  useEffect(() => {
    const next: Record<string, number> = {};
    for (const g of blockGroups) {
      next[g.id] = readCount(`donothing-group-${g.id}`);
    }
    setGroupCounts(next);
  }, [blockGroups]);

  const reminderSheetRef = useRef<BottomSheet>(null);
  const blockSheetRef = useRef<BottomSheet>(null);
  const groupSheetRef = useRef<BottomSheet>(null);


  const store = useAppStore.getState;

  const handleGoalChange = (minutes: number) => {
    store().setDailyGoal(minutes);
  };

  const handleConfirmReminder = (hour: number, minute: number, weekdays: number[]) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (editingReminder) {
      store().editReminder(editingReminder.id, hour, minute, weekdays);
    } else {
      store().addReminder(hour, minute, weekdays);
    }
    reminderSheetRef.current?.close();
  };

  const handleConfirmBlock = (hour: number, minute: number, duration: number, weekdays: number[], groupId: string | null, unlockGoalMinutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (editingBlock) {
      store().editScheduledBlock(editingBlock.id, hour, minute, duration, weekdays, groupId, unlockGoalMinutes);
    } else {
      store().addScheduledBlock(hour, minute, duration, weekdays, groupId, unlockGoalMinutes);
    }
    blockSheetRef.current?.close();
  };

  const handleAddGroup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const status = await requestAuth();
    if (status !== 'approved') return;
    // Don't touch the DB yet — user may cancel. Use an in-memory draft that
    // will be materialized on Save.
    // Clear any lingering selection under the draft id from a previous draft.
    try {
      setFamilyActivitySelectionId({
        id: `donothing-group-${DRAFT_GROUP_ID}`,
        familyActivitySelection: '',
      });
    } catch {}
    setGroupCounts((prev) => ({ ...prev, [DRAFT_GROUP_ID]: 0 }));
    setEditingGroup({ id: DRAFT_GROUP_ID, name: '' });
    setCreatedFresh(true);
    groupSheetRef.current?.expand();
  };

  const handleOpenGroup = async (g: BlockGroup) => {
    Haptics.selectionAsync();
    setEditingGroup(g);
    setCreatedFresh(false);
    groupSheetRef.current?.expand();
  };

  const handlePickerDismiss = (_groupId: string) => {
    // Picker closes; editor stays underneath. Discard-on-empty is handled
    // by the editor sheet's own onDismiss when the user actually closes it.
    setPickerGroupId(null);
  };

  const handleSaveGroup = (name: string) => {
    if (!editingGroup) {
      groupSheetRef.current?.close();
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      // Empty name = cancel. If it was an existing group, don't touch it.
      // If it was a draft, nothing to clean up (never persisted to DB).
      groupSheetRef.current?.close();
      return;
    }

    if (editingGroup.id === DRAFT_GROUP_ID) {
      // Materialize the draft: create real DB row, migrate selection.
      const real = store().addBlockGroup(trimmed);
      try {
        const draftSelection = getFamilyActivitySelectionId(
          `donothing-group-${DRAFT_GROUP_ID}`,
        );
        if (draftSelection) {
          setFamilyActivitySelectionId({
            id: `donothing-group-${real.id}`,
            familyActivitySelection: draftSelection,
          });
          // Copy count too so the card preview shows immediately.
          setGroupCounts((prev) => ({
            ...prev,
            [real.id]: prev[DRAFT_GROUP_ID] ?? 0,
          }));
        }
        setFamilyActivitySelectionId({
          id: `donothing-group-${DRAFT_GROUP_ID}`,
          familyActivitySelection: '',
        });
      } catch {}
    } else if (trimmed !== editingGroup.name) {
      store().renameBlockGroup(editingGroup.id, trimmed);
    }
    groupSheetRef.current?.close();
  };

  const handleDeleteGroup = () => {
    if (editingGroup && editingGroup.id !== DRAFT_GROUP_ID) {
      store().removeBlockGroup(editingGroup.id);
    }
    groupSheetRef.current?.close();
  };

  const groupLabel = (id: string | null): string => {
    if (id === null) return 'All apps';
    return blockGroups.find((g) => g.id === id)?.name ?? 'All apps';
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
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts!.serif }]}>
          Settings
        </Text>
        <Pressable onPress={onClose} hitSlop={16} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: theme.textSecondary }]}>{'\u2715'}</Text>
        </Pressable>
      </View>

      {/* Daily Goal */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DAILY GOAL</Text>
      <Text style={[styles.sectionHint, { color: theme.textTertiary }]}>
        {dailyGoalMinutes > 0
          ? `Do nothing for ${dailyGoalMinutes} min every day`
          : 'Set a daily goal to track your progress'}
      </Text>
      <View style={{ marginHorizontal: -24 }}>
        <GoalWheel
          value={dailyGoalMinutes}
          onChange={handleGoalChange}
          theme={theme}
        />
      </View>

      {/* Reminders */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 32 }]}>
        REMINDERS
      </Text>
      {reminders.length === 0 && (
        <View style={[styles.emptyCard, { borderColor: theme.textTertiary }]}>
          <Feather name="bell-off" size={22} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            No reminders yet
          </Text>
          <Text style={[styles.emptySub, { color: theme.textTertiary }]}>
            Add one to remember to pause
          </Text>
        </View>
      )}
      {reminders.map((r) => (
        <ReminderCard
          key={r.id}
          hour={r.hour}
          minute={r.minute}
          weekdays={r.weekdays}
          enabled={r.enabled}
          theme={theme}
          onPress={() => {
            Haptics.selectionAsync();
            setEditingReminder(r);
            reminderSheetRef.current?.expand();
          }}
          onToggle={() => {
            Haptics.selectionAsync();
            store().toggleReminder(r.id);
          }}
          onRemove={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            store().removeReminder(r.id);
          }}
        />
      ))}
      <PillButton
        label="+ add reminder"
        color={theme.text}
        variant="outline"
        size="small"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setEditingReminder(null);
          setShowReminderPicker(true);
          reminderSheetRef.current?.expand();
        }}
      />

      {/* App groups for blocking */}
      {Platform.OS === 'ios' && (
        <>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.sectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                APPS TO BLOCK
              </Text>
              <Text style={[styles.sectionHint, { color: theme.textTertiary, marginBottom: 12 }]}>
                Create lists of apps, then pick one per schedule
              </Text>
            </View>
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
          </View>

          {/* User groups */}
          {blockGroups.map((g) => {
            const count = groupCounts[g.id] ?? 0;
            return (
              <Pressable
                key={g.id}
                onPress={() => handleOpenGroup(g)}
                style={[styles.groupCardCol, { borderColor: count > 0 ? theme.accent : theme.border }]}
              >
                <View style={styles.groupCardHeader}>
                  <Text style={[styles.groupName, { color: theme.text, fontFamily: Fonts!.serif, flex: 1 }]}>
                    {g.name || 'Untitled list'}
                  </Text>
                </View>
                {count > 0 && (
                  <AppLabelsView
                    activitySelectionId={`donothing-group-${g.id}`}
                    iconSize={38}
                    maxItems={8}
                    overlap={14}
                    layout="row"
                    tintColor={theme.text}
                    ringColor={theme.bg}
                    style={[styles.labelStrip, { height: 42 }]}
                  />
                )}
              </Pressable>
            );
          })}

          <PillButton
            label="+ add category"
            color={theme.text}
            variant="outline"
            size="small"
            onPress={handleAddGroup}
          />

          {/* Never-block allowlist */}
          <View style={{ height: 28 }} />
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            ALWAYS ALLOWED
          </Text>
          <Text style={[styles.sectionHint, { color: theme.textTertiary, marginBottom: 12 }]}>
            These stay unlocked during any block
          </Text>
          {neverBlockCount > 0 ? (
            <Pressable
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                const status = await requestAuth();
                if (status === 'approved') setShowNeverBlockPicker(true);
              }}
              style={[styles.groupCardCol, { borderColor: theme.accent }]}
            >
              <View style={styles.groupCardHeader}>
                <Text style={[styles.groupName, { color: theme.text, fontFamily: Fonts!.serif, flex: 1 }]}>
                  {neverBlockCount === 1 ? '1 exception' : `${neverBlockCount} exceptions`}
                </Text>
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
              </View>
              <AppLabelsView
                activitySelectionId={NEVER_BLOCK_SELECTION_ID}
                iconSize={38}
                maxItems={8}
                overlap={14}
                layout="row"
                tintColor={theme.text}
                ringColor={theme.bg}
                style={[styles.labelStrip, { height: 42 }]}
              />
            </Pressable>
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

      {/* Scheduled Blocking */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 32 }]}>
        SCREEN BLOCK
      </Text>
      {scheduledBlocks.length === 0 && (
        <View style={[styles.emptyCard, { borderColor: theme.textTertiary }]}>
          <Feather name="smartphone" size={22} color={theme.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>
            No scheduled blocks yet
          </Text>
          <Text style={[styles.emptySub, { color: theme.textTertiary }]}>
            Schedule time to block distractions
          </Text>
        </View>
      )}
      {scheduledBlocks.map((b) => {
        const groupEmpty = b.groupId !== null && (groupCounts[b.groupId] ?? 0) === 0;
        const disabled = groupEmpty;
        const active = b.enabled && !disabled;
        return (
          <Pressable
            key={b.id}
            onPress={() => {
              if (disabled) return;
              Haptics.selectionAsync();
              setEditingBlock(b);
              blockSheetRef.current?.expand();
            }}
            style={[styles.card, {
              borderColor: active ? theme.accent : theme.border,
              opacity: disabled ? 0.4 : 1,
            }]}
          >
            <View style={styles.cardContent}>
              <Text style={[styles.cardTime, { color: active ? theme.accent : theme.text, fontFamily: Fonts!.mono }]}>
                {formatTime12(b.hour, b.minute)}
              </Text>
              <Text style={[styles.cardLabel, { color: theme.textSecondary }]}>
                {b.durationMinutes} min · {groupLabel(b.groupId)}
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
                disabled={disabled}
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
    </ScrollView>

    {/* Bottom sheet for reminder picker */}
    <PickerSheet
      ref={reminderSheetRef}
      theme={theme}
      onDismiss={() => { setShowReminderPicker(false); setEditingReminder(null); }}
    >
      <TimePickerContent
        key={editingReminder?.id ?? 'new'}
        theme={theme}
        title={editingReminder ? 'Edit reminder' : 'Add reminder'}
        initialHour={editingReminder?.hour}
        initialMinute={editingReminder?.minute}
        initialDays={editingReminder?.weekdays}
        onConfirm={handleConfirmReminder}
        onCancel={() => reminderSheetRef.current?.close()}
      />
    </PickerSheet>

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
        initialDuration={editingBlock?.durationMinutes}
        initialDays={editingBlock?.weekdays}
        initialGroupId={editingBlock?.groupId ?? null}
        initialUnlockGoal={editingBlock?.unlockGoalMinutes}
        groups={blockGroups}
        onConfirm={handleConfirmBlock}
        onCancel={() => blockSheetRef.current?.close()}
      />
    </PickerSheet>

    {/* Bottom sheet for group name editor */}
    <PickerSheet
      ref={groupSheetRef}
      theme={theme}
      onDismiss={() => {
        // Draft is purely in-memory — nothing to delete from DB, but clean the
        // lingering selection from UserDefaults.
        if (editingGroup?.id === DRAFT_GROUP_ID) {
          try {
            setFamilyActivitySelectionId({
              id: `donothing-group-${DRAFT_GROUP_ID}`,
              familyActivitySelection: '',
            });
          } catch {}
        }
        setEditingGroup(null);
        setCreatedFresh(false);
      }}
    >
      {editingGroup && (
        <GroupEditorContent
          key={editingGroup.id}
          theme={theme}
          group={editingGroup}
          initialName={editingGroup.name}
          hasApps={(groupCounts[editingGroup.id] ?? 0) > 0}
          onSave={handleSaveGroup}
          onDelete={handleDeleteGroup}
          onCancel={() => groupSheetRef.current?.close()}
          onOpenPicker={() => {
            if (!editingGroup) return;
            // Don't close the editor sheet — let the picker overlay on top
            // so the editor state (name being typed, etc.) survives.
            requestAuth().then((status) => {
              if (status === 'approved') setPickerGroupId(editingGroup.id);
            });
          }}
        />
      )}
    </PickerSheet>

    {/* App picker: group */}
    <AppPickerSheet
      theme={theme}
      selectionId={pickerGroupId ? `donothing-group-${pickerGroupId}` : null}
      title={blockGroups.find((g) => g.id === pickerGroupId)?.name || 'Choose apps'}
      onClose={() => {
        const id = pickerGroupId;
        if (id) {
          try {
            const meta = activitySelectionMetadata({ activitySelectionId: `donothing-group-${id}` });
            setGroupCounts((prev) => ({
              ...prev,
              [id]: (meta?.applicationCount ?? 0) + (meta?.categoryCount ?? 0) + (meta?.webDomainCount ?? 0),
            }));
          } catch {}
          handlePickerDismiss(id);
        }
      }}
    />

    {/* App picker: never-block */}
    <AppPickerSheet
      theme={theme}
      selectionId={showNeverBlockPicker ? NEVER_BLOCK_SELECTION_ID : null}
      title="Never block"
      onClose={() => {
        try {
          const meta = activitySelectionMetadata({ activitySelectionId: NEVER_BLOCK_SELECTION_ID });
          setNeverBlockCount((meta?.applicationCount ?? 0) + (meta?.categoryCount ?? 0) + (meta?.webDomainCount ?? 0));
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
  sectionTitle: { fontSize: 11, letterSpacing: 3, fontWeight: '500', marginBottom: 12 },
  sectionHint: { fontSize: 13, fontWeight: '300', fontStyle: 'italic', marginBottom: 4 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 16,
    borderWidth: 1.2,
    borderRadius: 16,
    marginBottom: 8,
  },
  stepperBtn: { padding: 8 },
  goalValue: { fontSize: 22, fontWeight: '300', minWidth: 80, textAlign: 'center' },

  // Card style for reminders & blocks
  card: {
    borderWidth: 1.2,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardContent: { gap: 4 },
  cardTime: { fontSize: 28, fontWeight: '300' },
  cardLabel: { fontSize: 12, fontWeight: '300', fontStyle: 'italic' },
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
    borderWidth: 1.2,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  groupCardCol: {
    borderWidth: 1.2,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 10,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  labelStrip: {
    height: 36,
    width: '100%',
  },
  allowEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.2,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
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
  editorContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  deleteIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameInput: {
    borderWidth: 1.2,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '400',
    marginBottom: 18,
  },
  editorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  editorEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.2,
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editorEditLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
  editorGridWrap: {
    borderWidth: 1.2,
    borderRadius: 14,
    paddingHorizontal: 14,
    maxHeight: 320,
    overflow: 'hidden',
  },
  editorGrid: {
    width: '100%',
    height: 320,
  },
  editorEmpty: {
    borderWidth: 1.2,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  editorEmptyLabel: {
    fontSize: 14,
    fontWeight: '400',
  },
  groupName: {
    fontSize: 17,
    fontWeight: '400',
  },
  groupSub: {
    fontSize: 12,
    fontWeight: '300',
    fontStyle: 'italic',
    marginTop: 2,
  },
  groupChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  groupChip: {
    borderWidth: 1.2,
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  groupChipLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  sheetFieldLabel: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  lockCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
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

  divider: { height: StyleSheet.hairlineWidth, marginVertical: 28 },
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

  // Bottom sheet content
  sheetContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '400',
    marginBottom: 24,
  },
  sheetPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  sheetPickerCol: {
    alignItems: 'center',
    gap: 8,
  },
  sheetArrow: {
    padding: 4,
  },
  sheetPickerValue: {
    fontSize: 36,
    fontWeight: '200',
  },
  sheetColon: {
    fontSize: 36,
    fontWeight: '200',
  },
  sheetLabel: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dayRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  dayCircle: {
    width: 40,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardDays: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  cardDayCol: {
    alignItems: 'center',
    gap: 2,
  },
  cardDot: {
    width: 5.5,
    height: 5.5,
    borderRadius: 2.75,
    borderWidth: 1,
  },
  cardDayText: {
    fontSize: 8,
    fontWeight: '400',
  },
  dayHint: {
    fontSize: 12,
    fontWeight: '300',
    fontStyle: 'italic',
    marginBottom: 24,
  },
});

import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type BottomSheet from '@gorhom/bottom-sheet';
import { Feather } from '@expo/vector-icons';
import { haptics } from '@/lib/haptics';
import { Fonts } from '@/constants/theme';
import { palette, themes, CARD_BORDER_WIDTH, type AppTheme } from '@/lib/theme';
import { useAppStore } from '@/lib/store';
import type { ScheduledBlock } from '@/lib/db/types';
import PillButton from '@/components/PillButton';
import PickerSheet from '@/components/PickerSheet';
import BlockPickerContent from '@/components/BlockPicker';
import { formatTime12, WEEKDAY_VALUES, WEEKDAY_SHORT } from '@/components/TimePicker';

interface Props {
  isActive: boolean;
  onNext: () => void;
  theme: AppTheme;
}

export default function PersonalizedResultScreen({ theme: screenTheme, onNext }: Props) {
  const insets = useSafeAreaInsets();
  const themeMode = useAppStore((s) => s.themeMode);
  const theme = themes[themeMode];
  const scheduledBlocks = useAppStore((s) => s.scheduledBlocks);
  const isSubscribed = useAppStore((s) => s.isSubscribed);
  const store = useAppStore.getState;

  const [editingBlock, setEditingBlock] = useState<ScheduledBlock | null>(null);
  const blockSheetRef = useRef<BottomSheet>(null);

  const handleConfirm = (
    hour: number,
    minute: number,
    duration: number,
    weekdays: number[],
    unlockGoalMinutes: number,
  ) => {
    haptics.light();
    const op = editingBlock
      ? store().editScheduledBlock(editingBlock.id, hour, minute, duration, weekdays, unlockGoalMinutes)
      : store().addScheduledBlock(hour, minute, duration, weekdays, unlockGoalMinutes);
    op.catch((e) => {
      console.error('[PersonalizedResult] save failed:', e);
      Alert.alert(
        'Could not save',
        'Something went wrong. Try again, or grant Screen Time access in Settings.',
      );
    });
    blockSheetRef.current?.close();
  };

  const openAdd = () => {
    haptics.light();
    setEditingBlock(null);
    blockSheetRef.current?.expand();
  };

  const openEdit = (b: ScheduledBlock) => {
    haptics.select();
    setEditingBlock(b);
    blockSheetRef.current?.expand();
  };

  return (
    <View style={[styles.container, { backgroundColor: screenTheme.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isSubscribed && (
          <View style={styles.proRow}>
            <View style={[styles.proBadge, { backgroundColor: palette.terracotta }]}>
              <Feather name="lock" size={10} color={palette.cream} />
              <Text style={[styles.proLabel, { color: palette.cream, fontFamily: Fonts?.serif }]}>
                PRO
              </Text>
            </View>
          </View>
        )}
        <Text style={[styles.heading, { color: screenTheme.text, fontFamily: Fonts?.serif }]}>
          Build your daily reset.
        </Text>
        <Text style={[styles.subtitle, { color: screenTheme.text, fontFamily: Fonts?.serif }]}>
          Block your apps at a set time.{'\n'}Unlock by doing nothing.
        </Text>

        {scheduledBlocks.length === 0 ? (
          <View style={[styles.emptyCard, { borderColor: screenTheme.text + '55' }]}>
            <View style={[styles.emptyIcon, { backgroundColor: palette.terracotta + '18' }]}>
              <Feather name="smartphone" size={22} color={palette.terracotta} />
            </View>
            <Text style={[styles.emptyTitle, { color: screenTheme.text, fontFamily: Fonts?.serif }]}>
              No blocks yet
            </Text>
            <Text style={[styles.emptySub, { color: screenTheme.text + 'A0', fontFamily: Fonts?.serif }]}>
              Add one to schedule a daily pause.
            </Text>
          </View>
        ) : (
          scheduledBlocks.map((b) => {
            const active = b.enabled;
            return (
              <Pressable
                key={b.id}
                onPress={() => openEdit(b)}
                style={[styles.card, {
                  borderColor: active ? palette.terracotta : screenTheme.text,
                }]}
              >
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTime, {
                    color: active ? palette.terracotta : screenTheme.text,
                    fontFamily: Fonts?.mono,
                  }]}>
                    {formatTime12(b.hour, b.minute)}
                  </Text>
                  <Text style={[styles.cardLabel, { color: screenTheme.text + 'B0' }]}>
                    <Text style={{ fontFamily: Fonts?.mono, fontWeight: '600', color: screenTheme.text }}>
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
                            backgroundColor: dayActive ? screenTheme.text : 'transparent',
                            borderColor: dayActive ? screenTheme.text : screenTheme.text + '60',
                          }]} />
                          <Text style={[styles.cardDayText, {
                            color: dayActive ? screenTheme.text : screenTheme.text + '60',
                          }]}>
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
                    trackColor={{ false: screenTheme.text + '40', true: palette.terracotta }}
                    thumbColor={palette.white}
                    ios_backgroundColor={active ? palette.terracotta : screenTheme.text + '40'}
                    style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  />
                  <Pressable
                    onPress={() => {
                      haptics.light();
                      store().removeScheduledBlock(b.id);
                    }}
                    hitSlop={12}
                  >
                    <Feather name="x" size={16} color={screenTheme.text + '80'} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}

        <View style={styles.addRow}>
          <PillButton
            label="+ add block"
            color={screenTheme.text}
            variant="outline"
            size="small"
            onPress={openAdd}
          />
        </View>
      </ScrollView>

      <View style={[styles.continueWrap, { paddingBottom: insets.bottom + 24 }]}>
        <PillButton
          label="Continue"
          color={palette.terracotta}
          variant="filled"
          onPress={onNext}
        />
      </View>

      <PickerSheet
        ref={blockSheetRef}
        theme={theme}
        onDismiss={() => {
          setEditingBlock(null);
        }}
      >
        <BlockPickerContent
          key={editingBlock?.id ?? 'new'}
          theme={theme}
          title={editingBlock ? 'Edit screen block' : 'Add screen block'}
          initialHour={editingBlock?.hour}
          initialMinute={editingBlock?.minute}
          initialDays={editingBlock?.weekdays}
          initialUnlockGoal={editingBlock?.unlockGoalMinutes}
          onConfirm={handleConfirm}
          onCancel={() => blockSheetRef.current?.close()}
        />
      </PickerSheet>
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
  proRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  proLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
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
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 20,
    paddingVertical: 36,
    paddingHorizontal: 18,
    marginBottom: 16,
    alignItems: 'center',
    gap: 10,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '300',
    fontStyle: 'italic',
  },
  addRow: {
    alignItems: 'center',
    marginTop: 4,
  },
  continueWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
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
  cardContent: { gap: 4, flex: 1 },
  cardTime: { fontSize: 28, fontWeight: '500' },
  cardLabel: { fontSize: 14, fontWeight: '300' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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

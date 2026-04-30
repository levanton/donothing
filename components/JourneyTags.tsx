import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import type { AppTheme } from '@/lib/theme';
import { palette } from '@/lib/theme';
import { getJourneyTags } from '@/lib/journey-tags';

interface Props {
  theme: AppTheme;
}

function JourneyTags({ theme }: Props) {
  const tags = useMemo(() => getJourneyTags(), []);

  if (tags.length === 0) return null;

  return (
    <View style={styles.container}>
      {tags.map((tag) => {
        const isStage = tag.type === 'stage';

        return (
          <View
            key={tag.id}
            style={[
              styles.tag,
              isStage
                ? { backgroundColor: palette.terracotta }
                : { backgroundColor: theme.subtle },
            ]}
          >
            <Text
              style={[
                styles.tagText,
                {
                  fontFamily: Fonts.serif,
                  color: isStage ? palette.cream : theme.text,
                },
              ]}
            >
              {tag.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export default memo(JourneyTags);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 16,
  },
  tag: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});

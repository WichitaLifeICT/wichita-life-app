import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, PressableCard, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { relativeTime } from '@/lib/format';
import type { Thread, ThreadCategory } from '@/lib/types';

export const CATEGORY_LABEL: Record<ThreadCategory, string> = {
  recommendations: 'Recommendations',
  ask: 'Ask Wichita',
  free_for_sale: 'Free & for sale',
  lost_found: 'Lost & found',
  group: 'Group',
};

/** The board's house rules, shown under every board. */
export const BOARD_RULES =
  'Real names, be kind, no politics or selling services. A new member’s first post is reviewed before it goes live; two reports send a post back for review.';

/** One board post. Group posts are labeled with their group; ••• opens Report and Block for other people’s posts. */
export function ThreadCard({
  thread: t,
  userId,
  showGroup = true,
  onReport,
  onBlock,
}: {
  thread: Thread;
  userId?: string;
  showGroup?: boolean;
  onReport: (t: Thread) => void;
  onBlock: (t: Thread) => void;
}) {
  const theme = useTheme();
  const [menu, setMenu] = useState(false);
  const label = t.group ? (showGroup ? t.group.name : null) : CATEGORY_LABEL[t.category];
  return (
    <PressableCard accessibilityRole="button" onPress={() => router.push({ pathname: '/thread/[id]', params: { id: t.id } })}>
      <View style={styles.between}>
        <T variant="small" style={{ flex: 1 }}>
          {label ? (
            <T variant="small" style={{ fontFamily: Fonts.display }} color={t.group ? Brand.blue : theme.heading}>
              {label}
              {' · '}
            </T>
          ) : null}
          {`${t.author_name} · ${relativeTime(t.created_at)}`}
        </T>
        {userId && t.author_id !== userId ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Report or block" hitSlop={10} onPress={() => setMenu(!menu)}>
            <T variant="small" style={{ fontFamily: Fonts.display }}>
              •••
            </T>
          </Pressable>
        ) : null}
      </View>
      <T variant="cardTitle">{t.title}</T>
      {t.status === 'pending' ? (
        <T variant="small" color={Brand.redText}>
          In review: only you can see this for now
        </T>
      ) : null}
      <T variant="small">
        {t.replies} {t.replies === 1 ? 'reply' : 'replies'} ›
      </T>
      {menu ? (
        <View style={{ flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one }}>
          <Button small tone="ghost" label="Report post" onPress={() => (setMenu(false), onReport(t))} />
          <Button small tone="ghost" label={`Block ${t.author_name}`} onPress={() => (setMenu(false), onBlock(t))} />
        </View>
      ) : null}
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
});

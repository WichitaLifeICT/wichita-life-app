import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryFrame } from '@/components/story-frame';
import { Button, Card, ClosePill, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { getStory } from '@/lib/api';
import { openLink } from '@/lib/links';
import { shareLink } from '@/lib/share';

/**
 * A newsletter story inside the app. Beehiiv's own page asks app readers to subscribe again (its
 * login doesn't carry into the app), so the app shows the story's text itself. Links in the story
 * open in the browser sheet.
 */
export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const q = useQuery(() => getStory(id), [id]);
  const story = q.data;
  const [note, setNote] = useState<string>();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={styles.bar}>
        <ClosePill label="‹ Back" onPress={close} />
        {story ? (
          <Button
            small
            tone="ghost"
            label={note ?? 'Share'}
            onPress={async () => setNote(await shareLink(story.url, story.title))}
          />
        ) : null}
      </View>
      {q.loading ? (
        <ActivityIndicator style={{ marginTop: Spacing.five }} color={Brand.blue} />
      ) : story?.html ? (
        <StoryFrame html={story.html} />
      ) : (
        <View style={{ padding: Spacing.three }}>
          <Card style={{ gap: Spacing.two }}>
            <T variant="cardTitle">{story ? story.title : 'Story not found'}</T>
            <T variant="small">
              {story ? 'This story isn’t in the app yet. You can read it on the web.' : 'It may have been taken down.'}
            </T>
            {story ? <Button small tone="red" label="Read on the web ↗" onPress={() => openLink(story.url)} /> : null}
          </Card>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
});

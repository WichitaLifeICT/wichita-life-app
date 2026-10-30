import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { errorMessage } from '@/lib/format';
import { Button, Card, Chip, Field, Screen, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { submitThread } from '@/lib/member';
import { BOARD_RULES } from '@/components/thread-card';
import type { ThreadCategory } from '@/lib/types';

const CATEGORIES: { id: Exclude<ThreadCategory, 'group'>; label: string; hint: string }[] = [
  {
    id: 'recommendations',
    label: 'Recommendations',
    hint: 'Best breakfast burrito in Delano?',
  },
  {
    id: 'ask',
    label: 'Ask Wichita',
    hint: 'Anyone know why the river path is closed?',
  },
  {
    id: 'free_for_sale',
    label: 'Free & for sale',
    hint: 'Free: kids bike, College Hill',
  },
  {
    id: 'lost_found',
    label: 'Lost & found',
    hint: 'Found: gray cat near Riverside Park',
  },
];

/** A new board post; with ?groupId=…&groupName=… it goes on that group's board. */
export default function NewPost() {
  const theme = useTheme();
  const track = useTrack();
  const { groupId, groupName } = useLocalSearchParams<{ groupId?: string; groupName?: string }>();
  const [category, setCategory] = useState<Exclude<ThreadCategory, 'group'>>('recommendations');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<'approved' | 'pending'>();
  const [error, setError] = useState<string>();
  const hint = groupId
    ? 'Who’s in this Saturday? Here’s my idea…'
    : CATEGORIES.find((c) => c.id === category)!.hint;

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const status = await submitThread(groupId ? 'group' : category, title, body, groupId);
      track('thread_submitted', { category: groupId ? 'group' : category });
      setSent(status);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={{
          paddingHorizontal: Spacing.three,
          paddingTop: Spacing.two,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
        <T variant="title">{groupName ? `Post in ${groupName}` : 'New post'}</T>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            {sent ? 'Done' : 'Cancel'}
          </T>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          {sent === 'approved' ? (
            <Card style={{ gap: Spacing.two }}>
              <T variant="cardTitle">Posted! 🎉</T>
              <T variant="small">It’s live{groupName ? ` on the ${groupName} board` : ' on the board'}.</T>
              <Button tone="red" label="Back" onPress={() => router.back()} />
            </Card>
          ) : sent ? (
            <Card style={{ gap: Spacing.two }}>
              <T variant="cardTitle">Thanks! Your post is in review.</T>
              <T variant="small">
                A new member’s first post gets a quick look from the Wichita Life team, usually within a day. After
                that, your posts go live right away. You can see it on the board in the meantime.
              </T>
              <Button tone="red" label="Back" onPress={() => router.back()} />
            </Card>
          ) : (
            <View style={{ gap: Spacing.three }}>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: Spacing.two,
                }}>
                {groupId
                  ? null
                  : CATEGORIES.map((c) => (
                      <Chip key={c.id} label={c.label} active={category === c.id} onPress={() => setCategory(c.id)} />
                    ))}
              </View>
              <Field label="Title" value={title} onChangeText={setTitle} placeholder={hint} maxLength={120} />
              <Field
                label="Details (optional)"
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={4000}
                style={{ minHeight: 120, textAlignVertical: 'top' }}
              />
              <T variant="small">
                {BOARD_RULES}
              </T>
              {error ? (
                <T variant="small" color={Brand.redText}>
                  {error}
                </T>
              ) : null}
              <Button
                tone="red"
                label={busy ? 'Sending…' : 'Post'}
                disabled={busy || title.trim().length < 3}
                onPress={submit}
              />
            </View>
          )}
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

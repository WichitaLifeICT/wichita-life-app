import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Chip, Field, Screen, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { submitThread } from '@/lib/member';
import type { ThreadCategory } from '@/lib/types';

const CATEGORIES: { id: ThreadCategory; label: string; hint: string }[] = [
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

export default function NewPost() {
  const theme = useTheme();
  const track = useTrack();
  const [category, setCategory] = useState<ThreadCategory>('recommendations');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();
  const hint = CATEGORIES.find((c) => c.id === category)!.hint;

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await submitThread(category, title, body);
      track('thread_submitted', { category });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
        <T variant="title">New post</T>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            {sent ? 'Done' : 'Cancel'}
          </T>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen>
          {sent ? (
            <Card style={{ gap: Spacing.two }}>
              <T variant="cardTitle">Thanks! Your post is in review.</T>
              <T variant="small">
                The Wichita Life team checks every post, usually within a day. You can see it on the board in the
                meantime.
              </T>
              <Button tone="red" label="Back to the board" onPress={() => router.back()} />
            </Card>
          ) : (
            <View style={{ gap: Spacing.three }}>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: Spacing.two,
                }}>
                {CATEGORIES.map((c) => (
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
                Real names, be kind, no politics or selling services. Every post is reviewed before it goes live.
              </T>
              {error ? (
                <T variant="small" color={Brand.red}>
                  {error}
                </T>
              ) : null}
              <Button
                tone="red"
                label={busy ? 'Sending…' : 'Submit for review'}
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

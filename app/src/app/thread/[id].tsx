import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, Field, LoadState, Screen, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { getReplies, getThread } from '@/lib/api';
import { useAuth, useRequireSignIn } from '@/lib/auth';
import { relativeTime } from '@/lib/format';
import { blockMember, deleteReply, deleteThread, postReply, reportReply, reportThread } from '@/lib/member';

const CATEGORY_LABEL: Record<string, string> = {
  recommendations: 'Recommendations',
  ask: 'Ask Wichita',
  free_for_sale: 'Free & for sale',
  lost_found: 'Lost & found',
};

export default function ThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const track = useTrack();
  const { session } = useAuth();
  const userId = session?.user.id;
  const requireSignIn = useRequireSignIn();
  const q = useQuery(async () => {
    const [thread, replies] = await Promise.all([getThread(id), getReplies(id)]);
    return { thread, replies };
  }, [id, userId]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState<string>();
  const [notice, setNotice] = useState<string>();

  useEffect(() => {
    track('thread_opened', { thread_id: id });
  }, [id, track]);

  const t = q.data?.thread;
  const act = (fn: () => Promise<unknown>, done?: string) => {
    setMenuFor(undefined);
    setNotice(undefined);
    fn().then(
      () => {
        if (done) setNotice(done);
        q.refresh();
      },
      (e: Error) => setNotice(e.message),
    );
  };

  const send = async () => {
    if (!requireSignIn('Sign in to reply')) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await postReply(id, reply);
      track('reply_posted', { thread_id: id });
      setReply('');
      q.refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ paddingHorizontal: Spacing.three, paddingTop: Spacing.two }}>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/meet'))}>
          <T variant="small" color={Brand.red} style={{ fontFamily: Fonts.display, fontSize: 14 }}>
            ‹ Community board
          </T>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen refreshing={q.refreshing} onRefresh={q.refresh}>
          <LoadState
            loading={q.loading}
            error={q.error}
            empty={q.data && !t ? 'This post isn’t available. It may have been removed.' : undefined}
          />
          {t ? (
            <>
              <View style={{ gap: Spacing.two }}>
                <T variant="small">
                  <T variant="small" style={{ fontFamily: Fonts.display }} color={theme.heading}>
                    {CATEGORY_LABEL[t.category]}
                  </T>
                  {` · ${t.author_name} · ${relativeTime(t.created_at)}`}
                </T>
                <T variant="heading" style={{ fontSize: 24, lineHeight: 30 }}>
                  {t.title}
                </T>
                {t.body ? <T>{t.body}</T> : null}
                {t.status === 'pending' ? (
                  <T variant="small" color={Brand.red}>
                    In review: only you can see this until the Wichita Life team approves it.
                  </T>
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                  {userId && t.author_id === userId ? (
                    <Button
                      small
                      tone="ghost"
                      label="Delete my post"
                      onPress={() => act(() => deleteThread(t.id).then(() => router.back()))}
                    />
                  ) : userId ? (
                    <>
                      <Button
                        small
                        tone="ghost"
                        label="Report post"
                        onPress={() =>
                          act(async () => {
                            await reportThread(t.id, 'Reported from the app');
                            track('content_reported', { kind: 'thread' });
                          }, 'Thanks. The Wichita Life team will take a look.')
                        }
                      />
                      <Button
                        small
                        tone="ghost"
                        label={`Block ${t.author_name}`}
                        onPress={() => act(() => blockMember(t.author_id).then(() => router.back()))}
                      />
                    </>
                  ) : null}
                </View>
              </View>

              {notice ? (
                <T variant="small" color={Brand.red}>
                  {notice}
                </T>
              ) : null}

              <View style={{ gap: Spacing.two }}>
                <T variant="title">
                  {q.data!.replies.length} {q.data!.replies.length === 1 ? 'reply' : 'replies'}
                </T>
                {!userId && q.data!.replies.length ? <T variant="small">Sign in to see who replied.</T> : null}
                {q.data!.replies.map((r) => (
                  <Card key={r.id} style={{ gap: Spacing.one }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <T variant="small" style={{ flex: 1 }}>
                        <T variant="small" style={{ fontFamily: Fonts.display }} color={theme.heading}>
                          {r.author_name}
                        </T>
                        {` · ${relativeTime(r.created_at)}`}
                      </T>
                      {userId ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Reply options"
                          hitSlop={10}
                          onPress={() => setMenuFor(menuFor === r.id ? undefined : r.id)}>
                          <T variant="small" style={{ fontFamily: Fonts.display }}>
                            •••
                          </T>
                        </Pressable>
                      ) : null}
                    </View>
                    <T>{r.body}</T>
                    {menuFor === r.id ? (
                      <View
                        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one }}>
                        {r.author_id === userId ? (
                          <Button small tone="ghost" label="Delete" onPress={() => act(() => deleteReply(r.id))} />
                        ) : (
                          <>
                            <Button
                              small
                              tone="ghost"
                              label="Report reply"
                              onPress={() =>
                                act(async () => {
                                  await reportReply(r.id, 'Reported from the app');
                                  track('content_reported', { kind: 'reply' });
                                }, 'Thanks. The Wichita Life team will take a look.')
                              }
                            />
                            <Button
                              small
                              tone="ghost"
                              label={`Block ${r.author_name}`}
                              onPress={() =>
                                act(() => blockMember(r.author_id), `You won’t see ${r.author_name} anymore.`)
                              }
                            />
                          </>
                        )}
                      </View>
                    ) : null}
                  </Card>
                ))}
              </View>

              {t.status === 'approved' ? (
                <View style={{ gap: Spacing.two }}>
                  <Field
                    label="Add a reply"
                    value={reply}
                    onChangeText={setReply}
                    placeholder={session ? 'Be kind and helpful.' : 'Sign in to reply'}
                    multiline
                    maxLength={2000}
                    style={{ minHeight: 80, textAlignVertical: 'top' }}
                  />
                  <Button
                    tone="red"
                    label={busy ? 'Posting…' : session ? 'Reply' : 'Sign in to reply'}
                    disabled={busy || (Boolean(session) && !reply.trim())}
                    onPress={send}
                  />
                </View>
              ) : null}
            </>
          ) : null}
        </Screen>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

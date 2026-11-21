import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, ChipRow, ClosePill, Field, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTrack } from '@/lib/analytics';
import { useAuth, useRequireSignIn } from '@/lib/auth';
import { shareEvent } from '@/lib/event-actions';
import { errorMessage } from '@/lib/format';
import { getFriends, NOTE_MAX_WORDS, sendEvent, wordCount, type Friend } from '@/lib/friends';
import type { EventItem } from '@/lib/types';

/**
 * Share an event: send it to friends in the app with a note (up to 30 words), and they get a
 * notification that opens it; or text it / share a link to anyone, with the same note on top.
 */
export function SendEvent({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const { session } = useAuth();
  const track = useTrack();
  const requireSignIn = useRequireSignIn();
  const friendsQ = useQuery(() => (session ? getFriends() : Promise.resolve([] as Friend[])), [session?.user.id]);
  const friends = (friendsQ.data ?? []).filter((f) => f.status === 'friend');
  const [note, setNote] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [status, setStatus] = useState<string>();
  const [linkStatus, setLinkStatus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const words = wordCount(note);

  // Up to 30 words: a 31st word doesn't go in (finishing or fixing the 30th is fine).
  const onNote = (text: string) => {
    if (wordCount(text) > NOTE_MAX_WORDS) return;
    setNote(text);
  };

  const send = async () => {
    if (busy || !picked.length) return;
    setBusy(true);
    setStatus(undefined);
    try {
      const n = await sendEvent(event.id, picked, note);
      track('event_sent_to_friends', { event_id: event.id, friends: n, note: !!note.trim() });
      setPicked([]);
      setStatus(n ? `Sent to ${n} friend${n === 1 ? '' : 's'}.` : 'They already have it.');
    } catch (e) {
      setStatus(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: Spacing.two }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two }}>
        <T variant="cardTitle">📨 Share this event</T>
        <ClosePill label="Done" onPress={onClose} />
      </View>
      <Field
        label="Add a note (optional)"
        placeholder="You in? 🎉"
        value={note}
        onChangeText={onNote}
        maxLength={240}
        multiline
        returnKeyType="done"
      />
      <T variant="small" color={words >= NOTE_MAX_WORDS ? Brand.redText : undefined}>
        {words}/{NOTE_MAX_WORDS} words
      </T>
      {!session ? (
        <T variant="small">
          Want to send it to friends in the app?{' '}
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display }} onPress={() => requireSignIn('Sign in to send events to friends')}>
            Sign in ›
          </T>
        </T>
      ) : friendsQ.loading ? null : friends.length ? (
        <>
          <T variant="small">Pick friends. They’ll get a notification with your note.</T>
          <ChipRow>
            {friends.map((f) => (
              <Chip
                key={f.id}
                label={f.name ?? 'Friend'}
                active={picked.includes(f.id)}
                onPress={() => setPicked((p) => (p.includes(f.id) ? p.filter((x) => x !== f.id) : [...p, f.id]))}
              />
            ))}
          </ChipRow>
          <Button
            small
            tone="red"
            label={busy ? 'Sending…' : picked.length ? `Send to ${picked.length}` : 'Pick friends to send it to'}
            disabled={!picked.length || busy}
            onPress={send}
          />
        </>
      ) : (
        <T variant="small">
          No friends on Wichita Life yet.{' '}
          <T variant="small" color={Brand.redText} style={{ fontFamily: Fonts.display }} onPress={() => router.push('/friends')}>
            Add friends ›
          </T>
        </T>
      )}
      {status ? (
        <T variant="small" style={{ fontFamily: Fonts.display }}>
          {status}
        </T>
      ) : null}
      <Button
        small
        tone="ghost"
        label={linkStatus ?? 'Text it or share a link'}
        onPress={async () => {
          track('event_shared', { event_id: event.id });
          setLinkStatus(await shareEvent(event, note));
        }}
      />
    </Card>
  );
}

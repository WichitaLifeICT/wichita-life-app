import { useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, Sticker, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useTrack } from '@/lib/analytics';
import { errorMessage } from '@/lib/format';
import { INTERESTS } from '@/lib/interests';
import { updateProfile } from '@/lib/member';

// Interests that pick events (news and giveaways only steer notifications).
const EVENT_INTERESTS = INTERESTS.filter((i) => i.id !== 'news' && i.id !== 'giveaways');

/**
 * Shown on Today to members who haven't picked any interests, so Picked for you has something to
 * go on. Saving fills in Picked for you right away.
 */
export function InterestsPrompt({ onSaved }: { onSaved: () => Promise<void> | void }) {
  const track = useTrack();
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await updateProfile({ interests: chosen });
      track('interests_set', { interests: chosen, from: 'today' });
      await onSaved();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Sticker color={Brand.blue} shadow={Brand.orange}>
      <T variant="label" color={Brand.orange}>
        Picked for you
      </T>
      <T variant="title" color={Brand.white}>
        What are you into?
      </T>
      <T color="#EAF0FA">Tap a few and we’ll pick events for you every week.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
        {EVENT_INTERESTS.map((i) => (
          <Chip key={i.id} label={i.label} active={chosen.includes(i.id)} onPress={() => toggle(i.id)} />
        ))}
      </View>
      <Button
        tone="orange"
        label={busy ? 'Saving…' : chosen.length ? 'Show my picks' : 'Tap at least one'}
        disabled={!chosen.length || busy}
        onPress={save}
      />
      {error ? (
        <T variant="small" color="#EAF0FA">
          {error}
        </T>
      ) : null}
    </Sticker>
  );
}

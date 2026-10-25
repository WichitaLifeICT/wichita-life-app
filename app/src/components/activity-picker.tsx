import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, ChipRow, Sticker, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useTrack } from '@/lib/analytics';
import { ACTIVITY_KINDS, randomActivity, type Activity, type ActivityKind } from '@/lib/activities';
import { openDirections } from '@/lib/event-actions';
import { openLink } from '@/lib/links';

/** "What should we do?": a random thing to do around town, optionally of one kind. */
export function ActivityPicker() {
  const track = useTrack();
  const [kind, setKind] = useState<ActivityKind | null>(null);
  const [pick, setPick] = useState<Activity | null>();
  const [shown, setShown] = useState<string[]>([]);

  const roll = () => {
    // Don't repeat a spot until we've run out.
    let next = randomActivity(kind, shown);
    let seen = shown;
    if (!next) {
      seen = pick ? [pick.id] : [];
      next = randomActivity(kind, seen);
    }
    setPick(next);
    setShown(next ? [...seen, next.id] : seen);
    track('activity_picked', { kind: kind ?? 'any', again: Boolean(pick) });
  };

  const choose = (id: ActivityKind | null) => {
    setKind(id);
    setPick(undefined);
    setShown([]);
  };

  return (
    <View style={{ gap: Spacing.two }}>
      <Sticker color={Brand.green} shadow={Brand.orange}>
        <T variant="label" color="#DDF2E3">
          Bored?
        </T>
        <T variant="title" color={Brand.white}>
          What should we do? 🎳
        </T>
        <T color={Brand.white}>Golf, bowling, arcades, mini golf and more around town.</T>
        <Button tone="orange" label={pick ? 'Pick again' : 'Pick for me'} onPress={roll} />
      </Sticker>

      <ChipRow>
        <Chip label="Anything" active={!kind} onPress={() => choose(null)} />
        {ACTIVITY_KINDS.map((k) => (
          <Chip key={k.id} label={k.label} active={kind === k.id} onPress={() => choose(k.id)} />
        ))}
      </ChipRow>

      {pick ? (
        <Card style={{ gap: Spacing.one, borderColor: Brand.navy, borderWidth: 2 }}>
          <T variant="small">{ACTIVITY_KINDS.filter((k) => pick.kinds.includes(k.id)).map((k) => k.label).join(' · ')}</T>
          <T variant="heading" style={{ fontSize: 24, lineHeight: 30 }}>
            {pick.name}
          </T>
          <T>{pick.blurb}</T>
          <T variant="small">{pick.address}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one }}>
            <Button
              small
              tone="red"
              label="Let’s go · Directions"
              onPress={() => {
                track('activity_opened', { activity_id: pick.id, action: 'directions' });
                openDirections({ title: pick.name, venue: pick.name, address: pick.address });
              }}
            />
            {pick.website ? (
              <Button
                small
                tone="ghost"
                label="Website ↗"
                onPress={() => {
                  track('activity_opened', { activity_id: pick.id, action: 'website' });
                  openLink(pick.website!);
                }}
              />
            ) : null}
          </View>
        </Card>
      ) : null}
    </View>
  );
}

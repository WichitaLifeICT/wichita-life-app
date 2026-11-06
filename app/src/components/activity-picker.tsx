import { useState } from 'react';
import { View } from 'react-native';

import { AddToPlanButton } from '@/components/add-to-plan-button';
import { Button, Card, Chip, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { useTrack } from '@/lib/analytics';
import { ACTIVITY_KINDS, getActivities, randomActivity, seasonalNow, type Activity, type ActivityKind } from '@/lib/activities';
import { openDirections } from '@/lib/event-actions';
import { openLink } from '@/lib/links';

/** "What should we do?": a random thing to do around town, optionally of one kind. */
export function ActivityPicker() {
  const track = useTrack();
  const q = useQuery(getActivities, [], { cacheKey: 'activities' });
  const list = q.data ?? [];
  const [kind, setKind] = useState<ActivityKind | 'season' | null>(null);
  const [pick, setPick] = useState<Activity | null>();
  const [shown, setShown] = useState<string[]>([]);

  const roll = (k = kind, already = shown) => {
    // Don't repeat a spot until we've run out.
    let next = randomActivity(list, k, already);
    let seen = already;
    if (!next) {
      seen = pick ? [pick.id] : [];
      next = randomActivity(list, k, seen);
    }
    setPick(next);
    setShown(next ? [...seen, next.id] : seen);
    track('activity_picked', { kind: k ?? 'any', again: already.length > 0 });
  };

  // One kind at a time, so tapping a kind picks right away.
  const choose = (id: ActivityKind | 'season' | null) => {
    setKind(id);
    roll(id, []);
  };

  return (
    <View style={{ gap: Spacing.two }}>
      {/* Wichita Navy with a Wichita Strawberry shadow (brand manual secondary palette). */}
      <Sticker color={Brand.navy} shadow="#F16C7A">
        <T variant="label" color="#FCC172">
          Bored?
        </T>
        <T variant="title" color={Brand.white}>
          What should we do? 🎳
        </T>
        <T color={Brand.white}>Golf, bowling, arcades, museums, classes, the zoo and more around town.</T>
        <T variant="small" color={Brand.white} style={{ fontFamily: Fonts.display }}>
          Tap one and we’ll pick a spot
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          <Chip label="Anything" active={!kind && Boolean(pick)} onPress={() => list.length && choose(null)} />
          {seasonalNow(list).length ? (
            <Chip label="📅 In season now" active={kind === 'season'} onPress={() => choose('season')} />
          ) : null}
          {ACTIVITY_KINDS.map((k) => (
            <Chip key={k.id} label={k.label} active={kind === k.id} onPress={() => list.length && choose(k.id)} />
          ))}
        </View>
        {pick ? <Button tone="orange" label="Pick again" onPress={() => roll()} /> : null}
      </Sticker>

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
            <AddToPlanButton kind="activity" id={pick.id} title={pick.name} />
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

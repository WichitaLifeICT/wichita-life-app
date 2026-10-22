import { router } from 'expo-router';
import { useState } from 'react';
import { Switch, View } from 'react-native';

import { Button, Card, Chip, ChipRow, Sticker, T, Tag } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { openDirections } from '@/lib/event-actions';
import { openLink } from '@/lib/links';
import { cuisineLabel, EAT_CATEGORIES, randomPlace, type Place } from '@/lib/places';

/** "Where should I eat?": a random local spot, optionally of one cuisine. */
export function EatPicker() {
  const theme = useTheme();
  const track = useTrack();
  const [category, setCategory] = useState<string | null>(null);
  const [localOnly, setLocalOnly] = useState(true);
  const [place, setPlace] = useState<Place | null>();
  const [shown, setShown] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const pick = async (again = false) => {
    setBusy(true);
    setError(undefined);
    try {
      // Don't repeat a place until we've run out.
      let next = await randomPlace(category, localOnly, again ? shown : []);
      if (!next && again && shown.length) next = await randomPlace(category, localOnly, []);
      setPlace(next);
      setShown((s) => (next ? [...(again ? s : []), next.id] : s));
      track('eat_picked', { category: category ?? 'any', local_only: localOnly, again });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const choose = (id: string | null) => {
    setCategory(id);
    setPlace(undefined);
    setShown([]);
  };

  return (
    <View style={{ gap: Spacing.two }}>
      <Sticker color={Brand.red} shadow={Brand.orange}>
        <T variant="label" color="#FFE3DC">
          Can’t decide?
        </T>
        <T variant="title" color={Brand.white}>
          Where should I eat? 🎲
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
          <Switch
            accessibilityLabel="Local spots only"
            value={localOnly}
            onValueChange={(v) => {
              setLocalOnly(v);
              setPlace(undefined);
              setShown([]);
            }}
            trackColor={{ true: Brand.orange, false: '#F2A79B' }}
            thumbColor={Brand.white}
          />
          <T color={Brand.white}>Local spots only, no chains</T>
        </View>
        <Button tone="orange" label={busy ? 'Picking…' : place ? 'Pick again' : 'Pick for me'} disabled={busy} onPress={() => pick(Boolean(place))} />
      </Sticker>

      <ChipRow>
        <Chip label="Anything" active={!category} onPress={() => choose(null)} />
        {EAT_CATEGORIES.map((c) => (
          <Chip key={c.id} label={c.label} active={category === c.id} onPress={() => choose(c.id)} />
        ))}
      </ChipRow>

      {error ? <T color={Brand.red}>{error}</T> : null}

      {place === null ? (
        <Card>
          <T>Nothing on our list for that yet. Try another cuisine{localOnly ? ' or turn off Local spots only' : ''}.</T>
        </Card>
      ) : place ? (
        <Card style={{ gap: Spacing.one, borderColor: Brand.navy, borderWidth: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two }}>
            <T variant="small" style={{ flex: 1 }}>
              {cuisineLabel(place)}
            </T>
            {place.local_pick ? <Tag label="★ Local pick" /> : null}
          </View>
          <T variant="heading" style={{ fontSize: 24, lineHeight: 30 }}>
            {place.name}
          </T>
          {place.address ? <T variant="small">{place.address}</T> : null}
          {place.note ? (
            <T style={{ fontStyle: 'italic' }} color={theme.heading}>
              “{place.note}”
            </T>
          ) : null}
          {place.opening_hours ? <T variant="small">Hours: {place.opening_hours}</T> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one }}>
            <Button
              small
              tone="red"
              label="Let’s go · Directions"
              onPress={() => {
                track('eat_opened', { place_id: place.id, action: 'directions' });
                openDirections({ title: place.name, venue: place.name, address: place.address });
              }}
            />
            {place.website ? (
              <Button
                small
                tone="ghost"
                label="Website ↗"
                onPress={() => {
                  track('eat_opened', { place_id: place.id, action: 'website' });
                  openLink(place.website!);
                }}
              />
            ) : null}
          </View>
          <T
            variant="small"
            color={Brand.red}
            style={{ marginTop: Spacing.one }}
            onPress={() => router.push({ pathname: '/feedback', params: { from: `place:${place.name}` } })}>
            Closed or wrong? Tell us
          </T>
        </Card>
      ) : null}
    </View>
  );
}

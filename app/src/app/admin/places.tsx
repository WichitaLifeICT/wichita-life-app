import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Chip, ChipRow, Field, LoadState, T, Tag } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { addPlace, getAdminPlaces, updatePlace } from '@/lib/admin';
import { cuisineLabel, EAT_CATEGORIES, type Place } from '@/lib/places';

type Filter = 'active' | 'local' | 'picks' | 'chains' | 'off' | 'no_cuisine';

const FILTERS: { id: Filter; label: string; test: (p: Place) => boolean }[] = [
  { id: 'active', label: 'All showing', test: (p) => p.status === 'active' },
  { id: 'local', label: 'Local', test: (p) => p.status === 'active' && !p.chain },
  { id: 'picks', label: '★ Local picks', test: (p) => p.local_pick },
  { id: 'chains', label: 'Chains', test: (p) => p.status === 'active' && p.chain },
  { id: 'off', label: 'Hidden & closed', test: (p) => p.status !== 'active' },
  { id: 'no_cuisine', label: 'No cuisine yet', test: (p) => p.status === 'active' && !p.categories.length },
];

const SHOW = 60;

export default function AdminPlaces() {
  const q = useQuery(getAdminPlaces);
  const [filter, setFilter] = useState<Filter>('local');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string>();
  const [note, setNote] = useState('');
  const [adding, setAdding] = useState<{ name: string; address: string; website: string; categories: string[] }>();
  const [error, setError] = useState<string>();

  const list = useMemo(() => {
    const words = search.trim().toLowerCase();
    const test = FILTERS.find((f) => f.id === filter)!.test;
    return (q.data ?? []).filter(
      (p) => test(p) && (!words || `${p.name} ${p.address ?? ''} ${p.cuisine.join(' ')}`.toLowerCase().includes(words)),
    );
  }, [q.data, filter, search]);

  const act = (fn: () => Promise<unknown>) => {
    setError(undefined);
    fn().then(q.refresh, (e: Error) => setError(e.message));
  };
  const toggleCategory = (p: Place, id: string) =>
    act(() =>
      updatePlace(p.id, {
        categories: p.categories.includes(id) ? p.categories.filter((c) => c !== id) : [...p.categories, id],
      }),
    );

  const counts = q.data
    ? `${q.data.filter((p) => p.status === 'active').length} showing · ${q.data.filter((p) => p.status === 'active' && !p.chain).length} local`
    : '';

  return (
    <AdminPage title="Restaurants" refreshing={q.refreshing} onRefresh={q.refresh}>
      <T variant="small">
        The list behind “Where should I eat?” on Explore. It started from OpenStreetMap and refreshes monthly without
        undoing anything you set here. Hide places that don’t belong, mark closed ones, fix chain vs. local (Wichita-born
        chains like NuWay can count as local), and star your favorites: local picks come up more often.
      </T>
      {counts ? <T variant="small">{counts}</T> : null}
      {error ? <T color={Brand.redText}>{error}</T> : null}

      {adding ? (
        <Card style={{ gap: Spacing.three }}>
          <T variant="cardTitle">Add a place</T>
          <Field label="Name" value={adding.name} onChangeText={(name) => setAdding({ ...adding, name })} />
          <Field label="Address" value={adding.address} onChangeText={(address) => setAdding({ ...adding, address })} />
          <Field
            label="Website (optional)"
            value={adding.website}
            onChangeText={(website) => setAdding({ ...adding, website })}
            autoCapitalize="none"
            keyboardType="url"
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {EAT_CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                active={adding.categories.includes(c.id)}
                onPress={() =>
                  setAdding({
                    ...adding,
                    categories: adding.categories.includes(c.id)
                      ? adding.categories.filter((x) => x !== c.id)
                      : [...adding.categories, c.id],
                  })
                }
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button
              tone="red"
              label="Add"
              disabled={adding.name.trim().length < 2}
              onPress={() =>
                act(async () => {
                  const website = adding.website.trim();
                  await addPlace({
                    name: adding.name.trim(),
                    kind: 'restaurant',
                    categories: adding.categories,
                    address: adding.address.trim() || null,
                    website: /^https?:\/\//.test(website) ? website : null,
                    note: null,
                    local_pick: false,
                  });
                  setAdding(undefined);
                })
              }
            />
            <Button tone="ghost" label="Cancel" onPress={() => setAdding(undefined)} />
          </View>
        </Card>
      ) : (
        <Button
          tone="red"
          label="+ Add a place"
          onPress={() => setAdding({ name: '', address: '', website: '', categories: [] })}
        />
      )}

      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name, street or cuisine" />
      <ChipRow>
        {FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </ChipRow>

      <LoadState loading={q.loading} error={q.error} empty={q.data && !list.length ? 'Nothing matches.' : undefined} />
      {list.length > SHOW ? (
        <T variant="small">
          Showing {SHOW} of {list.length}. Search to narrow it down.
        </T>
      ) : null}

      <View style={{ gap: Spacing.two + 2 }}>
        {list.slice(0, SHOW).map((p) => (
          <Card key={p.id} style={{ gap: Spacing.one }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}>
              <T variant="small" style={{ flex: 1 }}>
                {cuisineLabel(p)}
                {p.address ? ` · ${p.address}` : ''}
              </T>
              {p.status !== 'active' ? (
                <Tag label={p.status} tone="blue" />
              ) : p.local_pick ? (
                <Tag label="★ pick" tone="green" />
              ) : p.chain ? (
                <Tag label="chain" />
              ) : null}
            </View>
            <T variant="cardTitle">{p.name}</T>
            {p.note ? <T variant="small">“{p.note}”</T> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one }}>
              <Button
                small
                tone={p.local_pick ? 'done' : 'ghost'}
                label={p.local_pick ? '★ Local pick' : '☆ Local pick'}
                onPress={() => act(() => updatePlace(p.id, { local_pick: !p.local_pick, ...(!p.local_pick ? { chain: false } : {}) }))}
              />
              <Button
                small
                tone="ghost"
                label={p.chain ? 'Chain → local' : 'Mark as chain'}
                onPress={() => act(() => updatePlace(p.id, { chain: !p.chain }))}
              />
              {p.status === 'active' ? (
                <>
                  <Button small tone="ghost" label="Hide" onPress={() => act(() => updatePlace(p.id, { status: 'hidden' }))} />
                  <Button small tone="ghost" label="Closed" onPress={() => act(() => updatePlace(p.id, { status: 'closed' }))} />
                </>
              ) : (
                <Button small tone="ghost" label="Show again" onPress={() => act(() => updatePlace(p.id, { status: 'active' }))} />
              )}
              <Button
                small
                tone="ghost"
                label={open === p.id ? 'Done' : 'Note & cuisine'}
                onPress={() => {
                  setOpen(open === p.id ? undefined : p.id);
                  setNote(p.note ?? '');
                }}
              />
            </View>
            {open === p.id ? (
              <View style={{ gap: Spacing.two, marginTop: Spacing.two }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                  {EAT_CATEGORIES.map((c) => (
                    <Chip key={c.id} label={c.label} active={p.categories.includes(c.id)} onPress={() => toggleCategory(p, c.id)} />
                  ))}
                </View>
                <Field
                  label="Note shown in the app (optional)"
                  value={note}
                  onChangeText={setNote}
                  placeholder="Get the green chile cheeseburger."
                  maxLength={300}
                />
                <Button
                  small
                  label="Save note"
                  onPress={() => act(() => updatePlace(p.id, { note: note.trim() || null }))}
                />
              </View>
            ) : null}
          </Card>
        ))}
      </View>
    </AdminPage>
  );
}

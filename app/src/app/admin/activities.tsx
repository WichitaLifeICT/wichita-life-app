import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Chip, Field, LoadState, T, Tag } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { ACTIVITY_KINDS, type Activity, type ActivityKind } from '@/lib/activities';
import { deleteActivity, getAdminActivities, saveActivity } from '@/lib/admin';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Form = {
  id?: string;
  name: string;
  kinds: ActivityKind[];
  blurb: string;
  address: string;
  website: string;
  /** Empty = year-round. */
  months: number[];
  active: boolean;
  sort: number;
};

const blank = (sort: number): Form => ({ name: '', kinds: [], blurb: '', address: '', website: '', months: [], active: true, sort });

const formFrom = (a: Activity): Form => ({
  id: a.id,
  name: a.name,
  kinds: a.kinds,
  blurb: a.blurb,
  address: a.address,
  website: a.website ?? '',
  months: a.months ?? [],
  active: a.active ?? true,
  sort: a.sort ?? 0,
});

const kindLabel = (k: ActivityKind) => ACTIVITY_KINDS.find((x) => x.id === k)?.label ?? k;
const monthsLabel = (m?: number[] | null) =>
  m?.length ? m.map((n) => MONTHS[n - 1]).join(', ') : 'Year-round';

export default function AdminActivities() {
  const q = useQuery(getAdminActivities);
  const [form, setForm] = useState<Form>();
  const [confirmDelete, setConfirmDelete] = useState<string>();
  const [error, setError] = useState<string>();
  const list = q.data ?? [];

  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = async () => {
    if (!form) return;
    const website = form.website.trim();
    if (website && !/^https?:\/\//.test(website)) return setError('The link should start with https://');
    setError(undefined);
    try {
      const { id, ...rest } = form;
      await saveActivity(
        {
          ...rest,
          name: form.name.trim(),
          blurb: form.blurb.trim(),
          address: form.address.trim(),
          website: website || null,
          months: form.months.length ? [...form.months].sort((a, b) => a - b) : null,
        },
        id,
      );
      setForm(undefined);
      q.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = (a: Activity) => {
    if (confirmDelete !== a.id) return setConfirmDelete(a.id);
    deleteActivity(a.id).then(q.refresh, (e: Error) => setError(e.message));
  };

  const valid = form && form.name.trim().length >= 2 && form.kinds.length > 0 && form.address.trim().length > 0;

  return (
    <AdminPage title="Activities" refreshing={q.refreshing} onRefresh={q.refresh}>
      {error ? <T color={Brand.redText}>{error}</T> : null}

      {form ? (
        <Card style={{ gap: Spacing.three }}>
          <T variant="cardTitle">{form.id ? 'Edit activity' : 'New activity'}</T>
          <Field label="Name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} placeholder="Topgolf" />
          <T variant="label">Filters it shows under</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {ACTIVITY_KINDS.map((k) => (
              <Chip
                key={k.id}
                label={k.label}
                active={form.kinds.includes(k.id)}
                onPress={() => setForm({ ...form, kinds: toggle(form.kinds, k.id) })}
              />
            ))}
          </View>
          <Field
            label="Short description"
            value={form.blurb}
            onChangeText={(blurb) => setForm({ ...form, blurb })}
            placeholder="Hitting bays, food and drinks, plus a 9-hole mini course."
            multiline
            maxLength={300}
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />
          <Field
            label="Address (used for Directions)"
            value={form.address}
            onChangeText={(address) => setForm({ ...form, address })}
            placeholder="2976 N Greenwich Rd, Wichita, KS 67226"
          />
          <Field
            label="Their website or social page (optional)"
            value={form.website}
            onChangeText={(website) => setForm({ ...form, website })}
            placeholder="https://"
            autoCapitalize="none"
            keyboardType="url"
          />
          <T variant="label">Open these months (leave all off for year-round)</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {MONTHS.map((m, i) => (
              <Chip
                key={m}
                label={m}
                active={form.months.includes(i + 1)}
                onPress={() => setForm({ ...form, months: toggle(form.months, i + 1) })}
              />
            ))}
          </View>
          <Chip label="Showing in the app" active={form.active} onPress={() => setForm({ ...form, active: !form.active })} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            <Button tone="red" label="Save" disabled={!valid} onPress={save} />
            <Button tone="ghost" label="Cancel" onPress={() => setForm(undefined)} />
          </View>
        </Card>
      ) : (
        <Button
          tone="red"
          label="+ New activity"
          onPress={() => setForm(blank(Math.max(0, ...list.map((a) => a.sort ?? 0)) + 1))}
        />
      )}

      <T variant="small">
        These are the spots behind Explore → “What should we do?”. Seasonal ones only come up in the months you
        pick, and show under “📅 In season now” then.
      </T>

      <LoadState loading={q.loading} error={q.error} empty={q.data && !list.length ? 'No activities yet.' : undefined} />

      {list.map((a) => (
        <Card key={a.id} style={{ gap: Spacing.one, opacity: a.active === false ? 0.6 : 1 }}>
          <T variant="small">
            {a.kinds.map(kindLabel).join(' · ')} · {monthsLabel(a.months)}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <T variant="cardTitle" style={{ flexShrink: 1 }}>
              {a.name}
            </T>
            {a.active === false ? <Tag label="Hidden" /> : null}
          </View>
          <T variant="small">{a.blurb}</T>
          <T variant="small">{a.address}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one }}>
            <Button small tone="ghost" label="Edit" onPress={() => setForm(formFrom(a))} />
            <Button
              small
              tone="ghost"
              label={a.active === false ? 'Show' : 'Hide'}
              onPress={() =>
                saveActivity({ ...formFrom(a), website: a.website ?? null, months: a.months ?? null, active: a.active === false }, a.id)
                  .then(q.refresh, (e: Error) => setError(e.message))
              }
            />
            <Button
              small
              tone="ghost"
              label={confirmDelete === a.id ? 'Tap again to delete' : 'Delete'}
              onPress={() => remove(a)}
            />
          </View>
        </Card>
      ))}
    </AdminPage>
  );
}

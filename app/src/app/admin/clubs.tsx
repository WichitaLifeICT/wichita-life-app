import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Chip, Field, LoadState, SectionHeader, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { deleteClub, getAdminClubs, saveClub } from '@/lib/admin';
import { CLUB_CATEGORIES, CLUB_LABEL, normalizeUrl, type Club, type ClubCategory } from '@/lib/clubs';

type Form = { id?: string; name: string; category: ClubCategory; url: string; schedule: string; description: string };

const blank = (): Form => ({ name: '', category: 'run', url: '', schedule: '', description: '' });
const formFrom = (c: Club): Form => ({
  id: c.id,
  name: c.name,
  category: c.category,
  url: c.url,
  schedule: c.schedule ?? '',
  description: c.description ?? '',
});
const today = () => new Date().toISOString().slice(0, 10);

/** Clubs around town on the Meet tab, plus members' suggestions waiting for approval. */
export default function AdminClubs() {
  const q = useQuery(getAdminClubs);
  const [form, setForm] = useState<Form>();
  const [confirmDelete, setConfirmDelete] = useState<string>();
  const [error, setError] = useState<string>();

  const run = (p: Promise<unknown>) => p.then(q.refresh, (e: Error) => setError(e.message));

  const save = async () => {
    if (!form) return;
    setError(undefined);
    try {
      await saveClub(
        {
          name: form.name.trim(),
          category: form.category,
          url: normalizeUrl(form.url),
          schedule: form.schedule.trim() || null,
          description: form.description.trim() || null,
          // Saving here (including "Edit first" on a suggestion) publishes it.
          active: true,
          pending: false,
          verified_on: today(),
          priority: q.data?.find((c) => c.id === form.id)?.priority ?? 0,
        },
        form.id,
      );
      setForm(undefined);
      q.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const approve = (c: Club) => run(saveClub({ ...c, active: true, pending: false, verified_on: today() }, c.id));
  const toggle = (c: Club) => run(saveClub({ ...c, active: !c.active }, c.id));
  // Pinning puts a club above the ones already pinned.
  const pin = (c: Club) => {
    const top = Math.max(0, ...(q.data ?? []).map((x) => x.priority));
    run(saveClub({ ...c, priority: c.priority ? 0 : top + 1 }, c.id));
  };
  const remove = (c: Club) => {
    if (confirmDelete !== c.id) return setConfirmDelete(c.id);
    run(deleteClub(c.id));
  };

  const pending = q.data?.filter((c) => c.pending) ?? [];
  const listed = (q.data?.filter((c) => !c.pending) ?? []).sort((a, b) => b.priority - a.priority);

  const card = (c: Club, actions: React.ReactNode) => (
    <Card key={c.id} style={{ gap: Spacing.two, opacity: c.active || c.pending ? 1 : 0.6 }}>
      <T variant="small">
        {c.priority ? '📌 Pinned · ' : ''}
        {CLUB_LABEL[c.category]}
        {c.active || c.pending ? '' : ' · hidden'}
        {c.verified_on ? ` · checked ${c.verified_on.slice(0, 10)}` : ''}
      </T>
      <T variant="cardTitle">{c.name}</T>
      {c.schedule ? <T variant="small">{c.schedule}</T> : null}
      {c.description ? <T variant="small">{c.description}</T> : null}
      <T variant="small" color={Brand.blue}>
        {c.url}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>{actions}</View>
    </Card>
  );

  return (
    <AdminPage title="Clubs" refreshing={q.refreshing} onRefresh={q.refresh}>
      <T variant="small">Clubs that already meet around town, shown on Meet with a link to their page.</T>
      {error ? <T color={Brand.red}>{error}</T> : null}

      {form ? (
        <Card style={{ gap: Spacing.three }}>
          <T variant="cardTitle">{form.id ? 'Edit club' : 'New club'}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {CLUB_CATEGORIES.map((c) => (
              <Chip key={c.id} label={c.label} active={form.category === c.id} onPress={() => setForm({ ...form, category: c.id })} />
            ))}
          </View>
          <Field label="Name" value={form.name} onChangeText={(name) => setForm({ ...form, name })} maxLength={80} />
          <Field
            label="Link (Instagram, Facebook or website)"
            value={form.url}
            onChangeText={(url) => setForm({ ...form, url })}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Field
            label="When and where (optional)"
            value={form.schedule}
            onChangeText={(schedule) => setForm({ ...form, schedule })}
            placeholder="Saturdays 8am at Exploration Place"
            maxLength={200}
          />
          <Field
            label="Description (optional)"
            value={form.description}
            onChangeText={(description) => setForm({ ...form, description })}
            multiline
            maxLength={300}
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button
              tone="red"
              label="Save"
              disabled={form.name.trim().length < 2 || !normalizeUrl(form.url)}
              onPress={save}
            />
            <Button tone="ghost" label="Cancel" onPress={() => setForm(undefined)} />
          </View>
        </Card>
      ) : (
        <Button tone="red" label="+ New club" onPress={() => setForm(blank())} />
      )}

      <LoadState loading={q.loading} error={q.error} />

      {pending.length ? (
        <View style={{ gap: Spacing.two + 2 }}>
          <SectionHeader title="Suggested by members" />
          {pending.map((c) =>
            card(
              c,
              <>
                <Button small tone="red" label="Approve" onPress={() => approve(c)} />
                <Button small tone="ghost" label="Edit first" onPress={() => setForm(formFrom(c))} />
                <Button small tone="ghost" label={confirmDelete === c.id ? 'Tap again to delete' : 'Delete'} onPress={() => remove(c)} />
              </>,
            ),
          )}
        </View>
      ) : null}

      <View style={{ gap: Spacing.two + 2 }}>
        {listed.length ? <SectionHeader title={`All clubs (${listed.length})`} /> : null}
        {listed.map((c) =>
          card(
            c,
            <>
              <Button small tone="ghost" label="Edit" onPress={() => setForm(formFrom(c))} />
              <Button small tone="ghost" label={c.priority ? 'Unpin' : 'Pin to top'} onPress={() => pin(c)} />
              <Button small tone="ghost" label={c.active ? 'Hide' : 'Show'} onPress={() => toggle(c)} />
              <Button small tone="ghost" label={confirmDelete === c.id ? 'Tap again to delete' : 'Delete'} onPress={() => remove(c)} />
            </>,
          ),
        )}
      </View>
    </AdminPage>
  );
}

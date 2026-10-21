import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Field, LoadState, SectionHeader, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { deleteGroup, getAdminGroups, saveGroup, type AdminGroup } from '@/lib/admin';

type Form = { id?: string; name: string; description: string };

const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export default function AdminGroups() {
  const q = useQuery(getAdminGroups);
  const [form, setForm] = useState<Form>();
  const [confirmDelete, setConfirmDelete] = useState<string>();
  const [error, setError] = useState<string>();

  const save = async () => {
    if (!form) return;
    setError(undefined);
    try {
      const existing = q.data?.find((g) => g.id === form.id);
      await saveGroup(
        {
          name: form.name.trim(),
          // Keep a group's address once it exists, so shared links keep working.
          slug: existing?.slug ?? slugify(form.name),
          description: form.description.trim() || null,
        },
        form.id,
      );
      setForm(undefined);
      q.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message.includes('duplicate') ? 'There’s already a group with that name.' : message);
    }
  };

  const remove = (g: AdminGroup) => {
    if (confirmDelete !== g.id) return setConfirmDelete(g.id);
    deleteGroup(g.id).then(q.refresh, (e: Error) => setError(e.message));
  };

  return (
    <AdminPage title="Groups" refreshing={q.refreshing} onRefresh={q.refresh}>
      {error ? <T color={Brand.red}>{error}</T> : null}

      {form ? (
        <Card style={{ gap: Spacing.three }}>
          <T variant="cardTitle">{form.id ? 'Edit group' : 'New group'}</T>
          <Field
            label="Name"
            value={form.name}
            onChangeText={(name) => setForm({ ...form, name })}
            placeholder="Run Club"
            maxLength={60}
          />
          <Field
            label="Description"
            value={form.description}
            onChangeText={(description) => setForm({ ...form, description })}
            placeholder="Easy 5Ks around the river, Saturday mornings."
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button tone="red" label="Save" disabled={form.name.trim().length < 2} onPress={save} />
            <Button tone="ghost" label="Cancel" onPress={() => setForm(undefined)} />
          </View>
        </Card>
      ) : (
        <Button tone="red" label="+ New group" onPress={() => setForm({ name: '', description: '' })} />
      )}

      <LoadState loading={q.loading} error={q.error} empty={q.data && !q.data.length ? 'No groups yet.' : undefined} />

      <View style={{ gap: Spacing.two + 2 }}>
        {q.data?.length ? <SectionHeader title="All groups" /> : null}
        {q.data?.map((g) => (
          <Card key={g.id} style={{ gap: Spacing.two }}>
            <T variant="cardTitle">{g.name}</T>
            {g.description ? <T variant="small">{g.description}</T> : null}
            <T variant="small">
              {g.member_count} member{g.member_count === 1 ? '' : 's'}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
              <Button
                small
                tone="ghost"
                label="Edit"
                onPress={() => setForm({ id: g.id, name: g.name, description: g.description ?? '' })}
              />
              <Button
                small
                tone="ghost"
                label={confirmDelete === g.id ? 'Tap again to delete' : 'Delete'}
                onPress={() => remove(g)}
              />
            </View>
          </Card>
        ))}
      </View>
    </AdminPage>
  );
}

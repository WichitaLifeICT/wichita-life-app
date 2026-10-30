import { useState } from 'react';
import { View } from 'react-native';

import { errorMessage } from '@/lib/format';
import { AdminPage } from '@/components/admin-page';
import { Button, Card, Field, LoadState, SectionHeader, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { deleteGroup, getAdminGroups, getGroupMembers, saveGroup, type AdminGroup } from '@/lib/admin';

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
  const [members, setMembers] = useState<Record<string, Awaited<ReturnType<typeof getGroupMembers>>>>({});

  const toggleMembers = (g: AdminGroup) => {
    if (members[g.id]) return setMembers(({ [g.id]: _, ...rest }) => rest);
    getGroupMembers(g.id).then(
      (list) => setMembers((all) => ({ ...all, [g.id]: list })),
      (e: Error) => setError(e.message),
    );
  };

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
          // Saving a member's suggestion publishes it.
          pending: false,
        },
        form.id,
      );
      setForm(undefined);
      q.refresh();
    } catch (e) {
      const message = errorMessage(e);
      setError(message.includes('duplicate') ? 'There’s already a group with that name.' : message);
    }
  };

  const approve = (g: AdminGroup) =>
    saveGroup({ name: g.name, slug: g.slug, description: g.description, pending: false }, g.id).then(q.refresh, (e: Error) =>
      setError(e.message),
    );

  const remove = (g: AdminGroup) => {
    if (confirmDelete !== g.id) return setConfirmDelete(g.id);
    deleteGroup(g.id).then(q.refresh, (e: Error) => setError(e.message));
  };

  return (
    <AdminPage title="Groups" refreshing={q.refreshing} onRefresh={q.refresh}>
      {error ? <T color={Brand.redText}>{error}</T> : null}

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
        {q.data?.some((g) => g.pending) ? <SectionHeader title="Suggested by members" /> : null}
        {q.data
          ?.filter((g) => g.pending)
          .map((g) => (
            <Card key={g.id} style={{ gap: Spacing.two }}>
              <T variant="cardTitle">{g.name}</T>
              {g.description ? <T variant="small">{g.description}</T> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                <Button small tone="red" label="Approve" onPress={() => approve(g)} />
                <Button
                  small
                  tone="ghost"
                  label="Edit first"
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
        {q.data?.length ? <SectionHeader title="All groups" /> : null}
        {q.data?.filter((g) => !g.pending).map((g) => (
          <Card key={g.id} style={{ gap: Spacing.two }}>
            <T variant="cardTitle">{g.name}</T>
            {g.description ? <T variant="small">{g.description}</T> : null}
            <T variant="small">
              {g.member_count} member{g.member_count === 1 ? '' : 's'}
            </T>
            {members[g.id] ? (
              <View style={{ gap: 2 }}>
                {members[g.id].length ? null : <T variant="small">No members yet.</T>}
                {members[g.id].map((m) => (
                  <T key={m.user_id} variant="small">
                    {m.display_name || 'Member'} · {m.email} · joined {m.joined_at.slice(0, 10)}
                  </T>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
              <Button
                small
                tone="ghost"
                label={members[g.id] ? 'Hide members' : 'Members'}
                onPress={() => toggleMembers(g)}
              />
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

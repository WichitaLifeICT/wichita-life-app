import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Chip, Field, LoadState, SectionHeader, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import {
  getAdminGroups,
  getAttendees,
  getMeetups,
  saveMeetup,
  sendGroupPush,
  type AdminMeetup,
  type Person,
} from '@/lib/admin';
import { normalizeUrl } from '@/lib/clubs';
import { fromWichitaInput, shortDay, timeLabel, toWichitaInput } from '@/lib/format';

const STATUSES: AdminMeetup['status'][] = ['draft', 'open', 'closed', 'canceled'];

type Form = {
  id?: string;
  title: string;
  description: string;
  starts: string;
  area: string;
  capacity: string;
  status: AdminMeetup['status'];
  signup_url: string;
  group_id: string | null;
  /** New meetups for a group: tell its members. */
  notify: boolean;
  venue: string;
  address: string;
  host_notes: string;
};

const blank = (): Form => ({
  title: '',
  description: '',
  starts: '',
  area: '',
  capacity: '8',
  status: 'open',
  signup_url: '',
  group_id: null,
  notify: true,
  venue: '',
  address: '',
  host_notes: '',
});

const formFrom = (m: AdminMeetup): Form => ({
  id: m.id,
  title: m.title,
  description: m.description ?? '',
  starts: toWichitaInput(m.starts_at),
  area: m.area,
  capacity: String(m.capacity),
  status: m.status,
  signup_url: m.signup_url ?? '',
  group_id: m.group_id,
  notify: false,
  venue: m.details?.venue ?? '',
  address: m.details?.address ?? '',
  host_notes: m.details?.host_notes ?? '',
});

export default function AdminMeetups() {
  const q = useQuery(getMeetups);
  const groups = useQuery(getAdminGroups);
  const [sentNote, setSentNote] = useState<string>();
  const [form, setForm] = useState<Form>();
  const [people, setPeople] = useState<Record<string, (Person & { status: string })[]>>({});
  const [error, setError] = useState<string>();
  const set = (k: keyof Form) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    const starts_at = fromWichitaInput(form.starts);
    const capacity = parseInt(form.capacity, 10);
    if (!starts_at) return setError('Start time looks like 2026-11-06 18:30');
    if (!(capacity > 0)) return setError('Capacity has to be a number above 0');
    setError(undefined);
    setSentNote(undefined);
    try {
      const fields = {
        title: form.title.trim(),
        area: form.area.trim(),
      };
      await saveMeetup(
        {
          title: form.title.trim(),
          description: form.description.trim() || null,
          starts_at,
          area: form.area.trim(),
          capacity,
          status: form.status,
          signup_url: normalizeUrl(form.signup_url) || null,
          group_id: form.group_id,
          venue: form.venue.trim(),
          address: form.address.trim() || null,
          host_notes: form.host_notes.trim() || null,
        },
        form.id,
      );
      const group = groups.data?.find((g) => g.id === form.group_id);
      if (group && form.notify && form.status === 'open') {
        const r = await sendGroupPush(
          group.id,
          `New ${group.name} meetup`,
          `${fields.title} · ${shortDay(starts_at)} ${timeLabel(starts_at)} · ${fields.area}`,
          { path: `/group/${group.slug}` },
        ).catch(() => null);
        setSentNote(r ? `Told ${group.name} members (${r.sent} phone${r.sent === 1 ? '' : 's'}).` : `Saved, but the notification to ${group.name} didn’t send.`);
      }
      setForm(undefined);
      q.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const loadPeople = (id: string) =>
    getAttendees(id).then(
      (list) => setPeople((all) => ({ ...all, [id]: list })),
      (e: Error) => setError(e.message),
    );

  // Meetups hosted elsewhere (a sign-up link) don't need a private venue.
  const valid = form && form.title.trim() && form.area.trim() && (form.venue.trim() || form.signup_url.trim()) && form.starts.trim();

  return (
    <AdminPage title="Meetups" refreshing={q.refreshing} onRefresh={q.refresh}>
      {error ? <T color={Brand.red}>{error}</T> : null}
      {sentNote ? <T color={Brand.blue}>{sentNote}</T> : null}

      {form ? (
        <Card style={{ gap: Spacing.three }}>
          <T variant="cardTitle">{form.id ? 'Edit meetup' : 'New meetup'}</T>
          <Field label="Title" value={form.title} onChangeText={set('title')} placeholder="Dinner Club: Delano" />
          <Field
            label="Description"
            value={form.description}
            onChangeText={set('description')}
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <Field
            label="Starts (Wichita time)"
            value={form.starts}
            onChangeText={set('starts')}
            placeholder="2026-11-06 18:30"
          />
          <Field label="Area (shown to everyone)" value={form.area} onChangeText={set('area')} placeholder="Delano" />
          <Field label="Spots" value={form.capacity} onChangeText={set('capacity')} keyboardType="number-pad" />
          <Field
            label="Sign-up link (optional: for meetups hosted elsewhere, replaces RSVP)"
            value={form.signup_url}
            onChangeText={set('signup_url')}
            placeholder="https://wichitalife.dnnr.io/"
            autoCapitalize="none"
            keyboardType="url"
          />
          <T variant="label">Group</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            <Chip label="No group" active={!form.group_id} onPress={() => setForm({ ...form, group_id: null })} />
            {groups.data
              ?.filter((g) => !g.pending)
              .map((g) => (
                <Chip key={g.id} label={g.name} active={form.group_id === g.id} onPress={() => setForm({ ...form, group_id: g.id })} />
              ))}
          </View>
          {form.group_id ? (
            <Chip
              label={form.notify ? '✓ Notify group members when I save' : 'Notify group members when I save'}
              active={form.notify}
              onPress={() => setForm({ ...form, notify: !form.notify })}
            />
          ) : null}
          <Field label="Venue (only people going see this)" value={form.venue} onChangeText={set('venue')} />
          <Field label="Address" value={form.address} onChangeText={set('address')} />
          <Field label="Notes for attendees" value={form.host_notes} onChangeText={set('host_notes')} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {STATUSES.map((s) => (
              <Chip key={s} label={s} active={form.status === s} onPress={() => setForm({ ...form, status: s })} />
            ))}
          </View>
          <T variant="small">Only open meetups show in the app. Draft, closed and canceled are hidden.</T>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button tone="red" label="Save" disabled={!valid} onPress={save} />
            <Button tone="ghost" label="Cancel" onPress={() => setForm(undefined)} />
          </View>
        </Card>
      ) : (
        <Button tone="red" label="+ New meetup" onPress={() => setForm(blank())} />
      )}

      <LoadState loading={q.loading} error={q.error} empty={q.data && !q.data.length ? 'No meetups yet.' : undefined} />

      <View style={{ gap: Spacing.two + 2 }}>
        {q.data?.length ? <SectionHeader title="All meetups" /> : null}
        {q.data?.map((m) => (
          <Card key={m.id} style={{ gap: Spacing.two }}>
            <T variant="small">
              {shortDay(m.starts_at)} · {timeLabel(m.starts_at)} · {m.area} · {m.status}
            </T>
            <T variant="cardTitle">{m.title}</T>
            {m.group_id ? (
              <T variant="small" color={Brand.blue}>
                {groups.data?.find((g) => g.id === m.group_id)?.name ?? 'Group'} meetup
              </T>
            ) : null}
            {m.source_key?.startsWith('dnnr:') ? (
              <T variant="small">Synced from wichitalife.dnnr.io every morning; edit dates there.</T>
            ) : null}
            <T variant="small">
              {m.signup_url ? `Sign-up link: ${m.signup_url}` : `${m.going_count}/${m.capacity} going`}
              {!m.signup_url && m.waitlist_count ? ` · ${m.waitlist_count} on the waitlist` : ''}
              {m.details ? ` · ${m.details.venue}` : ''}
            </T>
            {people[m.id] ? (
              <View style={{ gap: 2 }}>
                {people[m.id].length ? null : <T variant="small">No RSVPs yet.</T>}
                {people[m.id].map((p) => (
                  <T key={p.user_id} variant="small">
                    {p.status === 'waitlist' ? '⏳ ' : '✓ '}
                    {p.display_name || 'Member'} · {p.email}
                  </T>
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: Spacing.two }}>
              <Button small tone="ghost" label="Edit" onPress={() => setForm(formFrom(m))} />
              <Button small tone="ghost" label="Who's going" onPress={() => loadPeople(m.id)} />
            </View>
          </Card>
        ))}
      </View>
    </AdminPage>
  );
}

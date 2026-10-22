import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Chip, Field, LoadState, SectionHeader, T, Tag } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { deleteWeekly, getAdminWeekly, saveWeekly } from '@/lib/admin';
import { DAY_SHORT, daysLabel, hoursLabel, KINDS, kindOf, type WeeklyKind, type WeeklySpecial } from '@/lib/weekly';

type Form = {
  id?: string;
  kind: WeeklyKind;
  title: string;
  venue: string;
  address: string;
  days: number[];
  starts: string;
  ends: string;
  details: string;
  url: string;
  active: boolean;
  verified_on: string | null;
};

const blank = (): Form => ({
  kind: 'happy_hour',
  title: '',
  venue: '',
  address: '',
  days: [1, 2, 3, 4, 5],
  starts: '4pm',
  ends: '6pm',
  details: '',
  url: '',
  active: true,
  verified_on: null,
});

const formFrom = (s: WeeklySpecial): Form => ({
  ...s,
  address: s.address ?? '',
  starts: s.starts ? s.starts.slice(0, 5) : '',
  ends: s.ends ? s.ends.slice(0, 5) : '',
  details: s.details ?? '',
  url: s.url ?? '',
});

/** "4pm", "4:30 pm", "16:00" → "16:00"; "" → null; anything else → undefined (invalid). */
function parseTime(text: string): string | null | undefined {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Today's date in Wichita, for "checked on". */
const wichitaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());

export default function AdminWeekly() {
  const q = useQuery(async () => ({ list: await getAdminWeekly(), now: Date.now() }));
  const [form, setForm] = useState<Form>();
  const [confirmDelete, setConfirmDelete] = useState<string>();
  const [error, setError] = useState<string>();
  const set = (k: 'title' | 'venue' | 'address' | 'starts' | 'ends' | 'details' | 'url') => (v: string) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async (checkedToday = false) => {
    if (!form) return;
    const starts = parseTime(form.starts);
    const ends = parseTime(form.ends);
    if (starts === undefined || ends === undefined) return setError('Times look like 4pm, 6:30pm or 16:00');
    if (!starts && ends) return setError('Add a start time too, or clear the end time');
    const url = form.url.trim();
    if (url && !/^https?:\/\//.test(url)) return setError('The link should start with https://');
    setError(undefined);
    try {
      const { id, ...rest } = form;
      await saveWeekly(
        {
          ...rest,
          title: form.title.trim(),
          venue: form.venue.trim(),
          address: form.address.trim() || null,
          days: [...form.days].sort(),
          starts,
          ends,
          details: form.details.trim() || null,
          url: url || null,
          verified_on: checkedToday ? wichitaToday() : form.verified_on,
        },
        id,
      );
      setForm(undefined);
      q.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const markChecked = (s: WeeklySpecial) =>
    saveWeekly({ ...s, verified_on: wichitaToday() }, s.id).then(q.refresh, (e: Error) => setError(e.message));

  const remove = (s: WeeklySpecial) => {
    if (confirmDelete !== s.id) return setConfirmDelete(s.id);
    deleteWeekly(s.id).then(q.refresh, (e: Error) => setError(e.message));
  };

  const valid = form && form.title.trim().length >= 2 && form.venue.trim().length >= 2 && form.days.length > 0;

  return (
    <AdminPage title="Weekly specials" refreshing={q.refreshing} onRefresh={q.refresh}>
      {error ? <T color={Brand.red}>{error}</T> : null}

      {form ? (
        <Card style={{ gap: Spacing.three }}>
          <T variant="cardTitle">{form.id ? 'Edit special' : 'New special'}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {KINDS.map((k) => (
              <Chip
                key={k.id}
                label={`${k.icon} ${k.label}`}
                active={form.kind === k.id}
                onPress={() => setForm({ ...form, kind: k.id })}
              />
            ))}
          </View>
          <Field label="What's the deal" value={form.title} onChangeText={set('title')} placeholder="$3 wells and half-price apps" />
          <Field label="Place" value={form.venue} onChangeText={set('venue')} placeholder="Central Standard Brewing" />
          <Field label="Address (optional)" value={form.address} onChangeText={set('address')} />
          <T variant="label">Days</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {DAY_SHORT.map((d, i) => (
              <Chip
                key={d}
                label={d}
                active={form.days.includes(i)}
                onPress={() =>
                  setForm({ ...form, days: form.days.includes(i) ? form.days.filter((x) => x !== i) : [...form.days, i] })
                }
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <View style={{ flex: 1 }}>
              <Field label="Starts" value={form.starts} onChangeText={set('starts')} placeholder="4pm" autoCapitalize="none" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Ends (optional)" value={form.ends} onChangeText={set('ends')} placeholder="6pm" autoCapitalize="none" />
            </View>
          </View>
          <Field
            label="Details (optional)"
            value={form.details}
            onChangeText={set('details')}
            placeholder="Bar only. Trivia starts at 7, teams up to 6."
            multiline
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />
          <Field label="Link (optional)" value={form.url} onChangeText={set('url')} placeholder="https://" autoCapitalize="none" keyboardType="url" />
          <Chip label="Showing in the app" active={form.active} onPress={() => setForm({ ...form, active: !form.active })} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            <Button tone="red" label="Save" disabled={!valid} onPress={() => save()} />
            <Button tone="ghost" label="Save & mark checked today" disabled={!valid} onPress={() => save(true)} />
            <Button tone="ghost" label="Cancel" onPress={() => setForm(undefined)} />
          </View>
        </Card>
      ) : (
        <Button tone="red" label="+ New weekly special" onPress={() => setForm(blank())} />
      )}

      <T variant="small">
        These show on Events → Weekly. Mark one checked when you confirm it’s still running; anything not checked
        in 60 days is flagged here so the list stays trustworthy.
      </T>

      <LoadState loading={q.loading} error={q.error} empty={q.data && !q.data.list.length ? 'Nothing on the list yet.' : undefined} />

      <View style={{ gap: Spacing.two + 2 }}>
        {q.data?.list.length ? <SectionHeader title={`All specials (${q.data.list.length})`} /> : null}
        {q.data?.list.map((s) => {
          const k = kindOf(s.kind);
          const stale = !s.verified_on || Date.parse(s.verified_on) < q.data!.now - 60 * 86_400_000;
          return (
            <Card key={s.id} style={{ gap: Spacing.one }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}>
                <T variant="small" style={{ flex: 1 }}>
                  {k.icon} {k.label} · {daysLabel(s.days)} · {hoursLabel(s)}
                </T>
                {!s.active ? <Tag label="hidden" tone="blue" /> : stale ? <Tag label="check it" /> : <Tag label="checked" tone="green" />}
              </View>
              <T variant="cardTitle">{s.title}</T>
              <T variant="small">
                {s.venue}
                {s.verified_on ? ` · checked ${s.verified_on.slice(0, 10)}` : ''}
              </T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one }}>
                <Button small tone="ghost" label="Edit" onPress={() => setForm(formFrom(s))} />
                <Button small tone="ghost" label="Still running ✓" onPress={() => markChecked(s)} />
                <Button
                  small
                  tone="ghost"
                  label={confirmDelete === s.id ? 'Tap again to delete' : 'Delete'}
                  onPress={() => remove(s)}
                />
              </View>
            </Card>
          );
        })}
      </View>
    </AdminPage>
  );
}

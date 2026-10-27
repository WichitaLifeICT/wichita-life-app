import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Field, LoadState, SectionHeader, T, Tag } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { deleteSponsor, getAdminSponsors, saveSponsor, type AdminSponsor } from '@/lib/admin';
import { fromWichitaInput, shortDay, toWichitaInput } from '@/lib/format';

type Form = {
  id?: string;
  name: string;
  headline: string;
  body: string;
  cta_label: string;
  cta_url: string;
  starts: string;
  ends: string;
};

const blank = (): Form => {
  const now = new Date();
  return {
    name: '',
    headline: '',
    body: '',
    cta_label: '',
    cta_url: '',
    starts: toWichitaInput(now.toISOString()),
    ends: toWichitaInput(new Date(now.getTime() + 30 * 86_400_000).toISOString()),
  };
};

const formFrom = (s: AdminSponsor): Form => ({
  id: s.id,
  name: s.name,
  headline: s.headline,
  body: s.body ?? '',
  cta_label: s.cta_label ?? '',
  cta_url: s.cta_url ?? '',
  starts: toWichitaInput(s.starts_at),
  ends: toWichitaInput(s.ends_at),
});

export default function AdminSponsors() {
  const q = useQuery(async () => ({ sponsors: await getAdminSponsors(), now: Date.now() }));
  const [form, setForm] = useState<Form>();
  const [confirmDelete, setConfirmDelete] = useState<string>();
  const [error, setError] = useState<string>();
  const set = (k: keyof Omit<Form, 'id'>) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    const starts_at = fromWichitaInput(form.starts);
    const ends_at = fromWichitaInput(form.ends);
    if (!starts_at || !ends_at) return setError('Dates look like 2026-11-06 18:30');
    if (ends_at <= starts_at) return setError('It has to end after it starts');
    const url = form.cta_url.trim();
    if (url && !/^https?:\/\//.test(url)) return setError('The link should start with https://');
    setError(undefined);
    try {
      await saveSponsor(
        {
          name: form.name.trim(),
          headline: form.headline.trim(),
          body: form.body.trim() || null,
          cta_label: form.cta_label.trim() || null,
          cta_url: url || null,
          starts_at,
          ends_at,
        },
        form.id,
      );
      setForm(undefined);
      q.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = (s: AdminSponsor) => {
    if (confirmDelete !== s.id) return setConfirmDelete(s.id);
    deleteSponsor(s.id).then(q.refresh, (e: Error) => setError(e.message));
  };

  const status = (s: AdminSponsor, now: number) =>
    Date.parse(s.ends_at) < now ? 'ended' : Date.parse(s.starts_at) > now ? 'scheduled' : 'live';

  return (
    <AdminPage title="Sponsors" refreshing={q.refreshing} onRefresh={q.refresh}>
      {error ? <T color={Brand.redText}>{error}</T> : null}

      {form ? (
        <Card style={{ gap: Spacing.three }}>
          <T variant="cardTitle">{form.id ? 'Edit sponsor' : 'New sponsor'}</T>
          <Field label="Sponsor name" value={form.name} onChangeText={set('name')} placeholder="Reverie Coffee" />
          <Field
            label="Headline"
            value={form.headline}
            onChangeText={set('headline')}
            placeholder="Fall drinks are back"
            maxLength={90}
          />
          <Field
            label="Text (optional)"
            value={form.body}
            onChangeText={set('body')}
            multiline
            style={{ minHeight: 70, textAlignVertical: 'top' }}
          />
          <Field label="Button label (optional)" value={form.cta_label} onChangeText={set('cta_label')} placeholder="See the menu" />
          <Field
            label="Button link (optional)"
            value={form.cta_url}
            onChangeText={set('cta_url')}
            placeholder="https://"
            autoCapitalize="none"
            keyboardType="url"
          />
          <Field label="Starts (Wichita time)" value={form.starts} onChangeText={set('starts')} />
          <Field label="Ends (Wichita time)" value={form.ends} onChangeText={set('ends')} />
          <T variant="small">
            Shows as a sponsored card in the Today feed between these dates. If two overlap, the one that started
            most recently shows. Taps are counted in PostHog (sponsor_clicked).
          </T>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button
              tone="red"
              label="Save"
              disabled={!form.name.trim() || !form.headline.trim()}
              onPress={save}
            />
            <Button tone="ghost" label="Cancel" onPress={() => setForm(undefined)} />
          </View>
        </Card>
      ) : (
        <Button tone="red" label="+ New sponsor" onPress={() => setForm(blank())} />
      )}

      <LoadState
        loading={q.loading}
        error={q.error}
        empty={q.data && !q.data.sponsors.length ? 'No sponsors yet.' : undefined}
      />

      <View style={{ gap: Spacing.two + 2 }}>
        {q.data?.sponsors.length ? <SectionHeader title="All sponsors" /> : null}
        {q.data?.sponsors.map((s) => {
          const st = status(s, q.data!.now);
          return (
            <Card key={s.id} style={{ gap: Spacing.two }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}>
                <T variant="small" style={{ flex: 1 }}>
                  {s.name} · {shortDay(s.starts_at)} – {shortDay(s.ends_at)}
                </T>
                <Tag label={st} tone={st === 'live' ? 'green' : st === 'scheduled' ? 'blue' : 'orange'} />
              </View>
              <T variant="cardTitle">{s.headline}</T>
              {s.body ? <T variant="small">{s.body}</T> : null}
              {s.cta_url ? (
                <T variant="small">
                  {s.cta_label || 'Learn more'} → {s.cta_url}
                </T>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                <Button small tone="ghost" label="Edit" onPress={() => setForm(formFrom(s))} />
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

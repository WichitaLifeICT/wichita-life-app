import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Results } from '@/components/poll-card';
import { Button, Card, Chip, Field, LoadState, SectionHeader, T, Tag } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { getAdminPolls, savePoll, setPollOptionStatus, type AdminPoll } from '@/lib/admin';
import { fromWichitaInput, shortDay, toWichitaInput } from '@/lib/format';
import { getPollResults, type PollResult } from '@/lib/polls';

type Form = {
  id?: string;
  question: string;
  description: string;
  starts: string;
  ends: string;
  options: string;
  published: boolean;
  allow_suggestions: boolean;
};

const blank = (): Form => {
  const now = new Date();
  return {
    question: '',
    description: '',
    starts: toWichitaInput(now.toISOString()),
    ends: toWichitaInput(new Date(now.getTime() + 7 * 86_400_000).toISOString()),
    options: '',
    published: true,
    allow_suggestions: true,
  };
};

const formFrom = (p: AdminPoll): Form => ({
  id: p.id,
  question: p.question,
  description: p.description ?? '',
  starts: toWichitaInput(p.starts_at),
  ends: toWichitaInput(p.ends_at),
  options: '',
  published: p.published,
  allow_suggestions: p.allow_suggestions,
});

export default function AdminPolls() {
  const q = useQuery(getAdminPolls);
  const [form, setForm] = useState<Form>();
  const [results, setResults] = useState<Record<string, PollResult[]>>({});
  const [error, setError] = useState<string>();
  const set = (k: 'question' | 'description' | 'starts' | 'ends' | 'options') => (v: string) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    const starts_at = fromWichitaInput(form.starts);
    const ends_at = fromWichitaInput(form.ends);
    if (!starts_at || !ends_at) return setError('Times look like 2026-11-06 18:30');
    if (ends_at <= starts_at) return setError('The vote has to end after it starts');
    const options = [...new Set(form.options.split('\n').map((o) => o.trim()).filter(Boolean))];
    if (!form.id && options.length < 2) return setError('Add at least 2 options, one per line');
    setError(undefined);
    try {
      await savePoll(
        {
          question: form.question.trim(),
          description: form.description.trim() || null,
          starts_at,
          ends_at,
          published: form.published,
          allow_suggestions: form.allow_suggestions,
        },
        options,
        form.id,
      );
      setForm(undefined);
      q.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const act = (fn: () => Promise<unknown>) => fn().then(q.refresh, (e: Error) => setError(e.message));
  const loadResults = (id: string) =>
    getPollResults(id).then(
      (r) => setResults((all) => ({ ...all, [id]: r })),
      (e: Error) => setError(e.message),
    );

  return (
    <AdminPage title="Votes" refreshing={q.refreshing} onRefresh={q.refresh}>
      {error ? <T color={Brand.red}>{error}</T> : null}

      {form ? (
        <Card style={{ gap: Spacing.three }}>
          <T variant="cardTitle">{form.id ? 'Edit vote' : 'New vote'}</T>
          <Field
            label="Question"
            value={form.question}
            onChangeText={set('question')}
            placeholder="Best coffee in Wichita?"
          />
          <Field
            label="Description (optional)"
            value={form.description}
            onChangeText={set('description')}
            multiline
            style={{ minHeight: 60, textAlignVertical: 'top' }}
          />
          <Field label="Opens (Wichita time)" value={form.starts} onChangeText={set('starts')} />
          <Field label="Closes (Wichita time)" value={form.ends} onChangeText={set('ends')} />
          <Field
            label={form.id ? 'Add options (one per line)' : 'Options (one per line)'}
            value={form.options}
            onChangeText={set('options')}
            multiline
            placeholder={'Reverie Coffee Roasters\nEspresso to Go Go\nLittle Jerry’s'}
            style={{ minHeight: 120, textAlignVertical: 'top' }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            <Chip
              label="Members can suggest options"
              active={form.allow_suggestions}
              onPress={() => setForm({ ...form, allow_suggestions: !form.allow_suggestions })}
            />
            <Chip
              label="Published"
              active={form.published}
              onPress={() => setForm({ ...form, published: !form.published })}
            />
          </View>
          <T variant="small">
            The open vote that closes soonest shows at the top of Explore and on Today. Results show to people
            who voted, and to everyone once it closes.
          </T>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button tone="red" label="Save" disabled={!form.question.trim()} onPress={save} />
            <Button tone="ghost" label="Cancel" onPress={() => setForm(undefined)} />
          </View>
        </Card>
      ) : (
        <Button tone="red" label="+ New vote" onPress={() => setForm(blank())} />
      )}

      <LoadState loading={q.loading} error={q.error} empty={q.data && !q.data.length ? 'No votes yet.' : undefined} />

      <View style={{ gap: Spacing.two + 2 }}>
        {q.data?.length ? <SectionHeader title="All votes" /> : null}
        {q.data?.map((p) => {
          const pending = p.options.filter((o) => o.status === 'pending');
          const approved = p.options.filter((o) => o.status === 'approved');
          return (
            <Card key={p.id} style={{ gap: Spacing.two }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two }}>
                <T variant="small" style={{ flex: 1 }}>
                  {shortDay(p.starts_at)} – {shortDay(p.ends_at)} · {p.vote_count} votes
                  {p.published ? '' : ' · hidden'}
                </T>
                {pending.length ? <Tag label={`${pending.length} suggested`} /> : null}
              </View>
              <T variant="cardTitle">{p.question}</T>
              <T variant="small">{approved.map((o) => o.label).join(' · ') || 'No options yet'}</T>

              {pending.map((o) => (
                <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                  <T style={{ flex: 1 }}>Suggested: {o.label}</T>
                  <Button small tone="done" label="Add" onPress={() => act(() => setPollOptionStatus(o.id, 'approved'))} />
                  <Button small tone="ghost" label="No" onPress={() => act(() => setPollOptionStatus(o.id, 'removed'))} />
                </View>
              ))}

              {results[p.id] ? <Results results={results[p.id]} myVote={null} /> : null}

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                <Button small tone="ghost" label="Edit" onPress={() => setForm(formFrom(p))} />
                <Button small tone="ghost" label="Results" onPress={() => loadResults(p.id)} />
              </View>
            </Card>
          );
        })}
      </View>
    </AdminPage>
  );
}

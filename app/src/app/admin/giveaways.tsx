import { useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Field, LoadState, SectionHeader, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import { drawWinner, getGiveaways, getWinner, saveGiveaway, type AdminGiveaway, type Person } from '@/lib/admin';
import { fromWichitaInput, shortDay, toWichitaInput } from '@/lib/format';

type Form = {
  id?: string;
  title: string;
  prize: string;
  description: string;
  sponsor_name: string;
  prize_value: string;
  prize_provider: string;
  starts: string;
  ends: string;
  rules_url: string;
};

function blankForm(): Form {
  const ends = new Date(Date.now() + 7 * 86_400_000);
  return {
    title: '',
    prize: '',
    description: '',
    sponsor_name: '',
    prize_value: '',
    prize_provider: '',
    starts: toWichitaInput(new Date().toISOString()),
    ends: toWichitaInput(ends.toISOString()).slice(0, 10) + ' 20:00',
    rules_url: 'https://app.wichitalifeict.com/giveaway-rules',
  };
}

function formFrom(g: AdminGiveaway): Form {
  return {
    id: g.id,
    title: g.title,
    prize: g.prize,
    description: g.description ?? '',
    sponsor_name: g.sponsor_name ?? '',
    prize_value: g.prize_value == null ? '' : String(g.prize_value),
    prize_provider: g.prize_provider ?? '',
    starts: toWichitaInput(g.starts_at),
    ends: toWichitaInput(g.ends_at),
    rules_url: g.rules_url,
  };
}

export default function AdminGiveaways() {
  const q = useQuery(async () =>
    (await getGiveaways()).map((g) => ({ ...g, ended: Date.parse(g.ends_at) < Date.now() })),
  );
  const [form, setForm] = useState<Form>();
  const [winners, setWinners] = useState<Record<string, (Person & { entries: number }) | null>>({});
  const [confirmDraw, setConfirmDraw] = useState<string>();
  const [error, setError] = useState<string>();
  const set = (k: keyof Form) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    const starts_at = fromWichitaInput(form.starts);
    const ends_at = fromWichitaInput(form.ends);
    if (!starts_at || !ends_at) return setError('Dates look like 2026-10-25 20:00');
    if (ends_at <= starts_at) return setError('The end has to be after the start');
    const value = Number(form.prize_value.replace(/[$,\s]/g, ''));
    if (!form.prize_value.trim() || !Number.isFinite(value) || value < 0) {
      return setError('Add the prize’s approximate value in dollars (the official rules need it)');
    }
    setError(undefined);
    try {
      await saveGiveaway(
        {
          title: form.title.trim(),
          prize: form.prize.trim(),
          description: form.description.trim() || null,
          sponsor_name: form.sponsor_name.trim() || null,
          prize_value: value,
          prize_provider: form.prize_provider.trim() || null,
          starts_at,
          ends_at,
          rules_url: form.rules_url.trim(),
        },
        form.id,
      );
      setForm(undefined);
      q.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const draw = async (id: string) => {
    if (confirmDraw !== id) return setConfirmDraw(id);
    setConfirmDraw(undefined);
    try {
      const w = await drawWinner(id);
      setWinners((all) => ({ ...all, [id]: w }));
      q.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const showWinner = async (id: string) => {
    try {
      const w = await getWinner(id);
      setWinners((all) => ({ ...all, [id]: w }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const valid = form && form.title.trim() && form.prize.trim() && /^https?:\/\//.test(form.rules_url.trim());

  return (
    <AdminPage title="Giveaways" refreshing={q.refreshing} onRefresh={q.refresh}>
      {error ? <T color={Brand.redText}>{error}</T> : null}

      {form ? (
        <Card style={{ gap: Spacing.three }}>
          <T variant="cardTitle">{form.id ? 'Edit giveaway' : 'New giveaway'}</T>
          <Field label="Title" value={form.title} onChangeText={set('title')} placeholder="Dinner for two, on us" />
          <Field label="Prize" value={form.prize} onChangeText={set('prize')} placeholder="$100 gift card to Public" />
          <Field
            label="Description"
            value={form.description}
            onChangeText={set('description')}
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <Field label="Sponsor (optional)" value={form.sponsor_name} onChangeText={set('sponsor_name')} />
          <Field
            label="Prize value in dollars"
            value={form.prize_value}
            onChangeText={set('prize_value')}
            placeholder="20"
            keyboardType="decimal-pad"
          />
          <Field
            label="Prize provided by (optional)"
            value={form.prize_provider}
            onChangeText={set('prize_provider')}
            placeholder="The business donating the prize, if any"
          />
          <Field
            label="Starts (Wichita time)"
            value={form.starts}
            onChangeText={set('starts')}
            placeholder="2026-10-20 06:00"
          />
          <Field
            label="Ends (Wichita time)"
            value={form.ends}
            onChangeText={set('ends')}
            placeholder="2026-10-25 20:00"
          />
          <Field
            label="Official rules link"
            value={form.rules_url}
            onChangeText={set('rules_url')}
            autoCapitalize="none"
            keyboardType="url"
          />
          <T variant="small">
            The app writes the official rules for each giveaway from these details (at
            app.wichitalifeict.com/giveaway-rules). Only change the link if a giveaway needs its own custom rules.
          </T>
          <View style={{ flexDirection: 'row', gap: Spacing.two }}>
            <Button tone="red" label="Save" disabled={!valid} onPress={save} />
            <Button tone="ghost" label="Cancel" onPress={() => setForm(undefined)} />
          </View>
        </Card>
      ) : (
        <Button tone="red" label="+ New giveaway" onPress={() => setForm(blankForm())} />
      )}

      <LoadState
        loading={q.loading}
        error={q.error}
        empty={q.data && !q.data.length ? 'No giveaways yet.' : undefined}
      />

      <View style={{ gap: Spacing.two + 2 }}>
        {q.data?.length ? <SectionHeader title="All giveaways" /> : null}
        {q.data?.map((g) => {
          const ended = g.ended;
          const winner = winners[g.id];
          return (
            <Card key={g.id} style={{ gap: Spacing.two }}>
              <T variant="small">
                {shortDay(g.starts_at)} – {shortDay(g.ends_at)} · {g.entrant_count.toLocaleString()} entered
                {ended ? ' · ended' : ''}
              </T>
              <T variant="cardTitle">{g.title}</T>
              <T variant="small">{g.prize}</T>
              {winner ? (
                <T>
                  Winner: <T style={{ fontFamily: Fonts.bodyBold }}>{winner.display_name || 'Member'}</T> (
                  {winner.email}) · {winner.entries} entries
                </T>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                <Button small tone="ghost" label="Edit" onPress={() => setForm(formFrom(g))} />
                {g.winner_user_id && winner === undefined ? (
                  <Button small tone="ghost" label="Show winner" onPress={() => showWinner(g.id)} />
                ) : null}
                {g.entrant_count > 0 ? (
                  <Button
                    small
                    tone={confirmDraw === g.id ? 'red' : 'navy'}
                    label={
                      confirmDraw === g.id
                        ? 'Tap again to draw'
                        : g.winner_user_id
                          ? 'Redraw winner'
                          : ended
                            ? 'Draw winner'
                            : 'Draw winner early'
                    }
                    onPress={() => draw(g.id)}
                  />
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>
      <T variant="small">
        Winners are drawn at random, weighted by entries (bonus entries count). Contact the winner by email and keep a
        record of the draw.
      </T>
    </AdminPage>
  );
}

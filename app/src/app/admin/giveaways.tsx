import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Field, LoadState, SectionHeader, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useQuery } from '@/hooks/use-query';
import {
  drawWinner,
  getEntrants,
  getGiveaways,
  getWinner,
  saveGiveaway,
  setWinnerLabel,
  winnerLabelFrom,
  type AdminGiveaway,
  type Entrant,
  type Person,
} from '@/lib/admin';
import { fromWichitaInput, shortDay, toWichitaInput, errorMessage } from '@/lib/format';

// How each kind of entry reads in the entrants list.
const ENTRY_KINDS: Record<string, string> = {
  enter: 'Entered',
  newsletter: 'Newsletter',
  save_event: 'Saved an event',
  referral: 'Invited friends',
  poll_vote: 'Voted',
  daily_question: 'Question of the day',
};

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
  const q = useQuery(async () => {
    const list = await getGiveaways();
    // Each drawn winner loads with the list, so it shows without an extra tap.
    return Promise.all(
      list.map(async (g) => ({
        ...g,
        ended: Date.parse(g.ends_at) < Date.now(),
        drawn: g.winner_user_id ? await getWinner(g.id).catch(() => null) : null,
      })),
    );
  });
  const [form, setForm] = useState<Form>();
  const [winners, setWinners] = useState<Record<string, (Person & { entries: number }) | null>>({});
  const [confirmDraw, setConfirmDraw] = useState<string>();
  const [drawing, setDrawing] = useState<string>();
  // Problems drawing a winner show on that giveaway's card, where staff are looking.
  const [drawErrors, setDrawErrors] = useState<Record<string, string>>({});
  // The entrants list open under each giveaway (null while it loads).
  const [entrants, setEntrants] = useState<Record<string, Entrant[] | null>>({});
  // What staff typed for "winner shown in the app", per giveaway (prefilled from the winner's name).
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();

  const showInApp = async (id: string, label: string | null) => {
    setError(undefined);
    try {
      await setWinnerLabel(id, label);
      q.refresh();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const toggleEntrants = async (id: string) => {
    if (id in entrants) {
      setEntrants(({ [id]: _, ...rest }) => rest);
      return;
    }
    setEntrants((all) => ({ ...all, [id]: null }));
    try {
      const list = await getEntrants(id);
      setEntrants((all) => ({ ...all, [id]: list }));
    } catch (e) {
      setEntrants(({ [id]: _, ...rest }) => rest);
      setError(errorMessage(e));
    }
  };
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
      setError(errorMessage(e));
    }
  };

  const draw = async (id: string) => {
    setDrawing(id);
    setDrawErrors(({ [id]: _, ...rest }) => rest);
    try {
      const w = await drawWinner(id);
      // A redraw replaces the winner, so stop showing the old one in the app.
      if (q.data?.find((g) => g.id === id)?.winner_label) await setWinnerLabel(id, null);
      setWinners((all) => ({ ...all, [id]: w }));
      setLabels(({ [id]: _, ...rest }) => rest);
      setConfirmDraw(undefined);
      q.refresh();
    } catch (e) {
      setDrawErrors((all) => ({ ...all, [id]: errorMessage(e) }));
    } finally {
      setDrawing(undefined);
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
          const winner = winners[g.id] ?? g.drawn;
          // The name to show in the app: what staff typed, else first name + last initial of the winner.
          const draft = labels[g.id] ?? (winner ? winnerLabelFrom(winner.display_name || '') : '');
          return (
            <Card key={g.id} style={{ gap: Spacing.two }}>
              <T variant="small">
                {shortDay(g.starts_at)} – {shortDay(g.ends_at)} · {g.entrant_count.toLocaleString()} entered
                {ended ? ' · ended' : ''}
              </T>
              <T variant="cardTitle">{g.title}</T>
              <T variant="small">{g.prize}</T>
              {winner ? (
                <View style={[styles.box, { borderColor: Brand.orange }]}>
                  <T variant="label">🏆 Winner</T>
                  <T variant="title">{winner.display_name || 'Member'}</T>
                  <T selectable>{winner.email}</T>
                  <T variant="small">
                    {winner.entries} {winner.entries === 1 ? 'entry' : 'entries'}. Email them from
                    update@wichitalifeict.com; they have 7 days to reply and claim the prize.
                  </T>
                </View>
              ) : null}
              {g.winner_label ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two }}>
                  <T variant="small">
                    Shown on the Play tab as the last winner:{' '}
                    <T variant="small" style={{ fontFamily: Fonts.bodyBold }}>
                      {g.winner_label}
                    </T>
                  </T>
                  <Button small tone="ghost" label="Stop showing" onPress={() => showInApp(g.id, null)} />
                </View>
              ) : g.winner_user_id && ended ? (
                <View style={{ gap: Spacing.one }}>
                  <Field
                    label="Once they’ve claimed the prize, show them in the app as"
                    value={draft}
                    onChangeText={(v) => setLabels((all) => ({ ...all, [g.id]: v }))}
                    placeholder="Sarah M."
                    maxLength={40}
                  />
                  <T variant="small">First name and last initial only. It shows on the Play tab until the next winner.</T>
                  <View style={{ flexDirection: 'row' }}>
                    <Button
                      small
                      tone="navy"
                      label="Show in the app"
                      disabled={!draft.trim()}
                      onPress={() => showInApp(g.id, draft.trim())}
                    />
                  </View>
                </View>
              ) : null}
              {g.id in entrants ? <EntrantList list={entrants[g.id]} /> : null}
              {confirmDraw === g.id ? (
                <View style={[styles.box, { borderColor: Brand.red }]}>
                  <T style={{ fontFamily: Fonts.bodyBold }}>
                    {g.winner_user_id ? 'Draw a new winner? This replaces the current one.' : 'Draw the winner now?'}
                  </T>
                  <T variant="small">
                    The app picks one person at random; more entries means better odds. Staff and test accounts can’t
                    win. The winner is saved here.
                  </T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                    <Button
                      small
                      tone="red"
                      label={drawing === g.id ? 'Drawing…' : 'Yes, draw the winner'}
                      disabled={drawing === g.id}
                      onPress={() => draw(g.id)}
                    />
                    <Button small tone="ghost" label="Cancel" onPress={() => setConfirmDraw(undefined)} />
                  </View>
                </View>
              ) : null}
              {drawErrors[g.id] ? <T color={Brand.redText}>Couldn’t draw a winner: {drawErrors[g.id]}</T> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
                <Button small tone="ghost" label="Edit" onPress={() => setForm(formFrom(g))} />
                {g.entrant_count > 0 ? (
                  <Button
                    small
                    tone="ghost"
                    label={g.id in entrants ? 'Hide entrants' : `See who entered (${g.entrant_count})`}
                    onPress={() => toggleEntrants(g.id)}
                  />
                ) : null}
                {g.entrant_count > 0 && confirmDraw !== g.id ? (
                  <Button
                    small
                    tone="navy"
                    label={g.winner_user_id ? 'Redraw winner' : ended ? 'Draw winner' : 'Draw winner early'}
                    onPress={() => setConfirmDraw(g.id)}
                  />
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>
      <T variant="small">
        Winners are drawn at random, weighted by entries (bonus entries count). Staff accounts can enter to try things
        out, but they never count and can’t win (the official rules exclude Wichita Life employees). Contact the winner
        by email and keep a record of the draw.
      </T>
    </AdminPage>
  );
}

/** Who entered one giveaway: name, email, total entries and where the bonus entries came from. */
function EntrantList({ list }: { list: Entrant[] | null }) {
  if (!list) return <T variant="small">Loading entrants…</T>;
  const counted = list.filter((e) => !e.staff);
  const total = counted.reduce((n, e) => n + Number(e.entries), 0);
  return (
    <View style={{ gap: Spacing.two, paddingVertical: Spacing.one }}>
      <T variant="small" style={{ fontFamily: Fonts.bodyBold }}>
        {counted.length} {counted.length === 1 ? 'person' : 'people'} · {total} entries in all
        {counted.length < list.length ? ' (staff and test accounts don’t count)' : ''}
      </T>
      {list.map((e) => (
        <View key={e.user_id} style={{ gap: 2, opacity: e.staff ? 0.6 : 1 }}>
          <T>
            <T style={{ fontFamily: Fonts.bodyBold }}>{e.display_name || 'Member'}</T> · {e.entries}{' '}
            {Number(e.entries) === 1 ? 'entry' : 'entries'}
            {e.staff ? ' · staff or test account: doesn’t count, can’t win' : ''}
          </T>
          <T variant="small">{e.email}</T>
          <T variant="small">
            {Object.entries(e.kinds)
              .map(([kind, n]) => `${ENTRY_KINDS[kind] ?? kind}${n > 1 ? ` ×${n}` : ''}`)
              .join(' · ')}{' '}
            · first entry {shortDay(e.entered_at)}
          </T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 2, borderRadius: 12, padding: Spacing.three, gap: Spacing.one },
});

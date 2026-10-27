import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Field, Sticker, T } from '@/components/ui';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTrack } from '@/lib/analytics';
import { useRequireSignIn } from '@/lib/auth';
import { shortDay } from '@/lib/format';
import { suggestOption, vote, type PollResult, type PollState } from '@/lib/polls';

const votesLabel = (n: number) => `${n.toLocaleString()} vote${n === 1 ? '' : 's'}`;
const answersLabel = (n: number) => `${n.toLocaleString()} answer${n === 1 ? '' : 's'}`;
// Wichita Sky Blue 1 from the brand palette, so the daily question stands apart from Wichita votes.
const SKY_BLUE = '#6AA1D6';

/**
 * The open community vote: pick one, then see how Wichita voted. The question of the day uses the
 * same card on Today; answering it during a giveaway enters you, +1 entry a day.
 */
export function PollCard({
  state,
  onChanged,
  giveawayOpen = false,
}: {
  state: PollState;
  onChanged: () => void;
  giveawayOpen?: boolean;
}) {
  const { poll, myVote, results, mySuggestions } = state;
  const track = useTrack();
  const requireSignIn = useRequireSignIn();
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState('');
  const [notice, setNotice] = useState<string>();
  const [thanks, setThanks] = useState(false);

  const showResults = results && !changing;

  const pick = async (optionId: string) => {
    if (!requireSignIn(poll.daily ? 'Sign in to answer' : 'Sign in to vote')) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await vote(poll.id, optionId, Boolean(myVote));
      track('poll_voted', { poll_id: poll.id, changed: Boolean(myVote), daily: poll.daily });
      setChanging(false);
      onChanged();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const suggest = async () => {
    if (!requireSignIn('Sign in to suggest a place')) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await suggestOption(poll.id, suggestion);
      track('poll_suggested', { poll_id: poll.id });
      setSuggestion('');
      setSuggesting(false);
      setThanks(true);
      onChanged();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sticker color={poll.daily ? SKY_BLUE : Brand.orange} shadow={Brand.navy}>
      <T variant="label" color={Brand.navy}>
        {poll.daily ? 'Question of the day' : 'Wichita votes'}
      </T>
      <T variant="title" color={Brand.navy}>
        {poll.question}
      </T>
      {poll.description ? (
        <T variant="small" color={Brand.navy}>
          {poll.description}
        </T>
      ) : null}
      <T variant="small" color={Brand.navy}>
        {poll.daily
          ? `${answersLabel(poll.vote_count)} so far${giveawayOpen ? ' · answer for +1 giveaway entry today' : ''}`
          : `${votesLabel(poll.vote_count)} · closes ${shortDay(poll.ends_at)}`}
      </T>

      {showResults ? (
        <Results results={results} myVote={myVote} />
      ) : (
        <View style={{ gap: Spacing.two }}>
          {poll.options.map((o) => (
            <Pressable
              key={o.id}
              accessibilityRole="button"
              disabled={busy}
              onPress={() => pick(o.id)}
              style={({ pressed }) => [styles.option, o.id === myVote && styles.optionMine, pressed && { opacity: 0.8 }]}>
              <T style={styles.optionText}>{o.label}</T>
            </Pressable>
          ))}
          {!myVote ? (
            <T variant="small" color={Brand.navy}>
              {poll.daily ? 'Answer to see what Wichita said.' : 'Vote to see the results.'}
            </T>
          ) : null}
        </View>
      )}

      {mySuggestions.length ? (
        <T variant="small" color={Brand.navy}>
          In review: {mySuggestions.join(', ')}
        </T>
      ) : null}
      {thanks ? (
        <T variant="small" color={Brand.navy}>
          Thanks! It’ll show up once the Wichita Life team approves it.
        </T>
      ) : null}
      {notice ? (
        <T variant="small" color={Brand.red}>
          {notice}
        </T>
      ) : null}

      {suggesting ? (
        <Card style={{ gap: Spacing.two }}>
          <Field
            label="Your suggestion"
            value={suggestion}
            onChangeText={setSuggestion}
            placeholder="Name of the place"
            maxLength={120}
            autoFocus
          />
          <View style={styles.row}>
            <Button small tone="red" label={busy ? 'Sending…' : 'Suggest'} disabled={busy || !suggestion.trim()} onPress={suggest} />
            <Button small tone="ghost" label="Cancel" onPress={() => setSuggesting(false)} />
          </View>
        </Card>
      ) : (
        <View style={styles.row}>
          {showResults && state.open ? (
            <Button small tone="ghost" label={poll.daily ? 'Change my answer' : 'Change my vote'} onPress={() => setChanging(true)} />
          ) : null}
          {changing ? <Button small tone="ghost" label="Keep my vote" onPress={() => setChanging(false)} /> : null}
          {state.open && poll.allow_suggestions ? (
            <Button
              small
              tone="ghost"
              label="+ Suggest one"
              onPress={() => requireSignIn('Sign in to suggest a place') && setSuggesting(true)}
            />
          ) : null}
        </View>
      )}
    </Sticker>
  );
}

/** Bars for each option; your pick is marked. */
export function Results({ results, myVote }: { results: PollResult[]; myVote: string | null }) {
  const total = results.reduce((n, r) => n + r.votes, 0);
  return (
    <View style={{ gap: Spacing.two }}>
      {results.map((r) => {
        const pct = total ? Math.round((r.votes / total) * 100) : 0;
        return (
          <View key={r.option_id} style={styles.bar}>
            <View style={[styles.barFill, { width: `${pct}%` }, r.option_id === myVote && styles.barMine]} />
            <T style={styles.barLabel} numberOfLines={1}>
              {r.option_id === myVote ? '✓ ' : ''}
              {r.label}
            </T>
            <T style={styles.barPct}>{pct}%</T>
          </View>
        );
      })}
    </View>
  );
}

/** A closed vote: the winner and the final split. */
export function PastPoll({ state, label }: { state: PollState; label?: string }) {
  const theme = useTheme();
  const winner = state.results?.[0];
  const total = state.results?.reduce((n, r) => n + r.votes, 0) ?? 0;
  return (
    <Card style={{ gap: Spacing.one }}>
      {label ? <T variant="small">{label}</T> : null}
      <T variant="small">
        {state.poll.question} · {state.poll.daily ? answersLabel(state.poll.vote_count) : votesLabel(state.poll.vote_count)}
      </T>
      {winner ? (
        <T variant="cardTitle" color={theme.heading}>
          🏆 {winner.label}
          {total ? ` · ${Math.round((winner.votes / total) * 100)}%` : ''}
        </T>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  option: {
    backgroundColor: Brand.white,
    borderWidth: 2,
    borderColor: Brand.navy,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  optionMine: { backgroundColor: '#FFE9C7' },
  optionText: { fontFamily: Fonts.display, fontSize: 15, color: Brand.navy },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.white,
    borderWidth: 2,
    borderColor: Brand.navy,
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#FFD9A0' },
  barMine: { backgroundColor: '#FFC56B' },
  barLabel: { flex: 1, fontFamily: Fonts.display, fontSize: 14.5, color: Brand.navy },
  barPct: { fontFamily: Fonts.display, fontSize: 14.5, color: Brand.navy, marginLeft: Spacing.two },
});

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

/** The open community vote: pick one, then see how Wichita voted. */
export function PollCard({ state, onChanged }: { state: PollState; onChanged: () => void }) {
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
    if (!requireSignIn('Sign in to vote')) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await vote(poll.id, optionId, Boolean(myVote));
      track('poll_voted', { poll_id: poll.id, changed: Boolean(myVote) });
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
    <Sticker color={Brand.orange} shadow={Brand.navy}>
      <T variant="label" color={Brand.navy}>
        Wichita votes
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
        {votesLabel(poll.vote_count)} · closes {shortDay(poll.ends_at)}
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
              Vote to see the results.
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
            <Button small tone="ghost" label="Change my vote" onPress={() => setChanging(true)} />
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
export function PastPoll({ state }: { state: PollState }) {
  const theme = useTheme();
  const winner = state.results?.[0];
  return (
    <Card style={{ gap: Spacing.one }}>
      <T variant="small">
        {state.poll.question} · {votesLabel(state.poll.vote_count)}
      </T>
      {winner ? (
        <T variant="cardTitle" color={theme.heading}>
          🏆 {winner.label}
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

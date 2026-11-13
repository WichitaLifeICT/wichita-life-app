import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, Chip, Field, T, Tag } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fixEvent, saveVenue, setEventHidden } from '@/lib/admin';
import { errorMessage, fromWichitaInput, toWichitaInput } from '@/lib/format';
import type { EventItem } from '@/lib/types';

type Form = { title: string; venue: string; address: string; starts: string };

// The calendar's stand-ins for "no place": not a venue to fix everywhere.
const NO_PLACE = /^(wichita|west wichita|east wichita|kansas)?$/i;

const formOf = (e: EventItem): Form => ({
  title: e.title,
  venue: e.venue ?? '',
  address: e.address ?? '',
  starts: toWichitaInput(e.starts_at),
});

/**
 * Staff only, at the bottom of an event: hide it from the app, or fix its name, place or time.
 * Fixes stay put when the calendar syncs again (they're locked until you clear them on the
 * calendar itself). Nothing here changes the What's Good calendar website.
 */
export function StaffEventTools({ event, onChanged }: { event: EventItem & { hidden?: boolean; locked_fields?: string[] }; onChanged: () => void }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Form>(() => formOf(event));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [everywhere, setEverywhere] = useState(false);
  const calendarVenue = event.venue?.trim() ?? '';
  const canFixVenue = !NO_PLACE.test(calendarVenue);

  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setNote(undefined);
    try {
      await work();
      setNote(done);
      setEditing(false);
      onChanged();
    } catch (e) {
      setNote(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const starts_at = fromWichitaInput(form.starts);
    if (!starts_at) return setNote('Time looks like 2026-11-14 20:00 (24-hour, Central)');
    if (form.title.trim().length < 2) return setNote('Give it a name');
    const changes: Partial<Pick<EventItem, 'title' | 'venue' | 'address' | 'starts_at'>> = {};
    if (form.title.trim() !== event.title) changes.title = form.title.trim();
    if ((form.venue.trim() || null) !== (event.venue ?? null)) changes.venue = form.venue.trim() || null;
    if ((form.address.trim() || null) !== (event.address ?? null)) changes.address = form.address.trim() || null;
    if (starts_at !== new Date(event.starts_at).toISOString()) changes.starts_at = starts_at;
    if (everywhere && canFixVenue) {
      const name = form.venue.trim();
      const address = form.address.trim();
      if (!name || address.length < 5) return setNote('Add the place and its full address to use it for every event there.');
      const { venue: _v, address: _a, ...rest } = changes;
      return run(async () => {
        await saveVenue({ name, address, calendarName: calendarVenue });
        if (Object.keys(rest).length) await fixEvent(event, rest);
      }, `Saved. Every event at ${calendarVenue} now uses this place, and new ones will too.`);
    }
    if (!Object.keys(changes).length) return setNote('Nothing changed.');
    run(() => fixEvent(event, changes), 'Saved. The calendar sync won’t undo it.');
  };

  return (
    <Card style={{ gap: Spacing.two, borderStyle: 'dashed', borderColor: theme.outline }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
        <T variant="label">Staff</T>
        {event.hidden ? <Tag label="Hidden from the app" /> : null}
        {event.locked_fields?.length ? <Tag label="Fixed by staff" tone="blue" /> : null}
      </View>
      {editing ? (
        <View style={{ gap: Spacing.two }}>
          <Field label="Name" value={form.title} onChangeText={(title) => setForm({ ...form, title })} />
          <Field label="Place" value={form.venue} onChangeText={(venue) => setForm({ ...form, venue })} placeholder="Mort’s Martini & Cigar Bar" />
          <Field label="Address" value={form.address} onChangeText={(address) => setForm({ ...form, address })} placeholder="923 E 1st St N, Wichita" />
          <Field
            label="Starts (Central, 24-hour)"
            value={form.starts}
            onChangeText={(starts) => setForm({ ...form, starts })}
            placeholder="2026-11-14 20:00"
            autoCapitalize="none"
          />
          {canFixVenue ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two }}>
              <Chip label={`Fix place for every event at ${calendarVenue}`} active={everywhere} onPress={() => setEverywhere(!everywhere)} />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            <Button small label={busy ? 'Saving…' : 'Save fix'} disabled={busy} onPress={save} />
            <Button
              small
              tone="ghost"
              label="Cancel"
              onPress={() => {
                setEditing(false);
                setForm(formOf(event));
                setEverywhere(false);
                setNote(undefined);
              }}
            />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          <Button small tone="ghost" label="Fix name, place or time" onPress={() => setEditing(true)} />
          <Button
            small
            tone={event.hidden ? 'navy' : 'red'}
            label={busy ? 'Saving…' : event.hidden ? 'Show in the app again' : 'Hide from the app'}
            disabled={busy}
            onPress={() =>
              run(
                () => setEventHidden(event.id, !event.hidden),
                event.hidden ? 'It’s back in the app.' : 'Hidden. It stays hidden when the calendar syncs.',
              )
            }
          />
        </View>
      )}
      {note ? <T variant="small">{note}</T> : null}
      <T variant="small">Changes here only affect the app, not the events calendar website.</T>
    </Card>
  );
}

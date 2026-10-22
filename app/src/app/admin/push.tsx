import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AdminPage } from '@/components/admin-page';
import { Button, Card, Chip, Field, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { pushAudience, sendPush, type PushTopic } from '@/lib/admin';
import { INTERESTS } from '@/lib/interests';

const TOPICS: { id: PushTopic; label: string; sub: string }[] = [
  { id: 'daily', label: 'Today in Wichita', sub: 'Morning heads-up' },
  { id: 'weekend', label: 'Weekend guide', sub: 'Thursdays' },
  { id: 'giveaways', label: 'Giveaways', sub: 'New giveaways, winners' },
  { id: 'breaking', label: 'Big local news', sub: 'Rare: weather, major news' },
];

export default function AdminPush() {
  const [topic, setTopic] = useState<PushTopic>('daily');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<string>();
  // Empty = everyone with the topic on; otherwise only members who picked one of these interests.
  const [audience, setAudience] = useState<string[]>([]);
  const [reach, setReach] = useState<number>();

  useEffect(() => {
    let live = true;
    pushAudience(topic, audience).then(
      (n) => live && setReach(n),
      () => live && setReach(undefined),
    );
    return () => {
      live = false;
    };
  }, [topic, audience]);

  const send = async () => {
    if (!confirm) return setConfirm(true);
    setConfirm(false);
    try {
      const r = await sendPush(topic, title.trim(), body.trim(), audience);
      setResult(`Sent to ${r.sent} phone${r.sent === 1 ? '' : 's'}.`);
      setTitle('');
      setBody('');
    } catch (e) {
      setResult(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <AdminPage title="Send a push">
      <T variant="small">
        Goes to everyone with the phone app who turned this topic on. Pushes arrive once the iPhone and Android apps are
        out; until then this sends to nobody.
      </T>
      <Card style={{ gap: Spacing.three }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          {TOPICS.map((t) => (
            <Chip key={t.id} label={t.label} active={topic === t.id} onPress={() => setTopic(t.id)} />
          ))}
        </View>
        <T variant="small">{TOPICS.find((t) => t.id === topic)?.sub}</T>
        <T variant="label">Who gets it</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
          <Chip label="Everyone" active={!audience.length} onPress={() => setAudience([])} />
          {INTERESTS.map((i) => (
            <Chip
              key={i.id}
              label={i.label}
              active={audience.includes(i.id)}
              onPress={() =>
                setAudience((a) => (a.includes(i.id) ? a.filter((x) => x !== i.id) : [...a, i.id]))
              }
            />
          ))}
        </View>
        <T variant="small">
          {audience.length ? 'Only members who picked one of these interests. ' : ''}
          {reach === undefined ? '' : `Reaches about ${reach} phone${reach === 1 ? '' : 's'}.`}
        </T>
        <Field label="Title" value={title} onChangeText={setTitle} maxLength={60} placeholder="Weekend guide is here" />
        <Field
          label="Message"
          value={body}
          onChangeText={setBody}
          maxLength={180}
          multiline
          placeholder="Rocky Horror, Halloween Nights and 20 more things to do."
          style={{ minHeight: 70, textAlignVertical: 'top' }}
        />
        <Button
          tone="red"
          label={confirm ? 'Tap again to send now' : 'Send'}
          disabled={!title.trim() || !body.trim()}
          onPress={send}
        />
        {result ? <T color={Brand.blue}>{result}</T> : null}
      </Card>
    </AdminPage>
  );
}

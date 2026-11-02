import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, Chip, ChipRow, Field, T } from '@/components/ui';
import { Brand, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { createPlan, datePresets } from '@/lib/plans';

/** Name a plan and pick its dates from quick choices. Calls onCreated with the new plan's id. */
export function NewPlanForm({ onCreated, cta = 'Create plan' }: { onCreated: (id: string) => void; cta?: string }) {
  const presets = useMemo(() => datePresets(), []);
  const [title, setTitle] = useState('');
  const [preset, setPreset] = useState('weekend');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const chosen = presets.find((p) => p.id === preset)!;

  const create = async () => {
    setBusy(true);
    setError(undefined);
    try {
      onCreated(await createPlan(title || chosen.label, chosen.starts_on, chosen.ends_on));
      setTitle('');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: Spacing.two }}>
      <Field
        label="Plan name"
        value={title}
        onChangeText={setTitle}
        placeholder={preset === 'none' ? 'Date night, Mom’s visit…' : chosen.label}
        maxLength={60}
        returnKeyType="done"
      />
      <T variant="label">When</T>
      <ChipRow>
        {presets.map((p) => (
          <Chip key={p.id} label={p.label} active={preset === p.id} onPress={() => setPreset(p.id)} />
        ))}
      </ChipRow>
      <Button tone="red" label={busy ? 'Creating…' : cta} disabled={busy} onPress={create} />
      {error ? <T color={Brand.redText}>{error}</T> : null}
    </View>
  );
}

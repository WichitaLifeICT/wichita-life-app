// Sends a quick fix to phones that already have the app, without a new store review.
// Usage: npm run update -- production "Fix event times"   (or preview for test builds)
// Uses the same public keys as the store builds (eas.json → build.base.env).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [channel = 'production', ...words] = process.argv.slice(2);
const message = words.join(' ') || 'Quick fix';
if (!['production', 'preview'].includes(channel)) {
  console.error('Channel must be production or preview.');
  process.exit(1);
}
const { build } = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const r = spawnSync('npx', ['eas-cli@latest', 'update', '--channel', channel, '--message', message, '--non-interactive'], {
  stdio: 'inherit',
  env: { ...process.env, ...build.base.env },
});
process.exit(r.status ?? 1);

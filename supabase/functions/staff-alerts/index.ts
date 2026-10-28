// Tells staff when something in Staff tools is waiting. Called by pg_cron with the cron secret and
// { "job": "..." }:
//   reports: every 10 minutes. Each new report on a post or reply gets a push to every staff
//            member's phone and an email, once. Apple expects reports handled within 24 hours.
//   digest:  8am Wichita time, an email listing what's waiting (posts to approve, reports,
//            feedback and nominations, suggestions). Skipped when nothing is waiting.
// Email goes through Resend and needs the RESEND_API_KEY function secret; without it, pushes
// still go out and the response says email is off.

import { adminClient, isCronRequest, json } from '../_shared/admin.ts';
import { sendToMembers, type PushMessage } from '../_shared/push.ts';

const TO = 'update@wichitalifeict.com';
const FROM = 'Wichita Life Staff <staff@notify.wichitalifeict.com>';
const STAFF_TOOLS = 'https://app.wichitalifeict.com/admin';
const TZ = 'America/Chicago';
const DIGEST_HOUR = 8;

type Db = ReturnType<typeof adminClient>;

async function sendEmail(subject: string, lines: string[]) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return 'email off (no RESEND_API_KEY)';
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html =
    `<div style="font-family:sans-serif;font-size:15px;line-height:1.5">` +
    lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join('') +
    `<p style="margin:16px 0"><a href="${STAFF_TOOLS}" style="background:#15294A;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open Staff tools</a></p></div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html, text: [...lines, '', STAFF_TOOLS].join('\n') }),
  });
  return res.ok ? 'sent' : `email failed: ${res.status} ${(await res.text()).slice(0, 200)}`;
}

async function staffIds(db: Db) {
  const { data, error } = await db.from('profiles').select('id').in('role', ['admin', 'moderator']);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => p.id as string);
}

async function reports(db: Db) {
  const { data, error } = await db
    .from('reports')
    .select('id, reason, thread:threads(title), reply:replies(body)')
    .eq('resolved', false)
    .is('alerted_at', null)
    .order('created_at');
  if (error) throw new Error(error.message);
  if (!data?.length) return { reports: 0 };

  const what = (r: (typeof data)[number]) => {
    const t = (Array.isArray(r.thread) ? r.thread[0] : r.thread) as { title: string } | null;
    const p = (Array.isArray(r.reply) ? r.reply[0] : r.reply) as { body: string } | null;
    return t ? `post “${t.title}”` : p ? `reply “${p.body.slice(0, 60)}”` : 'post';
  };
  const n = data.length;
  const message: PushMessage = {
    title: n === 1 ? 'New report on the board' : `${n} new reports on the board`,
    body: n === 1 ? `Someone reported a ${what(data[0])}. Review it within 24 hours.` : 'Review them within 24 hours.',
    data: { path: '/admin/board' },
  };
  const push = await sendToMembers(db, new Map((await staffIds(db)).map((id) => [id, message])));
  const email = await sendEmail(
    message.title,
    data.map((r) => `• ${what(r)}${r.reason ? ` (reason: ${r.reason})` : ''}`).concat('Please review within 24 hours.'),
  );
  await db.from('reports').update({ alerted_at: new Date().toISOString() }).in('id', data.map((r) => r.id));
  return { reports: n, push, email };
}

async function count(q: PromiseLike<{ count: number | null; error: { message: string } | null }>) {
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function digest(db: Db) {
  const hour = +new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(new Date());
  if (hour !== DIGEST_HOUR) return { skipped: `not ${DIGEST_HOUR}am in Wichita` };
  const head = { count: 'exact' as const, head: true };
  const [posts, open, feedback, nominations, votes, specials, clubs, clubUpdates, groups] = await Promise.all([
    count(db.from('threads').select('id', head).eq('status', 'pending')),
    count(db.from('reports').select('id', head).eq('resolved', false)),
    count(db.from('feedback').select('id', head).eq('status', 'new').neq('kind', 'spotlight')),
    count(db.from('feedback').select('id', head).eq('status', 'new').eq('kind', 'spotlight')),
    count(db.from('poll_options').select('id', head).eq('status', 'pending')),
    // Specials members suggested (staff's own unverified ones aren't news every morning).
    count(db.from('weekly_specials').select('id', head).eq('pending', true).not('suggested_by', 'is', null)),
    count(db.from('clubs').select('id', head).eq('pending', true)),
    count(db.from('club_updates').select('id', head).eq('status', 'pending')),
    count(db.from('groups').select('id', head).eq('pending', true)),
  ]);
  const items: [number, string, string][] = [
    [open, 'report', 'reports'],
    [posts, 'post to approve', 'posts to approve'],
    [nominations, 'Spotlight nomination', 'Spotlight nominations'],
    [feedback, 'new feedback note', 'new feedback notes'],
    [votes, 'vote suggestion', 'vote suggestions'],
    [specials, 'suggested weekly special', 'suggested weekly specials'],
    [clubs + clubUpdates, 'club suggestion or update', 'club suggestions and updates'],
    [groups, 'group suggestion', 'group suggestions'],
  ];
  const waiting = items.filter(([n]) => n > 0).map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  if (!waiting.length) return { waiting: 0 };
  const email = await sendEmail(`Wichita Life: ${waiting.join(' · ')}`, [
    'Good morning! Waiting in Staff tools:',
    ...waiting.map((w) => `• ${w}`),
    ...(open ? ['Reports need a look within 24 hours.'] : []),
  ]);
  return { waiting: waiting.length, email };
}

Deno.serve(async (req) => {
  if (!(await isCronRequest(req))) return json({ error: 'Forbidden' }, 403);
  const { job } = await req.json().catch(() => ({ job: null }));
  const db = adminClient();
  try {
    if (job === 'reports') return json(await reports(db));
    if (job === 'digest') return json(await digest(db));
    return json({ error: 'job must be reports or digest' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

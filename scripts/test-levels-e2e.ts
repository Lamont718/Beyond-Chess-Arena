// E2E for XP / levels / avatar-gating against PRODUCTION.
//   npx tsx scripts/test-levels-e2e.ts
const BASE = 'https://beyondchess-arena.vercel.app';

function cookieFrom(res: Response): string {
  const set = res.headers.get('set-cookie') || '';
  return set.split(',').map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
}
const checks: string[] = [];
function expect(label: string, cond: boolean) {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
}

async function main() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'maya', password: 'chess123' }),
  });
  const cookie = cookieFrom(r);

  // A level-1 starter avatar is allowed.
  const ok = await fetch(`${BASE}/api/auth/avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ emoji: '🦊' }),
  });
  expect('level-1 avatar (🦊) accepted', ok.status === 200);

  // A high-level avatar is rejected with 403 for a low-level kid.
  const locked = await fetch(`${BASE}/api/auth/avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ emoji: '👑' }),
  });
  const lockedBody = await locked.json().catch(() => ({}));
  expect('locked avatar (👑) rejected with 403', locked.status === 403);
  expect('rejection mentions the unlock level', String(lockedBody.error || '').includes('Level'));

  // Profile page renders and shows the level chip.
  const prof = await fetch(`${BASE}/players/maya`, { headers: { cookie } });
  const html = await prof.text();
  expect('profile page renders (200)', prof.status === 200);
  // React inserts <!-- --> markers between static text and {expressions}, so
  // match loosely across them.
  expect('profile shows a Level chip', /Level[\s\S]{0,40}(Pawn|Knight|Bishop|Rook|Queen|King|Master)/.test(html));
  expect('profile shows Experience bar', html.includes('Experience'));

  // Reset maya back to her default avatar.
  await fetch(`${BASE}/api/auth/avatar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ emoji: '♟️' }),
  });

  console.log(checks.join('\n'));
  const failed = checks.filter((c) => c.startsWith('FAIL')).length;
  console.log(`\n${failed === 0 ? '✅ ALL PASSED' : `❌ ${failed} FAILED`} (${checks.length} checks)`);
  if (failed) process.exit(1);
}
main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});

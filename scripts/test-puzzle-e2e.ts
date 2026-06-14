// End-to-end test of the Daily Puzzle against PRODUCTION.
// Logs in as a demo kid, fetches today's puzzle, finds the correct mate from the
// verified puzzle set, submits it, and prints the streak result. Run:
//   npx tsx scripts/test-puzzle-e2e.ts
import { getDailyPuzzle, nyDateKey } from '../lib/daily-puzzle';

const BASE = 'https://beyondchess-arena.vercel.app';

function cookieFrom(res: Response): string {
  const set = res.headers.get('set-cookie') || '';
  return set.split(',').map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
}

async function main() {
  // 1. Log in as a demo kid (safe to touch their streak).
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'zoe', password: 'chess123' }),
  });
  console.log('login:', login.status, await login.clone().json().catch(() => ''));
  const cookie = cookieFrom(login);
  if (!cookie) throw new Error('no session cookie');

  // 2. Fetch today's puzzle (server view).
  const pz = await fetch(`${BASE}/api/puzzle`, { headers: { cookie } });
  const pzData = await pz.json();
  console.log('GET /api/puzzle:', pz.status, JSON.stringify(pzData));

  // 3. Find the correct mate from our verified set.
  const todays = getDailyPuzzle(nyDateKey());
  const uci = todays.mates[0];
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  console.log('today id:', todays.id, 'submitting mate:', uci);

  // 4. Submit the solve.
  const solve = await fetch(`${BASE}/api/puzzle/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ from, to, promotion }),
  });
  console.log('POST /api/puzzle/solve:', solve.status, JSON.stringify(await solve.json()));

  // 5. Submit a WRONG move to confirm it is rejected.
  const wrong = await fetch(`${BASE}/api/puzzle/solve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ from: 'a2', to: 'a3' }),
  });
  console.log('wrong move:', wrong.status, JSON.stringify(await wrong.json()));
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});

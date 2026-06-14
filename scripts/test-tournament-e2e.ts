// End-to-end test of Tournaments against PRODUCTION (HTTP) with verification +
// cleanup via the prod DB (Prisma). Creates a tournament, joins 3 demo kids,
// starts it (round-robin), resigns one game, checks standings + auto-scoring,
// ends it, then restores demo-kid stats and deletes all test data.
//   npx tsx scripts/test-tournament-e2e.ts
import { PrismaClient } from '@prisma/client';

const BASE = 'https://beyondchess-arena.vercel.app';
const prisma = new PrismaClient();

function cookieFrom(res: Response): string {
  const set = res.headers.get('set-cookie') || '';
  return set.split(',').map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
}
async function login(username: string, password: string): Promise<string> {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error(`login ${username} failed: ${r.status}`);
  return cookieFrom(r);
}
const checks: string[] = [];
function expect(label: string, cond: boolean) {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) console.error('  ✗', label);
}

async function main() {
  const coach = await login('coach', 'coach123');
  const maya = await login('maya', 'chess123');
  const leo = await login('leo', 'chess123');
  const kai = await login('kai', 'chess123');

  // 1. Coach creates a tournament.
  const created = await fetch(`${BASE}/api/tournaments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: coach },
    body: JSON.stringify({ name: 'E2E Test Cup', timeControlSec: 300, incrementSec: 0 }),
  }).then((r) => r.json());
  const tid: string = created.id;
  expect('coach can create a tournament', !!tid);

  // 2. Three kids join.
  for (const c of [maya, leo, kai]) {
    const r = await fetch(`${BASE}/api/tournaments/${tid}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: c },
      body: '{}',
    });
    expect('kid can join', r.ok);
  }

  // 3. Coach starts → round-robin of 3 players = 3 games.
  const started = await fetch(`${BASE}/api/tournaments/${tid}/start`, {
    method: 'POST',
    headers: { cookie: coach },
  }).then((r) => r.json());
  expect('start created 3 games (round-robin of 3)', started.games === 3);

  const [mayaU, leoU] = await Promise.all([
    prisma.user.findUnique({ where: { username: 'maya' } }),
    prisma.user.findUnique({ where: { username: 'leo' } }),
  ]);
  const snap = {
    maya: { rating: mayaU!.rating, wins: mayaU!.wins, losses: mayaU!.losses, draws: mayaU!.draws },
    leo: { rating: leoU!.rating, wins: leoU!.wins, losses: leoU!.losses, draws: leoU!.draws },
  };

  const games = await prisma.game.findMany({ where: { tournamentId: tid } });
  expect('3 games exist in DB tagged to tournament', games.length === 3);

  // Find the maya-vs-leo game; maya resigns → leo wins.
  const ml = games.find(
    (g) =>
      (g.whiteId === mayaU!.id && g.blackId === leoU!.id) ||
      (g.whiteId === leoU!.id && g.blackId === mayaU!.id)
  )!;
  expect('maya-vs-leo pairing exists', !!ml);

  const resign = await fetch(`${BASE}/api/game/${ml.id}/resign`, { method: 'POST', headers: { cookie: maya } });
  expect('maya can resign her tournament game', resign.ok);

  // 4. Standings updated: leo +1 point/win, maya +1 loss.
  const [leoTP, mayaTP] = await Promise.all([
    prisma.tournamentPlayer.findUnique({ where: { tournamentId_userId: { tournamentId: tid, userId: leoU!.id } } }),
    prisma.tournamentPlayer.findUnique({ where: { tournamentId_userId: { tournamentId: tid, userId: mayaU!.id } } }),
  ]);
  expect('winner (leo) has 1.0 points', leoTP!.points === 1);
  expect('winner (leo) has 1 win', leoTP!.wins === 1);
  expect('loser (maya) has 0 points', mayaTP!.points === 0);
  expect('loser (maya) has 1 loss', mayaTP!.losses === 1);

  // 5. Coach ends the tournament early → completed, remaining games aborted.
  const fin = await fetch(`${BASE}/api/tournaments/${tid}/finish`, { method: 'POST', headers: { cookie: coach } });
  expect('coach can end the tournament', fin.ok);
  const after = await prisma.tournament.findUnique({ where: { id: tid } });
  expect('tournament is completed', after!.status === 'completed');
  const stillActive = await prisma.game.count({ where: { tournamentId: tid, status: 'active' } });
  expect('no games left active after end', stillActive === 0);

  // 6. Cleanup: restore demo-kid stats, delete test games + tournament.
  await prisma.user.update({ where: { id: mayaU!.id }, data: snap.maya });
  await prisma.user.update({ where: { id: leoU!.id }, data: snap.leo });
  await prisma.game.deleteMany({ where: { tournamentId: tid } });
  await prisma.tournament.delete({ where: { id: tid } });
  const gone = await prisma.tournament.findUnique({ where: { id: tid } });
  expect('test tournament + games cleaned up', !gone);

  console.log('\n' + checks.join('\n'));
  const failed = checks.filter((c) => c.startsWith('FAIL')).length;
  console.log(`\n${failed === 0 ? '✅ ALL PASSED' : `❌ ${failed} FAILED`} (${checks.length} checks)`);
  await prisma.$disconnect();
  if (failed) process.exit(1);
}

main().catch(async (e) => {
  console.error('FAILED:', e);
  await prisma.$disconnect();
  process.exit(1);
});

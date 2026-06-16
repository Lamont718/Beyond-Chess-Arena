// E2E for RANKED BOTS against PRODUCTION.  npx tsx scripts/test-bots-e2e.ts
// Verifies: bot game starts, bot auto-replies (move pipeline), resign finalizes
// + moves the KID's rating, and the bot stays a fixed anchor (rating/record unchanged).
import { Chess } from 'chess.js';
import { PrismaClient } from '@prisma/client';

const BASE = process.env.BASE || 'https://beyondchess-arena.vercel.app';
const prisma = new PrismaClient();

function cookieFrom(res: Response): string {
  const set = res.headers.get('set-cookie') || '';
  return set.split(',').map((c) => c.split(';')[0].trim()).filter(Boolean).join('; ');
}
const checks: string[] = [];
function expect(label: string, cond: boolean) {
  checks.push(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
}

async function main() {
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'maya', password: 'chess123' }),
  });
  const cookie = cookieFrom(login);
  expect('login as maya', login.status === 200 && !!cookie);

  const lob0 = await (await fetch(`${BASE}/api/lobby`, { headers: { cookie } })).json();
  const ratingBefore = lob0.me.rating as number;

  const botBefore = await prisma.user.findUnique({ where: { username: 'bot-pixel' } });

  // Start a ranked game vs the Rookie bot, no clock (avoids timeout noise).
  const start = await (await fetch(`${BASE}/api/bot-game`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ level: 'rookie', seconds: 0, increment: 0 }),
  })).json();
  expect('bot game created', !!start.gameId);
  const gameId = start.gameId;

  // First GET — if the bot has White it must have opened.
  let g = (await (await fetch(`${BASE}/api/game/${gameId}`, { headers: { cookie } })).json()).game;
  expect('game is rated', g.rated === true);
  const myColor: 'white' | 'black' = g.yourColor;
  if (myColor === 'black') {
    expect('bot (White) auto-opened on first load', g.moves.length === 1);
  }

  // Make one legal move for maya; the response should already include the bot's reply.
  const beforeLen = g.moves.length;
  const chess = new Chess(g.fen);
  const legal = chess.moves({ verbose: true });
  const mv = legal[0];
  const moveRes = await (await fetch(`${BASE}/api/game/${gameId}/move`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' }),
  })).json();
  g = moveRes.game;
  expect('my move applied', g.moves.length >= beforeLen + 1);
  // Unless my move ended the game, the bot should have replied in the same response.
  if (g.status === 'active') {
    expect('bot auto-replied within the move response', g.moves.length >= beforeLen + 2 && g.isYourTurn === true);
  }

  // Resign → finalize. Maya should lose rating vs a 600 bot; bot unchanged.
  await fetch(`${BASE}/api/game/${gameId}/resign`, { method: 'POST', headers: { cookie } });
  const gz = (await (await fetch(`${BASE}/api/game/${gameId}`, { headers: { cookie } })).json()).game;
  expect('game finalized after resign', gz.status === 'completed');

  const lob1 = await (await fetch(`${BASE}/api/lobby`, { headers: { cookie } })).json();
  const ratingAfter = lob1.me.rating as number;
  expect(`maya rating changed (rated): ${ratingBefore} → ${ratingAfter}`, ratingAfter !== ratingBefore);
  expect('maya lost rating to a weaker bot', ratingAfter < ratingBefore);

  const botAfter = await prisma.user.findUnique({ where: { username: 'bot-pixel' } });
  expect('bot rating unchanged (fixed anchor)', botAfter!.rating === botBefore!.rating);
  expect('bot W/L/D unchanged', botAfter!.wins === botBefore!.wins && botAfter!.losses === botBefore!.losses && botAfter!.draws === botBefore!.draws);
  expect('bot excluded from lobby players', !lob1.players.some((p: any) => p.username?.startsWith('bot-')));

  console.log(checks.join('\n'));
  const failed = checks.filter((c) => c.startsWith('FAIL')).length;
  console.log(`\n${failed === 0 ? '✅ ALL PASSED' : `❌ ${failed} FAILED`} (${checks.length} checks)`);
  if (failed) process.exit(1);
}
main()
  .catch((e) => { console.error('FAILED:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());

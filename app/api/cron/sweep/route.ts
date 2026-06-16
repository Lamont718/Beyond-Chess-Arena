import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { flaggedSide } from '@/lib/clock';
import { finalizeGame, type GameResult } from '@/lib/game-logic';

export const dynamic = 'force-dynamic';

// Time-out sweep. Timeouts are otherwise only detected lazily when a player has
// the game open; if BOTH players close the tab, the loser's clock never flags
// and the game (and any tournament containing it) hangs forever. This endpoint
// finalizes every active timed game whose side-to-move has run out of time.
//
// Triggered by Vercel Cron (see vercel.json). If CRON_SECRET is set, callers
// must present it as a Bearer token; otherwise the endpoint is open (it only
// performs the same idempotent finalization the game page already does).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const games = await prisma.game.findMany({
    where: { status: 'active', timeControlSec: { gt: 0 } },
    select: {
      id: true, status: true, timeControlSec: true, turn: true,
      whiteMs: true, blackMs: true, lastMoveAt: true, whiteId: true, blackId: true,
    },
    take: 500,
  });

  let finalized = 0;
  for (const game of games) {
    const flagged = flaggedSide(game);
    if (!flagged) continue;
    const result: GameResult = flagged === 'w' ? 'black_wins' : 'white_wins';
    const winnerId = flagged === 'w' ? game.blackId : game.whiteId;
    await finalizeGame(game.id, { result, reason: 'timeout', winnerId });
    finalized += 1;
  }

  return NextResponse.json({ ok: true, scanned: games.length, finalized });
}

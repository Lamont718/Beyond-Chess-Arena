import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { createGame } from '@/lib/game-logic';
import { roundRobinPairings } from '@/lib/tournament';

export const dynamic = 'force-dynamic';

// POST /api/tournaments/[id]/start — coach only. Locks the roster, generates a
// round-robin (everyone plays everyone once) as real games, and goes active.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (me.role !== 'COACH') return NextResponse.json({ error: 'Only a coach can start a tournament.' }, { status: 403 });

  const t = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: { players: true },
  });
  if (!t) return NextResponse.json({ error: 'Tournament not found.' }, { status: 404 });
  if (t.status !== 'upcoming') return NextResponse.json({ error: 'Already started.' }, { status: 400 });
  if (t.players.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 players to start.' }, { status: 400 });
  }

  // Claim the start atomically: only the first click flips upcoming→active, so a
  // double-click / retry can't generate the round-robin twice.
  const claim = await prisma.tournament.updateMany({
    where: { id: t.id, status: 'upcoming' },
    data: { status: 'active', startedAt: new Date() },
  });
  if (claim.count === 0) return NextResponse.json({ error: 'Already started.' }, { status: 400 });

  const pairings = roundRobinPairings(t.players.map((p) => p.userId));

  // Create all the games tagged with this tournament (we hold the exclusive start).
  for (const pair of pairings) {
    await createGame(pair.whiteId, pair.blackId, t.timeControlSec, t.incrementSec, t.id);
  }

  return NextResponse.json({ ok: true, games: pairings.length });
}

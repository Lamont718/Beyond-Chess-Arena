import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { publicUser } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

const ONLINE_WINDOW_MS = 60_000;

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS);

  const [players, myActiveGames, incomingChallenges, myOpenSeeks, liveGames, leaderboard] =
    await Promise.all([
      prisma.user.findMany({ orderBy: [{ rating: 'desc' }], take: 200 }),
      prisma.game.findMany({
        where: { status: 'active', OR: [{ whiteId: me.id }, { blackId: me.id }] },
        include: { white: true, black: true },
        orderBy: { lastMoveAt: 'desc' },
      }),
      prisma.challenge.findMany({
        where: { toId: me.id, status: 'open' },
        include: { from: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.challenge.findMany({
        where: { fromId: me.id, status: 'open' },
        include: { to: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.game.findMany({
        where: { status: 'active', AND: [{ whiteId: { not: me.id } }, { blackId: { not: me.id } }] },
        include: { white: true, black: true },
        orderBy: { lastMoveAt: 'desc' },
        take: 12,
      }),
      prisma.user.findMany({ orderBy: [{ rating: 'desc' }], take: 10 }),
    ]);

  return NextResponse.json({
    me: { ...publicUser(me), role: me.role, wins: me.wins, losses: me.losses, draws: me.draws },
    players: players.map((u) => ({
      ...publicUser(u),
      online: new Date(u.lastSeenAt) > onlineSince,
      role: u.role,
    })),
    myActiveGames: myActiveGames.map((g) => ({
      id: g.id,
      opponent: publicUser(g.whiteId === me.id ? g.black : g.white),
      yourColor: g.whiteId === me.id ? 'white' : 'black',
      isYourTurn: (g.whiteId === me.id && g.turn === 'w') || (g.blackId === me.id && g.turn === 'b'),
      timeControlSec: g.timeControlSec,
      incrementSec: g.incrementSec,
    })),
    incomingChallenges: incomingChallenges.map((c) => ({
      id: c.id,
      from: publicUser(c.from),
      timeControlSec: c.timeControlSec,
      incrementSec: c.incrementSec,
    })),
    myOpenSeeks: myOpenSeeks.map((c) => ({
      id: c.id,
      to: c.to ? publicUser(c.to) : null,
      timeControlSec: c.timeControlSec,
      incrementSec: c.incrementSec,
      gameId: c.gameId,
    })),
    liveGames: liveGames.map((g) => ({
      id: g.id,
      white: publicUser(g.white),
      black: publicUser(g.black),
      moveCount: countMoves(g.movesJson),
    })),
    leaderboard: leaderboard.map((u, i) => ({
      rank: i + 1,
      ...publicUser(u),
      wins: u.wins,
      losses: u.losses,
      draws: u.draws,
    })),
  });
}

function countMoves(json: string): number {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

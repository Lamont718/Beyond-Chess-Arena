import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { publicUser } from '@/lib/serialize';
import { tryMatchOpenSeek } from '@/lib/matchmaking';

export const dynamic = 'force-dynamic';

const ONLINE_WINDOW_MS = 60_000;

// Only the columns the lobby actually renders — never pull passwordHash / full
// rows for list views (this runs on every poll for every online user).
const PUBLIC_USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  rating: true,
  emoji: true,
} as const;
const PLAYER_SELECT = { ...PUBLIC_USER_SELECT, role: true, lastSeenAt: true } as const;
const LEADER_SELECT = { ...PUBLIC_USER_SELECT, wins: true, losses: true, draws: true } as const;

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS);

  // Backstop for the matchmaking race: if I'm holding an open quick-play seek,
  // try to pair it with another waiting seeker on every poll. No-ops cheaply
  // when I have no open seek. This is what rescues two kids who both clicked
  // "Find an opponent" at the same instant and would otherwise spin forever.
  await tryMatchOpenSeek(me.id);

  const [players, myActiveGames, incomingChallenges, myOpenSeeks, liveGames, leaderboard] =
    await Promise.all([
      prisma.user.findMany({ orderBy: [{ rating: 'desc' }], take: 200, select: PLAYER_SELECT }),
      prisma.game.findMany({
        where: { status: 'active', OR: [{ whiteId: me.id }, { blackId: me.id }] },
        include: { white: { select: PUBLIC_USER_SELECT }, black: { select: PUBLIC_USER_SELECT } },
        orderBy: { lastMoveAt: 'desc' },
      }),
      prisma.challenge.findMany({
        where: { toId: me.id, status: 'open' },
        include: { from: { select: PUBLIC_USER_SELECT } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.challenge.findMany({
        where: { fromId: me.id, status: 'open' },
        include: { to: { select: PUBLIC_USER_SELECT } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.game.findMany({
        where: { status: 'active', AND: [{ whiteId: { not: me.id } }, { blackId: { not: me.id } }] },
        include: { white: { select: PUBLIC_USER_SELECT }, black: { select: PUBLIC_USER_SELECT } },
        orderBy: { lastMoveAt: 'desc' },
        take: 12,
      }),
      prisma.user.findMany({ orderBy: [{ rating: 'desc' }], take: 10, select: LEADER_SELECT }),
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
      rated: c.rated,
    })),
    myOpenSeeks: myOpenSeeks.map((c) => ({
      id: c.id,
      to: c.to ? publicUser(c.to) : null,
      timeControlSec: c.timeControlSec,
      incrementSec: c.incrementSec,
      rated: c.rated,
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

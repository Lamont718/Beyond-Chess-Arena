import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/NavBar';
import TournamentDetailClient from './TournamentDetailClient';

export const dynamic = 'force-dynamic';

export default async function TournamentDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const t = await prisma.tournament.findUnique({
    where: { id: params.id },
    include: { players: { include: { user: true } } },
  });
  if (!t) notFound();

  // Standings: points, then head-to-head wins, then rating as a tiebreak.
  const standings = [...t.players]
    .sort((a, b) => b.points - a.points || b.wins - a.wins || b.user.rating - a.user.rating)
    .map((p, i) => ({
      rank: i + 1,
      userId: p.userId,
      username: p.user.username,
      displayName: p.user.displayName,
      emoji: p.user.emoji,
      points: p.points,
      wins: p.wins,
      draws: p.draws,
      losses: p.losses,
    }));

  // Games for progress + this player's own pairings.
  const games =
    t.status === 'upcoming'
      ? []
      : await prisma.game.findMany({
          where: { tournamentId: t.id },
          include: { white: true, black: true },
          orderBy: { createdAt: 'asc' },
        });

  const total = games.length;
  const done = games.filter((g) => g.status === 'completed').length;

  const myGames = games
    .filter((g) => g.whiteId === me.id || g.blackId === me.id)
    .map((g) => {
      const iAmWhite = g.whiteId === me.id;
      const opp = iAmWhite ? g.black : g.white;
      const myColor = iAmWhite ? 'w' : 'b';
      let outcome: 'win' | 'loss' | 'draw' | null = null;
      if (g.status === 'completed') {
        if (g.result === 'draw') outcome = 'draw';
        else if (g.result === `${myColor === 'w' ? 'white' : 'black'}_wins`) outcome = 'win';
        else outcome = 'loss';
      }
      const isMyTurn = g.status === 'active' && g.turn === myColor;
      return {
        id: g.id,
        oppName: opp.displayName,
        oppEmoji: opp.emoji,
        status: g.status,
        outcome,
        isMyTurn,
      };
    });

  return (
    <>
      <NavBar me={me} />
      <TournamentDetailClient
        me={{ id: me.id, isCoach: me.role === 'COACH' }}
        tournament={{
          id: t.id,
          name: t.name,
          status: t.status,
          timeControlSec: t.timeControlSec,
          incrementSec: t.incrementSec,
        }}
        joined={t.players.some((p) => p.userId === me.id)}
        standings={standings}
        myGames={myGames}
        progress={{ done, total }}
      />
    </>
  );
}

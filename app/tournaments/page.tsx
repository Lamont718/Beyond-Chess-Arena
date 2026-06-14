import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/NavBar';
import TournamentsClient from './TournamentsClient';

export const dynamic = 'force-dynamic';

export default async function TournamentsPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const tournaments = await prisma.tournament.findMany({
    orderBy: [{ createdAt: 'desc' }],
    include: { players: { select: { userId: true } } },
  });

  return (
    <>
      <NavBar me={me} />
      <TournamentsClient
        isCoach={me.role === 'COACH'}
        tournaments={tournaments.map((t) => ({
          id: t.id,
          name: t.name,
          status: t.status,
          timeControlSec: t.timeControlSec,
          incrementSec: t.incrementSec,
          playerCount: t.players.length,
          joined: t.players.some((p) => p.userId === me.id),
        }))}
      />
    </>
  );
}

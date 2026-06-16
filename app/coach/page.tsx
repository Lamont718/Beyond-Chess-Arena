import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/NavBar';
import RosterClient from './RosterClient';

export const dynamic = 'force-dynamic';

export default async function CoachPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  if (me.role !== 'COACH') redirect('/');

  const users = await prisma.user.findMany({ where: { role: { not: 'BOT' } }, orderBy: [{ role: 'asc' }, { displayName: 'asc' }] });

  return (
    <>
      <NavBar me={me} />
      <RosterClient
        roster={users.map((u) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          emoji: u.emoji,
          role: u.role,
          rating: u.rating,
          wins: u.wins,
          losses: u.losses,
          draws: u.draws,
        }))}
      />
    </>
  );
}

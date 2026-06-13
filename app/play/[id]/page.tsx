import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import NavBar from '@/components/NavBar';
import GameClient from './GameClient';

export const dynamic = 'force-dynamic';

export default async function PlayPage({ params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  return (
    <>
      <NavBar me={me} />
      <GameClient gameId={params.id} meId={me.id} />
    </>
  );
}

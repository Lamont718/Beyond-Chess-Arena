import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import NavBar from '@/components/NavBar';
import LobbyClient from './LobbyClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  return (
    <>
      <NavBar me={me} />
      <LobbyClient meId={me.id} />
    </>
  );
}

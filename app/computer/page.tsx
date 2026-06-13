import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import NavBar from '@/components/NavBar';
import ComputerClient from './ComputerClient';

export const dynamic = 'force-dynamic';

export default async function ComputerPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  return (
    <>
      <NavBar me={me} />
      <ComputerClient />
    </>
  );
}

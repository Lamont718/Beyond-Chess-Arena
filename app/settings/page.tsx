import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import NavBar from '@/components/NavBar';
import { levelFromXp } from '@/lib/levels';
import SettingsClient from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');
  const { level } = levelFromXp(me.xp);
  return (
    <>
      <NavBar me={me} />
      <SettingsClient displayName={me.displayName} username={me.username} emoji={me.emoji} level={level} />
    </>
  );
}

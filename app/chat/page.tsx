import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import NavBar from '@/components/NavBar';
import ChatPanel from '@/components/ChatPanel';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  return (
    <>
      <NavBar me={me} />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-1 text-2xl font-bold">💬 Club Chat</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Say hi to your teammates. Be kind — coaches can see and remove messages.
        </p>
        <ChatPanel scope="global" title="Everyone" heightClass="h-[60vh]" />
      </main>
    </>
  );
}

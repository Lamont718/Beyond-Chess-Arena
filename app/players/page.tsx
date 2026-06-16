import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/NavBar';

export const dynamic = 'force-dynamic';

const ONLINE_WINDOW_MS = 60_000;

export default async function PlayersPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const players = await prisma.user.findMany({ where: { role: { not: 'BOT' } }, orderBy: [{ rating: 'desc' }] });
  const onlineSince = Date.now() - ONLINE_WINDOW_MS;

  return (
    <>
      <NavBar me={me} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold">Players</h1>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => {
            const online = new Date(p.lastSeenAt).getTime() > onlineSince;
            return (
              <Link
                key={p.id}
                href={`/players/${p.username}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
              >
                <span className="text-2xl">{p.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{p.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    @{p.username} · {p.rating}
                  </p>
                </div>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                  title={online ? 'online' : 'offline'}
                />
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}

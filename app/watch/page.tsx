import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Eye } from 'lucide-react';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/NavBar';
import AutoRefresh from '@/components/AutoRefresh';
import { describeTimeControl } from '@/lib/time-controls';

export const dynamic = 'force-dynamic';

export default async function WatchPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const games = await prisma.game.findMany({
    where: { status: 'active' },
    include: { white: true, black: true },
    orderBy: { lastMoveAt: 'desc' },
    take: 40,
  });

  return (
    <>
      <NavBar me={me} />
      <AutoRefresh ms={4000} />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold">
          <Eye className="h-6 w-6 text-primary" /> Live Games
        </h1>
        {games.length === 0 ? (
          <p className="text-sm text-muted-foreground">No games are being played right now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {games.map((g) => {
              const moveCount = safeLen(g.movesJson);
              return (
                <Link
                  key={g.id}
                  href={`/play/${g.id}`}
                  className="rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {g.white.emoji} {g.white.displayName}
                    </span>
                    <span className="text-xs text-muted-foreground">{g.white.rating}</span>
                  </div>
                  <div className="my-1 text-center text-xs uppercase tracking-wide text-muted-foreground">vs</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {g.black.emoji} {g.black.displayName}
                    </span>
                    <span className="text-xs text-muted-foreground">{g.black.rating}</span>
                  </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    {describeTimeControl(g.timeControlSec, g.incrementSec)} · {moveCount} moves · click to watch
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function safeLen(json: string): number {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.length : 0;
  } catch {
    return 0;
  }
}

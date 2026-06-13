import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/NavBar';
import { describeTimeControl } from '@/lib/time-controls';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: { username: string } }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const user = await prisma.user.findUnique({ where: { username: params.username.toLowerCase() } });
  if (!user) notFound();

  const games = await prisma.game.findMany({
    where: { status: 'completed', OR: [{ whiteId: user.id }, { blackId: user.id }] },
    include: { white: true, black: true },
    orderBy: { endedAt: 'desc' },
    take: 15,
  });

  const total = user.wins + user.losses + user.draws;
  const winPct = total ? Math.round((user.wins / total) * 100) : 0;

  return (
    <>
      <NavBar me={me} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-6">
          <span className="text-5xl">{user.emoji}</span>
          <div className="flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              {user.displayName}
              {user.role === 'COACH' && (
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                  COACH
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">@{user.username}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">{user.rating}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Rating</div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-4 gap-3">
          <Stat label="Wins" value={user.wins} className="text-emerald-400" />
          <Stat label="Losses" value={user.losses} className="text-rose-400" />
          <Stat label="Draws" value={user.draws} className="text-muted-foreground" />
          <Stat label="Win %" value={`${winPct}%`} className="text-primary" />
        </div>

        <h2 className="mb-3 text-lg font-bold">Recent games</h2>
        {games.length === 0 ? (
          <p className="text-sm text-muted-foreground">No finished games yet.</p>
        ) : (
          <div className="space-y-2">
            {games.map((g) => {
              const isWhite = g.whiteId === user.id;
              const opponent = isWhite ? g.black : g.white;
              const outcome =
                g.result === 'draw'
                  ? 'draw'
                  : (g.result === 'white_wins' && isWhite) || (g.result === 'black_wins' && !isWhite)
                    ? 'win'
                    : 'loss';
              return (
                <Link
                  key={g.id}
                  href={`/play/${g.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 transition-colors hover:border-primary/40"
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                      outcome === 'win' && 'bg-emerald-500/20 text-emerald-400',
                      outcome === 'loss' && 'bg-rose-500/20 text-rose-400',
                      outcome === 'draw' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'D'}
                  </span>
                  <span className="text-lg">{opponent.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">vs {opponent.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {isWhite ? 'White' : 'Black'} · {describeTimeControl(g.timeControlSec, g.incrementSec)}
                      {g.reason ? ` · ${g.reason.replace(/-/g, ' ')}` : ''}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function Stat({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div className={cn('text-2xl font-bold', className)}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

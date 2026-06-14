import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/NavBar';
import { describeTimeControl } from '@/lib/time-controls';
import { computeBadges } from '@/lib/badges';
import { levelFromXp } from '@/lib/levels';
import { computeQuests } from '@/lib/quests';
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
  const badges = computeBadges({ wins: user.wins, losses: user.losses, draws: user.draws, rating: user.rating });
  const earnedCount = badges.filter((b) => b.earned).length;
  const lvl = levelFromXp(user.xp);
  const isMe = me.id === user.id;
  const quests = computeQuests({
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    rating: user.rating,
    puzzlesSolved: user.puzzlesSolved,
    puzzleBestStreak: user.puzzleBestStreak,
  });

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
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
              {lvl.emoji} Level {lvl.level} · {lvl.title}
            </span>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary">{user.rating}</div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Rating</div>
          </div>
        </div>

        {/* XP / level progress */}
        <div className="mb-6 rounded-2xl border border-border bg-card p-5">
          <div className="mb-2 flex items-end justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground">Experience</h2>
            <span className="text-xs text-muted-foreground">
              {lvl.xpIntoLevel} / {lvl.xpForNext} XP to Level {lvl.level + 1}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${lvl.progressPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{user.xp} total XP earned from games and puzzles.</p>
        </div>

        <div className="mb-6 grid grid-cols-4 gap-3">
          <Stat label="Wins" value={user.wins} className="text-emerald-400" />
          <Stat label="Losses" value={user.losses} className="text-rose-400" />
          <Stat label="Draws" value={user.draws} className="text-muted-foreground" />
          <Stat label="Win %" value={`${winPct}%`} className="text-primary" />
        </div>

        {isMe && (
          <div className="mb-6">
            <h2 className="mb-3 text-lg font-bold">
              Challenges{' '}
              <span className="text-sm font-normal text-muted-foreground">
                ({quests.filter((q) => q.done).length}/{quests.length})
              </span>
            </h2>
            <div className="space-y-2">
              {quests.map((q) => (
                <div
                  key={q.key}
                  className={cn(
                    'rounded-xl border p-3',
                    q.done ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-border bg-card'
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <span className="text-lg">{q.emoji}</span> {q.label}
                    </span>
                    <span className={cn('font-semibold', q.done ? 'text-emerald-400' : 'text-muted-foreground')}>
                      {q.done ? 'Done ✓' : `${q.current}/${q.target}`}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', q.done ? 'bg-emerald-500' : 'bg-primary')}
                      style={{ width: `${Math.round((q.current / q.target) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-6">
          <h2 className="mb-3 text-lg font-bold">
            Badges <span className="text-sm font-normal text-muted-foreground">({earnedCount}/{badges.length})</span>
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {badges.map((b) => (
              <div
                key={b.key}
                className={cn(
                  'flex items-center gap-2 rounded-xl border p-2.5',
                  b.earned ? 'border-primary/40 bg-primary/10' : 'border-border bg-card opacity-50'
                )}
                title={b.desc}
              >
                <span className={cn('text-2xl', !b.earned && 'grayscale')}>{b.emoji}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{b.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
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

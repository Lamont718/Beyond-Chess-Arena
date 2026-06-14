'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Medal, Play, Flag, Trash2, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describeTimeControl } from '@/lib/time-controls';
import { cn } from '@/lib/utils';

interface Standing {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  emoji: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
}
interface MyGame {
  id: string;
  oppName: string;
  oppEmoji: string;
  status: string;
  outcome: 'win' | 'loss' | 'draw' | null;
  isMyTurn: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'bg-amber-500/15 text-amber-300',
  active: 'bg-emerald-500/15 text-emerald-300',
  completed: 'bg-muted text-muted-foreground',
};

export default function TournamentDetailClient({
  me,
  tournament,
  joined,
  standings,
  myGames,
  progress,
}: {
  me: { id: string; isCoach: boolean };
  tournament: { id: string; name: string; status: string; timeControlSec: number; incrementSec: number };
  joined: boolean;
  standings: Standing[];
  myGames: MyGame[];
  progress: { done: number; total: number };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const id = tournament.id;

  async function call(path: string, opts?: RequestInit, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    const res = await fetch(path, opts);
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Something went wrong.');
      return false;
    }
    return data;
  }

  const join = async (leave: boolean) => {
    const ok = await call(`/api/tournaments/${id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leave }),
    });
    if (ok) router.refresh();
  };

  const start = async () => {
    const ok = await call(`/api/tournaments/${id}/start`, { method: 'POST' });
    if (ok) {
      toast.success(`Tournament started — ${ok.games} games created!`);
      router.refresh();
    }
  };

  const finish = async () => {
    const ok = await call(`/api/tournaments/${id}/finish`, { method: 'POST' }, 'End this tournament now? Unplayed games will be cancelled.');
    if (ok) {
      toast.success('Tournament ended.');
      router.refresh();
    }
  };

  const del = async () => {
    const ok = await call(`/api/tournaments/${id}`, { method: 'DELETE' }, 'Delete this tournament?');
    if (ok) router.push('/tournaments');
  };

  const champion = tournament.status === 'completed' && standings.length > 0 ? standings[0] : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <Link href="/tournaments" className="text-sm text-muted-foreground hover:text-foreground">
        ← All tournaments
      </Link>

      <div className="mb-4 mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Medal className="h-6 w-6 text-primary" /> {tournament.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', STATUS_STYLES[tournament.status])}>
              {tournament.status}
            </span>
            <span>{describeTimeControl(tournament.timeControlSec, tournament.incrementSec)}</span>
            {tournament.status !== 'upcoming' && (
              <span>· {progress.done}/{progress.total} games played</span>
            )}
          </p>
        </div>

        {/* Join / leave for upcoming tournaments */}
        {tournament.status === 'upcoming' &&
          (joined ? (
            <Button variant="outline" onClick={() => join(true)} disabled={busy}>
              Leave
            </Button>
          ) : (
            <Button variant="accent" onClick={() => join(false)} disabled={busy}>
              Join tournament
            </Button>
          ))}
      </div>

      {/* Champion banner */}
      {champion && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 p-4">
          <Crown className="h-7 w-7 text-primary" />
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Champion</p>
            <p className="text-lg font-bold text-foreground">
              {champion.emoji} {champion.displayName} — {fmtPts(champion.points)} pts
            </p>
          </div>
        </div>
      )}

      {/* Coach controls */}
      {me.isCoach && (
        <div className="mb-5 flex flex-wrap gap-2">
          {tournament.status === 'upcoming' && (
            <Button onClick={start} disabled={busy || standings.length < 2}>
              <Play className="mr-1.5 h-4 w-4" /> Start tournament
            </Button>
          )}
          {tournament.status === 'active' && (
            <Button variant="outline" onClick={finish} disabled={busy}>
              <Flag className="mr-1.5 h-4 w-4" /> End now
            </Button>
          )}
          {tournament.status !== 'active' && (
            <Button variant="outline" onClick={del} disabled={busy}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete
            </Button>
          )}
          {tournament.status === 'upcoming' && standings.length < 2 && (
            <span className="self-center text-xs text-muted-foreground">Need at least 2 players to start.</span>
          )}
        </div>
      )}

      {/* Your games */}
      {tournament.status !== 'upcoming' && myGames.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-bold">Your games</h2>
          <div className="space-y-2">
            {myGames.map((g) => (
              <Link
                key={g.id}
                href={`/play/${g.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40"
              >
                <span className="text-2xl">{g.oppEmoji}</span>
                <span className="flex-1 font-medium text-foreground">vs {g.oppName}</span>
                {g.status === 'completed' ? (
                  <OutcomeBadge outcome={g.outcome} />
                ) : g.isMyTurn ? (
                  <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white">Your turn</span>
                ) : (
                  <span className="text-xs text-muted-foreground">In progress</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Standings */}
      <section>
        <h2 className="mb-2 text-lg font-bold">{tournament.status === 'upcoming' ? 'Players' : 'Standings'}</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left">#</th>
                <th className="px-3 py-2.5 text-left">Player</th>
                {tournament.status !== 'upcoming' && (
                  <>
                    <th className="px-3 py-2.5 text-right">Pts</th>
                    <th className="hidden px-3 py-2.5 text-right sm:table-cell">W</th>
                    <th className="hidden px-3 py-2.5 text-right sm:table-cell">D</th>
                    <th className="hidden px-3 py-2.5 text-right sm:table-cell">L</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {standings.map((p) => (
                <tr key={p.userId} className={cn('border-t border-border', p.userId === me.id && 'bg-primary/10')}>
                  <td className="px-3 py-2.5 font-bold text-muted-foreground">{p.rank}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/players/${p.username}`} className="flex items-center gap-2 hover:underline">
                      <span className="text-lg">{p.emoji}</span>
                      <span className="font-medium text-foreground">{p.displayName}</span>
                    </Link>
                  </td>
                  {tournament.status !== 'upcoming' && (
                    <>
                      <td className="px-3 py-2.5 text-right font-bold text-primary">{fmtPts(p.points)}</td>
                      <td className="hidden px-3 py-2.5 text-right text-emerald-400 sm:table-cell">{p.wins}</td>
                      <td className="hidden px-3 py-2.5 text-right text-muted-foreground sm:table-cell">{p.draws}</td>
                      <td className="hidden px-3 py-2.5 text-right text-rose-400 sm:table-cell">{p.losses}</td>
                    </>
                  )}
                </tr>
              ))}
              {standings.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No players have joined yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function fmtPts(p: number): string {
  return Number.isInteger(p) ? String(p) : p.toFixed(1);
}

function OutcomeBadge({ outcome }: { outcome: 'win' | 'loss' | 'draw' | null }) {
  if (outcome === 'win') return <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">Won</span>;
  if (outcome === 'loss') return <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-300">Lost</span>;
  if (outcome === 'draw') return <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Draw</span>;
  return null;
}

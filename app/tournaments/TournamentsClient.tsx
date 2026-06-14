'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Medal, Plus, Users, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TIME_CONTROLS, describeTimeControl } from '@/lib/time-controls';
import { cn } from '@/lib/utils';

interface TournamentRow {
  id: string;
  name: string;
  status: string;
  timeControlSec: number;
  incrementSec: number;
  playerCount: number;
  joined: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'bg-amber-500/15 text-amber-300',
  active: 'bg-emerald-500/15 text-emerald-300',
  completed: 'bg-muted text-muted-foreground',
};

export default function TournamentsClient({
  isCoach,
  tournaments,
}: {
  isCoach: boolean;
  tournaments: TournamentRow[];
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [tcKey, setTcKey] = useState('5+0');
  const [creating, setCreating] = useState(false);

  async function create() {
    const tc = TIME_CONTROLS.find((t) => t.key === tcKey)!;
    if (!name.trim()) {
      toast.error('Give your tournament a name.');
      return;
    }
    setCreating(true);
    const res = await fetch('/api/tournaments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), timeControlSec: tc.seconds, incrementSec: tc.increment }),
    });
    setCreating(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Could not create tournament.');
      return;
    }
    setName('');
    toast.success('Tournament created!');
    router.push(`/tournaments/${data.id}`);
  }

  async function join(id: string) {
    const res = await fetch(`/api/tournaments/${id}/join`, { method: 'POST' });
    if (res.ok) router.refresh();
    else toast.error((await res.json().catch(() => ({}))).error || 'Could not join.');
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <Medal className="h-6 w-6 text-primary" /> Tournaments
      </h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Round-robin events — everyone plays everyone, points decide the champion.
      </p>

      {isCoach && (
        <section className="mb-6 rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Plus className="h-5 w-5 text-primary" /> New tournament
          </h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Tournament name (e.g. Friday Club Cup)"
            className="mb-3 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none focus:border-primary/60"
          />
          <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {TIME_CONTROLS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTcKey(t.key)}
                className={cn(
                  'rounded-xl border px-2 py-2.5 text-center text-sm font-bold transition-all',
                  tcKey === t.key
                    ? 'border-primary bg-primary/15 ring-2 ring-primary/30'
                    : 'border-border bg-background hover:border-primary/40'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button onClick={create} disabled={creating} variant="accent" className="w-full" size="lg">
            {creating ? 'Creating…' : 'Create tournament'}
          </Button>
        </section>
      )}

      <div className="space-y-3">
        {tournaments.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No tournaments yet.{isCoach ? ' Create one above!' : ' Ask your coach to start one.'}
          </p>
        )}
        {tournaments.map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Link href={`/tournaments/${t.id}`} className="truncate font-bold text-foreground hover:underline">
                  {t.name}
                </Link>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', STATUS_STYLES[t.status])}>
                  {t.status}
                </span>
              </div>
              <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {t.playerCount} player{t.playerCount === 1 ? '' : 's'}
                </span>
                <span>{describeTimeControl(t.timeControlSec, t.incrementSec)}</span>
              </p>
            </div>
            {t.status === 'upcoming' && !t.joined && (
              <Button size="sm" variant="accent" onClick={() => join(t.id)}>
                Join
              </Button>
            )}
            {t.joined && t.status === 'upcoming' && (
              <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                Joined ✓
              </span>
            )}
            <Link
              href={`/tournaments/${t.id}`}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Open tournament"
            >
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}

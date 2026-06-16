'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Swords, Loader2, Check, X, Circle, Eye, Trophy, Clock, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TIME_CONTROLS, describeTimeControl } from '@/lib/time-controls';
import { BOTS } from '@/lib/bots';
import { cn } from '@/lib/utils';
import DailyPuzzleCard from '@/components/DailyPuzzleCard';

interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  emoji: string;
}
interface LobbyData {
  me: PublicUser & { role: string; wins: number; losses: number; draws: number };
  players: (PublicUser & { online: boolean; role: string })[];
  myActiveGames: { id: string; opponent: PublicUser; yourColor: string; isYourTurn: boolean; timeControlSec: number; incrementSec: number }[];
  incomingChallenges: { id: string; from: PublicUser; timeControlSec: number; incrementSec: number; rated: boolean }[];
  myOpenSeeks: { id: string; to: PublicUser | null; timeControlSec: number; incrementSec: number; rated: boolean; gameId: string | null }[];
  liveGames: { id: string; white: PublicUser; black: PublicUser; moveCount: number }[];
  leaderboard: (PublicUser & { rank: number; wins: number; losses: number; draws: number })[];
}

export default function LobbyClient({ meId }: { meId: string }) {
  const router = useRouter();
  const [data, setData] = useState<LobbyData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [tcKey, setTcKey] = useState('5+0');
  const [rated, setRated] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const knownGameIds = useRef<Set<string> | null>(null);
  const failCount = useRef(0);

  const tc = TIME_CONTROLS.find((t) => t.key === tcKey) ?? TIME_CONTROLS[1];

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/lobby', { cache: 'no-store' });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) {
        failCount.current += 1;
        if (failCount.current >= 3) setLoadError(true);
        return;
      }
      const d: LobbyData = await res.json();
      failCount.current = 0;
      setLoadError(false);
      setData(d);

      // If I'm waiting on a quick-play seek and it got matched, jump in.
      const matchedSeek = d.myOpenSeeks.find((s) => s.gameId);
      if (matchedSeek?.gameId) {
        router.push(`/play/${matchedSeek.gameId}`);
        return;
      }
      setSeeking(d.myOpenSeeks.some((s) => s.to === null));

      // Detect a brand-new active game (a challenge I set up just started).
      const activeIds = d.myActiveGames.map((g) => g.id);
      if (knownGameIds.current === null) {
        knownGameIds.current = new Set(activeIds);
      } else {
        const fresh = activeIds.find((id) => !knownGameIds.current!.has(id));
        if (fresh) {
          activeIds.forEach((id) => knownGameIds.current!.add(id));
          router.push(`/play/${fresh}`);
        }
      }
    } catch {
      failCount.current += 1;
      if (failCount.current >= 3) setLoadError(true);
    }
  }, [router]);

  useEffect(() => {
    poll();
    const i = setInterval(poll, 3000);
    return () => clearInterval(i);
  }, [poll]);

  async function quickPlay() {
    try {
      const res = await fetch('/api/seek', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds: tc.seconds, increment: tc.increment, rated }),
      });
      const d = await res.json();
      if (d.gameId) {
        router.push(`/play/${d.gameId}`);
      } else if (d.seeking) {
        setSeeking(true);
        toast.message('Searching for an opponent…');
      }
    } catch {
      toast.error('Could not start matchmaking.');
    }
  }

  async function cancelSeek() {
    await fetch('/api/seek', { method: 'DELETE' });
    setSeeking(false);
  }

  async function playBot(level: string) {
    try {
      const res = await fetch('/api/bot-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, seconds: tc.seconds, increment: tc.increment }),
      });
      const d = await res.json();
      if (d.gameId) router.push(`/play/${d.gameId}`);
      else toast.error(d.error || 'Could not start the bot game.');
    } catch {
      toast.error('Could not start the bot game.');
    }
  }

  async function challenge(userId: string, name: string) {
    const res = await fetch('/api/challenge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toUserId: userId, seconds: tc.seconds, increment: tc.increment, rated }),
    });
    if (res.ok) toast.success(`Challenge sent to ${name} · ${describeTimeControl(tc.seconds, tc.increment)} · ${rated ? 'Ranked' : 'Casual'}`);
    else toast.error((await res.json()).error || 'Could not send challenge.');
  }

  async function respondChallenge(id: string, action: 'accept' | 'decline') {
    const res = await fetch(`/api/challenge/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const d = await res.json();
    if (d.gameId) router.push(`/play/${d.gameId}`);
    else poll();
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        {loadError ? (
          <>
            <p className="text-sm text-muted-foreground">Couldn’t reach the arena. Check your connection.</p>
            <Button
              variant="outline"
              onClick={() => {
                failCount.current = 0;
                setLoadError(false);
                poll();
              }}
            >
              Try again
            </Button>
          </>
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  const otherPlayers = data.players
    .filter((p) => p.id !== meId)
    .sort((a, b) => Number(b.online) - Number(a.online) || b.rating - a.rating);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      {/* Incoming challenges — most urgent, pinned at top */}
      {data.incomingChallenges.length > 0 && (
        <div className="mb-6 space-y-2">
          {data.incomingChallenges.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3"
            >
              <span className="text-2xl">{c.from.emoji}</span>
              <div className="flex-1">
                <p className="font-semibold text-foreground">
                  {c.from.displayName} challenges you!
                </p>
                <p className="text-xs text-muted-foreground">
                  {describeTimeControl(c.timeControlSec, c.incrementSec)} · {c.rated ? 'Ranked' : 'Casual'} · rating {c.from.rating}
                </p>
              </div>
              <Button size="sm" onClick={() => respondChallenge(c.id, 'accept')}>
                <Check className="mr-1 h-4 w-4" /> Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => respondChallenge(c.id, 'decline')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Quick play */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              <Swords className="h-5 w-5 text-primary" /> Quick Play
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Pick a time, then find an opponent or challenge a teammate.
            </p>
            <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {TIME_CONTROLS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTcKey(t.key)}
                  className={cn(
                    'rounded-xl border px-2 py-3 text-center transition-all',
                    tcKey === t.key
                      ? 'border-primary bg-primary/15 ring-2 ring-primary/30'
                      : 'border-border bg-background hover:border-primary/40'
                  )}
                >
                  <div className="text-sm font-bold text-foreground">{t.label}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.category}</div>
                </button>
              ))}
            </div>
            {/* Ranked vs Casual */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setRated(true)}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-center transition-all',
                  rated
                    ? 'border-primary bg-primary/15 ring-2 ring-primary/30'
                    : 'border-border bg-background hover:border-primary/40'
                )}
              >
                <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-foreground">
                  <Trophy className="h-4 w-4 text-primary" /> Ranked
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Counts for rating</div>
              </button>
              <button
                onClick={() => setRated(false)}
                className={cn(
                  'rounded-xl border px-3 py-2.5 text-center transition-all',
                  !rated
                    ? 'border-primary bg-primary/15 ring-2 ring-primary/30'
                    : 'border-border bg-background hover:border-primary/40'
                )}
              >
                <div className="text-sm font-bold text-foreground">Casual</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Just for fun</div>
              </button>
            </div>
            {seeking ? (
              <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="flex-1 text-sm font-medium">
                  Searching for an opponent · {describeTimeControl(tc.seconds, tc.increment)}
                </span>
                <Button size="sm" variant="outline" onClick={cancelSeek}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button className="w-full" variant="accent" size="lg" onClick={quickPlay}>
                <Swords className="mr-2 h-5 w-5" /> Find an opponent · {describeTimeControl(tc.seconds, tc.increment)} · {rated ? 'Ranked' : 'Casual'}
              </Button>
            )}
            <Link
              href="/computer"
              className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Bot className="h-4 w-4" /> Or practice vs the Computer (unrated)
            </Link>
          </section>

          {/* Ranked bots — always-available opponents that count for your rating */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
              <Bot className="h-5 w-5 text-primary" /> Ranked Bots
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              No one around? Play a bot — these count toward your rating. Uses {describeTimeControl(tc.seconds, tc.increment)}.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {BOTS.map((b) => (
                <button
                  key={b.username}
                  onClick={() => playBot(b.level)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-primary/40"
                >
                  <span className="text-2xl">{b.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{b.displayName} <span className="text-xs font-normal text-muted-foreground">· {b.rating}</span></p>
                    <p className="truncate text-xs text-muted-foreground">{b.blurb}</p>
                  </div>
                  <Swords className="h-4 w-4 shrink-0 text-primary" />
                </button>
              ))}
            </div>
          </section>

          {/* Continue playing */}
          {data.myActiveGames.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <Clock className="h-5 w-5 text-emerald-400" /> Your Games
              </h2>
              <div className="space-y-2">
                {data.myActiveGames.map((g) => (
                  <Link
                    key={g.id}
                    href={`/play/${g.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 transition-colors hover:border-primary/40"
                  >
                    <span className="text-2xl">{g.opponent.emoji}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">vs {g.opponent.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        You play {g.yourColor} · {describeTimeControl(g.timeControlSec, g.incrementSec)}
                      </p>
                    </div>
                    {g.isYourTurn && (
                      <span className="rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                        Your turn
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Players */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-lg font-bold">Players</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {otherPlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
                >
                  <span className="relative text-2xl">
                    {p.emoji}
                    <Circle
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full',
                        p.online ? 'fill-emerald-500 text-emerald-500' : 'fill-muted-foreground/50 text-muted-foreground/50'
                      )}
                    />
                  </span>
                  <Link href={`/players/${p.username}`} className="flex-1 min-w-0">
                    <p className="truncate font-semibold text-foreground hover:underline">{p.displayName}</p>
                    <p className="text-xs text-muted-foreground">{p.rating} · {p.online ? 'online' : 'offline'}</p>
                  </Link>
                  <Button size="sm" variant="outline" onClick={() => challenge(p.id, p.displayName)}>
                    <Swords className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {otherPlayers.length === 0 && (
                <p className="text-sm text-muted-foreground">No other players yet — ask Coach to add your teammates.</p>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Daily puzzle promo */}
          <DailyPuzzleCard />

          {/* Leaderboard */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Trophy className="h-5 w-5 text-primary" /> Leaderboard
            </h2>
            <div className="space-y-1">
              {data.leaderboard.map((p) => (
                <Link
                  key={p.id}
                  href={`/players/${p.username}`}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted',
                    p.id === meId && 'bg-primary/10'
                  )}
                >
                  <span className="w-5 text-center text-sm font-bold text-muted-foreground">{p.rank}</span>
                  <span className="text-lg">{p.emoji}</span>
                  <span className="flex-1 truncate text-sm font-medium text-foreground">{p.displayName}</span>
                  <span className="text-sm font-bold text-primary">{p.rating}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* Live games */}
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <Eye className="h-5 w-5 text-primary" /> Live Now
            </h2>
            {data.liveGames.length === 0 ? (
              <p className="text-sm text-muted-foreground">No games in progress.</p>
            ) : (
              <div className="space-y-2">
                {data.liveGames.map((g) => (
                  <Link
                    key={g.id}
                    href={`/play/${g.id}`}
                    className="block rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{g.white.emoji} {g.white.displayName}</span>
                      <span className="text-xs text-muted-foreground">vs</span>
                      <span className="truncate text-right">{g.black.displayName} {g.black.emoji}</span>
                    </div>
                    <p className="mt-0.5 text-center text-[11px] text-muted-foreground">{g.moveCount} moves · watch</p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

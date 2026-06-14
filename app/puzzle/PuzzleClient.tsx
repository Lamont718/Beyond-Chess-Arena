'use client';

import { useCallback, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { Flame, Trophy, CheckCircle2, Target } from 'lucide-react';
import ChessBoard from '@/components/chess/ChessBoard';
import Confetti from '@/components/Confetti';
import { cn } from '@/lib/utils';

interface PuzzleMeta {
  id: string;
  fen: string;
  sideToMove: 'w' | 'b';
  theme: string;
  difficulty: number;
}

interface Props {
  dateKey: string;
  puzzle: PuzzleMeta;
  initial: { streak: number; bestStreak: number; solvedTotal: number; solvedToday: boolean };
}

type Status = 'idle' | 'wrong' | 'solved';

export default function PuzzleClient({ dateKey, puzzle, initial }: Props) {
  const orientation = puzzle.sideToMove === 'w' ? 'white' : 'black';
  const [fen, setFen] = useState(puzzle.fen);
  const [status, setStatus] = useState<Status>(initial.solvedToday ? 'solved' : 'idle');
  const [streak, setStreak] = useState(initial.streak);
  const [bestStreak, setBestStreak] = useState(initial.bestStreak);
  const [solvedTotal, setSolvedTotal] = useState(initial.solvedTotal);
  const [countedToday, setCountedToday] = useState(initial.solvedToday);
  const [confetti, setConfetti] = useState(false);

  const prettyDate = useMemo(() => {
    const d = new Date(dateKey + 'T12:00:00Z');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }, [dateKey]);

  const onPieceDrop = useCallback(
    (from: string, to: string, promotion?: string): boolean => {
      const game = new Chess(puzzle.fen); // always judge from the puzzle position
      let move;
      try {
        move = game.move({ from, to, promotion: promotion ?? 'q' });
      } catch {
        return false; // illegal move — snap back
      }
      if (!move) return false;

      if (game.isCheckmate()) {
        // Correct! Show the mating move on the board, celebrate, record the streak.
        setFen(game.fen());
        setStatus('solved');
        if (!countedToday) {
          setConfetti(true);
          setTimeout(() => setConfetti(false), 3500);
          // Record server-side (keeps the streak honest); update from the response.
          fetch('/api/puzzle/solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to, promotion }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d?.correct) {
                setCountedToday(true);
                if (typeof d.streak === 'number') setStreak(d.streak);
                if (typeof d.bestStreak === 'number') setBestStreak(d.bestStreak);
                if (typeof d.solvedTotal === 'number') setSolvedTotal(d.solvedTotal);
              }
            })
            .catch(() => {});
        }
        return true;
      }

      // Legal but doesn't checkmate — wrong answer, snap the piece back.
      setStatus('wrong');
      return false;
    },
    [puzzle.fen, countedToday]
  );

  const solved = status === 'solved';

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      {confetti && <Confetti />}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">🧩 Daily Puzzle</h1>
          <p className="text-sm text-muted-foreground">{prettyDate}</p>
        </div>
        {/* Streak stats */}
        <div className="flex items-center gap-2">
          <Stat icon={<Flame className="h-4 w-4 text-accent" />} label="Streak" value={streak} highlight />
          <Stat icon={<Trophy className="h-4 w-4 text-primary" />} label="Best" value={bestStreak} />
          <Stat icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />} label="Solved" value={solvedTotal} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col items-center">
          <ChessBoard
            fen={fen}
            orientation={orientation}
            disabled={solved}
            onPieceDrop={onPieceDrop}
            maxWidth={560}
            id="daily-puzzle"
          />
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Target className="h-4 w-4 text-primary" /> Your mission
            </div>
            <p className="text-lg font-bold text-foreground">Checkmate in one move</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {orientation === 'white' ? 'White' : 'Black'} to move. Find the move that ends the game!
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              {puzzle.theme}
            </div>
          </div>

          {/* Status banner */}
          <div
            className={cn(
              'rounded-2xl border p-4 text-sm font-medium transition-colors',
              status === 'solved' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
              status === 'wrong' && 'border-rose-500/40 bg-rose-500/10 text-rose-300',
              status === 'idle' && 'border-border bg-card text-muted-foreground'
            )}
          >
            {status === 'solved' && (
              <span>
                {countedToday
                  ? '✓ Solved today — nice work! Come back tomorrow for a new puzzle.'
                  : 'Checkmate! 🎉 Puzzle solved.'}
              </span>
            )}
            {status === 'wrong' && <span>Not checkmate — try a different move! ♟️</span>}
            {status === 'idle' && <span>Drag a piece to deliver checkmate.</span>}
          </div>

          {!solved && status === 'wrong' && (
            <button
              onClick={() => {
                setFen(puzzle.fen);
                setStatus('idle');
              }}
              className="w-full rounded-xl border border-border bg-background py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              Reset board
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}

function Stat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2',
        highlight ? 'border-accent/40 bg-accent/10' : 'border-border bg-card'
      )}
    >
      {icon}
      <div className="leading-tight">
        <div className="text-base font-bold text-foreground">{value}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

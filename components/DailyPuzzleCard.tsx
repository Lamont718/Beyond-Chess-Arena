'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Puzzle, Flame } from 'lucide-react';

interface PuzzleStatus {
  streak: number;
  solvedToday: boolean;
}

/** Compact lobby promo for the daily puzzle — self-contained (fetches its own status). */
export default function DailyPuzzleCard() {
  const [s, setS] = useState<PuzzleStatus | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/puzzle')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setS({ streak: d.streak, solvedToday: d.solvedToday });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Link
      href="/puzzle"
      className="block rounded-2xl border border-accent/40 bg-accent/10 p-5 transition-colors hover:border-accent/70"
    >
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <Puzzle className="h-5 w-5 text-accent" /> Daily Puzzle
      </h2>
      {s?.solvedToday ? (
        <p className="text-sm text-emerald-300">✓ Solved today — back tomorrow for a new one!</p>
      ) : (
        <p className="text-sm text-muted-foreground">Checkmate in one. Keep your streak alive!</p>
      )}
      {s && s.streak > 0 && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
          <Flame className="h-4 w-4" /> {s.streak}-day streak
        </div>
      )}
    </Link>
  );
}

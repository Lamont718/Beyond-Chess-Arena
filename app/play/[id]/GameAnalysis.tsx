'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import ChessBoard from '@/components/chess/ChessBoard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PlyAnalysis, AnalysisResponse, MoveLabel } from './analysis.worker';

interface GameLite {
  status: string;
  moves: string[];
  white: { displayName: string; emoji: string } | null;
  black: { displayName: string; emoji: string } | null;
}

const LABEL_STYLES: Record<MoveLabel, string> = {
  good: 'text-emerald-400',
  inaccuracy: 'text-amber-300',
  mistake: 'text-orange-400',
  blunder: 'text-rose-400',
};
const LABEL_MARK: Record<MoveLabel, string> = { good: '', inaccuracy: '?!', mistake: '?', blunder: '??' };

export default function GameAnalysis({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<GameLite | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [plies, setPlies] = useState<PlyAnalysis[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    fetch(`/api/game/${gameId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.game && setGame(d.game))
      .catch(() => {});
    return () => workerRef.current?.terminate();
  }, [gameId]);

  const analyze = useCallback(() => {
    if (!game || analyzing) return;
    setAnalyzing(true);
    setProgress({ done: 0, total: game.moves.length });
    const worker = new Worker(new URL('./analysis.worker.ts', import.meta.url));
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<AnalysisResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setProgress({ done: msg.done, total: msg.total });
      } else if (msg.type === 'done') {
        setPlies(msg.plies);
        setAnalyzing(false);
        worker.terminate();
        workerRef.current = null;
        // Auto-select the biggest blunder, if any, to show something useful.
        const worst = msg.plies.reduce<PlyAnalysis | null>((acc, p) => (!acc || p.cpLoss > acc.cpLoss ? p : acc), null);
        if (worst && worst.cpLoss >= 80) setSelected(worst.ply);
      }
    };
    worker.postMessage({ sanMoves: game.moves });
  }, [game, analyzing]);

  const summary = useMemo(() => {
    if (!plies) return null;
    const side = (c: 'w' | 'b') => {
      const ps = plies.filter((p) => p.mover === c);
      const counts = { blunder: 0, mistake: 0, inaccuracy: 0 };
      let total = 0;
      for (const p of ps) {
        total += p.cpLoss;
        if (p.label !== 'good') counts[p.label]++;
      }
      const avg = ps.length ? total / ps.length : 0;
      const accuracy = Math.max(20, Math.min(99, Math.round(100 - avg / 5)));
      return { ...counts, accuracy, moves: ps.length };
    };
    return { w: side('w'), b: side('b') };
  }, [plies]);

  const keyMoments = useMemo(() => (plies ? plies.filter((p) => p.label === 'mistake' || p.label === 'blunder') : []), [plies]);
  const sel = selected != null && plies ? plies.find((p) => p.ply === selected) ?? null : null;

  if (!game || game.status !== 'completed') return null; // only for finished games
  if (game.moves.length < 2) return null;

  return (
    <section className="mx-auto mt-6 max-w-3xl rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="h-5 w-5 text-accent" /> Game review
        </h2>
        {!plies && (
          <Button variant="accent" onClick={analyze} disabled={analyzing}>
            {analyzing ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Analyzing… {progress.done}/{progress.total}
              </>
            ) : (
              'Analyze game'
            )}
          </Button>
        )}
      </div>

      {!plies && !analyzing && (
        <p className="text-sm text-muted-foreground">
          See where the game turned — the coach-engine checks every move and shows your mistakes and the better
          moves you could have played.
        </p>
      )}

      {analyzing && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
          />
        </div>
      )}

      {summary && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <PlayerSummary name={game.white?.displayName ?? 'White'} emoji={game.white?.emoji ?? '♙'} s={summary.w} />
            <PlayerSummary name={game.black?.displayName ?? 'Black'} emoji={game.black?.emoji ?? '♟'} s={summary.b} />
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
            {/* Review board */}
            <div className="flex flex-col items-center">
              {sel ? (
                <>
                  <ChessBoard
                    fen={sel.fenBefore}
                    orientation={sel.mover === 'w' ? 'white' : 'black'}
                    disabled
                    arrows={[{ from: sel.bestUci.slice(0, 2), to: sel.bestUci.slice(2, 4), color: '#2eb88a' }]}
                    maxWidth={420}
                    id="analysis-board"
                  />
                  <div className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm">
                    <p className="font-semibold text-foreground">
                      {moveNumber(sel.ply)} {sel.san}
                      <span className={cn('ml-1', LABEL_STYLES[sel.label])}>{LABEL_MARK[sel.label]} {sel.label}</span>
                    </p>
                    {sel.cpLoss > 0 ? (
                      <p className="mt-1 text-muted-foreground">
                        Better was <span className="font-semibold text-emerald-400">{sel.bestSan}</span> (green arrow) —
                        this move lost about {(sel.cpLoss / 100).toFixed(1)} pawns.
                      </p>
                    ) : (
                      <p className="mt-1 text-emerald-400">Best move — nicely played!</p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => stepSelect(plies!, selected, -1, setSelected)}
                      >
                        <ChevronLeft className="h-4 w-4" /> Prev
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => stepSelect(plies!, selected, 1, setSelected)}>
                        Next <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  🎉 No big mistakes — a clean game! Tap any move on the right to review it.
                </p>
              )}
            </div>

            {/* Key moments / move list */}
            <aside>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                {keyMoments.length ? 'Key moments' : 'All moves'}
              </h3>
              <div className="max-h-[24rem] space-y-1 overflow-y-auto pr-1">
                {(keyMoments.length ? keyMoments : plies).map((p) => (
                  <button
                    key={p.ply}
                    onClick={() => setSelected(p.ply)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted',
                      selected === p.ply && 'bg-muted'
                    )}
                  >
                    <span className="text-foreground">
                      {moveNumber(p.ply)} {p.san}
                      <span className={cn('ml-1 font-bold', LABEL_STYLES[p.label])}>{LABEL_MARK[p.label]}</span>
                    </span>
                    {p.cpLoss >= 80 && <span className="text-xs text-muted-foreground">-{(p.cpLoss / 100).toFixed(1)}</span>}
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function stepSelect(
  plies: PlyAnalysis[],
  current: number | null,
  dir: number,
  set: (n: number) => void
) {
  if (current == null) return;
  const idx = plies.findIndex((p) => p.ply === current);
  const next = plies[idx + dir];
  if (next) set(next.ply);
}

function moveNumber(ply: number): string {
  const full = Math.floor(ply / 2) + 1;
  return ply % 2 === 0 ? `${full}.` : `${full}...`;
}

function PlayerSummary({ name, emoji, s }: { name: string; emoji: string; s: { accuracy: number; blunder: number; mistake: number; inaccuracy: number } }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="truncate text-sm font-semibold text-foreground">{name}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-primary">{s.accuracy}%</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">accuracy</div>
      <div className="mt-2 flex gap-3 text-xs">
        <span className="text-rose-400">{s.blunder} ✗</span>
        <span className="text-orange-400">{s.mistake} ?</span>
        <span className="text-amber-300">{s.inaccuracy} ?!</span>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { Bot, Loader2, RotateCcw, Undo2, Flag } from 'lucide-react';
import ChessBoard from '@/components/chess/ChessBoard';
import BoardSettings from '@/components/chess/BoardSettings';
import GameEndModal, { type GameResult, type GameEndReason } from '@/components/chess/GameEndModal';
import { Button } from '@/components/ui/button';
import { loadBoardPrefs, type BoardPreferences } from '@/lib/chess-preferences';
import { ENGINE_LEVELS, type EngineLevel } from '@/lib/engine-levels';
import { cn } from '@/lib/utils';

type EngineMove = { from: string; to: string; promotion?: string } | null;

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
type ColorChoice = 'white' | 'black' | 'random';

export default function ComputerClient() {
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup');
  const [levelKey, setLevelKey] = useState('easy');
  const [colorChoice, setColorChoice] = useState<ColorChoice>('white');

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(START_FEN);
  const [myColor, setMyColor] = useState<'white' | 'black'>('white');
  const [thinking, setThinking] = useState(false);
  const [over, setOver] = useState<{ result: GameResult; reason: GameEndReason } | null>(null);
  const [flip, setFlip] = useState(false);
  const [prefs, setPrefs] = useState<BoardPreferences | null>(null);
  const [endDismissed, setEndDismissed] = useState(false);

  useEffect(() => setPrefs(loadBoardPrefs()), []);

  // --- Web Worker: runs the engine off the main thread so the board never freezes ---
  const workerRef = useRef<Worker | null>(null);
  const pendingRef = useRef<Map<number, (m: EngineMove) => void>>(new Map());
  const reqIdRef = useRef(0);

  useEffect(() => {
    try {
      const w = new Worker(new URL('./engine.worker.ts', import.meta.url));
      w.onmessage = (e: MessageEvent<{ id: number; move: EngineMove }>) => {
        pendingRef.current.get(e.data.id)?.(e.data.move);
      };
      w.onerror = () => {
        // Worker blew up — disable it; pending requests fall back via their timeout.
        try {
          w.terminate();
        } catch {}
        if (workerRef.current === w) workerRef.current = null;
      };
      workerRef.current = w;
    } catch {
      workerRef.current = null; // no worker support — main-thread compute below
    }
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      pendingRef.current.clear();
    };
  }, []);

  const computeMove = useCallback(async (fen: string, lvl: EngineLevel): Promise<EngineMove> => {
    const start = Date.now();
    const onMainThread = async () => (await import('@/lib/engine')).bestMove(fen, lvl);

    let move: EngineMove;
    const w = workerRef.current;
    if (w) {
      move = await new Promise<EngineMove>((resolve) => {
        const id = ++reqIdRef.current;
        let done = false;
        const settle = (m: EngineMove) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          pendingRef.current.delete(id);
          resolve(m);
        };
        // If the worker never answers (e.g. failed to load), disable it and
        // compute on the main thread so a game can never hang.
        const timer = setTimeout(() => {
          try {
            w.terminate();
          } catch {}
          if (workerRef.current === w) workerRef.current = null;
          onMainThread().then(settle);
        }, lvl.timeMs + 2500);
        pendingRef.current.set(id, settle);
        try {
          w.postMessage({ id, fen, level: lvl });
        } catch {
          onMainThread().then(settle);
        }
      });
    } else {
      move = await onMainThread();
    }

    // Small floor so fast levels still show a brief "thinking…" beat.
    const elapsed = Date.now() - start;
    if (elapsed < 280) await new Promise((r) => setTimeout(r, 280 - elapsed));
    return move;
  }, []);

  const level: EngineLevel = ENGINE_LEVELS.find((l) => l.key === levelKey) ?? ENGINE_LEVELS[1];
  const myChar = myColor === 'white' ? 'w' : 'b';

  const checkOver = useCallback((): boolean => {
    const g = gameRef.current;
    if (!g.isGameOver()) return false;
    if (g.isCheckmate()) {
      const loserChar = g.turn(); // side to move is checkmated
      const result: GameResult = loserChar === myChar ? 'loss' : 'win';
      setOver({ result, reason: 'checkmate' });
    } else {
      const reason: GameEndReason = g.isStalemate()
        ? 'stalemate'
        : g.isInsufficientMaterial()
          ? 'insufficient-material'
          : g.isThreefoldRepetition()
            ? 'threefold-repetition'
            : 'fifty-move-rule';
      setOver({ result: 'draw', reason });
    }
    return true;
  }, [myChar]);

  const engineMove = useCallback(async () => {
    const reqFen = gameRef.current.fen();
    setThinking(true);
    const mv = await computeMove(reqFen, level);
    // Discard a stale result if the position changed (new game / take back) while thinking.
    if (gameRef.current.fen() !== reqFen) {
      setThinking(false);
      return;
    }
    if (mv) {
      try {
        gameRef.current.move({ from: mv.from, to: mv.to, promotion: (mv.promotion as any) || 'q' });
        setFen(gameRef.current.fen());
      } catch {
        /* shouldn't happen */
      }
    }
    setThinking(false);
    checkOver();
  }, [level, checkOver, computeMove]);

  function startGame() {
    const resolved: 'white' | 'black' =
      colorChoice === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : colorChoice;
    gameRef.current = new Chess();
    setFen(START_FEN);
    setMyColor(resolved);
    setOver(null);
    setEndDismissed(false);
    setFlip(false);
    setThinking(false);
    setPhase('playing');
    if (resolved === 'black') {
      // Engine (white) moves first.
      void engineMove();
    }
  }

  const onDrop = useCallback(
    (from: string, to: string, promotion?: string) => {
      const g = gameRef.current;
      if (over || thinking || g.turn() !== myChar) return false;
      try {
        const mv = g.move({ from, to, promotion: (promotion as any) || 'q' });
        if (!mv) return false;
      } catch {
        return false;
      }
      setFen(g.fen());
      if (!checkOver()) engineMove();
      return true;
    },
    [over, thinking, myChar, checkOver, engineMove]
  );

  function takeBack() {
    const g = gameRef.current;
    if (thinking || g.history().length === 0) return;
    g.undo(); // undo engine reply (or my move if I'm to move last)
    if (g.history().length > 0 && g.turn() !== myChar) g.undo();
    setFen(g.fen());
    setOver(null);
    setEndDismissed(false);
  }

  function resign() {
    if (over) return;
    setOver({ result: 'loss', reason: 'resignation' });
  }

  if (!prefs) return null;

  // ---- Setup screen ----
  if (phase === 'setup') {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold">
          <Bot className="h-6 w-6 text-primary" /> Play the Computer
        </h1>
        <p className="mb-6 text-sm text-muted-foreground">Practice on your own. Pick a level and a side.</p>

        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Difficulty</h2>
        <div className="mb-6 grid gap-2 sm:grid-cols-2">
          {ENGINE_LEVELS.map((l, i) => (
            <button
              key={l.key}
              onClick={() => setLevelKey(l.key)}
              className={cn(
                'rounded-xl border p-4 text-left transition-all',
                levelKey === l.key ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border bg-card hover:border-primary/40'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{['🐣', '🙂', '🧠', '🔥'][i]}</span>
                <span className="font-bold text-foreground">{l.label}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{l.blurb}</p>
            </button>
          ))}
        </div>

        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your side</h2>
        <div className="mb-8 grid grid-cols-3 gap-2">
          {(['white', 'black', 'random'] as ColorChoice[]).map((c) => (
            <button
              key={c}
              onClick={() => setColorChoice(c)}
              className={cn(
                'rounded-xl border py-3 text-center font-medium capitalize transition-all',
                colorChoice === c ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border bg-card hover:border-primary/40'
              )}
            >
              {c === 'white' ? '♔ White' : c === 'black' ? '♚ Black' : '🎲 Random'}
            </button>
          ))}
        </div>

        <Button size="lg" className="w-full" onClick={startGame}>
          Start game
        </Button>
      </main>
    );
  }

  // ---- Playing screen ----
  const orientation: 'white' | 'black' = flip ? (myColor === 'white' ? 'black' : 'white') : myColor;
  const turnChar = fen.split(' ')[1];
  const isMyTurn = turnChar === myChar;

  return (
    <main className="mx-auto max-w-3xl px-4 py-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 font-semibold">
          <Bot className="h-5 w-5 text-primary" /> {level.label} bot
          {thinking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </span>
        <BoardSettings orientation={orientation} onFlip={() => setFlip((v) => !v)} onPrefsChange={setPrefs} />
      </div>

      <div className="mb-2 rounded-lg border border-border bg-card px-4 py-2 text-center text-sm text-muted-foreground">
        {over
          ? 'Game over'
          : thinking
            ? 'Computer is thinking…'
            : isMyTurn
              ? 'Your move'
              : 'Waiting…'}
      </div>

      <ChessBoard
        id="vs-computer"
        fen={fen}
        orientation={orientation}
        disabled={!!over || thinking || !isMyTurn}
        onPieceDrop={onDrop}
        boardTheme={prefs.theme}
        enableSounds={prefs.sounds}
        autoPromoteTo={prefs.autoPromoteTo}
        showCoordinates={prefs.showCoordinates}
        allowArrowDrawing={prefs.allowArrowDrawing}
      />

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={takeBack} disabled={thinking || gameRef.current.history().length === 0}>
          <Undo2 className="mr-1.5 h-4 w-4" /> Take back
        </Button>
        {!over && (
          <Button variant="destructive" onClick={resign}>
            <Flag className="mr-1.5 h-4 w-4" /> Resign
          </Button>
        )}
        <Button onClick={() => setPhase('setup')}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> New game
        </Button>
      </div>

      {over && !endDismissed && (
        <GameEndModal
          open
          result={over.result}
          reason={over.reason}
          subtitle={
            over.result === 'win'
              ? `You beat the ${level.label} bot!`
              : over.result === 'loss'
                ? `The ${level.label} bot got you this time.`
                : 'A drawn game.'
          }
          moveCount={Math.ceil(gameRef.current.history().length / 2)}
          playAgainLabel="New game"
          onPlayAgain={() => setPhase('setup')}
          onClose={() => setEndDismissed(true)}
        />
      )}
    </main>
  );
}

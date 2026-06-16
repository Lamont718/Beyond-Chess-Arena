'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Chess } from 'chess.js';
import { toast } from 'sonner';
import { ArrowLeft, Flag, Handshake, Loader2, Eye, Check, X } from 'lucide-react';
import ChessBoard from '@/components/chess/ChessBoard';
import BoardSettings from '@/components/chess/BoardSettings';
import GameEndModal, { type GameResult, type GameEndReason } from '@/components/chess/GameEndModal';
import { Button } from '@/components/ui/button';
import ChatPanel from '@/components/ChatPanel';
import { loadBoardPrefs, type BoardPreferences } from '@/lib/chess-preferences';
import { formatClock } from '@/lib/clock';
import { describeTimeControl } from '@/lib/time-controls';
import { cn } from '@/lib/utils';

interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  emoji: string;
}
interface GameDTO {
  id: string;
  whiteId: string;
  blackId: string;
  fen: string;
  moves: string[];
  turn: string;
  status: string;
  result: string | null;
  reason: string | null;
  winnerId: string | null;
  timeControlSec: number;
  incrementSec: number;
  rated: boolean;
  whiteMs: number | null;
  blackMs: number | null;
  lastMoveAt: string;
  drawOfferBy: string | null;
  rematchOfferBy: string | null;
  rematchGameId: string | null;
  white: PublicUser;
  black: PublicUser;
  yourColor: 'white' | 'black' | null;
  isYourTurn: boolean;
  ratingChange: number | null;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function GameClient({ gameId, meId }: { gameId: string; meId: string }) {
  const router = useRouter();
  const [game, setGame] = useState<GameDTO | null>(null);
  const [fen, setFen] = useState(START_FEN);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [flip, setFlip] = useState(false);
  const [prefs, setPrefs] = useState<BoardPreferences | null>(null);
  const [endDismissed, setEndDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef(false);

  useEffect(() => setPrefs(loadBoardPrefs()), []);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/game/${gameId}`, { cache: 'no-store' });
      if (res.status === 401) return router.push('/login');
      if (res.status === 404) {
        toast.error('Game not found.');
        return router.push('/');
      }
      if (!res.ok) return;
      const { game: g } = (await res.json()) as { game: GameDTO };
      setGame(g);
      setFetchedAt(Date.now());
      if (!pendingRef.current) setFen(g.fen);
      if (g.rematchGameId && g.rematchGameId !== gameId) router.push(`/play/${g.rematchGameId}`);
    } catch {
      /* transient */
    }
  }, [gameId, router]);

  useEffect(() => {
    poll();
    const i = setInterval(poll, 1100);
    return () => clearInterval(i);
  }, [poll]);

  // Smooth local clock tick.
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(i);
  }, []);

  const onDrop = useCallback(
    (from: string, to: string, promotion?: string) => {
      if (!game || game.yourColor === null || !game.isYourTurn || game.status !== 'active') return false;
      const copy = new Chess(fen);
      let san: string;
      try {
        const mv = copy.move({ from, to, promotion: (promotion as any) || 'q' });
        if (!mv) return false;
        san = mv.san;
      } catch {
        return false;
      }
      pendingRef.current = true;
      setFen(copy.fen()); // optimistic
      void (async () => {
        try {
          const res = await fetch(`/api/game/${gameId}/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to, promotion: promotion || 'q' }),
          });
          const d = await res.json();
          if (!res.ok) {
            toast.error(d.error || 'Move rejected.');
            setFen(game.fen); // revert
          } else {
            setGame(d.game);
            setFetchedAt(Date.now());
            setFen(d.game.fen);
          }
        } catch {
          setFen(game.fen);
        } finally {
          pendingRef.current = false;
        }
      })();
      return true;
    },
    [game, fen, gameId]
  );

  async function act(path: string, body?: any): Promise<any> {
    setBusy(true);
    try {
      const res = await fetch(`/api/game/${gameId}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d.error || 'Something went wrong.');
        return null;
      }
      if (d.game) {
        setGame(d.game);
        setFetchedAt(Date.now());
      }
      return d;
    } finally {
      setBusy(false);
    }
  }

  if (!game || !prefs) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPlayer = game.yourColor !== null;
  const isSpectator = !isPlayer;
  const isOver = game.status !== 'active';

  const naturalOrientation: 'white' | 'black' = isPlayer ? (game.yourColor as 'white' | 'black') : 'white';
  const orientation: 'white' | 'black' = flip
    ? naturalOrientation === 'white'
      ? 'black'
      : 'white'
    : naturalOrientation;

  // Clock display (smooth, runs the side to move down between polls).
  const displayMs = (side: 'w' | 'b'): number | null => {
    const base = side === 'w' ? game.whiteMs : game.blackMs;
    if (base == null) return null;
    if (game.status !== 'active') return base;
    if (game.turn === side) return Math.max(0, base - (now - fetchedAt));
    return base;
  };

  const bottomColor: 'w' | 'b' = orientation === 'white' ? 'w' : 'b';
  const topColor: 'w' | 'b' = bottomColor === 'w' ? 'b' : 'w';
  const playerFor = (c: 'w' | 'b') => (c === 'w' ? game.white : game.black);

  const drawOfferedToMe = !!game.drawOfferBy && game.drawOfferBy !== meId && isPlayer && !isOver;
  const iOfferedDraw = game.drawOfferBy === meId;
  const rematchOfferedToMe = !!game.rematchOfferBy && game.rematchOfferBy !== meId && isPlayer && isOver && !game.rematchGameId;
  const iOfferedRematch = game.rematchOfferBy === meId && !game.rematchGameId;

  // End modal (players only).
  const modalResult: GameResult | null =
    isPlayer && isOver && game.result
      ? game.result === 'draw'
        ? 'draw'
        : (game.result === 'white_wins' && game.yourColor === 'white') ||
            (game.result === 'black_wins' && game.yourColor === 'black')
          ? 'win'
          : 'loss'
      : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-5">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Lobby
        </Button>
        {isSpectator && (
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Spectating
          </span>
        )}
        <BoardSettings orientation={orientation} onFlip={() => setFlip((v) => !v)} onPrefsChange={setPrefs} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Board + player strips */}
        <div>
          <PlayerStrip player={playerFor(topColor)} clock={formatClock(displayMs(topColor))} active={game.status === 'active' && game.turn === topColor} you={isPlayer && game.yourColor?.[0] === topColor} />
          <div className="my-2">
            <ChessBoard
              id={`game-${gameId}`}
              fen={fen}
              orientation={orientation}
              disabled={isOver || !isPlayer || !game.isYourTurn}
              onPieceDrop={isPlayer ? onDrop : undefined}
              boardTheme={prefs.theme}
              enableSounds={prefs.sounds}
              autoPromoteTo={prefs.autoPromoteTo}
              showCoordinates={prefs.showCoordinates}
              allowArrowDrawing={prefs.allowArrowDrawing}
            />
          </div>
          <PlayerStrip player={playerFor(bottomColor)} clock={formatClock(displayMs(bottomColor))} active={game.status === 'active' && game.turn === bottomColor} you={isPlayer && game.yourColor?.[0] === bottomColor} />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status / banners */}
          {drawOfferedToMe && (
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
              <p className="mb-2 text-sm font-medium">Opponent offers a draw.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => act('draw', { action: 'accept' })} disabled={busy}>
                  <Check className="mr-1 h-4 w-4" /> Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => act('draw', { action: 'decline' })} disabled={busy}>
                  <X className="mr-1 h-4 w-4" /> Decline
                </Button>
              </div>
            </div>
          )}
          {rematchOfferedToMe && (
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
              <p className="mb-2 text-sm font-medium">Opponent wants a rematch!</p>
              <Button size="sm" onClick={() => act('rematch').then((d) => d?.gameId && router.push(`/play/${d.gameId}`))} disabled={busy}>
                Accept rematch
              </Button>
            </div>
          )}

          {/* Move history */}
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              Moves · {describeTimeControl(game.timeControlSec, game.incrementSec)} · {game.rated ? 'Ranked' : 'Casual'}
            </h2>
            <MoveList moves={game.moves} />
          </section>

          {/* Controls */}
          {isPlayer && !isOver && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy || iOfferedDraw}
                onClick={() => act('draw', { action: 'offer' }).then(() => toast.message('Draw offered'))}
              >
                <Handshake className="mr-1.5 h-4 w-4" /> {iOfferedDraw ? 'Draw offered' : 'Offer draw'}
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  if (confirm('Resign this game?')) act('resign');
                }}
              >
                <Flag className="mr-1.5 h-4 w-4" /> Resign
              </Button>
            </div>
          )}
          {isPlayer && isOver && (
            <Button
              className="w-full"
              disabled={busy}
              onClick={() => act('rematch').then((d) => {
                if (d?.gameId) router.push(`/play/${d.gameId}`);
                else if (d?.offered) toast.message('Rematch offered — waiting for opponent.');
              })}
            >
              {iOfferedRematch ? 'Rematch offered…' : 'Rematch'}
            </Button>
          )}
          {isOver && (
            <p className="text-center text-sm text-muted-foreground">
              {resultText(game)}
            </p>
          )}

          {/* In-game chat is private to the two players (kid-safety: spectators
              can't read or post in someone else's game). */}
          {isPlayer && (
            <ChatPanel scope={`game:${gameId}`} title="Game chat" heightClass="h-56" />
          )}
        </div>
      </div>

      {modalResult && !endDismissed && (
        <GameEndModal
          open
          result={modalResult}
          reason={(game.reason as GameEndReason) || 'resignation'}
          subtitle={game.rated ? resultText(game) : `${resultText(game)} · Casual — rating unchanged`}
          moveCount={game.moves.length}
          ratingChange={game.ratingChange}
          playAgainLabel={iOfferedRematch ? 'Rematch offered…' : 'Rematch'}
          onPlayAgain={() =>
            act('rematch').then((d) => {
              if (d?.gameId) router.push(`/play/${d.gameId}`);
              else if (d?.offered) toast.message('Rematch offered — waiting for opponent.');
            })
          }
          onReview={() => router.push('/')}
          onClose={() => setEndDismissed(true)}
        />
      )}
    </main>
  );
}

function PlayerStrip({
  player,
  clock,
  active,
  you,
}: {
  player: PublicUser;
  clock: string;
  active: boolean;
  you: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors',
        active ? 'border-primary/50 bg-primary/10' : 'border-border bg-card'
      )}
    >
      <span className="text-2xl">{player.emoji}</span>
      <div className="flex-1 leading-tight">
        <p className="font-semibold text-foreground">
          {player.displayName} {you && <span className="text-xs text-muted-foreground">(you)</span>}
        </p>
        <p className="text-xs text-muted-foreground">Rating {player.rating}</p>
      </div>
      <div
        className={cn(
          'rounded-lg px-3 py-1.5 font-mono text-xl font-bold tabular-nums',
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
        )}
      >
        {clock}
      </div>
    </div>
  );
}

function MoveList({ moves }: { moves: string[] }) {
  if (moves.length === 0) return <p className="text-sm text-muted-foreground">No moves yet.</p>;
  const rows: { n: number; w: string; b?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ n: i / 2 + 1, w: moves[i], b: moves[i + 1] });
  }
  return (
    <div className="max-h-72 overflow-y-auto pr-1 text-sm">
      <div className="grid grid-cols-[2rem_1fr_1fr] gap-y-0.5">
        {rows.map((r) => (
          <div key={r.n} className="contents">
            <span className="text-muted-foreground">{r.n}.</span>
            <span className="font-mono font-medium text-foreground">{r.w}</span>
            <span className="font-mono font-medium text-foreground">{r.b ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function resultText(game: GameDTO): string {
  if (game.status === 'active') return '';
  const reason = game.reason ? ` (${game.reason.replace(/-/g, ' ')})` : '';
  if (game.result === 'draw') return `Draw${reason}`;
  const winner = game.result === 'white_wins' ? game.white : game.black;
  return `${winner.displayName} won${reason}`;
}

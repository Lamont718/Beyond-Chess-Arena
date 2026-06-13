// Pure clock helpers — no server deps, safe to import on the client for smooth ticking.

export interface ClockGame {
  status: string;
  timeControlSec: number;
  turn: string;
  whiteMs: number | null;
  blackMs: number | null;
  lastMoveAt: string | Date;
}

/** Remaining ms for each side right now, accounting for the running clock of the side to move. */
export function liveRemaining(game: ClockGame): { whiteMs: number | null; blackMs: number | null } {
  let whiteMs = game.whiteMs;
  let blackMs = game.blackMs;
  if (game.status === 'active' && game.timeControlSec > 0 && whiteMs != null && blackMs != null) {
    const elapsed = Date.now() - new Date(game.lastMoveAt).getTime();
    if (game.turn === 'w') whiteMs = Math.max(0, whiteMs - elapsed);
    else blackMs = Math.max(0, blackMs - elapsed);
  }
  return { whiteMs, blackMs };
}

/** Which side (if any) has run out of time on their move. */
export function flaggedSide(game: ClockGame): 'w' | 'b' | null {
  if (game.status !== 'active' || game.timeControlSec <= 0) return null;
  const { whiteMs, blackMs } = liveRemaining(game);
  if (game.turn === 'w' && (whiteMs ?? 1) <= 0) return 'w';
  if (game.turn === 'b' && (blackMs ?? 1) <= 0) return 'b';
  return null;
}

export function formatClock(ms: number | null): string {
  if (ms == null) return '∞';
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  // Show tenths under 10s for that tense final-seconds feel.
  if (ms < 10_000 && ms > 0) {
    const tenths = Math.floor((ms % 1000) / 100);
    return `${m}:${s.toString().padStart(2, '0')}.${tenths}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

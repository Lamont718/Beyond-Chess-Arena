import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Chess } from 'chess.js';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { serializeGame } from '@/lib/serialize';
import { flaggedSide } from '@/lib/clock';
import { finalizeGame, type GameResult } from '@/lib/game-logic';

export const dynamic = 'force-dynamic';

const schema = z.object({
  from: z.string().min(2).max(2),
  to: z.string().min(2).max(2),
  promotion: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const game = await prisma.game.findUnique({ where: { id: params.id } });
  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  if (game.status !== 'active')
    return NextResponse.json({ error: 'Game is over' }, { status: 409 });

  const myColor = game.whiteId === me.id ? 'w' : game.blackId === me.id ? 'b' : null;
  if (!myColor) return NextResponse.json({ error: 'You are not a player in this game' }, { status: 403 });
  if (game.turn !== myColor) return NextResponse.json({ error: 'Not your turn' }, { status: 409 });

  // Did the clock already run out before this move landed?
  const flagged = flaggedSide(game);
  if (flagged) {
    const result: GameResult = flagged === 'w' ? 'black_wins' : 'white_wins';
    const winnerId = flagged === 'w' ? game.blackId : game.whiteId;
    await finalizeGame(game.id, { result, reason: 'timeout', winnerId });
    const after = await prisma.game.findUnique({
      where: { id: game.id },
      include: { white: true, black: true },
    });
    return NextResponse.json({ game: serializeGame(after, me.id) });
  }

  // Validate + apply the move authoritatively on the server.
  const chess = new Chess(game.fen);
  let san: string;
  try {
    const move = chess.move({ from: parsed.data.from, to: parsed.data.to, promotion: (parsed.data.promotion as any) || 'q' });
    if (!move) throw new Error('illegal');
    san = move.san;
  } catch {
    return NextResponse.json({ error: 'Illegal move' }, { status: 400 });
  }

  // Clocks.
  const now = Date.now();
  let whiteMs = game.whiteMs;
  let blackMs = game.blackMs;
  if (game.timeControlSec > 0 && whiteMs != null && blackMs != null) {
    const elapsed = now - new Date(game.lastMoveAt).getTime();
    if (myColor === 'w') whiteMs = Math.max(0, whiteMs - elapsed) + game.incrementSec * 1000;
    else blackMs = Math.max(0, blackMs - elapsed) + game.incrementSec * 1000;
  }

  const moves: string[] = safeParse(game.movesJson);
  moves.push(san);

  // Optimistic lock: only apply if the position is still exactly what we
  // validated against (same fen + turn + still active). This makes the
  // read-modify-write atomic without a long transaction — a concurrent move or
  // double-submit that already changed the board will match 0 rows and 409.
  const applied = await prisma.game.updateMany({
    where: { id: game.id, status: 'active', turn: myColor, fen: game.fen },
    data: {
      fen: chess.fen(),
      movesJson: JSON.stringify(moves),
      turn: chess.turn(),
      whiteMs,
      blackMs,
      lastMoveAt: new Date(now),
      drawOfferBy: null, // making a move declines any pending draw offer
    },
  });
  if (applied.count === 0) {
    return NextResponse.json({ error: 'Position changed — please retry.' }, { status: 409 });
  }

  // Terminal position?
  if (chess.isGameOver()) {
    if (chess.isCheckmate()) {
      const result: GameResult = myColor === 'w' ? 'white_wins' : 'black_wins';
      await finalizeGame(game.id, { result, reason: 'checkmate', winnerId: me.id });
    } else {
      const reason = chess.isStalemate()
        ? 'stalemate'
        : chess.isInsufficientMaterial()
          ? 'insufficient-material'
          : chess.isThreefoldRepetition()
            ? 'threefold-repetition'
            : 'fifty-move-rule';
      await finalizeGame(game.id, { result: 'draw', reason });
    }
  }

  const after = await prisma.game.findUnique({
    where: { id: game.id },
    include: { white: true, black: true },
  });
  return NextResponse.json({ game: serializeGame(after, me.id), move: san });
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

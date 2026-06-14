import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Chess } from 'chess.js';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { getDailyPuzzle, nyDateKey, dayIndex } from '@/lib/daily-puzzle';
import { XP_AWARDS } from '@/lib/levels';

export const dynamic = 'force-dynamic';

const schema = z.object({
  from: z.string().regex(/^[a-h][1-8]$/),
  to: z.string().regex(/^[a-h][1-8]$/),
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
});

// POST /api/puzzle/solve { from, to, promotion? }
// The move is validated SERVER-SIDE: it counts only if it delivers checkmate in
// today's position. This keeps the streak honest (no faking it from the client).
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad move' }, { status: 400 });

  const dateKey = nyDateKey();
  const puzzle = getDailyPuzzle(dateKey);

  // Is the submitted move a legal move that checkmates?
  const game = new Chess(puzzle.fen);
  let correct = false;
  try {
    game.move({ from: parsed.data.from, to: parsed.data.to, promotion: parsed.data.promotion ?? 'q' });
    correct = game.isCheckmate();
  } catch {
    correct = false;
  }

  if (!correct) {
    return NextResponse.json({ correct: false });
  }

  // Already solved today? Idempotent success.
  const existing = await prisma.puzzleSolve.findUnique({
    where: { userId_dateKey: { userId: me.id, dateKey } },
  });
  if (existing) {
    return NextResponse.json({
      correct: true,
      alreadySolved: true,
      streak: me.puzzleStreak,
      bestStreak: me.puzzleBestStreak,
      solvedTotal: me.puzzlesSolved,
    });
  }

  // Continue the streak if yesterday was solved; otherwise start a new one.
  const continues = me.puzzleLastDate
    ? dayIndex(dateKey) - dayIndex(me.puzzleLastDate) === 1
    : false;
  const streak = continues ? me.puzzleStreak + 1 : 1;
  const bestStreak = Math.max(me.puzzleBestStreak, streak);

  await prisma.$transaction([
    prisma.puzzleSolve.create({
      data: { userId: me.id, dateKey, puzzleId: puzzle.id },
    }),
    prisma.user.update({
      where: { id: me.id },
      data: {
        puzzleStreak: streak,
        puzzleBestStreak: bestStreak,
        puzzleLastDate: dateKey,
        puzzlesSolved: { increment: 1 },
        xp: { increment: XP_AWARDS.puzzle },
      },
    }),
  ]);

  return NextResponse.json({
    correct: true,
    streak,
    bestStreak,
    solvedTotal: me.puzzlesSolved + 1,
    newStreak: !continues,
  });
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { getDailyPuzzle, nyDateKey } from '@/lib/daily-puzzle';

export const dynamic = 'force-dynamic';

// GET /api/puzzle → today's puzzle (no solution) + this user's streak + solved?
export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const dateKey = nyDateKey();
  const puzzle = getDailyPuzzle(dateKey);

  const solvedToday = await prisma.puzzleSolve.findUnique({
    where: { userId_dateKey: { userId: me.id, dateKey } },
  });

  return NextResponse.json({
    dateKey,
    // Deliberately omit `mates` so the answer can't be read off the network.
    puzzle: {
      id: puzzle.id,
      fen: puzzle.fen,
      sideToMove: puzzle.sideToMove,
      theme: puzzle.theme,
      difficulty: puzzle.difficulty,
    },
    streak: me.puzzleStreak,
    bestStreak: me.puzzleBestStreak,
    solvedTotal: me.puzzlesSolved,
    solvedToday: !!solvedToday,
  });
}

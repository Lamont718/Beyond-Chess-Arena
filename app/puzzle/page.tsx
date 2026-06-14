import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import NavBar from '@/components/NavBar';
import { getDailyPuzzle, nyDateKey } from '@/lib/daily-puzzle';
import PuzzleClient from './PuzzleClient';

export const dynamic = 'force-dynamic';

export default async function PuzzlePage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const dateKey = nyDateKey();
  const puzzle = getDailyPuzzle(dateKey);
  const solvedToday = await prisma.puzzleSolve.findUnique({
    where: { userId_dateKey: { userId: me.id, dateKey } },
  });

  return (
    <>
      <NavBar me={me} />
      <PuzzleClient
        dateKey={dateKey}
        puzzle={{
          id: puzzle.id,
          fen: puzzle.fen,
          sideToMove: puzzle.sideToMove,
          theme: puzzle.theme,
          difficulty: puzzle.difficulty,
        }}
        initial={{
          streak: me.puzzleStreak,
          bestStreak: me.puzzleBestStreak,
          solvedTotal: me.puzzlesSolved,
          solvedToday: !!solvedToday,
        }}
      />
    </>
  );
}

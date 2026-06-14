// Create one finished demo game (a Scholar's-mate blunder) so the post-game
// "Analyze game" review has something real to chew on. Direct DB insert — no
// ratings are touched. Prints the play URL. Run: npx tsx scripts/make-demo-game.ts
import { PrismaClient } from '@prisma/client';
import { Chess } from 'chess.js';

const prisma = new PrismaClient();

async function main() {
  const white = await prisma.user.findUnique({ where: { username: 'maya' } });
  const black = await prisma.user.findUnique({ where: { username: 'leo' } });
  if (!white || !black) throw new Error('demo users missing');

  // 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#  — black's Nf6 is the blunder.
  const sans = ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'];
  const g = new Chess();
  for (const s of sans) g.move(s);

  const game = await prisma.game.create({
    data: {
      whiteId: white.id,
      blackId: black.id,
      fen: g.fen(),
      movesJson: JSON.stringify(sans),
      turn: g.turn(),
      status: 'completed',
      result: 'white_wins',
      reason: 'checkmate',
      winnerId: white.id,
      timeControlSec: 300,
      incrementSec: 0,
      whiteMs: 200000,
      blackMs: 180000,
      endedAt: new Date(),
      whiteRatingBefore: white.rating,
      blackRatingBefore: black.rating,
      whiteRatingAfter: white.rating,
      blackRatingAfter: black.rating,
    },
  });

  console.log('Demo game created:');
  console.log(`  https://beyondchess-arena.vercel.app/play/${game.id}`);
  console.log('  Log in as maya or leo (chess123) to view + Analyze.');
  await prisma.$disconnect();
}
main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});

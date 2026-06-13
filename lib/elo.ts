// Standard Elo. K=32 so kids' ratings move noticeably game-to-game.
const K = 32;

function expected(a: number, b: number) {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/**
 * Returns the new ratings after a game.
 * whiteScore: 1 = white won, 0 = white lost, 0.5 = draw.
 */
export function applyElo(whiteRating: number, blackRating: number, whiteScore: number) {
  const eWhite = expected(whiteRating, blackRating);
  const eBlack = 1 - eWhite;
  const blackScore = 1 - whiteScore;
  const newWhite = Math.round(whiteRating + K * (whiteScore - eWhite));
  const newBlack = Math.round(blackRating + K * (blackScore - eBlack));
  return { newWhite, newBlack };
}

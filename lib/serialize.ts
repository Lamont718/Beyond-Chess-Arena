import { liveRemaining } from './clock';

interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  rating: number;
  emoji: string;
}

export function publicUser(u: any): PublicUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    rating: u.rating,
    emoji: u.emoji,
  };
}

/**
 * Turn a Game row (with `white` and `black` users included) into the DTO the
 * client expects, computing live clocks and the viewer's perspective.
 */
export function serializeGame(game: any, viewerId: string | null) {
  const { whiteMs, blackMs } = liveRemaining(game);
  const moves: string[] = safeParse(game.movesJson);

  let yourColor: 'white' | 'black' | null = null;
  if (viewerId && viewerId === game.whiteId) yourColor = 'white';
  else if (viewerId && viewerId === game.blackId) yourColor = 'black';

  const isYourTurn =
    game.status === 'active' &&
    ((yourColor === 'white' && game.turn === 'w') || (yourColor === 'black' && game.turn === 'b'));

  // Rating delta from the viewer's perspective, once the game is rated/completed.
  let ratingChange: number | null = null;
  if (game.status === 'completed' && yourColor && game.whiteRatingAfter != null) {
    ratingChange =
      yourColor === 'white'
        ? game.whiteRatingAfter - (game.whiteRatingBefore ?? game.whiteRatingAfter)
        : game.blackRatingAfter - (game.blackRatingBefore ?? game.blackRatingAfter);
  }

  return {
    id: game.id,
    whiteId: game.whiteId,
    blackId: game.blackId,
    fen: game.fen,
    moves,
    turn: game.turn,
    status: game.status,
    result: game.result,
    reason: game.reason,
    winnerId: game.winnerId,
    timeControlSec: game.timeControlSec,
    incrementSec: game.incrementSec,
    whiteMs,
    blackMs,
    lastMoveAt: game.lastMoveAt,
    drawOfferBy: game.drawOfferBy,
    rematchOfferBy: game.rematchOfferBy,
    rematchGameId: game.rematchGameId,
    white: game.white ? publicUser(game.white) : null,
    black: game.black ? publicUser(game.black) : null,
    yourColor,
    isYourTurn,
    ratingChange,
  };
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

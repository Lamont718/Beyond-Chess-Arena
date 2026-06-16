// Ranked-bot roster. Bots are real User rows (role "BOT") with a FIXED rating
// that never moves — they're a stable rating anchor, so a kid's Elo change is
// honest (like playing a fixed-strength opponent). Server generates their moves
// (see lib/bot-move.ts) so bot games are authoritative and can't be cheated.
//
// Each bot maps to an engine level (lib/engine-levels.ts). Ratings are a rough
// guide to strength for a kids' club — not FIDE-precise.

export type BotLevelKey = 'rookie' | 'easy' | 'medium' | 'hard';

export interface BotProfile {
  username: string; // unique User.username, also how we recognise a bot by row
  displayName: string;
  emoji: string;
  rating: number; // FIXED — never updated
  level: BotLevelKey; // → ENGINE_LEVELS key
  blurb: string;
}

export const BOTS: BotProfile[] = [
  { username: 'bot-pixel', displayName: 'Pixel', emoji: '🐣', rating: 600, level: 'rookie', blurb: 'Just learning — makes lots of mistakes' },
  { username: 'bot-gizmo', displayName: 'Gizmo', emoji: '🤖', rating: 900, level: 'easy', blurb: 'Sees a move or two ahead' },
  { username: 'bot-volt', displayName: 'Volt', emoji: '⚡', rating: 1200, level: 'medium', blurb: 'Calculates — punishes mistakes' },
  { username: 'bot-titan', displayName: 'Titan', emoji: '🛡️', rating: 1500, level: 'hard', blurb: 'Plays seriously — good luck!' },
];

export function botByUsername(username: string | undefined | null): BotProfile | undefined {
  if (!username) return undefined;
  return BOTS.find((b) => b.username === username);
}

export function botByLevel(level: string): BotProfile | undefined {
  return BOTS.find((b) => b.level === level);
}

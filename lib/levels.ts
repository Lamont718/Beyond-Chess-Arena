// XP, levels, and kid-friendly rank titles. Pure + dependency-free so it can be
// used on both the server (awarding XP) and the client (showing progress).

export const XP_AWARDS = {
  win: 20,
  draw: 12,
  loss: 6, // you still earn a little for playing
  puzzle: 15, // solving the daily puzzle
} as const;

// XP needed to advance FROM level L to L+1 (grows so higher levels feel earned).
function costForLevel(level: number): number {
  return 60 + 40 * (level - 1); // 60, 100, 140, 180, ...
}

export interface LevelInfo {
  level: number;
  title: string;
  emoji: string;
  xp: number;
  xpIntoLevel: number; // XP earned within the current level
  xpForNext: number; // XP required to finish the current level
  progressPct: number; // 0–100 toward the next level
}

const RANKS: { title: string; emoji: string }[] = [
  { title: 'Pawn', emoji: '♟️' }, // level 1
  { title: 'Knight', emoji: '♞' }, // 2
  { title: 'Bishop', emoji: '♝' }, // 3
  { title: 'Rook', emoji: '♜' }, // 4
  { title: 'Queen', emoji: '♛' }, // 5
  { title: 'King', emoji: '♚' }, // 6
  { title: 'Master', emoji: '🏆' }, // 7
  { title: 'Grandmaster', emoji: '👑' }, // 8+
];

export function rankFor(level: number): { title: string; emoji: string } {
  return RANKS[Math.min(level - 1, RANKS.length - 1)];
}

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let remaining = Math.max(0, Math.floor(xp));
  // Walk up levels while we can still afford the next one.
  while (remaining >= costForLevel(level)) {
    remaining -= costForLevel(level);
    level++;
  }
  const xpForNext = costForLevel(level);
  const rank = rankFor(level);
  return {
    level,
    title: rank.title,
    emoji: rank.emoji,
    xp,
    xpIntoLevel: remaining,
    xpForNext,
    progressPct: Math.round((remaining / xpForNext) * 100),
  };
}

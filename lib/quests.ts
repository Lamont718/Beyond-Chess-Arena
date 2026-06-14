// Challenges ("quests") computed purely from a player's stats — progress bars
// that give kids concrete things to chase. No extra storage; the underlying
// actions already award XP and update these stats.

export interface QuestStats {
  wins: number;
  losses: number;
  draws: number;
  rating: number;
  puzzlesSolved: number;
  puzzleBestStreak: number;
}

export interface Quest {
  key: string;
  emoji: string;
  label: string;
  current: number;
  target: number;
  done: boolean;
  unit?: string;
}

export function computeQuests(s: QuestStats): Quest[] {
  const games = s.wins + s.losses + s.draws;
  const defs: Omit<Quest, 'done'>[] = [
    { key: 'play-10', emoji: '♟️', label: 'Play 10 games', current: games, target: 10 },
    { key: 'win-5', emoji: '🏅', label: 'Win 5 games', current: s.wins, target: 5 },
    { key: 'win-15', emoji: '🔥', label: 'Win 15 games', current: s.wins, target: 15 },
    { key: 'puzzles-5', emoji: '🧩', label: 'Solve 5 daily puzzles', current: s.puzzlesSolved, target: 5 },
    { key: 'streak-3', emoji: '📅', label: 'Reach a 3-day puzzle streak', current: s.puzzleBestStreak, target: 3 },
    { key: 'rating-1100', emoji: '⭐', label: 'Reach 1100 rating', current: s.rating, target: 1100, unit: 'rating' },
  ];
  return defs.map((d) => ({
    ...d,
    current: Math.min(d.current, d.target),
    done: d.current >= d.target,
  }));
}

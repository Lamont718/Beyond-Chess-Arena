// Achievement badges, computed purely from a player's stats — no extra storage.
// Locked badges are shown dimmed so kids have something to chase.

export interface BadgeStats {
  wins: number;
  losses: number;
  draws: number;
  rating: number;
}

export interface Badge {
  key: string;
  emoji: string;
  label: string;
  desc: string;
  earned: boolean;
}

export function computeBadges(s: BadgeStats): Badge[] {
  const games = s.wins + s.losses + s.draws;
  const def: Omit<Badge, 'earned'>[] = [
    { key: 'first-game', emoji: '🎯', label: 'First Move', desc: 'Play your first game' },
    { key: 'first-win', emoji: '✅', label: 'First Win', desc: 'Win a game' },
    { key: 'hat-trick', emoji: '🎩', label: 'Hat Trick', desc: 'Win 3 games' },
    { key: 'sharp', emoji: '🏹', label: 'Sharpshooter', desc: 'Win 10 games' },
    { key: 'champ', emoji: '👑', label: 'Champion', desc: 'Win 25 games' },
    { key: 'good-sport', emoji: '🤝', label: 'Good Sport', desc: 'Play 5 games' },
    { key: 'veteran', emoji: '🛡️', label: 'Veteran', desc: 'Play 25 games' },
    { key: 'rising', emoji: '⭐', label: 'Rising Star', desc: 'Reach 1100 rating' },
    { key: 'expert', emoji: '🧠', label: 'Sharp Mind', desc: 'Reach 1250 rating' },
    { key: 'master', emoji: '🏆', label: 'Arena Master', desc: 'Reach 1400 rating' },
  ];

  const earnedMap: Record<string, boolean> = {
    'first-game': games >= 1,
    'first-win': s.wins >= 1,
    'hat-trick': s.wins >= 3,
    sharp: s.wins >= 10,
    champ: s.wins >= 25,
    'good-sport': games >= 5,
    veteran: games >= 25,
    rising: s.rating >= 1100,
    expert: s.rating >= 1250,
    master: s.rating >= 1400,
  };

  return def.map((b) => ({ ...b, earned: !!earnedMap[b.key] }));
}

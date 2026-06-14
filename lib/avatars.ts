// Kid-friendly avatar choices. Shared by the coach roster form, the settings
// page, and the avatar API (which validates against this list). Most avatars are
// available to everyone; the flashier ones unlock as you level up, giving levels
// something to spend on.

export interface AvatarDef {
  emoji: string;
  unlockLevel: number; // 1 = available to everyone
}

export const AVATAR_DEFS: AvatarDef[] = [
  // Level 1 — starter set (16)
  '♟️', '♞', '🦊', '🐼', '🐯', '🦁', '🐸', '🐵',
  '🦄', '🐙', '🐝', '🐱', '🐶', '🐰', '🐢', '🦖',
]
  .map((emoji) => ({ emoji, unlockLevel: 1 }))
  .concat(
    // Level 2
    ['🐳', '🦋', '🚀', '⚡'].map((emoji) => ({ emoji, unlockLevel: 2 })),
    // Level 3
    ['🔥', '🌟', '🌈', '🐉'].map((emoji) => ({ emoji, unlockLevel: 3 })),
    // Level 4
    ['🦅', '🐺', '🦉', '🦈'].map((emoji) => ({ emoji, unlockLevel: 4 })),
    // Level 5+
    [
      { emoji: '🐲', unlockLevel: 5 },
      { emoji: '👾', unlockLevel: 5 },
      { emoji: '🤖', unlockLevel: 6 },
      { emoji: '👑', unlockLevel: 7 },
    ]
  );

// Flat emoji list (back-compat for existing callers + validation).
export const AVATARS = AVATAR_DEFS.map((a) => a.emoji);

export function isValidAvatar(emoji: string): boolean {
  return AVATARS.includes(emoji);
}

export function avatarUnlockLevel(emoji: string): number {
  return AVATAR_DEFS.find((a) => a.emoji === emoji)?.unlockLevel ?? 1;
}

/** Can a player at `level` use this avatar? Coaches can use any. */
export function canUseAvatar(emoji: string, level: number, isCoach = false): boolean {
  if (!isValidAvatar(emoji)) return false;
  if (isCoach) return true;
  return level >= avatarUnlockLevel(emoji);
}

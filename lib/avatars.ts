// Kid-friendly avatar choices. Shared by the coach roster form, the settings
// page, and the avatar API (which validates against this list).
export const AVATARS = [
  '♟️', '♞', '🦊', '🐼', '🐯', '🦁', '🐸', '🐵',
  '🦄', '🐙', '🐝', '🐱', '🐶', '🐰', '🐢', '🦖',
  '🐳', '🦋', '🚀', '⚡', '🔥', '🌟', '🌈', '🐉',
  '🦅', '🐺', '🦉', '🦈', '🐲', '👾', '🤖', '👑',
];

export function isValidAvatar(emoji: string): boolean {
  return AVATARS.includes(emoji);
}

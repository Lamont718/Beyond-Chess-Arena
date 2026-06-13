// Kid-friendly profanity filter. Server-side so it can't be bypassed from the client.
// Goal: catch common profanity + slurs and obvious leet/elongation variants, while
// avoiding false positives on innocent words (the "Scunthorpe problem").

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
};

// Short words → require an exact whole-word match (so "class", "pass", "grass" are fine).
const EXACT = new Set([
  'ass', 'damn', 'crap', 'hell', 'wtf', 'stfu', 'fag', 'slut', 'turd', 'piss', 'jerk',
]);

// Longer/severe words → also caught as substrings (e.g. inside a run-together token).
const SUBSTRING = [
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cock', 'pussy', 'cunt',
  'whore', 'nigger', 'nigga', 'faggot', 'retard', 'dumbass', 'motherf', 'bullshit',
  'douche', 'wanker', 'bollock', 'twat', 'pedo', 'rape', 'porn', 'sex', 'penis', 'vagina',
];

function normalize(token: string): string {
  return token
    .toLowerCase()
    .split('')
    .map((c) => LEET[c] ?? c)
    .join('')
    .replace(/[^a-z]/g, '') // drop anything non-letter after leet mapping
    .replace(/(.)\1{2,}/g, '$1'); // collapse 3+ repeats: fuuuuck -> fuck
}

function tokenIsBad(norm: string): boolean {
  if (!norm) return false;
  if (EXACT.has(norm)) return true;
  return SUBSTRING.some((bad) => norm.includes(bad));
}

/** Replace any profane words with asterisks, preserving the rest of the message. */
export function cleanText(text: string): string {
  return text.replace(/[^\s]+/g, (token) => {
    if (tokenIsBad(normalize(token))) return '*'.repeat(Math.max(3, token.length));
    return token;
  });
}

/** True if the text contains profanity (used to reject names/usernames). */
export function containsProfanity(text: string): boolean {
  return text.split(/\s+/).some((token) => tokenIsBad(normalize(token)));
}

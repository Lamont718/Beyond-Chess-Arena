// Kid-friendly content filter. Server-side so it can't be bypassed from the client.
// Two jobs:
//   1) Profanity / slurs / sexual / self-harm language — redacted or rejected.
//   2) Personal-info sharing (phone, email, address, social handles) — BLOCKED,
//      because the real risk on a kids' site is a child handing contact details
//      to a stranger, not a swear word.
//
// Design notes:
//   - We match against BOTH the per-token normalized form AND a fully de-spaced
//     form of the whole message, so "f u c k", "n i g g e r", "s e x" don't slip
//     through one letter at a time (the old per-token-only filter's big hole).
//   - Short ambiguous words (ass, hell…) require a whole-word match to avoid the
//     "Scunthorpe problem" (class, pass, grass). Only severe terms are matched as
//     substrings / in the de-spaced stream.

const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
};

// Short words → require an exact whole-word (token) match.
const EXACT = new Set([
  'ass', 'damn', 'crap', 'hell', 'wtf', 'stfu', 'fag', 'slut', 'turd', 'piss', 'jerk', 'kys',
]);

// Severe terms → matched as substrings inside a token AND inside the de-spaced
// whole-message stream (so spacing/punctuation can't break them up).
const SEVERE = [
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cock', 'pussy', 'cunt',
  'whore', 'nigger', 'nigga', 'faggot', 'retard', 'dumbass', 'motherf', 'bullshit',
  'douche', 'wanker', 'bollock', 'twat', 'pedo', 'rape', 'porn', 'penis', 'vagina',
  'boobs', 'titties', 'cumming', 'jerkoff', 'blowjob', 'handjob', 'dildo', 'horny',
  // self-harm / violence directed at others
  'killyourself', 'killyourselves', 'kysnow', 'killurself', 'neckyourself',
];

// Severe terms that are short/whole-word in spirit but we still want in the
// de-spaced stream (kept separate so "sex" doesn't flag "essex" inside a token,
// but DOES flag "s e x" spaced out).
const SEVERE_DESPACED_ONLY = ['sex'];

function normalize(s: string): string {
  return s
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
  return SEVERE.some((bad) => norm.includes(bad));
}

/** De-spaced, leet-folded view of the WHOLE message — catches "f u c k", "s e x". */
function despacedIsBad(text: string): boolean {
  const collapsed = normalize(text); // strips spaces/punctuation across the whole string
  if (!collapsed) return false;
  return (
    SEVERE.some((bad) => collapsed.includes(bad)) ||
    SEVERE_DESPACED_ONLY.some((bad) => collapsed.includes(bad))
  );
}

// ── Personal-info / contact detectors ────────────────────────────────────────
// Phone: 7+ digits, optionally split by spaces/dashes/dots/parens (e.g. 555-123-4567,
// "5 5 5 1 2 3 4", "(212) 555 0100").
const PHONE_RE = /(?:\+?\d[\s().-]*){7,}/;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const URL_RE = /\b(?:https?:\/\/|www\.)\S+/i;
// Social handles / "find me on …" — common platforms kids use to move chats off-site.
const SOCIAL_RE = /\b(snap(?:chat)?|insta(?:gram)?|tiktok|discord|whats\s?app|telegram|kik|signal|roblox|fortnite|skype|@[a-z0-9_.]{3,})\b/i;
const ADDRESS_RE = /\b\d{1,5}\s+([a-z0-9.\s]{1,30})\b(st|street|ave|avenue|rd|road|blvd|lane|ln|drive|dr|court|ct|way|place|pl)\b/i;

/** True if the text appears to share contact / personal info (phone, email, address, handle). */
export function containsContactInfo(text: string): boolean {
  return (
    PHONE_RE.test(text) ||
    EMAIL_RE.test(text) ||
    URL_RE.test(text) ||
    SOCIAL_RE.test(text) ||
    ADDRESS_RE.test(text)
  );
}

/** Redact any contact info from a string (used as a backstop on stored text). */
function redactContactInfo(text: string): string {
  return text
    .replace(EMAIL_RE, '***')
    .replace(URL_RE, '***')
    .replace(PHONE_RE, (m) => (m.replace(/\D/g, '').length >= 7 ? '***' : m));
}

/** Replace any profane words with asterisks, preserving the rest of the message. */
export function cleanText(text: string): string {
  const profanityCleaned = text.replace(/[^\s]+/g, (token) => {
    if (tokenIsBad(normalize(token))) return '*'.repeat(Math.max(3, token.length));
    return token;
  });
  return redactContactInfo(profanityCleaned);
}

/** True if the text contains profanity (used to reject names/usernames and chat). */
export function containsProfanity(text: string): boolean {
  if (despacedIsBad(text)) return true;
  return text.split(/\s+/).some((token) => tokenIsBad(normalize(token)));
}

/**
 * Full moderation check for a chat message. Returns whether to allow it, a
 * kid-friendly reason if not, and the cleaned text to store when allowed.
 */
export function moderateMessage(text: string): { ok: boolean; reason?: string; clean: string } {
  if (containsContactInfo(text)) {
    return {
      ok: false,
      clean: text,
      reason: "Let's keep personal info private — no phone numbers, addresses, emails, or social handles. 🙂",
    };
  }
  if (containsProfanity(text)) {
    return {
      ok: false,
      clean: text,
      reason: "Let's keep it friendly — please reword that without rude language. 😊",
    };
  }
  return { ok: true, clean: cleanText(text) };
}

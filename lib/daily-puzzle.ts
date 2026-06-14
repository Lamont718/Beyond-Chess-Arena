import { PUZZLES, type Puzzle } from './puzzles';

/**
 * The puzzle of the day rotates on a New-York calendar day so every kid in the
 * club sees the same puzzle, and it changes at local midnight (not UTC).
 */

// "YYYY-MM-DD" for the given instant in America/New_York.
export function nyDateKey(date: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Whole days since the Unix epoch for a "YYYY-MM-DD" key (stable + timezone-free).
export function dayIndex(dateKey: string): number {
  const ms = Date.parse(dateKey + 'T00:00:00Z');
  return Math.floor(ms / 86_400_000);
}

/** The puzzle for a given day key (defaults to today in NY). */
export function getDailyPuzzle(dateKey: string = nyDateKey()): Puzzle {
  const idx = ((dayIndex(dateKey) % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
  return PUZZLES[idx];
}

export type { Puzzle };

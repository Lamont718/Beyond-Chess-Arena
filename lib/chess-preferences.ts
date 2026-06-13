'use client';

// User-persistent board preferences, stored in localStorage so a kid's
// choices survive across sessions.

import { BoardTheme, DEFAULT_BOARD_THEME } from './chess-theme';

const STORAGE_KEY = 'bca:board-prefs:v1';

export interface BoardPreferences {
  theme: BoardTheme;
  sounds: boolean;
  autoPromoteTo: 'q' | 'r' | 'b' | 'n' | 'ask';
  showCoordinates: boolean;
  allowArrowDrawing: boolean;
}

export const DEFAULT_BOARD_PREFS: BoardPreferences = {
  theme: DEFAULT_BOARD_THEME,
  sounds: true,
  autoPromoteTo: 'q',
  showCoordinates: true,
  allowArrowDrawing: true,
};

export function loadBoardPrefs(): BoardPreferences {
  if (typeof window === 'undefined') return DEFAULT_BOARD_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BOARD_PREFS;
    const parsed = JSON.parse(raw) as Partial<BoardPreferences>;
    return { ...DEFAULT_BOARD_PREFS, ...parsed };
  } catch {
    return DEFAULT_BOARD_PREFS;
  }
}

export function saveBoardPrefs(prefs: BoardPreferences) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota / privacy-mode errors
  }
}

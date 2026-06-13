// Centralized board styling. Swap a theme here and every board in the app updates.

export type BoardTheme = 'green' | 'brown' | 'blue';

export interface BoardPalette {
  light: string;
  dark: string;
  lightLastMove: string;
  darkLastMove: string;
  lightSelected: string;
  darkSelected: string;
  premove: string;
  checkGlow: string;
}

export const BOARD_THEMES: Record<BoardTheme, BoardPalette> = {
  green: {
    light: '#ebecd0',
    dark: '#779556',
    lightLastMove: '#f6f687',
    darkLastMove: '#baca44',
    lightSelected: '#f7ec74',
    darkSelected: '#d6bf3a',
    premove: 'rgba(20, 85, 30, 0.5)',
    checkGlow:
      'radial-gradient(circle at center, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.55) 55%, rgba(239,68,68,0) 80%)',
  },
  brown: {
    light: '#f0d9b5',
    dark: '#b58863',
    lightLastMove: '#cdd26a',
    darkLastMove: '#aaa23a',
    lightSelected: '#f7ec74',
    darkSelected: '#d6bf3a',
    premove: 'rgba(140, 70, 20, 0.5)',
    checkGlow:
      'radial-gradient(circle at center, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.55) 55%, rgba(239,68,68,0) 80%)',
  },
  blue: {
    light: '#dee3e6',
    dark: '#8ca2ad',
    lightLastMove: '#cdd26a',
    darkLastMove: '#7a9c9c',
    lightSelected: '#b9cfcf',
    darkSelected: '#6e8a8a',
    premove: 'rgba(40, 80, 140, 0.5)',
    checkGlow:
      'radial-gradient(circle at center, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.55) 55%, rgba(239,68,68,0) 80%)',
  },
};

export const DEFAULT_BOARD_THEME: BoardTheme = 'green';

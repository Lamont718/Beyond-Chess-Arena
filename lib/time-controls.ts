// Time-control presets offered in the lobby. seconds = initial clock per side.
export interface TimeControl {
  key: string;
  label: string;
  seconds: number;
  increment: number;
  category: 'Bullet' | 'Blitz' | 'Rapid' | 'Casual';
}

export const TIME_CONTROLS: TimeControl[] = [
  { key: '3+0', label: '3 min', seconds: 180, increment: 0, category: 'Blitz' },
  { key: '5+0', label: '5 min', seconds: 300, increment: 0, category: 'Blitz' },
  { key: '5+3', label: '5 + 3', seconds: 300, increment: 3, category: 'Blitz' },
  { key: '10+0', label: '10 min', seconds: 600, increment: 0, category: 'Rapid' },
  { key: '15+10', label: '15 + 10', seconds: 900, increment: 10, category: 'Rapid' },
  { key: '0+0', label: 'No clock', seconds: 0, increment: 0, category: 'Casual' },
];

export function findTimeControl(seconds: number, increment: number): TimeControl | undefined {
  return TIME_CONTROLS.find((t) => t.seconds === seconds && t.increment === increment);
}

export function describeTimeControl(seconds: number, increment: number): string {
  if (!seconds) return 'No clock';
  const mins = Math.round(seconds / 60);
  return increment ? `${mins} + ${increment}` : `${mins} min`;
}

// Engine level config — kept separate from engine.ts (which pulls in chess.js)
// so the UI can import just this lightweight data without the search code.

export interface EngineLevel {
  key: string;
  label: string;
  blurb: string;
  maxDepth: number;
  randomChance: number; // chance to play a random legal move (blunders for easy bots)
  nodeCap: number;
  timeMs: number; // search time budget
}

export const ENGINE_LEVELS: EngineLevel[] = [
  { key: 'rookie', label: 'Rookie', blurb: 'Just learning — makes lots of mistakes', maxDepth: 1, randomChance: 0.5, nodeCap: 20000, timeMs: 300 },
  { key: 'easy', label: 'Easy', blurb: 'Sees a move or two ahead', maxDepth: 2, randomChance: 0.22, nodeCap: 80000, timeMs: 700 },
  { key: 'medium', label: 'Medium', blurb: 'Calculates — punishes mistakes', maxDepth: 3, randomChance: 0.03, nodeCap: 350000, timeMs: 1500 },
  { key: 'hard', label: 'Hard', blurb: 'Plays seriously — good luck!', maxDepth: 5, randomChance: 0, nodeCap: 2000000, timeMs: 2600 },
];

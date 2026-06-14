/**
 * Round-robin pairing: every player plays every other player exactly once.
 * Colors are balanced with a simple parity rule so nobody is always white.
 */
export function roundRobinPairings(playerIds: string[]): { whiteId: string; blackId: string }[] {
  const pairs: { whiteId: string; blackId: string }[] = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      // Alternate who gets white to keep colors roughly even across the field.
      if ((i + j) % 2 === 0) {
        pairs.push({ whiteId: playerIds[i], blackId: playerIds[j] });
      } else {
        pairs.push({ whiteId: playerIds[j], blackId: playerIds[i] });
      }
    }
  }
  return pairs;
}

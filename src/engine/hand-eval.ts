import { Card } from './types';

// pokersolver has no TS types — declare minimal interface
// eslint-disable-next-line @typescript-eslint/no-require-imports
let Hand: any;
try {
  Hand = require('pokersolver').Hand;
} catch {
  // Will be available after npm install
}

/** Convert our Card to pokersolver format: "Ah", "10c", "Ks" */
function toPokersolverCard(card: Card): string {
  const suitMap = { hearts: 'h', diamonds: 'd', clubs: 'c', spades: 's' };
  const rankMap: Record<string, string> = { '10': 'T' };
  const rank = rankMap[card.rank] ?? card.rank;
  return `${rank}${suitMap[card.suit]}`;
}

/**
 * Evaluate a hand (hole cards + community cards).
 * Returns the pokersolver Hand object for comparison.
 */
export function evaluateHand(holeCards: Card[], communityCards: Card[]) {
  const allCards = [...holeCards, ...communityCards].map(toPokersolverCard);
  return Hand.solve(allCards);
}

/**
 * Compare multiple hands and return the winner(s).
 * Returns indices of winning players (can be multiple for split pot).
 */
export function findWinners(hands: ReturnType<typeof evaluateHand>[]): number[] {
  const validHands = hands.filter(h => h !== null);
  if (validHands.length === 0) return [];
  if (validHands.length === 1) {
    return [hands.indexOf(validHands[0])];
  }

  const winners = Hand.winners(validHands);
  return winners.map((w: any) => hands.indexOf(w));
}

/**
 * Given players' hole cards and community cards, determine winning player indices.
 * Only considers players at given indices (for pot eligibility).
 */
export function determineWinners(
  playerHoleCards: Card[][],
  communityCards: Card[],
  eligibleIndices: number[]
): number[] {
  const hands = eligibleIndices.map(i => {
    const holeCards = playerHoleCards[i];
    if (!holeCards || holeCards.length === 0) return null;
    return evaluateHand(holeCards, communityCards);
  });

  const validEntries = hands.map((h, i) => ({ hand: h, originalIndex: eligibleIndices[i] }))
    .filter(e => e.hand !== null);

  if (validEntries.length === 0) return [];
  if (validEntries.length === 1) return [validEntries[0].originalIndex];

  const winners = Hand.winners(validEntries.map(e => e.hand));
  return winners.map((w: any) => {
    const entry = validEntries.find(e => e.hand === w);
    return entry!.originalIndex;
  });
}

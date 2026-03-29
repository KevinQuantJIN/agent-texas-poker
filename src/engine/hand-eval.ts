import { Card, Suit } from './types';

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

export interface HandStrengthInfo {
  made: string;       // e.g. "Two Pair", "Flush", "High Card"
  draws: string[];    // e.g. ["Flush Draw", "Open-Ended Straight Draw"]
  description: string; // e.g. "Two Pair, A's & K's" or "Flush Draw (hearts)"
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

// ---- Hand strength analysis for spectators ----

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

function detectDraws(holeCards: Card[], communityCards: Card[]): string[] {
  if (communityCards.length === 0) return [];
  const draws: string[] = [];
  const allCards = [...holeCards, ...communityCards];

  // Flush draw detection: 4 cards of same suit (using at least 1 hole card)
  const suitCounts: Record<string, { total: number; holeCount: number }> = {};
  for (const c of allCards) {
    if (!suitCounts[c.suit]) suitCounts[c.suit] = { total: 0, holeCount: 0 };
    suitCounts[c.suit].total++;
  }
  for (const c of holeCards) {
    if (suitCounts[c.suit]) suitCounts[c.suit].holeCount++;
  }
  for (const [suit, counts] of Object.entries(suitCounts)) {
    if (counts.total === 4 && counts.holeCount >= 1) {
      const suitName = suit.charAt(0).toUpperCase() + suit.slice(1);
      draws.push(`Flush Draw (${suitName})`);
    }
  }

  // Straight draw detection
  const uniqueValues = [...new Set(allCards.map(c => RANK_VALUES[c.rank]))].sort((a, b) => a - b);
  // Add low-ace for wheel draws
  if (uniqueValues.includes(14)) uniqueValues.unshift(1);

  // Check for 4-in-a-row sequences (open-ended) or 4-of-5 gaps (gutshot)
  const holeValues = new Set(holeCards.map(c => RANK_VALUES[c.rank]));

  // Open-ended: 4 consecutive values, at least 1 from hole cards, not already a straight
  if (uniqueValues.length < 5 || !hasStraight(uniqueValues)) {
    for (let i = 0; i <= uniqueValues.length - 4; i++) {
      const window = uniqueValues.slice(i, i + 4);
      if (window[3] - window[0] === 3) {
        // 4 consecutive — check if open-ended (not edge: A-2-3-4 or J-Q-K-A)
        const usesHole = window.some(v => holeValues.has(v) || (v === 1 && holeValues.has(14)));
        if (usesHole) {
          const isOpenEnded = window[0] > 1 && window[3] < 14;
          draws.push(isOpenEnded ? 'Open-Ended Straight Draw' : 'Gutshot Straight Draw');
          break;
        }
      }
    }

    // Gutshot: 4 of 5 consecutive with one gap
    if (!draws.some(d => d.includes('Straight'))) {
      for (let i = 0; i <= uniqueValues.length - 4; i++) {
        const window = uniqueValues.slice(i, i + 4);
        if (window[3] - window[0] === 4) {
          const usesHole = window.some(v => holeValues.has(v) || (v === 1 && holeValues.has(14)));
          if (usesHole) {
            draws.push('Gutshot Straight Draw');
            break;
          }
        }
      }
    }
  }

  return draws;
}

function hasStraight(sortedValues: number[]): boolean {
  let consecutive = 1;
  for (let i = 1; i < sortedValues.length; i++) {
    if (sortedValues[i] === sortedValues[i - 1] + 1) {
      consecutive++;
      if (consecutive >= 5) return true;
    } else if (sortedValues[i] !== sortedValues[i - 1]) {
      consecutive = 1;
    }
  }
  return false;
}

function describePreflopHand(holeCards: Card[]): HandStrengthInfo {
  const [a, b] = holeCards;
  const va = RANK_VALUES[a.rank];
  const vb = RANK_VALUES[b.rank];
  const suited = a.suit === b.suit;
  const pair = a.rank === b.rank;

  let made: string;
  let description: string;

  if (pair) {
    made = 'Pocket Pair';
    description = `Pocket ${a.rank}'s`;
  } else if (suited) {
    made = 'Suited';
    const high = va > vb ? a.rank : b.rank;
    const low = va > vb ? b.rank : a.rank;
    description = `${high}-${low} Suited`;
  } else {
    made = 'Offsuit';
    const high = va > vb ? a.rank : b.rank;
    const low = va > vb ? b.rank : a.rank;
    description = `${high}-${low} Offsuit`;
  }

  return { made, draws: [], description };
}

/**
 * Analyze a player's hand strength given their hole cards and community cards.
 * Returns made hand name, active draws, and a human-readable description.
 */
export function analyzeHandStrength(holeCards: Card[], communityCards: Card[]): HandStrengthInfo {
  if (!holeCards || holeCards.length < 2) {
    return { made: '', draws: [], description: '' };
  }

  // Preflop — no community cards yet
  if (communityCards.length === 0) {
    return describePreflopHand(holeCards);
  }

  // Evaluate made hand with pokersolver
  const allCards = [...holeCards, ...communityCards].map(toPokersolverCard);
  const solved = Hand.solve(allCards);
  const made = solved.name ?? 'Unknown';
  const description = solved.descr ?? made;

  // Detect draws (only relevant on flop/turn, not river)
  const draws = communityCards.length < 5 ? detectDraws(holeCards, communityCards) : [];

  return { made, draws, description };
}

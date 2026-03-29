import { InternalPlayer, Pot } from './types';

/**
 * Calculate pots (main + side pots) from players' total bets.
 *
 * Algorithm:
 * 1. Collect unique all-in amounts from players who are all-in, sort ascending
 * 2. For each level, create a pot with eligible players
 * 3. Remaining bets above highest all-in go to final pot
 */
export function calculatePots(players: InternalPlayer[]): Pot[] {
  const activePlayers = players.filter(p => !p.isEliminated);
  if (activePlayers.length === 0) return [];

  // Collect all unique all-in bet levels
  const allInLevels = [...new Set(
    activePlayers
      .filter(p => p.isAllIn && p.totalBetThisHand > 0)
      .map(p => p.totalBetThisHand)
  )].sort((a, b) => a - b);

  // If no one is all-in, just one pot
  if (allInLevels.length === 0) {
    const totalAmount = activePlayers.reduce((sum, p) => sum + p.totalBetThisHand, 0);
    if (totalAmount === 0) return [];
    const eligible = activePlayers
      .filter(p => !p.isFolded)
      .map(p => p.id);
    return [{ amount: totalAmount, eligiblePlayerIds: eligible }];
  }

  const pots: Pot[] = [];
  let previousLevel = 0;

  for (const level of allInLevels) {
    const contribution = level - previousLevel;
    if (contribution <= 0) continue;

    let potAmount = 0;
    const eligible: string[] = [];

    for (const player of activePlayers) {
      const playerContribution = Math.min(player.totalBetThisHand, level) - Math.min(player.totalBetThisHand, previousLevel);
      if (playerContribution > 0) {
        potAmount += playerContribution;
      }
      // Eligible if they bet at least up to this level AND haven't folded
      if (player.totalBetThisHand >= level && !player.isFolded) {
        eligible.push(player.id);
      }
    }

    if (potAmount > 0) {
      pots.push({ amount: potAmount, eligiblePlayerIds: eligible });
    }

    previousLevel = level;
  }

  // Remaining bets above the highest all-in level
  const highestAllIn = allInLevels[allInLevels.length - 1];
  let remainingAmount = 0;
  const remainingEligible: string[] = [];

  for (const player of activePlayers) {
    const excess = player.totalBetThisHand - Math.min(player.totalBetThisHand, highestAllIn);
    if (excess > 0) {
      remainingAmount += excess;
      if (!player.isFolded) {
        remainingEligible.push(player.id);
      }
    }
  }

  if (remainingAmount > 0) {
    pots.push({ amount: remainingAmount, eligiblePlayerIds: remainingEligible });
  }

  return pots;
}

/**
 * Distribute pot winnings to winners.
 * Returns a map of playerId -> chips won.
 * For split pots: divide evenly, odd chip goes to first player in list
 * (caller should order by clockwise from dealer button).
 */
export function distributePot(pot: Pot, winnerIds: string[]): Map<string, number> {
  const distribution = new Map<string, number>();
  if (winnerIds.length === 0) return distribution;

  const share = Math.floor(pot.amount / winnerIds.length);
  const remainder = pot.amount % winnerIds.length;

  for (let i = 0; i < winnerIds.length; i++) {
    const amount = share + (i < remainder ? 1 : 0);
    distribution.set(winnerIds[i], amount);
  }

  return distribution;
}

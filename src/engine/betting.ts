import { AgentAction, InternalPlayer, ValidActions } from './types';

/**
 * Get the valid actions for a player given the current game state.
 */
export function getValidActions(
  player: InternalPlayer,
  highestBet: number,
  lastRaiseAmount: number,
  bigBlind: number
): ValidActions {
  const toCall = highestBet - player.currentBet;
  const chipsLeft = player.chips;

  // If player has no chips, no actions
  if (chipsLeft <= 0) {
    return { canCheck: false, canCall: false, callAmount: 0, minRaise: 0, maxRaise: 0 };
  }

  const canCheck = toCall === 0;
  const canCall = toCall > 0;
  const callAmount = Math.min(toCall, chipsLeft); // can only call up to what you have

  // Min-raise = last raise size (or big blind if no raise yet)
  const raiseIncrement = Math.max(lastRaiseAmount, bigBlind);
  const minRaiseTotal = highestBet + raiseIncrement;
  const minRaise = Math.min(minRaiseTotal - player.currentBet, chipsLeft);
  const maxRaise = chipsLeft; // all-in

  return {
    canCheck,
    canCall,
    callAmount,
    minRaise: minRaise > callAmount ? minRaise : 0, // can only raise if it's more than a call
    maxRaise: maxRaise > callAmount ? maxRaise : 0,
  };
}

/**
 * Validate and normalize an agent's action.
 * - check when there's a bet → auto-convert to call
 * - call when nothing to call → auto-convert to check
 * - raise too low → snap to min-raise
 * - raise too high → snap to all-in
 */
export function validateAction(
  rawAction: AgentAction,
  validActions: ValidActions
): AgentAction {
  const action = { ...rawAction };

  // Handle fold — but convert to check if there's nothing to call (folding a free check is irrational)
  if (action.action === 'fold') {
    if (validActions.canCheck) {
      action.action = 'check';
      action.amount = undefined;
    }
    return action;
  }

  // Handle check/call auto-conversion
  if (action.action === 'check') {
    if (!validActions.canCheck) {
      // Can't check, auto-convert to call
      action.action = 'call';
      action.amount = validActions.callAmount;
    }
    return action;
  }

  if (action.action === 'call') {
    if (!validActions.canCall) {
      // Nothing to call, auto-convert to check
      action.action = 'check';
      action.amount = undefined;
    } else {
      action.amount = validActions.callAmount;
    }
    return action;
  }

  // Handle raise
  if (action.action === 'raise') {
    // If can't raise (not enough chips beyond a call), convert to call/check
    if (validActions.maxRaise <= 0) {
      if (validActions.canCall) {
        action.action = 'call';
        action.amount = validActions.callAmount;
      } else {
        action.action = 'check';
        action.amount = undefined;
      }
      return action;
    }

    const raiseAmount = action.amount ?? 0;

    // Snap to valid range
    if (raiseAmount < validActions.minRaise) {
      action.amount = validActions.minRaise;
    } else if (raiseAmount > validActions.maxRaise) {
      action.amount = validActions.maxRaise;
    }

    return action;
  }

  // Unknown action → fold
  action.action = 'fold';
  return action;
}

/**
 * Apply a validated action to the player state.
 * Returns the new chips bet this action.
 */
export function applyAction(
  action: AgentAction,
  player: InternalPlayer
): number {
  switch (action.action) {
    case 'fold':
      player.isFolded = true;
      return 0;

    case 'check':
      return 0;

    case 'call': {
      const amount = action.amount!;
      player.chips -= amount;
      player.currentBet += amount;
      player.totalBetThisHand += amount;
      if (player.chips === 0) player.isAllIn = true;
      return amount;
    }

    case 'raise': {
      const amount = action.amount!;
      player.chips -= amount;
      player.currentBet += amount;
      player.totalBetThisHand += amount;
      if (player.chips === 0) player.isAllIn = true;
      return amount;
    }

    default:
      return 0;
  }
}

/**
 * Format valid actions for the LLM prompt.
 * e.g. "fold, check" or "fold, call $400, raise $800-$10000 (all-in)"
 */
export function formatValidActions(validActions: ValidActions, currentBet: number, highestBet: number): string {
  const parts: string[] = ['fold'];

  if (validActions.canCheck) {
    parts.push('check');
  }

  if (validActions.canCall) {
    parts.push(`call $${validActions.callAmount}`);
  }

  if (validActions.maxRaise > 0) {
    if (validActions.minRaise === validActions.maxRaise) {
      parts.push(`raise $${validActions.minRaise} (all-in)`);
    } else {
      parts.push(`raise $${validActions.minRaise}-$${validActions.maxRaise} (all-in)`);
    }
  }

  return parts.join(', ');
}

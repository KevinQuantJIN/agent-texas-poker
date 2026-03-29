// ============================================================
// Strategy Journal — self-awareness of own play patterns
// ============================================================
//
// Unlike the Scouting system (which tracks opponents), the
// Strategy Journal lets each AI read its OWN history: recent
// actions, tendencies, streaks, chip trajectory, and table
// image. This creates continuity across hands — a player who
// has been raising every hand knows it, and can either keep
// the pressure on or pull back to trap.
// ============================================================

import type { BettingRound } from './types.js';

// ---- Types ----

export interface OwnHandRecord {
  handNumber: number;
  /** Most aggressive action taken this hand */
  peakAction: 'fold' | 'check' | 'call' | 'raise';
  /** Furthest street reached */
  lastRound: BettingRound;
  /** Did we voluntarily put money in preflop? */
  vpip: boolean;
  /** Did we raise preflop? */
  pfr: boolean;
  won: boolean;
  chipsDelta: number;
  /** Went to showdown */
  sawShowdown: boolean;
}

interface ActionTally {
  folds: number;
  checks: number;
  calls: number;
  raises: number;
}

export interface StrategyState {
  playerId: string;
  recentHands: OwnHandRecord[];      // rolling window (last ~12 hands)

  // Aggregate self-stats
  totalHands: number;
  handsVoluntarilyEntered: number;    // VPIP count
  preflopRaises: number;              // PFR count

  // Action tallies (all streets)
  actions: ActionTally;

  // Showdowns
  showdownsReached: number;
  showdownsWon: number;

  // Chip tracking
  startingChips: number;
  peakChips: number;

  // Per-hand scratch (reset each hand, flushed at hand end)
  currentHandActions: Array<{ action: 'fold' | 'check' | 'call' | 'raise'; round: BettingRound }>;
}

// ---- Constants ----

const RECENT_HAND_WINDOW = 12;

// ---- Strategy Journal ----

export class StrategyJournal {
  private states: Map<string, StrategyState> = new Map();

  /** Call at game start for each player */
  initPlayer(playerId: string, startingChips: number): void {
    this.states.set(playerId, {
      playerId,
      recentHands: [],
      totalHands: 0,
      handsVoluntarilyEntered: 0,
      preflopRaises: 0,
      actions: { folds: 0, checks: 0, calls: 0, raises: 0 },
      showdownsReached: 0,
      showdownsWon: 0,
      startingChips: startingChips,
      peakChips: startingChips,
      currentHandActions: [],
    });
  }

  /** Call at start of each hand to reset per-hand scratch */
  startHand(): void {
    for (const state of this.states.values()) {
      state.currentHandActions = [];
    }
  }

  /** Record an action as it happens (mirrors scouting's recordAction) */
  recordAction(
    playerId: string,
    action: 'fold' | 'check' | 'call' | 'raise',
    round: BettingRound,
  ): void {
    const state = this.states.get(playerId);
    if (!state) return;

    state.currentHandActions.push({ action, round });

    // Tally
    switch (action) {
      case 'fold': state.actions.folds++; break;
      case 'check': state.actions.checks++; break;
      case 'call': state.actions.calls++; break;
      case 'raise': state.actions.raises++; break;
    }
  }

  /** Call at hand end to flush the hand record */
  recordHandEnd(
    playerId: string,
    result: {
      handNumber: number;
      won: boolean;
      chipsDelta: number;
      currentChips: number;
      sawShowdown: boolean;
    },
  ): void {
    const state = this.states.get(playerId);
    if (!state) return;

    state.totalHands++;

    // Derive hand summary from recorded actions
    const actions = state.currentHandActions;
    const preflopActions = actions.filter(a => a.round === 'preflop');
    const vpip = preflopActions.some(a => a.action === 'call' || a.action === 'raise');
    const pfr = preflopActions.some(a => a.action === 'raise');

    if (vpip) state.handsVoluntarilyEntered++;
    if (pfr) state.preflopRaises++;

    // Peak action priority: raise > call > check > fold
    const priority: Record<string, number> = { raise: 3, call: 2, check: 1, fold: 0 };
    let peakAction: 'fold' | 'check' | 'call' | 'raise' = 'fold';
    let lastRound: BettingRound = 'preflop';
    for (const a of actions) {
      if (priority[a.action] > priority[peakAction]) {
        peakAction = a.action;
      }
      lastRound = a.round;
    }

    // Showdown tracking
    if (result.sawShowdown) {
      state.showdownsReached++;
      if (result.won) state.showdownsWon++;
    }

    // Peak chips
    if (result.currentChips > state.peakChips) {
      state.peakChips = result.currentChips;
    }

    // Push to recent hands window
    const record: OwnHandRecord = {
      handNumber: result.handNumber,
      peakAction,
      lastRound,
      vpip,
      pfr,
      won: result.won,
      chipsDelta: result.chipsDelta,
      sawShowdown: result.sawShowdown,
    };
    state.recentHands.push(record);
    if (state.recentHands.length > RECENT_HAND_WINDOW) {
      state.recentHands.shift();
    }
  }

  /** Generate the self-read prompt for a player */
  getStrategyPrompt(playerId: string, currentChips: number): string {
    const state = this.states.get(playerId);
    if (!state || state.totalHands < 2) return ''; // need some history

    const parts: string[] = [];
    const recent = state.recentHands;

    // --- Table image (how opponents likely perceive you) ---
    const vpipPct = state.totalHands > 0
      ? Math.round((state.handsVoluntarilyEntered / state.totalHands) * 100) : 0;
    const pfrPct = state.totalHands > 0
      ? Math.round((state.preflopRaises / state.totalHands) * 100) : 0;

    const totalPostActions = state.actions.calls + state.actions.raises;
    const af = state.actions.calls > 0
      ? state.actions.raises / state.actions.calls
      : state.actions.raises > 0 ? 5.0 : 1.0;

    const imageLabel = this.classifyImage(vpipPct, af);
    parts.push(`YOUR TABLE IMAGE: ${imageLabel} (VPIP ${vpipPct}%, PFR ${pfrPct}%, AF ${af.toFixed(1)})`);

    // --- Chip trajectory ---
    const chipDiff = currentChips - state.startingChips;
    const direction = chipDiff > 0 ? 'up' : chipDiff < 0 ? 'down' : 'even';
    const chipStr = chipDiff >= 0 ? `+$${chipDiff}` : `-$${Math.abs(chipDiff)}`;
    parts.push(`CHIP TRAJECTORY: ${chipStr} from starting stack (${direction})`);

    // --- Recent pattern (last 5 hands) ---
    const last5 = recent.slice(-5);
    if (last5.length >= 3) {
      const pattern = this.detectPattern(last5);
      if (pattern) {
        parts.push(`RECENT PATTERN: ${pattern}`);
      }
    }

    // --- Recent hand log (compact) ---
    const lastN = recent.slice(-6);
    if (lastN.length > 0) {
      const logLines = lastN.map(h => {
        const result = h.won ? 'W' : 'L';
        const delta = h.chipsDelta >= 0 ? `+${h.chipsDelta}` : `${h.chipsDelta}`;
        return `#${h.handNumber}: ${h.peakAction}${h.vpip ? '' : '(fold pre)'} → ${result} (${delta})`;
      });
      parts.push(`LAST ${lastN.length} HANDS: ${logLines.join(' | ')}`);
    }

    // --- Strategic suggestion based on patterns ---
    const suggestion = this.generateStrategicNote(state, currentChips, vpipPct, af);
    if (suggestion) {
      parts.push(`STRATEGIC NOTE: ${suggestion}`);
    }

    return parts.join('\n');
  }

  // ---- Private helpers ----

  private classifyImage(vpipPct: number, af: number): string {
    const tightness = vpipPct < 25 ? 'Tight' : vpipPct < 40 ? 'Moderate' : 'Loose';
    const aggression = af < 1.0 ? 'Passive' : af < 2.0 ? 'Moderate' : 'Aggressive';

    if (tightness === 'Tight' && aggression === 'Aggressive') return 'TAG (Tight-Aggressive) — selective but dangerous';
    if (tightness === 'Tight' && aggression === 'Passive') return 'Rock — tight and predictable';
    if (tightness === 'Loose' && aggression === 'Aggressive') return 'LAG (Loose-Aggressive) — wild and dangerous';
    if (tightness === 'Loose' && aggression === 'Passive') return 'Calling Station — loose and passive';
    return `${tightness}-${aggression}`;
  }

  private detectPattern(hands: OwnHandRecord[]): string | null {
    // Consecutive raises
    const consecutiveRaises = this.countTrailingMatches(hands, h => h.pfr);
    if (consecutiveRaises >= 3) {
      return `You've raised preflop ${consecutiveRaises} hands in a row. Opponents WILL adjust — they may start 3-betting you light or trapping. Use this image: either keep the pressure on with real hands, or slow down and trap them when they play back.`;
    }

    // Consecutive folds
    const consecutiveFolds = this.countTrailingMatches(hands, h => !h.vpip);
    if (consecutiveFolds >= 3) {
      return `You've folded ${consecutiveFolds} hands in a row. Your image is TIGHT right now — a well-timed raise will get extra respect. Opponents think you only play premiums.`;
    }

    // Win streak
    const winStreak = this.countTrailingMatches(hands, h => h.won);
    if (winStreak >= 3) {
      return `${winStreak}-hand win streak! You have momentum and a dominant image. Opponents may be scared of you — use this to steal pots or trap with big hands.`;
    }

    // Loss streak
    const lossStreak = this.countTrailingMatches(hands, h => !h.won && h.vpip);
    if (lossStreak >= 3) {
      return `You've lost ${lossStreak} contested pots in a row. Don't chase — tighten up and wait for a real hand. Opponents may try to bully you.`;
    }

    // Mixed but aggressive
    const raiseCount = hands.filter(h => h.peakAction === 'raise').length;
    if (raiseCount >= 4) {
      return `You've been very aggressive — raised in ${raiseCount} of last ${hands.length} hands. This is a double-edged sword: opponents either fear you or are setting traps.`;
    }

    return null;
  }

  private countTrailingMatches(hands: OwnHandRecord[], predicate: (h: OwnHandRecord) => boolean): number {
    let count = 0;
    for (let i = hands.length - 1; i >= 0; i--) {
      if (predicate(hands[i])) count++;
      else break;
    }
    return count;
  }

  private generateStrategicNote(
    state: StrategyState,
    currentChips: number,
    vpipPct: number,
    af: number,
  ): string | null {
    const recent = state.recentHands;
    if (recent.length < 3) return null;

    // Showdown frequency insight
    if (state.showdownsReached >= 3) {
      const sdWinPct = Math.round((state.showdownsWon / state.showdownsReached) * 100);
      if (sdWinPct >= 70) {
        return `You're winning ${sdWinPct}% of showdowns — your hand selection is strong. Opponents should be scared to call you down. Bet for value more aggressively.`;
      }
      if (sdWinPct <= 30) {
        return `You're only winning ${sdWinPct}% of showdowns — you may be overvaluing hands or getting outdrawn. Tighten your range or bluff more (avoid showdown).`;
      }
    }

    // Chip leader awareness
    if (currentChips > state.startingChips * 1.5) {
      return `You're well above your starting stack. Use your big stack as a weapon — put pressure on shorter stacks who can't afford to call.`;
    }

    // Short stack awareness
    if (currentChips < state.startingChips * 0.4) {
      return `Your stack has taken a big hit. Be selective but commit hard when you enter a pot — you can't afford to bleed chips.`;
    }

    // Unbalanced play detection
    if (vpipPct > 55 && af < 1.0) {
      return `You're playing a lot of hands but mostly calling — this is a leak. Either tighten up or raise more when you enter pots.`;
    }

    return null;
  }
}

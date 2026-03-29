// ============================================================
// Opponent Scouting System — learn from observed behavior
// ============================================================

import type { BettingRound, Card } from './types.js';

// ---- Types ----

export interface OpponentStats {
  handsObserved: number;

  // Preflop
  vpipCount: number;            // voluntarily put money in pot
  pfrCount: number;             // preflop raise
  preflopOpportunities: number; // hands where they could act preflop

  // Postflop aggression
  postflopBets: number;
  postflopRaises: number;
  postflopCalls: number;

  // Pressure response
  foldToRaiseCount: number;
  facedRaiseCount: number;

  // Showdown
  showdownsReached: number;
  showdownsWon: number;
}

interface HandActionLog {
  playerId: string;
  action: 'fold' | 'check' | 'call' | 'raise';
  round: BettingRound;
  facedRaise: boolean;
}

interface PlayerScoutingState {
  playerId: string;
  opponents: Map<string, OpponentStats>;
  handCounter: number; // for decay timing
}

// ---- Constants ----

const MIN_HANDS_FOR_REPORT = 5;
const MAX_CHARS_PER_OPPONENT = 150;
const MAX_TOTAL_CHARS = 800;
const DECAY_INTERVAL = 10;
const DECAY_FACTOR = 0.8;

const COUNTER_KEYS: (keyof OpponentStats)[] = [
  'handsObserved', 'vpipCount', 'pfrCount', 'preflopOpportunities',
  'postflopBets', 'postflopRaises', 'postflopCalls',
  'foldToRaiseCount', 'facedRaiseCount',
  'showdownsReached', 'showdownsWon',
];

// ---- Classification helpers ----

function classifyVPIP(pct: number): string {
  if (pct < 20) return 'very tight';
  if (pct < 30) return 'tight';
  if (pct < 40) return 'moderate';
  if (pct < 50) return 'loose';
  return 'very loose';
}

function classifyAggression(af: number): string {
  if (af < 0.5) return 'very passive';
  if (af < 1.0) return 'passive';
  if (af < 2.0) return 'moderate';
  if (af < 3.0) return 'aggressive';
  return 'extremely aggressive';
}

function classifyFoldToPressure(pct: number): string {
  if (pct < 25) return 'rarely folds to pressure';
  if (pct < 45) return 'sometimes folds to pressure';
  if (pct < 65) return 'often folds to pressure';
  return 'folds to pressure frequently';
}

function generateTip(vpipPct: number, af: number, foldPct: number, bluffRate: number): string {
  // Pick the most exploitable tendency
  if (foldPct >= 60) return 'Bluff them — they fold too much.';
  if (foldPct < 25 && af < 1.0) return 'Value bet thin — they call too wide.';
  if (af >= 3.0) return 'Let them hang themselves — call down light.';
  if (bluffRate >= 0.4) return 'Call them down — frequent bluffer.';
  if (vpipPct < 20) return 'Respect their bets — they only play premiums.';
  if (vpipPct >= 50) return 'Tighten up — they\'ll pay you off with worse.';
  return '';
}

// ---- Scouting System ----

export class ScoutingSystem {
  private playerStates: Map<string, PlayerScoutingState> = new Map();
  private handActions: HandActionLog[] = [];
  private currentHighestBet: number = 0;

  /** Initialize scouting for a player (call at game start) */
  initPlayer(playerId: string, allPlayerIds: string[]): void {
    const opponents = new Map<string, OpponentStats>();
    for (const id of allPlayerIds) {
      if (id !== playerId) {
        opponents.set(id, this.emptyStats());
      }
    }
    this.playerStates.set(playerId, {
      playerId,
      opponents,
      handCounter: 0,
    });
  }

  /** Call at start of each hand to reset per-hand tracking */
  startHand(): void {
    this.handActions = [];
    this.currentHighestBet = 0;
  }

  /** Record an observed action (call from action event handler) */
  recordAction(
    actingPlayerId: string,
    action: 'fold' | 'check' | 'call' | 'raise',
    round: BettingRound,
    playerCurrentBet: number,
    highestBet: number,
  ): void {
    const facedRaise = highestBet > playerCurrentBet;
    this.handActions.push({
      playerId: actingPlayerId,
      action,
      round,
      facedRaise,
    });
    if (highestBet > this.currentHighestBet) {
      this.currentHighestBet = highestBet;
    }
  }

  /** Call at hand end to flush per-hand actions into aggregate stats */
  recordHandEnd(
    showdownHands: Map<string, Card[]>,
    winners: Map<string, number>,
    allActivePlayerIds: string[],
  ): void {
    // Determine who voluntarily entered the pot (called or raised preflop)
    const preflopActors = new Set<string>();
    const vpipPlayers = new Set<string>();
    const pfrPlayers = new Set<string>();

    for (const log of this.handActions) {
      if (log.round === 'preflop') {
        preflopActors.add(log.playerId);
        if (log.action === 'call' || log.action === 'raise') {
          vpipPlayers.add(log.playerId);
        }
        if (log.action === 'raise') {
          pfrPlayers.add(log.playerId);
        }
      }
    }

    // Determine showdown participants
    const showdownPlayerIds = new Set(showdownHands.keys());
    const winnerIds = new Set(winners.keys());

    // Update every observer's stats about every opponent
    for (const [observerId, state] of this.playerStates) {
      state.handCounter++;

      for (const opponentId of allActivePlayerIds) {
        if (opponentId === observerId) continue;

        const stats = state.opponents.get(opponentId);
        if (!stats) continue;

        stats.handsObserved++;

        // Preflop stats
        if (preflopActors.has(opponentId) || allActivePlayerIds.includes(opponentId)) {
          stats.preflopOpportunities++;
          if (vpipPlayers.has(opponentId)) stats.vpipCount++;
          if (pfrPlayers.has(opponentId)) stats.pfrCount++;
        }

        // Postflop + pressure stats from action log
        for (const log of this.handActions) {
          if (log.playerId !== opponentId) continue;
          if (log.round === 'preflop') continue; // already counted above

          if (log.action === 'raise') stats.postflopRaises++;
          else if (log.action === 'call') stats.postflopCalls++;
          else if (log.action === 'check') { /* checks don't count for AF */ }

          // Count bets (a raise when no one has bet is effectively a bet)
          // For simplicity, count raises as aggression
        }

        // Pressure response (all rounds)
        for (const log of this.handActions) {
          if (log.playerId !== opponentId) continue;
          if (log.facedRaise) {
            stats.facedRaiseCount++;
            if (log.action === 'fold') stats.foldToRaiseCount++;
          }
        }

        // Showdown stats
        if (showdownPlayerIds.has(opponentId)) {
          stats.showdownsReached++;
          if (winnerIds.has(opponentId)) stats.showdownsWon++;
        }

        // Exponential decay every DECAY_INTERVAL hands
        if (stats.handsObserved > 0 && stats.handsObserved % DECAY_INTERVAL === 0) {
          this.decayStats(stats);
        }
      }
    }
  }

  /** Generate the scouting prompt for a player */
  getScoutingPrompt(
    playerId: string,
    playerNames: Map<string, string>,
    playerChips?: Map<string, number>,
  ): string {
    const state = this.playerStates.get(playerId);
    if (!state) return '';

    // Build reports for each opponent
    const reports: Array<{ id: string; text: string; relevance: number }> = [];

    for (const [opponentId, stats] of state.opponents) {
      if (stats.handsObserved < MIN_HANDS_FOR_REPORT) continue;

      const name = playerNames.get(opponentId) ?? opponentId;
      const report = this.buildOpponentReport(name, stats, playerChips?.get(opponentId));
      const chips = playerChips?.get(opponentId) ?? 0;
      const avgChips = playerChips
        ? [...playerChips.values()].reduce((a, b) => a + b, 0) / playerChips.size
        : 1;
      const relevance = stats.handsObserved * (chips / Math.max(avgChips, 1));

      reports.push({ id: opponentId, text: report, relevance });
    }

    if (reports.length === 0) return '';

    // Sort by relevance (most relevant first)
    reports.sort((a, b) => b.relevance - a.relevance);

    // Enforce total budget
    const lines: string[] = [];
    let totalChars = 0;

    for (const report of reports) {
      const text = report.text.length > MAX_CHARS_PER_OPPONENT
        ? report.text.slice(0, MAX_CHARS_PER_OPPONENT - 3) + '...'
        : report.text;

      if (totalChars + text.length > MAX_TOTAL_CHARS) break;
      lines.push(text);
      totalChars += text.length;
    }

    return lines.join('\n');
  }

  // ---- Private helpers ----

  private emptyStats(): OpponentStats {
    return {
      handsObserved: 0,
      vpipCount: 0,
      pfrCount: 0,
      preflopOpportunities: 0,
      postflopBets: 0,
      postflopRaises: 0,
      postflopCalls: 0,
      foldToRaiseCount: 0,
      facedRaiseCount: 0,
      showdownsReached: 0,
      showdownsWon: 0,
    };
  }

  private decayStats(stats: OpponentStats): void {
    for (const key of COUNTER_KEYS) {
      (stats as any)[key] = Math.round(stats[key] * DECAY_FACTOR);
    }
  }

  private buildOpponentReport(name: string, stats: OpponentStats, chips?: number): string {
    const vpipPct = stats.preflopOpportunities > 0
      ? Math.round((stats.vpipCount / stats.preflopOpportunities) * 100)
      : 0;
    const pfrPct = stats.preflopOpportunities > 0
      ? Math.round((stats.pfrCount / stats.preflopOpportunities) * 100)
      : 0;

    const postflopActions = stats.postflopCalls + stats.postflopRaises;
    const af = stats.postflopCalls > 0
      ? (stats.postflopBets + stats.postflopRaises) / stats.postflopCalls
      : stats.postflopRaises > 0 ? 5.0 : 1.0; // infinite aggression capped at 5

    const foldPct = stats.facedRaiseCount > 0
      ? Math.round((stats.foldToRaiseCount / stats.facedRaiseCount) * 100)
      : 50;

    const bluffRate = stats.showdownsReached > 0
      ? (stats.showdownsReached - stats.showdownsWon) / stats.showdownsReached
      : 0;

    // Build compact line
    const vpipLabel = classifyVPIP(vpipPct);
    const aggrLabel = classifyAggression(af);
    const foldLabel = classifyFoldToPressure(foldPct);

    let parts = `${name} (${stats.handsObserved}h): ${vpipLabel} VPIP ${vpipPct}%, ${aggrLabel} postflop. ${foldLabel}.`;

    // Showdown info if enough data
    if (stats.showdownsReached >= 3) {
      const showdownWinPct = Math.round((stats.showdownsWon / stats.showdownsReached) * 100);
      parts += ` SD win ${showdownWinPct}%.`;
    }

    // Actionable tip
    const tip = generateTip(vpipPct, af, foldPct, bluffRate);
    if (tip) {
      parts += ` ${tip}`;
    }

    return parts;
  }
}

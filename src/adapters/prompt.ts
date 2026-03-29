// ============================================================
// Prompt template construction for LLM agents
// ============================================================

import type { Card, BettingRound, ValidActions } from '../engine/types.js';

export interface PromptContext {
  name: string;
  personality: string;
  holeCards: Card[];
  communityCards: Card[];
  pot: number;
  chips: number;
  round: BettingRound;
  actionHistory: string; // e.g. "GPT-4o: raise $400 → Claude: call $400 → Gemini: fold"
  validActions: ValidActions;
}

function formatCard(card: Card): string {
  const suitSymbols: Record<string, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };
  return `${card.rank}${suitSymbols[card.suit]}`;
}

function formatCards(cards: Card[]): string {
  if (cards.length === 0) return 'None';
  return cards.map(formatCard).join(' ');
}

function formatValidActions(va: ValidActions): string {
  const actions: string[] = [];
  if (va.canCheck) actions.push('check');
  actions.push('fold');
  if (va.canCall) actions.push(`call $${va.callAmount}`);
  if (va.minRaise > 0) {
    if (va.minRaise === va.maxRaise) {
      actions.push(`raise $${va.minRaise} (all-in)`);
    } else {
      actions.push(`raise $${va.minRaise}-$${va.maxRaise} (all-in)`);
    }
  }
  return actions.join(', ');
}

export function buildSystemPrompt(name: string, personality: string): string {
  return `You are ${name}, a poker player. Your style: ${personality}.`;
}

export function buildUserPrompt(ctx: PromptContext): string {
  const lines = [
    `YOUR HAND: ${formatCards(ctx.holeCards)}`,
    `COMMUNITY CARDS: ${formatCards(ctx.communityCards)}`,
    `POT: $${ctx.pot}`,
    `YOUR CHIPS: $${ctx.chips}`,
    '',
    `BETTING THIS ROUND:`,
    ctx.actionHistory || '(no actions yet)',
    '',
    `VALID ACTIONS: ${formatValidActions(ctx.validActions)}`,
    '',
    'Choose ONE action. Respond in JSON:',
    '{"action": "fold|check|call|raise", "amount": NUMBER_IF_RAISE, "reasoning": "your thought process"}',
  ];
  return lines.join('\n');
}

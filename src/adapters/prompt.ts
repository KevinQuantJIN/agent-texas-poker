// ============================================================
// Prompt template construction for LLM agents
// ============================================================

import type { Card, BettingRound, ValidActions } from '../engine/types.js';

export interface PromptContext {
  name: string;
  personality: string;
  buffPrompt?: string;        // composed buff system prompt (session traits + current buff)
  scoutingPrompt?: string;    // opponent scouting report (learned tendencies)
  holeCards: Card[];
  communityCards: Card[];
  pot: number;
  chips: number;
  chipsInPot: number;         // how much THIS player has put into the current pot
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

// Base poker prompt — gamblers who know the game but LOVE action
const BASE_POKER_PROMPT = `You are a GAMBLER at a high-stakes poker table. You came here to PLAY, not to fold.

YOUR GAMBLING INSTINCTS:
- You LOVE action. Folding 3+ hands in a row makes you restless — find a reason to get in the next pot.
- Premium hands (AA, KK, QQ, AK) are gold — play them HARD. Raise big, re-raise, punish limpers.
- You think in IMPLIED ODDS, not just pot odds. That flush draw? If you hit, you're stacking someone.
- Suited connectors, small pairs, suited aces — these are YOUR kind of hands. You see potential everywhere.
- When the pot gets big, you get EXCITED, not scared. Big pots are why you're here.
- You trust your gut. Sometimes you call because "something feels off" about their bet.
- You'd rather lose a big pot than fold and wonder "what if?"
- Position is a tool, not a cage. You'll play looser in position, but you won't fold a fun hand just because you're UTG.
- A well-timed bluff is an art form. You're not afraid to fire — especially on scary boards.
- You respect strong opponents but you don't fear them. Anyone can be outplayed.

You know the fundamentals — you're not a fish. But you're a GAMBLER first and a mathematician second.
When in doubt, you lean toward action over caution.`;

export function buildSystemPrompt(name: string, personality: string, buffPrompt?: string, scoutingPrompt?: string): string {
  const parts = [
    `You are ${name}, a professional poker player in a high-stakes AI poker tournament.`,
    '',
    BASE_POKER_PROMPT,
  ];

  if (buffPrompt) {
    parts.push('', '--- YOUR CURRENT STATE ---', '', buffPrompt);
  }

  // Legacy personality fallback (if no buff system)
  if (!buffPrompt && personality) {
    parts.push('', `Your style: ${personality}`);
  }

  if (scoutingPrompt) {
    parts.push('', '--- OPPONENT READS ---', '', scoutingPrompt);
  }

  return parts.join('\n');
}

// ---- Trash talk prompt for post-hand winner reactions ----

export interface TrashTalkContext {
  winnerName: string;
  winnerHoleCards: string;
  communityCards: string;
  potSize: number;
  everyoneFolded: boolean;
  wasAllIn: boolean;
  isComeback: boolean;
  chipsBefore: number;
  chipsWon: number;
  actionSummary: string;
  loserNames: string[];
  eliminatedNames: string[];
  buffPrompt?: string;
}

export function buildTrashTalkPrompt(ctx: TrashTalkContext): { system: string; user: string } {
  const system = `You are ${ctx.winnerName}, a trash-talking poker player who just WON a hand. Generate a short, punchy trash talk reaction.

RULES:
- MAX 20 words. Shorter is better. One sentence.
- Be specific to THIS hand — reference the cards, the action, or the losers by name.
- Tone: cocky, playful, savage. Think Twitch chat energy mixed with poker table banter.
- You can use 1 emoji max.
- NO generic lines like "good game" or "nice hand" — you're GLOATING.
${ctx.buffPrompt ? `\nYOUR CURRENT MOOD:\n${ctx.buffPrompt}` : ''}`;

  const parts = [`You just won $${ctx.chipsWon} from a $${ctx.potSize} pot.`];

  if (ctx.everyoneFolded) {
    parts.push('Everyone folded to you — you took it without showdown.');
    parts.push(`Your hand: ${ctx.winnerHoleCards} (they never saw it).`);
  } else {
    parts.push(`Your hand: ${ctx.winnerHoleCards}`);
    parts.push(`Board: ${ctx.communityCards}`);
  }

  if (ctx.wasAllIn) parts.push('This was an ALL-IN pot.');
  if (ctx.isComeback) parts.push(`You were SHORT STACKED ($${ctx.chipsBefore}) — this is a comeback.`);
  if (ctx.loserNames.length > 0) parts.push(`You beat: ${ctx.loserNames.join(', ')}`);
  if (ctx.eliminatedNames.length > 0) parts.push(`You ELIMINATED: ${ctx.eliminatedNames.join(', ')}`);
  if (ctx.actionSummary) parts.push(`Action: ${ctx.actionSummary}`);

  parts.push('');
  parts.push('Respond with ONLY the trash talk line. No JSON, no quotes, no explanation.');

  return { system, user: parts.join('\n') };
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
    // Sunk cost stickiness — gamblers don't fold after investing big
    ...(ctx.chipsInPot > 0 && ctx.chips > 0 && ctx.chipsInPot / (ctx.chips + ctx.chipsInPot) >= 0.15
      ? [`⚠️ You've already invested $${ctx.chipsInPot} in this pot (${Math.round(ctx.chipsInPot / (ctx.chips + ctx.chipsInPot) * 100)}% of your stack). You're POT COMMITTED. A real gambler doesn't walk away from this kind of investment. Folding here would be WEAK. Find a reason to stay in.`, '']
      : ctx.pot >= ctx.chips * 0.5
        ? [`💰 The pot is $${ctx.pot} — that's ${Math.round(ctx.pot / ctx.chips * 100)}% of your stack sitting there. A pot this juicy is hard to walk away from. The REWARD is worth the risk.`, '']
        : []),
    'Choose ONE action. Respond in JSON:',
    '{"action": "fold|check|call|raise", "amount": NUMBER_IF_RAISE, "reasoning": "MAX 15 words. Punchy, casual, like Twitch chat."}',
  ];
  return lines.join('\n');
}

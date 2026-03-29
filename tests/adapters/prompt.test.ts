import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, type PromptContext } from '../../src/adapters/prompt.js';

describe('buildSystemPrompt', () => {
  it('includes name and personality', () => {
    const result = buildSystemPrompt('Claude', 'Analytical, cautious, reads opponents');
    expect(result).toBe('You are Claude, a poker player. Your style: Analytical, cautious, reads opponents.');
  });
});

describe('buildUserPrompt', () => {
  const ctx: PromptContext = {
    name: 'Claude',
    personality: 'cautious',
    holeCards: [
      { rank: 'A', suit: 'spades' },
      { rank: 'K', suit: 'hearts' },
    ],
    communityCards: [
      { rank: '10', suit: 'diamonds' },
      { rank: 'J', suit: 'clubs' },
      { rank: 'Q', suit: 'spades' },
    ],
    pot: 500,
    chips: 9500,
    round: 'flop',
    actionHistory: 'GPT-4o: raise $400 → Claude: call $400',
    validActions: {
      canCheck: true,
      canCall: false,
      callAmount: 0,
      minRaise: 200,
      maxRaise: 9500,
    },
  };

  it('includes hole cards with suit symbols', () => {
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('A♠ K♥');
  });

  it('includes community cards', () => {
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('10♦ J♣ Q♠');
  });

  it('includes pot and chips', () => {
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('POT: $500');
    expect(prompt).toContain('YOUR CHIPS: $9500');
  });

  it('includes action history', () => {
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('GPT-4o: raise $400 → Claude: call $400');
  });

  it('includes valid actions', () => {
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('check');
    expect(prompt).toContain('raise $200-$9500 (all-in)');
  });

  it('includes JSON format instruction', () => {
    const prompt = buildUserPrompt(ctx);
    expect(prompt).toContain('{"action":');
    expect(prompt).toContain('"reasoning"');
  });

  it('shows "None" for empty community cards', () => {
    const preflop = { ...ctx, communityCards: [] };
    const prompt = buildUserPrompt(preflop);
    expect(prompt).toContain('COMMUNITY CARDS: None');
  });

  it('shows "(no actions yet)" for empty action history', () => {
    const noHistory = { ...ctx, actionHistory: '' };
    const prompt = buildUserPrompt(noHistory);
    expect(prompt).toContain('(no actions yet)');
  });

  it('shows all-in only when minRaise equals maxRaise', () => {
    const allIn = {
      ...ctx,
      validActions: { canCheck: false, canCall: true, callAmount: 100, minRaise: 500, maxRaise: 500 },
    };
    const prompt = buildUserPrompt(allIn);
    expect(prompt).toContain('raise $500 (all-in)');
    expect(prompt).not.toContain('$500-$500');
  });
});

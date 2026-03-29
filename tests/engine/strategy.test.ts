import { describe, it, expect, beforeEach } from 'vitest';
import { StrategyJournal } from '../../src/engine/strategy.js';

describe('StrategyJournal', () => {
  let journal: StrategyJournal;

  beforeEach(() => {
    journal = new StrategyJournal();
    journal.initPlayer('claude', 10000);
  });

  it('returns empty prompt with fewer than 2 hands', () => {
    expect(journal.getStrategyPrompt('claude', 10000)).toBe('');
  });

  it('tracks VPIP and PFR correctly', () => {
    // Hand 1: raise preflop, win
    journal.startHand();
    journal.recordAction('claude', 'raise', 'preflop');
    journal.recordAction('claude', 'raise', 'flop');
    journal.recordHandEnd('claude', {
      handNumber: 1, won: true, chipsDelta: 500, currentChips: 10500, sawShowdown: true,
    });

    // Hand 2: call preflop, lose
    journal.startHand();
    journal.recordAction('claude', 'call', 'preflop');
    journal.recordAction('claude', 'fold', 'flop');
    journal.recordHandEnd('claude', {
      handNumber: 2, won: false, chipsDelta: -200, currentChips: 10300, sawShowdown: false,
    });

    // Hand 3: fold preflop
    journal.startHand();
    journal.recordAction('claude', 'fold', 'preflop');
    journal.recordHandEnd('claude', {
      handNumber: 3, won: false, chipsDelta: 0, currentChips: 10300, sawShowdown: false,
    });

    const prompt = journal.getStrategyPrompt('claude', 10300);
    // VPIP should be 2/3 = 67%
    expect(prompt).toContain('VPIP 67%');
    // PFR should be 1/3 = 33%
    expect(prompt).toContain('PFR 33%');
  });

  it('detects consecutive raise pattern', () => {
    // Play 3 hands all with preflop raises
    for (let i = 1; i <= 3; i++) {
      journal.startHand();
      journal.recordAction('claude', 'raise', 'preflop');
      journal.recordHandEnd('claude', {
        handNumber: i, won: true, chipsDelta: 200, currentChips: 10000 + i * 200, sawShowdown: false,
      });
    }

    const prompt = journal.getStrategyPrompt('claude', 10600);
    expect(prompt).toContain("raised preflop 3 hands in a row");
  });

  it('detects consecutive fold pattern', () => {
    for (let i = 1; i <= 4; i++) {
      journal.startHand();
      journal.recordAction('claude', 'fold', 'preflop');
      journal.recordHandEnd('claude', {
        handNumber: i, won: false, chipsDelta: 0, currentChips: 10000, sawShowdown: false,
      });
    }

    const prompt = journal.getStrategyPrompt('claude', 10000);
    expect(prompt).toContain('folded 4 hands in a row');
  });

  it('shows chip trajectory', () => {
    // Two hands, net +1500
    journal.startHand();
    journal.recordAction('claude', 'raise', 'preflop');
    journal.recordHandEnd('claude', {
      handNumber: 1, won: true, chipsDelta: 1500, currentChips: 11500, sawShowdown: true,
    });
    journal.startHand();
    journal.recordAction('claude', 'check', 'preflop');
    journal.recordHandEnd('claude', {
      handNumber: 2, won: false, chipsDelta: 0, currentChips: 11500, sawShowdown: false,
    });

    const prompt = journal.getStrategyPrompt('claude', 11500);
    expect(prompt).toContain('+$1500');
    expect(prompt).toContain('up');
  });

  it('shows recent hand log', () => {
    journal.startHand();
    journal.recordAction('claude', 'raise', 'preflop');
    journal.recordHandEnd('claude', {
      handNumber: 1, won: true, chipsDelta: 300, currentChips: 10300, sawShowdown: false,
    });
    journal.startHand();
    journal.recordAction('claude', 'fold', 'preflop');
    journal.recordHandEnd('claude', {
      handNumber: 2, won: false, chipsDelta: -50, currentChips: 10250, sawShowdown: false,
    });

    const prompt = journal.getStrategyPrompt('claude', 10250);
    expect(prompt).toContain('#1:');
    expect(prompt).toContain('#2:');
  });

  it('classifies table image correctly', () => {
    // Play 5 hands — all raises, creating a LAG image
    for (let i = 1; i <= 5; i++) {
      journal.startHand();
      journal.recordAction('claude', 'raise', 'preflop');
      journal.recordAction('claude', 'raise', 'flop');
      journal.recordHandEnd('claude', {
        handNumber: i, won: i % 2 === 0, chipsDelta: i % 2 === 0 ? 500 : -200,
        currentChips: 10000, sawShowdown: true,
      });
    }

    const prompt = journal.getStrategyPrompt('claude', 10000);
    // 100% VPIP, high AF → LAG
    expect(prompt).toContain('LAG');
  });

  it('generates showdown win rate insight', () => {
    // 4 showdowns, 3 won
    for (let i = 1; i <= 4; i++) {
      journal.startHand();
      journal.recordAction('claude', 'call', 'preflop');
      journal.recordAction('claude', 'call', 'flop');
      journal.recordHandEnd('claude', {
        handNumber: i, won: i <= 3, chipsDelta: i <= 3 ? 200 : -400,
        currentChips: 10000, sawShowdown: true,
      });
    }

    const prompt = journal.getStrategyPrompt('claude', 10000);
    expect(prompt).toContain('75%');
    expect(prompt).toContain('showdown');
  });

  it('resets currentHandActions each hand', () => {
    journal.startHand();
    journal.recordAction('claude', 'raise', 'preflop');
    journal.recordHandEnd('claude', {
      handNumber: 1, won: true, chipsDelta: 200, currentChips: 10200, sawShowdown: false,
    });

    // Second hand — should not carry over actions from hand 1
    journal.startHand();
    journal.recordAction('claude', 'fold', 'preflop');
    journal.recordHandEnd('claude', {
      handNumber: 2, won: false, chipsDelta: 0, currentChips: 10200, sawShowdown: false,
    });

    const prompt = journal.getStrategyPrompt('claude', 10200);
    // VPIP should be 1/2 = 50%, not 100% (hand 2 was a fold)
    expect(prompt).toContain('VPIP 50%');
  });

  it('handles unknown player gracefully', () => {
    expect(journal.getStrategyPrompt('unknown', 5000)).toBe('');
  });
});

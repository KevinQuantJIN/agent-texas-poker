import { describe, it, expect } from 'vitest';
import { evaluateHand, determineWinners } from '@/engine/hand-eval';
import { Card } from '@/engine/types';

function c(rank: string, suit: string): Card {
  return { rank: rank as Card['rank'], suit: suit as Card['suit'] };
}

describe('evaluateHand', () => {
  it('evaluates a royal flush', () => {
    const hole = [c('A', 'spades'), c('K', 'spades')];
    const community = [c('Q', 'spades'), c('J', 'spades'), c('10', 'spades'), c('2', 'hearts'), c('3', 'clubs')];
    const hand = evaluateHand(hole, community);
    // pokersolver reports royal flush as "Straight Flush"
    expect(hand.name).toBe('Straight Flush');
  });

  it('evaluates a straight flush', () => {
    const hole = [c('9', 'hearts'), c('8', 'hearts')];
    const community = [c('7', 'hearts'), c('6', 'hearts'), c('5', 'hearts'), c('2', 'clubs'), c('3', 'diamonds')];
    const hand = evaluateHand(hole, community);
    expect(hand.name).toBe('Straight Flush');
  });

  it('evaluates four of a kind', () => {
    const hole = [c('A', 'spades'), c('A', 'hearts')];
    const community = [c('A', 'diamonds'), c('A', 'clubs'), c('K', 'spades'), c('2', 'hearts'), c('3', 'clubs')];
    const hand = evaluateHand(hole, community);
    expect(hand.name).toBe('Four of a Kind');
  });

  it('evaluates a full house', () => {
    const hole = [c('K', 'spades'), c('K', 'hearts')];
    const community = [c('K', 'diamonds'), c('Q', 'clubs'), c('Q', 'spades'), c('2', 'hearts'), c('3', 'clubs')];
    const hand = evaluateHand(hole, community);
    expect(hand.name).toBe('Full House');
  });

  it('evaluates a flush', () => {
    const hole = [c('A', 'hearts'), c('J', 'hearts')];
    const community = [c('9', 'hearts'), c('5', 'hearts'), c('2', 'hearts'), c('K', 'clubs'), c('3', 'diamonds')];
    const hand = evaluateHand(hole, community);
    expect(hand.name).toBe('Flush');
  });

  it('evaluates a straight', () => {
    const hole = [c('8', 'spades'), c('7', 'hearts')];
    const community = [c('6', 'diamonds'), c('5', 'clubs'), c('4', 'spades'), c('K', 'hearts'), c('2', 'clubs')];
    const hand = evaluateHand(hole, community);
    expect(hand.name).toBe('Straight');
  });

  it('evaluates three of a kind', () => {
    const hole = [c('J', 'spades'), c('J', 'hearts')];
    const community = [c('J', 'diamonds'), c('5', 'clubs'), c('2', 'spades'), c('K', 'hearts'), c('3', 'clubs')];
    const hand = evaluateHand(hole, community);
    expect(hand.name).toBe('Three of a Kind');
  });

  it('evaluates two pair', () => {
    const hole = [c('K', 'spades'), c('Q', 'hearts')];
    const community = [c('K', 'diamonds'), c('Q', 'clubs'), c('2', 'spades'), c('7', 'hearts'), c('3', 'clubs')];
    const hand = evaluateHand(hole, community);
    expect(hand.name).toBe('Two Pair');
  });

  it('evaluates a pair', () => {
    const hole = [c('A', 'spades'), c('A', 'hearts')];
    const community = [c('K', 'diamonds'), c('9', 'clubs'), c('5', 'spades'), c('3', 'hearts'), c('2', 'clubs')];
    const hand = evaluateHand(hole, community);
    expect(hand.name).toBe('Pair');
  });

  it('evaluates high card', () => {
    const hole = [c('A', 'spades'), c('J', 'hearts')];
    const community = [c('9', 'diamonds'), c('7', 'clubs'), c('5', 'spades'), c('3', 'hearts'), c('2', 'clubs')];
    const hand = evaluateHand(hole, community);
    expect(hand.name).toBe('High Card');
  });
});

describe('determineWinners', () => {
  it('picks the best hand among eligible players', () => {
    const playerHoleCards = [
      [c('A', 'spades'), c('A', 'hearts')], // pair of aces
      [c('K', 'spades'), c('K', 'hearts')], // pair of kings
      [c('2', 'spades'), c('3', 'hearts')], // junk
    ];
    const community = [c('9', 'diamonds'), c('7', 'clubs'), c('5', 'spades'), c('J', 'hearts'), c('4', 'clubs')];

    const winners = determineWinners(playerHoleCards, community, [0, 1, 2]);
    expect(winners).toEqual([0]); // aces win
  });

  it('handles a tie (split pot)', () => {
    const playerHoleCards = [
      [c('A', 'spades'), c('K', 'hearts')],
      [c('A', 'hearts'), c('K', 'spades')],
    ];
    const community = [c('Q', 'diamonds'), c('J', 'clubs'), c('10', 'spades'), c('2', 'hearts'), c('3', 'clubs')];

    const winners = determineWinners(playerHoleCards, community, [0, 1]);
    expect(winners).toHaveLength(2);
    expect(winners).toContain(0);
    expect(winners).toContain(1);
  });

  it('only considers eligible players', () => {
    const playerHoleCards = [
      [c('A', 'spades'), c('A', 'hearts')], // best hand but NOT eligible
      [c('K', 'spades'), c('K', 'hearts')], // eligible
      [c('2', 'spades'), c('3', 'hearts')], // eligible
    ];
    const community = [c('9', 'diamonds'), c('7', 'clubs'), c('5', 'spades'), c('J', 'hearts'), c('4', 'clubs')];

    const winners = determineWinners(playerHoleCards, community, [1, 2]);
    expect(winners).toEqual([1]); // kings win among eligible
  });
});

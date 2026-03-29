'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { GameState, AgentThought } from '../../engine/types';
import {
  ensureResumed,
  playCardDeal,
  playCheck,
  playFold,
  playRaise,
  playCall,
  playRaiseScaled,
  playCallScaled,
  playAllIn,
  playChipClink,
  playWinFanfare,
  playNewHand,
  startAmbience,
} from '../audio/sfx';
import {
  playMusic,
  stopMusic,
  setTension,
  playAllInSting,
  playBigRaiseSting,
  playBigCallSting,
  playShowdownSting,
  playBigWinSting,
} from '../audio/music';

// ── Drama calculator ──────────────────────────────────────────
function calcTension(state: GameState): number {
  const totalPot = state.pots.reduce((s, p) => s + p.amount, 0);
  const activePlayers = state.players.filter(p => !p.isFolded && !p.isEliminated);
  const avgStack = activePlayers.reduce((s, p) => s + p.chips, 0) / (activePlayers.length || 1);
  const allInCount = activePlayers.filter(p => p.isAllIn).length;
  const potRatio = Math.min(totalPot / (avgStack || 1), 3) / 3;
  const allInBonus = Math.min(allInCount * 0.3, 0.6);
  const roundMult: Record<string, number> = {
    preflop: 0.0, flop: 0.1, turn: 0.2, river: 0.35, showdown: 0.4,
  };
  const roundBonus = roundMult[state.round] ?? 0;
  return Math.min(1, potRatio * 0.5 + allInBonus + roundBonus);
}

/**
 * Calculate how "big" a bet is: 0 = minimum, 1 = all-in sized.
 * Based on bet amount relative to the average remaining stack.
 */
function betIntensity(amount: number | undefined, state: GameState): number {
  if (!amount || amount <= 0) return 0;
  const stacks = state.players
    .filter(p => !p.isEliminated)
    .map(p => p.chips);
  const avgStack = stacks.reduce((s, c) => s + c, 0) / (stacks.length || 1);
  if (avgStack <= 0) return 1;
  // <10% of avg stack = 0, >80% = 1
  return Math.min(1, Math.max(0, (amount / avgStack - 0.1) / 0.7));
}

/** Check if a player just went all-in this action */
function isAllInAction(thought: AgentThought, state: GameState): boolean {
  if (!state) return false;
  const player = state.players.find(p => p.id === thought.playerId);
  return !!player?.isAllIn;
}

export function useGameAudio(
  gameState: GameState | null,
  thoughts: AgentThought[],
  isGameOver: boolean,
) {
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);

  const prevHandRef = useRef<number>(0);
  const prevRoundRef = useRef<string>('');
  const prevThoughtCountRef = useRef<number>(0);
  const prevCommunityCountRef = useRef<number>(0);
  const prevAllInCountRef = useRef<number>(0);
  const audioUnlocked = useRef(false);
  const stopAmbienceRef = useRef<(() => void) | null>(null);

  // Unlock AudioContext
  useEffect(() => {
    const unlock = () => {
      if (audioUnlocked.current) return;
      audioUnlocked.current = true;
      ensureResumed();
      if (sfxEnabled) stopAmbienceRef.current = startAmbience();
      if (musicEnabled) playMusic();
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [musicEnabled, sfxEnabled]);

  // ── Update tension + detect all-ins and showdown ──
  useEffect(() => {
    if (!gameState || !audioUnlocked.current || !musicEnabled) return;
    const tension = calcTension(gameState);
    setTension(tension);

    const allInCount = gameState.players.filter(p => p.isAllIn).length;
    if (allInCount > prevAllInCountRef.current && allInCount > 0) {
      playAllInSting();
    }
    prevAllInCountRef.current = allInCount;

    if (gameState.round === 'showdown' && prevRoundRef.current !== 'showdown') {
      playShowdownSting();
    }
  }, [gameState, musicEnabled]);

  // ── Game state changes (hand/round) ──
  useEffect(() => {
    if (!gameState || !sfxEnabled || !audioUnlocked.current) return;

    if (gameState.handNumber !== prevHandRef.current) {
      prevHandRef.current = gameState.handNumber;
      prevRoundRef.current = gameState.round;
      prevCommunityCountRef.current = 0;
      prevAllInCountRef.current = 0;
      setTension(0);
      playNewHand();
      return;
    }

    if (gameState.round !== prevRoundRef.current) {
      prevRoundRef.current = gameState.round;
      const newCards = gameState.communityCards.length - prevCommunityCountRef.current;
      prevCommunityCountRef.current = gameState.communityCards.length;
      for (let i = 0; i < newCards; i++) {
        setTimeout(() => playCardDeal(), i * 150);
      }
    }
  }, [gameState, sfxEnabled]);

  // ── Player actions — SFX SCALES WITH THE MONEY ──
  useEffect(() => {
    if (!sfxEnabled || !audioUnlocked.current || !gameState) return;
    if (thoughts.length <= prevThoughtCountRef.current) {
      prevThoughtCountRef.current = thoughts.length;
      return;
    }

    const newThoughts = thoughts.slice(prevThoughtCountRef.current);
    prevThoughtCountRef.current = thoughts.length;

    for (const thought of newThoughts) {
      const amount = thought.action.amount;
      const I = betIntensity(amount, gameState);
      const allIn = isAllInAction(thought, gameState);

      switch (thought.action.action) {
        case 'fold':
          playFold();
          break;

        case 'check':
          playCheck();
          break;

        case 'call':
          if (allIn) {
            // All-in call — the biggest call you can make
            playAllIn();
            playAllInSting();
          } else if (I > 0.3) {
            // Scaled call — heavier with bigger amounts
            playCallScaled(I);
            if (I > 0.5) playBigCallSting();
          } else {
            playCall();
          }
          break;

        case 'raise':
          if (allIn) {
            // All-in raise — maximum drama
            playAllIn();
            playAllInSting();
          } else if (I > 0.2) {
            // Scaled raise — more intense with bigger bets
            playRaiseScaled(I);
            if (I > 0.5) playBigRaiseSting();
          } else {
            playRaise();
            setTimeout(() => playChipClink(), 120);
          }
          break;
      }
    }
  }, [thoughts, sfxEnabled, gameState]);

  // Game over
  useEffect(() => {
    if (isGameOver && sfxEnabled && audioUnlocked.current) {
      setTension(0);
      playBigWinSting();
      setTimeout(() => playWinFanfare(), 400);
    }
  }, [isGameOver, sfxEnabled]);

  // Music control
  useEffect(() => {
    if (!musicEnabled) stopMusic();
    else if (audioUnlocked.current) playMusic();
  }, [musicEnabled]);

  const toggleSfx = useCallback(() => setSfxEnabled(prev => !prev), []);
  const toggleMusic = useCallback(() => {
    setMusicEnabled(prev => {
      const next = !prev;
      if (!next) stopMusic();
      else if (audioUnlocked.current) playMusic();
      return next;
    });
  }, []);

  return { sfxEnabled, musicEnabled, toggleSfx, toggleMusic };
}

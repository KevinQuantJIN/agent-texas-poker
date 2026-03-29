'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerState } from '../../engine/types';
import type { BuffDisplay, PlayerReaction, HandStrengthInfo } from '../hooks/useGameSocket';
import Card from './Card';

interface PlayerSeatProps {
  player: PlayerState;
  isActive: boolean;
  isDealer: boolean;
  isWinner: boolean;
  winAmount: number;
  position: { top: string; left: string };
  buffDisplay?: BuffDisplay;
  handStrength?: HandStrengthInfo;
  reaction?: PlayerReaction;
}

// Balatro-style action badge colors with borders
const actionBadgeStyles: Record<string, { bg: string; border: string }> = {
  raise: { bg: '#e8423f', border: '#b8332f' },
  call: { bg: '#4fa4d4', border: '#3a7fa8' },
  check: { bg: '#27ae60', border: '#1e8449' },
  fold: { bg: '#4a4a6a', border: '#3d3d5a' },
};

// Speech bubble tone → style mapping
const toneStyles: Record<PlayerReaction['tone'], { bg: string; border: string; text: string }> = {
  gloat: { bg: '#2a4a2a', border: '#4ade80', text: '#4ade80' },
  tilted: { bg: '#4a2a2a', border: '#e8423f', text: '#ff6b6b' },
  respect: { bg: '#2a3a4a', border: '#4fa4d4', text: '#7dd3fc' },
  salty: { bg: '#4a3a2a', border: '#f4d03f', text: '#fbbf24' },
  chill: { bg: '#2a2a3a', border: '#8b8baa', text: '#c4c4e0' },
  devastated: { bg: '#3a2a3a', border: '#9C27B0', text: '#ce93d8' },
};

// Hand strength → color mapping for visual hierarchy
const handStrengthColor = (made: string): { bg: string; border: string; text: string } => {
  const lower = made.toLowerCase();
  if (lower.includes('royal') || lower.includes('straight flush'))
    return { bg: '#4a1a4a', border: '#d946ef', text: '#f0abfc' }; // purple — legendary
  if (lower.includes('four of a kind') || lower.includes('full house'))
    return { bg: '#4a2a1a', border: '#f97316', text: '#fdba74' }; // orange — premium
  if (lower.includes('flush') || lower.includes('straight'))
    return { bg: '#1a3a4a', border: '#06b6d4', text: '#67e8f9' }; // cyan — strong
  if (lower.includes('three of a kind') || lower.includes('two pair'))
    return { bg: '#2a3a1a', border: '#84cc16', text: '#bef264' }; // lime — decent
  if (lower.includes('pair') || lower.includes('pocket'))
    return { bg: '#2a2a3a', border: '#8b8baa', text: '#c4c4e0' }; // grey — marginal
  return { bg: '#1a1a2e', border: '#3d3d6b', text: '#6a6a8a' }; // dim — weak
};

export default function PlayerSeat({ player, isActive, isDealer, isWinner, winAmount, position, buffDisplay, handStrength, reaction }: PlayerSeatProps) {
  const isOut = player.isEliminated;
  const dimmed = isOut ? 'opacity-25' : player.isFolded ? 'opacity-50' : '';

  return (
    <motion.div
      className="absolute flex flex-col items-center gap-1"
      style={{ top: position.top, left: position.left, transform: 'translate(-50%, -50%)' }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, delay: player.seatIndex * 0.1 }}
    >
      {/* Hole cards + hand strength overlay */}
      <div className="relative flex gap-0.5 mb-0.5 h-10 sm:h-14">
        {player.holeCards.length > 0 ? (
          player.holeCards.map((card, i) => (
            <Card key={i} card={card} small delay={i * 0.15} />
          ))
        ) : isOut ? null : (
          <>
            <Card card={{ rank: 'A', suit: 'spades' }} faceDown small />
            <Card card={{ rank: 'A', suit: 'spades' }} faceDown small delay={0.1} />
          </>
        )}

        {/* Hand strength — overlaid below the cards */}
        {handStrength && handStrength.made && !isOut && !player.isFolded && player.holeCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1"
          >
            <div
              className="font-retro text-[6px] px-1.5 py-[1px] rounded-[3px] border whitespace-nowrap leading-tight"
              style={{
                background: handStrengthColor(handStrength.made).bg + 'e6',
                borderColor: handStrengthColor(handStrength.made).border,
                color: handStrengthColor(handStrength.made).text,
              }}
              title={handStrength.description}
            >
              {handStrength.made}
            </div>
            {handStrength.draws.length > 0 && (
              <div
                className="font-retro text-[5px] px-1 py-[1px] rounded-[2px] border whitespace-nowrap leading-tight"
                style={{
                  background: '#1a2a3ae6',
                  borderColor: '#2563eb',
                  color: '#60a5fa',
                }}
              >
                +draw
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Avatar — Balatro panel style */}
      <div className="relative">
        {/* Winner crown */}
        {isWinner && (
          <motion.div
            className="absolute -top-5 left-1/2 -translate-x-1/2 z-10 animate-crown-bounce"
            initial={{ scale: 0, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 10, stiffness: 300, delay: 0.1 }}
          >
            <span className="text-lg" style={{ filter: 'drop-shadow(0 0 4px rgba(244, 208, 63, 0.6))' }}>
              👑
            </span>
          </motion.div>
        )}

        {/* Winner spotlight ring */}
        {isWinner && (
          <motion.div
            className="absolute -inset-3 rounded-full winner-spotlight"
            style={{
              border: '3px solid #f4d03f',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(244, 208, 63, 0.15) 0%, transparent 70%)',
            }}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
        )}

        {/* Active ring — gold glow */}
        {isActive && !isWinner && (
          <motion.div
            className="absolute -inset-2 rounded-full balatro-active-ring"
            style={{
              border: '2px solid #f4d03f',
              borderRadius: '50%',
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        <div
          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-retro text-[7px] sm:text-[9px] text-white shadow-lg border-2 ${dimmed}`}
          style={{
            backgroundColor: player.color,
            borderColor: isWinner ? '#f4d03f' : 'rgba(0,0,0,0.3)',
            boxShadow: isWinner
              ? `0 0 20px ${player.color}80, 0 0 40px rgba(244, 208, 63, 0.4)`
              : isActive
                ? `0 0 12px ${player.color}80, 0 0 24px ${player.color}40`
                : '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          {player.name.slice(0, 2).toUpperCase()}
        </div>

        {/* Dealer button — Balatro gold chip */}
        {isDealer && (
          <div
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center font-retro text-[8px] text-[#1a1a2e] font-bold"
            style={{
              background: 'linear-gradient(180deg, #f4d03f 0%, #e6b800 100%)',
              border: '2px solid #c49b00',
              boxShadow: '0 0 6px rgba(244, 208, 63, 0.4)',
            }}
          >
            D
          </div>
        )}

        {/* BOT badge */}
        {player.isBotFallback && (
          <div
            className="absolute -bottom-1 -right-1 font-retro text-[6px] px-1.5 py-0.5 rounded text-white"
            style={{
              background: '#e8423f',
              border: '1px solid #b8332f',
            }}
          >
            BOT
          </div>
        )}
      </div>

      {/* Name + chips — Balatro panel */}
      <div
        className={`relative text-center px-1.5 sm:px-2 py-0.5 rounded-[6px] border-2 ${dimmed}`}
        style={{
          background: isWinner ? '#2a2a50' : '#232344',
          borderColor: isWinner ? '#f4d03f' : '#3d3d6b',
          boxShadow: isWinner ? '0 0 12px rgba(244, 208, 63, 0.3)' : undefined,
        }}
      >
        <div className="text-[10px] sm:text-xs font-bold leading-tight" style={{ color: '#f0e6d3' }}>
          {player.name}
        </div>
        <div
          className="font-retro text-[6px] sm:text-[8px] leading-tight"
          style={{ color: isOut ? '#e8423f' : '#f4d03f' }}
        >
          {isOut ? 'ELIMINATED' : `$${player.chips.toLocaleString()}`}
        </div>

        {/* Floating win amount badge */}
        {isWinner && winAmount > 0 && (
          <motion.div
            className="absolute -right-3 -top-3 font-retro text-[8px] px-2 py-0.5 rounded-[6px] border-2 z-10"
            style={{
              background: 'linear-gradient(180deg, #2a5a2a 0%, #1a4a1a 100%)',
              borderColor: '#27ae60',
              color: '#4ade80',
              boxShadow: '0 0 10px rgba(39, 174, 96, 0.4)',
            }}
            initial={{ scale: 0, y: 10 }}
            animate={{ scale: [0, 1.3, 1], y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
          >
            +${winAmount.toLocaleString()}
          </motion.div>
        )}
      </div>

      {/* Last action badge — Balatro pill style */}
      {player.lastAction && !isOut && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="font-retro text-[6px] sm:text-[8px] text-white uppercase px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-[6px] border-2"
          style={{
            background: actionBadgeStyles[player.lastAction.action]?.bg ?? '#4a4a6a',
            borderColor: actionBadgeStyles[player.lastAction.action]?.border ?? '#3d3d5a',
            boxShadow: `0 0 8px ${actionBadgeStyles[player.lastAction.action]?.bg ?? '#4a4a6a'}40`,
          }}
        >
          {player.lastAction.action}
          {player.lastAction.amount ? ` $${player.lastAction.amount}` : ''}
        </motion.div>
      )}

      {/* Current bet */}
      {player.currentBet > 0 && (
        <div className="font-retro text-[9px]" style={{ color: '#f4d03f' }}>
          BET: ${player.currentBet}
        </div>
      )}

      {/* Winner trash talk speech bubble */}
      <AnimatePresence>
        {reaction && (
          <motion.div
            initial={{ opacity: 0, scale: 0.3, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -5 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.4 + player.seatIndex * 0.15 }}
            className="absolute z-20 pointer-events-none"
            style={{
              bottom: '105%',
              left: '50%',
              transform: 'translateX(-50%)',
              minWidth: '80px',
              maxWidth: '150px',
            }}
          >
            <div
              className={`relative px-3 py-2 rounded-[10px] text-center ${reaction.isLlmGenerated ? 'border-[3px]' : 'border-2'}`}
              style={{
                background: reaction.isLlmGenerated ? '#1a1a2e' : toneStyles[reaction.tone].bg,
                borderColor: reaction.isLlmGenerated ? '#f4d03f' : toneStyles[reaction.tone].border,
                boxShadow: reaction.isLlmGenerated
                  ? '0 0 16px rgba(244, 208, 63, 0.5), 0 0 32px rgba(244, 208, 63, 0.2), inset 0 0 12px rgba(244, 208, 63, 0.05)'
                  : `0 0 12px ${toneStyles[reaction.tone].border}40`,
              }}
            >
              <span
                className={`${reaction.isLlmGenerated ? 'text-[11px]' : 'text-[10px]'} font-body leading-tight block`}
                style={{ color: reaction.isLlmGenerated ? '#f4d03f' : toneStyles[reaction.tone].text }}
              >
                {reaction.message}
              </span>
              {/* Speech bubble tail */}
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0"
                style={{
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: `8px solid ${reaction.isLlmGenerated ? '#f4d03f' : toneStyles[reaction.tone].border}`,
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

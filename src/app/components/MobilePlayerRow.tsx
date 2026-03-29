'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { PlayerState } from '../../engine/types';
import type { BuffDisplay, PlayerReaction, HandStrengthInfo } from '../hooks/useGameSocket';
import Card from './Card';
import { actionBadgeStyles, handStrengthColor, toneStyles } from './pokerStyles';

interface MobilePlayerRowProps {
  player: PlayerState;
  isActive: boolean;
  isDealer: boolean;
  isWinner: boolean;
  winAmount: number;
  buffDisplay?: BuffDisplay;
  handStrength?: HandStrengthInfo;
  reaction?: PlayerReaction;
}

export default function MobilePlayerRow({
  player, isActive, isDealer, isWinner, winAmount, handStrength, reaction,
}: MobilePlayerRowProps) {
  const isOut = player.isEliminated;
  const dimmed = isOut ? 'opacity-25' : player.isFolded ? 'opacity-50' : '';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: player.seatIndex * 0.05 }}
      className={`rounded-[10px] border-2 px-2.5 py-2 ${dimmed}`}
      style={{
        background: isWinner ? '#2a2a50' : isActive ? '#262650' : '#232344',
        borderColor: isWinner ? '#f4d03f' : isActive ? '#f4d03f' : '#3d3d6b',
        boxShadow: isWinner
          ? '0 0 16px rgba(244, 208, 63, 0.4)'
          : isActive
            ? '0 0 10px rgba(244, 208, 63, 0.2)'
            : 'none',
      }}
    >
      <div className="flex items-center gap-2">
        {/* Avatar */}
        <div className="relative shrink-0">
          {isWinner && (
            <motion.span
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm z-10"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              style={{ filter: 'drop-shadow(0 0 3px rgba(244, 208, 63, 0.6))' }}
            >
              👑
            </motion.span>
          )}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-retro text-[7px] text-white border-2"
            style={{
              backgroundColor: player.color,
              borderColor: isWinner ? '#f4d03f' : isActive ? '#f4d03f' : 'rgba(0,0,0,0.3)',
              boxShadow: isActive ? `0 0 8px ${player.color}80` : '0 1px 4px rgba(0,0,0,0.3)',
            }}
          >
            {player.name.slice(0, 2).toUpperCase()}
          </div>
          {isDealer && (
            <div
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center font-retro text-[6px] text-[#1a1a2e] font-bold"
              style={{
                background: 'linear-gradient(180deg, #f4d03f 0%, #e6b800 100%)',
                border: '1.5px solid #c49b00',
              }}
            >
              D
            </div>
          )}
          {player.isBotFallback && (
            <div
              className="absolute -bottom-0.5 -right-0.5 font-retro text-[5px] px-1 py-[1px] rounded text-white"
              style={{ background: '#e8423f', border: '1px solid #b8332f' }}
            >
              BOT
            </div>
          )}
        </div>

        {/* Name + chips + action */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold truncate" style={{ color: player.color }}>
              {player.name}
            </span>
            <span
              className="font-retro text-[7px] shrink-0"
              style={{ color: isOut ? '#e8423f' : '#f4d03f' }}
            >
              {isOut ? 'OUT' : `$${player.chips.toLocaleString()}`}
            </span>
            {isWinner && winAmount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: [0, 1.3, 1] }}
                className="font-retro text-[7px] shrink-0"
                style={{ color: '#4ade80' }}
              >
                +${winAmount.toLocaleString()}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {player.lastAction && !isOut && (
              <span
                className="font-retro text-[6px] text-white uppercase px-1.5 py-[2px] rounded-[4px] border"
                style={{
                  background: actionBadgeStyles[player.lastAction.action]?.bg ?? '#4a4a6a',
                  borderColor: actionBadgeStyles[player.lastAction.action]?.border ?? '#3d3d5a',
                }}
              >
                {player.lastAction.action}
                {player.lastAction.amount ? ` $${player.lastAction.amount}` : ''}
              </span>
            )}
            {player.currentBet > 0 && (
              <span className="font-retro text-[6px]" style={{ color: '#f4d03f' }}>
                BET: ${player.currentBet}
              </span>
            )}
            {isActive && !isOut && (
              <motion.span
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="font-retro text-[6px]"
                style={{ color: '#f4d03f' }}
              >
                THINKING...
              </motion.span>
            )}
          </div>
        </div>

        {/* Hole cards */}
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <div className="flex gap-0.5">
            {player.holeCards.length > 0 ? (
              player.holeCards.map((card, i) => (
                <Card key={i} card={card} small delay={i * 0.1} />
              ))
            ) : isOut ? null : (
              <>
                <Card card={{ rank: 'A', suit: 'spades' }} faceDown small />
                <Card card={{ rank: 'A', suit: 'spades' }} faceDown small delay={0.05} />
              </>
            )}
          </div>
          {/* Hand strength badge */}
          {handStrength && handStrength.made && !isOut && !player.isFolded && player.holeCards.length > 0 && (
            <div
              className="font-retro text-[5px] px-1 py-[1px] rounded-[3px] border whitespace-nowrap leading-tight"
              style={{
                background: handStrengthColor(handStrength.made).bg + 'e6',
                borderColor: handStrengthColor(handStrength.made).border,
                color: handStrengthColor(handStrength.made).text,
              }}
              title={handStrength.description}
            >
              {handStrength.made}
            </div>
          )}
        </div>
      </div>

      {/* Reaction speech bubble — inline below the row */}
      <AnimatePresence>
        {reaction && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div
              className={`mt-1.5 ml-10 px-2.5 py-1.5 rounded-[8px] ${reaction.isLlmGenerated ? 'border-2' : 'border'}`}
              style={{
                background: reaction.isLlmGenerated ? '#1a1a2e' : toneStyles[reaction.tone].bg,
                borderColor: reaction.isLlmGenerated ? '#f4d03f' : toneStyles[reaction.tone].border,
              }}
            >
              <span
                className="text-[10px] font-body leading-tight block"
                style={{ color: reaction.isLlmGenerated ? '#f4d03f' : toneStyles[reaction.tone].text }}
              >
                {reaction.message}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

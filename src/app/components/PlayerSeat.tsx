'use client';

import { motion } from 'framer-motion';
import type { PlayerState } from '../../engine/types';
import Card from './Card';

interface PlayerSeatProps {
  player: PlayerState;
  isActive: boolean;
  isDealer: boolean;
  position: { top: string; left: string };
}

const actionBadgeColors: Record<string, string> = {
  raise: 'bg-red-500',
  call: 'bg-blue-500',
  check: 'bg-green-500',
  fold: 'bg-gray-500',
};

export default function PlayerSeat({ player, isActive, isDealer, position }: PlayerSeatProps) {
  return (
    <motion.div
      className="absolute flex flex-col items-center gap-1"
      style={{ top: position.top, left: position.left, transform: 'translate(-50%, -50%)' }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, delay: player.seatIndex * 0.1 }}
    >
      {/* Hole cards */}
      <div className="flex gap-0.5 mb-1 h-14">
        {player.holeCards.length > 0 ? (
          player.holeCards.map((card, i) => (
            <Card key={i} card={card} small delay={i * 0.15} />
          ))
        ) : player.isEliminated ? null : (
          <>
            <Card card={{ rank: 'A', suit: 'spades' }} faceDown small />
            <Card card={{ rank: 'A', suit: 'spades' }} faceDown small delay={0.1} />
          </>
        )}
      </div>

      {/* Avatar */}
      <div className="relative">
        {/* Active ring */}
        {isActive && (
          <motion.div
            className="absolute -inset-1.5 rounded-full"
            style={{ border: `2px solid ${player.color}` }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}

        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg ${
            player.isEliminated ? 'opacity-30' : player.isFolded ? 'opacity-50' : ''
          }`}
          style={{ backgroundColor: player.color }}
        >
          {player.name.slice(0, 2).toUpperCase()}
        </div>

        {/* Dealer button */}
        {isDealer && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center text-[10px] font-bold text-black shadow">
            D
          </div>
        )}

        {/* BOT badge */}
        {player.isBotFallback && (
          <div className="absolute -bottom-1 -right-1 px-1 bg-red-600 rounded text-[8px] font-bold text-white">
            BOT
          </div>
        )}
      </div>

      {/* Name + chips */}
      <div className="text-center">
        <div className="text-xs font-semibold text-white">{player.name}</div>
        <div className={`text-xs ${player.isEliminated ? 'text-red-400' : 'text-gray-400'}`}>
          {player.isEliminated ? 'Eliminated' : `$${player.chips.toLocaleString()}`}
        </div>
      </div>

      {/* Last action badge */}
      {player.lastAction && !player.isEliminated && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white uppercase ${
            actionBadgeColors[player.lastAction.action]
          }`}
        >
          {player.lastAction.action}
          {player.lastAction.amount ? ` $${player.lastAction.amount}` : ''}
        </motion.div>
      )}

      {/* Current bet */}
      {player.currentBet > 0 && (
        <div className="text-[10px] text-yellow-300 font-medium">
          Bet: ${player.currentBet}
        </div>
      )}
    </motion.div>
  );
}

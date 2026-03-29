'use client';

import { motion } from 'framer-motion';
import type { GameState } from '../../engine/types';
import PlayerSeat from './PlayerSeat';
import Card from './Card';

interface PokerTableProps {
  gameState: GameState;
}

// 6 seats arranged around an elliptical table
const seatPositions = [
  { top: '78%', left: '30%' },  // seat 0 - bottom left
  { top: '78%', left: '70%' },  // seat 1 - bottom right
  { top: '45%', left: '92%' },  // seat 2 - right
  { top: '12%', left: '70%' },  // seat 3 - top right
  { top: '12%', left: '30%' },  // seat 4 - top left
  { top: '45%', left: '8%' },   // seat 5 - left
];

export default function PokerTable({ gameState }: PokerTableProps) {
  const totalPot = gameState.pots.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="relative flex-1 flex items-center justify-center p-8">
      {/* Table */}
      <div className="relative w-full max-w-3xl aspect-[16/10]">
        {/* Outer table edge */}
        <div className="absolute inset-0 rounded-[50%] bg-gradient-to-b from-[#1a3a1a] to-[#0d260d] shadow-2xl border-4 border-[#2a1a0a]" />

        {/* Felt surface */}
        <div
          className="absolute inset-3 rounded-[50%]"
          style={{
            background: 'radial-gradient(ellipse at 50% 40%, #1e5a2e 0%, #145224 40%, #0d3d1a 100%)',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.4)',
          }}
        />

        {/* Rail highlight */}
        <div
          className="absolute inset-0 rounded-[50%]"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 30%)',
          }}
        />

        {/* Center area: pot + community cards */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {/* Pot */}
          {totalPot > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-yellow-600/30"
            >
              <span className="text-yellow-400 font-bold text-sm">
                Pot: ${totalPot.toLocaleString()}
              </span>
              {gameState.pots.length > 1 && (
                <span className="text-yellow-600 text-xs ml-2">
                  ({gameState.pots.length} pots)
                </span>
              )}
            </motion.div>
          )}

          {/* Community cards */}
          <div className="flex gap-2">
            {gameState.communityCards.map((card, i) => (
              <Card key={`${card.rank}-${card.suit}`} card={card} delay={i * 0.2} />
            ))}
            {/* Empty card slots */}
            {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="w-14 h-20 rounded-lg border border-white/5"
              />
            ))}
          </div>
        </div>

        {/* Player seats */}
        {gameState.players.map((player) => (
          <PlayerSeat
            key={player.id}
            player={player}
            isActive={player.id === gameState.currentPlayerId}
            isDealer={player.seatIndex === gameState.dealerIndex}
            position={seatPositions[player.seatIndex]}
          />
        ))}
      </div>
    </div>
  );
}

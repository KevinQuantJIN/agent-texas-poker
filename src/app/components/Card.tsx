'use client';

import { motion } from 'framer-motion';
import type { Card as CardType } from '../../engine/types';

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<string, string> = {
  hearts: '#ef4444',
  diamonds: '#ef4444',
  clubs: '#1a1a2e',
  spades: '#1a1a2e',
};

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  delay?: number;
  small?: boolean;
}

export default function Card({ card, faceDown = false, delay = 0, small = false }: CardProps) {
  const w = small ? 'w-10 h-14' : 'w-14 h-20';
  const textSize = small ? 'text-xs' : 'text-sm';
  const suitSize = small ? 'text-base' : 'text-xl';

  if (faceDown) {
    return (
      <motion.div
        initial={{ rotateY: 180, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay }}
        className={`${w} rounded-lg bg-gradient-to-br from-blue-800 to-blue-950 border border-blue-600/50 shadow-lg flex items-center justify-center`}
      >
        <div className="w-3/4 h-3/4 rounded border border-blue-500/30 bg-blue-900/50" />
      </motion.div>
    );
  }

  const color = suitColors[card.suit];
  const symbol = suitSymbols[card.suit];

  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay }}
      className={`${w} rounded-lg bg-white shadow-lg flex flex-col items-center justify-between p-1 select-none`}
      style={{ perspective: 600 }}
    >
      <div className={`${textSize} font-bold self-start leading-none`} style={{ color }}>
        {card.rank}
      </div>
      <div className={`${suitSize} leading-none`} style={{ color }}>
        {symbol}
      </div>
      <div className={`${textSize} font-bold self-end leading-none rotate-180`} style={{ color }}>
        {card.rank}
      </div>
    </motion.div>
  );
}

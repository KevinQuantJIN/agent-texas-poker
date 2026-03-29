'use client';

import { useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { Card as CardType } from '../../engine/types';

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<string, string> = {
  hearts: '#e8423f',
  diamonds: '#e8423f',
  clubs: '#1a1a3a',
  spades: '#1a1a3a',
};

// Balatro-style glow colors per suit
const suitGlows: Record<string, string> = {
  hearts: 'rgba(232, 66, 63, 0.5)',
  diamonds: 'rgba(232, 66, 63, 0.5)',
  clubs: 'rgba(100, 120, 255, 0.4)',
  spades: 'rgba(100, 120, 255, 0.4)',
};

interface CardProps {
  card: CardType;
  faceDown?: boolean;
  delay?: number;
  small?: boolean;
  responsive?: boolean;
}

export default function Card({ card, faceDown = false, delay = 0, small = false, responsive = false }: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const w = responsive
    ? 'w-10 h-14 sm:w-16 sm:h-22'
    : small ? 'w-9 h-13' : 'w-16 h-22';
  const textSize = small ? 'text-sm' : 'text-base';
  const suitSize = small ? 'text-lg' : 'text-2xl';

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rotateY: x * 25, rotateX: -y * 25 });
  }, []);

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTilt({ rotateX: 0, rotateY: 0 });
  }, []);

  const tiltStyle = isHovered
    ? { transform: `perspective(600px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) scale(1.08)` }
    : { transform: 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)' };

  if (faceDown) {
    return (
      <motion.div
        ref={cardRef}
        initial={{ rotateY: 180, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay }}
        className={`${w} rounded-[10px] border-2 border-[#3d3d6b] shadow-lg flex items-center justify-center card-back-glow`}
        style={{
          ...tiltStyle,
          transition: 'transform 0.15s ease-out',
          background: 'linear-gradient(135deg, #1a3a7a 0%, #0d1f4a 100%)',
        }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="w-3/4 h-3/4 rounded-[6px] border-2 border-[#4fa4d4]/30"
          style={{
            background: 'repeating-conic-gradient(#1a3a7a 0% 25%, #0d1f4a 0% 50%) 50% / 8px 8px',
          }}
        />
      </motion.div>
    );
  }

  const color = suitColors[card.suit];
  const symbol = suitSymbols[card.suit];
  const glow = suitGlows[card.suit];

  return (
    <motion.div
      ref={cardRef}
      initial={{ rotateY: 180, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay }}
      className={`${w} rounded-[10px] border-2 border-[#2a2a4a] flex flex-col items-center justify-between p-1.5 select-none`}
      style={{
        ...tiltStyle,
        transition: 'transform 0.15s ease-out, box-shadow 0.2s ease-out',
        background: 'linear-gradient(180deg, #f5f0e1 0%, #ede4d0 100%)',
        boxShadow: isHovered
          ? `0 0 14px ${glow}, 0 0 28px ${glow}, 0 4px 16px rgba(0,0,0,0.5)`
          : '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)',
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`${textSize} font-black self-start leading-none font-retro`} style={{ color, fontSize: small ? '10px' : '13px' }}>
        {card.rank}
      </div>
      <div className={`${suitSize} leading-none`} style={{ color }}>
        {symbol}
      </div>
      <div className={`${textSize} font-black self-end leading-none rotate-180 font-retro`} style={{ color, fontSize: small ? '10px' : '13px' }}>
        {card.rank}
      </div>
    </motion.div>
  );
}

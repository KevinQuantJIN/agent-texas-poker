'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Card as CardType, Pot } from '../../engine/types';
import Card from './Card';

interface WinnerEntry {
  id: string;
  name: string;
  color: string;
  amount: number;
}

interface MobileCommunityZoneProps {
  communityCards: CardType[];
  pots: Pot[];
  round: string;
  winnerEntries: WinnerEntry[];
}

export default function MobileCommunityZone({ communityCards, pots, round, winnerEntries }: MobileCommunityZoneProps) {
  const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div
      className="mx-2 rounded-[12px] border-2 px-3 py-2"
      style={{
        background: 'linear-gradient(180deg, #1e4a2e 0%, #143820 100%)',
        borderColor: '#3d3d6b',
        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4)',
      }}
    >
      {/* Pot + Round row */}
      <div className="flex items-center justify-between mb-2">
        {totalPot > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-3 py-1 rounded-[8px] border-2 border-[#e6b800]/40 glow-gold"
            style={{ background: 'linear-gradient(180deg, #232344 0%, #1a1a2e 100%)' }}
          >
            <span className="font-retro text-[#f4d03f] text-[8px] tracking-wide">
              POT: ${totalPot.toLocaleString()}
            </span>
            {pots.length > 1 && (
              <span className="text-[#e6b800]/60 text-[8px] ml-1.5 font-body">
                ({pots.length} pots)
              </span>
            )}
          </motion.div>
        ) : (
          <div />
        )}
        <span
          className="font-retro text-[7px] uppercase px-2 py-0.5 rounded-[4px] border-2"
          style={{
            color: '#4fa4d4',
            borderColor: '#3d3d6b',
            background: '#1a1a2e',
          }}
        >
          {round}
        </span>
      </div>

      {/* Community cards */}
      <div className="flex justify-center gap-1.5">
        {communityCards.map((card, i) => (
          <Card key={`${card.rank}-${card.suit}`} card={card} delay={i * 0.15} responsive />
        ))}
        {Array.from({ length: 5 - communityCards.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-10 h-14 rounded-[8px] border-2 border-dashed border-[#3d3d6b]/40"
          />
        ))}
      </div>

      {/* Winner banner */}
      <AnimatePresence>
        {winnerEntries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', damping: 15, stiffness: 200 }}
            className="mt-2 text-center"
          >
            <div
              className="inline-block px-4 py-2 rounded-[10px] border-2 animate-banner-glow"
              style={{
                background: 'linear-gradient(180deg, #2a2a50 0%, #1a1a2e 100%)',
                borderColor: '#f4d03f',
              }}
            >
              <div className="font-retro text-[8px] shimmer-gold tracking-widest mb-1">WINNER</div>
              {winnerEntries.map((w) => (
                <div key={w.id} className="flex flex-col items-center">
                  <span
                    className="font-retro text-[10px]"
                    style={{ color: w.color, textShadow: `0 0 8px ${w.color}60` }}
                  >
                    {w.name}
                  </span>
                  <span className="font-retro text-sm shimmer-gold">
                    +${w.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

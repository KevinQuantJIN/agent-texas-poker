'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { GameState } from '../../engine/types';
import type { HandResult, BuffDisplay, HandStrengthInfo } from '../hooks/useGameSocket';
import PlayerSeat from './PlayerSeat';
import MobilePlayerRow from './MobilePlayerRow';
import MobileCommunityZone from './MobileCommunityZone';
import Card from './Card';

interface PokerTableProps {
  gameState: GameState;
  handResult: HandResult | null;
  playerBuffs: Record<string, BuffDisplay>;
  handStrengths: Record<string, HandStrengthInfo>;
}

// 6 seats arranged around the table — pushed outside the ellipse
const seatPositions = [
  { top: '88%', left: '25%' },  // seat 0 - bottom left
  { top: '88%', left: '75%' },  // seat 1 - bottom right
  { top: '45%', left: '97%' },  // seat 2 - right
  { top: '2%',  left: '75%' },  // seat 3 - top right
  { top: '2%',  left: '25%' },  // seat 4 - top left
  { top: '45%', left: '3%' },   // seat 5 - left
];

export default function PokerTable({ gameState, handResult, playerBuffs, handStrengths }: PokerTableProps) {
  const totalPot = gameState.pots.reduce((sum, p) => sum + p.amount, 0);

  // Build winner display info
  const winnerEntries = handResult
    ? Object.entries(handResult.winners).map(([id, amount]) => {
        const player = gameState.players.find(p => p.id === id);
        return { id, name: player?.name ?? id, color: player?.color ?? '#f4d03f', amount };
      })
    : [];

  // Set of winner IDs for highlighting player seats
  const winnerIds = new Set(winnerEntries.map(w => w.id));

  return (
    <div className="relative flex-1 flex items-center justify-center p-2 sm:p-4">
      {/* ========== Desktop layout — elliptical table ========== */}
      <div className="hidden lg:block relative w-full max-w-2xl aspect-[16/10]" style={{ overflow: 'visible' }}>
        {/* Outer table edge — dark wood rim */}
        <div
          className="absolute inset-0 rounded-[50%] shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, #2a1a0a 0%, #1a1008 100%)',
            border: '4px solid #3a2510',
            boxShadow: '0 0 40px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.3)',
          }}
        />

        {/* Felt surface — Balatro desaturated green */}
        <div
          className="absolute inset-3 rounded-[50%]"
          style={{
            background: 'radial-gradient(ellipse at 50% 40%, #2a5a3a 0%, #1e4a2e 40%, #143820 100%)',
            boxShadow: 'inset 0 0 80px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.3)',
          }}
        />

        {/* Felt texture noise overlay */}
        <div
          className="absolute inset-3 rounded-[50%] opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '128px 128px',
          }}
        />

        {/* Rail highlight — subtle top light */}
        <div
          className="absolute inset-0 rounded-[50%]"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 25%)',
          }}
        />

        {/* Center area: pot + community cards */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          {/* Pot display — Balatro badge style */}
          {totalPot > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-5 py-2 rounded-[10px] border-2 border-[#e6b800]/40 glow-gold"
              style={{
                background: 'linear-gradient(180deg, #232344 0%, #1a1a2e 100%)',
              }}
            >
              <span className="font-retro text-[#f4d03f] text-xs tracking-wide">
                POT: ${totalPot.toLocaleString()}
              </span>
              {gameState.pots.length > 1 && (
                <span className="text-[#e6b800]/60 text-xs ml-2 font-body">
                  ({gameState.pots.length} pots)
                </span>
              )}
            </motion.div>
          )}

          {/* Community cards */}
          <div className="flex gap-2.5">
            {gameState.communityCards.map((card, i) => (
              <Card key={`${card.rank}-${card.suit}`} card={card} delay={i * 0.2} />
            ))}
            {/* Empty card slots — Balatro-style dashed borders */}
            {Array.from({ length: 5 - gameState.communityCards.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="w-16 h-22 rounded-[10px] border-2 border-dashed border-[#3d3d6b]/40"
              />
            ))}
          </div>
        </div>

        {/* Hand winner banner — dramatic Balatro style */}
        <AnimatePresence>
          {winnerEntries.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.3, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -20 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="absolute left-1/2 -translate-x-1/2 z-30"
              style={{ top: '58%' }}
            >
              {/* Chip rain particles */}
              <div className="absolute inset-0 pointer-events-none overflow-visible">
                {Array.from({ length: 8 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute font-retro text-[10px]"
                    style={{
                      left: `${10 + i * 12}%`,
                      top: '-10px',
                      color: i % 2 === 0 ? '#f4d03f' : '#e6b800',
                    }}
                    initial={{ y: 0, opacity: 1, rotate: 0 }}
                    animate={{
                      y: [0, -20, 60],
                      opacity: [0, 1, 0],
                      rotate: [0, 180, 720],
                    }}
                    transition={{
                      duration: 2,
                      delay: 0.3 + i * 0.15,
                      ease: 'easeOut',
                    }}
                  >
                    $
                  </motion.div>
                ))}
              </div>

              <div
                className="relative px-8 py-4 rounded-[14px] border-3 animate-banner-glow"
                style={{
                  background: 'linear-gradient(180deg, #2a2a50 0%, #1a1a2e 50%, #151530 100%)',
                  borderWidth: '3px',
                  borderStyle: 'solid',
                  borderColor: '#f4d03f',
                }}
              >
                {/* Trophy / crown header */}
                <motion.div
                  className="text-center mb-2"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.3, 1] }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  <span className="font-retro text-[10px] shimmer-gold tracking-widest">
                    WINNER
                  </span>
                </motion.div>

                {winnerEntries.map((w) => (
                  <motion.div
                    key={w.id}
                    className="flex flex-col items-center gap-1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <span
                      className="font-retro text-sm tracking-wide"
                      style={{ color: w.color, textShadow: `0 0 10px ${w.color}60` }}
                    >
                      {w.name}
                    </span>
                    <motion.span
                      className="font-retro text-lg shimmer-gold"
                      initial={{ scale: 0.5 }}
                      animate={{ scale: [0.5, 1.15, 1] }}
                      transition={{ delay: 0.5, duration: 0.4 }}
                    >
                      +${w.amount.toLocaleString()}
                    </motion.span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player seats */}
        {gameState.players.map((player) => (
          <PlayerSeat
            key={player.id}
            player={player}
            isActive={player.id === gameState.currentPlayerId}
            isDealer={player.seatIndex === gameState.dealerIndex}
            isWinner={winnerIds.has(player.id)}
            winAmount={handResult?.winners[player.id] ?? 0}
            position={seatPositions[player.seatIndex]}
            buffDisplay={playerBuffs[player.id]}
            handStrength={handStrengths[player.id]}
            reaction={handResult?.reactions?.find(r => r.playerId === player.id)}
          />
        ))}
      </div>

      {/* ========== Mobile layout — vertical list ========== */}
      <div className="flex lg:hidden flex-col w-full h-full gap-2">
        <MobileCommunityZone
          communityCards={gameState.communityCards}
          pots={gameState.pots}
          round={gameState.round}
          winnerEntries={winnerEntries}
        />
        <div className="flex-1 overflow-y-auto px-2 space-y-1.5 balatro-scroll pb-1">
          {gameState.players.map((player) => (
            <MobilePlayerRow
              key={player.id}
              player={player}
              isActive={player.id === gameState.currentPlayerId}
              isDealer={player.seatIndex === gameState.dealerIndex}
              isWinner={winnerIds.has(player.id)}
              winAmount={handResult?.winners[player.id] ?? 0}
              buffDisplay={playerBuffs[player.id]}
              handStrength={handStrengths[player.id]}
              reaction={handResult?.reactions?.find(r => r.playerId === player.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

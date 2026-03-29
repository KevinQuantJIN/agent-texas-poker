'use client';

import { useState } from 'react';
import PokerTable from './components/PokerTable';
import ReasoningSidebar from './components/ReasoningSidebar';
import SpeedControls from './components/SpeedControls';
import ConnectionStatus from './components/ConnectionStatus';
import BalatroBackground from './components/BalatroBackground';
import CRTOverlay from './components/CRTOverlay';
import { useGameSocket } from './hooks/useGameSocket';
import { useGameAudio } from './hooks/useGameAudio';

export default function Home() {
  const {
    gameState,
    thoughts,
    connectionStatus,
    isGameActive,
    isGameOver,
    gameOverData,
    handResult,
    playerBuffs,
    handStrengths,
    setSpeed,
    startGame,
  } = useGameSocket();

  const { sfxEnabled, musicEnabled, toggleSfx, toggleMusic } = useGameAudio(
    gameState,
    thoughts,
    isGameOver,
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-dvh flex flex-col overflow-hidden relative">
      {/* Balatro psychedelic background */}
      <BalatroBackground />

      {/* CRT scanline overlay */}
      <CRTOverlay />

      {/* Header — Balatro panel bar */}
      <header
        className="relative z-10 flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2.5 border-b-2"
        style={{
          background: '#232344',
          borderColor: '#3d3d6b',
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="font-retro text-[8px] sm:text-xs tracking-tight" style={{ color: '#f4d03f' }}>
            Agent Texas Poker
          </h1>
          <span
            className="font-retro text-[6px] sm:text-[7px] px-1.5 sm:px-2 py-0.5 rounded-[4px] border-2 hidden sm:inline"
            style={{
              color: '#9b59b6',
              borderColor: '#3d3d6b',
              background: '#1a1a2e',
            }}
          >
            AI VS AI
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Audio controls — Balatro toggle buttons */}
          <button
            onClick={toggleSfx}
            className="font-retro text-[7px] sm:text-[8px] px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-[6px] border-2 transition-colors"
            style={{
              background: sfxEnabled ? '#27ae60' : '#1a1a2e',
              borderColor: sfxEnabled ? '#1e8449' : '#3d3d6b',
              color: sfxEnabled ? '#f0e6d3' : '#4a4a6a',
              boxShadow: sfxEnabled ? '0 0 8px rgba(39, 174, 96, 0.3)' : 'none',
            }}
            title={sfxEnabled ? 'Mute SFX' : 'Unmute SFX'}
          >
            SFX
          </button>
          <button
            onClick={toggleMusic}
            className="font-retro text-[7px] sm:text-[8px] px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-[6px] border-2 transition-colors"
            style={{
              background: musicEnabled ? '#27ae60' : '#1a1a2e',
              borderColor: musicEnabled ? '#1e8449' : '#3d3d6b',
              color: musicEnabled ? '#f0e6d3' : '#4a4a6a',
              boxShadow: musicEnabled ? '0 0 8px rgba(39, 174, 96, 0.3)' : 'none',
            }}
            title={musicEnabled ? 'Mute Music' : 'Unmute Music'}
          >
            BGM
          </button>
          {/* Mobile chat toggle */}
          {gameState && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden font-retro text-[7px] sm:text-[8px] px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-[6px] border-2 transition-colors relative"
              style={{
                background: sidebarOpen ? '#4fa4d4' : '#1a1a2e',
                borderColor: sidebarOpen ? '#3a7fa8' : '#3d3d6b',
                color: sidebarOpen ? '#f0e6d3' : '#4a4a6a',
              }}
            >
              CHAT
              {thoughts.length > 0 && !sidebarOpen && (
                <span
                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                  style={{ background: '#e8423f' }}
                />
              )}
            </button>
          )}
          <ConnectionStatus status={connectionStatus} />
        </div>
      </header>

      {/* Main content */}
      <div className="relative z-10 flex-1 flex min-h-0">
        {gameState ? (
          <>
            <PokerTable gameState={gameState} handResult={handResult} playerBuffs={playerBuffs} handStrengths={handStrengths} />
            {/* Desktop sidebar */}
            <div className="hidden lg:block w-80 h-full">
              <ReasoningSidebar thoughts={thoughts} />
            </div>
            {/* Mobile sidebar overlay */}
            {sidebarOpen && (
              <div className="lg:hidden absolute inset-0 z-40 flex">
                <div
                  className="absolute inset-0 bg-black/50"
                  onClick={() => setSidebarOpen(false)}
                />
                <div className="relative ml-auto w-80 max-w-[85vw] h-full">
                  <ReasoningSidebar thoughts={thoughts} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="text-center">
              <h2
                className="font-retro text-base sm:text-2xl mb-3"
                style={{
                  color: '#f4d03f',
                  textShadow: '0 0 20px rgba(244, 208, 63, 0.4), 0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                Agent Texas Poker
              </h2>
              <p className="text-sm sm:text-lg mb-6 sm:mb-8" style={{ color: '#8888aa' }}>
                Watch AI agents play Texas Hold&apos;em against each other
              </p>
              <button
                onClick={startGame}
                disabled={connectionStatus !== 'connected'}
                className="balatro-btn balatro-btn-green disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  fontSize: '12px',
                  padding: '12px 28px',
                }}
              >
                {connectionStatus === 'connected' ? 'Start Game' : 'Connecting...'}
              </button>
              {connectionStatus === 'disconnected' && (
                <p className="mt-4 font-retro text-[8px] sm:text-[9px]" style={{ color: '#e8423f' }}>
                  Cannot connect to game server. Is it running on port 3001?
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Game over overlay */}
      {isGameOver && gameOverData && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div
            className="rounded-[16px] p-5 sm:p-8 text-center border-2 max-w-sm w-full"
            style={{
              background: 'linear-gradient(180deg, #232344 0%, #1a1a2e 100%)',
              borderColor: '#f4d03f',
              boxShadow: '0 0 40px rgba(244, 208, 63, 0.2), 0 0 80px rgba(0,0,0,0.5)',
            }}
          >
            <h2
              className="font-retro text-base sm:text-xl mb-3"
              style={{
                color: '#f4d03f',
                textShadow: '0 0 16px rgba(244, 208, 63, 0.4)',
              }}
            >
              Game Over
            </h2>
            <p className="text-base sm:text-xl mb-1" style={{ color: '#f0e6d3' }}>
              {gameOverData.winner?.name} wins!
            </p>
            <p className="font-retro text-xs sm:text-sm" style={{ color: '#27ae60' }}>
              ${gameOverData.winner?.chips?.toLocaleString()} chips
            </p>
            <button
              onClick={startGame}
              className="balatro-btn balatro-btn-green mt-6"
            >
              New Game
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      {gameState && (
        <div className="relative z-10">
          <SpeedControls
            handNumber={gameState.handNumber}
            round={gameState.round}
            onSpeedChange={setSpeed}
          />
        </div>
      )}
    </div>
  );
}

'use client';

import PokerTable from './components/PokerTable';
import ReasoningSidebar from './components/ReasoningSidebar';
import SpeedControls from './components/SpeedControls';
import ConnectionStatus from './components/ConnectionStatus';
import { useGameSocket } from './hooks/useGameSocket';

export default function Home() {
  const {
    gameState,
    thoughts,
    connectionStatus,
    isGameActive,
    isGameOver,
    gameOverData,
    setSpeed,
    startGame,
  } = useGameSocket();

  return (
    <div className="h-screen flex flex-col overflow-hidden relative">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-[#0d1220]">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-bold text-white tracking-tight">
            Agent Texas Poker
          </h1>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">
            AI vs AI
          </span>
        </div>
        <ConnectionStatus status={connectionStatus} />
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {gameState ? (
          <>
            <PokerTable gameState={gameState} />
            <ReasoningSidebar thoughts={thoughts} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-2">Agent Texas Poker</h2>
              <p className="text-gray-400 mb-8">Watch AI agents play Texas Hold&apos;em against each other</p>
              <button
                onClick={startGame}
                disabled={connectionStatus !== 'connected'}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-semibold text-lg transition-colors"
              >
                {connectionStatus === 'connected' ? 'Start Game' : 'Connecting...'}
              </button>
              {connectionStatus === 'disconnected' && (
                <p className="mt-3 text-xs text-red-400">
                  Cannot connect to game server. Is it running on port 3001?
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Game over overlay */}
      {isGameOver && gameOverData && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-[#141a2a] rounded-xl p-8 text-center border border-gray-700">
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">Game Over</h2>
            <p className="text-lg text-white mb-1">
              {gameOverData.winner?.name} wins!
            </p>
            <p className="text-sm text-gray-400">
              ${gameOverData.winner?.chips?.toLocaleString()} chips
            </p>
            <button
              onClick={startGame}
              className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              New Game
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      {gameState && (
        <SpeedControls
          handNumber={gameState.handNumber}
          round={gameState.round}
          onSpeedChange={setSpeed}
        />
      )}
    </div>
  );
}

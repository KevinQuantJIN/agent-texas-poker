'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameState, AgentThought } from '../../engine/types';
import { mockGameState, mockThoughts } from '../mock-data';

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

interface GameSocketState {
  gameState: GameState | null;
  thoughts: AgentThought[];
  connectionStatus: ConnectionStatus;
  isGameActive: boolean;
  isGameOver: boolean;
  gameOverData: any | null;
  setSpeed: (speed: number) => void;
  startGame: () => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001';
const RECONNECT_DELAY = 2000;

export function useGameSocket(): GameSocketState {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverData, setGameOverData] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = process.env.NEXT_PUBLIC_DEMO_TOKEN ?? '';
    const url = token ? `${WS_URL}?token=${token}` : WS_URL;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      setConnectionStatus('reconnecting');

      ws.onopen = () => {
        setConnectionStatus('connected');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg);
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        setConnectionStatus('disconnected');
        wsRef.current = null;
        // Auto-reconnect
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onerror = () => {
        // onclose will fire after this
      };
    } catch {
      setConnectionStatus('disconnected');
      reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
    }
  }, []);

  const handleMessage = useCallback((msg: { event: string; data: any }) => {
    switch (msg.event) {
      case 'gameState':
        setGameState(msg.data);
        setIsGameActive(true);
        setIsGameOver(false);
        break;

      case 'action':
        if (msg.data.gameState) {
          setGameState(msg.data.gameState);
        }
        // Add thought to sidebar
        const thought: AgentThought = {
          playerId: msg.data.player.id,
          playerName: msg.data.player.name,
          reasoning: msg.data.reasoning,
          action: msg.data.action,
          handNumber: msg.data.gameState?.handNumber ?? 0,
          round: msg.data.gameState?.round ?? '',
          timestamp: Date.now(),
        };
        setThoughts(prev => [...prev.slice(-19), thought]);
        break;

      case 'handStart':
        setIsGameActive(true);
        setIsGameOver(false);
        break;

      case 'handEnd':
        // Could show showdown animation
        break;

      case 'roundChange':
        // GameState update will come with next action
        break;

      case 'gameOver':
        setIsGameActive(false);
        setIsGameOver(true);
        setGameOverData(msg.data);
        break;

      case 'reasoningBuffer':
        if (Array.isArray(msg.data)) {
          setThoughts(msg.data);
        }
        break;

      case 'speedChange':
        // Speed is managed server-side, no local state needed
        break;
    }
  }, []);

  const setSpeed = useCallback((speed: number) => {
    wsRef.current?.send(JSON.stringify({ event: 'setSpeed', data: { speed } }));
  }, []);

  const startGame = useCallback(() => {
    setIsGameOver(false);
    setGameOverData(null);
    setThoughts([]);
    wsRef.current?.send(JSON.stringify({ event: 'startGame', data: {} }));
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return {
    gameState,
    thoughts,
    connectionStatus,
    isGameActive,
    isGameOver,
    gameOverData,
    setSpeed,
    startGame,
  };
}

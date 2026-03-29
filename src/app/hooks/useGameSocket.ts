'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { GameState, AgentThought, Card } from '../../engine/types';

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface HandStrengthInfo {
  made: string;
  draws: string[];
  description: string;
}

export interface PlayerReaction {
  playerId: string;
  message: string;
  tone: 'gloat' | 'tilted' | 'respect' | 'salty' | 'chill' | 'devastated';
  isLlmGenerated?: boolean;
}

export interface HandResult {
  winners: Record<string, number>; // playerId → chips won
  showdownHands: Record<string, Card[]>; // playerId → hole cards
  reactions: PlayerReaction[];
}

export interface BuffDisplay {
  sessionTraits: Array<{ name: string; emoji: string; description: string }>;
  currentBuff: { name: string; emoji: string; description: string } | null;
}

interface GameSocketState {
  gameState: GameState | null;
  thoughts: AgentThought[];
  connectionStatus: ConnectionStatus;
  isGameActive: boolean;
  isGameOver: boolean;
  gameOverData: any | null;
  handResult: HandResult | null;
  playerBuffs: Record<string, BuffDisplay>;
  handStrengths: Record<string, HandStrengthInfo>;
  setSpeed: (speed: number) => void;
  startGame: () => void;
}

function getWsUrl(): string {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  if (typeof window === 'undefined') return 'ws://localhost:3001';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // In production, WS is on /ws path via same host; in dev, separate port
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${proto}//${window.location.host}/ws`;
  }
  return `ws://${window.location.hostname}:3001`;
}
const WS_URL = getWsUrl();
const RECONNECT_DELAY = 2000;

export function useGameSocket(): GameSocketState {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [gameOverData, setGameOverData] = useState<any>(null);
  const [handResult, setHandResult] = useState<HandResult | null>(null);
  const [playerBuffs, setPlayerBuffs] = useState<Record<string, BuffDisplay>>({});
  const [handStrengths, setHandStrengths] = useState<Record<string, HandStrengthInfo>>({});

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
          color: msg.data.player.color ?? '#666',
          reasoning: msg.data.reasoning,
          action: msg.data.action,
          handNumber: msg.data.gameState?.handNumber ?? 0,
          round: msg.data.gameState?.round ?? '',
          timestamp: msg.data.action.timestamp ?? Date.now(),
        };
        // Deduplicate by playerId + handNumber + round + action
        setThoughts(prev => {
          const isDup = prev.some(t =>
            t.playerId === thought.playerId &&
            t.handNumber === thought.handNumber &&
            t.round === thought.round &&
            t.action.action === thought.action.action &&
            t.reasoning === thought.reasoning
          );
          if (isDup) return prev;
          return [...prev.slice(-19), thought];
        });
        break;

      case 'handStart':
        setIsGameActive(true);
        setIsGameOver(false);
        setHandResult(null);
        setHandStrengths({});
        // Capture buff data from hand start event
        if (msg.data.buffs) {
          setPlayerBuffs(msg.data.buffs);
        }
        break;

      case 'handStrengths':
        setHandStrengths(msg.data ?? {});
        break;

      case 'handEnd':
        setHandResult({
          winners: msg.data.winners,
          showdownHands: msg.data.showdownHands ?? {},
          reactions: msg.data.reactions ?? [],
        });
        break;

      case 'roundChange':
        if (msg.data.gameState) {
          setGameState(msg.data.gameState);
        }
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
    setHandResult(null);
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
    handResult,
    playerBuffs,
    handStrengths,
    setSpeed,
    startGame,
  };
}

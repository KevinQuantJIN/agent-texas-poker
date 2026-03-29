import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { StateManager } from './state-manager';

export interface WSEvent {
  event: string;
  data: any;
}

/**
 * Manages WebSocket connections for spectator broadcast.
 */
export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private stateManager: StateManager;
  private demoToken: string;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(server: Server, stateManager: StateManager, demoToken: string) {
    this.stateManager = stateManager;
    this.demoToken = demoToken;

    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    // Token auth via query parameter
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (this.demoToken && token !== this.demoToken) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    this.clients.add(ws);

    // Send current game state on connect
    const gameState = this.stateManager.getGameState();
    if (gameState) {
      this.send(ws, { event: 'gameState', data: gameState });
    }

    // Send reasoning buffer for context
    const buffer = this.stateManager.getReasoningBuffer();
    if (buffer.length > 0) {
      this.send(ws, { event: 'reasoningBuffer', data: buffer });
    }

    // Handle client messages
    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        this.handleClientMessage(ws, msg);
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
    });

    ws.on('error', () => {
      this.clients.delete(ws);
    });
  }

  private handleClientMessage(ws: WebSocket, msg: any): void {
    if (msg.event === 'setSpeed' && msg.data?.speed) {
      this.stateManager.setSpeed(msg.data.speed);
      // Broadcast speed change to all clients
      this.broadcast({ event: 'speedChange', data: { speed: this.stateManager.getSpeed() } });
    }

    if (msg.event === 'startGame') {
      // Emit event for the server to handle
      this.onStartGame?.();
    }
  }

  /** Callback set by the server when a startGame message is received. */
  onStartGame: (() => void) | null = null;

  /** Send a message to a single client. */
  private send(ws: WebSocket, event: WSEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  /** Broadcast a message to all connected clients. */
  broadcast(event: WSEvent): void {
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  /** Start heartbeat ping/pong (every 5s, 10s timeout). */
  startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        }
      }
    }, 5000);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }

  close(): void {
    this.stopHeartbeat();
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    this.wss.close();
  }
}

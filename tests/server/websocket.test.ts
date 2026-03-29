import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { WebSocket } from 'ws';
import { WebSocketManager } from '@/server/websocket';
import { StateManager } from '@/server/state-manager';
import type { GameState } from '@/engine/types';

function createTestServer(token: string = '') {
  const server = http.createServer();
  const stateManager = new StateManager();
  const wsManager = new WebSocketManager(server, stateManager, token);

  return new Promise<{
    server: http.Server;
    stateManager: StateManager;
    wsManager: WebSocketManager;
    port: number;
  }>((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as { port: number };
      resolve({ server, stateManager, wsManager, port: addr.port });
    });
  });
}

function connectClient(port: number, token?: string): Promise<WebSocket> {
  const url = token
    ? `ws://localhost:${port}?token=${token}`
    : `ws://localhost:${port}`;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<any> {
  return new Promise((resolve) => {
    ws.once('message', (data) => {
      resolve(JSON.parse(data.toString()));
    });
  });
}

describe('WebSocketManager', () => {
  let server: http.Server;
  let stateManager: StateManager;
  let wsManager: WebSocketManager;
  let port: number;
  let clients: WebSocket[] = [];

  afterEach(() => {
    for (const c of clients) c.close();
    clients = [];
    wsManager?.close();
    server?.close();
  });

  it('accepts connections without token when no token set', async () => {
    ({ server, stateManager, wsManager, port } = await createTestServer(''));
    const ws = await connectClient(port);
    clients.push(ws);
    expect(wsManager.getClientCount()).toBe(1);
  });

  it('rejects connections with wrong token', async () => {
    ({ server, stateManager, wsManager, port } = await createTestServer('secret'));
    const ws = new WebSocket(`ws://localhost:${port}?token=wrong`);
    await new Promise<void>((resolve) => {
      ws.on('close', (code) => {
        expect(code).toBe(4001);
        resolve();
      });
    });
  });

  it('accepts connections with correct token', async () => {
    ({ server, stateManager, wsManager, port } = await createTestServer('secret'));
    const ws = await connectClient(port, 'secret');
    clients.push(ws);
    expect(wsManager.getClientCount()).toBe(1);
  });

  it('sends game state on connect', async () => {
    ({ server, stateManager, wsManager, port } = await createTestServer(''));
    const gs = { handNumber: 5, round: 'flop' } as GameState;
    stateManager.setGameState(gs);

    // Collect all messages from connection (state arrives before 'open' resolves)
    const messages: any[] = [];
    const url = `ws://localhost:${port}`;
    const ws = new WebSocket(url);
    ws.on('message', (data) => messages.push(JSON.parse(data.toString())));
    await new Promise<void>((resolve) => ws.on('open', resolve));
    clients.push(ws);

    // Give a moment for the message sent on connection to arrive
    await new Promise(r => setTimeout(r, 50));
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].event).toBe('gameState');
    expect(messages[0].data.handNumber).toBe(5);
  });

  it('broadcasts events to all clients', async () => {
    ({ server, stateManager, wsManager, port } = await createTestServer(''));
    const ws1 = await connectClient(port);
    const ws2 = await connectClient(port);
    clients.push(ws1, ws2);

    const p1 = waitForMessage(ws1);
    const p2 = waitForMessage(ws2);

    wsManager.broadcast({ event: 'test', data: { hello: 'world' } });

    const [m1, m2] = await Promise.all([p1, p2]);
    expect(m1.event).toBe('test');
    expect(m2.event).toBe('test');
  });

  it('handles speed change from client', async () => {
    ({ server, stateManager, wsManager, port } = await createTestServer(''));
    const ws = await connectClient(port);
    clients.push(ws);

    // Wait a tick for connection to be fully set up
    await new Promise(r => setTimeout(r, 50));

    ws.send(JSON.stringify({ event: 'setSpeed', data: { speed: 2 } }));

    // Wait for message processing
    await new Promise(r => setTimeout(r, 50));
    expect(stateManager.getSpeed()).toBe(2);
  });

  it('removes disconnected clients', async () => {
    ({ server, stateManager, wsManager, port } = await createTestServer(''));
    const ws = await connectClient(port);
    expect(wsManager.getClientCount()).toBe(1);

    ws.close();
    await new Promise(r => setTimeout(r, 50));
    expect(wsManager.getClientCount()).toBe(0);
  });
});

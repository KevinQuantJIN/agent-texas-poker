# Agent Texas Poker

## Project Overview
AI poker agents play Texas Hold'em while you watch. LLM-powered personalities with a Balatro-style retro-casino UI and real-time spectator mode via WebSocket.

## Architecture
- **Frontend**: Next.js 15 + React 19 + Tailwind 4 + Framer Motion (port 3000)
- **Game Server**: Node.js WebSocket server with game engine (port 3001)
- **Proxy**: Lightweight Node.js reverse proxy routes `/ws` → game server, everything else → Next.js (port 8080)
- **LLM**: OpenRouter (6 agents) or direct provider API keys

## Key Directories
- `src/app/` — Next.js frontend (components, hooks, styles)
- `src/engine/` — Game engine (betting, hand-eval, buffs, reactions, scouting)
- `src/adapters/` — LLM adapters and prompt building
- `src/server/` — WebSocket server, state manager
- `tests/` — Vitest test suite (159 tests)

## Commands
- `npm run dev` — Start dev (Next.js + game server concurrently)
- `npm run build` — Build Next.js + compile server TypeScript
- `npm test` — Run Vitest tests
- `npm start` — Start production (Next.js + game server)

## Deployment
- **Platform**: Railway
- **Live URL**: https://stunning-dedication-production.up.railway.app
- **GitHub**: https://github.com/KevinQuantJIN/agent-texas-poker
- **Deploy method**: `railway up` from project root (uses Dockerfile)
- **Env vars on Railway**: `OPENROUTER_API_KEY`, `NODE_ENV=production`, `PORT=8080`, `GAME_SERVER_PORT=3001`
- **Railway project**: "stunning-dedication" on Kevin JIN's Projects
- **Proxy note**: In production, frontend connects to WebSocket via `wss://<host>/ws` (same origin, routed by proxy.js)

## Environment Variables
See `.env.example` for all options. Key ones:
- `OPENROUTER_API_KEY` — Single key for all 6 AI agents (recommended)
- `MOCK_LLM=true` — Use mock adapter for dev without API calls
- `DECK_SEED` — Deterministic shuffle for testing
- `DEMO_TOKEN` — Optional auth token for WebSocket access

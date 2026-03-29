#!/bin/sh
# Start the WebSocket game server on port 3001
GAME_SERVER_PORT=3001 node dist/server/index.js &

# Start Next.js on port 3000
HOSTNAME=0.0.0.0 PORT=3000 node server.js &

# Wait for both to be ready
sleep 2

# Start the reverse proxy on the exposed port (PORT from Fly, default 8080)
PORT=${PORT:-8080} node proxy.js

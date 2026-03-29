// Lightweight reverse proxy: routes /ws to the game server, everything else to Next.js
const http = require('http');
const net = require('net');

const PORT = parseInt(process.env.PORT || '8080', 10);
const NEXT_PORT = 3000;
const WS_PORT = 3001;

const server = http.createServer((req, res) => {
  const target = req.url?.startsWith('/ws') ? WS_PORT : NEXT_PORT;
  const proxyReq = http.request(
    { hostname: '127.0.0.1', port: target, path: req.url, method: req.method, headers: req.headers },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );
  proxyReq.on('error', () => { res.writeHead(502); res.end('Bad Gateway'); });
  req.pipe(proxyReq);
});

// Handle WebSocket upgrades
server.on('upgrade', (req, socket, head) => {
  const targetPort = req.url?.startsWith('/ws') ? WS_PORT : NEXT_PORT;
  const conn = net.connect(targetPort, '127.0.0.1', () => {
    const reqLine = `${req.method} ${req.url} HTTP/1.1\r\n`;
    const headers = Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n');
    conn.write(reqLine + headers + '\r\n\r\n');
    if (head.length) conn.write(head);
    socket.pipe(conn);
    conn.pipe(socket);
  });
  conn.on('error', () => socket.destroy());
  socket.on('error', () => conn.destroy());
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`> Proxy listening on port ${PORT}`);
});

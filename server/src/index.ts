import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ServerMsg } from '../../shared/protocol.ts';
import { RoomManager, type Conn } from './rooms.ts';

/**
 * Bloody-Gambit-Server: WebSocket-Räume im Speicher, prüft jeden Zug autoritativ.
 * Keine Konten, keine Nutzerdaten, keine Logs mit Inhalten.
 */
const port = Number(process.env.PORT ?? 8790);
const manager = new RoomManager();

const http = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: manager.rooms.size }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: http, maxPayload: 4096 });
const conns = new Map<WebSocket, Conn & { alive: boolean }>();

wss.on('connection', (ws) => {
  const conn = {
    alive: true,
    send(msg: ServerMsg) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
    },
  };
  conns.set(ws, conn);
  ws.on('pong', () => (conn.alive = true));
  ws.on('message', (data) => {
    let msg: unknown;
    try {
      msg = JSON.parse(String(data));
    } catch {
      conn.send({ t: 'error', code: 'bad-request', msg: 'Kein JSON' });
      return;
    }
    manager.receive(conn, msg);
  });
  ws.on('close', () => {
    manager.close(conn);
    conns.delete(ws);
  });
  ws.on('error', () => ws.terminate());
});

// Uhren und Abwesenheit prüfen
setInterval(() => manager.tick(), 250);
// Tote Verbindungen erkennen
setInterval(() => {
  for (const [ws, c] of conns) {
    if (!c.alive) {
      ws.terminate();
      continue;
    }
    c.alive = false;
    ws.ping();
  }
}, 15_000);

http.listen(port, () => console.log(`Bloody-Gambit-Server auf Port ${port}`));

for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => process.exit(0));

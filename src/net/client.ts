import type { ClientMsg, RoomState, ServerMsg } from '../../shared/protocol.ts';
import type { Color } from '../../shared/rules.ts';
import { SERVER_PORT } from '../config.ts';

export interface NetEvents {
  welcome?(code: string, color: Color): void;
  state?(s: RoomState): void;
  error?(code: string, msg: string): void;
  connection?(status: 'connecting' | 'open' | 'lost'): void;
}

const SESSION_KEY = 'bloodygambit.online.v1';

/** Server-Adresse: ?server=..., VITE_SERVER_URL oder gleicher Rechner auf Port 8790. */
export function serverUrl(): string {
  const q = new URLSearchParams(location.search).get('server');
  if (q) return q;
  const env = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SERVER_URL;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname || 'localhost'}:${SERVER_PORT}`;
}

/**
 * Gibt es einen Raumserver? Ein Bau ohne Server (VITE_ONLINE=off, z. B. die statische Seite auf GitHub Pages)
 * bietet Online nur an, wenn die Adresse per ?server=... mitkommt.
 */
export function onlineAvailable(): boolean {
  const env = (import.meta as unknown as { env?: Record<string, string> }).env ?? {};
  return env.VITE_ONLINE !== 'off' || !!env.VITE_SERVER_URL || new URLSearchParams(location.search).has('server');
}

/**
 * WebSocket-Verbindung zum Raumserver mit automatischem Wiederverbinden.
 * Raumcode und Platz-Token liegen nur im sessionStorage dieses Tabs.
 */
export class NetClient {
  events: NetEvents = {};
  private ws: WebSocket | null = null;
  private queue: ClientMsg[] = [];
  private retry = 0;
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** Differenz Serverzeit minus lokale Zeit. */
  offset = 0;
  code: string | null = null;
  token: string | null = null;
  color: Color | null = null;
  last: RoomState | null = null;

  constructor(private url = serverUrl()) {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
      if (s?.code && s?.token) {
        this.code = s.code;
        this.token = s.token;
      }
    } catch {
      /* ohne sessionStorage */
    }
  }

  get hasSession() {
    return !!(this.code && this.token);
  }

  connect() {
    this.closed = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.events.connection?.('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.events.connection?.('open');
      // Nach Abbruch denselben Platz wieder einnehmen
      if (this.code && this.token) this.raw({ t: 'resume', code: this.code, token: this.token });
      const q = this.queue;
      this.queue = [];
      for (const m of q) this.raw(m);
      this.raw({ t: 'ping' });
    };
    ws.onmessage = (e) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      this.handle(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.closed) return;
      this.events.connection?.('lost');
      this.scheduleReconnect();
    };
    ws.onerror = () => {
      /* onclose folgt */
    };
  }

  private scheduleReconnect() {
    if (this.closed) return;
    const delay = Math.min(5000, 500 * 2 ** this.retry++);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), delay);
  }

  private handle(msg: ServerMsg) {
    switch (msg.t) {
      case 'welcome':
        this.code = msg.code;
        this.token = msg.token;
        this.color = msg.color;
        try {
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ code: msg.code, token: msg.token }));
        } catch {
          /* ignorieren */
        }
        this.events.welcome?.(msg.code, msg.color);
        break;
      case 'state':
        this.offset = msg.serverTime - Date.now();
        this.color = msg.you;
        this.last = msg;
        this.events.state?.(msg);
        break;
      case 'pong':
        this.offset = msg.serverTime - Date.now();
        break;
      case 'error':
        if (msg.code === 'bad-token' || (msg.code === 'no-room' && this.code && !this.last)) this.forget();
        this.events.error?.(msg.code, msg.msg);
        break;
    }
  }

  private raw(m: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else this.queue.push(m);
  }

  send(m: ClientMsg) {
    this.connect();
    this.raw(m);
  }

  /** Raumdaten vergessen (Raum verlassen). */
  forget() {
    this.code = null;
    this.token = null;
    this.last = null;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignorieren */
    }
  }

  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
  }

  serverNow(): number {
    return Date.now() + this.offset;
  }
}

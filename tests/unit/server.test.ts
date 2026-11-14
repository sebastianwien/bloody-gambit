import { beforeEach, describe, expect, it } from 'vitest';
import type { RoomState, ServerMsg } from '../../shared/protocol.ts';
import { RoomManager, type Conn } from '../../server/src/rooms.ts';

class FakeConn implements Conn {
  inbox: ServerMsg[] = [];
  send(m: ServerMsg) {
    this.inbox.push(m);
  }
  last<T extends ServerMsg['t']>(t: T): Extract<ServerMsg, { t: T }> {
    for (let i = this.inbox.length - 1; i >= 0; i--) if (this.inbox[i].t === t) return this.inbox[i] as Extract<ServerMsg, { t: T }>;
    throw new Error('keine Nachricht ' + t);
  }
  state(): RoomState {
    return this.last('state');
  }
}

let now = 1_000_000;
let mgr: RoomManager;
let a: FakeConn;
let b: FakeConn;

function setup(clock: { initial: number; increment: number } | null = null) {
  now = 1_000_000;
  mgr = new RoomManager(() => now);
  a = new FakeConn();
  b = new FakeConn();
  mgr.receive(a, { t: 'create', clock, color: 'w' });
  const code = a.last('welcome').code;
  mgr.receive(b, { t: 'join', code });
  return code;
}

describe('Server-Räume', () => {
  beforeEach(() => setup());

  it('Raum erstellen und beitreten, Farben verteilt', () => {
    expect(a.last('welcome').color).toBe('w');
    expect(b.last('welcome').color).toBe('b');
    expect(a.state().players).toEqual({ w: 'here', b: 'here' });
    expect(a.last('welcome').code).toMatch(/^[A-Z2-9]{5}$/);
  });

  it('dritter Spieler wird abgewiesen, unbekannter Raum gemeldet', () => {
    const c = new FakeConn();
    mgr.receive(c, { t: 'join', code: a.last('welcome').code });
    expect(c.last('error').code).toBe('full');
    mgr.receive(c, { t: 'join', code: 'ZZZZZ' });
    expect(c.last('error').code).toBe('no-room');
  });

  it('prüft Züge: Reihenfolge, Legalität, Zugnummer', () => {
    mgr.receive(b, { t: 'move', uci: 'e7e5', ply: 0 });
    expect(b.last('error').code).toBe('not-your-turn');
    mgr.receive(a, { t: 'move', uci: 'e2e5', ply: 0 });
    expect(a.last('error').code).toBe('illegal');
    mgr.receive(a, { t: 'move', uci: 'e2e4', ply: 0 });
    expect(b.state().moves).toEqual(['e2e4']);
    // doppelt gesendet (alte Zugnummer) wird abgelehnt
    mgr.receive(a, { t: 'move', uci: 'e2e4', ply: 0 });
    expect(a.last('error').code).toBe('illegal');
    mgr.receive(a, { t: 'move', uci: 'garbage', ply: 1 } as never);
    expect(a.last('error').code).toBe('not-your-turn');
  });

  it('Schachmatt beendet die Partie, danach keine Züge', () => {
    for (const [c, u, p] of [
      [a, 'f2f3', 0],
      [b, 'e7e5', 1],
      [a, 'g2g4', 2],
      [b, 'd8h4', 3],
    ] as const)
      mgr.receive(c, { t: 'move', uci: u, ply: p });
    expect(a.state().result).toEqual({ winner: 'b', reason: 'checkmate' });
    mgr.receive(a, { t: 'move', uci: 'a2a3', ply: 4 });
    expect(a.last('error').code).toBe('over');
  });

  it('Aufgeben, Remis anbieten und annehmen', () => {
    mgr.receive(a, { t: 'offerDraw' });
    expect(b.state().drawOffer).toBe('w');
    mgr.receive(b, { t: 'answerDraw', accept: false });
    expect(a.state().drawOffer).toBeNull();
    mgr.receive(a, { t: 'offerDraw' });
    mgr.receive(b, { t: 'answerDraw', accept: true });
    expect(a.state().result).toEqual({ winner: null, reason: 'agreement' });
  });

  it('Revanche tauscht die Farben', () => {
    mgr.receive(a, { t: 'resign' });
    expect(b.state().result).toEqual({ winner: 'b', reason: 'resign' });
    mgr.receive(a, { t: 'rematch' });
    expect(b.state().rematchOffer).toBe('w');
    mgr.receive(b, { t: 'rematch' });
    expect(a.state().you).toBe('b');
    expect(b.state().you).toBe('w');
    expect(a.state().game).toBe(2);
    expect(a.state().moves).toEqual([]);
    expect(a.state().result).toBeNull();
  });

  it('Wiederverbinden innerhalb der Schonfrist, sonst Sieg für den anderen', () => {
    const code = a.last('welcome').code;
    const token = b.last('welcome').token;
    mgr.close(b);
    expect(a.state().players.b).toBe('away');
    expect(a.state().awayDeadline).toBe(now + 60_000);
    now += 30_000;
    mgr.tick();
    const b2 = new FakeConn();
    mgr.receive(b2, { t: 'resume', code, token });
    expect(b2.last('welcome').color).toBe('b');
    expect(a.state().players.b).toBe('here');
    // falsches Token
    const c = new FakeConn();
    mgr.receive(c, { t: 'resume', code, token: 'x' });
    expect(c.last('error').code).toBe('bad-token');
    // erneut weg und zu lange
    mgr.close(b2);
    now += 60_001;
    mgr.tick();
    expect(a.state().result).toEqual({ winner: 'w', reason: 'abandon' });
  });
});

describe('Schachuhr', () => {
  it('läuft erst nach dem ersten Zug, Schonzeit nach Zügen, Inkrement, Zeitüberschreitung', () => {
    setup({ initial: 60_000, increment: 2000 });
    expect(a.state().clock!.running).toBeNull();
    mgr.receive(a, { t: 'move', uci: 'e2e4', ply: 0 });
    let st = a.state().clock!;
    expect(st.running).toBe('b');
    // Schonzeit 1,5 s: Schwarz verliert in dieser Zeit nichts
    now += 1500;
    mgr.receive(b, { t: 'move', uci: 'e7e5', ply: 1 });
    st = a.state().clock!;
    expect(st.b).toBe(60_000 + 2000);
    expect(st.running).toBe('w');
    // Weiß denkt 10 s nach der Schonzeit
    now += 1500 + 10_000;
    mgr.receive(a, { t: 'move', uci: 'g1f3', ply: 2 });
    st = a.state().clock!;
    expect(st.w).toBe(60_000 - 10_000 + 2000);
    // Schwarz lässt die Zeit ablaufen
    now += 1500 + 62_001;
    mgr.tick();
    expect(a.state().result).toEqual({ winner: 'w', reason: 'timeout' });
  });

  it('Schlagzug gibt längere Schonzeit für die Kampfanimation', () => {
    setup({ initial: 60_000, increment: 0 });
    for (const [c, u, p] of [
      [a, 'e2e4', 0],
      [b, 'd7d5', 1],
    ] as const) {
      mgr.receive(c, { t: 'move', uci: u, ply: p });
      now += 1500;
    }
    mgr.receive(a, { t: 'move', uci: 'e4d5', ply: 2 });
    now += 5000;
    expect(a.state().clock!.b).toBe(60_000);
  });

  it('lehnt unsinnige Bedenkzeiten ab', () => {
    const m = new RoomManager(() => now);
    const c = new FakeConn();
    m.receive(c, { t: 'create', clock: { initial: -5, increment: 1e9 }, color: 'random' });
    expect(c.state().clock).toBeNull();
  });
});

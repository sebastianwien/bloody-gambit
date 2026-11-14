// Misst Abstände und Duellposition zweier Figuren nach einer Zugfolge (ohne Kampf).
// Aufruf: node tools/review/probe.mjs <züge,komma> <von-feld> <opfer-feld>
import { chromium } from 'playwright';
const [moves, from, to] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.goto('http://localhost:5180/?start=local');
await p.waitForFunction(() => window.__wolf?.game);
const r = await p.evaluate(async ({ ms, from, to }) => {
  const w = window.__wolf; w.settings.battles = 'never'; w.stage.tweens.speed = 50;
  for (const m of ms) await w.game.submit({ from: m.slice(0, 2), to: m.slice(2, 4) });
  const st = w.stage; const a = st.actorAt(from); const v = st.actorAt(to);
  const out = {};
  for (const hd of [false, true]) { a.hd = hd; v.hd = hd;
    out[hd ? 'hd' : 'lo'] = { bfA: st.bodyFront(a), bfV: st.bodyFront(v), meta: st.attackMeta(a), spot: w.battle.duelSpot(a, v), pa: w.battle.pos(a), pv: w.battle.pos(v) }; }
  return out;
}, { ms: moves.split(','), from, to });
console.log(JSON.stringify(r, null, 1));
await b.close();

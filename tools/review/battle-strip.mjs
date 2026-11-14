// Nimmt einen Kampf Bild für Bild auf (12 Bilder pro Sekunde Spielzeit) und legt einen Bildstreifen an.
// Aufruf: node tools/review/battle-strip.mjs <züge,komma,getrennt> <ausgabe.png>
// Beispiel: node tools/review/battle-strip.mjs e2e4,d7d5,e4d5 /tmp/pp.png
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const moves = (process.argv[2] ?? 'e2e4,d7d5,e4d5').split(',');
const outFile = process.argv[3] ?? 'review.png';
const dir = join(dirname(outFile), 'frames');
mkdirSync(dir, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('http://localhost:5180/?start=local');
await p.waitForFunction(() => window.__wolf?.game);
await p.evaluate(async ({ ms, force }) => {
  const w = window.__wolf;
  w.settings.battles = 'always';
  w.battle.forceDeath = force || null;
  w.stage.tweens.speed = 20;
  for (const m of ms.slice(0, -1)) await w.game.submit({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
  w.stage.tweens.speed = 1;
  w.manual = true;
  window.__steps = [];
  w.battle.hooks.step = (s) => window.__steps.push(s.t + (s.variant ? ':' + s.variant : ''));
  const m = ms[ms.length - 1];
  w.__done = false;
  w.game.submit({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] }).then(() => (w.__done = true));
}, { ms: moves, force: process.env.FORCE_DEATH ?? null });
const files = [];
for (let i = 0; i < 400; i++) {
  const done = await p.evaluate(() => {
    const w = window.__wolf;
    w.advance(1 / 12);
    return w.__done;
  });
  // Bildausschnitt um die Kamera
  const buf = await p.locator('#view').screenshot();
  const f = join(dir, String(i).padStart(3, '0') + '.png');
  writeFileSync(f, buf);
  files.push(f);
  if (done) break;
}
const steps = await p.evaluate(() => window.__steps);
console.log(JSON.stringify({ frames: files.length, steps, dir }));
await b.close();

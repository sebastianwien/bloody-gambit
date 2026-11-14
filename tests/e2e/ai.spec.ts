import { test } from '@playwright/test';
import { expect, fastAnimations, waitIdle, watchErrors, clickSquare } from './helpers.ts';

/**
 * Komplette Partie gegen die KI (Stufe Knappe) per Mausklick.
 * Der Mensch spielt mit einer kleinen Suchtiefe die Engine-Empfehlung, damit die Partie endet.
 */
test('komplette Partie gegen die KI bis zum Spielende', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?start=ai&level=1&color=w');
  await page.waitForFunction(() => (window as any).__wolf?.game);
  await fastAnimations(page);
  await page.evaluate(() => ((window as any).__wolf.aiClient.minThinkMs = 0));
  for (let ply = 0; ply < 400; ply++) {
    await waitIdle(page);
    const state = await page.evaluate(() => {
      const g = (window as any).__wolf.game;
      return { end: !!g.end, turn: g.rules.turn() };
    });
    if (state.end) break;
    if (state.turn !== 'w') {
      await page.waitForFunction(() => {
        const g = (window as any).__wolf.game;
        return g.end || g.rules.turn() === 'w';
      }, null, { timeout: 15_000 });
      continue;
    }
    const uci: string = await page.evaluate(() => (window as any).__wolf.suggestMove(2));
    await waitIdle(page);
    const before = await page.evaluate(() => (window as any).__wolf.game.rules.fen());
    await clickSquare(page, uci.slice(0, 2));
    await clickSquare(page, uci.slice(2, 4));
    if (uci.length > 4) {
      const dlg = page.getByTestId('promo-' + uci[4]);
      await dlg.waitFor({ timeout: 5000 }).catch(() => {});
      if (await dlg.isVisible()) await dlg.click();
      else {
        const dbg = await page.evaluate(() => {
          const g = (window as any).__wolf.game;
          return { fen: g.rules.fen(), sel: g.selected, busy: g.busy };
        });
        throw new Error('Umwandlungsdialog fehlt: ' + uci + ' ' + JSON.stringify(dbg));
      }
    }
    const moved = await page
      .waitForFunction((f) => (window as any).__wolf.game.rules.fen() !== f, before, { timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!moved) {
      const dbg = await page.evaluate(() => {
        const g = (window as any).__wolf.game;
        return { fen: g.rules.fen(), sel: g.selected, busy: g.busy, end: g.end, log: (window as any).__wolf.clickLog.slice(-4) };
      });
      throw new Error('Zug nicht angenommen: ' + uci + ' ' + JSON.stringify(dbg));
    }
  }
  await waitIdle(page);
  const end = await page.evaluate(() => (window as any).__wolf.game.end);
  expect(end).toBeTruthy();
  expect(errors).toEqual([]);
});

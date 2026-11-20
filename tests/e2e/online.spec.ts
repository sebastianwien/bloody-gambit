import { test, type Page } from '@playwright/test';
import { expect, fastAnimations, move, watchErrors, waitIdle } from './helpers.ts';

async function waitMoves(p: Page, n: number) {
  await p.waitForFunction((k) => (window as any).__wolf.game?.rules.history().length >= k, n, { timeout: 20_000 });
}

test('Link auf einen Raum, den es nicht gibt: Code von Hand eintippen bleibt im Online-Dialog', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?room=ZZZZZ');
  await expect(page.getByTestId('online-error')).toHaveText('Diesen Raum gibt es nicht');
  await page.getByTestId('join-code').pressSequentially('ab2');
  await expect(page.getByTestId('online')).toBeVisible();
  await expect(page.getByTestId('join-code')).toHaveValue('ab2');
  expect(errors).toEqual([]);
});

test('Online-Partie mit zwei Browsern: Raum, Beitritt per Link, Matt, Revanche', async ({ browser }) => {
  const ctxA = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const errA = watchErrors(a);
  const errB = watchErrors(b);

  await a.goto('/?start=menu');
  await a.getByTestId('menu-online').click();
  await a.getByTestId('clock-2').click();
  await a.getByTestId('ocolor-w').click();
  await a.getByTestId('create-room').click();
  const code = (await a.getByTestId('room-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{5}$/);

  await b.goto('/?room=' + code);
  await a.getByTestId('hud').waitFor();
  await b.getByTestId('hud').waitFor();
  await fastAnimations(a);
  await fastAnimations(b);
  expect(await b.evaluate(() => (window as any).__wolf.stage.flipped)).toBe(true);
  // Wer per Link kam, hat den Titel nie weggeklickt: eine Taste darf ihn nicht aus der Partie werfen
  await b.keyboard.press('x');
  await expect(b.getByTestId('menu')).toHaveCount(0);
  expect(await b.evaluate(() => (window as any).__wolf.game?.setup.mode)).toBe('online');
  // Uhr sichtbar
  await expect(a.locator('[data-clock=w]')).toHaveText(/\d+:\d\d/);

  const moves: [Page, string][] = [
    [a, 'e2e4'],
    [b, 'e7e5'],
    [a, 'f1c4'],
    [b, 'b8c6'],
    [a, 'd1h5'],
    [b, 'g8f6'],
    [a, 'h5f7'],
  ];
  for (let i = 0; i < moves.length; i++) {
    const [p, m] = moves[i];
    await waitMoves(p, i);
    await waitIdle(p);
    await move(p, m);
  }
  await waitMoves(b, 7);
  await expect(a.getByTestId('over-title')).toHaveText('Sieg!', { timeout: 20_000 });
  await expect(b.getByTestId('over-title')).toHaveText('Niederlage', { timeout: 20_000 });

  // Revanche: beide wollen, Farben getauscht
  await a.getByTestId('over-rematch').click();
  await expect(b.getByTestId('over-rematch')).toHaveText('Revanche annehmen');
  await b.getByTestId('over-rematch').click();
  await a.waitForFunction(() => (window as any).__wolf.stage.flipped === true && (window as any).__wolf.game.rules.history().length === 0);
  await b.waitForFunction(() => (window as any).__wolf.stage.flipped === false);

  // Wiederverbinden: B lädt neu und sitzt wieder auf seinem Platz
  await fastAnimations(b);
  await move(b, 'd2d4');
  await b.reload();
  await b.waitForFunction(() => (window as any).__wolf.game?.setup.mode === 'online' && (window as any).__wolf.game.rules.history().length === 1, null, { timeout: 20_000 });
  await fastAnimations(b);
  await waitMoves(a, 1);
  await move(a, 'd7d5');
  await waitMoves(b, 2);

  // Aufgeben über das Pausenmenü
  await a.keyboard.press('Escape');
  await a.getByTestId('pause-resign').click();
  await expect(b.getByTestId('over-title')).toHaveText('Sieg!', { timeout: 20_000 });

  expect(errA).toEqual([]);
  expect(errB).toEqual([]);
  await ctxA.close();
  await ctxB.close();
});

import { test } from '@playwright/test';
import { expect, fastAnimations, move, watchErrors } from './helpers.ts';

test('Titel, Menü, Einstellungen, Mitwirkende, Einzelspieler, Pause, Fortsetzen', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByTestId('title').waitFor();
  await page.mouse.click(960, 540);
  await page.getByTestId('menu').waitFor();

  // Einstellungen ändern und dauerhaft speichern
  await page.getByTestId('menu-settings').click();
  await page.getByTestId('battles-off').click();
  await page.getByTestId('gore-false').click();
  await page.getByTestId('back').click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('wolfsschach.settings.v1')!));
  expect(stored.battles).toBe('off');
  expect(stored.gore).toBe(false);

  await page.getByTestId('menu-credits').click();
  await expect(page.getByTestId('credits')).toContainText('chess.js');
  await expect(page.getByTestId('credits')).toContainText('BSD-2-Clause');
  await page.getByTestId('back').click();

  // Einzelspieler als Weiß gegen Knappe
  await page.getByTestId('menu-single').click();
  await page.getByTestId('color-w').click();
  await page.getByTestId('level-1').click();
  await page.getByTestId('start').click();
  await page.getByTestId('hud').waitFor();
  await fastAnimations(page);
  await move(page, 'e2e4');
  await page.waitForFunction(() => (window as any).__wolf.game.rules.history().length >= 2, null, { timeout: 15000 });
  await expect(page.getByTestId('movelist')).toContainText('e4');

  // Pause und weiter
  await page.keyboard.press('Escape');
  await page.getByTestId('pause').waitFor();
  await page.getByTestId('pause-resume').click();
  await expect(page.getByTestId('pause')).toHaveCount(0);

  // Neu laden: Partie lässt sich fortsetzen
  await page.goto('/?start=menu');
  await page.getByTestId('menu-resume').click();
  await page.waitForFunction(() => (window as any).__wolf.game?.rules.history().length >= 2);

  // Zug zurücknehmen
  await page.waitForFunction(() => !(window as any).__wolf.game.busy);
  await page.getByTestId('hud-undo').click();
  expect(await page.evaluate(() => (window as any).__wolf.game.rules.history().length)).toBe(0);
  expect(errors).toEqual([]);
});

test('Aufgeben zeigt Niederlage mit Revanche', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?start=ai&level=1&color=w');
  await page.getByTestId('hud').waitFor();
  await page.keyboard.press('Escape');
  await page.getByTestId('pause-resign').click();
  await expect(page.getByTestId('over-title')).toHaveText('Niederlage');
  await page.getByTestId('over-rematch').click();
  // Revanche mit getauschten Farben: Mensch spielt Schwarz, Brett gedreht
  await page.waitForFunction(() => (window as any).__wolf.stage.flipped === true);
  expect(errors).toEqual([]);
});

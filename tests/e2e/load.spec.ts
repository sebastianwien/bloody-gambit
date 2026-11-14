import { test } from '@playwright/test';
import { expect, watchErrors } from './helpers.ts';

test('Titelbildschirm lädt lokal in unter 5 Sekunden, ohne Konsolenfehler', async ({ page }) => {
  const errors = watchErrors(page);
  const t0 = Date.now();
  await page.goto('/');
  await page.getByTestId('title').waitFor({ timeout: 10_000 });
  const ms = Date.now() - t0;
  console.log('Ladezeit bis Titel:', ms, 'ms');
  expect(ms).toBeLessThan(5000);
  // Ein paar Sekunden Szene laufen lassen (Regen, Blitz, Fackeln) und auf Fehler achten
  await page.mouse.click(960, 540);
  await page.getByTestId('menu').waitFor();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

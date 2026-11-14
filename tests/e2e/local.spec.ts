import { test } from '@playwright/test';
import { expect, fastAnimations, fen, move, watchErrors } from './helpers.ts';

test('zwei Spieler am selben Rechner: Schäfermatt per Klick', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?start=local');
  await page.waitForFunction(() => (window as any).__wolf?.game);
  await fastAnimations(page);
  for (const m of ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7']) await move(page, m);
  expect(await fen(page)).toContain('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq');
  await expect(page.getByTestId('status')).toContainText('Schachmatt');
  expect(errors).toEqual([]);
});

import { expect, type Page } from '@playwright/test';

/** Sammelt Konsolenfehler; am Testende muss die Liste leer sein. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

export async function clickSquare(page: Page, sq: string) {
  const p = await page.evaluate((s) => (window as any).__wolf.squareToClient(s), sq);
  await page.mouse.click(p.x, p.y);
}

export async function waitIdle(page: Page) {
  await page.waitForFunction(() => {
    const w = (window as any).__wolf;
    return w.game && !w.game.busy && !w.stage.tweens.busy;
  }, null, { timeout: 30_000 });
}

/** Zug per Mausklick auf Start- und Zielfeld. */
export async function move(page: Page, uci: string) {
  await waitIdle(page);
  await clickSquare(page, uci.slice(0, 2));
  await clickSquare(page, uci.slice(2, 4));
  if (uci.length > 4) await page.getByTestId('promo-' + uci[4]).click();
  await waitIdle(page);
}

export async function fen(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).__wolf.game.rules.fen());
}

export async function fastAnimations(page: Page) {
  await page.evaluate(() => ((window as any).__wolf.stage.tweens.speed = 6));
}

export { expect };

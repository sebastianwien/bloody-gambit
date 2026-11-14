import { GAME_TITLE } from './config.ts';
import { App } from './app.ts';

document.title = GAME_TITLE;

async function boot() {
  try {
    await document.fonts.load('10px Wolfsrune');
  } catch {
    /* Schrift fehlt: Ersatzschrift */
  }
  const app = new App(document.getElementById('root')!);
  (window as unknown as { __wolf: App }).__wolf = app;
  await app.start();
}

boot();

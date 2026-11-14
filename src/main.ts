import { GAME_TITLE } from './config.ts';
import { OnlineApp } from './online.ts';

document.title = GAME_TITLE;

async function boot() {
  try {
    await document.fonts.load('10px Wolfsrune');
  } catch {
    /* Schrift fehlt: Ersatzschrift */
  }
  const app = new OnlineApp(document.getElementById('root')!);
  (window as unknown as { __wolf: OnlineApp }).__wolf = app;
  await app.start();
}

boot();

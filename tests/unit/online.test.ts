import { describe, expect, it } from 'vitest';
import { onlineAvailable } from '../../src/net/client.ts';

describe('Online-Menüpunkt', () => {
  it('ist da, solange der Bau nicht ohne Server gekennzeichnet ist', () => {
    expect(onlineAvailable({}, '')).toBe(true);
  });

  it('fehlt beim Bau ohne Raumserver', () => {
    expect(onlineAvailable({ VITE_ONLINE: 'off' }, '')).toBe(false);
    expect(onlineAvailable({ VITE_ONLINE: 'off' }, '?start=menu')).toBe(false);
  });

  it('kommt zurück, wenn eine Serveradresse mitgegeben wird', () => {
    expect(onlineAvailable({ VITE_ONLINE: 'off' }, '?server=wss://beispiel.test')).toBe(true);
    expect(onlineAvailable({ VITE_ONLINE: 'off', VITE_SERVER_URL: 'wss://beispiel.test' }, '')).toBe(true);
  });

  it('eine leere Serveradresse zählt nicht', () => {
    expect(onlineAvailable({ VITE_ONLINE: 'off' }, '?server=')).toBe(false);
  });
});

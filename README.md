# Bloody Gambit

Browser-Schach im düsteren Mittelalter: Jedes Schlagen löst eine Pixel-Kampfszene aus. Die Schachregeln entscheiden, der Kampf ist reine Show.

Einzelspieler gegen den Computer (drei Stufen), zu zweit an einem Rechner oder online über einen Raumcode.

## Starten

Voraussetzung: Node 24 oder neuer (der Server läuft direkt aus TypeScript).

```bash
npm install
```

```bash
npm run start:all
```

Dann http://localhost:5180 öffnen. Das startet das Spiel (Port 5180) und den Online-Server (Port 8790). Nur das Spiel: `npm run dev`.

Schnellstarts: `?start=local` (zu zweit), `?start=ai&level=1&color=w` (gegen den Computer), `?room=CODE` (Online-Raum).

## Tests

```bash
npm test
```

```bash
npm run e2e
```

`npm test` muss vor jedem Commit grün sein. `npx tsc --noEmit -p .` prüft die Typen.

## Aufbau

| Ordner | Inhalt |
|---|---|
| `src/battle/` | Kampf-Baukasten: `kit.ts` plant jeden Kampf (reine Daten, getestet), `runner.ts` spielt ihn ab |
| `src/scene/` | Bühne, Brett, Figuren, Effekte, Umgebung |
| `src/audio/` | Musik und Geräusche, alles im Code erzeugt, keine Audiodateien |
| `src/ai/` | Schach-Engine im Web Worker |
| `src/game/`, `src/ui/` | Spielablauf, Menüs |
| `server/`, `shared/` | Online-Server (WebSocket) und gemeinsames Protokoll |
| `art/` | Rohbilder der Figuren: `art/chars` (Brett), `art/battle` (Kampf, 128 px) |
| `public/assets/` | Gepackte Sprite-Atlanten, aus `art/` erzeugt |
| `tools/` | Atlas-Packer, Bild-für-Bild-Prüfung, Online-Rollout |

Stand, Entscheidungen und bekannte Lücken stehen in `fortschritt.md`. Die Phasen im Überblick: `vorschau.md`.

## Mitmachen

Eingeladene dürfen direkt auf `main` hochladen.

1. Vor dem Start `git pull --rebase`.
2. Ändern, `npm test` laufen lassen.
3. Committen mit einem Satz dazu, was sich im Spiel sichtbar ändert, dann hochladen.

Für größere Umbauten lohnt ein eigener Branch mit Pull Request, damit jemand drüberschauen kann.

Gute Einstiege:

- **Kampfabläufe:** Ein eigener Finisher für eine Paarung ist ein Eintrag in `CUSTOM` in `src/battle/kit.ts`. Die Regeln in `validatePlan` (kein Schlag nach tödlicher Wunde, Tod passt zum Treffer) prüft der Test für alle 30 Paarungen.
- **Geräusche:** Ein neuer Effekt ist eine Funktion in `SFX` in `src/audio/sfx.ts`.
- **Kampf ansehen:** `node tools/review/battle-strip.mjs e2e4,d7d5,e4d5 /tmp/pp.png` nimmt den letzten Zug Bild für Bild auf (das Spiel muss laufen). `FORCE_DEATH=behead` erzwingt eine Todesart.

### Figuren und Animationen

Die Bilder stammen aus PixelLab. Jede Figur hat dort eine Kennung (`art/<ordner>/<figur>/ID`). Neue Animationen erzeugen kostet Guthaben, das bitte vorher absprechen.

Atlas neu packen nach Änderungen in `art/`:

```bash
uv run --with pillow --with numpy python tools/pack_atlas.py
```

```bash
uv run --with pillow --with numpy python tools/pack_atlas.py art/battle battle
```

Steuerdateien je Figur: `SKIP` (Animation verwerfen), `REMAP` (umbenennen, Bilder vorn weglassen), `DROPFRAMES` (einzelne Bilder verwerfen), `IMPACT` (Trefferbild von Hand).

## Regeln

- **Nichts aus Battle Chess:** kein Name, keine Originalfiguren, keine Originalgags oder -geräusche. Der Turm bleibt ein Bauwerk und wird kein lebendes Steinwesen.
- **Animationen gehen vor:** Positionen müssen stimmen. Kämpfer schauen sich an, die Waffe erreicht den Gegner, Gefallene fallen vom Angreifer weg, Füße stehen am Boden.
- **Sprache:** Kommentare, Commits und Spieltexte auf Deutsch mit echten Umlauten.

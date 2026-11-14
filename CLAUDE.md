# Bloody Gambit - Hinweise für Claude

Browser-Schach mit Pixel-Kampfszenen. Vite, TypeScript, Canvas 2D, chess.js. Überblick und Ordner: `README.md`. Stand, Entscheidungen, bekannte Lücken: `fortschritt.md`.

## Einrichten

Voraussetzung: Git und Node.js 24 oder neuer. Fehlt etwas, zuerst installieren:

- Windows: `winget install --id Git.Git -e` und `winget install --id OpenJS.NodeJS.LTS -e`, danach die Shell (oder die App) neu starten. Details und Stolpersteine: `docs/einrichten-windows.md`.
- macOS: `brew install git node`.

Dann `npm install`.

## Befehle

| Zweck | Befehl |
|---|---|
| Spiel und Online-Server starten | `npm run start:all` (Spiel Port 5180, Server Port 8790) |
| Nur das Spiel | `npm run dev` |
| Typprüfung | `npx tsc --noEmit -p .` |
| Unit-Tests | `npm test` |
| Browser-Tests | `npm run e2e` (einmalig vorher `npx playwright install chromium`) |
| Kampf Bild für Bild aufnehmen | `node tools/review/battle-strip.mjs <züge> <ausgabe.png>` (Spiel muss laufen) |
| Atlas neu packen | `uv run --with pillow --with numpy python tools/pack_atlas.py [art/battle battle]` |

Die Desktop-App startet die Server über `.claude/launch.json` (Einträge `spiel` und `server`). Schnellstart im Browser: `http://localhost:5180/?start=local`.

## Regeln

- **Animationen sind das Wichtigste.** Positionen müssen stimmen: Kämpfer schauen sich an, die Waffe erreicht den Gegner, Gefallene fallen vom Angreifer weg, Füße stehen am Boden. Jede Änderung an Kampfabläufen mit `battle-strip.mjs` Bild für Bild ansehen, nicht nur Tests laufen lassen.
- **Nichts aus Battle Chess:** kein Name, keine Originalfiguren, -gags oder -geräusche. Der Turm bleibt ein Bauwerk.
- **Kampf ist Show, die Schachregeln entscheiden.** Kampfpläne entstehen in `src/battle/kit.ts` als reine Daten. `validatePlan` und die Tests in `tests/unit/battle.test.ts` gelten für alle 30 Paarungen, ein Kampf bleibt unter 7 Sekunden.
- **Geräusche und Musik entstehen im Code** (`src/audio/`), keine Audiodateien.
- **Neue Bilder aus PixelLab kosten Guthaben** des Projektinhabers. Nicht ohne Absprache erzeugen.
- **Sprache:** Kommentare, Commits, Doku und Spieltexte auf Deutsch mit echten Umlauten, kein Gedankenstrich (immer Bindestrich).
- **Vor jedem Commit:** `npx tsc --noEmit -p .` und `npm test` grün. Jede Änderung auf `main` geht automatisch online (GitHub Pages), rote Tests halten den Rollout an.
- **Nichts Privates ins Repo:** Es ist öffentlich. Keine Schlüssel, Zugangsdaten oder Serveradressen.
- Nach größeren Änderungen `fortschritt.md` ergänzen.

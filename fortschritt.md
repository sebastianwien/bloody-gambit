# Wolfsschach - Fortschritt

Einzige Wahrheit über den Stand. Nach einer Kontext-Zusammenfassung zuerst hier lesen.

## Stand

- Start: 14.11.2026 12:35
- Aktuelle Phase: 3 (Stil und Figuren)

## Erledigte Phasen

- Phase 1 Fundament: isometrisches Steinbrett, Platzhalter-Figuren, alle Regeln über chess.js (shared/rules.ts), Klickauswahl mit erlaubten Feldern, Umwandlungsdialog, lokal zu zweit, Zug zurück (Taste Z). Tests: 13 Vitest, 1 Playwright. Commit 4e3d19c.
- Phase 2 KI: eigene 0x88-Engine (src/ai/engine.ts) mit Alpha-Beta, Ruhesuche, Transpositionstabelle, Zugsortierung, iterativer Vertiefung; Eröffnungsbuch mit 19 Linien; Web Worker; Stufen Knappe (Tiefe 2, Rauschen), Ritter (Tiefe 4), Hochmeister (bis 1,6 s). Perft gegen Referenzwerte und chess.js geprüft. Dazu Umbau auf Spielerperspektive (Wunsch Sebastian 14.11.).

## Budget PixelLab

Startwert: 40 Generierungen (Trial, keine Credits in USD). Abbruchgrenze: unter 4 Generierungen.

| Phase | geplant | verbraucht |
|---|---|---|
| 3+4 Figuren, Ruhe | 12 | 3,1 (unzoom 0,1, image_to_pixelart 1, Bauer 1, König 1) |
| 5 Angriffe | 6 | 0 |
| 8 Umgebung | 0 (OpenAI + Code) | 0 |
| 10 Lauf, Sonderposen | 18 | 0 |
| Reserve | 4 | - |

OpenAI (gpt-image-2): 1 Bild (Edit, medium), ca. 0,07 $ (Grenze 5 $).

## Entscheidungen

- **Rendering Canvas 2D statt PixiJS:** keine Abhängigkeit, pixelgenaue Kontrolle, Palettentausch einmal beim Laden in Leinwände vorberechnet. Logische Auflösung 960x540, per CSS pixelig skaliert (bei 1920x1080 genau 2x).
- **Eigene Pixelschrift "Wolfsrune"** (tools/make-font.mjs, opentype.js MIT, nur Build-Zeit): keine Fremdschrift-Lizenz, gleicher Look in Canvas und DOM.
- **Menüs als DOM-Overlay** im selben logischen Maßstab wie die Leinwand: einfache Texteingabe für Raumcodes, gut per Playwright testbar.
- **Brett aus Spielersicht** (Wunsch Sebastian 14.11., ersetzt die Isometrie): eigene Armee unten, Reihen waagerecht, Fluchtpunkt-Perspektive nur fürs Brett (hinten 76 %), Figuren unskaliert. Spielt man Schwarz, dreht sich das Brett.
- **Blickrichtungen:** acht Richtungen aus PixelLab (v3 mit Referenz liefert alle 8 Drehungen für 1 Generierung). In Ruhe schauen beide Armeen zum Gegner, die eigene also vom Betrachter weg.
- **Figurenvorlage:** gpt-image-2 Aufstellung frontal auf Grün (bilder/lineup_v2_front.png), per PixelLab image_to_pixelart (faithful) in echte Pixelart (art/ref/lineup_pixel.png), dann je Figur 64x64 als Referenz für create_character v3.
- **Budget statt Auftragsschlüssel:** Die Trial hat 40 Generierungen. Gezeichnet wird nur, was Code nicht kann (Figuren, Ruhe-Eigenheit, Angriff, Lauf vorne). Tod-Varianten, Rückansicht-Laufen, Sprünge, Blut, Kamera entstehen prozedural im Code. Umgebung per OpenAI-Bild plus Code.
- **Server in TypeScript ohne Build:** Node führt .ts per Type-Stripping direkt aus, Regeln aus shared/rules.ts identisch im Client.

## Verworfene Versuche

- Figuren direkt aus lineup_v1 herunterrechnen: matschig (keine echte Pixelart, kein Raster).
- unzoom_image auf der gpt-Aufstellung: erkennt kein Raster (0,1 Generierungen).
- Isometrisches Rautenbrett: von Sebastian abgelehnt, zu seitlich.

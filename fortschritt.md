# Wolfsschach - Fortschritt

Einzige Wahrheit über den Stand. Nach einer Kontext-Zusammenfassung zuerst hier lesen.

## Stand

- Start: 14.11.2026 12:35
- Aktuelle Phase: 2 (KI)

## Erledigte Phasen

- Phase 1 Fundament: isometrisches Steinbrett, Platzhalter-Figuren, alle Regeln über chess.js (shared/rules.ts), Klickauswahl mit erlaubten Feldern, Umwandlungsdialog, lokal zu zweit, Zug zurück (Taste Z). Tests: 13 Vitest, 1 Playwright.

## Budget PixelLab

Startwert: 40 Generierungen (Trial, keine Credits in USD). Abbruchgrenze: unter 4 Generierungen.

| Phase | geplant | verbraucht |
|---|---|---|
| 3+4 Figuren, Ruhe | 12 | 0 |
| 5 Angriffe | 6 | 0 |
| 8 Umgebung | 0 (OpenAI + Code) | 0 |
| 10 Lauf, Sonderposen | 18 | 0 |
| Reserve | 4 | - |

OpenAI (gpt-image-2): 0 Bilder, 0 $ (Grenze 5 $).

## Entscheidungen

- **Rendering Canvas 2D statt PixiJS:** keine Abhängigkeit, pixelgenaue Kontrolle, Palettentausch einmal beim Laden in Leinwände vorberechnet. Logische Auflösung 960x540, per CSS pixelig skaliert (bei 1920x1080 genau 2x).
- **Eigene Pixelschrift "Wolfsrune"** (tools/make-font.mjs, opentype.js MIT, nur Build-Zeit): keine Fremdschrift-Lizenz, gleicher Look in Canvas und DOM.
- **Menüs als DOM-Overlay** im selben logischen Maßstab wie die Leinwand: einfache Texteingabe für Raumcodes, gut per Playwright testbar.
- **Brett:** Weißer Spieler unten links (a1 linke Ecke, h1 untere Ecke). Spielt man Schwarz, wird um 180° gedreht.
- **Blickrichtungen:** Ruhe zeigt die Vorderansicht (untere Armee nach rechts unten, obere gespiegelt nach links unten), damit Gesichter und Eigenheiten sichtbar sind. Rückansicht nur beim Laufen nach oben.
- **Budget statt Auftragsschlüssel:** Die Trial hat 40 Generierungen. Gezeichnet wird nur, was Code nicht kann (Figuren, Ruhe-Eigenheit, Angriff, Lauf vorne). Tod-Varianten, Rückansicht-Laufen, Sprünge, Blut, Kamera entstehen prozedural im Code. Umgebung per OpenAI-Bild plus Code.
- **Server in TypeScript ohne Build:** Node führt .ts per Type-Stripping direkt aus, Regeln aus shared/rules.ts identisch im Client.

## Verworfene Versuche

(noch keine)

# Wolfsschach - Fortschritt

Einzige Wahrheit über den Stand. Nach einer Kontext-Zusammenfassung zuerst hier lesen.

## Stand

- Start: 14.11.2026 12:35
- Aktuelle Phase: 10 (eigene Finisher, Sonderszenen), danach 11 (Abschluss)
- Offene PixelLab-Aufträge: Ruhe-Eigenheiten Turm, Springer; Angriffe je Figur (Ost-Richtung, 6 Bilder)

## Erledigte Phasen

- **Phase 1 Fundament** (4e3d19c): Steinbrett, Regeln über chess.js (shared/rules.ts), Klickauswahl, Umwandlungsdialog, lokal zu zweit, Zug zurück.
- **Phase 2 KI** (9496ba5): eigene 0x88-Engine (src/ai/engine.ts), Alpha-Beta, Ruhesuche, Transpositionstabelle, iterative Vertiefung, Eröffnungsbuch (19 Linien), Web Worker, Stufen Knappe/Ritter/Hochmeister, alle unter 2 s. Perft gegen Referenzwerte und chess.js geprüft. Dazu Umbau auf Spielerperspektive.
- **Phase 3 Stil und Figuren** (a4f0543 + folgende): Stil-Blatt docs/stilblatt.md, 6 Figuren aus PixelLab mit 8 Richtungen, Atlas (tools/pack_atlas.py -> public/assets/pieces.*), Schwarz per Palettentausch im Code (toBlackArmy). Ruhe-Eigenheiten: Bauer, König, Dame fertig, Läufer läuft.
- **Phase 4 Bewegung**: Laufen in alle Richtungen über die 8 Drehungen mit Schaukeln im Code, Springer springt im Bogen. Eigene Laufbilder noch nicht (Budget, siehe Entscheidungen).
- **Phase 5 Kampf-Baukasten** (a4f0543): src/battle/kit.ts (Daten, 30 Paarungen, 6 allgemeine Finisher, 2-3 Tod-Varianten je Opfer), src/battle/runner.ts (Anlauf, Kamera-Zoom, Abdunkeln, Treffer, Geschosse, Tode: umfallen, Kopf ab, zweigeteilt, zerplatzen, plattgedrückt, verbrennen, Pfeile, einstürzen), Blut als Partikel, Blutflecken bleiben, Wackeln, Trefferblitz, Klick spult vor.
- **Phase 6 Menüs** (a4f0543): Laden, Titel mit Kamerafahrt, Hauptmenü, Einzelspieler (Farbe, Stufe), Einstellungen (Musik, Effekte, Kämpfe immer/nur neue/aus, Blut, KI-Stufe, Zugvorschau; localStorage), Mitwirkende mit Lizenzen, HUD (Spieler, geschlagene Figuren als Brustbilder, Zugliste deutsch), Pause, Spielende mit Revanche, Autosave und Fortsetzen.
- **Phase 7 Online** (f7d219d): server/src (ws, autoritativ mit chess.js, Uhr mit Schonzeit nach Zügen, 60 s Wiederverbinden, Remis, Aufgeben, Revanche mit Farbtausch), Dockerfile, Client src/online.ts + src/net/client.ts.
- **Phase 8 Umgebung** (e2155ba): Hintergrund per gpt-image-2 (bilder/background_v1.png -> public/assets/background.png, 56 Farben), Wolken, Doppelblitz, 4 Feuerschalen mit Flammen, Glut und Lichtschein, Nebelbänder, Regen mit Spritzern, Krähen, Ratten, Nachttönung und Vignette.
- **Phase 9 Ton** (e2155ba): eigener WebAudio-Sequencer (src/audio/music.ts: Menü, Partie, Spannung, Sieg, Niederlage; Bordun, Laute, Chor, Flöte, Glocke, Trommeln, Hall), 40 prozedurale Effekte (src/audio/sfx.ts), Regen und Fackelknistern als Umgebung.

## Budget PixelLab

Startwert: 40 Generierungen (Trial). Abbruchgrenze: unter 4.

| Posten | verbraucht |
|---|---|
| unzoom (verworfen) | 0,1 |
| image_to_pixelart Aufstellung | 1 |
| 6 Figuren (v3 mit Referenz, Springer standard) | 6 |
| Springer Versuch 1 (verworfen, ohne Pferd) | 1 |
| Ruhe Bauer (8 Bilder, 92er Leinwand) | 2 |
| Ruhe König, Dame, Läufer (4 Bilder) | 3 |
| **Summe** | **13,1** |

OpenAI (gpt-image-2): 2 Bilder (Figurenaufstellung, Hintergrund), ca. 0,15 $.

## Entscheidungen

- **Rendering Canvas 2D statt PixiJS:** keine Abhängigkeit, pixelgenaue Kontrolle, Palettentausch einmal beim Laden. Logisch 960x540, pixelig skaliert (1920x1080 = 2x).
- **Eigene Pixelschrift "Wolfsrune"** (tools/make-font.mjs): keine Fremdschrift-Lizenz.
- **Menüs als DOM-Overlay** im selben logischen Maßstab, gut per Playwright testbar.
- **Brett aus Spielersicht** (Wunsch Sebastian 14.11.): eigene Armee unten, Fluchtpunkt-Perspektive nur fürs Brett, Figuren unskaliert, beim Spielen als Schwarz gedreht.
- **Blickrichtungen:** acht Drehungen aus PixelLab. In Ruhe schauen die Armeen zum Gegner.
- **Budget:** Trial mit 40 Generierungen. Animationen wachsen auf eine 92er Leinwand (8 Bilder = 2 Generierungen), darum 4 bis 6 Bilder je Animation. Laufen ohne eigene Bilder (Schaukeln im Code), Tode, Sprünge, Blut, Kamera prozedural.
- **Figurenvorlage:** gpt-image-2 Aufstellung frontal auf Grün, per image_to_pixelart (faithful) in Pixelart, je Figur 64x64 als Referenz für create_character v3.
- **Springer:** v3 mit Referenz machte einen Ritter zu Fuß. Versuch 2 im Standard-Modus mit Pferdevorlage: Reiter klar, Stil etwas flacher. Kreuzähnliches Wappen per tools/fix_knight_shield.py übermalt (Auftrag: kein Kreuz).
- **Online-Uhr:** statt Pausensignal vom Client gibt der Server nach jedem Zug Schonzeit (1,5 s, Schlagzug 6 s) für die Animation. Uhren laufen erst nach dem ersten weißen Zug.
- **Server in TypeScript ohne Build:** Node führt .ts per Type-Stripping aus (keine Parameter-Properties im Server-Code).
- **Kampf aus:** kurzer Schlag mit Blutspritzer statt ganzer Szene.
- **Schach-Einblendung** darf keine Klicks fangen (CSS mit ID-Selektor, war ein Fehler).

## Verworfene Versuche

- Figuren direkt aus lineup_v1 herunterrechnen: matschig.
- unzoom_image auf der gpt-Aufstellung: kein Raster erkannt.
- Isometrisches Rautenbrett: von Sebastian abgelehnt.
- Springer v3 mit Referenz: Pferd verschwunden.

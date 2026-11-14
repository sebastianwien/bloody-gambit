# Wolfsschach - Fortschritt

Einzige Wahrheit über den Stand. Nach einer Kontext-Zusammenfassung zuerst hier lesen.

## Stand

- Start: 14.11.2026 12:35
- Ende: 14.11.2026, alle 11 Phasen abgeschlossen
- Offene PixelLab-Aufträge: keine

## Erledigte Phasen

- **Phase 1 Fundament** (4e3d19c): Steinbrett, Regeln über chess.js (shared/rules.ts), Klickauswahl, Umwandlungsdialog, lokal zu zweit, Zug zurück.
- **Phase 2 KI** (9496ba5): eigene 0x88-Engine (src/ai/engine.ts), Alpha-Beta, Ruhesuche, Transpositionstabelle, iterative Vertiefung, Eröffnungsbuch (19 Linien), Web Worker, Stufen Knappe/Ritter/Hochmeister, alle unter 2 s. Perft gegen Referenzwerte und chess.js geprüft. Dazu Umbau auf Spielerperspektive.
- **Phase 3 Stil und Figuren** (a4f0543 + folgende): Stil-Blatt docs/stilblatt.md, 6 Figuren aus PixelLab mit 8 Richtungen, Atlas (tools/pack_atlas.py -> public/assets/pieces.*), Schwarz per Palettentausch im Code (toBlackArmy). Ruhe-Eigenheiten für alle sechs Figuren (Blick zum Betrachter); die eigene Armee schaut sich in Ruhe per Drehung um.
- **Phase 4 Bewegung**: Laufen in alle Richtungen über die 8 Drehungen, Springer springt im Bogen. Eigene Laufbilder (v3, 4 Bilder): Bauer n/s, Läufer ne/se, Dame n/s/e, König n/s/e; Westrichtungen gespiegelt; übrige Richtungen schaukeln im Code. Turm gleitet mit Staub (kein lebender Turm).
- **Phase 5 Kampf-Baukasten** (a4f0543): src/battle/kit.ts (Daten, 30 Paarungen, 6 allgemeine Finisher, 2-3 Tod-Varianten je Opfer), src/battle/runner.ts (Anlauf, Kamera-Zoom, Abdunkeln, Treffer, Geschosse, Tode: umfallen, Kopf ab, zweigeteilt, zerplatzen, plattgedrückt, verbrennen, Pfeile, einstürzen), Blut als Partikel, Blutflecken bleiben, Wackeln, Trefferblitz, Klick spult vor.
- **Phase 6 Menüs** (a4f0543): Laden, Titel mit Kamerafahrt, Hauptmenü, Einzelspieler (Farbe, Stufe), Einstellungen (Musik, Effekte, Kämpfe immer/nur neue/aus, Blut, KI-Stufe, Zugvorschau; localStorage), Mitwirkende mit Lizenzen, HUD (Spieler, geschlagene Figuren als Brustbilder, Zugliste deutsch), Pause, Spielende mit Revanche, Autosave und Fortsetzen.
- **Phase 7 Online** (f7d219d): server/src (ws, autoritativ mit chess.js, Uhr mit Schonzeit nach Zügen, 60 s Wiederverbinden, Remis, Aufgeben, Revanche mit Farbtausch), Dockerfile, Client src/online.ts + src/net/client.ts.
- **Phase 8 Umgebung** (e2155ba): Hintergrund per gpt-image-2 (bilder/background_v1.png -> public/assets/background.png, 56 Farben), Wolken, Doppelblitz, 4 Feuerschalen mit Flammen, Glut und Lichtschein, Nebelbänder, Regen mit Spritzern, Krähen, Ratten, Nachttönung und Vignette.
- **Phase 9 Ton** (e2155ba): eigener WebAudio-Sequencer (src/audio/music.ts: Menü, Partie, Spannung, Sieg, Niederlage; Bordun, Laute, Chor, Flöte, Glocke, Trommeln, Hall), 40 prozedurale Effekte (src/audio/sfx.ts), Regen und Fackelknistern als Umgebung.
- **Phase 10 Finisher und Sonderszenen** (5cdbe4f, a0c9dd7): eigene Finisher für pp (Stocherduell mit Gegenstoß, fliegendem Helm, Sternchen), np (Huftritt), bp (Kopfnuss), qp (Wegfegen), kp (Königlicher Tritt), rp (Meisterschuss), pn (Speer gegen Ross), nn (Tjost). Angriffsbilder aller sechs Figuren (Seitenansicht, gespiegelt), Kämpfer stellen sich seitlich auf. Schach: König zuckt, rotes Ausrufezeichen, Fanfare. Matt: König stürzt, Krone rollt. Patt: Fragezeichen, Schulterzucken. Sieg: Jubelhüpfen, Niederlage: hängende Köpfe. Umwandlung: Lichtblitz und Funken.
- **Phase 11 Abschluss**: Playwright: komplette Partie gegen KI, komplette Online-Partie mit zwei Browsern (Matt, Revanche, Wiederverbinden, Aufgeben), Menüs, Ladezeit. Konsolenfehler in allen Tests null. Ladezeit bis Titel 156 ms (Produktions-Build lokal). npm run build erzeugt dist/ (1,3 MB). Server-Image per Docker gebaut und /health geprüft. Spielertest: Titel lesbarer gemacht, Statuszeile im Kampf leer, Fehlklick-Ton, Schach-Einblendung klickdurchlässig, Bilder laden ohne decode().

- **Prototyp Kampf-Sprites (Wunsch Sebastian: detaillierter, Richtung MK, auf dem Brett)**: Bauer in 128 px (art/battle/p, public/assets/battle.*), im Kampf exakt 2x Zoom und halbe Zeichengröße, dadurch pixelgenau doppelt so detailliert. Speerhieb 8 Bilder (PixelLab drehte ihn nach Westen; per art/battle/p/REMAP als West-Angriff ohne Bild 1 genutzt, Osten gespiegelt). Abtrennen im Code (src/battle/dismember.ts) mit Gelenken aus estimate_skeleton (art/battle/p/joints.json): Arm fliegt, Stangenwaffe kippt separat, Stumpf mit Knochenpunkt, Fontäne. Stocherduell (pp) nutzt das. Andere Figuren noch ohne Kampf-Sprites.

- **Kampf-Sprites für alle Figuren (14.11. nachmittags)**: alle sechs Figuren in 128 px (art/battle/<figur>), Bewegungen per PixelLab skeleton-v3 (feste Bewegungen wie chop, sweep, stab, rear_up, shoot_bow, hit, brace, guard; bleiben in der Seitenansicht, v3 drehte Figuren zum Betrachter). Gelenke für Bauer, König, Dame, Läufer. Packer misst Trefferbild und Reichweite je Angriff und Körperbreite je Figur (meta in battle.json), entfernt lose Flecken (drop_specks).
- **Kampfregeln im Code**: Duellposition auf gleicher Bildhöhe, auf dem Brett, nicht auf Unbeteiligten; Angreifer läuft direkt dorthin; Abstand = Körper berühren sich höchstens, Waffe dringt ein; Fernkampf (Turm) mit Abstand; Treffer im Bild mit größter Reichweite; Kampfstand zwischen Aktionen; Dramaturgie-Regeln (validatePlan) für alle 30 Paarungen getestet. Bild-für-Bild-Prüfung mit tools/review/battle-strip.mjs geprüft: pp, np, kp, bp, rp, qp, qn.
- **Verworfen**: v3-Animationen in 128 px (Bauer drehte sich weg, Schlieren); König-Kampfstand ohne Schwert (neu mit Handpositionen); Läufer-Treffer ohne Stab (weggelassen).
- **Prüfung aller 30 Paarungen (14.11. abends)**: alle Kämpfe Bild für Bild aufgenommen (Zugfolgen siehe Scratchpad-Liste im Verlauf, Werkzeug battle-strip.mjs). Gefunden und behoben:
  - Bauern-Angriff schaute 6 von 8 Bildern zum Betrachter: neuer Speerstoß per skeleton-v3 (stab), die ersten 3 Bilder verworfen (art/battle/p/REMAP mit Umbenennung, SKIP für den alten Angriff).
  - Angreifer stellte sich im Gedränge auf Unbeteiligte (Ecke a8, Grundreihe): Opfer tritt bei Bedarf einen halben Schritt heraus, Gedränge wird in Brettkoordinaten geprüft.
  - Pfeiltreffer ließen das Opfer bis zum nächsten Schritt weiß: Aufblitzen klingt nach 0,15 s ab.
- **Springer neu (Wunsch Sebastian: brutaler, galoppieren statt fliegen)**: neue Bewegungen per skeleton-v3 (kick, rear_up+paw, fall_over, run). Finisher "hufe" für alle Opfer: Umdrehen und Ausschlagen mit den Hinterhufen (Bauer, Läufer, Dame fliegen weg, Springer stürzt gezeichnet zur Seite, Turm wird eingetreten) oder Aufbäumen und Niedertrampeln (Opfer duckt sich in Deckung, wird zerquetscht oder zerplatzt). Gezeichneter Sturz für jeden Kämpfer mit "die"-Bildern. Galopp auf dem Brett und beim Anlauf statt Bogensprung. Die Brettfigur ist jetzt die verkleinerte Kampf-Figur (tools/downscale_char.py), damit Brett und Kampf dasselbe Pferd zeigen; die alte Ruhe-Eigenheit des Springers entfällt. Packer: Trefferbild auch nach hinten (impactBack, back) und von Hand (IMPACT-Datei).
- **Verworfen**: Rammen (headbutt) des Pferdes, Pferd liegt dabei flach (SKIP).

## Budget PixelLab

Startwert: 40 Generierungen (Trial). Abbruchgrenze: unter 4.

| Posten | verbraucht |
|---|---|
| unzoom (verworfen) | 0,1 |
| image_to_pixelart Aufstellung | 1 |
| 6 Figuren (v3 mit Referenz, Springer standard) | 6 |
| Springer Versuch 1 (verworfen, ohne Pferd) | 1 |
| Ruhe Bauer (8 Bilder, 92er Leinwand) | 2 |
| Ruhe König, Dame, Läufer, Springer, Turm (4 Bilder) | 5 |
| Angriffe Bauer, König, Dame, Läufer, Turm, Springer | 6 |
| Laufen Vorlage Bauer n/s (n verworfen: falscher Wappenrock) | 2 |
| Laufen v3: Bauer n, Dame n/s/e, König n/s/e, Läufer ne/se | 9 |
| Turm-Laufen (abgebrochen, nicht berechnet) | 0 |
| Prototyp: Aufstellung 2x (1), Bauer 128 (2), Skelett (0,1), Speerhieb 8 Bilder auf 180er Leinwand (4) | 7,1 |
| **Summe laut PixelLab** | **39,2 von 40, Rest 0,8** |
| Guthaben (aufgeladen 10 $): 6 Figuren 128 px, rund 30 Bewegungen, Skelette | 0,69 $ verbraucht, 9,31 $ übrig |

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
- **Turm bewegt sich ohne Eigenleben:** hüpfender Turm wäre zu nah am verbotenen lebenden Steinturm; er gleitet mit Staub, nur der Schütze oben ist lebendig.
- **Farbangleich:** Animationsbilder werden beim Packen auf die Palette der Ruhebilder derselben Figur gezogen (kein Farbflackern beim Wechsel).
- **Budget-Verteilung abweichend vom Auftrag:** Die Trial (40) reichte nicht für eine Viertel-Aufteilung mit 8-Bild-Animationen; Umgebung kam deshalb komplett aus OpenAI und Code (0 Generierungen), der Rest ging in Angriffe und Laufen. Abbruchgrenze (unter 4) nie erreicht.

## Verworfene Versuche

- Figuren direkt aus lineup_v1 herunterrechnen: matschig.
- unzoom_image auf der gpt-Aufstellung: kein Raster erkannt.
- Isometrisches Rautenbrett: von Sebastian abgelehnt.
- Springer v3 mit Referenz: Pferd verschwunden.
- Bauer Laufen Richtung Norden per Vorlage (template walking): Rückansicht mit fremdem Wappenrock; ersetzt durch v3.

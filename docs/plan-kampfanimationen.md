# Plan: Kampfanimationen für alle Figuren

Ziel (Sebastian, 14.11.): Animationen sind das Wichtigste. Stimmig, sinnvoll, physikalisch korrekte Positionen.

## Stand

- Bauer hat Kampf-Sprites in 128 px, Skelett, Speerhieb (8 Bilder), Abtrennen und Verbluten.
- Dramaturgie-Regeln im Planer (src/battle/kit.ts, validatePlan) für alle 30 Paarungen getestet.
- Bild-für-Bild-Aufnahme: tools/review/battle-strip.mjs (FORCE_DEATH=... erzwingt eine Todesart).

## Schritte

1. Je Figur (Springer, Läufer, Turm, Dame, König) Kampf-Sprite in 128 px aus art/ref128, Skelett schätzen.
2. Je Figur fünf gezeichnete Bewegungen in der Seitenansicht, 12 bis 16 Bilder: Kampfstand (Schleife), Hauptangriff, zweiter Angriff, Treffer-Reaktion, Parade. Bauer bekommt die fehlenden vier.
3. Jede Animation automatisch prüfen (Bildstreifen): Blick und Waffe zum Gegner, gleiche Farben wie die Figur, kein Kreuz, Füße am Boden. Höchstens 3 Versuche.
4. Physik-Regeln im Code mit Tests:
   - Abstand der Kämpfer = Reichweite der Waffe (Speer, Hellebarde lang; Schwert, Stab mittel; Pferd groß).
   - Treffer genau im Bild, in dem die Waffe am weitesten vorn ist (aus den Bildern ermittelt), nicht nach fester Zeit.
   - Rückstoß, Sturz und fliegende Teile immer weg vom Angreifer; Teile landen und bleiben liegen.
   - Kämpfer schauen sich immer an (Test).
   - Fußpunkt je Bild stabil (kein Schweben, kein Rutschen ohne Schritt).
5. Eigene Abläufe für alle 30 Paarungen aus den Bausteinen, alle durch validatePlan und je einmal Bild für Bild angesehen.

## Kosten

PixelLab-Guthaben 10 $. Laut PixelLab kostet eine 128-px-Animation mit 8 Bildern typisch 0,03 $ (bis 0,22 $), eine Figur 0,08 $ (bis 0,15 $). Geschätzt 25 bis 30 Animationen gesamt: etwa 1 bis 7 $.

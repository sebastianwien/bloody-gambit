# Wolfsschach - Vorschau

Browser-Schach im düsteren Mittelalter: Jedes Schlagen löst eine Pixel-Kampfszene aus.

## Starten

Einmalig Abhängigkeiten installieren:

```bash
cd ~/private/kampfschach && npm install
```

Nur das Spiel (Einzelspieler, zu zweit am Rechner), dann http://localhost:5180 öffnen:

```bash
npm run dev
```

Nur der Online-Server (Port 8790):

```bash
npm run server
```

Beides zusammen:

```bash
npm run start:all
```

Statische Seite bauen (Ergebnis in `dist/`) und ansehen:

```bash
npm run build && npm run preview
```

Server als Docker-Container:

```bash
docker build -t wolfsschach-server . && docker run --rm -p 8790:8790 wolfsschach-server
```

Tests:

```bash
npm test
```

```bash
npm run e2e
```

Schnellstarts für Tests und Vorführung: `?start=local`, `?start=ai&level=1&color=w`, `?start=menu`, Online-Raum direkt betreten mit `?room=CODE`, anderer Server mit `?server=wss://...`.

## Was in jeder Phase entstanden ist

**1 Fundament.** Steinbrett aus Spielersicht mit leichter Perspektive, alle Regeln über chess.js (Rochade, en passant, Umwandlung mit Auswahl, Schach, Matt, Patt, Wiederholung, 50 Züge, zu wenig Material), Auswahl per Klick mit erlaubten Feldern, zu zweit am Rechner. Fehlt nichts.

**2 KI.** Eigene Engine im Web Worker mit Eröffnungsbuch und drei Stufen (Knappe, Ritter, Hochmeister), jeder Zug unter 2 Sekunden. Der Hochmeister rechnet etwa 6 bis 8 Halbzüge tief; gegen starke Spieler reicht das nicht, für Gelegenheitsspieler ist er hart.

**3 Stil und Figuren.** Stil-Blatt in `docs/stilblatt.md`, sechs Figuren aus PixelLab mit acht Blickrichtungen, Schwarz per Palettentausch. Ruhe-Eigenheiten (Gähnen, Krone richten, Hellebarde drehen, Segnen) für die gegnerische Armee; die eigene Armee schaut sich in Ruhe um. Der Springer kommt aus einem anderen PixelLab-Modus und ist etwas flacher schattiert als die anderen.

**4 Bewegung.** Laufen in alle acht Richtungen mit Schritten und Schaukeln, Springer springt im Bogen, Rochade mit König und Turm. Eigene Laufbilder gibt es nur, so weit das Budget reichte (siehe fortschritt.md).

**5 Kampf-Baukasten.** Alle 30 Paarungen laufen: Anlauf, Finisher, Tod-Varianten (umfallen, Kopf ab, zweigeteilt, zerplatzen, plattgedrückt, verbrennen, Pfeile, Turm stürzt ein), Kamera-Zoom, Blut als Partikel, Blutflecken bleiben liegen, Bildschirmwackeln, Trefferblitz. Klick oder Leertaste spult vor.

**6 Menüs und Rahmen.** Ladebildschirm, Titel mit Kamerafahrt, Hauptmenü, Einstellungen (Musik, Effekte, Kämpfe immer/nur neue/aus, Blut, KI-Stufe, Zugvorschau), automatisches Speichern und Fortsetzen, Zug zurück, Zugliste, geschlagene Figuren, Pause, Spielende mit Revanche, Mitwirkende mit Lizenzen.

**7 Online.** Raum per Code oder Link, Server prüft jeden Zug, Schachuhr wählbar, 60 Sekunden zum Wiederverbinden, Aufgeben, Remis, Revanche mit Farbtausch. Nicht deployt; Hosting ist ein eigener Schritt (Dockerfile liegt bei).

**8 Umgebung.** Burgruine bei Nacht, Regen mit Spritzern, Feuerschalen mit Flackerlicht und Glut, Doppelblitz mit Donner, Nebel, Krähen und Ratten.

**9 Ton.** Eigener Musik-Sequencer (Menü, Partie, Sieg, Niederlage, nahtlos), rund 40 prozedurale Effekte, Regen und Fackelknistern.

**10 Finisher und Sonderszenen.** Eigene Finisher für die häufigsten Paarungen (Bauer gegen Bauer, Springer, Läufer, Dame, König und Turm gegen Bauer, Bauer gegen Springer, Springer gegen Springer), Angriffsbilder je Figur, Schach-Reaktion des Königs, Matt mit stürzendem König und rollender Krone, Patt mit Ratlosigkeit, Siegesjubel.

**11 Abschluss.** Siehe fortschritt.md.

## Offene Ideen

- Eigene Finisher für die übrigen 22 Paarungen.
- Laufbilder für alle Richtungen, Sterbe-Animationen aus PixelLab statt im Code.
- Zweite Armee mit eigenem Look.
- Hosting des Servers und der statischen Seite.
- Zuschauer für Online-Räume.

# Stil-Blatt Bloody Gambit

Referenz für jedes Bild im Spiel, ob von PixelLab, OpenAI oder im Code gezeichnet.

## Stimmung

Düsteres Mittelalter bei Nacht: Regen, Fackeln, Burgruine. Vorlage `bilder/moodboard_duester.webp`.
Ernst im Look, schwarzer Humor in den Kämpfen.

## Figuren

- Eine Armee: Ordensritter mit silbernem Wolfskopf auf dunkelrotem Schild, kein Kreuz.
- 64x64 Pixel je Bild, Figur 50 bis 62 Pixel hoch, Fußpunkt unten mittig.
- Umriss: 1 Pixel, fast schwarz (#0d0a0e bis #13060c), nicht rein schwarz.
- Licht: von links oben (Mond), Schatten rechts unten. Fackeln geben im Spiel warmes Zusatzlicht per Code.
- Weiß: cremefarbene Umhänge (#ddd4d0, #d0bbb5), helles Metall.
- Schwarz: per Palettentausch im Code (`toBlackArmy`): Umhänge zu kühlem Anthrazit, Metall geschwärzt, Rot, Haut und Gold bleiben.
- Silhouette je Figur eindeutig: Bauer Speer, Springer Pferd, Läufer Kapuze und Stab, Turm Steinturm mit Bogenschütze, Dame Hellebarde, König Krone und Zweihänder.

## Palette (Umgebung und Effekte, `src/scene/palette.ts`)

| Gruppe | Töne |
|---|---|
| Nacht | #0e0c1a #17142a #24203f #36325c #565283 |
| Stein | #1a171b #2a2629 #3d3838 #57504b #7a7166 #9c917f #c2b8a2 |
| Erde, Holz | #1f140d #35210f #553620 #2b1b10 #4a2f1a #6d4727 |
| Feuer | #6e1d0e #b8401a #e8862a #ffd25e #fff4c2 |
| Blut | #3c0609 #6e0d12 #a3161b #d42a26 |
| Akzente | Creme #e4d9bf, Silber #b8bcc4, Wolfsrot #7a1c22, Knochen #d8cfb4, Gold #d9a83a |

## Regeln

- Harte Pixelkanten, keine Weichzeichnung, Skalierung nur ganzzahlig oder pixelig.
- Bewegung mit 8 Bildern pro Sekunde, Brett und Hintergrund statisch, Leben über Schleifen und Partikel.
- Nichts aus Battle Chess: kein lebender Steinturm, keine Originaldesigns, -gags oder -sounds, kein grün-braunes Marmorbrett.

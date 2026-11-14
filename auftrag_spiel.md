# Auftrag: Kampfschach komplett bauen (autonom)

Arbeite diesen Auftrag ohne Rückfragen bis zum Ende ab. Du bist Game-Designer, Engineer und Art Director zugleich: Was zu einem fertigen, runden Spiel gehört und hier nicht steht, ergänzt du selbst und notierst es unter "Entscheidungen" in `fortschritt.md`. Nur bei einem Abbruchkriterium stoppen.

Arbeitsordner: `~/private/kampfschach/` (Pfade unten relativ dazu). Die Session startet in `~/private`, weil PixelLab nur dort registriert ist.

## Schalter

- `STILFREIGABE: nein` (bei `ja`: nach Phase 3 anhalten, Figuren zeigen, auf Freigabe warten)

## Vision

Ein Browser-Schachspiel, bei dem jedes Schlagen eine brutale, witzige Pixel-Kampfszene auslöst. Düsteres Mittelalter: Nacht, Regen, Fackeln, Burgruine. Fühlt sich an wie ein liebevolles Spiel aus den 90ern mit heutiger Technik. Desktop zuerst, Querformat.

## Kontext

Memory `project_kampfschach_idee` lesen. Vorlagen: `bilder/moodboard_duester.webp` (Stimmung), `bilder/lineup_v1.png` (Figuren). Feste Entscheidungen:
- Eine Armee (Ordensritter, Wappen silberner Wolfskopf auf Dunkelrot, kein Kreuz), Weiß und Schwarz per Palettentausch im Code.
- Kampf ist reine Show, die Schachregeln entscheiden. 30 Paarungen (König wird nie geschlagen).
- Nichts aus Battle Chess: kein Name, kein lebender Steinturm, keine Originaldesigns, -gags oder -sounds.
- Arbeitstitel "Wolfsschach", im Code eine zentrale Konstante.

## Umfang

**Spielmodi**
- Einzelspieler gegen KI, drei Stufen, Farbwahl
- Zwei Spieler am selben Rechner
- Online gegen einen Freund: Raum per Code oder Link, Server prüft jeden Zug, Wiederverbinden nach Abbruch (60 s Schonfrist, danach Sieg für den anderen), Aufgeben, Remis anbieten, Revanche, optionale Schachuhr (Bedenkzeit wählbar)

**Menüs und Rahmen**
- Ladebildschirm mit Fortschritt, Titelbildschirm mit animiertem Hintergrund
- Hauptmenü: Einzelspieler, Zwei Spieler, Online, Einstellungen, Mitwirkende
- Pausenmenü im Spiel, Spielende-Bildschirm (Sieg, Niederlage, Remis) mit Revanche und Zurück
- Einstellungen: Lautstärke Musik und Effekte getrennt, Kämpfe (immer, nur neue Paarungen, aus), Blut an oder aus, KI-Stufe, Zugvorschau an oder aus; gespeichert im Browser
- Laufende Partie gegen KI oder lokal wird automatisch gespeichert und kann fortgesetzt werden
- Zug zurücknehmen gegen KI und lokal
- Zugliste am Rand, letzte Züge markiert, geschlagene Figuren sichtbar
- Mitwirkende mit Lizenzhinweisen aller Bibliotheken

**Animationen**
- Je Figurentyp: Ruhe (mit kleinen Eigenheiten wie Gähnen, Schwert schärfen), Laufen in alle vier Diagonalrichtungen des isometrischen Bretts (Vorder- und Rückansicht gezeichnet, links und rechts gespiegelt), Springer springt
- Kampf-Baukasten: Anlauf, Finisher je Paarung, Tod-Varianten je Opfer (2 bis 3). Kamera zoomt auf das Feld. Blut als Partikel, Blutflecken bleiben auf dem Brett liegen, Bildschirmwackeln, Trefferblitz. 8 Bilder pro Sekunde. Klick spult vor.
- Sonderszenen: Schach (König reagiert), Matt, Patt, Rochade (König und Turm laufen), Umwandlung (Verwandlung), Sieg- und Niederlagenposen

**Umgebung**
- Brett aus Steinplatten mit Rand, eingebettet in eine Szene: Burgruine, Fackeln, toter Baum, Schädel, Fässer
- Lebendig: Regen, Fackelflackern mit Lichtschein, gelegentlich Blitz mit Donner, Nebel, Krähen oder Ratten als Kleinigkeiten
- Hintergrund als Ebenen, statisch gezeichnet, Bewegung nur über Loops und Partikel

**Ton**
- Musik: düster-mittelalterliche Stücke für Menü, Partie und Spielende, nahtlos loopend
- Effekte: Schritte je Figur, Waffenklirren, Treffer, Schreie, Spritzen, Fackeln, Regen, Donner, Menüklicks, Schach-Fanfare, Sieg und Niederlage

## Technik

- Vite + TypeScript, Rendering mit PixiJS oder Canvas 2D (selbst wählen, begründen), Sprite-Atlanten, alles vorgeladen.
- Schachregeln: `chess.js` (BSD), im Client und auf dem Server.
- KI: eigene Alpha-Beta-Suche mit Eröffnungsbuch im Web Worker, drei Stufen, Zug in unter 2 s.
- Online: kleiner Node-Server mit WebSockets in `server/`, autoritativ (prüft Züge mit chess.js, führt die Uhr), Räume im Speicher, keine Konten, keine Nutzerdaten speichern. Dazu ein Dockerfile. Nicht deployen, Hosting ist ein eigener Schritt.
- Ports: Spiel 5180, Server 8790 (5173, 8080, 5432 und 8025 sind belegt).
- Musik mit Tone.js oder eigenem WebAudio-Sequencer komponiert, Effekte prozedural (sfxr-artig, mit Rauschen und Hüllkurven geschichtet). Keine fremden Audiodateien.
- Nur Bibliotheken mit MIT-, BSD-, ISC- oder Apache-Lizenz, keine GPL.
- Tests: Vitest für Regeln, KI, Kampf-Baukasten, Server-Logik. Playwright für Menüs, komplette Partie gegen KI und eine Online-Partie mit zwei Browser-Kontexten gegen den lokalen Server.
- `git init` im Arbeitsordner, nach jeder Phase ein Commit. Kein Remote, nichts pushen.

## Phasen

Jede Phase endet spielbar, getestet und committet. Bricht der Lauf ab, bleibt ein nutzbares Spiel.

1. **Fundament:** Projekt, isometrisches Brett, Platzhalter-Figuren, alle Regeln (Rochade, en passant, Umwandlung mit Auswahl, Schach, Matt, Patt, Remis durch Wiederholung, 50 Züge, zu wenig Material), Zug per Klick mit erlaubten Feldern, lokal zu zweit.
2. **KI** mit drei Stufen.
3. **Stil und Figuren:** Stil-Blatt (Palette, Umriss, Lichtrichtung) festlegen und als Referenz für alle weiteren Bilder nutzen. 6 Figuren mit 64 px aus PixelLab, Vorder- und Rückansicht, Ruheanimation. Palettentausch für Schwarz.
4. **Bewegung:** Laufen in alle Richtungen, Springer-Sprung.
5. **Kampf-Baukasten** mit 6 allgemeinen Finishern (je Angreifer einer), damit alle 30 Paarungen sofort laufen, plus Tod-Varianten, Effekte, Blutflecken.
6. **Menüs und Rahmen** komplett (siehe Umfang).
7. **Online-Modus** mit Server.
8. **Umgebung** und Atmosphäre.
9. **Ton:** Musik und Effekte.
10. **Eigene Finisher** für die 30 Paarungen, beginnend mit den häufigsten (Bauer schlägt Bauer, Springer und Läufer schlagen Bauer), dazu die Sonderszenen. So weit das Budget reicht.
11. **Abschluss:** komplette Partien per Playwright (KI und online), Konsolenfehler null, Ladezeit unter 5 s lokal, `npm run build` erzeugt statische Seite in `dist/`, Server startet per Docker.

## Selbstprüfung

- Jedes erzeugte Bild selbst ansehen. Fertig, wenn Silhouette eindeutig, Pixelraster sauber, Hintergrund transparent, Stil passt zum Stil-Blatt, nichts erinnert an Battle Chess. Höchstens 3 Versuche je Bild, dann den besten nehmen und loggen.
- Nach jeder Phase: Tests grün, Spiel im eingebauten Browser öffnen, Screenshots selbst prüfen (auch während einer Kampfszene), Fehler beheben, dann Commit.
- Vor dem Abschluss einmal als Spieler denken: Ist der erste Eindruck stark? Gibt es tote Momente, fehlendes Feedback, nervige Wiederholungen? Gefundenes beheben.

## Gedächtnis über lange Laufzeit

`fortschritt.md` ist die einzige Wahrheit über den Stand: erledigte Phasen mit Commit, aktuelle Phase, Entscheidungen, verworfene Versuche, verbrauchte Credits. Nach jeder Phase aktualisieren. Nach einer Kontext-Zusammenfassung zuerst diese Datei lesen und dort weitermachen.

## Budget und Abbruch

- Zu Beginn PixelLab-Credits abfragen und auf die Phasen aufteilen (Phase 3 und 4 zusammen ein Drittel, Phase 5 und 8 ein Viertel, Rest für Phase 10, 10 Prozent Reserve).
- Abbruch, wenn die PixelLab-Credits unter 10 Prozent des Startwerts fallen, OpenAI mehr als 5 $ kostet oder ein Werkzeug dauerhaft ausfällt. Dann die laufende Phase so weit wie möglich sauber abschließen und melden.

## Lieferung

- `fortschritt.md` aktuell
- `vorschau.md`: Startbefehle (Spiel, Server, beides zusammen), ein Absatz je Phase (was geht, was fehlt), offene Ideen
- Abschlussmeldung in drei Sätzen auf Deutsch: was funktioniert, was nicht, wie viel verbraucht

## Nicht im Umfang

Hosting und Deploy, zweite Armee, Handy-Layout, Konten, Bestenlisten, Chat.

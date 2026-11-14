# Einrichten unter Windows

Für alle, die mit der Claude-Desktop-App (Reiter Code) oder von Hand mitmachen wollen. Dauer: etwa 10 Minuten.

## Was du brauchst

| Werkzeug | Wofür | Pflicht? |
|---|---|---|
| Git for Windows | Code holen und hochladen. Bringt die Git Bash mit, in der auch die Skripte unter `tools/` laufen | ja |
| Node.js 24 oder neuer | Spiel starten, Tests, Online-Server | ja |
| GitHub-Konto mit Einladung ins Repo | Hochladen | ja |
| Chromium für Playwright | nur für die Browser-Tests (`npm run e2e`) | nein |
| uv | nur zum Neupacken der Figurenbilder (`tools/pack_atlas.py`) | nein |

## Der kurze Weg: Claude machen lassen

Öffne in der Claude-Desktop-App den Reiter Code, wähle einen leeren Ordner und schreib:

> Richte das Projekt https://github.com/sebastianwien/bloody-gambit auf diesem Windows-Rechner ein. Prüfe, ob Git und Node.js 24 oder neuer installiert sind, und installiere Fehlendes mit winget. Klone das Repo, führe npm install aus, lass die Tests laufen und starte das Spiel. Halte dich an docs/einrichten-windows.md und sag mir, wenn ich etwas selbst bestätigen muss.

Claude liest danach die Datei `CLAUDE.md` im Repo und kennt damit Befehle und Regeln des Projekts. Windows fragt bei den Installationen nach deiner Bestätigung.

## Von Hand

1. PowerShell öffnen (Startmenü, „PowerShell“ tippen) und die Werkzeuge installieren:

```powershell
winget install --id Git.Git -e
```

```powershell
winget install --id OpenJS.NodeJS.LTS -e
```

2. PowerShell schließen und neu öffnen, damit die Programme gefunden werden. Prüfen:

```powershell
git --version; node --version
```

Node muss 24 oder höher anzeigen.

3. Repo holen und Abhängigkeiten installieren:

```powershell
git clone https://github.com/sebastianwien/bloody-gambit.git
```

```powershell
cd bloody-gambit; npm install
```

4. Spiel starten und http://localhost:5180 öffnen:

```powershell
npm run start:all
```

5. Tests:

```powershell
npm test
```

## Hochladen

Beim ersten `git push` öffnet Git for Windows ein Anmeldefenster von GitHub im Browser. Danach merkt es sich die Anmeldung. Vorher musst du die Einladung ins Repo angenommen haben (Mail von GitHub).

Einmalig Name und Adresse für deine Commits setzen:

```powershell
git config --global user.name "Dein Name"
```

```powershell
git config --global user.email "deine@adresse"
```

Die Adresse ist im öffentlichen Repo sichtbar. Wer das nicht will, nimmt die Noreply-Adresse von GitHub (Einstellungen, Emails, „Keep my email addresses private“).

## Typische Stolpersteine

- **„npm kann nicht geladen werden, weil die Ausführung von Skripts deaktiviert ist“:** PowerShell blockiert Skripte. Einmalig erlauben:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

- **„git“ oder „node“ wird nicht gefunden:** Nach der Installation wurde das Fenster nicht neu geöffnet. Bei der Desktop-App: App ganz beenden und neu starten.
- **Port 5180 oder 8790 belegt:** Es läuft schon ein Spiel oder Server in einem anderen Fenster. Dort mit Strg+C beenden.
- **Skripte unter `tools/` mit Endung `.sh`:** laufen in der Git Bash, nicht in der PowerShell, zum Beispiel `bash tools/fetch_character.sh p <kennung>`. `gen_image.sh` (Bilder über OpenAI) ist ein zsh-Skript und läuft nur unter macOS und Linux.

## Optional

Browser-Tests:

```powershell
npx playwright install chromium
```

```powershell
npm run e2e
```

Figurenbilder neu packen:

```powershell
winget install --id astral-sh.uv -e
```

```powershell
uv run --with pillow --with numpy python tools/pack_atlas.py
```

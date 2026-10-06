# Kumo – Desktop-Begleiter

Ein kleines Wolkenschaf, das über deinem Desktop schwebt. Jede Mausbewegung zählt als Schritt, dazu gibt es einen Pomodoro-Timer und eine Pausen-Erinnerung.

## Starten (Mac)

Voraussetzung: Node.js ab Version 20 (`node -v` im Terminal).

```bash
cd kumo-desktop
npm install
npm start
```

## Als echte App bauen

```bash
npm run dist
```

Danach liegt in `dist/` eine `Kumo-1.0.0-arm64.dmg` (Apple Silicon) und eine x64-Variante. Öffnen, Kumo in den Programme-Ordner ziehen, fertig. Die App ist nur ad-hoc signiert. Weil du sie selbst gebaut hast, startet sie trotzdem ohne Warnung. Gibst du sie weiter, muss der Empfänger beim ersten Start Rechtsklick → Öffnen wählen.

Tipp: Unter Systemeinstellungen → Allgemein → Anmeldeobjekte kannst du Kumo beim Login starten lassen.

## Bedienung

| Taste | Startansicht | Pomodoro-Ansicht |
|---|---|---|
| **A** | Streicheln | Start / Pause |
| **B** | Rufen | Zurücksetzen |
| **C** | Ansicht wechseln: Kumo → Schritte → Freundschaft → Pomodoro | |

Wenn das Fenster aktiv ist, gehen auch die Tasten A, S und D. Du kannst das Gerät überall greifen und verschieben. Die Leiste darunter hat vier Knöpfe: Pomodoro, Immer im Vordergrund, Einstellungen und Verstecken. Das Symbol in der Menüleiste zeigt beim laufenden Pomodoro die Restzeit an und hat ein eigenes Menü.

## So funktioniert's

- **Schritte:** Der Hauptprozess fragt alle 40 ms die Mausposition ab (`screen.getCursorScreenPoint`). Alle 400 px Mausweg (einstellbar) gibt es einen Schritt. Sprünge über 800 px, etwa beim Wechsel des Bildschirms, werden ignoriert. Dafür braucht es keine Bedienungshilfen-Rechte.
- **Pausen-Erinnerung:** Nutzt die Leerlaufzeit des Systems, also Maus *und* Tastatur. Nach 50 Minuten Aktivität ohne 5 Minuten Ruhe gibt es eine Mitteilung. Machst du dann Pause, freut sich Kumo. Ignorierst du die Erinnerung mehrmals, sinkt seine Laune. Während ein Pomodoro läuft, übernimmt der Timer die Pausen.
- **Pomodoro:** 25 / 5 / 15 Minuten, nach 4 Runden kommt eine lange Pause. Die Pause startet automatisch, die nächste Fokus-Runde startest du selbst. Jede geschaffte Runde stärkt die Freundschaft.
- **Laune & Freundschaft:** Steigen durch Schritte, Streicheln, geschaffte Pomodoros und echte Pausen. Zu viel Streicheln nervt Kumo. Nach langer Abwesenheit schmollt es, wenn ihr euch noch nicht gut kennt. Nachts (22–6 Uhr) schläft Kumo.
- **Speicher:** Alles bleibt lokal auf deinem Mac (`~/Library/Application Support/Kumo`).

## Dateien

```
main.js          Hauptprozess: Fenster, Maus-Abfrage, Leerlauf, Menüleiste, Mitteilungen
preload.js       sichere Brücke zum Fenster
renderer/        Oberfläche: Gerät, Pixel-Engine, Pomodoro, Einstellungen
assets/          Menüleisten-Symbol
build/icon.png   App-Symbol
```

Debug-Ausgabe der Mauswege: `KUMO_DEBUG=1 npm start`

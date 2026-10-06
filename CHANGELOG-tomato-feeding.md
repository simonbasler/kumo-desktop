# Änderungen: Tomaten-Füttern Feature

**Datum:** 2026-10-06

## Übersicht

Kumo kann jetzt mit erfolgreich abgeschlossenen Pomodoro-Sessions gefüttert werden. Jede geschaffte Pomodoro-Runde erzeugt eine Tomate, die dem Wolkenschaf gegeben werden kann, um die Freundschaft zu stärken.

## Änderungen im Detail

### 1. Text-Änderung
- **Wo:** `renderer/index.html` Zeile 18
- **Alt:** "STEP PAL"
- **Neu:** "DESKTOP PAL"
- **Grund:** Kumo ist mehr als nur ein Schrittzähler – es ist ein vollwertiger Desktop-Begleiter

### 2. Tomaten-Fütter-Mechanik

#### Konzept
- Jede geschaffte Pomodoro-Runde erzeugt eine "Tomate"
- Diese Tomaten können an Kumo verfüttert werden
- Füttern erhöht die Freundschaft (Bond) ohne tägliches Limit
- Gefütterte Tomaten verschwinden vom Display
- **Keine Hunger-Mechanik** – es ist ein optionales Belohnungssystem

#### State-Erweiterung
```javascript
S.tomatosFed = 0  // Zählt gefütterte Tomaten (lifetime)
```

#### Verfügbare Tomaten berechnen
```javascript
feedableTomatos = pomosToday() - (bereits heute gefüttert)
```

#### Interaktionspunkte

**Pomodoro-Screen:**
- Tomaten am unteren Rand einzeln anklickbar
- Klick auf Tomate → Feed-Animation → Tomate verschwindet
- Nur verfügbare (nicht gefütterte) Tomaten sind klickbar

**Hauptscreen:**
- Kleine Tomate rechts hinter der Punktzahl-Anzeige
- Nur sichtbar wenn `feedableTomatos > 0`
- Zeigt Anzahl verfügbarer Tomaten an (z.B. "🍅×3")
- Klickbar → füttert eine Tomate

#### Fütter-Effekte
- Animation: Kumo zeigt Happy-Animation
- Bubble: Herz erscheint
- Sound: Freudiger Beep
- Bond: +2 pro Tomate (kein tägliches Cap)
- Mood: +3 pro Tomate
- Say-Text: "Kumo freut sich über die Tomate!" (variiert je nach Bond-Level)

#### Daily Reset
- Bei Tageswechsel: Zähler für "heute gefüttert" wird zurückgesetzt
- Neue Pomodoros können wieder verfüttert werden
- Lifetime-Statistik `S.tomatosFed` bleibt erhalten

## Technische Umsetzung

### Neue Funktionen
- `feedableTomatos()` – Berechnet verfügbare Tomaten
- `feedTomato()` – Füttert eine Tomate, triggert Effekte
- Click-Handler für Tomaten im Pomodoro-Screen
- Click-Handler für Tomaten-Icon im Hauptscreen

### UI-Änderungen
- Tomaten im Pomodoro-Screen werden zu klickbaren Bereichen
- Cursor: pointer bei verfügbaren Tomaten
- Visuelles Feedback (hover-state optional)
- Neues Mini-Tomaten-Icon im Hauptscreen (rechts von der Punktzahl)

### State-Management
- Neues Property: `S.fedToday` – heute gefütterte Tomaten (wird bei dayKey-Wechsel zurückgesetzt)
- Neues Property: `S.tomatosFed` – lifetime Statistik
- Save nach jedem Füttern

## User-Facing Änderungen

**Vorher:**
- Pomodoros erhöhen automatisch Bond (max 4x/Tag)
- Tomaten sind rein dekorativ

**Nachher:**
- Pomodoros erzeugen fütterbare Tomaten
- User entscheidet wann gefüttert wird
- Füttern erhöht Bond ohne tägliches Limit
- Ermöglicht bewusste Interaktion und Belohnung
- Zusätzliche Motivation Pomodoros zu schaffen

## Designentscheidungen

- **Keine Hunger-Mechanik:** Füttern ist optional und positiv, kein Zwang
- **Einzeln füttern:** Bewusste Interaktion statt Massen-Klick
- **Sichtbar im Hauptscreen:** Reminder dass Tomaten verfügbar sind
- **Kein Bond-Cap beim Füttern:** Belohnt User die viele Pomodoros schaffen

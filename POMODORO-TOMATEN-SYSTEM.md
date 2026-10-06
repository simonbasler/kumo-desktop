# Pomodoro-Tomaten-System – Dokumentation

**Stand:** 2026-10-06

## Übersicht

Jede erfolgreich abgeschlossene Pomodoro-Runde erzeugt eine "Tomate". Diese Tomaten können an Kumo verfüttert werden, um die Freundschaft zu stärken.

---

## Wie entstehen Tomaten?

### Pomodoro abschließen

Wenn eine **Fokus-Phase** (25 Min. Standard) erfolgreich abgeschlossen wird:

1. **Pomodoro-Zähler erhöht sich:**
   ```javascript
   const k = dayKey(); // z.B. "2026-10-06"
   S.pomos[k] = (S.pomos[k] || 0) + 1;
   ```

2. **Tomate wird verfügbar:**
   - Jedes Pomodoro = 1 verfügbare Tomate
   - Tomaten sind tagesgebunden (heute geschaffte Pomodoros)

3. **Automatischer Bond-Bonus:**
   - +5 Laune (Mood)
   - +1 Bond (max 4x pro Tag via `pomoBond` Cap)

### Verfügbare vs. gefütterte Tomaten

```javascript
function feedableTomatos() {
  return Math.max(0, pomosToday() - S.fedToday);
}
```

**Beispiel:**
- Heute 4 Pomodoros geschafft → `pomosToday() = 4`
- Davon 2 gefüttert → `S.fedToday = 2`
- Verfügbar: `4 - 2 = 2` Tomaten

---

## Wo erscheinen Tomaten?

### 1. Hauptscreen (Screen 0)

**Position:** Rechts oben, neben der Schrittzahl

**Bedingung:** `feedableTomatos() > 0`

**Rendering:**
```javascript
const ft = feedableTomatos();
if (ft > 0) {
  const s = String(Math.min(99999, today()));
  const tx = W - 2 - tw(s) - 6; // 6px links von der Schrittzahl

  // Tomate zeichnen bei (tx, 1)
  TOMATO.forEach((row, r) => {
    for (let q = 0; q < 5; q++) {
      const c = row[q];
      if (c !== '0') px(tx + q, 1 + r, c === '2' ? P.leaf : P.heart);
    }
  });
}
```

**Click-Area:**
- X: `tx` bis `tx + 5` (5px breit)
- Y: `1` bis `6` (5px hoch)

### 2. Pomodoro-Screen (Screen 3)

**Position:** Unten, ab X=4

**Anzeige:**
- Alle heute geschafften Pomodoros werden als Tomaten angezeigt
- Maximal 5 Tomaten sichtbar (wenn mehr: "+X" Text rechts)
- Spacing: 7px zwischen Tomaten

**Rendering:**
```javascript
const n = pomosToday(); // Gesamt-Pomodoros heute
for (let i = 0; i < Math.min(n, 5); i++) {
  const tomX = 4 + i * 7; // X-Position: 4, 11, 18, 25, 32

  TOMATO.forEach((row, r) => {
    for (let q = 0; q < 5; q++) {
      const c = row[q];
      if (c !== '0') px(tomX + q, 37 + r, c === '2' ? P.leaf : P.heart);
    }
  });
}
```

**Click-Logik:**
- Nur die **nicht gefütterten** Tomaten sind klickbar
- Von links nach rechts: Letzte Tomaten sind fütterbar
- Beispiel: 4 Pomodoros, 2 gefüttert → Tomate 3 und 4 klickbar

```javascript
const n = pomosToday();
const ft = feedableTomatos();

// Nur die letzten `ft` Tomaten sind klickbar
for (let i = 0; i < Math.min(n, 5); i++) {
  if (i >= n - ft) { // Ist diese Tomate fütterbar?
    const tomX = 4 + i * 7;
    // Click-Area: X=[tomX, tomX+5), Y=[37, 42)
  }
}
```

**Click-Area pro Tomate:**
- Breite: 5px
- Höhe: 5px (Y: 37-42)

---

## Tomaten füttern

### Ablauf

1. **Click-Detection:**
   ```javascript
   cv.addEventListener('click', e => {
     const rect = cv.getBoundingClientRect();
     const scaleX = W / rect.width;
     const scaleY = H / rect.height;
     const x = Math.floor((e.clientX - rect.left) * scaleX);
     const y = Math.floor((e.clientY - rect.top) * scaleY);

     // Prüfe ob Click in Tomaten-Area
   });
   ```

2. **Füttern ausführen:**
   ```javascript
   function feedTomato() {
     if (feedableTomatos() <= 0) return; // Keine Tomaten verfügbar

     rollCaps(); // Tages-Reset prüfen
     S.fedToday++;      // Heute gefütterte Tomaten +1
     S.tomatosFed++;    // Lifetime-Statistik +1

     // Effekte
     S.bond = clamp(S.bond + 2, 0, 100);  // +2 Bond
     S.mood = clamp(S.mood + 3, 0, 100);  // +3 Laune

     // Animation & Feedback
     pet.happyUntil = Date.now() + 3000;  // 3 Sekunden happy
     hop();                                // Kumo hüpft
     bubble('heart', 2500);                // Herz-Bubble 2.5s
     jingle([523, 659, 784]);              // Melodie (C, E, G)

     // Text (variiert je nach Bond-Level)
     const msg = S.bond < 30
       ? 'Kumo schnuppert vorsichtig an der Tomate.'
       : S.bond < 60
       ? 'Kumo frisst die Tomate genüsslich.'
       : 'Kumo freut sich riesig über die Tomate!';

     say(msg, 4000); // 4 Sekunden anzeigen
     save();         // State speichern
   }
   ```

### Effekte beim Füttern

| Effekt | Wert | Dauer | Beschreibung |
|--------|------|-------|--------------|
| **Bond** | +2 | Permanent | Freundschaft steigt (kein tägliches Limit!) |
| **Mood** | +3 | Permanent | Laune verbessert sich |
| **Happy-Animation** | - | 3000ms | Kumo zeigt Happy-Augen |
| **Hop** | - | ~1s | Kumo hüpft einmal |
| **Herz-Bubble** | heart | 2500ms | Herz erscheint über Kumo |
| **Jingle** | C-E-G | ~360ms | Melodie mit 3 Tönen (523Hz, 659Hz, 784Hz) |
| **Say-Text** | - | 4000ms | Situativer Text unten |

### Say-Text Varianten

```javascript
if (S.bond < 30)
  → "Kumo schnuppert vorsichtig an der Tomate."

else if (S.bond < 60)
  → "Kumo frisst die Tomate genüsslich."

else // bond >= 60
  → "Kumo freut sich riesig über die Tomate!"
```

---

## Technische Details

### State-Properties

```javascript
S.pomos = {
  '2026-10-06': 4,  // Heute 4 Pomodoros geschafft
  '2026-10-05': 3,  // Gestern 3 Pomodoros
  // ...
}

S.fedToday = 2      // Heute 2 Tomaten gefüttert
S.fedDay = '2026-10-06'  // Letzter Feed-Tag
S.tomatosFed = 15   // Lifetime: 15 Tomaten gefüttert
```

### Täglicher Reset

Bei Tageswechsel (`rollCaps()`):

```javascript
function rollCaps() {
  const k = dayKey();

  // Reset tägl. Bond-Caps
  if (S.capDay !== k) {
    S.capDay = k;
    S.stepBond = 0;
    S.petBond = 0;
    S.pomoBond = 0;
  }

  // Reset Fed-Counter
  if (S.fedDay !== k) {
    S.fedDay = k;
    S.fedToday = 0; // Zurücksetzen → Neue Tomaten fütterbar
  }
}
```

**Wichtig:** Pomodoro-Tomaten bleiben täglich! Tomaten von gestern können heute nicht mehr gefüttert werden.

---

## Tomaten-Grafik

```javascript
const TOMATO = [
  '00200',  // Blatt oben (grün)
  '01110',  // Rund
  '11111',  // Tomate (rot)
  '11111',  // Tomate (rot)
  '01110'   // Rund
];

// Farben:
// '0' = transparent
// '1' = P.heart (rot) für Tomaten-Körper
// '2' = P.leaf (grün) für Blatt
```

**Größe:** 5×5 Pixel

**Rendering:**
```javascript
TOMATO.forEach((row, r) => {
  for (let q = 0; q < 5; q++) {
    const c = row[q];
    if (c !== '0') {
      px(x + q, y + r, c === '2' ? P.leaf : P.heart);
    }
  }
});
```

---

## Unterschied: Pomodoro-Completion vs. Tomaten-Füttern

| Aspekt | Pomodoro abschließen | Tomate füttern |
|--------|---------------------|----------------|
| **Trigger** | Automatisch nach 25 Min. | Manueller Click |
| **Bond-Bonus** | +1 | +2 |
| **Tägliches Limit** | Max 4x (via pomoBond Cap) | **Kein Limit** |
| **Mood-Bonus** | +5 | +3 |
| **Interaktion** | Passiv | Aktiv |
| **User-Control** | Nein | Ja (wann füttern?) |

**Design-Entscheidung:**
- Pomodoro-Completion gibt kleinen Auto-Bonus
- Tomaten-Füttern ist stärkere, bewusste Belohnung
- User kann entscheiden ob/wann gefüttert wird
- Füttern hat kein Limit → Belohnt produktive Tage

---

## User-Flow

### Szenario 1: Hauptscreen-Füttern

1. User schafft Pomodoro → Tomate verfügbar
2. Im Hauptscreen erscheint kleine Tomate rechts oben
3. User klickt auf Tomate
4. Kumo: Happy-Animation, Hop, Herz-Bubble, Melodie
5. Text: "Kumo frisst die Tomate genüsslich."
6. Bond +2, Mood +3
7. Tomate verschwindet (gefüttert)

### Szenario 2: Pomodoro-Screen-Füttern

1. User wechselt zu Screen 3 (Taste C mehrmals)
2. Sieht 3 Tomaten (3 Pomodoros heute)
3. Klickt auf erste Tomate
4. Effekte wie oben
5. Tomate bleibt sichtbar, aber nicht mehr klickbar
6. Nächste Tomate ist jetzt fütterbar

### Szenario 3: Kein Hunger-System

- User MUSS nicht füttern
- Tomaten bleiben verfügbar bis Mitternacht
- Kein Penalty wenn nicht gefüttert
- Nächster Tag: Alte Tomaten weg, neue Pomodoros = neue Tomaten

---

## Besonderheiten

### Keine Hunger-Mechanik
- Kumo verhungert nie
- Füttern ist optionale Belohnung
- Positives System, kein Stress

### Kein Bond-Cap beim Füttern
- Anders als Streicheln (max 5/Tag)
- Anders als Pomodoro-Completion (max 4/Tag)
- Unlimited Bond-Wachstum durch Tomaten

### Tages-Gebunden
- Tomaten von gestern verfallen
- Motiviert zu täglichen Pomodoros
- Fresh Start jeden Tag

### Visual Feedback
- Hauptscreen: Kleine Tomate = Reminder
- Pomodoro-Screen: Alle Tomaten = Achievement-Display
- Gefütterte bleiben sichtbar (aber ausgegraut/nicht klickbar)

---

## Code-Referenz

**Hauptdatei:** `renderer/app.js`

**Relevante Funktionen:**
- `pomosToday()` - Zeile 52
- `feedableTomatos()` - Zeile 53
- `feedTomato()` - Zeile 54-61
- `rollCaps()` - Zeile 62 (Tag-Reset)
- `topbar()` - Zeile 264-273 (Hauptscreen-Tomate)
- `pomoScreen()` - Zeile 341-355 (Pomodoro-Screen-Tomaten)
- Canvas Click-Handler - Zeile 397-410

**CSS-Anpassungen:** `renderer/style.css`
- `.glass` - Zeile 36: `-webkit-app-region:no-drag`
- `.bezel` - Zeile 33: `-webkit-app-region:no-drag`
- `.glass canvas` - Zeile 37: `-webkit-app-region:no-drag; cursor:pointer`

**Grafik-Konstante:**
- `TOMATO` - Zeile 33 in app.js

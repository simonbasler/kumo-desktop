# Freundschafts-System – Dokumentation

**Stand:** 2026-10-06

## Übersicht

Kumo hat ein Bond-System (Freundschaft) von 0-100. Der Bond-Wert beeinflusst Kumos Verhalten, Reaktionen und die visuelle Darstellung im Freundschafts-Screen.

---

## Bond-Wert (S.bond)

**Wertebereich:** 0 - 100 (Float)

**Start-Wert:** 4 (bei neuem Kumo)

### Wie Bond steigt:

| Aktion | Bond-Erhöhung | Tägliches Limit |
|--------|---------------|-----------------|
| **Schritte** | +1 pro 100 Schritte | Max 6/Tag |
| **Streicheln (Taste A)** | +0.6 | Max 5/Tag |
| **Pomodoro abschließen** | +1 | Max 4/Tag |
| **Pause machen (nach Erinnerung)** | +0.5 | Kein Limit |
| **Tomate füttern** | +2 | **Kein Limit** ✨ |

**Wichtig:** Tomaten-Füttern hat kein tägliches Cap, daher ist es der effektivste Weg um Bond schnell zu erhöhen.

---

## Freundschafts-Level

Der Bond-Wert wird in 5 Stufen kategorisiert:

| Bond-Wert | Level | Verhalten |
|-----------|-------|-----------|
| 0-19 | **Scheu** | Weicht manchmal beim Streicheln zurück, hält Abstand beim Rufen |
| 20-39 | **Neugierig** | Kommt näher, reagiert vorsichtig |
| 40-59 | **Vertraut** | Kuschelt beim Streicheln, wandert frei herum |
| 60-79 | **Freund** | Hüpft vor Freude bei Wiedersehen, freut sich riesig über Tomaten |
| 80-100 | **Bester Freund** | Maximale Zuneigung, hüpft spontan |

**Code:**
```javascript
const LEVELS = [
  [0, 'Scheu'],
  [20, 'Neugierig'],
  [40, 'Vertraut'],
  [60, 'Freund'],
  [80, 'Bester Freund']
];
```

---

## Visuelle Darstellung: Herzen im Freundschafts-Screen

Im Freundschafts-Screen (Taste C → Screen 2) werden 5 Herzen angezeigt.

### Füll-Logik

Jedes Herz repräsentiert einen 20-Punkte-Bereich:

- **Herz 1:** Bond 0-20
- **Herz 2:** Bond 20-40
- **Herz 3:** Bond 40-60
- **Herz 4:** Bond 60-80
- **Herz 5:** Bond 80-100

### Füll-Stufen pro Herz

Jedes Herz hat 3 Zustände:

1. **Leer (grau):** fill < 0.5
   - Bedeutet: Bond ist im unteren Teil des 20er-Bereichs
   - Beispiel: Bei Bond=23 ist Herz 2 noch leer/grau

2. **Halb voll (rot, linke Hälfte):** 0.5 ≤ fill < 1.0
   - Bedeutet: Bond ist im oberen Teil des 20er-Bereichs
   - Beispiel: Bei Bond=30 ist Herz 2 halb voll

3. **Ganz voll (rot):** fill ≥ 1.0
   - Bedeutet: Der 20er-Bereich ist komplett erreicht
   - Beispiel: Bei Bond=40+ ist Herz 2 ganz voll

### Berechnungs-Formel

```javascript
for (let h = 0; h < 5; h++) {
  const fill = clamp((S.bond - h * 20) / 20, 0, 1);
  // fill = 0.0 bis 1.0
  // Bei fill >= 0.5: Linke Herz-Hälfte wird rot
  // Bei fill >= 1.0: Ganzes Herz wird rot
}
```

### Beispiele

| Bond-Wert | Herz 1 | Herz 2 | Herz 3 | Herz 4 | Herz 5 |
|-----------|--------|--------|--------|--------|--------|
| 4 (Start) | Grau | Grau | Grau | Grau | Grau |
| 10 | Halb | Grau | Grau | Grau | Grau |
| 20 | Voll | Grau | Grau | Grau | Grau |
| 30 | Voll | Halb | Grau | Grau | Grau |
| 40 | Voll | Voll | Grau | Grau | Grau |
| 50 | Voll | Voll | Halb | Grau | Grau |
| 60 | Voll | Voll | Voll | Grau | Grau |
| 80 | Voll | Voll | Voll | Voll | Grau |
| 100 | Voll | Voll | Voll | Voll | Voll |

---

## Tomaten-Füttern und Bond

**Warum Tomaten besonders sind:**

- Alle anderen Bond-Erhöhungen haben ein tägliches Cap
- Tomaten-Füttern hat **kein Cap**
- Pro Pomodoro gibt es 1 Tomate
- Jede Tomate = +2 Bond

**Rechnung:**
- 4 Pomodoros/Tag = 4 Tomaten verfügbar
- 4 Tomaten × 2 Bond = **+8 Bond pro Tag** (nur durch Füttern)
- Von Bond 4 auf Bond 60 ("Freund"): ~7 Tage bei 4 Pomodoros/Tag

**Vergleich zu automatischem Pomodoro-Bond:**
- Pomodoro abschließen: +1 Bond (max 4/Tag)
- Tomaten füttern: +2 Bond (kein Limit)
- User hat die Kontrolle wann gefüttert wird
- Bewusste positive Interaktion statt passiver Bonus

---

## Technische Details

### State-Properties

```javascript
S.bond          // Float 0-100: Aktueller Freundschaftswert
S.tomatosFed    // Int: Lifetime-Zähler aller gefütterten Tomaten
S.fedToday      // Int: Heute gefütterte Tomaten
S.fedDay        // String: Tages-Key für Reset (YYYY-MM-DD)
```

### Täglicher Reset

Bei Tageswechsel (geprüft in `rollCaps()`):
- `S.fedToday` wird auf 0 zurückgesetzt
- Neue Pomodoros können wieder verfüttert werden
- `S.tomatosFed` (Lifetime) bleibt erhalten

---

## Design-Philosophie

1. **Stufen statt linearer Fortschritt:**
   - Die 5 Herzen zeigen klare Meilensteine
   - Jedes volle Herz = sichtbarer Fortschritt
   - User kann Stufen "sammeln"

2. **Keine Rückschritte:**
   - Bond sinkt nie (außer bei Reset)
   - Nur positive Verstärkung
   - Langfristige Beziehung aufbauen

3. **Belohnung für Produktivität:**
   - Pomodoros → Tomaten → Bond
   - Produktive Arbeit führt zu stärkerer Bindung
   - Füttern ist optionale Verstärkung

4. **Halbe Herzen = "Fast geschafft":**
   - Motivation zum Weitermachen
   - Nächstes volles Herz ist erreichbar
   - Visuelles Feedback für kleine Fortschritte

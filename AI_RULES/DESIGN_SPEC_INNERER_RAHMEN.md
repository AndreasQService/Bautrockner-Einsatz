# Design Spezifikation: Innerer Rahmen (Datenfelder)

Diese Spezifikation definiert den "Inneren Rahmen" für alle datenführenden Eingabefelder im QTool (Desktop Light Mode), um eine konsistente ERP-Leitstand-Optik zu gewährleisten.

## Parameter

| Eigenschaft | Wert | Beschreibung |
| :--- | :--- | :--- |
| **Rahmenstärke** | `1.5px` | Erhöhte Stärke für klare Abgrenzung zum Hintergrund. |
| **Rahmenfarbe** | `var(--color-input-border)` | Aktueller Wert: `#334155` (Slate-700). |
| **Hintergrund** | `var(--surface)` | Reinweiß (`#FFFFFF`) für maximalen Kontrast. |
| **Innenabstand** | `0.5rem 0.6rem` | Standard-Padding für gute Lesbarkeit. |
| **Eckenradius** | `4px` | Dezente Abrundung für professionellen Look. |
| **Schriftgröße** | `0.88rem` | Standard für Dateninhalte. |
| **Schriftfarbe** | `var(--text-main)` | Aktueller Wert: `#020617` (Tiefschwarz). |

## Implementierung (CSS / React)

In React-Komponenten sollte die Klasse `.form-input` verwendet werden. Falls Inline-Styles nötig sind, ist folgendes Muster einzuhalten:

```javascript
style={{ 
    padding: '0.5rem 0.6rem', 
    fontSize: '0.88rem', 
    backgroundColor: 'var(--surface)', 
    border: '1.5px solid var(--color-input-border)',
    color: 'var(--text-main)',
    width: '100%',
    borderRadius: '4px'
}}
```

## Anwendung
Gilt für:
- Kopfdaten (Projekt-Nr, Auftragsnummer, etc.)
- Adressfelder (Schadenort)
- Eigentümer-Details
- Alle generischen Texteingaben in Formularen

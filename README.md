# QTool – ERP-Plattform für Bautrocknung

## Projektbeschreibung
QTool ist eine spezialisierte ERP-Anwendung für die Q-Service AG zur Verwaltung von Wasserschadensanierungen, Bautrocknungen und Leckortungen. Die App ist für den Einsatz auf dem iPad (Feldarbeit) und Desktop (Büro) optimiert.

## Setup
1.  `npm install` – Abhängigkeiten installieren.
2.  `cp .env.example .env.local` – Umgebungsvariablen konfigurieren.
3.  `npm run dev` – Lokalen Entwicklungsserver starten.

## Speicherstrategie
*   **GitHub**: Quellcode, Migrationen und Dokumentation.
*   **Supabase**: Strukturierte Projektdaten, Benutzermanagement und Sync-Warteschlange.
*   **OneDrive**: Primärer Speicher für Fotos, PDF-Berichte und Projektdokumente.
*   **IndexedDB**: Lokaler Offline-Zwischenspeicher für Fotos und Projektänderungen (Sync-Queue).

## Branch-Strategie
*   **main**: Stabiler Release-Zweig (Produktion).
*   **dev**: Integrationszweig für getestete Features.
*   **feature/***: Arbeit an einzelnen Aufgaben (z.B. `feature/sync-fix`).

## Sicherheitsregeln (ULTRA-STRICT)
*   **Keine .env**: Credentials niemals einchecken!
*   **Keine Kundendaten**: Testdaten in `tests/` verwenden.
*   **Keine Medien**: Fotos (*.jpg, *.png) und Dokumente (*.pdf) gehören auf OneDrive, nicht ins Git.
*   **Keine API Keys**: Hardcodierte Schlüssel sind untersagt.

---
© 2026 Q-Service AG

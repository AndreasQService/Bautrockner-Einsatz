# iPad Priority Session Locking Workflow & Rule

## Übersicht
Dieses Regelwerk definiert die Funktionsweise des Session-Locking-Systems (Projektsperren) im QTool:

1. **iPad Vorrang (iPad-First Policy):**
   - Das iPad ist das primäre Arbeitsgerät des Außendienstes vor Ort beim Kunden.
   - Wenn ein iPad ein Projekt öffnet, übernimmt es die Bearbeitungssperre **automatisch und nahtlos** (`isIPad` Override in `useSessionLock.js`).
   - Der Techniker vor Ort stößt auf keine verschlossenen Sperr-Bildschirme, auch wenn im Büro am Desktop ein Tab geöffnet geblieben ist.

2. **Sofortige Freigabe bei Navigation zum Dashboard:**
   - Sobald ein Anwender (auf Desktop oder iPad) ein Projekt schließt oder zum Dashboard zurückkehrt, wird die Sperre in der Datenbank (`project_sessions`) **sofort und bedingunglos freigegeben** (`deleteSession()`).

3. **Völlige Isolation vom Sync-Worker:**
   - Das Session Locking betrifft ausschließlich die Tabelle `project_sessions`.
   - Es hat **keinerlei Einfluss** auf den Foto-Sync, den To-Do-Sync oder den Supabase/OneDrive-Datentransfer, um Netzwerkalarme oder Konsolenfehler zu vermeiden.

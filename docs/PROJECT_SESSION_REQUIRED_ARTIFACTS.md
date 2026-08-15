# Pflichtartefakte beim Projektabschluss

Ein Projekt darf nur `fully_confirmed` werden, wenn der aktuelle lokale
Projekt-Snapshot, sämtliche dazugehörigen Outbox-Vorgänge und alle im Snapshot
referenzierten Dateien verifiziert wurden.

Pflicht sind:

- Projektdaten und relationale Fachdaten (Räume, Messwerte, Geräte, To-dos)
- Schadens-, Aussen-, Mess- und bearbeitete Bilder
- im Projekt gespeicherte Messprotokoll-PDFs
- im Projekt gespeicherte Energieprotokoll-PDFs
- sonstige PDF-/Excel-Dateien, sobald sie als Projektartefakt referenziert sind
- OneDrive-Projektbackup `Projektdaten.json`

Für jede Pflichtdatei braucht es Supabase-Storage-Readback (Grösse und SHA-256)
und OneDrive-Readback (Item-ID, ETag soweit durch Graph geliefert, Grösse und
SHA-256). Ein JSON-Backup allein ist kein Projektabschluss.

Optional sind nur bewusst erzeugte, nicht im Projekt gespeicherte Exporte wie
ein lokal heruntergeladenes Excel. Sie werden nicht gezählt und dürfen während
einer offenen Projektsitzung keinen Cloud-Write auslösen. Sobald ein Export im
Projekt gespeichert/referenziert wird, wird er automatisch zum Pflichtartefakt.

Der Abschluss ist fail-closed: Teilfehler zeigen kein `Supabase OK` oder
`OneDrive OK`; bestätigt Übertragenes bleibt idempotent bestätigt und nur
fehlende Vorgänge werden wiederholt.

# QTool Test – ausführbare Fall-1-Checkliste

Status: **nur Testsystem / keine Live-Freigabe**. Kein Schritt darf gegen die
Live-Ref `yxdoecdqttgdncgbzyus` ausgeführt werden.

## Sicherheitsgrenzen

- `QTOOL_ENVIRONMENT=test`
- `VITE_SUPABASE_URL=https://aoxduqspiezzyqeqyzzl.supabase.co`
- keine alternativen Supabase-URL-Variablen
- `QTOOL_ONEDRIVE_TEST_ROOT=QTool_TEST_ONLY`
- `QTOOL_TEST_ONEDRIVE_DRIVE_ID` entspricht exakt `ONEDRIVE_DRIVE_ID` des
  Workers und `QTOOL_FALL1_ONEDRIVE_DRIVE_ACK` bestätigt dieselbe Drive-ID
- zwei verschiedene Testkonten in `QTOOL_TEST_IPAD_*` und
  `QTOOL_TEST_DESKTOP_*`
- eindeutige `QTOOL_RUN_ID` im Format `QTOOL-E2E-YYYYMMDD-HHMMSS-SUFFIX`
- Projekt-ID und Projektnummer enthalten die vollständige Run-ID;
  Projektnummer beginnt mit `TEST__`
- Mutation nur mit `--execute`, `QTOOL_FALL1_EXECUTE=$QTOOL_RUN_ID` und
  `QTOOL_FALL1_ACK=TEST-ONLY-MUTATIONS-AUTHORIZED`

Lokale Guard-Prüfung ohne externe Mutation:

```bash
node --test tests/stress_suite/guard.test.cjs tests/fall1/real_fall1_guard.test.cjs tests/fall1/real_fall1_runner_contract.test.cjs
```

## Migrationen im Testsystem

Vorher Schema-Dump, Policy-/Funktionsinventar und Zeilenzahlen sichern. Dann
nur auf Ref `aoxduqspiezzyqeqyzzl` in dieser Reihenfolge anwenden:

1. `20260801000000_unique_active_project_lock.sql`
2. `20260810000000_repair_sync_contract.sql`
3. `20260810010000_enqueue_project_image_upload.sql`
4. `20260810020000_onedrive_project_folder_queue.sql`
5. `20260810030000_expire_stale_project_locks.sql`
6. `20260811000000_secure_project_image_upload_status.sql`
7. `20260811010000_remove_anon_project_image_upload_policies.sql`
8. `20260813000000_single_owner_project_lock.sql`
9. `20260814000000_project_write_lock_enforcement.sql`

SQL-Fehler = sofortiger Stopp. Danach Schema-Diff und SQL-Contracttests.
`20260814000000` ist ausdrücklich nicht für Live freigegeben.

Rollback bedeutet nicht blindes `DROP`: Testzugriff sperren, Lauf stoppen,
vollständigen Test-Schema-Dump wiederherstellen und danach Schema-Hash sowie
Zeilenzahlen mit dem Vorher-Nachweis vergleichen. Run-Daten nur anhand der
vollständigen Run-ID entfernen, nie per Datum, kurzem Präfix oder Wildcard.

## Szenario und Fall 1

Die run-gebundene `QTOOL_FALL1_SCENARIO`-JSON enthält explizite Selektoren und:

- `expectedReadbacks`: jede Tabelle mit exakter `count`, allen `requiredIds`,
  Projektspalte und optional kanonischem SHA-256;
- `expectedMedia`: jedes Bild/Dokument mit Storage-Bucket, run-gebundenem Pfad,
  SHA-256, bestätigter OneDrive Item-ID und `oneDriveDriveId`, exakt gleich der
  freigegebenen Worker-Drive-ID. Der Graph-Readback muss dieselbe ID zusätzlich
  als `parentReference.driveId` liefern.

Der Lauf muss nachweisen:

1. iPad öffnet online und erhält atomar den Lock.
2. `Projekt offline verfügbar` und IndexedDB-Bestand sind bestätigt.
3. Desktop liest; sein Schreibversuch scheitert.
4. iPad geht offline, ändert alle Datenarten, lokale Rücklesung gelingt.
5. Offline-Ausstieg ist blockiert.
6. Online: expliziter Sync und `Supabase: OK · OneDrive: OK` sichtbar.
7. Tabellen: exakte Anzahl, IDs, Run-ID und optional Digest.
8. Storage und OneDrive: Größe und SHA-256.
9. Erst nach Navigation wird der Lock aufgehoben.

```bash
node tests/fall1/real_fall1_runner.cjs --execute
```

PASS nur mit vollständigem
`test-results/fall1/$QTOOL_RUN_ID/evidence.json`. Ein fehlender Nachweis oder
Timeout bleibt FAIL; Contracttests ersetzen diesen realen Lauf nicht.
Der PASS-Eintrag darf erst nach dem zentralen Evidenz-Gate geschrieben werden.

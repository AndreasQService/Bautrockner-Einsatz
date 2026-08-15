# QTool Test: kurzlebiger Automationszugang

Dieser Zugang ist ausschließlich für `qtool-test` und den Supabase-Test-Ref
`aoxduqspiezzyqeqyzzl` vorgesehen. Er verändert Live nicht und enthält keine
Zugangsdaten in URL, Git-Quellen oder Browser-Logs.

## Einmalige Aktivierung (noch nicht ausgeführt)

1. Migration `20260814030000_test_automation_access_audit.sql` ausschließlich im Testprojekt anwenden.
   Vorher in derselben Transaktion `set local app.settings.supabase_project_ref = 'aoxduqspiezzyqeqyzzl';`
   setzen. Ohne diese explizite Testbestätigung bricht die Migration absichtlich ab.
2. In Supabase Test einen eigenen Benutzer `qtool-e2e-operator@...` mit der Rolle
   `automation_operator` und minimalen RLS-Rechten anlegen. Kein Admin und keine Service-Role im Browser.
3. Nur im Vercel-Projekt `qtool-test` folgende verschlüsselte Server-Variablen setzen:
   - `QTOOL_AUTOMATION_ENABLED=true`
   - `QTOOL_AUTOMATION_ALLOWED_HOST=qtool-test.vercel.app`
   - `QTOOL_AUTOMATION_EXPECTED_GIT_REF=<exakter Test-Branch>`
   - `QTOOL_TEST_SUPABASE_URL=https://aoxduqspiezzyqeqyzzl.supabase.co`
   - `QTOOL_TEST_SUPABASE_ANON_KEY=<Test anon key>`
   - `QTOOL_TEST_SUPABASE_SERVICE_ROLE_KEY=<Test service role; server only>`
   - `QTOOL_AUTOMATION_USER_EMAIL=<dedizierter Testbenutzer>`
   - `QTOOL_AUTOMATION_USER_PASSWORD=<zufälliges Testpasswort>`
   - `QTOOL_AUTOMATION_HMAC_SECRET=<mindestens 32 zufällige Bytes>`
   - Client: `VITE_AUTOMATION_ALLOWED_HOST=qtool-test.vercel.app`
4. Automations-Runner signiert `keyId.issuedAt.nonce.host` per HMAC-SHA-256 und
   sendet Beweis und Nonce per POST. Derselbe Nonce ist aufgrund des Primärschlüssels nur einmal nutzbar.
5. Nach dem Lauf: `QTOOL_AUTOMATION_ENABLED=false`, HMAC-Secret rotieren und den
   Automationsbenutzer deaktivieren. Audit und RUN_ID bleiben erhalten.

## Freigabegates

- Host, Vercel-Projekt, Git-Ref und Supabase-Test-Ref müssen exakt stimmen.
- Der Beweis ist höchstens zwei Minuten alt und nur einmal nutzbar.
- Erfolgreiche, abgelehnte und fehlgeschlagene Ausgaben werden serverseitig auditiert.
- Browser erhält nur die Sitzung des dedizierten Operators, niemals Service-Role oder HMAC-Secret.
- Ohne vollständige Konfiguration antwortet der Endpunkt geschlossen mit 404/503.

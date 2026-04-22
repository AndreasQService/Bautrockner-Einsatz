-- ═══════════════════════════════════════════════════════════════════
-- QTool Sicherheits-Upgrade v1
-- Ausführen in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- SCHRITT 1: Soft-Delete Spalten hinzufügen
-- Nach diesem Schritt werden gelöschte Projekte NUR noch markiert,
-- nicht mehr permanent entfernt. Wiederherstellung jederzeit möglich:
--   UPDATE damage_reports SET deleted_at = NULL WHERE id = '<id>';
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE damage_reports
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by  TEXT        DEFAULT NULL;

-- Performance-Index für die WHERE deleted_at IS NULL Abfragen
CREATE INDEX IF NOT EXISTS idx_damage_reports_not_deleted
  ON damage_reports(deleted_at) WHERE deleted_at IS NULL;

-- RLS-Policy: Anonymen Schreibzugriff auf deleted_at verhindern
-- (verhindert, dass jemand deleted_at = NULL setzt um gelöschte Projekte zurückzuholen)
-- HINWEIS: Erst aktivieren wenn Auth eingerichtet ist!
-- DROP POLICY IF EXISTS "Nur eigene nicht-gelöschte Projekte" ON damage_reports;
-- CREATE POLICY "Nur eigene nicht-gelöschte Projekte" ON damage_reports
--   FOR SELECT USING (deleted_at IS NULL AND auth.role() = 'authenticated');


-- ───────────────────────────────────────────────────────────────────
-- SCHRITT 2: Automatischer updated_at Trigger
-- Setzt updated_at automatisch bei jedem UPDATE
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_updated_at ON damage_reports;
CREATE TRIGGER tr_set_updated_at
  BEFORE UPDATE ON damage_reports
  FOR EACH ROW
  EXECUTE PROCEDURE fn_set_updated_at();


-- ───────────────────────────────────────────────────────────────────
-- SCHRITT 3: Audit-Log Tabelle
-- Speichert JEDE Änderung an Projekten mit Vorher/Nachher-Vergleich.
-- Bei Datenverlust: Hier kann der letzte Stand wiederhergestellt werden.
-- ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS damage_reports_audit (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   TEXT        NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by  TEXT,
  action      TEXT        CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  -- Nur die Metadaten speichern (nicht den vollen report_data JSONB) um Speicher zu sparen
  old_status  TEXT,
  new_status  TEXT,
  old_data    JSONB,   -- Kompletter alter Datensatz
  new_data    JSONB    -- Kompletter neuer Datensatz (bei DELETE: NULL)
);

-- Index für schnelle Suche nach Projekt-ID
CREATE INDEX IF NOT EXISTS idx_audit_report_id
  ON damage_reports_audit(report_id, changed_at DESC);

-- RLS für Audit-Tabelle
ALTER TABLE damage_reports_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Audit lesbar für alle" ON damage_reports_audit
  FOR SELECT USING (true);
-- Schreiben NUR über Trigger (kein direkter Insert/Update/Delete)
CREATE POLICY IF NOT EXISTS "Audit nur über Trigger" ON damage_reports_audit
  FOR INSERT WITH CHECK (true);

-- Audit-Trigger Funktion
CREATE OR REPLACE FUNCTION fn_audit_damage_reports()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO damage_reports_audit (
    report_id,
    changed_by,
    action,
    old_status,
    new_status,
    old_data,
    new_data
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    -- Nutzer aus JWT-Token auslesen (funktioniert mit Supabase Auth)
    COALESCE(
      current_setting('request.jwt.claims', true)::json->>'email',
      'system'
    ),
    TG_OP,
    OLD.status,
    NEW.status,
    to_jsonb(OLD),
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_audit_damage_reports ON damage_reports;
CREATE TRIGGER tr_audit_damage_reports
  AFTER INSERT OR UPDATE OR DELETE ON damage_reports
  FOR EACH ROW
  EXECUTE PROCEDURE fn_audit_damage_reports();


-- ───────────────────────────────────────────────────────────────────
-- SCHRITT 4: Nützliche Abfragen für die Wiederherstellung
-- (Dokumentation / Spickzettel)
-- ───────────────────────────────────────────────────────────────────

-- Alle "gelöschten" Projekte anzeigen:
-- SELECT id, project_title, deleted_at, deleted_by FROM damage_reports WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC;

-- Ein Projekt wiederherstellen:
-- UPDATE damage_reports SET deleted_at = NULL, deleted_by = NULL WHERE id = '<PROJEKT-ID>';

-- Alle Änderungen an einem Projekt anzeigen:
-- SELECT changed_at, changed_by, action, old_status, new_status FROM damage_reports_audit WHERE report_id = '<PROJEKT-ID>' ORDER BY changed_at DESC;

-- Den letzten bekannten Stand eines Projekts anzeigen (vor einem DELETE):
-- SELECT old_data FROM damage_reports_audit WHERE report_id = '<PROJEKT-ID>' AND action = 'DELETE' ORDER BY changed_at DESC LIMIT 1;

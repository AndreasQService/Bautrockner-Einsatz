-- Supabase Migration: Upload-Journal für QTool
-- Führe dieses Skript im Supabase SQL-Editor aus
-- Datei: supabase/upload_journal_migration.sql

-- ─── Tabelle ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_image_uploads (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  local_image_id TEXT         NOT NULL,          -- = UploadItem.id (IndexedDB UUID)
  project_id     TEXT         NOT NULL,          -- QTool Projekt-ID
  sha256         TEXT,                           -- SHA-256 des Blobs
  status         TEXT         NOT NULL DEFAULT 'pending',  -- pending | verified
  remote_path    TEXT,                           -- OneDrive-Pfad
  remote_item_id TEXT,                           -- OneDrive Item ID (nach Verifikation)
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── Indizes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_image_uploads_project  ON project_image_uploads (project_id);
CREATE INDEX IF NOT EXISTS idx_image_uploads_local_id ON project_image_uploads (local_image_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_image_uploads_local_id ON project_image_uploads (local_image_id);

-- ─── RLS (Row Level Security) ─────────────────────────────────────────────────
ALTER TABLE project_image_uploads ENABLE ROW LEVEL SECURITY;

-- Jeder authentifizierte Nutzer kann seine eigenen Einträge verwalten
-- (Anpassen wenn Multi-User-Trennung nötig)
CREATE POLICY "Authenticated users can manage upload journal"
  ON project_image_uploads
  FOR ALL
  USING  (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ─── Trigger: updated_at automatisch setzen ───────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON project_image_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

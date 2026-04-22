-- ============================================================
-- QTool Variante C: Upload-Journal
-- project_image_uploads
-- ============================================================
-- Führe dieses Skript im Supabase SQL-Editor aus.
-- Reihenfolge: Tabelle → Index → RLS → Trigger → Storage-Bucket
-- ============================================================

-- 1. Tabelle anlegen
CREATE TABLE IF NOT EXISTS project_image_uploads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Wer hat das Bild erfasst?
  project_id       TEXT        NOT NULL,
  created_by       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name  TEXT,                          -- Klartextname für Protokoll
  
  -- Datei-Metadaten
  local_image_id   TEXT        UNIQUE,            -- ID in lokaler IndexedDB / DamageForm
  filename         TEXT        NOT NULL,
  mime_type        TEXT        NOT NULL DEFAULT 'image/jpeg',
  size_bytes       BIGINT,
  sha256           TEXT,                           -- Duplikat-Schutz
  
  -- Speicherpfade
  storage_bucket   TEXT        DEFAULT 'project-images',
  storage_path     TEXT,                           -- Supabase Storage Pfad
  remote_path      TEXT,                           -- Zielpfad in OneDrive/SharePoint
  remote_item_id   TEXT,                           -- Microsoft Graph Item ID nach Upload
  remote_etag      TEXT,                           -- Verifikations-ETag
  
  -- Upload-Session (für Resumable Upload)
  upload_session_url TEXT,
  bytes_uploaded   BIGINT      DEFAULT 0,
  
  -- Status
  -- local_only         → nur lokal gespeichert
  -- queued_for_sync    → wartet auf Supabase-Upload
  -- uploaded_to_backend→ in Supabase Storage
  -- queued_for_remote  → wartet auf Backend-Worker
  -- remote_uploading   → Upload läuft gerade
  -- remote_verified    → OneDrive/SharePoint bestätigt
  -- failed             → max. Retries erreicht
  -- needs_repair       → Upload unterbrochen, kann repariert werden
  storage_status   TEXT        NOT NULL DEFAULT 'local_only'
                   CHECK (storage_status IN (
                     'local_only', 'queued_for_sync', 'uploaded_to_backend',
                     'queued_for_remote', 'remote_uploading', 'remote_verified',
                     'failed', 'needs_repair'
                   )),
  
  -- Fehlerbehandlung
  retry_count      INT         DEFAULT 0,
  last_error       TEXT,
  last_attempt_at  TIMESTAMPTZ,
  
  -- Timestamps
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  verified_at      TIMESTAMPTZ
);

-- 2. Indices für Worker-Queries
CREATE INDEX IF NOT EXISTS idx_piu_status      ON project_image_uploads(storage_status);
CREATE INDEX IF NOT EXISTS idx_piu_project     ON project_image_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_piu_sha256      ON project_image_uploads(sha256);
CREATE INDEX IF NOT EXISTS idx_piu_local_id    ON project_image_uploads(local_image_id);
CREATE INDEX IF NOT EXISTS idx_piu_retry       ON project_image_uploads(retry_count, storage_status);

-- 3. Automatisches updated_at via Trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_piu_updated_at ON project_image_uploads;
CREATE TRIGGER set_piu_updated_at
  BEFORE UPDATE ON project_image_uploads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. RLS aktivieren
ALTER TABLE project_image_uploads ENABLE ROW LEVEL SECURITY;

-- Techniker: darf nur eigene Einträge sehen (über project_id, da kein Supabase-Auth im Frontend)
-- Vorerst: Service Role hat vollen Zugriff, anonyme User lesen nichts
CREATE POLICY "Service role full access"
  ON project_image_uploads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Frontend (anon) darf lesen und neue Einträge erstellen
-- (Schreiben bei Upload, Lesen für Status-Anzeige)
CREATE POLICY "Anon read own project"
  ON project_image_uploads
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anon insert"
  ON project_image_uploads
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon update own"
  ON project_image_uploads
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- 5. Storage Bucket für Zwischen-Blobs
-- (im Supabase Dashboard: Storage → Create Bucket → "project-images", nicht public)
-- Oder per SQL:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'project-images',
  'project-images',
  false,                          -- nicht öffentlich zugänglich
  52428800,                       -- 50 MB max pro Datei
  ARRAY['image/jpeg','image/png','image/heic','image/webp','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Service Role kann alles, anon kann in eigene Ordner schreiben
CREATE POLICY "Service role storage" ON storage.objects
  FOR ALL TO service_role USING (bucket_id = 'project-images');

CREATE POLICY "Anon upload" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'project-images');

CREATE POLICY "Anon read own" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'project-images');

-- ============================================================
-- Abschluss
-- ============================================================
-- Tabelle project_image_uploads ist bereit.
-- Nächster Schritt: Edge Function onedrive-upload-worker deployen.
-- Siehe: supabase/functions/onedrive-upload-worker/index.ts
-- ============================================================

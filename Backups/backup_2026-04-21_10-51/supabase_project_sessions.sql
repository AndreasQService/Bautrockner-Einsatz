-- ============================================================
-- QTool – Projekt-Sessions Tabelle
-- Führe dieses SQL im Supabase SQL Editor aus:
-- https://supabase.com/dashboard → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_sessions (
  session_token TEXT PRIMARY KEY,
  open_project_id TEXT,          -- NULL = kein Projekt offen
  mode TEXT DEFAULT 'desktop',   -- 'desktop' | 'technician'
  device TEXT DEFAULT 'Desktop',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: Row Level Security deaktivieren (interne App)
ALTER TABLE public.project_sessions DISABLE ROW LEVEL SECURITY;

-- Automatische Bereinigung: Sessions die > 2 Minuten inaktiv sind
-- (wird durch regelmäßige Cleanup-Abfragen im Client erreicht)

-- Index für schnelle Abfragen
CREATE INDEX IF NOT EXISTS idx_project_sessions_last_seen 
  ON public.project_sessions(last_seen);

CREATE INDEX IF NOT EXISTS idx_project_sessions_open_project 
  ON public.project_sessions(open_project_id);

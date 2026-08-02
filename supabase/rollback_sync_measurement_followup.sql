-- =====================================================================
-- QTool – Rollback: sync_measurement_followup
-- Dateipfad: supabase/rollback_sync_measurement_followup.sql
-- =====================================================================

DROP FUNCTION IF EXISTS public.sync_measurement_followup(
    TEXT,
    DATE,
    BOOLEAN,
    TEXT
);

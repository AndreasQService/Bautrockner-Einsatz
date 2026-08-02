-- =====================================================================
-- QTool – Rollback: complete_todo_with_successor
-- Dateipfad: supabase/rollback_complete_todo_with_successor.sql
-- =====================================================================

DROP FUNCTION IF EXISTS public.complete_todo_with_successor(
    UUID,
    UUID,
    TEXT,
    DATE,
    TEXT,
    TEXT,
    TEXT,
    TEXT
);

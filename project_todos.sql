-- =====================================================================
-- QTool – To-Do-System Migration v1
-- Ausführen in: Supabase Dashboard → SQL Editor → New Query
-- Target Database: aoxduqspiezzyqeqyzzl (Test-Supabase)
-- =====================================================================

-- 1. Create the project_todos table
CREATE TABLE IF NOT EXISTS public.project_todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.damage_reports(id) ON DELETE CASCADE,
    parent_todo_id UUID NULL REFERENCES public.project_todos(id),
    root_todo_id UUID NULL REFERENCES public.project_todos(id),
    task TEXT NOT NULL CONSTRAINT task_not_empty CHECK (char_length(trim(task)) > 0),
    due_date DATE NOT NULL,
    assigned_user_id TEXT NOT NULL,
    assigned_user_name TEXT NOT NULL,
    note TEXT NULL,
    closes_project BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'open' CONSTRAINT status_check CHECK (status IN ('open', 'done')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT NOT NULL,
    completed_at TIMESTAMPTZ NULL,
    completed_by TEXT NULL,
    
    -- parent_todo_id must not point to self
    CONSTRAINT no_self_reference CHECK (parent_todo_id <> id),
    
    -- completed_at/completed_by must match the status done/open
    CONSTRAINT completed_status_check CHECK (
        (status = 'done' AND completed_at IS NOT NULL AND completed_by IS NOT NULL) OR
        (status = 'open' AND completed_at IS NULL AND completed_by IS NULL)
    )
);

-- 2. Indexes for search and sort performance
CREATE INDEX IF NOT EXISTS idx_todos_project_id ON public.project_todos(project_id);
CREATE INDEX IF NOT EXISTS idx_todos_status ON public.project_todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON public.project_todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_assigned_user_id ON public.project_todos(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_todos_root_todo_id ON public.project_todos(root_todo_id);
CREATE INDEX IF NOT EXISTS idx_todos_project_id_status ON public.project_todos(project_id, status);

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE public.project_todos ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Todos read access for authenticated" ON public.project_todos;
CREATE POLICY "Todos read access for authenticated" ON public.project_todos
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Todos insert access for authenticated" ON public.project_todos;
CREATE POLICY "Todos insert access for authenticated" ON public.project_todos
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Todos update access for authenticated" ON public.project_todos;
CREATE POLICY "Todos update access for authenticated" ON public.project_todos
    FOR UPDATE TO authenticated USING (status = 'open') WITH CHECK (status = 'open');

-- NOTE: No DELETE policy is created, physical deletion is forbidden.

-- 5. Trigger to prevent reopening completed todos
CREATE OR REPLACE FUNCTION public.fn_prevent_reopening_todo()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'done' AND NEW.status = 'open' THEN
        RAISE EXCEPTION 'Erledigte To-dos dürfen nicht wieder geöffnet werden.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_prevent_reopening_todo ON public.project_todos;
CREATE TRIGGER tr_prevent_reopening_todo
    BEFORE UPDATE ON public.project_todos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_reopening_todo();

-- 6. RPC Function A: Atomically complete a todo and create its follow-up
CREATE OR REPLACE FUNCTION public.fn_complete_and_create_todo(
    p_todo_id UUID,
    p_completed_by TEXT,
    p_new_task TEXT,
    p_new_due_date DATE,
    p_new_assigned_user_id TEXT,
    p_new_assigned_user_name TEXT,
    p_new_note TEXT,
    p_new_closes_project BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_old_todo RECORD;
    v_new_todo_id UUID;
    v_root_todo_id UUID;
BEGIN
    -- 1. Load and lock the existing todo
    SELECT * INTO v_old_todo
    FROM public.project_todos
    WHERE id = p_todo_id AND status = 'open'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'To-do wurde nicht gefunden oder ist bereits erledigt.';
    END IF;

    -- 2. Complete the old todo
    UPDATE public.project_todos
    SET status = 'done',
        completed_at = now(),
        completed_by = p_completed_by,
        updated_at = now(),
        updated_by = p_completed_by
    WHERE id = p_todo_id;

    -- 3. Determine root todo id
    IF v_old_todo.root_todo_id IS NOT NULL THEN
        v_root_todo_id := v_old_todo.root_todo_id;
    ELSE
        v_root_todo_id := v_old_todo.id;
    END IF;

    -- 4. Insert the new follow-up todo
    INSERT INTO public.project_todos (
        project_id,
        parent_todo_id,
        root_todo_id,
        task,
        due_date,
        assigned_user_id,
        assigned_user_name,
        note,
        closes_project,
        status,
        created_at,
        created_by,
        updated_at,
        updated_by
    ) VALUES (
        v_old_todo.project_id,
        p_todo_id,
        v_root_todo_id,
        p_new_task,
        p_new_due_date,
        p_new_assigned_user_id,
        p_new_assigned_user_name,
        p_new_note,
        p_new_closes_project,
        'open',
        now(),
        p_completed_by,
        now(),
        p_completed_by
    )
    RETURNING id INTO v_new_todo_id;

    RETURN jsonb_build_object(
        'success', true,
        'completed_todo_id', p_todo_id,
        'new_todo_id', v_new_todo_id
    );
END;
$$;

-- 7. RPC Function B: Atomically complete todo and archive the project
CREATE OR REPLACE FUNCTION public.fn_complete_todo_and_archive_project(
    p_todo_id UUID,
    p_completed_by TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    v_todo RECORD;
    v_other_open_count INT;
    v_report_data JSONB;
    v_current_status TEXT;
    v_history_entry JSONB;
BEGIN
    -- 1. Load and lock the existing todo
    SELECT * INTO v_todo
    FROM public.project_todos
    WHERE id = p_todo_id AND status = 'open'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'To-do wurde nicht gefunden oder ist bereits erledigt.';
    END IF;

    -- 2. Check if other open todos exist for this project
    SELECT count(*) INTO v_other_open_count
    FROM public.project_todos
    WHERE project_id = v_todo.project_id AND id <> p_todo_id AND status = 'open';

    IF v_other_open_count > 0 THEN
        RAISE EXCEPTION 'Projekt kann noch nicht abgeschlossen werden. Es bestehen noch andere offene To-dos.';
    END IF;

    -- 3. Complete the current todo
    UPDATE public.project_todos
    SET status = 'done',
        completed_at = now(),
        completed_by = p_completed_by,
        updated_at = now(),
        updated_by = p_completed_by
    WHERE id = p_todo_id;

    -- 4. Load report_data and status of the project
    SELECT report_data, status INTO v_report_data, v_current_status
    FROM public.damage_reports
    WHERE id = v_todo.project_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Zugehöriges Projekt wurde nicht gefunden.';
    END IF;

    -- 5. Construct status history entry
    v_history_entry := jsonb_build_object(
        'id', 'sh-' || substring(md5(random()::text || now()::text) from 1 for 8),
        'projectId', v_todo.project_id,
        'oldStatus', COALESCE(v_report_data->>'status', v_current_status),
        'newStatus', 'Abgeschlossen',
        'changedAt', now()::text,
        'changedBy', p_completed_by,
        'reason', 'To-do Projekt-Abschluss'
    );

    -- 6. Update JSON report_data fields (existing QTool archiving format)
    v_report_data := jsonb_set(v_report_data, '{status}', '"Abgeschlossen"'::jsonb);
    v_report_data := jsonb_set(v_report_data, '{statusStartedAt}', to_jsonb(now()::text));
    v_report_data := jsonb_set(v_report_data, '{lastActivityAt}', to_jsonb(now()::text));

    IF v_report_data ? 'statusHistory' THEN
        v_report_data := jsonb_set(v_report_data, '{statusHistory}', (v_report_data->'statusHistory') || v_history_entry);
    ELSE
        v_report_data := jsonb_set(v_report_data, '{statusHistory}', jsonb_build_array(v_history_entry));
    END IF;

    -- 7. Update the project record
    UPDATE public.damage_reports
    SET status = 'Abgeschlossen',
        report_data = v_report_data,
        updated_at = now()
    WHERE id = v_todo.project_id;

    -- 8. Write to project_status_history table if it exists (best-effort)
    BEGIN
        INSERT INTO public.project_status_history (
            project_id,
            old_status,
            new_status,
            changed_at,
            changed_by,
            reason
        ) VALUES (
            v_todo.project_id,
            COALESCE(v_report_data->>'status', v_current_status),
            'Abgeschlossen',
            now(),
            p_completed_by,
            'To-do Projekt-Abschluss'
        );
    EXCEPTION WHEN OTHERS THEN
        -- Non-fatal
    END;

    RETURN jsonb_build_object(
        'success', true,
        'completed_todo_id', p_todo_id,
        'project_id', v_todo.project_id
    );
END;
$$;

-- 8. Security configurations for RPC functions (Security Invoker, only authenticated)
REVOKE EXECUTE ON FUNCTION public.fn_complete_and_create_todo FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_complete_and_create_todo TO authenticated;

REVOKE EXECUTE ON FUNCTION public.fn_complete_todo_and_archive_project FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_complete_todo_and_archive_project TO authenticated;

-- 9. Insert the silent backend test user into auth.users (if not exists)
-- This allows the front-end to log in as 'authenticated' silently in the background
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '99999999-9999-9999-9999-999999999999', -- fixed UUID for silent user
  'authenticated',
  'authenticated',
  'test-env-user@qtool.local',
  crypt('TestEnvPassword123!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;

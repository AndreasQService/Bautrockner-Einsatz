-- =====================================================================
-- QTool – RPC: complete_todo_with_successor
-- Dateipfad: supabase/complete_todo_with_successor.sql
-- =====================================================================

CREATE OR REPLACE FUNCTION public.complete_todo_with_successor(
    p_todo_id UUID,
    p_successor_id UUID,
    p_successor_task TEXT,
    p_successor_due_date DATE,
    p_successor_user_id TEXT,
    p_successor_user_name TEXT,
    p_successor_note TEXT,
    p_user_name TEXT
) RETURNS TABLE (
    old_id UUID,
    new_id UUID
) AS $$
DECLARE
    v_prev_project_id TEXT;
    v_prev_root_todo_id UUID;
    v_prev_status TEXT;
BEGIN
    -- 1. Parameter validieren (Exception vor jeglichen Schreiboperationen)
    IF p_todo_id IS NULL THEN
        RAISE EXCEPTION 'Vorgänger-To-do-ID darf nicht NULL sein.';
    END IF;
    IF p_successor_id IS NULL THEN
        RAISE EXCEPTION 'Nachfolger-To-do-ID (p_successor_id) darf nicht NULL sein.';
    END IF;
    IF p_successor_task IS NULL OR char_length(trim(p_successor_task)) = 0 THEN
        RAISE EXCEPTION 'Nachfolger-Aufgabe (p_successor_task) darf nicht leer sein.';
    END IF;
    IF p_successor_due_date IS NULL THEN
        RAISE EXCEPTION 'Nachfolger-Fälligkeitsdatum (p_successor_due_date) darf nicht NULL sein.';
    END IF;
    IF p_successor_user_id IS NULL OR char_length(trim(p_successor_user_id)) = 0 THEN
        RAISE EXCEPTION 'Nachfolger-Benutzer-ID (p_successor_user_id) darf nicht leer sein.';
    END IF;
    IF p_successor_user_name IS NULL OR char_length(trim(p_successor_user_name)) = 0 THEN
        RAISE EXCEPTION 'Nachfolger-Benutzername (p_successor_user_name) darf nicht leer sein.';
    END IF;
    IF p_user_name IS NULL OR char_length(trim(p_user_name)) = 0 THEN
        RAISE EXCEPTION 'Abschließender Benutzername (p_user_name) darf nicht leer sein.';
    END IF;

    -- 2. Vorgänger-Task mit FOR UPDATE sperren
    SELECT status, project_id, root_todo_id 
    INTO v_prev_status, v_prev_project_id, v_prev_root_todo_id
    FROM public.project_todos
    WHERE id = p_todo_id
    FOR UPDATE;

    -- Vorgänger validieren
    IF v_prev_status IS NULL THEN
        RAISE EXCEPTION 'Vorgänger-Aufgabe % existiert nicht.', p_todo_id;
    END IF;

    IF v_prev_status <> 'open' THEN
        RAISE EXCEPTION 'Vorgänger-Aufgabe % ist nicht offen (Status: %).', p_todo_id, v_prev_status;
    END IF;

    -- 3. Nachfolger-To-do erstellen (Projekt-ID kommt zwingend vom Vorgänger)
    INSERT INTO public.project_todos (
        id,
        project_id,
        task,
        due_date,
        assigned_user_id,
        assigned_user_name,
        note,
        status,
        closes_project,
        parent_todo_id,
        root_todo_id,
        created_by,
        updated_by,
        created_at,
        updated_at
    ) VALUES (
        p_successor_id,
        v_prev_project_id,
        p_successor_task,
        p_successor_due_date,
        p_successor_user_id,
        p_successor_user_name,
        p_successor_note,
        'open',
        false,
        p_todo_id,
        COALESCE(v_prev_root_todo_id, p_todo_id),
        p_user_name,
        p_user_name,
        NOW(),
        NOW()
    );

    -- 4. Vorgänger auf done setzen (Erst nach erfolgreichem Nachfolger-Insert)
    UPDATE public.project_todos
    SET status = 'done',
        completed_at = NOW(),
        completed_by = p_user_name,
        updated_at = NOW(),
        updated_by = p_user_name
    WHERE id = p_todo_id;

    old_id := p_todo_id;
    new_id := p_successor_id;
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- Ausführungsrechte restriktiv setzen
REVOKE EXECUTE ON FUNCTION public.complete_todo_with_successor(UUID, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_todo_with_successor(UUID, UUID, TEXT, DATE, TEXT, TEXT, TEXT, TEXT) TO authenticated;

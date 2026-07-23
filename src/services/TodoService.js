import { supabase } from '../supabaseClient';

export const SILENT_USER_EMAIL = 'test-env-user@qtool.local';
export const SILENT_USER_PASSWORD = 'TestEnvPassword123!';

export let lastAuthError = null;

/**
 * Performs a silent background sign-in to Supabase Auth so that RLS 'authenticated' policies are satisfied.
 */
export async function ensureAuthenticated() {
    if (!supabase) return false;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            lastAuthError = null;
            return true;
        }

        // 1. Attempt to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: SILENT_USER_EMAIL,
            password: SILENT_USER_PASSWORD
        });

        if (!signInError) {
            console.log('[TodoService] Silent sign-in successful');
            lastAuthError = null;
            return true;
        }

        lastAuthError = signInError.message;
        console.warn('[TodoService] Silent sign-in failed, attempting silent registration...', signInError.message);

        // 2. Fallback: Attempt to register/sign up the user
        const { error: signUpError } = await supabase.auth.signUp({
            email: SILENT_USER_EMAIL,
            password: SILENT_USER_PASSWORD
        });

        if (signUpError) {
            lastAuthError = signUpError.message;
            console.error('[TodoService] Silent registration failed:', signUpError.message);
            return false;
        }

        console.log('[TodoService] Silent registration successful, retrying sign-in...');

        // 3. Retry sign in
        const { error: retryError } = await supabase.auth.signInWithPassword({
            email: SILENT_USER_EMAIL,
            password: SILENT_USER_PASSWORD
        });

        if (retryError) {
            lastAuthError = retryError.message;
            console.error('[TodoService] Silent sign-in retry failed:', retryError.message);
            return false;
        }

        lastAuthError = null;
        console.log('[TodoService] Silent sign-in successful after registration');
        return true;
    } catch (err) {
        console.error('[TodoService] Silent sign-in error:', err);
        return false;
    }
}

/**
 * Fetches all todos from Supabase.
 */
export async function fetchAllTodos() {
    await ensureAuthenticated();
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('project_todos')
        .select('*')
        .order('due_date', { ascending: true });

    if (error) {
        console.error('[TodoService] Error fetching todos:', error.message);
        throw error;
    }
    return data || [];
}

/**
 * Fetches todos specifically for a given project.
 */
export async function fetchTodosForProject(projectId) {
    await ensureAuthenticated();
    if (!supabase) return [];

    const { data, error } = await supabase
        .from('project_todos')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true });

    if (error) {
        console.error('[TodoService] Error fetching project todos:', error.message);
        throw error;
    }
    return data || [];
}

/**
 * Creates a new independent To-do.
 */
export async function createTodo(todoData) {
    await ensureAuthenticated();
    if (!supabase) throw new Error('Supabase client not initialized');

    const payload = {
        project_id: todoData.projectId,
        parent_todo_id: todoData.parentTodoId || null,
        root_todo_id: todoData.rootTodoId || null,
        task: todoData.task.trim(),
        due_date: todoData.dueDate,
        assigned_user_id: String(todoData.assignedUserId),
        assigned_user_name: todoData.assignedUserName,
        note: todoData.note ? todoData.note.trim() : null,
        closes_project: !!todoData.closesProject,
        status: 'open',
        created_by: todoData.currentUser,
        updated_by: todoData.currentUser
    };

    const { data, error } = await supabase
        .from('project_todos')
        .insert(payload)
        .select()
        .single();

    if (error) {
        console.error('[TodoService] Error creating todo:', error.message);
        throw error;
    }

    // Set root_todo_id to its own ID if it was new/null
    if (!payload.root_todo_id && data) {
        const { data: updatedData, error: updateError } = await supabase
            .from('project_todos')
            .update({ root_todo_id: data.id })
            .eq('id', data.id)
            .select()
            .single();
        if (updateError) {
            console.error('[TodoService] Error setting root_todo_id:', updateError.message);
        } else {
            return updatedData;
        }
    }

    return data;
}

/**
 * Updates a To-do with optimistic locking (checks updated_at and status = 'open').
 */
export async function updateTodo(todoId, updateData, expectedUpdatedAt) {
    await ensureAuthenticated();
    if (!supabase) throw new Error('Supabase client not initialized');

    const payload = {
        task: updateData.task.trim(),
        due_date: updateData.dueDate,
        assigned_user_id: String(updateData.assignedUserId),
        assigned_user_name: updateData.assignedUserName,
        note: updateData.note ? updateData.note.trim() : null,
        closes_project: !!updateData.closesProject,
        updated_by: updateData.currentUser,
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from('project_todos')
        .update(payload)
        .eq('id', todoId)
        .eq('status', 'open')
        .eq('updated_at', expectedUpdatedAt)
        .select();

    if (error) {
        console.error('[TodoService] Error updating todo:', error.message);
        throw error;
    }

    if (!data || data.length === 0) {
        throw new Error('Dieses To-do wurde inzwischen auf einem anderen Gerät geändert oder bereits erledigt. Bitte neu laden.');
    }

    return data[0];
}

/**
 * Completes a To-do and creates a follow-up todo in a single database transaction.
 */
export async function completeAndCreateTodoRpc(todoId, completedBy, newTodoData) {
    await ensureAuthenticated();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await supabase.rpc('fn_complete_and_create_todo', {
        p_todo_id: todoId,
        p_completed_by: completedBy,
        p_new_task: newTodoData.task.trim(),
        p_new_due_date: newTodoData.dueDate,
        p_new_assigned_user_id: String(newTodoData.assignedUserId),
        p_new_assigned_user_name: newTodoData.assignedUserName,
        p_new_note: newTodoData.note ? newTodoData.note.trim() : null,
        p_new_closes_project: !!newTodoData.closesProject
    });

    if (error) {
        console.error('[TodoService] Error completing and creating todo (RPC):', error.message);
        throw error;
    }

    return data;
}

/**
 * Completes a To-do and archives the project in a single database transaction.
 */
export async function completeTodoAndArchiveProjectRpc(todoId, completedBy) {
    await ensureAuthenticated();
    if (!supabase) throw new Error('Supabase client not initialized');

    const { data, error } = await supabase.rpc('fn_complete_todo_and_archive_project', {
        p_todo_id: todoId,
        p_completed_by: completedBy
    });

    if (error) {
        console.error('[TodoService] Error completing todo and archiving project (RPC):', error.message);
        throw error;
    }

    return data;
}

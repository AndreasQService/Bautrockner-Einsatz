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

        // 1. Attempt to sign in with silent user credentials
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: SILENT_USER_EMAIL,
            password: SILENT_USER_PASSWORD
        });

        if (!signInError) {
            console.log('[TodoService] Silent sign-in successful');
            lastAuthError = null;
            return true;
        }

        // 2. Fallback: Attempt anonymous sign in for RLS policy compliance
        if (supabase.auth.signInAnonymously) {
            const { error: anonErr } = await supabase.auth.signInAnonymously();
            if (!anonErr) {
                console.log('[TodoService] Anonymous sign-in successful for RLS');
                lastAuthError = null;
                return true;
            }
        }

        lastAuthError = signInError.message;
        return false;
    } catch (e) {
        console.warn('[TodoService] Silent auth exception:', e.message);
        return false;
    }
}

function getLocalTodos() {
    try {
        const pTodos = JSON.parse(localStorage.getItem('qservice_local_todos') || '[]');
        const inboxTodosRaw = JSON.parse(localStorage.getItem('qtool_inbox_todos') || '[]');
        const inboxTodosConverted = inboxTodosRaw.map(i => ({
            id: i.id || `inbox_${Date.now()}_${Math.random()}`,
            project_id: null,
            task: i.text || i.task || 'Aufgabe aus Eingang',
            due_date: i.date || new Date().toISOString().split('T')[0],
            assigned_user_id: 'office',
            assigned_user_name: i.sender || 'Innendienst',
            note: i.sender ? `Absender: ${i.sender}` : null,
            closes_project: false,
            status: i.done ? 'done' : 'open',
            created_at: new Date().toISOString(),
            created_by: i.sender || 'Eingang'
        }));
        return [...pTodos, ...inboxTodosConverted];
    } catch (e) {
        return [];
    }
}

/**
 * Fetches all todos from Supabase project_todos, local storage, and officeTasks inside damage_reports.
 */
export async function fetchAllTodos(reports = []) {
    await ensureAuthenticated().catch(() => {});
    let remoteData = [];
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('project_todos')
                .select('*')
                .order('due_date', { ascending: true });
            if (!error && data) remoteData = data;
        } catch (e) {}
    }
    const local = getLocalTodos();
    const combined = [...remoteData];
    local.forEach(loc => {
        if (!combined.some(r => r.id === loc.id)) {
            combined.push(loc);
        }
    });

    // Also collect legacy/embedded officeTasks from loaded reports
    if (Array.isArray(reports)) {
        reports.forEach(r => {
            const tasks = r?.officeTasks || r?.report_data?.officeTasks;
            if (Array.isArray(tasks)) {
                tasks.forEach(t => {
                    const taskKey = t.id || `${r.id}_${t.title}_${t.dueDate}`;
                    if (!combined.some(c => c.id === taskKey || (c.project_id === (r.id || t.projectId) && c.task === (t.title || t.text)))) {
                        combined.push({
                            id: taskKey,
                            project_id: r.id || t.projectId,
                            task: t.title || t.text || 'Aufgabe',
                            due_date: t.dueDate ? t.dueDate.split('T')[0] : new Date().toISOString().split('T')[0],
                            assigned_user_id: 'office',
                            assigned_user_name: 'Innendienst',
                            note: t.category ? `Kategorie: ${t.category}` : null,
                            closes_project: false,
                            status: t.done ? 'done' : 'open',
                            created_at: t.createdAt || new Date().toISOString(),
                            created_by: 'System'
                        });
                    }
                });
            }
        });
    }

    return combined;
}

/**
 * Fetches todos specifically for a given project (including legacy/embedded officeTasks).
 */
export async function fetchTodosForProject(projectIdOrProject) {
    await ensureAuthenticated().catch(() => {});
    const projectId = typeof projectIdOrProject === 'object' ? projectIdOrProject?.id : projectIdOrProject;
    const projectObj = typeof projectIdOrProject === 'object' ? projectIdOrProject : null;

    let remoteData = [];
    if (supabase && projectId) {
        try {
            const { data, error } = await supabase
                .from('project_todos')
                .select('*')
                .eq('project_id', projectId)
                .order('due_date', { ascending: true });
            if (!error && data) remoteData = data;
        } catch (e) {}
    }
    const local = getLocalTodos().filter(t => t.project_id === projectId);
    const combined = [...remoteData];
    local.forEach(loc => {
        if (!combined.some(r => r.id === loc.id)) {
            combined.push(loc);
        }
    });

    if (projectObj) {
        const tasks = projectObj?.officeTasks || projectObj?.report_data?.officeTasks;
        if (Array.isArray(tasks)) {
            tasks.forEach(t => {
                const taskKey = t.id || `${projectId}_${t.title}_${t.dueDate}`;
                if (!combined.some(c => c.id === taskKey || c.task === (t.title || t.text))) {
                    combined.push({
                        id: taskKey,
                        project_id: projectId,
                        task: t.title || t.text || 'Aufgabe',
                        due_date: t.dueDate ? t.dueDate.split('T')[0] : new Date().toISOString().split('T')[0],
                        assigned_user_id: 'office',
                        assigned_user_name: 'Innendienst',
                        note: t.category ? `Kategorie: ${t.category}` : null,
                        closes_project: false,
                        status: t.done ? 'done' : 'open',
                        created_at: t.createdAt || new Date().toISOString(),
                        created_by: 'System'
                    });
                }
            });
        }
    }

    return combined;
}

/**
 * Creates a new independent To-do with resilient local fallback.
 */
export async function createTodo(todoData) {
    await ensureAuthenticated().catch(() => {});
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

    try {
        const { data, error } = await supabase
            .from('project_todos')
            .insert(payload)
            .select()
            .single();

        if (!error && data) {
            if (!payload.root_todo_id) {
                await supabase
                    .from('project_todos')
                    .update({ root_todo_id: data.id })
                    .eq('id', data.id)
                    .catch(() => {});
            }
            return data;
        }
        if (error) throw error;
    } catch (err) {
        console.warn('[TodoService] Supabase insert failed (RLS/Auth), falling back to local storage:', err.message);
        
        // Resilient local fallback object
        const localTodo = {
            id: `todo_local_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            ...payload,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_local: true
        };

        try {
            const existing = JSON.parse(localStorage.getItem('qservice_local_todos') || '[]');
            existing.push(localTodo);
            localStorage.setItem('qservice_local_todos', JSON.stringify(existing));
        } catch (e) {}

        return localTodo;
    }
}

/**
 * Deletes a To-do by ID from Supabase and local storage.
 */
export async function deleteTodo(todoId) {
    if (!todoId) return false;

    // 1. Remove from local storage
    try {
        const local = JSON.parse(localStorage.getItem('qservice_local_todos') || '[]');
        const filtered = local.filter(t => t.id !== todoId);
        localStorage.setItem('qservice_local_todos', JSON.stringify(filtered));
    } catch (e) {}

    // 2. Remove from Supabase
    if (supabase) {
        await ensureAuthenticated().catch(() => {});
        try {
            await supabase
                .from('project_todos')
                .delete()
                .eq('id', todoId);
        } catch (e) {
            console.warn('[TodoService] Supabase delete failed:', e.message);
        }
    }

    return true;
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

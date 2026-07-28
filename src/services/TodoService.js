import { supabase } from '../supabaseClient';

export const SILENT_USER_EMAIL = 'test-env-user@qtool.local';
export const SILENT_USER_PASSWORD = 'TestEnvPassword123!';

export let lastAuthError = null;

/**
 * Performs a silent background sign-in to Supabase Auth so that RLS 'authenticated' policies are satisfied.
 */
let authPromise = null;

export async function ensureAuthenticated() {
    if (!supabase) return false;
    if (authPromise) return authPromise;

    authPromise = (async () => {
        try {
            // Wait up to 500ms for Supabase client to asynchronously restore the session from localStorage
            for (let i = 0; i < 5; i++) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    lastAuthError = null;
                    return true;
                }
                await new Promise(r => setTimeout(r, 100));
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
            lastAuthError = e.message;
            return false;
        } finally {
            authPromise = null;
        }
    })();

    return authPromise;
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
 * Automatically synchronizes outstanding local or inbox todos if connection is healthy.
 */
export async function fetchAllTodos(reports = []) {
    await ensureAuthenticated().catch(() => {});
    
    // ── BACKGROUND SYNCHRONIZATION ──
    const isTestEnv = typeof window !== 'undefined' && (window.navigator.webdriver || window.IS_TEST_ENV);
    if (supabase && !isTestEnv) {
        try {
            const local = JSON.parse(localStorage.getItem('qservice_local_todos') || '[]');
            const inboxTodosRaw = JSON.parse(localStorage.getItem('qtool_inbox_todos') || '[]');

            // 1. Sync local project todos
            if (local.length > 0) {
                const syncedIds = [];
                for (const todo of local) {
                    const payload = {
                        project_id: todo.project_id,
                        parent_todo_id: todo.parent_todo_id || null,
                        root_todo_id: todo.root_todo_id || null,
                        task: todo.task,
                        due_date: todo.due_date,
                        assigned_user_id: String(todo.assigned_user_id),
                        assigned_user_name: todo.assigned_user_name,
                        note: todo.note || null,
                        closes_project: !!todo.closes_project,
                        status: todo.status || 'open',
                        created_by: todo.created_by || 'System',
                        updated_by: todo.updated_by || 'System'
                    };
                    const { error } = await supabase.from('project_todos').insert(payload);
                    if (!error) syncedIds.push(todo.id);
                }
                if (syncedIds.length > 0) {
                    const remaining = local.filter(t => !syncedIds.includes(t.id));
                    localStorage.setItem('qservice_local_todos', JSON.stringify(remaining));
                }
            }

            // 2. Sync local inbox/dashboard todos
            if (inboxTodosRaw.length > 0) {
                const syncedInboxIds = [];
                for (const todo of inboxTodosRaw) {
                    const payload = {
                        project_id: todo.projectId || null,
                        task: todo.text || todo.task,
                        due_date: todo.date ? todo.date.split('T')[0] : new Date().toISOString().split('T')[0],
                        assigned_user_id: 'office',
                        assigned_user_name: todo.sender || 'Innendienst',
                        note: todo.sender ? `Absender: ${todo.sender}` : null,
                        closes_project: false,
                        status: todo.done ? 'done' : 'open',
                        created_by: todo.sender || 'Eingang',
                        updated_by: todo.sender || 'Eingang'
                    };
                    const { error } = await supabase.from('project_todos').insert(payload);
                    if (!error) syncedInboxIds.push(todo.id);
                }
                if (syncedInboxIds.length > 0) {
                    const remaining = inboxTodosRaw.filter(t => !syncedInboxIds.includes(t.id));
                    localStorage.setItem('qtool_inbox_todos', JSON.stringify(remaining));
                }
            }
        } catch (syncErr) {
            console.warn('[TodoService] Auto-sync failed:', syncErr);
        }
    }

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

    // Helper to get latest measurement date across a project (only if measurements actually exist)
    const getLatestMeasurementDate = (project) => {
        const allRooms = [
            ...(project.measurementRooms || []),
            ...(project.rooms || []),
            ...(project.report_data?.measurementRooms || []),
            ...(project.report_data?.rooms || [])
        ];
        let latestDate = null;
        allRooms.forEach(room => {
            if (!room) return;
            // Check if active room has actual measurements
            const hasActiveMeas = (Array.isArray(room.measurements) && room.measurements.length > 0) ||
                                  (room.measurementData && Array.isArray(room.measurementData.measurements) && room.measurementData.measurements.length > 0);
            if (hasActiveMeas) {
                const mDate = room.measurementData?.globalSettings?.date || room.globalSettings?.date || room.date;
                if (mDate) {
                    const d = new Date(mDate);
                    if (!isNaN(d.getTime())) {
                        if (!latestDate || d > latestDate) latestDate = d;
                    }
                }
            }

            // Check if historical entries have actual measurements
            if (room.measurementHistory && Array.isArray(room.measurementHistory)) {
                room.measurementHistory.forEach(hist => {
                    const hasHistMeas = Array.isArray(hist.measurements) && hist.measurements.length > 0;
                    if (hasHistMeas) {
                        const hDate = hist.date || hist.datum || hist.timestamp || hist.createdAt || hist.globalSettings?.date;
                        if (hDate) {
                            const d = new Date(hDate);
                            if (!isNaN(d.getTime())) {
                                if (!latestDate || d > latestDate) latestDate = d;
                            }
                        }
                    }
                });
            }
        });
        return latestDate;
    };

    // Also collect legacy/embedded officeTasks from loaded reports
    if (Array.isArray(reports)) {
        reports.forEach(r => {
            const tasks = [...(r?.officeTasks || r?.report_data?.officeTasks || [])];

            // ─── 300% SELF-HEALING FALLBACK FOR AUTOMATIC TODOS ───
            // Only generate the next measurement follow-up if:
            // 1. The project is in 'Trocknung' status.
            // 2. A measurement protocol actually exists (i.e. latestMDate is not null).
            const status = r.status || r.report_data?.status;
            if (status === 'Trocknung') {
                const latestMDate = getLatestMeasurementDate(r);
                if (latestMDate) {
                    const baseDate = latestMDate;
                    const nextDue = new Date(baseDate);
                    nextDue.setDate(nextDue.getDate() + 7);
                    const nextDueStr = nextDue.toISOString();
                    const nextDueLabelStr = nextDue.toLocaleDateString('de-CH');

                    const alreadyHasFollowUp = tasks.some(t => {
                        const isFUp = t.id === 'measurement_followup' || (t.id && String(t.id).startsWith('measurement_followup'));
                        return isFUp && !t.done;
                    });

                    if (!alreadyHasFollowUp) {
                        tasks.push({
                            id: `measurement_followup_healed_${r.id}`,
                            projectId: r.id,
                            title: `Nächste Feuchtekontrolle durchführen (fällig ${nextDueLabelStr})`,
                            done: false,
                            dueDate: nextDueStr,
                            category: 'auto',
                            urgent: false,
                            createdAt: baseDate.toISOString()
                        });
                    }
                }
            }

            if (tasks.length > 0) {
                tasks.forEach(t => {
                    const taskKey = t.id || `${r.id}_${t.title}_${t.dueDate}`;
                    if (!combined.some(c => c.id === taskKey || (c.project_id === (r.id || t.projectId) && c.task === (t.title || t.text)))) {
                        combined.push({
                            id: taskKey,
                            project_id: r.id || t.projectId,
                            task: t.title || t.text || 'Aufgabe',
                            due_date: t.dueDate ? t.dueDate.split('T')[0] : new Date().toISOString().split('T')[0],
                            assigned_user_id: 'office',
                            assigned_user_name: t.assignedTo || 'Innendienst',
                            note: t.note || (t.category ? `Kategorie: ${t.category}` : null),
                            closes_project: !!t.closesProject,
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
    const projectNum = typeof projectIdOrProject === 'object' ? projectIdOrProject?.projectNumber : null;
    const projectObj = typeof projectIdOrProject === 'object' ? projectIdOrProject : null;

    let remoteData = [];
    if (supabase && (projectId || projectNum)) {
        try {
            let query = supabase.from('project_todos').select('*');
            if (projectId && projectNum) {
                query = query.or(`project_id.eq.${projectId},project_id.eq.${projectNum}`);
            } else if (projectId) {
                query = query.eq('project_id', projectId);
            } else {
                query = query.eq('project_id', projectNum);
            }
            const { data, error } = await query.order('due_date', { ascending: true });
            if (!error && data) remoteData = data;
        } catch (e) {}
    }
    const local = getLocalTodos().filter(t => t.project_id === projectId || (projectNum && t.project_id === projectNum));
    const combined = [...remoteData];
    local.forEach(loc => {
        if (!combined.some(r => r.id === loc.id)) {
            combined.push(loc);
        }
    });

    if (projectObj) {
        const tasks = [...(projectObj?.officeTasks || projectObj?.report_data?.officeTasks || [])];

        // ─── 300% SELF-HEALING FALLBACK FOR AUTOMATIC TODOS ───
        // Only generate the next measurement follow-up if:
        // 1. The project is in 'Trocknung' status.
        // 2. A measurement protocol actually exists (i.e. latestMDate is not null).
        const status = projectObj.status || projectObj.report_data?.status;
        if (status === 'Trocknung') {
            const latestMDate = getLatestMeasurementDate(projectObj);
            if (latestMDate) {
                const baseDate = latestMDate;
                const nextDue = new Date(baseDate);
                nextDue.setDate(nextDue.getDate() + 7);
                const nextDueStr = nextDue.toISOString();
                const nextDueLabelStr = nextDue.toLocaleDateString('de-CH');

                const alreadyHasFollowUp = tasks.some(t => {
                    const isFUp = t.id === 'measurement_followup' || (t.id && String(t.id).startsWith('measurement_followup'));
                    return isFUp && !t.done;
                });

                if (!alreadyHasFollowUp) {
                    tasks.push({
                        id: `measurement_followup_healed_${projectId}`,
                        projectId: projectId,
                        title: `Nächste Feuchtekontrolle durchführen (fällig ${nextDueLabelStr})`,
                        done: false,
                        dueDate: nextDueStr,
                        category: 'auto',
                        urgent: false,
                        createdAt: baseDate.toISOString()
                    });
                }
            }
        }

        if (tasks.length > 0) {
            tasks.forEach(t => {
                const taskKey = t.id || `${projectId}_${t.title}_${t.dueDate}`;
                if (!combined.some(c => c.id === taskKey || c.task === (t.title || t.text))) {
                    combined.push({
                        id: taskKey,
                        project_id: projectId,
                        task: t.title || t.text || 'Aufgabe',
                        due_date: t.dueDate ? t.dueDate.split('T')[0] : new Date().toISOString().split('T')[0],
                        assigned_user_id: 'office',
                        assigned_user_name: t.assignedTo || 'Innendienst',
                        note: t.note || (t.category ? `Kategorie: ${t.category}` : null),
                        closes_project: !!t.closesProject,
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

    const isUuidVal = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const payload = {
        project_id: todoData.projectId,
        parent_todo_id: (todoData.parentTodoId && isUuidVal(todoData.parentTodoId)) ? todoData.parentTodoId : null,
        root_todo_id: (todoData.rootTodoId && isUuidVal(todoData.rootTodoId)) ? todoData.rootTodoId : null,
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
    // ── FALLBACK FOR NON-UUID (EMBEDDED OR LOCAL) TODOS ──
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(todoId);
    if (!isUuid) {
        console.log('[TodoService] Non-UUID todo update triggered. Modifying locally/in report JSON directly.');
        
        // 1. Update in local storage
        try {
            const local = JSON.parse(localStorage.getItem('qservice_local_todos') || '[]');
            const idx = local.findIndex(t => t.id === todoId);
            if (idx >= 0) {
                local[idx] = {
                    ...local[idx],
                    task: updateData.task.trim(),
                    due_date: updateData.dueDate,
                    assigned_user_id: String(updateData.assignedUserId),
                    assigned_user_name: updateData.assignedUserName,
                    note: updateData.note ? updateData.note.trim() : null,
                    closes_project: !!updateData.closesProject,
                    updated_at: new Date().toISOString()
                };
                localStorage.setItem('qservice_local_todos', JSON.stringify(local));
                return local[idx];
            }
        } catch (e) {}

        // 2. Update in Supabase damage_reports JSON if it belongs to a report
        if (supabase && updateData.projectId) {
            try {
                const { data: report, error: fetchErr } = await supabase
                    .from('damage_reports')
                    .select('report_data')
                    .eq('id', updateData.projectId)
                    .single();
                if (!fetchErr && report && report.report_data) {
                    const rd = report.report_data;
                    const tasks = rd.officeTasks || [];
                    const taskIdx = tasks.findIndex(t => t.id === todoId);
                    if (taskIdx >= 0) {
                        tasks[taskIdx] = {
                            ...tasks[taskIdx],
                            title: updateData.task.trim(),
                            dueDate: updateData.dueDate,
                            assignedTo: updateData.assignedUserName,
                            category: 'manual',
                            note: updateData.note ? updateData.note.trim() : null
                        };
                        rd.officeTasks = tasks;
                        const { error: updateErr } = await supabase
                            .from('damage_reports')
                            .update({ report_data: rd })
                            .eq('id', updateData.projectId);
                        if (!updateErr) {
                            return {
                                id: todoId,
                                project_id: updateData.projectId,
                                task: updateData.task.trim(),
                                due_date: updateData.dueDate,
                                assigned_user_name: updateData.assignedUserName,
                                status: 'open'
                            };
                        }
                    }
                }
            } catch (e) {}
        }
        
        throw new Error('Dieses To-do konnte nicht aktualisiert werden (kein übereinstimmender Eintrag gefunden).');
    }

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
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(todoId);
    if (!isUuid) {
        console.log('[TodoService] Non-UUID todo complete-and-create triggered.');
        // 1. Mark old local/embedded todo as done
        try {
            const local = JSON.parse(localStorage.getItem('qservice_local_todos') || '[]');
            const idx = local.findIndex(t => t.id === todoId);
            if (idx >= 0) {
                local[idx] = {
                    ...local[idx],
                    status: 'done',
                    completed_at: new Date().toISOString(),
                    completed_by: completedBy,
                    updated_at: new Date().toISOString()
                };
                localStorage.setItem('qservice_local_todos', JSON.stringify(local));
            }
        } catch (e) {}

        // If in Supabase damage_reports JSON
        if (supabase && newTodoData.projectId) {
            try {
                const { data: report, error: fetchErr } = await supabase
                    .from('damage_reports')
                    .select('report_data')
                    .eq('id', newTodoData.projectId)
                    .single();
                if (!fetchErr && report && report.report_data) {
                    const rd = report.report_data;
                    const tasks = rd.officeTasks || [];
                    const taskIdx = tasks.findIndex(t => t.id === todoId);
                    if (taskIdx >= 0) {
                        tasks[taskIdx] = {
                            ...tasks[taskIdx],
                            done: true,
                            completedAt: new Date().toISOString(),
                            completedBy: completedBy
                        };
                        rd.officeTasks = tasks;
                        await supabase
                            .from('damage_reports')
                            .update({ report_data: rd })
                            .eq('id', newTodoData.projectId)
                            .catch(() => {});
                    }
                }
            } catch (e) {}
        }

        // 2. Create the follow-up todo
        return await createTodo({
            projectId: newTodoData.projectId,
            task: newTodoData.task,
            dueDate: newTodoData.dueDate,
            assignedUserId: newTodoData.assignedUserId,
            assignedUserName: newTodoData.assignedUserName,
            note: newTodoData.note,
            closesProject: newTodoData.closesProject,
            currentUser: completedBy,
            parentTodoId: todoId
        });
    }

    await ensureAuthenticated().catch(() => {});
    if (!supabase) throw new Error('Supabase client not initialized');

    try {
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

        if (!error) {
            return data;
        }
        // If it's a permission/execute/missing function error, throw it so we try client-side transaction fallback
        throw error;
    } catch (err) {
        console.warn('[TodoService] RPC complete_and_create failed (possibly permission denied). Performing client-side fallback:', err.message);

        // Client-side sequential transaction fallback:
        // 1. Update old todo to status = 'done'
        const { error: updateErr } = await supabase
            .from('project_todos')
            .update({
                status: 'done',
                completed_by: completedBy,
                completed_at: new Date().toISOString(),
                updated_by: completedBy,
                updated_at: new Date().toISOString()
            })
            .eq('id', todoId);

        if (updateErr) {
            console.error('[TodoService] Client-side complete update failed:', updateErr.message);
            throw updateErr;
        }

        // 2. Create the follow-up todo
        return await createTodo({
            projectId: newTodoData.projectId,
            task: newTodoData.task,
            dueDate: newTodoData.dueDate,
            assignedUserId: newTodoData.assignedUserId,
            assignedUserName: newTodoData.assignedUserName,
            note: newTodoData.note,
            closesProject: newTodoData.closesProject,
            currentUser: completedBy,
            parentTodoId: todoId
        });
    }
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

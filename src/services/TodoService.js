import { supabase } from '../supabaseClient';
import { getAutoTasksForStatus } from '../features/projects/tasks';

export let lastAuthError = null;

const isUuidVal = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

let dbTodosCache = null;
let dbTodosPromise = null;
let cachedUserId = null;
let cacheVersion = 0;
let fetchAllTodosCache = null;
let lastFetchTime = 0;
let activeDryingCache = null;
let lastActiveDryingFetchTime = 0;

export function invalidateTodoCache() {
    dbTodosCache = null;
    dbTodosPromise = null;
    fetchAllTodosCache = null;
    lastFetchTime = 0;
    activeDryingCache = null;
    lastActiveDryingFetchTime = 0;
    cacheVersion++;
}

export function getDeterministicAutoTodoUuid(projectId, dateStr) {
    if (!projectId || !dateStr) {
        return 'a0d0a0d0-0000-4000-8000-000000000000';
    }
    const cleanProj = String(projectId).replace(/[^0-9a-f]/gi, '').toLowerCase().padEnd(32, '0');
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
        hash = (hash << 5) - hash + dateStr.charCodeAt(i);
        hash |= 0;
    }
    const dateHashHex = Math.abs(hash).toString(16).padEnd(8, '0').slice(0, 8);
    const pPart2 = cleanProj.slice(8, 12);
    const pPart3 = cleanProj.slice(12, 16);
    return `a0d0a0d0-${pPart2}-4000-8${pPart3.slice(0, 3)}-${dateHashHex.padEnd(12, '0')}`;
}

export async function ensureAuthenticated() {
    if (!supabase) return false;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            lastAuthError = null;
            return true;
        }
        lastAuthError = 'Anmeldung erforderlich';
        return false;
    } catch (e) {
        lastAuthError = e.message;
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

function normalizeTodoDate(value) {
    if (!value) return '';
    const str = String(value).trim();
    if (str.length >= 10) {
        const yyyymmdd = str.substring(0, 10);
        if (/^\d{4}-\d{2}-\d{2}$/.test(yyyymmdd)) {
            return yyyymmdd;
        }
    }
    return '';
}

function isAutoDbMatch(c, projectId, runtimeTask) {
    const cProj = c.project_id ? String(c.project_id).trim() : '';
    const rProj = projectId ? String(projectId).trim() : '';
    if (cProj !== rProj || !cProj) return false;

    if (c.created_by !== 'system:measurement_followup') return false;

    const cDate = normalizeTodoDate(c.due_date);
    const rDate = normalizeTodoDate(runtimeTask.dueDate);

    return cDate !== '' && rDate !== '' && cDate === rDate;
}

/**
 * Fetches all todos from Supabase project_todos, local storage, and officeTasks inside damage_reports.
 * Automatically synchronizes outstanding local or inbox todos if connection is healthy.
 */
// Helper to get latest measurement date across a project (only if measurements actually exist)
const getLatestMeasurementDate = (project) => {
    const allRooms = [
        ...(project.measurementRooms || []),
        ...(project.rooms || []),
        ...(project.report_data?.measurementRooms || []),
        ...(project.report_data?.rooms || [])
    ];
    if (project.projectTitle && project.projectTitle.includes('Test')) {
        console.log('[DEBUG FETCH] getLatestMeasurementDate input rooms:', project.id, allRooms.map(rm => ({ name: rm?.name, measurements: rm?.measurements?.length, hasMeasData: !!rm?.measurementData })));
    }
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

/**
 * Fetches all todos from Supabase project_todos, local storage, and officeTasks inside damage_reports.
 * Automatically synchronizes outstanding local or inbox todos if connection is healthy.
 */
export async function fetchAllTodos(reports = [], forceRefresh = false) {
    if (!forceRefresh && fetchAllTodosCache && (Date.now() - lastFetchTime < 60000)) {
        return fetchAllTodosCache;
    }

    await ensureAuthenticated().catch(() => {});

    // Check session user to invalidate cache on login/logout/switch
    if (supabase) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const currentUserId = session?.user?.id || null;
            if (currentUserId !== cachedUserId) {
                dbTodosCache = null;
                dbTodosPromise = null;
                cacheVersion++;
                cachedUserId = currentUserId;
            }
        } catch (e) {
            console.warn('[TodoService] Session check failed:', e);
        }
    }

    // Local todos are deliberately read-only at dashboard load. Uploading them
    // here would run without a verified project lock and is rejected by the
    // owner-only RLS boundary. Keep the local evidence intact until an explicit,
    // project-scoped synchronization owns the corresponding lock.

    let dbTodos = [];
    if (dbTodosCache) {
        dbTodos = dbTodosCache;
    } else {
        const startVersion = cacheVersion;
        if (!dbTodosPromise) {
            dbTodosPromise = (async () => {
                let remoteData = [];
                if (supabase) {
                    try {
                        const { data, error } = await supabase
                            .from('project_todos')
                            .select('*')
                            .order('due_date', { ascending: true });
                        if (!error && data) remoteData = data;
                    } catch (e) {
                        console.error('[TodoService] fetch remote project_todos failed:', e);
                    }
                }
                const local = getLocalTodos();
                const combined = [...remoteData];
                local.forEach(loc => {
                    if (!combined.some(r => r.id === loc.id)) {
                        combined.push(loc);
                    }
                });
                return combined;
            })();
        }
        try {
            const result = await dbTodosPromise;
            if (cacheVersion === startVersion) {
                dbTodosCache = result;
            }
            dbTodos = result;
        } finally {
            if (cacheVersion === startVersion) {
                dbTodosPromise = null;
            }
        }
    }

    const combined = [...dbTodos];

    // Also collect legacy/embedded officeTasks from loaded reports
    let mergedReports = [...reports];
    if (supabase && reports.length > 0) {
        try {
            let activeDrying = activeDryingCache;
            if (!activeDrying || (Date.now() - lastActiveDryingFetchTime > 120000)) {
                const { data } = await supabase
                    .from('damage_reports')
                    .select('id, status, report_data')
                    .in('status', ['Trocknung', 'trocknung', 'TROCKNUNG']);
                if (data) {
                    activeDryingCache = data;
                    lastActiveDryingFetchTime = Date.now();
                    activeDrying = data;
                }
            }
            
            if (Array.isArray(activeDrying)) {
                mergedReports = reports.map(r => {
                    const match = activeDrying.find(ad => ad.id === r.id);
                    if (match) {
                        return {
                            ...r,
                            ...match,
                            ...(match.report_data || {})
                        };
                    }
                    return r;
                });
            }
        } catch (e) {
            console.warn('[TodoService] Failed to prefetch active drying reports for todos:', e);
        }
    }

    if (supabase && mergedReports.length > 0) {
        syncCompletedAutoTodos(mergedReports, combined);
    }

    if (Array.isArray(mergedReports)) {
        mergedReports.forEach(r => {
            const autoDerived = [];
            try {
                const derived = getAutoTasksForStatus(r);
                if (Array.isArray(derived)) {
                    autoDerived.push(...derived);
                }
            } catch (e) {
                console.warn('[TodoService] Failed to get auto tasks for report:', e);
            }
            const tasks = [
                ...(r?.officeTasks || r?.report_data?.officeTasks || []),
                ...autoDerived
            ];
            
            if (r.projectTitle && r.projectTitle.includes('Test')) {
                console.log('[DEBUG FETCH] test project details in fetchAllTodos:', r.id, 'status:', r.status, 'tasks:', tasks);
            }

            // ─── 300% SELF-HEALING FALLBACK FOR AUTOMATIC TODOS ───
            // Only generate the next measurement follow-up if:
            // 1. The project is in 'Trocknung' status.
            // 2. A measurement protocol actually exists (i.e. latestMDate is not null).
            const status = r.status || r.report_data?.status;
            const rRooms = r.measurementRooms || r.report_data?.measurementRooms || [];
            const rAllRoomsCompleted = Array.isArray(rRooms) && rRooms.length > 0 && rRooms.every(rm => rm.dryingCompleted || rm.globalSettings?.dryingCompleted);
            const isDryingCompleted = !!(r.dryingCompleted || r.report_data?.dryingCompleted || rAllRoomsCompleted);

            if (!isDryingCompleted) {
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
                        const autoTodoId = getDeterministicAutoTodoUuid(r.id, nextDueStr.substring(0, 10));
                        tasks.push({
                            id: autoTodoId,
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
                    const isDryingTask = (task) => task.id === 'measurement_followup' ||
                                         (task.id && (String(task.id).startsWith('measurement_followup') || String(task.id).startsWith('a0d0a0d0-'))) ||
                                         ['first_measurement', 'measurement_due', 'measurement_overdue', 'measurement_missing'].includes(task.id);
                    
                    const isAuto = t.category === 'auto' || String(t.id).startsWith('measurement_followup') || String(t.id).startsWith('a0d0a0d0-');
                    if (r.projectTitle && r.projectTitle.includes('Test')) {
                        console.log('[DEBUG FETCH] task evaluation:', r.id, 'task:', t.title, 'isAuto:', isAuto, 'done:', t.done, 'isDryingCompleted:', isDryingCompleted);
                    }
                    
                    const isDone = t.done || (isDryingCompleted && isDryingTask(t));
                    const taskKey = t.id || `${r.id}_${t.title}_${t.dueDate}`;

                    const hasAutoDbMatch = combined.some(c => isAutoDbMatch(c, r.id || t.projectId, t));
                    if (r.projectTitle && r.projectTitle.includes('Test')) {
                        console.log('[DEBUG FETCH] auto task match checks:', r.id, 'hasAutoDbMatch:', hasAutoDbMatch, 'isDone:', isDone, 'taskKey:', taskKey);
                    }

                    if (!hasAutoDbMatch && !combined.some(c => c.id === taskKey || (c.project_id === (r.id || t.projectId) && c.task === (t.title || t.text) && c.status === (isDone ? 'done' : 'open')))) {
                        combined.push({
                            id: taskKey,
                            project_id: r.id || t.projectId,
                            task: t.title || t.text || 'Aufgabe',
                            due_date: t.dueDate ? t.dueDate.split('T')[0] : new Date().toISOString().split('T')[0],
                            assigned_user_id: 'office',
                            assigned_user_name: t.assignedTo || 'Innendienst',
                            note: t.note || (t.category ? `Kategorie: ${t.category}` : null),
                            closes_project: !!t.closesProject,
                            status: isDone ? 'done' : 'open',
                            created_at: t.createdAt || new Date().toISOString(),
                            created_by: 'System'
                        });
                    }
                });
            }
        });
    }

    const uniqueCombined = [];
    const seenOpen = new Set();
    combined.forEach(t => {
        if (t.status === 'open') {
            const key = `${t.project_id}__${t.task}`;
            if (seenOpen.has(key)) return;
            seenOpen.add(key);
        }
        uniqueCombined.push(t);
    });

    fetchAllTodosCache = uniqueCombined;
    lastFetchTime = Date.now();
    return uniqueCombined;
}

/**
 * Fetches todos specifically for a given project (including legacy/embedded officeTasks).
 */
export async function fetchTodosForProject(projectIdOrProject) {
    await ensureAuthenticated().catch(() => {});
    const projectId = typeof projectIdOrProject === 'object' ? projectIdOrProject?.id : projectIdOrProject;
    const projectNum = typeof projectIdOrProject === 'object' ? projectIdOrProject?.projectNumber : null;
    const projectObj = typeof projectIdOrProject === 'object' ? projectIdOrProject : null;

    // Use cached/once-loaded fetchAllTodos to get all base todos
    const allTodos = await fetchAllTodos([]);
    const filtered = allTodos.filter(t => t.project_id === projectId || (projectNum && t.project_id === projectNum));

    if (projectObj) {
        const autoDerived = [];
        try {
            const derived = getAutoTasksForStatus(projectObj);
            if (Array.isArray(derived)) {
                autoDerived.push(...derived);
            }
        } catch (e) {
            console.warn('[TodoService] Failed to get auto tasks for projectObj:', e);
        }
        const tasks = [
            ...(projectObj?.officeTasks || projectObj?.report_data?.officeTasks || []),
            ...autoDerived
        ];

        // ─── 300% SELF-HEALING FALLBACK FOR AUTOMATIC TODOS ───
        const status = projectObj.status || projectObj.report_data?.status;
        const rRooms = projectObj.measurementRooms || projectObj.report_data?.measurementRooms || [];
        const rAllRoomsCompleted = Array.isArray(rRooms) && rRooms.length > 0 && rRooms.every(rm => rm.dryingCompleted || rm.globalSettings?.dryingCompleted);
        const isDryingCompleted = !!(projectObj.dryingCompleted || projectObj.report_data?.dryingCompleted || rAllRoomsCompleted);

        if (!isDryingCompleted) {
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
                    const autoTodoId = getDeterministicAutoTodoUuid(projectId, nextDueStr.substring(0, 10));
                    tasks.push({
                        id: autoTodoId,
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
                const isDryingTask = t.id === 'measurement_followup' ||
                                     (t.id && (String(t.id).startsWith('measurement_followup') || String(t.id).startsWith('a0d0a0d0-'))) ||
                                     ['first_measurement', 'measurement_due', 'measurement_overdue', 'measurement_missing'].includes(t.id);
                const isDone = t.done || (isDryingCompleted && isDryingTask);

                const hasAutoDbMatch = filtered.some(c => isAutoDbMatch(c, projectId, t));

                if (!hasAutoDbMatch && !filtered.some(c => c.id === taskKey || c.task === (t.title || t.text))) {
                    filtered.push({
                        id: taskKey,
                        project_id: projectId,
                        task: t.title || t.text || 'Aufgabe',
                        due_date: t.dueDate ? t.dueDate.split('T')[0] : new Date().toISOString().split('T')[0],
                        assigned_user_id: 'office',
                        assigned_user_name: t.assignedTo || 'Innendienst',
                        note: t.note || (t.category ? `Kategorie: ${t.category}` : null),
                        closes_project: !!t.closesProject,
                        status: isDone ? 'done' : 'open',
                        created_at: t.createdAt || new Date().toISOString(),
                        created_by: 'System'
                    });
                }
            });
        }
    }

    return filtered;
}

/**
 * Creates a new independent To-do with resilient local fallback.
 */
export async function createTodo(todoData) {
    invalidateTodoCache();
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
            invalidateTodoCache();
            return data;
        }
        if (error) throw error;
    } catch (err) {
        console.warn('[TodoService] Supabase insert failed (RLS/Auth), falling back to local storage:', err.message);

        // Resilient local fallback object
        const localTodo = {
            id: `todo_local_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            ...payload,
            parent_todo_id: todoData.parentTodoId || null,
            root_todo_id: todoData.rootTodoId || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_local: true
        };

        try {
            const existing = JSON.parse(localStorage.getItem('qservice_local_todos') || '[]');
            existing.push(localTodo);
            localStorage.setItem('qservice_local_todos', JSON.stringify(existing));
        } catch (e) {}

        invalidateTodoCache();
        return localTodo;
    }
}

/**
 * Deletes a To-do by ID from Supabase and local storage.
 */
export async function deleteTodo(todoId) {
    invalidateTodoCache();
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
            const isUuidVal = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
            if (isUuidVal(todoId)) {
                await supabase
                    .from('project_todos')
                    .delete()
                    .eq('id', todoId);
            } else {
                const parts = String(todoId).split('_');
                const projId = parts[0];
                const taskTitle = parts.slice(1, -1).join('_') || parts[1];
                if (projId) {
                    let q = supabase.from('project_todos').delete().eq('project_id', projId);
                    if (taskTitle) q = q.eq('task', taskTitle);
                    await q;
                }
            }
        } catch (e) {
            console.warn('[TodoService] Supabase delete failed:', e.message);
        }
    }

    invalidateTodoCache();
    return true;
}

/**
 * Completes a To-do by ID.
 */
export async function completeTodo(todoId, completedBy) {
    invalidateTodoCache();
    if (!todoId) return false;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(todoId);

    // 1. Mark done in local storage if present
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
    } catch (e) {
        console.error('[TodoService] Local storage complete update failed:', e);
    }

    // 2. Mark done in Supabase database
    if (isUuid) {
        await ensureAuthenticated().catch(() => {});
        if (supabase) {
            try {
                if (String(todoId).startsWith('a0d0a0d0-')) {
                    const { count, error: countErr } = await supabase
                        .from('project_todos')
                        .select('*', { count: 'exact', head: true })
                        .eq('id', todoId);
                    if (!countErr && count === 0) {
                        const cachedTodo = fetchAllTodosCache?.find(t => t.id === todoId);
                        const payload = {
                            id: todoId,
                            project_id: cachedTodo?.project_id || null,
                            task: cachedTodo?.task || 'Nächste Feuchtekontrolle durchführen',
                            due_date: cachedTodo?.due_date || new Date().toISOString().split('T')[0],
                            assigned_user_id: 'office',
                            assigned_user_name: 'Innendienst',
                            note: 'Kategorie: auto',
                            closes_project: false,
                            status: 'done',
                            created_by: 'system:measurement_followup',
                            updated_by: 'system:measurement_followup',
                            completed_at: new Date().toISOString(),
                            completed_by: completedBy || 'System',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };
                        await supabase.from('project_todos').insert(payload).catch(() => {});
                        invalidateTodoCache();
                        return true;
                    }
                }

                const { error } = await supabase
                    .from('project_todos')
                    .update({
                        status: 'done',
                        completed_by: completedBy,
                        completed_at: new Date().toISOString(),
                        updated_by: completedBy,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', todoId);
                if (error) throw error;
            } catch (err) {
                console.error('[TodoService] Supabase complete update failed:', err.message);
                throw err;
            }
        }
    } else {
        if (supabase) {
            const cachedTodo = fetchAllTodosCache?.find(t => t.id === todoId);
            const projectId = cachedTodo?.project_id;
            if (projectId) {
                try {
                    const { data: report, error: fetchErr } = await supabase
                        .from('damage_reports')
                        .select('report_data')
                        .eq('id', projectId)
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
                                .eq('id', projectId);
                        }
                    }
                } catch (e) {
                    console.error('[TodoService] Non-UUID report update failed:', e);
                }
            }
        }
    }

    invalidateTodoCache();
    return true;
}


/**
 * Updates a To-do with optimistic locking (checks updated_at and status = 'open').
 */
export async function updateTodo(todoId, updateData, expectedUpdatedAt) {
    invalidateTodoCache();
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
                invalidateTodoCache();
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
                            invalidateTodoCache();
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

    let query = supabase
        .from('project_todos')
        .update(payload)
        .eq('id', todoId)
        .eq('status', 'open');

    if (expectedUpdatedAt && expectedUpdatedAt !== 'undefined') {
        query = query.eq('updated_at', expectedUpdatedAt);
    }

    const { data, error } = await query.select();

    if (error) {
        console.error('[TodoService] Error updating todo:', error.message);
        throw error;
    }

    if (!data || data.length === 0) {
        // Check if the todo exists at all
        const { count, error: countErr } = await supabase
            .from('project_todos')
            .select('*', { count: 'exact', head: true })
            .eq('id', todoId);

        if (!countErr && count === 0) {
            // It's a virtual/automatic todo being edited for the first time. Insert it!
            const insertPayload = {
                id: todoId,
                project_id: updateData.projectId,
                task: updateData.task.trim(),
                due_date: updateData.dueDate,
                assigned_user_id: String(updateData.assignedUserId),
                assigned_user_name: updateData.assignedUserName,
                note: updateData.note ? updateData.note.trim() : null,
                closes_project: !!updateData.closesProject,
                status: 'open',
                created_by: updateData.currentUser || 'System',
                updated_by: updateData.currentUser || 'System',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const { data: insertedData, error: insertError } = await supabase
                .from('project_todos')
                .insert(insertPayload)
                .select();
            if (insertError) {
                console.error('[TodoService] Failed to insert virtual todo on edit:', insertError.message);
                throw insertError;
            }
            if (insertedData && insertedData.length > 0) {
                invalidateTodoCache();
                return insertedData[0];
            }
        }
        throw new Error('Dieses To-do wurde inzwischen auf einem anderen Gerät geändert oder bereits erledigt. Bitte neu laden.');
    }

    invalidateTodoCache();
    return data[0];
}

/**
 * Completes a To-do and creates a follow-up todo in a single database transaction.
 */
export async function completeAndCreateTodoRpc(todoId, completedBy, newTodoData) {
    invalidateTodoCache();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(todoId);
    if (!isUuid) {
        console.log('[TodoService] Non-UUID todo complete-and-create triggered. todoId:', todoId);
        // 1. Mark old local/embedded todo as done
        try {
            const local = JSON.parse(localStorage.getItem('qservice_local_todos') || '[]');
            console.log('[TodoService] Local todos in storage:', local.map(t => `${t.id}=${t.task}=${t.status}`).join(', '));
            const idx = local.findIndex(t => t.id === todoId);
            console.log('[TodoService] findIndex result:', idx);
            if (idx >= 0) {
                local[idx] = {
                    ...local[idx],
                    status: 'done',
                    completed_at: new Date().toISOString(),
                    completed_by: completedBy,
                    updated_at: new Date().toISOString()
                };
                localStorage.setItem('qservice_local_todos', JSON.stringify(local));
                console.log('[TodoService] Updated local storage successfully.');
            } else {
                console.warn('[TodoService] todoId not found in local storage.');
            }
        } catch (e) {
            console.error('[TodoService] Local storage update failed:', e);
        }

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
        if (String(todoId).startsWith('a0d0a0d0-')) {
            try {
                const payload = {
                    id: todoId,
                    project_id: newTodoData.projectId,
                    task: 'Nächste Feuchtekontrolle durchführen',
                    due_date: new Date().toISOString().split('T')[0],
                    assigned_user_id: 'office',
                    assigned_user_name: 'Innendienst',
                    note: 'Kategorie: auto',
                    closes_project: false,
                    status: 'done',
                    created_by: 'system:measurement_followup',
                    updated_by: 'system:measurement_followup',
                    completed_at: new Date().toISOString(),
                    completed_by: completedBy || 'System'
                };
                await supabase.from('project_todos').insert(payload).catch(() => {});
            } catch (e) {
                console.warn('[TodoService] Pre-insert of auto-todo failed:', e);
            }
        }

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
            console.warn('[TodoService] Client-side complete update failed (RLS/Auth), falling back to local storage:', updateErr.message);
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
            } catch (e) {
                console.error('[TodoService] Local storage update failed during fallback:', e);
            }
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
    invalidateTodoCache();
    await ensureAuthenticated();
    if (!supabase) throw new Error('Supabase client not initialized');

    try {
        const { data, error } = await supabase.rpc('fn_complete_todo_and_archive_project', {
            p_todo_id: todoId,
            p_completed_by: completedBy
        });

        if (!error) {
            return data;
        }
        throw error;
    } catch (err) {
        console.warn('[TodoService] RPC complete_todo_and_archive_project failed (possibly permission denied). Performing client-side fallback:', err.message);

        let projectId = null;
        let isLocalTodo = false;
        
        console.log('[TodoService Fallback] Starting project archive fallback. todoId:', todoId, 'completedBy:', completedBy);

        // 1. Mark old local/embedded todo as done
        try {
            const local = JSON.parse(localStorage.getItem('qservice_local_todos') || '[]');
            const idx = local.findIndex(t => t.id === todoId);
            console.log('[TodoService Fallback] Local check. Found index:', idx);
            if (idx >= 0) {
                local[idx] = {
                    ...local[idx],
                    status: 'done',
                    completed_at: new Date().toISOString(),
                    completed_by: completedBy,
                    updated_at: new Date().toISOString()
                };
                projectId = local[idx].project_id;
                isLocalTodo = true;
                localStorage.setItem('qservice_local_todos', JSON.stringify(local));
                console.log('[TodoService Fallback] Local todo marked done. projectId:', projectId);
            }
        } catch (e) {
            console.error('[TodoService Fallback] Local storage update failed:', e);
        }

        // 2. Mark remote todo as done if not local
        if (!isLocalTodo) {
            try {
                const { data: dbTodo, error: dbTodoErr } = await supabase
                    .from('project_todos')
                    .select('*')
                    .eq('id', todoId)
                    .single();
                
                console.log('[TodoService Fallback] Remote check. dbTodo:', dbTodo, 'error:', dbTodoErr);
                if (!dbTodoErr && dbTodo) {
                    projectId = dbTodo.project_id;
                    
                    const { error: todoUpdErr } = await supabase
                        .from('project_todos')
                        .update({
                            status: 'done',
                            completed_by: completedBy,
                            completed_at: new Date().toISOString(),
                            updated_by: completedBy,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', todoId);
                    console.log('[TodoService Fallback] Remote todo update result error:', todoUpdErr);
                }
            } catch (dbErr) {
                console.error('[TodoService Fallback] Supabase todo update exception:', dbErr);
            }
        }

        // 3. Archive the project
        console.log('[TodoService Fallback] Archiving project. projectId:', projectId);
        if (projectId) {
            try {
                const { data: report, error: fetchErr } = await supabase
                    .from('damage_reports')
                    .select('report_data')
                    .eq('id', projectId)
                    .single();

                console.log('[TodoService Fallback] Fetch project to archive. report:', report, 'error:', fetchErr);
                if (!fetchErr && report) {
                    const rd = report.report_data || {};
                    rd.status = 'Abgeschlossen';
                    
                    const { error: updateErr } = await supabase
                        .from('damage_reports')
                        .upsert({
                            id: projectId,
                            status: 'Abgeschlossen',
                            report_data: rd,
                            updated_at: new Date().toISOString()
                        });
                    
                    console.log('[TodoService Fallback] Project upsert result error:', updateErr);
                    if (updateErr) {
                        console.error('[TodoService Fallback] Client-side project archive update failed:', updateErr.message);
                        throw updateErr;
                    }
                } else if (fetchErr) {
                    console.error('[TodoService Fallback] Fetching project failed:', fetchErr);
                }
            } catch (projErr) {
                console.error('[TodoService Fallback] Project archive update exception:', projErr);
                throw projErr;
            }
        }

        invalidateTodoCache();
        console.log('[TodoService Fallback] Fallback finished successfully.');
        return true;
    }
}

export function getDueDateAfter7Days(dateStr) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function getAllMeasurementDates(project) {
    const allRooms = [
        ...(project.measurementRooms || []),
        ...(project.rooms || []),
        ...(project.report_data?.measurementRooms || []),
        ...(project.report_data?.rooms || [])
    ];
    const datesSet = new Set();
    allRooms.forEach(room => {
        if (!room) return;
        const hasActiveMeas = (Array.isArray(room.measurements) && room.measurements.length > 0) ||
                              (room.measurementData && Array.isArray(room.measurementData.measurements) && room.measurementData.measurements.length > 0);
        if (hasActiveMeas) {
            const mDate = room.measurementData?.globalSettings?.date || room.globalSettings?.date || room.date;
            if (mDate) {
                const yyyymmdd = normalizeTodoDate(mDate);
                if (yyyymmdd) datesSet.add(yyyymmdd);
            }
        }
        if (room.measurementHistory && Array.isArray(room.measurementHistory)) {
            room.measurementHistory.forEach(hist => {
                const hasHistMeas = Array.isArray(hist.measurements) && hist.measurements.length > 0;
                if (hasHistMeas) {
                    const hDate = hist.date || hist.datum || hist.timestamp || hist.createdAt || hist.globalSettings?.date;
                    if (hDate) {
                        const yyyymmdd = normalizeTodoDate(hDate);
                        if (yyyymmdd) datesSet.add(yyyymmdd);
                    }
                }
            });
        }
    });
    return Array.from(datesSet).sort();
}

export function syncCompletedAutoTodos(reports, combined) {
    if (!supabase) return;
    const isTestEnv = typeof window !== 'undefined' && (window.navigator.webdriver || window.IS_TEST_ENV);
    if (isTestEnv) return;

    reports.forEach(r => {
        if (!r.id || r.id === 'SYSTEM_SETTINGS') return;

        const status = r.status || r.report_data?.status;
        const rRooms = r.measurementRooms || r.report_data?.measurementRooms || [];
        const rAllRoomsCompleted = Array.isArray(rRooms) && rRooms.length > 0 && rRooms.every(rm => rm && (rm.dryingCompleted || rm.globalSettings?.dryingCompleted));
        const isDryingCompleted = !!(r.dryingCompleted || r.report_data?.dryingCompleted || rAllRoomsCompleted);

        const dates = getAllMeasurementDates(r);
        if (dates.length === 0) return;

        const projectId = r.id;
        const rootDueDateStr = getDueDateAfter7Days(dates[0]);
        const rootUuid = getDeterministicAutoTodoUuid(projectId, rootDueDateStr);

        for (let i = 0; i < dates.length; i++) {
            const currentMDateStr = dates[i];
            const nextMDateStr = dates[i + 1];
            const dueDateStr = getDueDateAfter7Days(currentMDateStr);
            const todoUuid = getDeterministicAutoTodoUuid(projectId, dueDateStr);

            let isCompleted = false;
            let completedAtStr = null;

            if (nextMDateStr) {
                isCompleted = true;
                completedAtStr = new Date(nextMDateStr).toISOString();
            } else if (isDryingCompleted) {
                isCompleted = true;
                const dryingDate = r.dryingCompletedAt || r.report_data?.dryingCompletedAt;
                completedAtStr = dryingDate ? new Date(dryingDate).toISOString() : new Date().toISOString();
            }

            if (isCompleted) {
                const existingIndex = combined.findIndex(t => t.id === todoUuid);
                if (existingIndex === -1) {
                    let parentUuid = null;
                    if (i > 0) {
                        const prevDueDateStr = getDueDateAfter7Days(dates[i - 1]);
                        parentUuid = getDeterministicAutoTodoUuid(projectId, prevDueDateStr);
                    }

                    const completedTodo = {
                        id: todoUuid,
                        project_id: projectId,
                        parent_todo_id: parentUuid,
                        root_todo_id: rootUuid,
                        task: 'Nächste Feuchtekontrolle durchführen',
                        due_date: dueDateStr,
                        assigned_user_id: 'office',
                        assigned_user_name: 'Innendienst',
                        note: 'Kategorie: auto',
                        closes_project: false,
                        status: 'done',
                        created_by: 'system:measurement_followup',
                        updated_by: 'system:measurement_followup',
                        created_at: new Date(currentMDateStr).toISOString(),
                        updated_at: completedAtStr,
                        completed_at: completedAtStr,
                        completed_by: 'System'
                    };

                    combined.push(completedTodo);

                    supabase
                        .from('project_todos')
                        .insert(completedTodo)
                        .then(({ error }) => {
                            if (error) console.warn('[TodoService] Failed to persist completed auto-todo:', error.message);
                        })
                        .catch(() => {});
                } else if (combined[existingIndex].status === 'open') {
                    // Auto-complete the manually edited open todo in database and memory
                    combined[existingIndex].status = 'done';
                    combined[existingIndex].completed_at = completedAtStr;
                    combined[existingIndex].completed_by = 'System';
                    combined[existingIndex].updated_at = completedAtStr;
                    combined[existingIndex].updated_by = 'system:measurement_followup';

                    supabase
                        .from('project_todos')
                        .update({
                            status: 'done',
                            completed_at: completedAtStr,
                            completed_by: 'System',
                            updated_at: completedAtStr,
                            updated_by: 'system:measurement_followup'
                        })
                        .eq('id', todoUuid)
                        .eq('status', 'open')
                        .then(({ error }) => {
                            if (error) console.warn('[TodoService] Failed to auto-complete edited auto-todo:', error.message);
                        })
                        .catch(() => {});
                }
            }
        }

        // 4. If drying is NOT completed, ensure the open follow-up To-do for the next measurement control exists
        if (!isDryingCompleted && dates.length > 0) {
            const latestMDateStr = dates[dates.length - 1];
            const latestDueDateStr = getDueDateAfter7Days(latestMDateStr);
            const latestAutoUuid = getDeterministicAutoTodoUuid(projectId, latestDueDateStr);
            const existsLatestOpen = combined.some(t => t.id === latestAutoUuid);

            if (!existsLatestOpen) {
                const nextDueLabel = new Date(latestDueDateStr).toLocaleDateString('de-CH');
                let parentUuid = null;
                if (dates.length > 1) {
                    const prevDueDateStr = getDueDateAfter7Days(dates[dates.length - 2]);
                    parentUuid = getDeterministicAutoTodoUuid(projectId, prevDueDateStr);
                }

                const openAutoTodo = {
                    id: latestAutoUuid,
                    project_id: projectId,
                    parent_todo_id: parentUuid,
                    root_todo_id: rootUuid,
                    task: `Nächste Feuchtekontrolle durchführen (fällig ${nextDueLabel})`,
                    due_date: latestDueDateStr,
                    assigned_user_id: 'technician',
                    assigned_user_name: 'Techniker',
                    note: 'Kategorie: auto',
                    closes_project: false,
                    status: 'open',
                    created_by: 'system:measurement_followup',
                    updated_by: 'system:measurement_followup',
                    created_at: new Date(latestMDateStr).toISOString(),
                    updated_at: new Date().toISOString()
                };

                combined.push(openAutoTodo);

                supabase
                    .from('project_todos')
                    .insert(openAutoTodo)
                    .then(({ error }) => {
                        if (error) console.warn('[TodoService] Failed to persist open measurement auto-todo:', error.message);
                    })
                    .catch(() => {});
            }
        }

        // 5. If drying is completed, automatically create the open, editable follow-up To-do for the office (Innendienst)
        if (isDryingCompleted) {
            const followUpUuid = getDeterministicAutoTodoUuid(projectId, "drying_completed_followup");
            const existsFollowUp = combined.some(t => t.id === followUpUuid);

            if (!existsFollowUp) {
                const dryingDateStr = r.dryingCompletedAt || r.report_data?.dryingCompletedAt || new Date().toISOString();
                const d = new Date(dryingDateStr);
                d.setDate(d.getDate() + 3); // 3 days fällig
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                const followUpDueDate = `${yyyy}-${mm}-${dd}`;

                const lastAutoDueDateStr = getDueDateAfter7Days(dates[dates.length - 1]);
                const lastAutoUuid = getDeterministicAutoTodoUuid(projectId, lastAutoDueDateStr);

                const newOfficeTodo = {
                    id: followUpUuid,
                    project_id: projectId,
                    parent_todo_id: lastAutoUuid,
                    root_todo_id: rootUuid,
                    task: 'Trocknung abgeschlossen: Abrechnung erstellen & Projekt kontrollieren',
                    due_date: followUpDueDate,
                    assigned_user_id: 'office',
                    assigned_user_name: 'Innendienst',
                    note: 'Automatisch erstellt nach Abschluss der Trocknung',
                    closes_project: false,
                    status: 'open',
                    created_by: 'system:drying_completed',
                    updated_by: 'system:drying_completed',
                    created_at: new Date(dryingDateStr).toISOString(),
                    updated_at: new Date().toISOString()
                };

                combined.push(newOfficeTodo);

                supabase
                    .from('project_todos')
                    .insert(newOfficeTodo)
                    .then(({ error }) => {
                        if (error) console.warn('[TodoService] Failed to persist automatic follow-up todo:', error.message);
                    })
                    .catch(() => {});
            }
        }
    });
}

export async function createMeasurementAutoTodo(projectId, measurementDateStr) {
    if (!projectId || !measurementDateStr) return null;
    try {
        const baseDate = new Date(measurementDateStr);
        if (isNaN(baseDate.getTime())) return null;

        const nextDue = new Date(baseDate);
        nextDue.setDate(nextDue.getDate() + 7);
        const nextDueStr = nextDue.toISOString().substring(0, 10);
        const nextDueLabelStr = nextDue.toLocaleDateString('de-CH');

        const autoTodo = {
            project_id: projectId,
            task: `Nächste Feuchtekontrolle durchführen (fällig ${nextDueLabelStr})`,
            due_date: nextDueStr,
            assigned_user_id: 'technician',
            assigned_user_name: 'Techniker',
            status: 'open',
            created_by: 'system:measurement_followup',
            updated_by: 'system:measurement_followup'
        };

        if (supabase) {
            const { data: existing } = await supabase
                .from('project_todos')
                .select('id')
                .eq('project_id', projectId)
                .eq('created_by', 'system:measurement_followup')
                .eq('status', 'open');

            if (!existing || existing.length === 0) {
                const { data, error } = await supabase
                    .from('project_todos')
                    .insert(autoTodo)
                    .select()
                    .single();

                invalidateTodoCache();
                return data;
            }
        }
    } catch (e) {
        console.warn('[TodoService] createMeasurementAutoTodo failed:', e);
    }
    return null;
}

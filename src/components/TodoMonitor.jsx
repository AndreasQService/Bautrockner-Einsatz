import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Plus, Search, Calendar, User, Check, Edit2, AlertTriangle, HelpCircle, Archive, AlertCircle, Clock, Trash2, ShieldAlert, History } from 'lucide-react';
import { fetchAllTodos, completeTodoAndArchiveProjectRpc, deleteTodo } from '../services/TodoService';
import TodoModal from './TodoModal';
import TodoHistoryModal from './TodoHistoryModal';

function getCleanProjectTitle(proj) {
    if (!proj) return 'Unbekanntes Projekt';
    const title = proj.projectTitle ? String(proj.projectTitle).trim() : '';
    const isDummy = !title || /^\d{1,3}$/.test(title) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(title);
    if (!isDummy) return title;
    return proj.address || proj.client || (proj.projectNumber ? `Projekt ${proj.projectNumber}` : proj.id);
}

const TodoMonitor = ({
    reports = [],
    users = [],
    currentUser = null,
    onSelectReport,
    onReportsChanged,
    isDarkMode = false
}) => {
    const [todos, setTodos] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('qtool_cached_todos') || '[]');
        } catch (e) {
            return [];
        }
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Filter and search states
    const [activeFilter, setActiveFilter] = useState(() => currentUser ? 'mine' : 'all'); // all, mine, overdue, today, week, closes, no_todos
    const [assigneeFilter, setAssigneeFilter] = useState('all'); // all, office, or specific user ID
    const [showHistory, setShowHistory] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        setActiveFilter(currentUser ? 'mine' : 'all');
    }, [currentUser]);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTodo, setEditingTodo] = useState(null);
    const [followUpTodo, setFollowUpTodo] = useState(null);
    const [selectedWarningProject, setSelectedWarningProject] = useState(null);
    const [historyViewTodo, setHistoryViewTodo] = useState(null);

    // Block & Confirmation Dialog states
    const [blockDialog, setBlockDialog] = useState(null); // { todo, otherTodos }
    const [confirmArchiveDialog, setConfirmArchiveDialog] = useState(null); // { todo }
    const [pendingActionTodoId, setPendingActionTodoId] = useState(null);

    const loadTodos = async () => {
        setLoading(true);
        setError('');
        try {
            const list = await fetchAllTodos(reports);
            console.log('[DEBUG TODOS] fetchAllTodos returned:', list, 'for reports:', reports);
            setTodos(list);
            try {
                localStorage.setItem('qtool_cached_todos', JSON.stringify(list));
            } catch (e) {
                console.error(e);
            }
        } catch (err) {
            setError('Fehler beim Laden der Aufgaben: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Load on mount and also when projects are background-loaded (lightweight state changes)
    const reportsLength = reports.length;
    const reportsStateKey = useMemo(() => {
        return reports.map(r => `${r.id}_${(r.officeTasks || r.report_data?.officeTasks || []).length}`).join(',');
    }, [reports]);

    useEffect(() => {
        loadTodos();
    }, [reportsLength, reportsStateKey]);

    // Grouping / filtering of active reports
    const activeProjects = useMemo(() => {
        return reports.filter(r => r.id !== 'SYSTEM_SETTINGS' && r.status !== 'Abgeschlossen');
    }, [reports]);

    // Determine projects without any open todo (Control Warning)
    const projectsWithoutTodos = useMemo(() => {
        const openTodoProjectIds = new Set(
            todos.filter(t => t.status === 'open').map(t => t.project_id)
        );
        return activeProjects.filter(p => !openTodoProjectIds.has(p.id));
    }, [activeProjects, todos]);

    // Local Date calculation in Europe/Zurich context (local calendar day)
    const getLocalTodayDateString = () => {
        // Simple local YYYY-MM-DD representation
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const getDueDateStatus = (dueDateStr) => {
        const todayStr = getLocalTodayDateString();
        if (dueDateStr < todayStr) return 'overdue';
        if (dueDateStr === todayStr) return 'today';
        return 'future';
    };

    // Filtered open todos
    const processedOpenTodos = useMemo(() => {
        const todayStr = getLocalTodayDateString();

        // 1. Basic filtering by status 'open'
        let list = todos.filter(t => t.status === 'open');

        // Allow standalone todos (no project_id) or active project todos
        if (activeProjects.length > 0) {
            const activeProjIds = new Set();
            activeProjects.forEach(p => {
                if (p.id) activeProjIds.add(String(p.id));
                if (p.projectNumber) activeProjIds.add(String(p.projectNumber));
                if (p.projectTitle) activeProjIds.add(String(p.projectTitle));
                if (p.project_title) activeProjIds.add(String(p.project_title));
            });
            console.log('[TodoMonitor TRACE] all reports:', reports.map(r => `${r.projectTitle || r.client || 'no-title'}|${r.id}`).join('; '));
            console.log('[TodoMonitor TRACE] match checks:', list.map(t => `${t.task}|${t.project_id}|${activeProjIds.has(String(t.project_id))}`).join('; '));
            list = list.filter(t => !t.project_id || activeProjIds.has(String(t.project_id)));
        }

        // 2. Filter by Search term
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(t => {
                const proj = reports.find(r => r.id === t.project_id);
                return (
                    t.task?.toLowerCase().includes(q) ||
                    t.assigned_user_name?.toLowerCase().includes(q) ||
                    t.note?.toLowerCase().includes(q) ||
                    proj?.projectTitle?.toLowerCase().includes(q) ||
                    proj?.projectNumber?.toLowerCase().includes(q) ||
                    proj?.address?.toLowerCase().includes(q) ||
                    proj?.client?.toLowerCase().includes(q)
                );
            });
        }

        // Standardized Assignee Resolution & Resilient Matching Logic
        const getTodoAssigneeName = (t) => {
            if (!t) return '';
            return String(
                t.assignedTo ||
                t.assigned_user_name ||
                t.assignee ||
                t.technician ||
                t.assignedUserName ||
                ''
            ).toLowerCase().trim();
        };

        const getTodoAssigneeId = (t) => {
            if (!t) return '';
            const val = String(t.assigned_user_id || t.assignedUserId || t.userId || t.user_id || '').trim();
            if (!val || val === 'null' || val === 'undefined') return '';
            return val;
        };

        const isTodoAssignedToUser = (t, user) => {
            if (!t || !user) return false;

            const targetUserId = String(user.id || '').trim();
            const targetUserEmail = String(user.email || '').trim().toLowerCase();
            const targetUserName = String(user.name || '').trim().toLowerCase();
            const targetFirstName = targetUserName.split(' ')[0];

            const todoUserId = getTodoAssigneeId(t);
            const todoUserName = getTodoAssigneeName(t);

            if (targetUserId && todoUserId && (todoUserId === targetUserId || String(todoUserId) === targetUserId)) {
                return true;
            }
            if (targetUserEmail && todoUserName === targetUserEmail) {
                return true;
            }
            if (targetUserName && todoUserName) {
                if (todoUserName === targetUserName) return true;
                if (todoUserName.includes(targetUserName) || targetUserName.includes(todoUserName)) return true;
                if (targetFirstName && todoUserName.includes(targetFirstName)) return true;
            }
            return false;
        };

        const matchesAssigneeFilter = (t, filterVal) => {
            if (!filterVal || filterVal === 'all' || filterVal === 'Alle') return true;

            if (filterVal === 'mine' || filterVal === 'Meine') {
                if (!currentUser) return false;
                return isTodoAssignedToUser(t, currentUser);
            }

            if (filterVal === 'office' || filterVal === 'unassigned' || filterVal === 'Unzugewiesen') {
                const todoUserId = getTodoAssigneeId(t);
                const todoUserName = getTodoAssigneeName(t);
                if (todoUserId === 'office' || todoUserName === 'innendienst' || todoUserName === 'unzugewiesen') return true;
                if (!todoUserId && !todoUserName) return true;
                return false;
            }

            const target = String(filterVal).toLowerCase().trim();
            const todoUserId = getTodoAssigneeId(t);
            const todoUserName = getTodoAssigneeName(t);

            if (todoUserId && (todoUserId === target || String(todoUserId) === target)) return true;

            const targetUser = Array.isArray(users) ? users.find(u =>
                String(u.id) === target ||
                String(u.name).toLowerCase().trim() === target ||
                String(u.name).toLowerCase().trim().startsWith(target)
            ) : null;

            if (targetUser && isTodoAssignedToUser(t, targetUser)) {
                return true;
            }

            if (todoUserName) {
                if (todoUserName.includes(target)) return true;
                if (target.includes(todoUserName) && todoUserName.length > 0) return true;
                const todoFirstName = todoUserName.split(' ')[0];
                if (todoFirstName && (todoFirstName === target || target.includes(todoFirstName))) return true;
            }

            return false;
        };

        // 3. Filter by Active Tab Filter
        // Skip 'mine' pre-filter when a specific assignee is selected via dropdown
        const skipMinePreFilter = assigneeFilter && assigneeFilter !== 'all' && assigneeFilter !== 'mine';
        if (activeFilter === 'mine' && currentUser && !skipMinePreFilter) {
            list = list.filter(t => isTodoAssignedToUser(t, currentUser));
        } else if (activeFilter === 'overdue') {
            list = list.filter(t => t.due_date < todayStr);
        } else if (activeFilter === 'today') {
            list = list.filter(t => t.due_date === todayStr);
        } else if (activeFilter === 'week') {
            // Fällig in den nächsten 7 Tagen (einschliesslich heute und überfällig)
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            const nextWeekStr = nextWeek.toISOString().split('T')[0];
            list = list.filter(t => t.due_date <= nextWeekStr);
        } else if (activeFilter === 'closes') {
            list = list.filter(t => t.closes_project);
        }

        // 3.5. Filter by Assignee Filter (handles "all", "mine", "Adi", "Mensur", user IDs, etc.)
        if (assigneeFilter && assigneeFilter !== 'all') {
            list = list.filter(t => matchesAssigneeFilter(t, assigneeFilter));
        }

        // 4. Sort: Overdue (oldest first) -> Today -> Future (chronological, closest first)
        return [...list].sort((a, b) => {
            if (a.due_date !== b.due_date) {
                return a.due_date < b.due_date ? -1 : 1;
            }
            // Secondary sorting by project title
            const projA = reports.find(r => r.id === a.project_id || (r.projectNumber && String(r.projectNumber) === String(a.project_id)))?.projectTitle || '';
            const projB = reports.find(r => r.id === b.project_id || (r.projectNumber && String(r.projectNumber) === String(a.project_id)))?.projectTitle || '';
            return projA.localeCompare(projB);
        });
    }, [todos, reports, activeProjects, activeFilter, searchTerm, currentUser, assigneeFilter, users]);
    // Historical completed todos
    const processedHistoryTodos = useMemo(() => {
        let list = todos.filter(t => t.status === 'done');

        // Apply search term
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            list = list.filter(t => {
                const proj = reports.find(r => r.id === t.project_id);
                return (
                    t.task?.toLowerCase().includes(q) ||
                    (t.assigned_user_name || t.assignedTo || '')?.toLowerCase().includes(q) ||
                    t.note?.toLowerCase().includes(q) ||
                    proj?.projectTitle?.toLowerCase().includes(q) ||
                    proj?.projectNumber?.toLowerCase().includes(q) ||
                    proj?.address?.toLowerCase().includes(q) ||
                    proj?.client?.toLowerCase().includes(q)
                );
            });
        }

        // Apply assignee filter
        if (assigneeFilter && assigneeFilter !== 'all') {
            const getTodoAssigneeName = (t) => String(t.assignedTo || t.assigned_user_name || t.assignee || t.technician || '').toLowerCase().trim();
            const getTodoAssigneeId = (t) => String(t.assigned_user_id || t.assignedUserId || t.userId || '').trim();

            const isTodoAssignedToUser = (t, user) => {
                if (!t || !user) return false;
                const targetUserId = String(user.id || '').trim();
                const targetUserEmail = String(user.email || '').trim().toLowerCase();
                const targetUserName = String(user.name || '').trim().toLowerCase();
                const targetFirstName = targetUserName.split(' ')[0];
                const todoUserId = getTodoAssigneeId(t);
                const todoUserName = getTodoAssigneeName(t);
                if (targetUserId && todoUserId && (todoUserId === targetUserId || String(todoUserId) === targetUserId)) return true;
                if (targetUserEmail && todoUserName === targetUserEmail) return true;
                if (targetUserName && todoUserName) {
                    if (todoUserName === targetUserName) return true;
                    if (todoUserName.includes(targetUserName) || targetUserName.includes(todoUserName)) return true;
                    if (targetFirstName && todoUserName.includes(targetFirstName)) return true;
                }
                return false;
            };

            const matchesAssigneeFilter = (t, filterVal) => {
                if (!filterVal || filterVal === 'all' || filterVal === 'Alle') return true;
                if (filterVal === 'mine' || filterVal === 'Meine') {
                    if (!currentUser) return false;
                    return isTodoAssignedToUser(t, currentUser);
                }
                if (filterVal === 'office' || filterVal === 'unassigned' || filterVal === 'Unzugewiesen') {
                    const todoUserId = getTodoAssigneeId(t);
                    const todoUserName = getTodoAssigneeName(t);
                    return !todoUserId || todoUserId === 'office' || !todoUserName || todoUserName === 'innendienst' || todoUserName === 'unzugewiesen';
                }
                const target = String(filterVal).toLowerCase().trim();
                const todoUserId = getTodoAssigneeId(t);
                const todoUserName = getTodoAssigneeName(t);
                if (todoUserId && (todoUserId === target || String(todoUserId) === target)) return true;
                const targetUser = Array.isArray(users) ? users.find(u => String(u.id) === target || String(u.name).toLowerCase().trim() === target || String(u.name).toLowerCase().trim().startsWith(target)) : null;
                if (targetUser && isTodoAssignedToUser(t, targetUser)) return true;
                if (todoUserName) {
                    if (todoUserName.includes(target)) return true;
                    if (target.includes(todoUserName) && todoUserName.length > 0) return true;
                    const todoFirstName = todoUserName.split(' ')[0];
                    if (todoFirstName && (todoFirstName === target || target.includes(todoFirstName))) return true;
                }
                return false;
            };

            list = list.filter(t => matchesAssigneeFilter(t, assigneeFilter));
        }

        // Sort: Newest completed_at first
        return [...list].sort((a, b) => {
            const timeA = new Date(a.completed_at || 0).getTime();
            const timeB = new Date(b.completed_at || 0).getTime();
            return timeB - timeA;
        });
    }, [todos, reports, searchTerm, assigneeFilter, currentUser, users]);

    // Counters
    const counters = useMemo(() => {
        const todayStr = getLocalTodayDateString();
        const openTodos = todos.filter(t => t.status === 'open');

        const getTodoAssigneeName = (t) => String(t.assignedTo || t.assigned_user_name || t.assignee || t.technician || '').toLowerCase().trim();
        const getTodoAssigneeId = (t) => String(t.assigned_user_id || t.assignedUserId || t.userId || '').trim();

        const isTodoAssignedToUser = (t, user) => {
            if (!t || !user) return false;
            const targetUserId = String(user.id || '').trim();
            const targetUserEmail = String(user.email || '').trim().toLowerCase();
            const targetUserName = String(user.name || '').trim().toLowerCase();
            const targetFirstName = targetUserName.split(' ')[0];
            const todoUserId = getTodoAssigneeId(t);
            const todoUserName = getTodoAssigneeName(t);
            if (targetUserId && todoUserId && (todoUserId === targetUserId || String(todoUserId) === targetUserId)) return true;
            if (targetUserEmail && todoUserName === targetUserEmail) return true;
            if (targetUserName && todoUserName) {
                if (todoUserName === targetUserName) return true;
                if (todoUserName.includes(targetUserName) || targetUserName.includes(todoUserName)) return true;
                if (targetFirstName && todoUserName.includes(targetFirstName)) return true;
            }
            return false;
        };

        const matchesAssigneeFilter = (t, filterVal) => {
            if (!filterVal || filterVal === 'all' || filterVal === 'Alle') return true;
            if (filterVal === 'mine' || filterVal === 'Meine') {
                if (!currentUser) return false;
                return isTodoAssignedToUser(t, currentUser);
            }
            if (filterVal === 'office' || filterVal === 'unassigned' || filterVal === 'Unzugewiesen') {
                const todoUserId = getTodoAssigneeId(t);
                const todoUserName = getTodoAssigneeName(t);
                return !todoUserId || todoUserId === 'office' || !todoUserName || todoUserName === 'innendienst' || todoUserName === 'unzugewiesen';
            }
            const target = String(filterVal).toLowerCase().trim();
            const todoUserId = getTodoAssigneeId(t);
            const todoUserName = getTodoAssigneeName(t);
            if (todoUserId && (todoUserId === target || String(todoUserId) === target)) return true;
            const targetUser = Array.isArray(users) ? users.find(u => String(u.id) === target || String(u.name).toLowerCase().trim() === target || String(u.name).toLowerCase().trim().startsWith(target)) : null;
            if (targetUser && isTodoAssignedToUser(t, targetUser)) return true;
            if (todoUserName) {
                if (todoUserName.includes(target)) return true;
                if (target.includes(todoUserName) && todoUserName.length > 0) return true;
                const todoFirstName = todoUserName.split(' ')[0];
                if (todoFirstName && (todoFirstName === target || target.includes(todoFirstName))) return true;
            }
            return false;
        };

        const activeProjIds = new Set(activeProjects.map(p => p.id));
        const activeOpenTodos = openTodos.filter(t => !t.project_id || activeProjIds.has(t.project_id));

        return {
            allOpen: activeOpenTodos.length,
            overdue: activeOpenTodos.filter(t => t.due_date < todayStr).length,
            today: activeOpenTodos.filter(t => t.due_date === todayStr).length,
            future: activeOpenTodos.filter(t => t.due_date > todayStr).length,
            mine: currentUser ? activeOpenTodos.filter(t => isTodoAssignedToUser(t, currentUser)).length : 0,
            adi: activeOpenTodos.filter(t => matchesAssigneeFilter(t, 'Adi')).length,
            mensur: activeOpenTodos.filter(t => matchesAssigneeFilter(t, 'Mensur')).length,
            noTodos: projectsWithoutTodos.length
        };
    }, [todos, activeProjects, projectsWithoutTodos, currentUser, users]);

    // Handle Checking "To-do erledigt"
    const handleToggleDone = async (todoItem, checked) => {
        if (!checked) return; // Cannot uncheck a done todo

        setPendingActionTodoId(todoItem.id);

        if (todoItem.closes_project) {
            // Find if other open todos exist for this project
            const otherOpen = todos.filter(t => 
                t.project_id === todoItem.project_id && 
                t.status === 'open' && 
                t.id !== todoItem.id &&
                t.category !== 'auto' &&
                !String(t.id).startsWith('measurement_followup')
            );

            if (otherOpen.length > 0) {
                // Block completion
                setBlockDialog({ todo: todoItem, otherTodos: otherOpen });
                setPendingActionTodoId(null);
            } else {
                // Confirm project closure
                setConfirmArchiveDialog({ todo: todoItem });
            }
        } else {
            // Completion and creation of the follow-up are committed together
            // when the user saves the follow-up modal.
            setFollowUpTodo(todoItem);
            setPendingActionTodoId(null);
        }
    };

    // Confirm archiving
    const handleConfirmArchive = async () => {
        if (!confirmArchiveDialog) return;
        const { todo: todoItem } = confirmArchiveDialog;

        setLoading(true);
        try {
            await completeTodoAndArchiveProjectRpc(todoItem.id, currentUser?.name || 'System');

            // Local status update to prevent autosave races
            const projId = todoItem.project_id;
            if (projId && Array.isArray(reports)) {
                const rep = reports.find(r => r.id === projId);
                if (rep) {
                    rep.status = 'Abgeschlossen';
                    if (rep.report_data) {
                        rep.report_data.status = 'Abgeschlossen';
                    }
                }
            }

            setConfirmArchiveDialog(null);
            setPendingActionTodoId(null);
            loadTodos();
            onReportsChanged?.(); // reload projects since one has been archived
        } catch (err) {
            alert('Fehler beim Projektabschluss: ' + err.message);
            setPendingActionTodoId(null);
        } finally {
            setLoading(false);
        }
    };

    const formatDateGerman = (dateStr) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: '1rem',
            background: 'var(--surface)', padding: '1.5rem', borderRadius: '8px',
            border: '1px solid var(--border)', color: 'var(--text-main)',
            textAlign: 'left'
        }}>
            {/* Custom Semantic Variables */}
            <style>{`
                :root {
                    --todo-overdue-text: #B91C1C;
                    --todo-overdue-bg: rgba(239, 68, 68, 0.1);
                    --todo-overdue-border: rgba(239, 68, 68, 0.2);
                    
                    --todo-today-text: #D97706;
                    --todo-today-bg: rgba(245, 158, 11, 0.1);
                    --todo-today-border: rgba(245, 158, 11, 0.2);
                }
                [data-theme="dark"] {
                    --todo-overdue-text: #F87171;
                    --todo-today-text: #FBBF24;
                }
                .sticky-th {
                    position: sticky !important;
                    top: 0 !important;
                    background-color: var(--surface) !important;
                    z-index: 5 !important;
                    box-shadow: inset 0 -1px 0 var(--border) !important;
                }
            `}</style>

            {/* Header / Filter / Search Container - Compact Row Layout */}
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                gap: '0.75rem', 
                flexWrap: 'nowrap', 
                width: '100%',
                marginBottom: '0.5rem'
            }}>
                {/* Title */}
                <h2 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <ClipboardList size={18} style={{ color: 'var(--q-primary, #1e6db7)' }} />
                    To-do-Übersicht
                </h2>

                {/* Counter Tabs Widgets */}
                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                    <button
                        onClick={() => { setActiveFilter('all'); setAssigneeFilter('all'); setShowHistory(false); }}
                        style={{
                            padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)',
                            background: activeFilter === 'all' && (assigneeFilter === 'all' || !assigneeFilter) && !showHistory ? 'var(--q-primary, #1e6db7)' : 'var(--surface-hover, rgba(0,0,0,0.02))',
                            color: activeFilter === 'all' && (assigneeFilter === 'all' || !assigneeFilter) && !showHistory ? '#fff' : 'var(--text-main)',
                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                        }}
                    >
                        Alle ({counters.allOpen})
                    </button>
                    <button
                        onClick={() => { setActiveFilter('mine'); setAssigneeFilter('mine'); setShowHistory(false); }}
                        style={{
                            padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)',
                            background: (activeFilter === 'mine' || assigneeFilter === 'mine') && !showHistory ? 'var(--q-primary, #1e6db7)' : 'var(--surface-hover, rgba(0,0,0,0.02))',
                            color: (activeFilter === 'mine' || assigneeFilter === 'mine') && !showHistory ? '#fff' : 'var(--text-main)',
                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        Meine ({counters.mine})
                    </button>
                    <button
                        onClick={() => { setActiveFilter('all'); setAssigneeFilter('Adi'); setShowHistory(false); }}
                        style={{
                            padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)',
                            background: (assigneeFilter.toLowerCase() === 'adi' || assigneeFilter === '2') && !showHistory ? 'var(--q-primary, #1e6db7)' : 'var(--surface-hover, rgba(0,0,0,0.02))',
                            color: (assigneeFilter.toLowerCase() === 'adi' || assigneeFilter === '2') && !showHistory ? '#fff' : 'var(--text-main)',
                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        Adi ({counters.adi})
                    </button>
                    <button
                        onClick={() => { setActiveFilter('all'); setAssigneeFilter('Mensur'); setShowHistory(false); }}
                        style={{
                            padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)',
                            background: (assigneeFilter.toLowerCase() === 'mensur' || assigneeFilter === '3') && !showHistory ? 'var(--q-primary, #1e6db7)' : 'var(--surface-hover, rgba(0,0,0,0.02))',
                            color: (assigneeFilter.toLowerCase() === 'mensur' || assigneeFilter === '3') && !showHistory ? '#fff' : 'var(--text-main)',
                            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                        }}
                    >
                        Mensur ({counters.mensur})
                    </button>
                    <button
                        onClick={() => { setActiveFilter('overdue'); setShowHistory(false); }}
                        style={{
                            padding: '0.3rem 0.6rem', borderRadius: '6px',
                            border: '1px solid var(--todo-overdue-border)',
                            background: activeFilter === 'overdue' && !showHistory ? 'var(--todo-overdue-text)' : 'var(--todo-overdue-bg)',
                            color: activeFilter === 'overdue' && !showHistory ? '#fff' : 'var(--todo-overdue-text)',
                            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                        }}
                    >
                        Überfällig ({counters.overdue})
                    </button>
                    <button
                        onClick={() => { setActiveFilter('today'); setShowHistory(false); }}
                        style={{
                            padding: '0.3rem 0.6rem', borderRadius: '6px',
                            border: '1px solid var(--todo-today-border)',
                            background: activeFilter === 'today' && !showHistory ? 'var(--todo-today-text)' : 'var(--todo-today-bg)',
                            color: activeFilter === 'today' && !showHistory ? '#fff' : 'var(--todo-today-text)',
                            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer'
                        }}
                    >
                        Heute ({counters.today})
                    </button>

                    {/* Control Warning Tab for active projects without To-dos */}
                    {counters.noTodos > 0 && (
                        <button
                            onClick={() => { setActiveFilter('no_todos'); setShowHistory(false); }}
                            style={{
                                padding: '0.3rem 0.6rem', borderRadius: '6px',
                                border: '1px solid #dc2626',
                                background: activeFilter === 'no_todos' && !showHistory ? '#dc2626' : 'rgba(220,38,38,0.08)',
                                color: activeFilter === 'no_todos' && !showHistory ? '#fff' : '#dc2626',
                                fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '0.25rem'
                            }}
                            title="Aktive Projekte ohne zugeordnete offene To-dos!"
                        >
                            <AlertCircle size={12} />
                            <span>Fehler ({counters.noTodos})</span>
                        </button>
                    )}
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        style={{
                            padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)',
                            background: showHistory ? 'var(--q-primary, #1e6db7)' : 'rgba(30,109,183,0.08)',
                            color: showHistory ? '#fff' : 'var(--q-primary, #1e6db7)',
                            fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.25rem'
                        }}
                    >
                        <Clock size={12} />
                        <span>{showHistory ? 'Aktive anzeigen' : 'Erledigte anzeigen'}</span>
                    </button>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative', flex: 1, minWidth: '150px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Aufgabe, Mitarbeiter, Projekt..."
                        className="form-input"
                        style={{ width: '100%', paddingLeft: '28px', height: '30px', fontSize: '0.8rem' }}
                    />
                </div>

                {/* Assignee Filter Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', shrink: 0 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Wer:</span>
                    <select
                        value={assigneeFilter}
                        onChange={(e) => {
                            const val = e.target.value;
                            setAssigneeFilter(val);
                            // Reset activeFilter when picking a specific person from dropdown
                            // so the 'mine' pre-filter doesn't block the result
                            if (val !== 'all' && val !== 'mine') {
                                setActiveFilter('all');
                            } else if (val === 'mine') {
                                setActiveFilter('mine');
                            }
                        }}
                        className="select select-sm"
                        style={{
                            padding: '0.1rem 0.5rem',
                            fontSize: '0.8rem',
                            height: '30px',
                            backgroundColor: 'var(--surface-hover, rgba(255,255,255,0.015))',
                            border: '1px solid var(--border)',
                            borderRadius: '6px',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                            minWidth: '120px'
                        }}
                    >
                        <option value="all">Alle Mitarbeiter</option>
                        <option value="mine">Meine Aufgaben</option>
                        <option value="Adi">Adi</option>
                        <option value="Mensur">Mensur</option>
                        <option value="office">Innendienst</option>
                        {users.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                    </select>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            style={{
                                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
                            }}
                        >
                            ×
                        </button>
                    )}
                </div>

                {/* "To-do neu" Button */}
                <button
                    onClick={() => { setEditingTodo(null); setModalOpen(true); }}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', height: '30px', fontSize: '0.8rem', padding: '0 0.75rem', flexShrink: 0 }}
                >
                    <Plus size={14} />
                    <span>To-do neu</span>
                </button>
            </div>

            {/* ERROR Display */}
            {error && (
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '6px', fontSize: '0.88rem' }}>
                    {error}
                </div>
            )}

            {/* List Table Area */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 280px)', marginTop: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px' }}>
                {loading && todos.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aufgaben werden geladen...</div>
                ) : showHistory ? (
                    /* History View */
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-hover, rgba(0,0,0,0.015))', color: 'var(--text-muted)' }}>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', width: '140px', fontWeight: 600 }}>Erledigt am</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', width: '110px', fontWeight: 600 }}>Projektnummer</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', width: '25%', fontWeight: 600 }}>Projekt / Adresse</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', width: '100px', fontWeight: 600 }}>Wer</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Was</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', width: '120px', fontWeight: 600 }}>Erledigt durch</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'center', width: '100px', fontWeight: 600 }}>Fälligkeit</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'center', width: '80px', fontWeight: 600 }}>Abschluss</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'center', width: '90px', fontWeight: 600 }}>Verlauf</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedHistoryTodos.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Kein Aufgabenverlauf vorhanden.</td>
                                </tr>
                            ) : (
                                processedHistoryTodos.map(todoItem => {
                                    const proj = reports.find(r => 
                                        r.id === todoItem.project_id || 
                                        (r.projectNumber && String(r.projectNumber) === String(todoItem.project_id)) ||
                                        (r.projectTitle && String(r.projectTitle) === String(todoItem.project_id))
                                    );
                                    return (
                                        <tr key={todoItem.id} style={{ borderBottom: '1px solid var(--border)', opacity: 0.8, backgroundColor: 'var(--surface)' }}>
                                            <td style={{ padding: '0.65rem 0.8rem', color: 'var(--text-muted)' }}>
                                                {new Date(todoItem.completed_at).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.8rem', fontWeight: 500 }}>
                                                {proj?.projectNumber || '-'}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.8rem' }}>
                                                {(() => {
                                                    const displayTitle = proj ? getCleanProjectTitle(proj) : 'Ohne Projektzuordnung';
                                                    return (
                                                        <>
                                                            {proj ? (
                                                                <button
                                                                    onClick={() => onSelectReport(proj)}
                                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--q-primary, #1e6db7)', textDecoration: 'underline', fontWeight: 600, fontSize: 'inherit', textAlign: 'left' }}
                                                                >
                                                                    {displayTitle}
                                                                </button>
                                                            ) : (
                                                                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{displayTitle}</span>
                                                            )}
                                                            {proj?.address && displayTitle !== proj.address && (
                                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{proj.address}</div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.8rem' }}>{todoItem.assigned_user_name}</td>
                                            <td style={{ padding: '0.65rem 0.8rem' }}>
                                                <div style={{ fontWeight: 500 }}>{todoItem.task}</div>
                                                {todoItem.note && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{todoItem.note}</div>}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.8rem' }}>{todoItem.completed_by}</td>
                                            <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center' }}>
                                                {formatDateGerman(todoItem.due_date)}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center', color: todoItem.closes_project ? '#10B981' : 'var(--text-muted)' }}>
                                                {todoItem.closes_project ? 'Ja' : 'Nein'}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setHistoryViewTodo(todoItem)}
                                                    className="btn btn-ghost"
                                                    style={{ padding: '0.35rem', color: 'var(--q-primary, #1e6db7)' }}
                                                    title="Aufgabenverlauf anzeigen"
                                                >
                                                    <History size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                ) : activeFilter === 'no_todos' ? (
                    /* Warning List: Active projects without To-dos */
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-hover, rgba(0,0,0,0.015))', color: 'var(--text-muted)' }}>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Projekt / ID</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Adresse</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Kunde</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Status</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'center', fontWeight: 600 }}>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {projectsWithoutTodos.map(proj => (
                                <tr key={proj.id} style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
                                    <td style={{ padding: '0.65rem 0.8rem' }}>
                                        <button
                                            onClick={() => onSelectReport(proj)}
                                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--q-primary, #1e6db7)', textDecoration: 'underline', fontWeight: 600, fontSize: 'inherit', textAlign: 'left' }}
                                        >
                                            {(proj.projectTitle && proj.projectTitle !== proj.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(proj.projectTitle)) ? proj.projectTitle : (proj.address || proj.client || proj.id)}
                                        </button>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{proj.projectNumber}</div>
                                    </td>
                                    <td style={{ padding: '0.65rem 0.8rem' }}>{proj.address}</td>
                                    <td style={{ padding: '0.65rem 0.8rem' }}>{proj.client}</td>
                                    <td style={{ padding: '0.65rem 0.8rem' }}>{proj.status}</td>
                                    <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center' }}>
                                        <button
                                            onClick={() => {
                                                setSelectedWarningProject(proj);
                                                setEditingTodo(null);
                                                setModalOpen(true);
                                            }}
                                            className="btn btn-ghost"
                                            style={{ fontSize: '0.8rem', color: 'var(--q-primary, #1e6db7)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                        >
                                            <Plus size={14} />
                                            <span>To-do hinzufügen</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    /* Open To-dos View */
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-hover, rgba(0,0,0,0.015))', color: 'var(--text-muted)' }}>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', width: '90px', fontWeight: 600 }}>Fällig</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', width: '110px', fontWeight: 600 }}>Projektnummer</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', width: '25%', fontWeight: 600 }}>Projekt / Adresse</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', width: '100px', fontWeight: 600 }}>Wer</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Was</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Notiz</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'center', width: '80px', fontWeight: 600 }}>Erledigt</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'center', width: '80px', fontWeight: 600 }}>Abschluss</th>
                                <th className="sticky-th" style={{ padding: '0.65rem 0.8rem', textAlign: 'center', width: '115px', fontWeight: 600 }}>Bearbeiten</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedOpenTodos.length === 0 ? (
                                <tr>
                                    <td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Keine offenen Aufgaben vorhanden.</td>
                                </tr>
                            ) : (
                                processedOpenTodos.map(todoItem => {
                                    const proj = reports.find(r => 
                                        r.id === todoItem.project_id || 
                                        (r.projectNumber && String(r.projectNumber) === String(todoItem.project_id)) ||
                                        (r.projectTitle && String(r.projectTitle) === String(todoItem.project_id))
                                    );
                                    const dueStatus = getDueDateStatus(todoItem.due_date);

                                    // Inline styling based on due status
                                    let dueStyle = {};
                                    let dueLabel = formatDateGerman(todoItem.due_date);

                                    if (dueStatus === 'overdue') {
                                        dueStyle = {
                                            color: 'var(--todo-overdue-text)',
                                            backgroundColor: 'var(--todo-overdue-bg)',
                                            border: '1px solid var(--todo-overdue-border)',
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: '4px',
                                            fontWeight: 700
                                        };
                                    } else if (dueStatus === 'today') {
                                        dueStyle = {
                                            color: 'var(--todo-today-text)',
                                            backgroundColor: 'var(--todo-today-bg)',
                                            border: '1px solid var(--todo-today-border)',
                                            padding: '0.15rem 0.4rem',
                                            borderRadius: '4px',
                                            fontWeight: 700
                                        };
                                        dueLabel = 'Heute';
                                    }

                                    return (
                                        <tr key={todoItem.id} style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
                                            {/* 1. Fällig */}
                                            <td style={{ padding: '0.65rem 0.8rem' }}>
                                                <span style={dueStyle}>{dueLabel}</span>
                                            </td>
                                            {/* 1b. Projektnummer */}
                                            <td style={{ padding: '0.65rem 0.8rem', fontWeight: 500 }}>
                                                {proj?.projectNumber || '-'}
                                            </td>
                                            {/* 2. Projekt / Adresse */}
                                            <td style={{ padding: '0.65rem 0.8rem' }}>
                                                {(() => {
                                                    const displayTitle = proj ? getCleanProjectTitle(proj) : 'Ohne Projektzuordnung';
                                                    return (
                                                        <>
                                                            {proj ? (
                                                                <button
                                                                    onClick={() => onSelectReport(proj)}
                                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--q-primary, #1e6db7)', textDecoration: 'underline', fontWeight: 600, fontSize: 'inherit', textAlign: 'left' }}
                                                                >
                                                                    {displayTitle}
                                                                </button>
                                                            ) : (
                                                                <span style={{ fontWeight: 500, color: 'var(--text-muted)' }}>{displayTitle}</span>
                                                            )}
                                                            {proj?.address && displayTitle !== proj.address && (
                                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{proj.address}</div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </td>
                                            {/* 3. Wer */}
                                            <td style={{ padding: '0.65rem 0.8rem' }}>{todoItem.assigned_user_name}</td>
                                            {/* 4. Was */}
                                            <td style={{ padding: '0.65rem 0.8rem' }}>
                                                <div style={{ fontWeight: 500 }}>{todoItem.task}</div>
                                            </td>
                                            {/* 5. Notiz */}
                                            <td style={{ padding: '0.65rem 0.8rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                                {todoItem.note || ''}
                                            </td>
                                            {/* 6. Checkbox erledigt */}
                                            <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '22px' }}>
                                                    {(() => {
                                                        const isAuto = todoItem.category === 'auto' || String(todoItem.id).startsWith('measurement_followup') || String(todoItem.id).startsWith('a0d0a0d0-');
                                                        return (
                                                            <input
                                                                type="checkbox"
                                                                checked={pendingActionTodoId === todoItem.id}
                                                                disabled={pendingActionTodoId !== null && pendingActionTodoId !== todoItem.id}
                                                                onChange={(e) => handleToggleDone(todoItem, e.target.checked)}
                                                                style={{ width: '16px', height: '16px', cursor: 'pointer', margin: 0, padding: 0 }}
                                                                title={isAuto ? "Automatische Aufgabe erledigen & Nachfolger erstellen" : "To-do erledigen"}
                                                            />
                                                        );
                                                    })()}
                                                </div>
                                            </td>
                                            {/* 7. Abschluss */}
                                            <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center', verticalAlign: 'middle' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '22px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={todoItem.closes_project}
                                                        readOnly
                                                        style={{ width: '16px', height: '16px', margin: 0, padding: 0, cursor: 'default', pointerEvents: 'none' }}
                                                    />
                                                </div>
                                            </td>
                                            {/* 7. Aktionen */}
                                            <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.25rem', alignItems: 'center' }}>
                                                    <button
                                                        onClick={() => setHistoryViewTodo(todoItem)}
                                                        className="btn btn-ghost"
                                                        style={{ padding: '0.35rem', color: 'var(--q-primary, #1e6db7)' }}
                                                        title="Aufgabenverlauf anzeigen"
                                                    >
                                                        <History size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingTodo(todoItem); setModalOpen(true); }}
                                                        className="btn btn-ghost"
                                                        disabled={pendingActionTodoId !== null}
                                                        style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
                                                        title="Aufgabe bearbeiten"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={async () => {
                                                            if (window.confirm('Möchten Sie dieses To-do wirklich löschen?')) {
                                                                setTodos(prev => prev.filter(t => t.id !== todoItem.id));
                                                                await deleteTodo(todoItem.id);
                                                                onReportsChanged?.();
                                                            }
                                                        }}
                                                        className="btn btn-ghost"
                                                        disabled={pendingActionTodoId !== null}
                                                        style={{ padding: '0.35rem', color: '#ef4444' }}
                                                        title="Aufgabe löschen"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* TodoModal Portal */}
            {modalOpen && (
                <TodoModal
                    todo={editingTodo}
                    initialProject={selectedWarningProject}
                    onClose={() => { setModalOpen(false); setEditingTodo(null); setSelectedWarningProject(null); }}
                    onSaveSuccess={() => { loadTodos(); onReportsChanged?.(); }}
                    users={users}
                    reports={reports}
                    currentUser={currentUser}
                />
            )}

            {/* FollowUp Todo Modal Portal */}
            {followUpTodo && (
                <TodoModal
                    todo={followUpTodo}
                    isFollowUpMode={true}
                    onClose={() => {
                        console.log('[TodoMonitor] followUpTodo onClose called. Setting followUpTodo to null.');
                        setFollowUpTodo(null);
                        setPendingActionTodoId(null);
                    }}
                    onSaveSuccess={() => {
                        console.log('[TodoMonitor] followUpTodo onSaveSuccess called.');
                        loadTodos();
                        onReportsChanged?.();
                    }}
                    users={users}
                    reports={reports}
                    currentUser={currentUser}
                />
            )}

            {/* TodoHistoryModal Portal */}
            {historyViewTodo && (
                <TodoHistoryModal
                    todo={historyViewTodo}
                    onClose={() => setHistoryViewTodo(null)}
                    projectTitle={(() => {
                        const proj = reports.find(r => 
                            r.id === historyViewTodo.project_id || 
                            (r.projectNumber && String(r.projectNumber) === String(historyViewTodo.project_id)) ||
                            (r.projectTitle && String(r.projectTitle) === String(historyViewTodo.project_id))
                        );
                        return proj ? (proj.projectTitle || proj.address || proj.projectNumber) : 'Unbekanntes Projekt';
                    })()}
                />
            )}

            {/* BLOCK ARCHIVE DIALOG */}
            {blockDialog && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: 'var(--surface)', padding: '2rem', borderRadius: '12px',
                        width: '500px', maxWidth: '100%', border: '1px solid var(--border)',
                        color: 'var(--text-main)', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                        alignSelf: 'center'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'center', color: '#ef4444', marginBottom: '1rem' }}>
                            <ShieldAlert size={48} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Projekt kann noch nicht abgeschlossen werden.</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Für dieses Projekt bestehen noch {blockDialog.otherTodos.length} weitere offene To-dos. Bitte erledigen oder bearbeiten Sie diese zuerst.
                        </p>

                        {/* List other open todos */}
                        <div style={{
                            textAlign: 'left', padding: '0.75rem', backgroundColor: 'var(--surface-hover, rgba(0,0,0,0.02))',
                            borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.82rem',
                            display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem',
                            maxHeight: '150px', overflowY: 'auto'
                        }}>
                            {blockDialog.otherTodos.map(ot => (
                                <div key={ot.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.35rem' }}>
                                    <strong>{ot.assigned_user_name}:</strong> {ot.task}
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Fällig: {formatDateGerman(ot.due_date)}</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => { setBlockDialog(null); setPendingActionTodoId(null); }}
                                className="btn btn-primary"
                                style={{ minWidth: '120px' }}
                            >
                                Zurück
                            </button>
                            <button
                                onClick={() => {
                                    setSearchTerm(reports.find(r => r.id === blockDialog.todo.project_id)?.projectTitle || '');
                                    setActiveFilter('all');
                                    setBlockDialog(null);
                                    setPendingActionTodoId(null);
                                }}
                                className="btn btn-ghost"
                            >
                                Offene To-dos anzeigen
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRM ARCHIVE DIALOG */}
            {confirmArchiveDialog && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 999999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        backgroundColor: 'var(--surface)', padding: '2rem', borderRadius: '12px',
                        width: '450px', maxWidth: '100%', border: '1px solid var(--border)',
                        color: 'var(--text-main)', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--q-primary, #1e6db7)', marginBottom: '1rem' }}>
                            <HelpCircle size={48} />
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Projekt wirklich abschliessen?</h3>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                            Das aktuelle To-do wird erledigt, das Projekt abgeschlossen und in das Archiv verschoben. Es wird kein Folge-To-do erstellt.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                onClick={() => { setConfirmArchiveDialog(null); setPendingActionTodoId(null); }}
                                className="btn btn-ghost"
                                style={{ minWidth: '100px' }}
                                disabled={loading}
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleConfirmArchive}
                                className="btn btn-primary"
                                style={{ minWidth: '180px', backgroundColor: '#10B981', borderColor: '#10B981' }}
                                disabled={loading}
                            >
                                {loading ? 'Schliesst ab...' : 'Ja, Projekt abschliessen'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TodoMonitor;

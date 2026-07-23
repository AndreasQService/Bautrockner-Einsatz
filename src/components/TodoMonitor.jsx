import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Plus, Search, Calendar, User, Check, Edit2, AlertTriangle, HelpCircle, Archive, AlertCircle, Clock } from 'lucide-react';
import { fetchAllTodos, completeTodoAndArchiveProjectRpc } from '../services/TodoService';
import TodoModal from './TodoModal';

const TodoMonitor = ({
    reports = [],
    users = [],
    currentUser = null,
    onSelectReport,
    onReportsChanged,
    isDarkMode = false
}) => {
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Filter and search states
    const [activeFilter, setActiveFilter] = useState('all'); // all, mine, overdue, today, week, closes, no_todos
    const [showHistory, setShowHistory] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTodo, setEditingTodo] = useState(null);
    const [followUpTodo, setFollowUpTodo] = useState(null);

    // Block & Confirmation Dialog states
    const [blockDialog, setBlockDialog] = useState(null); // { todo, otherTodos }
    const [confirmArchiveDialog, setConfirmArchiveDialog] = useState(null); // { todo }
    const [pendingActionTodoId, setPendingActionTodoId] = useState(null);

    const loadTodos = async () => {
        setLoading(true);
        setError('');
        try {
            const list = await fetchAllTodos();
            setTodos(list);
        } catch (err) {
            setError('Fehler beim Laden der Aufgaben: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Load on mount and when reports change
    useEffect(() => {
        loadTodos();
    }, [reports]);

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

        // Only include todos for active (non-archived) projects
        const activeProjIds = new Set(activeProjects.map(p => p.id));
        list = list.filter(t => activeProjIds.has(t.project_id));

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

        // 3. Filter by Active Tab Filter
        if (activeFilter === 'mine' && currentUser) {
            list = list.filter(t => String(t.assigned_user_id) === String(currentUser.id));
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

        // 4. Sort: Overdue (oldest first) -> Today -> Future (chronological, closest first)
        return [...list].sort((a, b) => {
            if (a.due_date !== b.due_date) {
                return a.due_date < b.due_date ? -1 : 1;
            }
            // Secondary sorting by project title
            const projA = reports.find(r => r.id === a.project_id)?.projectTitle || '';
            const projB = reports.find(r => r.id === b.project_id)?.projectTitle || '';
            return projA.localeCompare(projB);
        });
    }, [todos, reports, activeProjects, activeFilter, searchTerm, currentUser]);

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
                    t.assigned_user_name?.toLowerCase().includes(q) ||
                    t.note?.toLowerCase().includes(q) ||
                    proj?.projectTitle?.toLowerCase().includes(q) ||
                    proj?.projectNumber?.toLowerCase().includes(q) ||
                    proj?.address?.toLowerCase().includes(q) ||
                    proj?.client?.toLowerCase().includes(q)
                );
            });
        }

        // Sort: Newest completed_at first
        return [...list].sort((a, b) => {
            const timeA = new Date(a.completed_at || 0).getTime();
            const timeB = new Date(b.completed_at || 0).getTime();
            return timeB - timeA;
        });
    }, [todos, reports, searchTerm]);

    // Counters
    const counters = useMemo(() => {
        const todayStr = getLocalTodayDateString();
        const openTodos = todos.filter(t => t.status === 'open');
        const activeProjIds = new Set(activeProjects.map(p => p.id));
        const activeOpenTodos = openTodos.filter(t => activeProjIds.has(t.project_id));

        return {
            allOpen: activeOpenTodos.length,
            overdue: activeOpenTodos.filter(t => t.due_date < todayStr).length,
            today: activeOpenTodos.filter(t => t.due_date === todayStr).length,
            future: activeOpenTodos.filter(t => t.due_date > todayStr).length,
            mine: currentUser ? activeOpenTodos.filter(t => String(t.assigned_user_id) === String(currentUser.id)).length : 0,
            noTodos: projectsWithoutTodos.length
        };
    }, [todos, activeProjects, projectsWithoutTodos, currentUser]);

    // Handle Checking "To-do erledigt"
    const handleToggleDone = async (todoItem, checked) => {
        if (!checked) return; // Cannot uncheck a done todo

        setPendingActionTodoId(todoItem.id);

        if (todoItem.closes_project) {
            // Find if other open todos exist for this project
            const otherOpen = todos.filter(t => t.project_id === todoItem.project_id && t.status === 'open' && t.id !== todoItem.id);

            if (otherOpen.length > 0) {
                // Block completion
                setBlockDialog({ todo: todoItem, otherTodos: otherOpen });
                setPendingActionTodoId(null);
            } else {
                // Confirm project closure
                setConfirmArchiveDialog({ todo: todoItem });
            }
        } else {
            // Regular To-do completion: opens Follow-up modal
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
            `}</style>

            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                    <ClipboardList size={24} style={{ color: 'var(--q-primary, #1e6db7)' }} />
                    To-do-Übersicht
                </h2>
                <button
                    onClick={() => { setEditingTodo(null); setModalOpen(true); }}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '36px', fontSize: '0.88rem' }}
                >
                    <Plus size={16} />
                    <span>To-do neu</span>
                </button>
            </div>

            {/* Counter Tabs Widgets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                    onClick={() => { setActiveFilter('all'); setShowHistory(false); }}
                    style={{
                        padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)',
                        background: activeFilter === 'all' && !showHistory ? 'var(--q-primary, #1e6db7)' : 'var(--surface-hover, rgba(0,0,0,0.02))',
                        color: activeFilter === 'all' && !showHistory ? '#fff' : 'var(--text-main)',
                        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s'
                    }}
                >
                    Alle offen ({counters.allOpen})
                </button>
                <button
                    onClick={() => { setActiveFilter('mine'); setShowHistory(false); }}
                    style={{
                        padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)',
                        background: activeFilter === 'mine' && !showHistory ? 'var(--q-primary, #1e6db7)' : 'var(--surface-hover, rgba(0,0,0,0.02))',
                        color: activeFilter === 'mine' && !showHistory ? '#fff' : 'var(--text-main)',
                        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer'
                    }}
                >
                    Meine ({counters.mine})
                </button>
                <button
                    onClick={() => { setActiveFilter('overdue'); setShowHistory(false); }}
                    style={{
                        padding: '0.4rem 0.8rem', borderRadius: '6px',
                        border: '1px solid var(--todo-overdue-border)',
                        background: activeFilter === 'overdue' && !showHistory ? 'var(--todo-overdue-text)' : 'var(--todo-overdue-bg)',
                        color: activeFilter === 'overdue' && !showHistory ? '#fff' : 'var(--todo-overdue-text)',
                        fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
                    }}
                >
                    Überfällig ({counters.overdue})
                </button>
                <button
                    onClick={() => { setActiveFilter('today'); setShowHistory(false); }}
                    style={{
                        padding: '0.4rem 0.8rem', borderRadius: '6px',
                        border: '1px solid var(--todo-today-border)',
                        background: activeFilter === 'today' && !showHistory ? 'var(--todo-today-text)' : 'var(--todo-today-bg)',
                        color: activeFilter === 'today' && !showHistory ? '#fff' : 'var(--todo-today-text)',
                        fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer'
                    }}
                >
                    Heute ({counters.today})
                </button>

                {/* Control Warning Tab for active projects without To-dos */}
                {counters.noTodos > 0 && (
                    <button
                        onClick={() => { setActiveFilter('no_todos'); setShowHistory(false); }}
                        style={{
                            padding: '0.4rem 0.8rem', borderRadius: '6px',
                            border: '1px solid #dc2626',
                            background: activeFilter === 'no_todos' && !showHistory ? '#dc2626' : 'rgba(220,38,38,0.08)',
                            color: activeFilter === 'no_todos' && !showHistory ? '#fff' : '#dc2626',
                            fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.35rem'
                        }}
                        title="Aktive Projekte ohne zugeordnete offene To-dos!"
                    >
                        <AlertCircle size={14} />
                        <span>Fehler: Projekte ohne To-do ({counters.noTodos})</span>
                    </button>
                )}

                {/* History Umschalter */}
                <button
                    onClick={() => { setShowHistory(!showHistory); }}
                    style={{
                        padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)',
                        background: showHistory ? 'var(--q-primary, #1e6db7)' : 'var(--surface-hover, rgba(0,0,0,0.02))',
                        color: showHistory ? '#fff' : 'var(--text-main)',
                        fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                        marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem'
                    }}
                >
                    <Clock size={14} />
                    <span>{showHistory ? 'History ausblenden' : 'History anzeigen'}</span>
                </button>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                {/* Secondary Filters (Only shown when not in History mode) */}
                {!showHistory && (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                            onClick={() => setActiveFilter('week')}
                            style={{
                                padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border)',
                                background: activeFilter === 'week' ? 'var(--surface-active, rgba(0,0,0,0.08))' : 'transparent',
                                color: 'var(--text-main)', fontSize: '0.78rem', cursor: 'pointer'
                            }}
                        >
                            Diese Woche
                        </button>
                        <button
                            onClick={() => setActiveFilter('closes')}
                            style={{
                                padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border)',
                                background: activeFilter === 'closes' ? 'var(--surface-active, rgba(0,0,0,0.08))' : 'transparent',
                                color: 'var(--text-main)', fontSize: '0.78rem', cursor: 'pointer'
                            }}
                        >
                            Abschluss vorgesehen
                        </button>
                    </div>
                )}

                {/* Search Bar */}
                <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Aufgabe, Mitarbeiter, Projekt oder Adresse suchen..."
                        className="form-input"
                        style={{ width: '100%', paddingLeft: '32px', height: '32px', fontSize: '0.85rem' }}
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            style={{
                                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
                            }}
                        >
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* ERROR Display */}
            {error && (
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '6px', fontSize: '0.88rem' }}>
                    {error}
                </div>
            )}

            {/* List Table Area */}
            <div style={{ overflowX: 'auto', marginTop: '0.5rem', border: '1px solid var(--border)', borderRadius: '6px' }}>
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aufgaben werden geladen...</div>
                ) : showHistory ? (
                    /* History View */
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-hover, rgba(0,0,0,0.015))', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Erledigt am</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Projekt / Adresse</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Wer</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Was</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Erledigt durch</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'center', fontWeight: 600 }}>Fälligkeit</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'center', fontWeight: 600 }}>Abschluss</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedHistoryTodos.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Kein Aufgabenverlauf vorhanden.</td>
                                </tr>
                            ) : (
                                processedHistoryTodos.map(todoItem => {
                                    const proj = reports.find(r => r.id === todoItem.project_id);
                                    return (
                                        <tr key={todoItem.id} style={{ borderBottom: '1px solid var(--border)', opacity: 0.8, backgroundColor: 'var(--surface)' }}>
                                            <td style={{ padding: '0.65rem 0.8rem', color: 'var(--text-muted)' }}>
                                                {new Date(todoItem.completed_at).toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '0.65rem 0.8rem' }}>
                                                <button
                                                    onClick={() => proj && onSelectReport(proj)}
                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--q-primary, #1e6db7)', textDecoration: 'underline', fontWeight: 500, fontSize: 'inherit', textAlign: 'left' }}
                                                >
                                                    {proj?.projectTitle || proj?.id || 'Unbekanntes Projekt'}
                                                </button>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{proj?.address}</div>
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
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Projekt / ID</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Adresse</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Kunde</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Status</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'center', fontWeight: 600 }}>Aktionen</th>
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
                                            {proj.projectTitle || proj.id}
                                        </button>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{proj.projectNumber}</div>
                                    </td>
                                    <td style={{ padding: '0.65rem 0.8rem' }}>{proj.address}</td>
                                    <td style={{ padding: '0.65rem 0.8rem' }}>{proj.client}</td>
                                    <td style={{ padding: '0.65rem 0.8rem' }}>{proj.status}</td>
                                    <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center' }}>
                                        <button
                                            onClick={() => {
                                                setSelectedProject(proj);
                                                setProjectSearch(proj.projectTitle || proj.address || proj.id);
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
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'center', width: '80px', fontWeight: 600 }}>Erledigt</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', width: '100px', fontWeight: 600 }}>Fällig</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Projekt / Adresse</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', width: '120px', fontWeight: 600 }}>Wer</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'left', fontWeight: 600 }}>Was</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'center', width: '90px', fontWeight: 600 }}>Abschluss</th>
                                <th style={{ padding: '0.65rem 0.8rem', textAlign: 'center', width: '100px', fontWeight: 600 }}>Aktionen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {processedOpenTodos.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Keine offenen Aufgaben vorhanden.</td>
                                </tr>
                            ) : (
                                processedOpenTodos.map(todoItem => {
                                    const proj = reports.find(r => r.id === todoItem.project_id);
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
                                            {/* 1. Checkbox erledigt */}
                                            <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={pendingActionTodoId === todoItem.id}
                                                    disabled={pendingActionTodoId !== null && pendingActionTodoId !== todoItem.id}
                                                    onChange={(e) => handleToggleDone(todoItem, e.target.checked)}
                                                    style={{ width: '22px', height: '22px', cursor: 'pointer', verticalAlign: 'middle' }}
                                                />
                                            </td>
                                            {/* 2. Fällig */}
                                            <td style={{ padding: '0.65rem 0.8rem' }}>
                                                <span style={dueStyle}>{dueLabel}</span>
                                            </td>
                                            {/* 3. Projekt / Adresse */}
                                            <td style={{ padding: '0.65rem 0.8rem' }}>
                                                <button
                                                    onClick={() => proj && onSelectReport(proj)}
                                                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--q-primary, #1e6db7)', textDecoration: 'underline', fontWeight: 600, fontSize: 'inherit', textAlign: 'left' }}
                                                >
                                                    {proj?.projectTitle || proj?.id || 'Unbekanntes Projekt'}
                                                </button>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{proj?.address}</div>
                                            </td>
                                            {/* 4. Wer */}
                                            <td style={{ padding: '0.65rem 0.8rem' }}>{todoItem.assigned_user_name}</td>
                                            {/* 5. Was */}
                                            <td style={{ padding: '0.65rem 0.8rem' }}>
                                                <div style={{ fontWeight: 500 }}>{todoItem.task}</div>
                                                {todoItem.note && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{todoItem.note}</div>}
                                            </td>
                                            {/* 6. Abschluss */}
                                            <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={todoItem.closes_project}
                                                    disabled
                                                    style={{ width: '16px', height: '16px' }}
                                                />
                                            </td>
                                            {/* 7. Aktionen */}
                                            <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => { setEditingTodo(todoItem); setModalOpen(true); }}
                                                    className="btn btn-ghost"
                                                    disabled={pendingActionTodoId !== null}
                                                    style={{ padding: '0.35rem', color: 'var(--text-muted)' }}
                                                    title="Aufgabe bearbeiten"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
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
                    onClose={() => { setModalOpen(false); setEditingTodo(null); }}
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
                    onClose={() => { setFollowUpTodo(null); setPendingActionTodoId(null); }}
                    onSaveSuccess={() => { loadTodos(); onReportsChanged?.(); }}
                    users={users}
                    reports={reports}
                    currentUser={currentUser}
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
                                {loading ? 'Schliesst ab...' : 'Projekt abschliessen und archivieren'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TodoMonitor;

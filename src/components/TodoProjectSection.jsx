import React, { useState, useEffect, useMemo } from 'react';
import { ClipboardList, Plus, Clock, Edit2, ShieldAlert, Check, HelpCircle, Trash2 } from 'lucide-react';
import { fetchTodosForProject, completeTodoAndArchiveProjectRpc, deleteTodo } from '../services/TodoService';
import TodoModal from './TodoModal';

const TodoProjectSection = ({
    project = null,
    users = [],
    currentUser = null,
    onReportsChanged,
    onCloseProject // callback to close the project view if archived
}) => {
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [showHistory, setShowHistory] = useState(false);

    // Modals & Dialogs
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTodo, setEditingTodo] = useState(null);
    const [followUpTodo, setFollowUpTodo] = useState(null);

    const [blockDialog, setBlockDialog] = useState(null);
    const [confirmArchiveDialog, setConfirmArchiveDialog] = useState(null);
    const [pendingActionTodoId, setPendingActionTodoId] = useState(null);

    const loadProjectTodos = async () => {
        if (!project) return;
        setLoading(true);
        setError('');
        try {
            const list = await fetchTodosForProject(project);
            setTodos(list);
        } catch (err) {
            setError('Fehler beim Laden der Aufgaben: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProjectTodos();
    }, [project, project?.officeTasks, project?.report_data?.officeTasks]);

    // Split open vs done
    const openTodos = useMemo(() => {
        return todos.filter(t => t.status === 'open').sort((a, b) => a.due_date.localeCompare(b.due_date));
    }, [todos]);

    const historyTodos = useMemo(() => {
        return todos.filter(t => t.status === 'done').sort((a, b) => {
            const timeA = new Date(a.completed_at || 0).getTime();
            const timeB = new Date(b.completed_at || 0).getTime();
            return timeB - timeA; // newest first
        });
    }, [todos]);

    const handleToggleDone = async (todoItem, checked) => {
        if (!checked) return;

        setPendingActionTodoId(todoItem.id);

        if (todoItem.closes_project) {
            // Find if other open todos exist for this project
            const otherOpen = openTodos.filter(t => t.id !== todoItem.id);

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

    const handleConfirmArchive = async () => {
        if (!confirmArchiveDialog) return;
        const { todo: todoItem } = confirmArchiveDialog;

        setLoading(true);
        try {
            await completeTodoAndArchiveProjectRpc(todoItem.id, currentUser?.name || 'System');
            setConfirmArchiveDialog(null);
            setPendingActionTodoId(null);
            loadProjectTodos();
            onReportsChanged?.(); // notify parent
            if (onCloseProject) {
                onCloseProject(); // close project details as it is archived
            }
        } catch (err) {
            alert('Fehler beim Projektabschluss: ' + err.message);
            setPendingActionTodoId(null);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTodo = async (todoId) => {
        if (!window.confirm('Möchten Sie dieses To-do wirklich löschen?')) return;
        setLoading(true);
        setError('');
        try {
            await deleteTodo(todoId);
            loadProjectTodos();
            onReportsChanged?.();
        } catch (err) {
            setError('Fehler beim Löschen des To-dos: ' + err.message);
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

    if (!project) return null;

    return (
        <div style={{
            background: 'var(--surface)', padding: '1.25rem', borderRadius: '8px',
            border: '1px solid var(--border)', color: 'var(--text-main)',
            marginTop: '1rem', textAlign: 'left'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <ClipboardList size={18} style={{ color: 'var(--q-primary, #1e6db7)' }} />
                    Projekt-Aufgaben (To-dos)
                </h4>
                <button
                    type="button"
                    onClick={() => { setEditingTodo(null); setModalOpen(true); }}
                    className="btn btn-ghost"
                    style={{ fontSize: '0.82rem', padding: '0.35rem 0.65rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                    <Plus size={14} />
                    <span>Weiteres To-do</span>
                </button>
            </div>

            {error && (
                <div style={{ padding: '0.5rem', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                    {error}
                </div>
            )}

            {/* Open Todos list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h5 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Offene To-dos</h5>
                {openTodos.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '6px', fontSize: '0.85rem' }}>
                        Keine offenen To-dos für dieses Projekt.
                    </div>
                ) : (
                    openTodos.map(t => (
                        <div
                            key={t.id}
                            style={{
                                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                                padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '6px',
                                backgroundColor: 'var(--surface-hover, rgba(0,0,0,0.015))'
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={pendingActionTodoId === t.id}
                                disabled={pendingActionTodoId !== null && pendingActionTodoId !== t.id}
                                onChange={(e) => handleToggleDone(t, e.target.checked)}
                                style={{ width: '20px', height: '20px', marginTop: '2px', cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, fontSize: '0.88rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <span style={{ fontWeight: 600 }}>{t.task}</span>
                                    <span style={{
                                        fontSize: '0.78rem', padding: '0.15rem 0.35rem', borderRadius: '4px',
                                        backgroundColor: 'var(--surface-active, rgba(0,0,0,0.06))', fontWeight: 600
                                    }}>
                                        Fällig: {formatDateGerman(t.due_date)}
                                    </span>
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                    Zuständig: <strong>{t.assigned_user_name}</strong>
                                </div>
                                {t.note && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.35rem', paddingLeft: '0.5rem', borderLeft: '2px solid var(--border)' }}>
                                        {t.note}
                                    </div>
                                )}
                                {t.closes_project && (
                                    <div style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 600, marginTop: '0.4rem' }}>
                                        ✓ Schliesst das Projekt nach Erledigung ab.
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                <button
                                    type="button"
                                    title="To-do bearbeiten"
                                    onClick={() => { setEditingTodo(t); setModalOpen(true); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
                                    disabled={pendingActionTodoId !== null}
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button
                                    type="button"
                                    title="To-do löschen"
                                    onClick={() => handleDeleteTodo(t.id)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '0.25rem' }}
                                    disabled={pendingActionTodoId !== null}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* History Section (Optional expander) */}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                        gap: '0.35rem', fontSize: '0.85rem', padding: 0
                    }}
                >
                    <Clock size={16} />
                    <span>{showHistory ? 'To-do-History ausblenden' : 'To-do-History anzeigen'}</span>
                </button>

                {showHistory && (
                    <div style={{ marginTop: '0.75rem' }}>
                        {historyTodos.length === 0 ? (
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Keine erledigten To-dos im Verlauf.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {historyTodos.map(ht => (
                                    <div
                                        key={ht.id}
                                        style={{
                                            padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: '4px',
                                            backgroundColor: 'var(--surface-hover, rgba(0,0,0,0.01))', fontSize: '0.8rem',
                                            opacity: 0.85
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontWeight: 600 }}>{ht.task}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>Erledigt: {formatDateGerman(ht.completed_at?.split('T')[0])}</span>
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                                            Mitarbeiter: {ht.assigned_user_name} | Erledigt durch: {ht.completed_by}
                                        </div>
                                        {ht.note && <div style={{ fontStyle: 'italic', marginTop: '0.25rem', color: 'var(--text-muted)' }}>Note: {ht.note}</div>}
                                        {ht.closes_project && <div style={{ color: '#10B981', fontWeight: 600, fontSize: '0.75rem', marginTop: '0.2rem' }}>Projektabschluss: Ja</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

             {/* TodoModal Portal */}
            {modalOpen && (
                <TodoModal
                    todo={editingTodo}
                    initialProject={project}
                    onClose={() => { setModalOpen(false); setEditingTodo(null); }}
                    onSaveSuccess={() => { loadProjectTodos(); onReportsChanged?.(); }}
                    users={users}
                    reports={[project]}
                    currentUser={currentUser}
                />
            )}

            {/* FollowUp Todo Modal Portal */}
            {followUpTodo && (
                <TodoModal
                    todo={followUpTodo}
                    initialProject={project}
                    isFollowUpMode={true}
                    onClose={() => { setFollowUpTodo(null); setPendingActionTodoId(null); }}
                    onSaveSuccess={() => { loadProjectTodos(); onReportsChanged?.(); }}
                    users={users}
                    reports={[project]}
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
                        width: '450px', maxWidth: '100%', border: '1px solid var(--border)',
                        color: 'var(--text-main)', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'center', color: '#ef4444', marginBottom: '1rem' }}>
                            <ShieldAlert size={48} />
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Projekt kann noch nicht abgeschlossen werden.</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                            Für dieses Projekt bestehen noch {blockDialog.otherTodos.length} weitere offene To-dos. Bitte erledigen oder bearbeiten Sie diese zuerst.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                type="button"
                                onClick={() => { setBlockDialog(null); setPendingActionTodoId(null); }}
                                className="btn btn-primary"
                                style={{ minWidth: '100px' }}
                            >
                                Zurück
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
                        width: '400px', maxWidth: '100%', border: '1px solid var(--border)',
                        color: 'var(--text-main)', textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--q-primary, #1e6db7)', marginBottom: '1rem' }}>
                            <HelpCircle size={48} />
                        </div>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>Projekt wirklich abschliessen?</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                            Das aktuelle To-do wird erledigt, das Projekt abgeschlossen und in das Archiv verschoben. Es wird kein Folge-To-do erstellt.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                type="button"
                                onClick={() => { setConfirmArchiveDialog(null); setPendingActionTodoId(null); }}
                                className="btn btn-ghost"
                                style={{ minWidth: '100px' }}
                                disabled={loading}
                            >
                                Abbrechen
                            </button>
                            <button
                                type="button"
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

export default TodoProjectSection;

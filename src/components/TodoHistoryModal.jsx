import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, User, CheckCircle, ArrowDown, History, ClipboardList } from 'lucide-react';
import { fetchTodosForProject } from '../services/TodoService';

export default function TodoHistoryModal({ todo, onClose, projectTitle }) {
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;

        async function loadHistory() {
            if (!todo) return;
            setLoading(true);
            setError('');

            try {
                const projectId = todo.project_id || todo.projectId;
                const data = await fetchTodosForProject(projectId);

                if (active) {
                    const mapped = (data || []).map(t => ({
                        ...t,
                        id: t.id,
                        project_id: t.project_id || t.projectId,
                        parent_todo_id: t.parent_todo_id || t.parentTodoId,
                        root_todo_id: t.root_todo_id || t.rootTodoId,
                        task: t.task || t.title,
                        due_date: t.due_date || t.dueDate,
                        status: t.status || (t.done ? 'done' : 'open'),
                        assigned_user_name: t.assigned_user_name || t.assignedUserName || 'Innendienst',
                        completed_at: t.completed_at || t.completedAt,
                        completed_by: t.completed_by || t.completedBy,
                        note: t.note
                    }));
                    setTodos(mapped);
                }
            } catch (err) {
                console.error('[TodoHistoryModal] Error fetching todo history:', err);
                if (active) {
                    setError('Verlauf konnte nicht geladen werden.');
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        }

        loadHistory();
        return () => { active = false; };
    }, [todo]);

    // Tracing the chain from root to leaf
    const chain = useMemo(() => {
        if (!todo || todos.length === 0) return [];

        // 1. Find the root To-do of this chain
        const rootId = todo.root_todo_id;
        let rootTodo = rootId ? todos.find(t => t.id === rootId) : null;
        
        // If root is not found by root_todo_id, traverse up parent_todo_id
        if (!rootTodo) {
            let current = todo;
            while (current) {
                const parent = todos.find(t => t.id === current.parent_todo_id);
                if (!parent) {
                    rootTodo = current;
                    break;
                }
                current = parent;
            }
        }

        if (!rootTodo) return [todo];

        // 2. Trace downwards from the root using parent_todo_id relationships
        const resultChain = [rootTodo];
        let currentParent = rootTodo;

        // Loop to find children/successors in order
        while (currentParent) {
            const child = todos.find(t => t.parent_todo_id === currentParent.id);
            if (child && !resultChain.some(r => r.id === child.id)) {
                resultChain.push(child);
                currentParent = child;
            } else {
                break;
            }
        }

        return resultChain;
    }, [todo, todos]);

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 999999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                backgroundColor: 'var(--surface, #1E293B)',
                padding: '2rem',
                borderRadius: '12px',
                width: '900px',
                maxWidth: '95%',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                border: '1px solid var(--border, rgba(255,255,255,0.08))',
                color: 'var(--text-main, #F1F5F9)',
                position: 'relative'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexShrink: 0 }}>
                    <div>
                        <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600 }}>
                            <History size={22} style={{ color: 'var(--q-primary, #1e6db7)' }} />
                            Aufgabenverlauf (Rolling To-do)
                        </h3>
                        {projectTitle && (
                            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted, #94A3B8)', fontWeight: 500 }}>
                                Projekt: <strong style={{ color: 'var(--text-main, #F1F5F9)' }}>{projectTitle}</strong>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted, #94A3B8)', padding: '4px' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column' }}>
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>Verlauf wird geladen...</div>
                    ) : error ? (
                        <div style={{ padding: '1rem', color: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '6px', textAlign: 'center' }}>{error}</div>
                    ) : chain.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted, #94A3B8)' }}>Kein Verlauf vorhanden.</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))', color: 'var(--text-muted, #94A3B8)', fontSize: '0.85rem' }}>
                                        <th style={{ padding: '0.75rem 0.5rem', width: '50px', textAlign: 'center' }}>Fluss</th>
                                        <th style={{ padding: '0.75rem 0.75rem' }}>Aufgabe</th>
                                        <th style={{ padding: '0.75rem 0.75rem', width: '90px' }}>Fälligkeit</th>
                                        <th style={{ padding: '0.75rem 0.75rem', width: '100px' }}>Erledigt am</th>
                                        <th style={{ padding: '0.75rem 0.75rem', width: '120px' }}>Zuständig</th>
                                        <th style={{ padding: '0.75rem 0.75rem', width: '80px' }}>Status</th>
                                        <th style={{ padding: '0.75rem 0.75rem' }}>Notiz</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {chain.map((item, index) => {
                                        const isCurrent = item.id === todo.id;
                                        const isDone = item.status === 'done';

                                        return (
                                            <tr 
                                                key={item.id}
                                                style={{
                                                    borderBottom: '1px solid var(--border, rgba(255,255,255,0.04))',
                                                    backgroundColor: isCurrent ? 'rgba(30,109,183,0.08)' : 'transparent',
                                                    outline: isCurrent ? '1px solid var(--q-primary, #1e6db7)' : 'none',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                {/* 1. Fluss (Timeline Indicator) */}
                                                <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', position: 'relative', verticalAlign: 'middle' }}>
                                                    {/* Vertical connector line */}
                                                    {index < chain.length - 1 && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            bottom: '-50%',
                                                            left: '50%',
                                                            width: '2px',
                                                            backgroundColor: 'var(--border, rgba(255,255,255,0.15))',
                                                            transform: 'translateX(-50%)',
                                                            zIndex: 1
                                                        }} />
                                                    )}
                                                    {/* Node icon */}
                                                    <div style={{
                                                        position: 'relative',
                                                        zIndex: 2,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '20px',
                                                        height: '20px',
                                                        borderRadius: '50%',
                                                        backgroundColor: isDone ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                                        color: isDone ? '#10B981' : '#F59E0B',
                                                        border: isCurrent ? '2px solid var(--q-primary, #1e6db7)' : 'none'
                                                    }}>
                                                        {isDone ? <CheckCircle size={12} /> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />}
                                                    </div>
                                                </td>

                                                {/* 2. Aufgabe */}
                                                <td style={{ padding: '0.65rem 0.75rem', fontWeight: isCurrent ? 700 : 500 }}>
                                                    {item.task}
                                                </td>

                                                {/* 3. Fälligkeit */}
                                                <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted, #94A3B8)' }}>
                                                    {new Date(item.due_date).toLocaleDateString('de-CH')}
                                                </td>

                                                {/* 4. Erledigt am */}
                                                <td style={{ padding: '0.65rem 0.75rem', color: isDone ? '#10B981' : 'var(--text-muted, #94A3B8)' }}>
                                                    {isDone && item.completed_at ? new Date(item.completed_at).toLocaleDateString('de-CH') : '-'}
                                                </td>

                                                {/* 5. Zuständig */}
                                                <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600 }}>
                                                    {item.assigned_user_name}
                                                </td>

                                                {/* 6. Status */}
                                                <td style={{ padding: '0.65rem 0.75rem' }}>
                                                    <span style={{
                                                        fontSize: '0.72rem',
                                                        fontWeight: 700,
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        backgroundColor: isDone ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                                                        color: isDone ? '#10B981' : '#F59E0B',
                                                        display: 'inline-block'
                                                    }}>
                                                        {isDone ? 'Erledigt' : 'Offen'}
                                                    </span>
                                                </td>

                                                {/* 7. Notiz */}
                                                <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text-muted, #94A3B8)', fontStyle: 'italic', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.note}>
                                                    {item.note || ''}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: '6px',
                            backgroundColor: 'var(--surface-active, rgba(255,255,255,0.06))',
                            border: '1px solid var(--border, rgba(255,255,255,0.08))',
                            color: 'var(--text-main, #F1F5F9)',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--surface-active, rgba(255,255,255,0.06))'}
                    >
                        Schließen
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

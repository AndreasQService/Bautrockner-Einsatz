import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, ClipboardList, CheckSquare, AlertTriangle, ShieldAlert } from 'lucide-react';
import { createTodo, updateTodo, completeAndCreateTodoRpc } from '../services/TodoService';

const TodoModal = ({
    todo = null,           // If editing or completing, the existing todo object
    onClose,
    onSaveSuccess,
    users = [],
    reports = [],
    currentUser = null,
    isFollowUpMode = false, // If true, we are creating a follow-up todo for `todo`
    initialProject = null   // Optional project to pre-select
}) => {
    const [selectedProject, setSelectedProject] = useState(null);
    const [projectSearch, setProjectSearch] = useState('');
    const [showProjectDropdown, setShowProjectDropdown] = useState(false);

    // Form fields
    const [task, setTask] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [assignedUserId, setAssignedUserId] = useState('');
    const [note, setNote] = useState('');
    const [closesProject, setClosesProject] = useState(false);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [dateWarning, setDateWarning] = useState('');

    // Load initial values if editing or in follow-up mode
    useEffect(() => {
        if (todo) {
            // Find project
            const proj = reports.find(r => r.id === todo.project_id);
            if (proj) {
                setSelectedProject(proj);
                setProjectSearch(proj.projectTitle || proj.project_title || proj.address || proj.id);
            }

            if (!isFollowUpMode) {
                // Edit mode
                setTask(todo.task || '');
                setDueDate(todo.due_date || '');
                setAssignedUserId(todo.assigned_user_id || '');
                setNote(todo.note || '');
                setClosesProject(!!todo.closes_project);
            } else {
                // Follow-up mode: prefill some values if desired, but keep task/due_date clean
                setAssignedUserId(todo.assigned_user_id || '');
            }
        } else if (initialProject) {
            setSelectedProject(initialProject);
            setProjectSearch(initialProject.projectTitle || initialProject.project_title || initialProject.address || initialProject.id);
        } else if (reports.length === 1) {
            setSelectedProject(reports[0]);
            setProjectSearch(reports[0].projectTitle || reports[0].project_title || reports[0].address || reports[0].id);
        }
    }, [todo, isFollowUpMode, reports, initialProject]);

    // Active/open todos for selected project
    const activeProjectTodosCount = useMemo(() => {
        if (!selectedProject || !todo && isFollowUpMode) return 0;
        // In this modal context, we don't have all todos, but we can count if they are passed or fetched.
        // Actually, we can count from the global todos list if we had it, but showing the count is a "nice-to-have" warning.
        // Let's count them by querying Supabase or from parent todos list if needed, or we can fetch them.
        return 0; // We will fetch this count on selectedProject change!
    }, [selectedProject]);

    const [existingTodosCount, setExistingTodosCount] = useState(0);
    useEffect(() => {
        if (!selectedProject || isFollowUpMode) {
            setExistingTodosCount(0);
            return;
        }
        // Fetch existing open todos for this project
        import('../services/TodoService').then(m => {
            m.fetchTodosForProject(selectedProject.id).then(list => {
                const openCount = list.filter(t => t.status === 'open' && (!todo || t.id !== todo.id)).length;
                setExistingTodosCount(openCount);
            }).catch(console.error);
        });
    }, [selectedProject, todo, isFollowUpMode]);

    // Search results for project selection
    const filteredProjects = useMemo(() => {
        if (!projectSearch.trim()) return [];
        const q = projectSearch.toLowerCase().trim();
        return reports.filter(r => {
            if (r.id === 'SYSTEM_SETTINGS') return false;
            if (r.status === 'Abgeschlossen') return false; // Exclude archived
            return (
                String(r.id || '').toLowerCase().includes(q) ||
                String(r.projectTitle || '').toLowerCase().includes(q) ||
                String(r.projectNumber || '').toLowerCase().includes(q) ||
                String(r.address || '').toLowerCase().includes(q) ||
                String(r.client || '').toLowerCase().includes(q)
            );
        });
    }, [projectSearch, reports]);

    // Date helpers
    const setPresetDate = (daysToAdd) => {
        const d = new Date();
        d.setDate(d.getDate() + daysToAdd);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setDueDate(`${yyyy}-${mm}-${dd}`);
    };

    // Validate due date warning (past dates)
    useEffect(() => {
        if (!dueDate) {
            setDateWarning('');
            return;
        }
        const todayStr = new Date().toISOString().split('T')[0];
        if (dueDate < todayStr) {
            setDateWarning('Das gewählte Fälligkeitsdatum liegt in der Vergangenheit.');
        } else {
            setDateWarning('');
        }
    }, [dueDate]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (saving) return;

        setError('');

        if (!selectedProject) {
            setError('Bitte ein Projekt auswählen.');
            return;
        }
        if (!task.trim()) {
            setError('Bitte eine Aufgabe eingeben.');
            return;
        }
        if (!dueDate) {
            setError('Bitte ein Fälligkeitsdatum auswählen.');
            return;
        }
        if (!assignedUserId) {
            setError('Bitte einen zuständigen Mitarbeiter auswählen.');
            return;
        }

        const assignedUser = users.find(u => String(u.id) === String(assignedUserId));
        if (!assignedUser) {
            setError('Zuständiger Mitarbeiter ist ungültig.');
            return;
        }

        setSaving(true);

        try {
            const dataToSave = {
                projectId: selectedProject.id,
                task: task.trim(),
                dueDate,
                assignedUserId,
                assignedUserName: assignedUser.name,
                note: note.trim() || null,
                closesProject,
                currentUser: currentUser?.name || 'System'
            };

            if (isFollowUpMode && todo) {
                // Save follow-up: completes old todo and creates new todo atomically
                await completeAndCreateTodoRpc(todo.id, currentUser?.name || 'System', dataToSave);
            } else if (todo) {
                // Edit mode
                await updateTodo(todo.id, dataToSave, todo.updated_at);
            } else {
                // Create mode
                await createTodo(dataToSave);
            }

            onSaveSuccess();
            onClose();
        } catch (err) {
            setError(err.message || 'Fehler beim Speichern des To-dos.');
        } finally {
            setSaving(false);
        }
    };

    if (typeof document === 'undefined') return null;

    const modalTitle = isFollowUpMode
        ? 'Folge-To-do erstellen'
        : todo
            ? 'To-do bearbeiten'
            : 'Neues To-do erstellen';

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '1rem',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{
                backgroundColor: 'var(--surface)', padding: '2rem', borderRadius: '12px',
                width: '550px', maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                border: '1px solid var(--border)',
                color: 'var(--text-main)',
                position: 'relative',
                overflowY: 'auto'
            }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.3rem', display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600 }}>
                        <ClipboardList size={22} style={{ color: 'var(--q-primary, #1e6db7)' }} />
                        {modalTitle}
                    </h3>
                    <button onClick={onClose} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Project Autocomplete Search */}
                    <div style={{ position: 'relative' }}>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}>Projekt / Adresse *</label>
                        <input
                            type="text"
                            value={projectSearch}
                            onChange={(e) => {
                                setProjectSearch(e.target.value);
                                setShowProjectDropdown(true);
                                if (selectedProject && e.target.value !== (selectedProject.projectTitle || selectedProject.project_title || selectedProject.address || selectedProject.id)) {
                                    setSelectedProject(null);
                                }
                            }}
                            onFocus={() => setShowProjectDropdown(true)}
                            placeholder="Projekt suchen (Nr., Name, Adresse, Kunde)..."
                            className="form-input"
                            style={{ width: '100%' }}
                            disabled={!!todo || saving} // Lock project if editing or creating follow-up
                            required
                        />
                        {showProjectDropdown && filteredProjects.length > 0 && !todo && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                backgroundColor: 'var(--surface)', border: '1px solid var(--border)',
                                borderRadius: '4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                            }}>
                                {filteredProjects.map(proj => (
                                    <div
                                        key={proj.id}
                                        onClick={() => {
                                            setSelectedProject(proj);
                                            setProjectSearch((proj.projectTitle && proj.projectTitle !== proj.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(proj.projectTitle)) ? proj.projectTitle : (proj.address || proj.id));
                                            setShowProjectDropdown(false);
                                            setError('');
                                        }}
                                        style={{
                                            padding: '0.6rem 0.8rem', cursor: 'pointer',
                                            borderBottom: '1px solid var(--border-light, rgba(0,0,0,0.05))',
                                            fontSize: '0.9rem'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--surface-hover, rgba(0,0,0,0.04))'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                    >
                                        <div style={{ fontWeight: 600 }}>
                                            {(proj.projectTitle && proj.projectTitle !== proj.id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(proj.projectTitle)) ? proj.projectTitle : (proj.address || 'Unbenanntes Projekt')}
                                        </div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                            {proj.projectNumber || proj.id} | {proj.address}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Existing active todos warning */}
                        {existingTodosCount > 0 && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                marginTop: '0.5rem', padding: '0.5rem 0.75rem',
                                backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)',
                                borderRadius: '6px', color: '#d97706', fontSize: '0.82rem'
                            }}>
                                <AlertTriangle size={16} />
                                <span>Für dieses Projekt bestehen bereits {existingTodosCount} offene To-dos.</span>
                            </div>
                        )}
                    </div>

                    {/* Task field */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}>Aufgabe *</label>
                        <input
                            type="text"
                            value={task}
                            onChange={(e) => setTask(e.target.value)}
                            placeholder="Was ist zu tun?"
                            className="form-input"
                            style={{ width: '100%' }}
                            disabled={saving}
                            required
                        />
                    </div>

                    {/* Assigned User Selection */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}>Wer *</label>
                        <select
                            value={assignedUserId}
                            onChange={(e) => setAssignedUserId(e.target.value)}
                            className="form-input"
                            style={{ width: '100%', height: '40px' }}
                            disabled={saving}
                            required
                        >
                            <option value="">Mitarbeiter auswählen...</option>
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                            ))}
                        </select>
                    </div>

                    {/* Due Date Picker & Presets */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}>Fällig bis *</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <Calendar size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="form-input"
                                    style={{ width: '100%', paddingLeft: '32px' }}
                                    disabled={saving}
                                    required
                                />
                            </div>
                            <button type="button" onClick={() => setPresetDate(0)} disabled={saving} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}>Heute</button>
                            <button type="button" onClick={() => setPresetDate(1)} disabled={saving} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}>Morgen</button>
                            <button type="button" onClick={() => setPresetDate(7)} disabled={saving} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}>1 Woche</button>
                        </div>
                        {dateWarning && (
                            <div style={{ fontSize: '0.8rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.25rem' }}>
                                <AlertTriangle size={14} />
                                <span>{dateWarning}</span>
                            </div>
                        )}
                    </div>

                    {/* Optional Note */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.88rem', fontWeight: 600 }}>Notiz (Optional)</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Zusätzliche Details..."
                            className="form-input"
                            rows={3}
                            style={{ width: '100%', resize: 'vertical' }}
                            disabled={saving}
                        />
                    </div>

                    {/* Closes Project Checkbox */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.2rem', padding: '0.4rem 0' }}>
                        <label htmlFor="closesProject" style={{ fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer', select: 'none' }}>
                            Abschluss – Projekt nach Erledigung abschliessen und archivieren
                        </label>
                        <input
                            type="checkbox"
                            id="closesProject"
                            checked={closesProject}
                            onChange={(e) => setClosesProject(e.target.checked)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            disabled={saving}
                        />
                    </div>

                    {/* Error display */}
                    {error && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px',
                            color: '#ef4444', fontSize: '0.88rem'
                        }}>
                            <ShieldAlert size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Footer Buttons */}
                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-ghost"
                            disabled={saving}
                            style={{ minWidth: '100px' }}
                        >
                            Abbrechen
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                minWidth: '120px', justifyContent: 'center'
                            }}
                        >
                            {saving ? 'Speichert...' : isFollowUpMode ? 'Folge-To-do speichern' : 'Speichern'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default TodoModal;

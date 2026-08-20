import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Save, Trash2, UserPlus, X } from 'lucide-react';
import { createDirectoryUser, deleteDirectoryUser, listDirectoryUsers, updateDirectoryUser } from '../services/AdminUserService.js';

const EMPTY_FORM = Object.freeze({ email: '', displayName: '', password: '' });

const UserManagementModal = ({ onClose, setUsers, currentAuthUserId }) => {
    const [directoryUsers, setDirectoryUsers] = useState([]);
    const [newUser, setNewUser] = useState(EMPTY_FORM);
    const [editingUserId, setEditingUserId] = useState(null);
    const [editUser, setEditUser] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const publishUsers = useCallback((nextUsers) => {
        setDirectoryUsers(nextUsers);
        setUsers(nextUsers);
    }, [setUsers]);

    const refreshUsers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            publishUsers(await listDirectoryUsers());
        } catch (err) {
            setError(err.message || 'Benutzer konnten nicht geladen werden.');
        } finally {
            setLoading(false);
        }
    }, [publishUsers]);

    useEffect(() => { void refreshUsers(); }, [refreshUsers]);

    const updateField = (setter, key, value) => setter((current) => ({ ...current, [key]: value }));

    const handleAddUser = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            publishUsers(await createDirectoryUser(newUser));
            setNewUser(EMPTY_FORM);
        } catch (err) {
            setError(err.message || 'Benutzer konnte nicht angelegt werden.');
        } finally {
            setSaving(false);
        }
    };

    const handleStartEdit = (user) => {
        setEditingUserId(user.id);
        setEditUser({ email: user.email, displayName: user.displayName || user.name, password: '' });
        setError('');
    };

    const handleSaveEdit = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            publishUsers(await updateDirectoryUser(editingUserId, editUser));
            setEditingUserId(null);
            setEditUser(EMPTY_FORM);
        } catch (err) {
            setError(err.message || 'Benutzer konnte nicht gespeichert werden.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteUser = async (user) => {
        if (String(user.id) === String(currentAuthUserId)) {
            setError('Das aktuell angemeldete Administratorkonto kann nicht gelöscht werden.');
            return;
        }
        if (!window.confirm(`Benutzer ${user.displayName || user.name} (${user.email}) wirklich löschen?`)) return;
        setSaving(true);
        setError('');
        try {
            publishUsers(await deleteDirectoryUser(user.id));
        } catch (err) {
            setError(err.message || 'Benutzer konnte nicht gelöscht werden.');
        } finally {
            setSaving(false);
        }
    };

    if (typeof document === 'undefined') return null;

    const field = (label, type, value, onChange, placeholder, required = true) => (
        <label style={{ display: 'grid', gap: '0.4rem', minWidth: 0 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{label}</span>
            <input
                className="form-input"
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                required={required}
                autoComplete={type === 'password' ? 'new-password' : type === 'email' ? 'email' : 'name'}
                minLength={type === 'password' && required ? 8 : undefined}
                style={{ width: '100%' }}
            />
        </label>
    );

    return createPortal(
        <div className="user-management-overlay" role="presentation">
            <section className="user-management-modal" role="dialog" aria-modal="true" aria-labelledby="user-management-title">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div>
                        <h3 id="user-management-title" style={{ margin: 0 }}>Benutzerverwaltung</h3>
                        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Supabase Auth · Passwörter sind niemals einsehbar</p>
                    </div>
                    <button type="button" onClick={onClose} className="btn btn-ghost" aria-label="Benutzerverwaltung schließen"><X size={22} /></button>
                </header>

                <form onSubmit={handleAddUser} className="user-management-grid" style={{ marginTop: '1.5rem' }}>
                    {field('E-Mail', 'email', newUser.email, (value) => updateField(setNewUser, 'email', value), 'name@firma.ch')}
                    {field('Anzeigename', 'text', newUser.displayName, (value) => updateField(setNewUser, 'displayName', value), 'Vorname Nachname')}
                    {field('Passwort', 'password', newUser.password, (value) => updateField(setNewUser, 'password', value), 'Mindestens 8 Zeichen')}
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ gridColumn: '1 / -1', justifySelf: 'end' }}><UserPlus size={18} /> {saving ? 'Wird angelegt…' : 'Benutzer anlegen'}</button>
                </form>

                {error && <div role="alert" style={{ marginTop: '1rem', color: '#EF4444' }}>{error}</div>}

                <div style={{ marginTop: '1.5rem', overflow: 'auto' }}>
                    <div className="user-management-grid user-management-heading" aria-hidden="true">
                        <strong>E-Mail</strong><strong>Anzeigename</strong><strong>Passwort</strong><span />
                    </div>
                    {loading ? <p>Benutzer werden geladen…</p> : directoryUsers.map((user) => (
                        editingUserId === user.id ? (
                            <form key={user.id} onSubmit={handleSaveEdit} className="user-management-grid user-management-row">
                                {field('E-Mail', 'email', editUser.email, (value) => updateField(setEditUser, 'email', value), 'name@firma.ch')}
                                {field('Anzeigename', 'text', editUser.displayName, (value) => updateField(setEditUser, 'displayName', value), 'Vorname Nachname')}
                                {field('Neues Passwort', 'password', editUser.password, (value) => updateField(setEditUser, 'password', value), 'Leer = unverändert', false)}
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'end' }}>
                                    <button type="submit" className="btn btn-primary" disabled={saving} aria-label={`${user.name} speichern`}><Save size={17} /></button>
                                    <button type="button" className="btn btn-ghost" onClick={() => setEditingUserId(null)}>Abbrechen</button>
                                </div>
                            </form>
                        ) : (
                            <div key={user.id} className="user-management-grid user-management-row">
                                <span>{user.email}</span>
                                <span><strong>{user.displayName || user.name}</strong></span>
                                <span aria-label="Passwort nicht einsehbar">••••••••</span>
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                    <button type="button" className="btn btn-ghost" onClick={() => handleStartEdit(user)} aria-label={`${user.name} bearbeiten`}><Edit2 size={17} /></button>
                                    <button type="button" className="btn btn-danger" disabled={saving || String(user.id) === String(currentAuthUserId)} onClick={() => void handleDeleteUser(user)} aria-label={`${user.name} löschen`}><Trash2 size={17} /></button>
                                </div>
                            </div>
                        )
                    ))}
                </div>
            </section>
        </div>,
        document.body
    );
};

export default UserManagementModal;

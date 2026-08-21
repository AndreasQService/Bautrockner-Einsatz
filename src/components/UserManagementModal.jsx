import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, Eye, EyeOff, Mail, Save, Trash2, X } from 'lucide-react';
import { createDirectoryUser, deleteDirectoryUser, listDirectoryUsers, updateDirectoryUser } from '../services/AdminUserService.js';

const EMPTY_FORM = Object.freeze({ email: '', displayName: '', password: '', role: 'technician' });
const ROLE_OPTIONS = Object.freeze([
    { value: 'admin', label: 'Administrator' },
    { value: 'technician', label: 'Techniker' },
    { value: 'handwerker', label: 'Handwerker' },
    { value: 'user', label: 'Benutzer' },
]);

const UserManagementModal = ({ onClose, setUsers, currentAuthUserId }) => {
    const [directoryUsers, setDirectoryUsers] = useState([]);
    const [newUser, setNewUser] = useState(EMPTY_FORM);
    const [editingUserId, setEditingUserId] = useState(null);
    const [editUser, setEditUser] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showEditPassword, setShowEditPassword] = useState(false);
    const [notice, setNotice] = useState('');

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
        setNotice('');
        try {
            publishUsers(await createDirectoryUser(newUser));
            setNotice(`Einladung wurde an ${newUser.email.trim().toLowerCase()} gesendet. Der Benutzer legt sein Passwort selbst fest.`);
            setNewUser(EMPTY_FORM);
        } catch (err) {
            setError(err.message || 'Benutzer konnte nicht angelegt werden.');
        } finally {
            setSaving(false);
        }
    };

    const handleStartEdit = (user) => {
        setEditingUserId(user.id);
        setEditUser({ email: user.email, displayName: user.displayName || user.name, password: '', role: user.role });
        setShowEditPassword(false);
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
            setShowEditPassword(false);
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

    const field = (label, type, value, onChange, placeholder, required = true, passwordVisible = false, onTogglePassword) => (
        <label style={{ display: 'grid', gap: '0.4rem', minWidth: 0 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{label}</span>
            <span style={{ position: 'relative', display: 'block' }}>
                <input
                    className="form-input"
                    type={type === 'password' && passwordVisible ? 'text' : type}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    required={required}
                    autoComplete={type === 'password' ? 'new-password' : type === 'email' ? 'email' : 'name'}
                    minLength={type === 'password' && required ? 8 : undefined}
                    style={{ width: '100%', paddingRight: type === 'password' ? '3rem' : undefined }}
                />
                {type === 'password' && (
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={onTogglePassword}
                        aria-label={passwordVisible ? 'Passwort verbergen' : 'Passwort anzeigen'}
                        aria-pressed={passwordVisible}
                        style={{ position: 'absolute', right: '0.35rem', top: '50%', transform: 'translateY(-50%)', padding: '0.35rem' }}
                    >
                        {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                )}
            </span>
        </label>
    );

    const roleField = (value, onChange, disabled = false) => (
        <label style={{ display: 'grid', gap: '0.4rem', minWidth: 0 }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Rolle</span>
            <select className="form-input" value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} required style={{ width: '100%' }}>
                {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
        </label>
    );

    return createPortal(
        <div className="user-management-overlay" role="presentation">
            <section className="user-management-modal" role="dialog" aria-modal="true" aria-labelledby="user-management-title">
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div>
                        <h3 id="user-management-title" style={{ margin: 0 }}>Benutzerverwaltung</h3>
                        <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Supabase Auth · Benutzer erhalten einen sicheren Einladungslink und legen ihr Passwort selbst fest.</p>
                    </div>
                    <button type="button" onClick={onClose} className="btn btn-ghost" aria-label="Benutzerverwaltung schließen"><X size={22} /></button>
                </header>

                <form onSubmit={handleAddUser} className="user-management-grid" style={{ marginTop: '1.5rem' }}>
                    {field('E-Mail', 'email', newUser.email, (value) => updateField(setNewUser, 'email', value), 'name@firma.ch')}
                    {field('Anzeigename', 'text', newUser.displayName, (value) => updateField(setNewUser, 'displayName', value), 'Vorname Nachname')}
                    {roleField(newUser.role, (value) => updateField(setNewUser, 'role', value))}
                    <button type="submit" className="btn btn-primary" disabled={saving} style={{ gridColumn: '1 / -1', justifySelf: 'end' }}><Mail size={18} /> {saving ? 'Einladung wird versendet…' : 'Benutzer einladen'}</button>
                </form>

                {error && <div role="alert" style={{ marginTop: '1rem', color: '#EF4444' }}>{error}</div>}
                {notice && <div role="status" style={{ marginTop: '1rem', color: '#10B981' }}>{notice}</div>}

                <div style={{ marginTop: '1.5rem', overflow: 'auto' }}>
                    <div className="user-management-grid user-management-heading" aria-hidden="true">
                        <strong>E-Mail</strong><strong>Anzeigename</strong><strong>Passwort</strong><strong>Rolle</strong><span />
                    </div>
                    {loading ? <p>Benutzer werden geladen…</p> : directoryUsers.map((user) => (
                        editingUserId === user.id ? (
                            <form key={user.id} onSubmit={handleSaveEdit} className="user-management-grid user-management-row">
                                {field('E-Mail', 'email', editUser.email, (value) => updateField(setEditUser, 'email', value), 'name@firma.ch')}
                                {field('Anzeigename', 'text', editUser.displayName, (value) => updateField(setEditUser, 'displayName', value), 'Vorname Nachname')}
                                {field('Neues Passwort', 'password', editUser.password, (value) => updateField(setEditUser, 'password', value), 'Leer = unverändert', false, showEditPassword, () => setShowEditPassword((visible) => !visible))}
                                {roleField(editUser.role, (value) => updateField(setEditUser, 'role', value), String(user.id) === String(currentAuthUserId))}
                                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'end' }}>
                                    <button type="submit" className="btn btn-primary" disabled={saving} aria-label={`${user.name} speichern`}><Save size={17} /></button>
                                    <button type="button" className="btn btn-ghost" onClick={() => { setEditingUserId(null); setShowEditPassword(false); }}>Abbrechen</button>
                                </div>
                            </form>
                        ) : (
                            <div key={user.id} className="user-management-grid user-management-row">
                                <span>{user.email}</span>
                                <span><strong>{user.displayName || user.name}</strong></span>
                                <span aria-label="Passwort nicht einsehbar">••••••••</span>
                                <span>{ROLE_OPTIONS.find((role) => role.value === user.role)?.label || user.role}</span>
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

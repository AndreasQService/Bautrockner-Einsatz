import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserPlus, Trash, Shield, User, Wrench, Key, Eye, EyeOff, Edit2, Check, Save } from 'lucide-react';

const UserManagementModal = ({ onClose, users, setUsers }) => {
    const [newName, setNewName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('technician');

    // Password visibility state per user ID
    const [visiblePasswords, setVisiblePasswords] = useState({});

    // User editing state
    const [editingUserId, setEditingUserId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editRole, setEditRole] = useState('technician');

    const togglePasswordVisibility = (id) => {
        setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAddUser = (e) => {
        e.preventDefault();
        if (!newName.trim() || !newPassword.trim()) return;

        const newUser = {
            id: Date.now(),
            name: newName.trim(),
            password: newPassword.trim(),
            role: newRole
        };

        setUsers([...users, newUser]);
        setNewName('');
        setNewPassword('');
        setNewRole('technician');
    };

    const handleStartEdit = (user) => {
        setEditingUserId(user.id);
        setEditName(user.name || '');
        setEditPassword(user.password || '');
        setEditRole(user.role || 'technician');
    };

    const handleSaveEdit = (userId) => {
        if (!editName.trim() || !editPassword.trim()) return;
        const updated = users.map(u => u.id === userId ? {
            ...u,
            name: editName.trim(),
            password: editPassword.trim(),
            role: editRole
        } : u);
        setUsers(updated);
        setEditingUserId(null);
    };

    const handleDeleteUser = (id) => {
        if (confirm('Benutzer wirklich löschen?')) {
            setUsers(users.filter(u => u.id !== id));
        }
    };

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                backgroundColor: 'var(--surface)', padding: '2rem', borderRadius: '8px',
                width: '720px', maxWidth: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                border: '1px solid var(--border)',
                color: 'var(--text-main)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <UserPlus size={24} />
                        Benutzerverwaltung & Rechte (Supabase Cloud DB)
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Add User Form */}
                <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 2, minWidth: '130px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>Name</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="form-input"
                            placeholder="Name..."
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div style={{ flex: 2, minWidth: '130px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>Passwort</label>
                        <input
                            type="text"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="form-input"
                            placeholder="Passwort..."
                            style={{ width: '100%' }}
                        />
                    </div>
                    <div style={{ flex: 1, minWidth: '110px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>Rolle</label>
                        <select
                            value={newRole}
                            onChange={(e) => setNewRole(e.target.value)}
                            className="form-input"
                            style={{ width: '100%' }}
                        >
                            <option value="technician">Techniker</option>
                            <option value="admin">Admin</option>
                            <option value="user">Benutzer</option>
                        </select>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ height: '38px', whiteSpace: 'nowrap' }}>
                        <UserPlus size={18} style={{ marginRight: '0.5rem' }} /> Hinzufügen
                    </button>
                </form>

                {/* User List */}
                <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <h4 style={{ margin: '0 0 1rem 0', opacity: 0.7, fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vorhandene Benutzer</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {users.map(user => (
                            <div key={user.id} style={{
                                padding: '0.85rem 1rem', backgroundColor: 'var(--background)',
                                borderRadius: '8px', border: '1px solid var(--border)'
                            }}>
                                {editingUserId === user.id ? (
                                    /* EDIT MODE */
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <div style={{ flex: 2, minWidth: '130px' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Name</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                style={{ width: '100%', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                        <div style={{ flex: 2, minWidth: '130px' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Passwort</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={editPassword}
                                                onChange={(e) => setEditPassword(e.target.value)}
                                                style={{ width: '100%', fontSize: '0.85rem' }}
                                            />
                                        </div>
                                        <div style={{ flex: 1, minWidth: '110px' }}>
                                            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px' }}>Rolle</label>
                                            <select
                                                className="form-input"
                                                value={editRole}
                                                onChange={(e) => setEditRole(e.target.value)}
                                                style={{ width: '100%', fontSize: '0.85rem' }}
                                            >
                                                <option value="technician">Techniker</option>
                                                <option value="admin">Admin</option>
                                                <option value="user">Benutzer</option>
                                            </select>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '1rem' }}>
                                            <button
                                                type="button"
                                                onClick={() => handleSaveEdit(user.id)}
                                                className="btn btn-primary"
                                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                            >
                                                <Save size={14} /> Speichern
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditingUserId(null)}
                                                className="btn btn-ghost"
                                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.82rem' }}
                                            >
                                                Abbrechen
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* DISPLAY MODE */
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                                            <div style={{
                                                width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0,
                                                backgroundColor: user.role === 'admin' ? 'rgba(239, 68, 68, 0.1)' : (user.role === 'technician' ? 'rgba(56, 189, 248, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: user.role === 'admin' ? '#EF4444' : (user.role === 'technician' ? '#38BDF8' : '#10B981')
                                            }}>
                                                {user.role === 'admin' ? <Shield size={20} /> : (user.role === 'technician' ? <Wrench size={20} /> : <User size={20} />)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{user.name}</div>
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                                    Rolle: <strong style={{ textTransform: 'capitalize' }}>{user.role === 'technician' ? 'Techniker' : (user.role === 'admin' ? 'Administrator' : 'Benutzer')}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Password Display */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--surface)', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                            <Key size={14} style={{ color: 'var(--text-muted)' }} />
                                            <span style={{ fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 600 }}>
                                                {visiblePasswords[user.id] ? user.password : '●●●●●●●●'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => togglePasswordVisibility(user.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.1rem' }}
                                                title={visiblePasswords[user.id] ? "Passwort verbergen" : "Passwort anzeigen"}
                                            >
                                                {visiblePasswords[user.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                            </button>
                                        </div>

                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                            <button
                                                onClick={() => handleStartEdit(user)}
                                                className="btn btn-ghost"
                                                style={{ padding: '0.35rem', color: 'var(--q-primary, #1e6db7)' }}
                                                title="Benutzer bearbeiten"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="btn btn-ghost"
                                                style={{ color: '#EF4444', padding: '0.35rem' }}
                                                title="Benutzer löschen"
                                            >
                                                <Trash size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {users.length === 0 && (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                Keine Benutzer vorhanden.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default UserManagementModal;

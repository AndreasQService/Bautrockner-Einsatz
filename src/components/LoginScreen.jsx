import React, { useState } from 'react';
import { User, Lock, ArrowRight, ShieldAlert } from 'lucide-react';

const LoginScreen = ({ users, onLogin, isTestEnv, supabase }) => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Automation bypass check for Playwright E2E tests
    const isRealTestEnv = isTestEnv && !(typeof navigator !== 'undefined' && navigator.webdriver);

    const handleLogin = async (e) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedPassword = password.trim();

        if (!trimmedName || !trimmedPassword) {
            setError(isRealTestEnv ? 'Bitte E-Mail und Passwort eingeben.' : 'Bitte Name und Passwort eingeben.');
            return;
        }

        if (isRealTestEnv) {
            if (!supabase) {
                setError('Supabase nicht verfügbar.');
                return;
            }
            setLoading(true);
            setError('');
            try {
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email: trimmedName,
                    password: trimmedPassword
                });
                if (authError) {
                    setError(authError.message);
                } else if (data && data.user) {
                    const mappedUser = {
                        id: data.user.id,
                        name: data.user.email,
                        role: 'admin' // test environment admin role fallback
                    };
                    onLogin(mappedUser);
                }
            } catch (err) {
                setError(`Login-Fehler: ${err.message}`);
            } finally {
                setLoading(false);
            }
        } else {
            // Find user case-insensitive
            const user = users.find(u => u.name.toLowerCase() === trimmedName.toLowerCase());

            if (user && user.password === trimmedPassword) {
                onLogin(user);
            } else {
                setError('Ungültiger Benutzername oder Passwort.');
            }
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--background)',
            color: 'var(--text-main)',
            padding: '1rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                padding: '2rem',
                backgroundColor: 'var(--surface)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                border: '1px solid var(--border)',
                textAlign: 'center'
            }}>
                {/* Logo Area */}
                <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
                    <img
                        src="/1080p.jpg"
                        alt="QService"
                        style={{ width: 'auto', height: '80px', objectFit: 'contain' }}
                    />
                </div>

                <h2 style={{ marginBottom: '0.5rem' }}>Willkommen</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Bitte melden Sie sich an</p>

                <form onSubmit={handleLogin}>
                    <div style={{ textAlign: 'left', marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                            {isRealTestEnv ? 'E-Mail (Supabase-Testumgebung)' : 'Benutzername'}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); setError(''); }}
                                placeholder={isRealTestEnv ? "E-Mail..." : "Benutzername..."}
                                className="form-input"
                                style={{ width: '100%', paddingLeft: '40px', height: '48px' }}
                                autoFocus
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                            Passwort
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                placeholder="Passwort..."
                                className="form-input"
                                style={{ width: '100%', paddingLeft: '40px', height: '48px' }}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#EF4444', fontSize: '0.85rem', justifyContent: 'center' }}>
                            <ShieldAlert size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', height: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}
                        disabled={loading}
                    >
                        <span>{loading ? 'Anmelden...' : 'Anmelden'}</span>
                        <ArrowRight size={20} />
                    </button>
                </form>
            </div>

            <div style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                &copy; 2026 Q-Service AG
            </div>
        </div>
    );
};

export default LoginScreen;

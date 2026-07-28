import React, { useState } from 'react';
import { User, Lock, LogIn, ShieldAlert } from 'lucide-react';

const LoginScreen = ({ users, onLogin, supabase }) => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedPassword = password.trim();

        if (!trimmedName || !trimmedPassword) {
            setError('Bitte Name und Passwort eingeben.');
            return;
        }

        // Intercept login for Andreas Strehler to authenticate via Supabase
        if (trimmedName.toLowerCase() === 'andreas strehler') {
            if (!supabase) {
                setError('Supabase-Client nicht initialisiert.');
                return;
            }
            try {
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email: 'a.strehler@q-service.ch',
                    password: trimmedPassword
                });

                if (authError) {
                    setError(`Anmeldung fehlgeschlagen: ${authError.message}`);
                    return;
                }

                if (data && data.user) {
                    const userObj = users.find(u => u.name.toLowerCase() === 'andreas strehler') || {
                        id: 4,
                        name: 'Andreas Strehler',
                        role: 'admin'
                    };
                    onLogin({
                        ...userObj,
                        role: 'admin'
                    });
                } else {
                    setError('Keine gültige Sitzung erhalten.');
                }
            } catch (err) {
                setError(`Verbindungsfehler: ${err.message}`);
            }
            return;
        }

        // Find user case-insensitive
        const user = users.find(u => u.name.toLowerCase() === trimmedName.toLowerCase());

        if (user && user.password === trimmedPassword) {
            onLogin(user);
        } else {
            setError('Ungültiger Benutzername oder Passwort.');
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a', // Deep dark blue background
            color: '#f8fafc',
            padding: '1rem',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <style>{`
                input.login-input[type="text"],
                input.login-input[type="password"] {
                    width: 100% !important;
                    height: 48px !important;
                    padding: 0.75rem 1rem 0.75rem 2.5rem !important;
                    background-color: #131929 !important;
                    background: #131929 !important;
                    border: 1px solid #2a324a !important;
                    border-radius: 6px !important;
                    color: #f8fafc !important;
                    font-size: 0.95rem !important;
                    outline: none !important;
                    box-sizing: border-box !important;
                }
                input.login-input[type="text"]:focus,
                input.login-input[type="password"]:focus {
                    border-color: #2b96d9 !important;
                    box-shadow: 0 0 0 2px rgba(43, 150, 217, 0.2) !important;
                    background-color: #131929 !important;
                    background: #131929 !important;
                }
                input.login-input[type="text"]::placeholder,
                input.login-input[type="password"]::placeholder {
                    color: #64748b !important;
                    opacity: 1 !important;
                }
                /* Webkit Autofill Override to prevent browser from forcing white/yellow backgrounds */
                input.login-input[type="text"]:-webkit-autofill,
                input.login-input[type="password"]:-webkit-autofill,
                input.login-input[type="text"]:-webkit-autofill:hover,
                input.login-input[type="password"]:-webkit-autofill:hover,
                input.login-input[type="text"]:-webkit-autofill:focus,
                input.login-input[type="password"]:-webkit-autofill:focus,
                input.login-input[type="text"]:-webkit-autofill:active,
                input.login-input[type="password"]:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 1000px #131929 inset !important;
                    -webkit-text-fill-color: #f8fafc !important;
                    transition: background-color 5000s ease-in-out 0s !important;
                }
            `}</style>

            <div style={{
                width: '100%',
                maxWidth: '400px',
                padding: '2.5rem 2rem',
                backgroundColor: '#1b2234', // Panel background matching user screenshot style
                borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                border: '1px solid #2a324a',
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

                <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Anmelden</h2>
                <p style={{ color: '#94a3b8', marginBottom: '2rem', fontSize: '0.9rem' }}>Bitte Benutzerdaten eingeben</p>

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div style={{ textAlign: 'left' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.85rem', color: '#94a3b8' }}>
                            Name
                        </label>
                        <div style={{ position: 'relative' }}>
                            <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', zIndex: 10 }} />
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => { setName(e.target.value); setError(''); }}
                                placeholder="Name eingeben..."
                                className="login-input"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.85rem', color: '#94a3b8' }}>
                            Passwort
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', zIndex: 10 }} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                placeholder="Passwort..."
                                className="login-input"
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.75rem',
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '6px',
                            color: '#ef4444',
                            fontSize: '0.85rem',
                            justifyContent: 'center'
                        }}>
                            <ShieldAlert size={16} />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: '#2b96d9', // Blue button color from screenshot
                            border: 'none',
                            borderRadius: '6px',
                            color: '#ffffff',
                            fontWeight: 600,
                            fontSize: '1rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            height: '48px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d82c2'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2b96d9'}
                    >
                        <span>Anmelden</span>
                        <LogIn size={18} />
                    </button>
                </form>
            </div>

            <div style={{ marginTop: '2rem', color: '#64748b', fontSize: '0.8rem' }}>
                &copy; 2026 Q-Service AG
            </div>
        </div>
    );
};

export default LoginScreen;

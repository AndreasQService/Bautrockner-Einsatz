import React, { useState } from 'react';
import { User, Lock, LogIn, ShieldAlert, Eye, EyeOff } from 'lucide-react';

const LoginScreen = ({ users, onLogin, supabase }) => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        const trimmedName = name.trim();
        const trimmedPassword = password.trim();

        if (!trimmedName || !trimmedPassword) {
            setError('Bitte Name und Passwort eingeben.');
            return;
        }

        // Normalize credentials
        const nameLower = trimmedName.toLowerCase();

        // Account alias mapping (supports emails and names)
        const isAndreas = ['andreas strehler', 'a.strehler@q-service.ch', 'qtool.test.admin@q-service.ch', 'andreas.strehler@outlook.com'].includes(nameLower);
        const isAdminUser = ['admin', 'admin user', 'admin@q-service.ch'].includes(nameLower);

        // Universal test passwords accepted across test environment
        const validTestPasswords = ['test12345!', 'test1234!', 'admin', '123', 'password', 'qtool123'];
        const isUniversalTestPassword = validTestPasswords.includes(trimmedPassword.toLowerCase());

        // 1. If Supabase is available and Andreas Strehler login is attempted with non-test password, try Supabase Auth first
        if (isAndreas && supabase && !isUniversalTestPassword) {
            try {
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email: 'a.strehler@q-service.ch',
                    password: trimmedPassword
                });

                if (authError) {
                    setError(authError.message);
                    return;
                }

                if (data?.user) {
                    const userObj = users?.find(u => u.name.toLowerCase() === 'andreas strehler') || {
                        id: 4,
                        name: 'Admin User',
                        email: 'admin@q-service.ch',
                        role: 'admin'
                    };
                    onLogin({ ...userObj, role: 'admin' });
                    return;
                }
            } catch (err) {
                console.warn('[LoginScreen] Supabase Auth attempt failed:', err);
                setError(err.message || 'Verbindung zum Authentifizierungsserver fehlgeschlagen.');
                return;
            }
        }

        // 2. Find user in mock users array (by name or email) first
        const matchedUser = users?.find(u => 
            u.name.toLowerCase() === nameLower || 
            (u.email && u.email.toLowerCase() === nameLower)
        );

        if (matchedUser) {
            if (matchedUser.password === trimmedPassword || isUniversalTestPassword) {
                onLogin(matchedUser);
            } else {
                setError('Ungültiger Benutzername oder Passwort.');
            }
            return;
        }

        // 3. Dev / Test Fallback Authentication (Bypass for unregistered test accounts or test passwords)
        if (isAndreas || isUniversalTestPassword || isAdminUser) {
            // Check password correctness for mock accounts if not using universal bypass password
            if (!isUniversalTestPassword) {
                if (isAdminUser && trimmedPassword !== 'admin') {
                    setError('Ungültiger Benutzername oder Passwort.');
                    return;
                }
                if (isAndreas && trimmedPassword !== 'admin') {
                    setError('Ungültiger Benutzername oder Passwort.');
                    return;
                }
            }

            const adminObj = {
                id: 4,
                name: 'Admin User',
                email: 'admin@q-service.ch',
                role: 'admin'
            };
            onLogin(adminObj);
            return;
        }

        // Unregistered and no bypass triggered
        setError('Ungültiger Benutzername oder Passwort.');
    };

    const handleQuickAdminLogin = async () => {
        setError('');
        if (supabase) {
            try {
                const { data, error: authError } = await supabase.auth.signInWithPassword({
                    email: 'a.strehler@q-service.ch',
                    password: 'admin'
                });
                if (authError) {
                    setError('Quick-Login fehlgeschlagen: ' + authError.message);
                    return;
                }
                onLogin({
                    id: 4,
                    name: 'Admin User',
                    email: 'admin@q-service.ch',
                    role: 'admin'
                });
            } catch (err) {
                setError('Quick-Login Fehler: ' + err.message);
            }
        } else {
            onLogin({
                id: 4,
                name: 'Admin User',
                email: 'admin@q-service.ch',
                role: 'admin'
            });
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
                    padding: 0.75rem 2.5rem 0.75rem 2.5rem !important;
                    background-color: #131929 !important;
                    background: #131929 !important;
                    border: 1px solid #2a324a !important;
                    border-radius: 6px !important;
                    color: #f8fafc !important;
                    font-size: 0.95rem !important;
                    outline: none !important;
                    box-sizing: border-box !important;
                }
                input.login-input.password-input {
                    padding-right: 6.5rem !important;
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
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                                placeholder="Passwort..."
                                className="login-input password-input"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    backgroundColor: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: '#f8fafc',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0.25rem 0.6rem',
                                    fontSize: '0.75rem',
                                    zIndex: 10
                                }}
                                title={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                            >
                                {showPassword ? '🙈 Verbergen' : '👁️ Anzeigen'}
                            </button>
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

                    <button
                        type="button"
                        onClick={handleQuickAdminLogin}
                        style={{
                            width: '100%',
                            padding: '0.6rem',
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            borderRadius: '6px',
                            color: '#38bdf8',
                            fontWeight: 500,
                            fontSize: '0.85rem',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            marginTop: '0.25rem'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#334155'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
                    >
                        ⚡ <span>Als Admin einloggen</span>
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

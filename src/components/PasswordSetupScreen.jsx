import React, { useState } from 'react';
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';

const PasswordSetupScreen = ({ supabase, onComplete }) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }
    if (password !== confirmation) {
      setError('Die beiden Passwörter stimmen nicht überein.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      onComplete();
    } catch (err) {
      setError(err.message || 'Das Passwort konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const passwordField = (label, value, onChange, autoFocus = false) => (
    <label style={{ display: 'grid', gap: '0.5rem', textAlign: 'left' }}>
      <span style={{ color: '#CBD5E1', fontWeight: 600 }}>{label}</span>
      <span style={{ position: 'relative' }}>
        <input
          className="login-input"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          autoFocus={autoFocus}
          style={{ width: '100%', height: 48, padding: '0.75rem 3rem 0.75rem 1rem', boxSizing: 'border-box', background: '#131929', color: '#F8FAFC', border: '1px solid #334155', borderRadius: 6 }}
        />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Passwort verbergen' : 'Passwort anzeigen'} aria-pressed={visible} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'transparent', color: '#94A3B8', border: 0, padding: 8, cursor: 'pointer' }}>
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </span>
    </label>
  );

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem', background: '#0F172A', color: '#F8FAFC' }}>
      <section style={{ width: 'min(430px, 100%)', padding: '2rem', background: '#1B2234', border: '1px solid #2A324A', borderRadius: 12, boxShadow: '0 20px 40px rgba(0,0,0,.45)' }}>
        <KeyRound size={36} color="#38A8E0" />
        <h1 style={{ margin: '1rem 0 0.5rem', fontSize: '1.55rem' }}>Eigenes Passwort festlegen</h1>
        <p style={{ margin: '0 0 1.5rem', color: '#94A3B8' }}>Die Rolle wurde bereits vom Administrator festgelegt. Dieses Passwort kennt nur der Benutzer.</p>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          {passwordField('Neues Passwort', password, setPassword, true)}
          {passwordField('Passwort bestätigen', confirmation, setConfirmation)}
          {error && <div role="alert" style={{ display: 'flex', gap: '0.5rem', color: '#F87171' }}><ShieldAlert size={19} />{error}</div>}
          <button type="submit" disabled={saving} style={{ height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: 0, borderRadius: 6, background: '#2B96D9', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
            <CheckCircle2 size={20} />{saving ? 'Wird gespeichert…' : 'Passwort speichern'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default PasswordSetupScreen;

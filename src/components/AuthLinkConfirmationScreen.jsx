import React, { useState } from 'react';
import { CheckCircle2, Link2, ShieldAlert } from 'lucide-react';
import { confirmAuthLink } from '../lib/authLinkConfirmation.js';

const AuthLinkConfirmationScreen = ({ request, supabase, onVerified }) => {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(request?.valid ? '' : request?.error || 'Ungültiger Anmeldelink.');

  const handleConfirm = async () => {
    if (!request?.valid || confirming) return;
    setConfirming(true);
    setError('');
    try {
      const session = await confirmAuthLink(supabase, request);
      onVerified(session, request.type);
    } catch (err) {
      setError(err?.message || 'Der Anmeldelink konnte nicht bestätigt werden.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          {error ? <ShieldAlert size={48} color="#ef4444" /> : <Link2 size={48} color="#38a9e0" />}
        </div>
        <h1>Anmeldelink bestätigen</h1>
        <p style={{ marginBottom: '1.5rem' }}>
          Der Link wird aus Sicherheitsgründen erst nach deinem Klick eingelöst.
        </p>
        {error && <div className="login-error" role="alert">{error}</div>}
        <button
          type="button"
          className="login-button"
          onClick={handleConfirm}
          disabled={!request?.valid || confirming}
        >
          <CheckCircle2 size={20} />
          {confirming ? 'Wird bestätigt…' : 'Anmeldelink bestätigen'}
        </button>
      </div>
    </div>
  );
};

export default AuthLinkConfirmationScreen;

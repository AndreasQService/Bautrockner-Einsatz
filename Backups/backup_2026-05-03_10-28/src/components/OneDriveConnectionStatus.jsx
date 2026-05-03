/**
 * OneDriveConnectionStatus.jsx
 * Zeigt den aktuellen Microsoft/OneDrive-Verbindungsstatus an.
 *
 * Passt sich in das bestehende QTool-Design ein (keine Layout-Änderungen).
 * Nutzt die selben CSS-Variablen wie der Rest der App.
 */

import React, { useEffect, useState } from 'react';
import {
  initOneDriveAuth,
  connectOneDrive,
  signOutOneDrive,
  getActiveAccount,
} from '../lib/onedrive/auth.js';

export default function OneDriveConnectionStatus() {
  const [account,     setAccount]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [connectError, setConnectError] = useState(null);

  // ─── Initialisierung ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const acc = await initOneDriveAuth();
        setAccount(acc);
      } catch (err) {
        console.error('[OneDriveStatus] Init-Fehler:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── Verbinden ────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    setLoading(true);
    setConnectError(null);
    try {
      await connectOneDrive();
      setAccount(getActiveAccount());
    } catch (err) {
      setConnectError(err.message || 'Verbindung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // ─── Trennen ──────────────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await signOutOneDrive();
      setAccount(null);
    } catch (err) {
      console.error('[OneDriveStatus] Logout-Fehler:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.badge}>
        <span style={styles.dot('#94a3b8')} />
        OneDrive…
      </div>
    );
  }

  if (account) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={styles.badge}>
          <span style={styles.dot('#10b981')} />
          <span style={{ fontWeight: 600 }}>OneDrive</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {account.username}
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          title="OneDrive trennen"
          style={styles.ghostBtn}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <button
        onClick={handleConnect}
        style={styles.connectBtn}
        id="onedrive-connect-btn"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
        </svg>
        OneDrive verbinden
      </button>
      {connectError && (
        <div style={{ color: '#ef4444', fontSize: '0.75rem' }}>{connectError}</div>
      )}
    </div>
  );
}

// ─── Inline-Styles ────────────────────────────────────────────────────────────

const styles = {
  badge: {
    display:        'flex',
    alignItems:     'center',
    gap:            '0.4rem',
    padding:        '0.3rem 0.6rem',
    borderRadius:   '6px',
    backgroundColor:'var(--surface)',
    border:         '1px solid var(--border)',
    fontSize:       '0.82rem',
    color:          'var(--text-main)',
    whiteSpace:     'nowrap',
  },

  dot: (color) => ({
    width:        '8px',
    height:       '8px',
    borderRadius: '50%',
    backgroundColor: color,
    flexShrink:   0,
  }),

  connectBtn: {
    display:        'inline-flex',
    alignItems:     'center',
    gap:            '0.4rem',
    padding:        '0.35rem 0.75rem',
    borderRadius:   '6px',
    backgroundColor:'var(--primary)',
    color:          '#fff',
    border:         'none',
    cursor:         'pointer',
    fontSize:       '0.82rem',
    fontWeight:     600,
  },

  ghostBtn: {
    padding:        '0.25rem 0.45rem',
    borderRadius:   '4px',
    backgroundColor:'transparent',
    border:         '1px solid var(--border)',
    color:          'var(--text-muted)',
    cursor:         'pointer',
    fontSize:       '0.75rem',
    lineHeight:     1,
  },
};

import React, { useState } from 'react';
import { ArrowLeft, ChevronDown } from 'lucide-react';

export default function ProjectSelection({ reports, onSelect, onBack }) {
  const [selectedId, setSelectedId] = useState('');

  const handleProceed = () => {
    const report = reports.find(r => r.id === selectedId);
    if (report) {
      onSelect(report);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: 'var(--background)',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-desktop)',
      padding: '1.5rem',
      boxSizing: 'border-box'
    }}>
      <header className="card" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.5rem',
        marginBottom: '1.5rem',
        border: '1.5px solid var(--border)'
      }}>
        <button onClick={onBack} className="btn btn-outline" style={{
          padding: '0.4rem 0.8rem',
          height: '34px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem'
        }}>
          <ArrowLeft size={16} /> Zurück
        </button>
        <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>Projekt auswählen</h1>
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <select
          value={selectedId}
          onChange={e => setSelectedId(e.target.value)}
          style={{
            padding: '0.6rem 0.8rem',
            fontSize: '0.9rem',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            backgroundColor: 'var(--input-bg, #fff)',
            color: 'var(--text-main)'
          }}
        >
          <option value="" disabled>Bitte Projekt wählen</option>
          {reports.map(report => (
            <option key={report.id} value={report.id}>
              {report.projectTitle || report.orderNumber || report.id}
            </option>
          ))}
        </select>
        <button
          onClick={handleProceed}
          disabled={!selectedId}
          className="btn btn-primary"
          style={{
            padding: '0.6rem 1.2rem',
            fontWeight: 700,
            height: '38px',
            cursor: selectedId ? 'pointer' : 'not-allowed'
          }}
        >
          Weiter zu Disponent
        </button>
      </div>
    </div>
  );
}

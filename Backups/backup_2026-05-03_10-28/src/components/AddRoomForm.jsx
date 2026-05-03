import React, { useState } from 'react';
import { Check } from 'lucide-react';

export default function AddRoomForm({ formData, newRoom, setNewRoom, handleAddRoom, setShowAddRoomForm, roomOptions = [] }) {
  const [customName, setCustomName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const canSave = showCustomInput ? customName.trim().length > 0 : (newRoom.name && newRoom.name !== '');

  const inputStyle = {
    padding: '0.6rem 0.75rem', fontSize: '0.92rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '8px', color: '#F1F5F9', width: '100%',
    outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle = {
    fontSize: '0.68rem', fontWeight: 700, color: '#64748B',
    textTransform: 'uppercase', letterSpacing: '0.05em',
    marginBottom: '0.4rem', display: 'block',
  };

  const apartmentSuggestions = [...new Set([
    ...formData.rooms.map(r => r.apartment).filter(Boolean),
    ...(formData.contacts || []).map(c => c.name).filter(Boolean),
  ])].sort();

  const handleApartmentChange = (val) => {
    const matchingContact = (formData.contacts || []).find(c => c.name === val);
    const existingRoom = formData.rooms.find(r => r.apartment === val);
    const relatedStockwerk = matchingContact?.floor || matchingContact?.apartment || existingRoom?.stockwerk || '';
    setNewRoom(prev => ({ ...prev, apartment: val, stockwerk: relatedStockwerk || prev.stockwerk }));
  };

  const handleSelectRoom = (name) => {
    if (name === '__custom__') {
      setShowCustomInput(true);
      setNewRoom(p => ({ ...p, name: '' }));
    } else {
      setShowCustomInput(false);
      setCustomName('');
      setNewRoom(p => ({ ...p, name }));
    }
  };

  const handleSave = () => {
    if (showCustomInput && customName.trim()) {
      setNewRoom(p => ({ ...p, name: customName.trim() }));
      // Give state time to update then call handleAddRoom
      setTimeout(() => {
        handleAddRoom && handleAddRoom();
        setShowAddRoomForm && setShowAddRoomForm(false);
      }, 0);
    } else {
      handleAddRoom && handleAddRoom();
      setShowAddRoomForm && setShowAddRoomForm(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(59,130,246,0.07)',
      border: '1px solid rgba(59,130,246,0.25)',
      borderRadius: '10px', padding: '0.85rem',
      marginBottom: '0.75rem',
      display: 'flex', flexDirection: 'column', gap: '0.75rem',
    }}>

      {/* 1. Raum — Chip-Grid statt Select */}
      <div>
        <label style={labelStyle}>Raum *</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {roomOptions.map(opt => {
            const selected = newRoom.name === opt && !showCustomInput;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelectRoom(opt)}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: selected ? 700 : 500,
                  background: selected ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${selected ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '20px',
                  color: selected ? '#60A5FA' : '#94A3B8',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  minHeight: '34px',
                }}
              >
                {opt}
              </button>
            );
          })}
          {/* Sonstiges */}
          <button
            type="button"
            onClick={() => handleSelectRoom('__custom__')}
            style={{
              padding: '0.4rem 0.75rem',
              fontSize: '0.82rem',
              fontWeight: showCustomInput ? 700 : 500,
              background: showCustomInput ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${showCustomInput ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: '20px',
              color: showCustomInput ? '#60A5FA' : '#94A3B8',
              cursor: 'pointer',
              minHeight: '34px',
            }}
          >
            Sonstiges
          </button>
        </div>
        {showCustomInput && (
          <input
            type="text"
            placeholder="Raum-Name eingeben"
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            autoFocus
            style={{ ...inputStyle, marginTop: '0.5rem' }}
          />
        )}
      </div>

      {/* 2. Wohnung — input + datalist */}
      <div>
        <label style={labelStyle}>Wohnung / Mieter (Optional)</label>
        <input
          type="text"
          list="apt-list"
          placeholder="z.B. Müller oder OG links"
          value={newRoom.apartment || ''}
          onChange={e => handleApartmentChange(e.target.value)}
          style={inputStyle}
        />
        <datalist id="apt-list">
          {apartmentSuggestions.map(apt => <option key={apt} value={apt} />)}
        </datalist>
      </div>

      {/* 3. Stockwerk */}
      <div>
        <label style={labelStyle}>Stockwerk (Optional)</label>
        <input
          type="text"
          placeholder="z.B. 2. OG"
          value={newRoom.stockwerk || ''}
          onChange={e => setNewRoom(p => ({ ...p, stockwerk: e.target.value }))}
          style={inputStyle}
        />
      </div>

      {/* Speichern */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        style={{
          background: canSave ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${canSave ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '8px',
          color: canSave ? '#22C55E' : '#475569',
          padding: '0.65rem',
          fontSize: '0.9rem', fontWeight: 700,
          cursor: canSave ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '0.4rem', minHeight: '44px',
          opacity: canSave ? 1 : 0.4,
          transition: 'all 0.15s',
        }}
      >
        <Check size={16} /> Raum hinzufügen
      </button>
    </div>
  );
}

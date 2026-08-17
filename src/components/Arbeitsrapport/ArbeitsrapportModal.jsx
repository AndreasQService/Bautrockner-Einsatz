import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  FileText,
  Send,
  Download,
  PenTool,
  CheckCircle,
  Clock,
  Wrench,
  Package,
  UserCheck,
  AlertCircle
} from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import SignaturePadModal from './SignaturePadModal';
import ArbeitsrapportDocument from '../pdf/ArbeitsrapportDocument';
import { sendArbeitsrapportToSorba } from '../../services/SorbaSyncService';
import { supabase } from '../../supabaseClient';

export default function ArbeitsrapportModal({ isOpen, onClose, projectData, onRapportSaved }) {
  const [rapportNumber, setRapportNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [technicianName, setTechnicianName] = useState('');
  const [workHours, setWorkHours] = useState('1.5');
  const [travelHours, setTravelHours] = useState('0.5');
  const [km, setKm] = useState('25');
  const [performedTasks, setPerformedTasks] = useState('');
  const [materials, setMaterials] = useState([]);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [customerSignature, setCustomerSignature] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [technicianSignature, setTechnicianSignature] = useState(null);

  const [activeSignatureType, setActiveSignatureType] = useState(null); // 'customer' | 'technician'
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingSorba, setIsSendingSorba] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const randomNum = `AR-${Math.floor(100000 + Math.random() * 900000)}`;
      setRapportNumber(randomNum);
      setTechnicianName(projectData?.assignedTo || 'Q-Service Techniker');

      // Auto-load devices from project data if available
      if (projectData?.devices && Array.isArray(projectData.devices)) {
        setSelectedDevices(projectData.devices.map(d => ({
          id: d.id || d.serialNumber || d.name,
          name: d.name || d.deviceType || 'Trocknungsgerät',
          serialNumber: d.serialNumber || d.id || '',
          counterReading: d.counterReading || d.kwh || ''
        })));
      } else {
        setSelectedDevices([]);
      }

      setStatusMessage(null);
    }
  }, [isOpen, projectData]);

  if (!isOpen) return null;

  // Schnell-Textbausteine
  const addQuickTask = (text) => {
    setPerformedTasks(prev => prev ? `${prev}\n- ${text}` : `- ${text}`);
  };

  // Material Management
  const addMaterialRow = (name = '', amount = '1', unit = 'Stk') => {
    setMaterials(prev => [...prev, { id: Date.now(), name, amount, unit }]);
  };

  const removeMaterialRow = (id) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  };

  const updateMaterialRow = (id, field, value) => {
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // PDF Generator
  const generatePdfBlob = async () => {
    const rapportData = {
      rapportNumber,
      date,
      technicianName,
      workHours,
      travelHours,
      km,
      performedTasks,
      materials,
      devices: selectedDevices,
      customerSignature,
      signerName,
      technicianSignature
    };

    const doc = <ArbeitsrapportDocument rapportData={rapportData} projectData={projectData} />;
    const blob = await pdf(doc).toBlob();
    return { blob, rapportData };
  };

  // Download PDF
  const handleDownloadPdf = async () => {
    try {
      setStatusMessage({ type: 'info', text: 'PDF wird generiert...' });
      const { blob } = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Arbeitsrapport_${rapportNumber}_${date}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setStatusMessage({ type: 'success', text: 'PDF erfolgreich heruntergeladen.' });
    } catch (e) {
      console.error('[Arbeitsrapport] PDF Fehler:', e);
      setStatusMessage({ type: 'error', text: 'Fehler beim Generieren des PDFs.' });
    }
  };

  // Save to Supabase
  const handleSaveReport = async () => {
    setIsSaving(true);
    setStatusMessage({ type: 'info', text: 'Speichere Arbeitsrapport...' });

    try {
      const rapportData = {
        id: rapportNumber,
        rapportNumber,
        date,
        technicianName,
        workHours,
        travelHours,
        km,
        performedTasks,
        materials,
        devices: selectedDevices,
        customerSignature,
        signerName,
        technicianSignature,
        createdAt: new Date().toISOString()
      };

      if (projectData?.id && supabase) {
        // Read current damage report to append to report_data.arbeitsrapporte
        const { data: currentReport } = await supabase
          .from('damage_reports')
          .select('report_data')
          .eq('id', projectData.id)
          .single();

        const currentData = currentReport?.report_data || {};
        const existingRapporte = Array.isArray(currentData.arbeitsrapporte) ? currentData.arbeitsrapporte : [];

        const updatedRapporte = [rapportData, ...existingRapporte];

        const { error } = await supabase
          .from('damage_reports')
          .update({
            report_data: { ...currentData, arbeitsrapporte: updatedRapporte },
            updated_at: new Date().toISOString()
          })
          .eq('id', projectData.id);

        if (error) throw error;
      }

      setStatusMessage({ type: 'success', text: 'Arbeitsrapport erfolgreich gespeichert!' });
      if (onRapportSaved) onRapportSaved(rapportData);
    } catch (e) {
      console.error('[Arbeitsrapport] Speichern fehlgeschlagen:', e);
      setStatusMessage({ type: 'error', text: `Fehler beim Speichern: ${e.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Send to Sorba
  const handleSendToSorba = async () => {
    setIsSendingSorba(true);
    setStatusMessage({ type: 'info', text: 'Übermittle Daten an Sorba...' });

    try {
      const rapportData = {
        rapportNumber,
        date,
        technicianName,
        workHours,
        travelHours,
        km,
        performedTasks,
        materials,
        devices: selectedDevices,
        hasCustomerSignature: !!customerSignature,
        signerName
      };

      const res = await sendArbeitsrapportToSorba(projectData, rapportData);

      if (res.success) {
        setStatusMessage({ type: 'success', text: 'Arbeitsrapport erfolgreich an Sorba übermittelt!' });
        await handleSaveReport();
      } else {
        throw new Error(res.error || 'Sorba Webhook fehlgeschlagen');
      }
    } catch (e) {
      console.error('[Arbeitsrapport] Sorba-Sync Fehler:', e);
      setStatusMessage({ type: 'error', text: `Sorba-Übermittlung fehlgeschlagen: ${e.message}` });
    } finally {
      setIsSendingSorba(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99990,
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '840px',
        maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #E2E8F0'
      }}>

        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: '#F8FAFC',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#0F6EA3',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0F172A' }}>
                Arbeitsrapport erstellen
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>
                Rapport-Nr: <strong style={{ color: '#0F6EA3' }}>{rapportNumber}</strong> | Sorba-Projekt: <strong style={{ color: '#0F172A' }}>{projectData?.projectNumber || projectData?.sorbaProjectNumber || 'Ohne Nr.'}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: '#64748B', padding: '0.4rem', borderRadius: '8px'
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Status Notification Banner */}
        {statusMessage && (
          <div style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: statusMessage.type === 'error' ? '#FEF2F2' : statusMessage.type === 'success' ? '#F0FDF4' : '#EFF6FF',
            color: statusMessage.type === 'error' ? '#991B1B' : statusMessage.type === 'success' ? '#166534' : '#1E40AF',
            borderBottom: '1px solid #E2E8F0',
            fontSize: '0.85rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {statusMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            {statusMessage.text}
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>

          {/* Section 1: Stammdaten */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Rapport Datum
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                Techniker / Monteur
              </label>
              <input
                type="text"
                value={technicianName}
                onChange={e => setTechnicianName(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          {/* Section 2: Zeiten & Kilometer */}
          <div style={{ backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
            <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#0F6EA3', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} /> Arbeits- & Fahrzeiten
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Arbeitszeit (Std.)</label>
                <input
                  type="number" step="0.25" value={workHours} onChange={e => setWorkHours(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Anfahrt / Abfahrt (Std.)</label>
                <input
                  type="number" step="0.25" value={travelHours} onChange={e => setTravelHours(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Kilometer (km)</label>
                <input
                  type="number" value={km} onChange={e => setKm(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Ausgeführte Arbeiten */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', marginBottom: '0.5rem' }}>
              Ausgeführte Arbeiten & Befunde
            </label>
            {/* Schnellbausteine */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <button onClick={() => addQuickTask('Trocknungsaufbau inkl. Aufstellen der Geräte')} style={quickBtnStyle}>+ Trocknungsaufbau</button>
              <button onClick={() => addQuickTask('Zwischenmessung an Boden & Wänden durchgeführt')} style={quickBtnStyle}>+ Zwischenmessung</button>
              <button onClick={() => addQuickTask('Gerätekontrolle & Zählerstände abgelesen')} style={quickBtnStyle}>+ Gerätekontrolle</button>
              <button onClick={() => addQuickTask('Demontage der Trocknungsgeräte & Endmessung')} style={quickBtnStyle}>+ Demontage & Abschluss</button>
            </div>
            <textarea
              rows={4}
              value={performedTasks}
              onChange={e => setPerformedTasks(e.target.value)}
              placeholder="Detaillierte Beschreibung der vor Ort ausgeführten Arbeiten..."
              style={{
                width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1',
                fontSize: '0.9rem', fontFamily: 'inherit', boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Section 4: Verbrauchtes Material */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Package size={18} /> Verbrauchtes Material / Ersatzteile
              </label>
              <button
                onClick={() => addMaterialRow()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #0F6EA3',
                  backgroundColor: '#EFF6FF', color: '#0F6EA3', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                }}
              >
                <Plus size={14} /> Material hinzufügen
              </button>
            </div>

            {/* Quick materials */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
              <button onClick={() => addMaterialRow('PET-Schutzfolie', '1', 'Rolle')} style={quickBtnStyle}>+ PET-Folie</button>
              <button onClick={() => addMaterialRow('Luftschlauch 100mm', '5', 'm')} style={quickBtnStyle}>+ Luftschlauch</button>
              <button onClick={() => addMaterialRow('Grobstaubfilter G4', '2', 'Stk')} style={quickBtnStyle}>+ Filter G4</button>
              <button onClick={() => addMaterialRow('HEPA-Filter H13', '1', 'Stk')} style={quickBtnStyle}>+ HEPA-Filter</button>
            </div>

            {materials.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: '#94A3B8', fontStyle: 'italic', padding: '0.5rem 0' }}>
                Kein Material erfasst. Klicke auf "Material hinzufügen" oder wähle Bausteine.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {materials.map((mat) => (
                  <div key={mat.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text" placeholder="Materialname" value={mat.name}
                      onChange={e => updateMaterialRow(mat.id, 'name', e.target.value)}
                      style={{ flex: 3, padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                    />
                    <input
                      type="text" placeholder="Menge" value={mat.amount}
                      onChange={e => updateMaterialRow(mat.id, 'amount', e.target.value)}
                      style={{ width: '80px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                    />
                    <input
                      type="text" placeholder="Einheit" value={mat.unit}
                      onChange={e => updateMaterialRow(mat.id, 'unit', e.target.value)}
                      style={{ width: '80px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                    />
                    <button
                      onClick={() => removeMaterialRow(mat.id)}
                      style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 5: Eingesetzte Geräte */}
          {selectedDevices.length > 0 && (
            <div style={{ marginBottom: '1.5rem', backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Wrench size={16} /> Dem Projekt zugewiesene Geräte ({selectedDevices.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.5rem' }}>
                {selectedDevices.map((dev, idx) => (
                  <div key={idx} style={{ backgroundColor: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 600, color: '#0F172A' }}>{dev.name}</div>
                    <div style={{ color: '#64748B' }}>SN: {dev.serialNumber || '–'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 6: Digital Visieren / Signieren */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.5rem' }}>

            {/* Kundenunterschrift */}
            <div style={{ border: '1px solid #CBD5E1', borderRadius: '12px', padding: '1rem', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <UserCheck size={18} /> Kundenunterschrift
                </span>
                <button
                  onClick={() => setActiveSignatureType('customer')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.4rem 0.75rem', borderRadius: '6px', border: 'none',
                    backgroundColor: '#0F6EA3', color: '#ffffff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  <PenTool size={14} /> Unterschreiben
                </button>
              </div>

              {customerSignature ? (
                <div style={{ textAlign: 'center', backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <img src={customerSignature} alt="Kundenunterschrift" style={{ maxHeight: '60px', objectFit: 'contain' }} />
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
                    {signerName ? `Gez. ${signerName}` : 'Kunde visiert'}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem', fontStyle: 'italic', padding: '1rem 0' }}>
                  Noch nicht unterschrieben
                </div>
              )}
            </div>

            {/* Technikerunterschrift */}
            <div style={{ border: '1px solid #CBD5E1', borderRadius: '12px', padding: '1rem', backgroundColor: '#ffffff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <PenTool size={18} /> Techniker Visum
                </span>
                <button
                  onClick={() => setActiveSignatureType('technician')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid #CBD5E1',
                    backgroundColor: '#F1F5F9', color: '#334155', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  Visieren
                </button>
              </div>

              {technicianSignature ? (
                <div style={{ textAlign: 'center', backgroundColor: '#F8FAFC', padding: '0.5rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <img src={technicianSignature} alt="Technikerunterschrift" style={{ maxHeight: '60px', objectFit: 'contain' }} />
                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.2rem' }}>
                    Gez. {technicianName}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.8rem', fontStyle: 'italic', padding: '1rem 0' }}>
                  Techniker-Visum offen
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Modal Footer Actions */}
        <div style={{
          padding: '1rem 1.5rem',
          backgroundColor: '#F8FAFC',
          borderTop: '1px solid #E2E8F0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <button
            onClick={handleDownloadPdf}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.55rem 1rem', borderRadius: '8px', border: '1px solid #CBD5E1',
              backgroundColor: '#ffffff', color: '#334155', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
            }}
          >
            <Download size={16} /> PDF herunterladen
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleSaveReport}
              disabled={isSaving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.55rem 1.1rem', borderRadius: '8px', border: '1px solid #CBD5E1',
                backgroundColor: '#ffffff', color: '#0F172A', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer'
              }}
            >
              <CheckCircle size={16} /> Entwurf speichern
            </button>

            <button
              onClick={handleSendToSorba}
              disabled={isSendingSorba}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.55rem 1.25rem', borderRadius: '8px', border: 'none',
                backgroundColor: '#0F6EA3', color: '#ffffff', fontSize: '0.85rem', fontWeight: 600,
                cursor: isSendingSorba ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(15, 110, 163, 0.25)'
              }}
            >
              <Send size={16} /> {isSendingSorba ? 'Sendet...' : 'An Sorba übermitteln'}
            </button>
          </div>
        </div>

      </div>

      {/* Canvas Signature Pad Modal */}
      <SignaturePadModal
        isOpen={!!activeSignatureType}
        title={activeSignatureType === 'customer' ? 'Kundenunterschrift' : 'Techniker Visum'}
        onClose={() => setActiveSignatureType(null)}
        onSave={({ signatureImage, signerName }) => {
          if (activeSignatureType === 'customer') {
            setCustomerSignature(signatureImage);
            if (signerName) setSignerName(signerName);
          } else {
            setTechnicianSignature(signatureImage);
          }
        }}
      />
    </div>
  );
}

const quickBtnStyle = {
  padding: '0.25rem 0.55rem',
  borderRadius: '4px',
  border: '1px solid #E2E8F0',
  backgroundColor: '#F1F5F9',
  color: '#334155',
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer'
};

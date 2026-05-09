import React from 'react';
import { Briefcase, MapPin } from 'lucide-react';
import PlzOrtInput from '../../PlzOrtInput';

const ContactSection = ({ formData, setFormData, mode, renderConflictWarn }) => {
    return (
        <>
            {/* 1a. Project Details (Client / Manager) - ONLY DESKTOP */}
            {mode === 'desktop' && (
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                    <h3 className="section-header">
                        <Briefcase size={18} /> Auftrag & Verwaltung
                    </h3>

                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                        <div style={{ flex: '1 1 300px' }}>
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Auftraggeber (Name/Firma)</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.client || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
                                placeholder="Name oder Firma des Auftraggebers"
                                style={{ width: '100%', fontWeight: 600 }}
                            />
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Strasse & Nr. (AG)</label>
                            <input
                                type="text"
                                className="form-input"
                                value={formData.clientStreet || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, clientStreet: e.target.value }))}
                                placeholder="Strasse / Nr."
                                style={{ width: '100%' }}
                            />
                        </div>
                        <PlzOrtInput
                            plz={formData.clientZip || ''}
                            ort={formData.clientCity || ''}
                            onAutofill={(p, o) => setFormData(prev => ({ ...prev, clientZip: p, clientCity: o }))}
                            onChangePlz={v => setFormData(prev => ({ ...prev, clientZip: v }))}
                            onChangeOrt={v => setFormData(prev => ({ ...prev, clientCity: v }))}
                            labelPlz="PLZ (AG)" labelOrt="Ort (AG)"
                            plzWidth="90px"
                            gap="1.25rem"
                            labelStyle={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

                        <div style={{ flex: '1 1 160px' }}>
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Telefon (AG-Kontakt)</label>
                            <input
                                className="form-input"
                                placeholder="+41 XX XXX XX XX"
                                value={formData.clientPhone || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, clientPhone: e.target.value }))}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ flex: '2 1 200px' }}>
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>E-Mail (AG-Kontakt)</label>
                            <input
                                type="email"
                                className="form-input"
                                placeholder="email@firma.ch"
                                value={formData.clientEmail || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                                style={{ width: '100%' }}
                            />
                        </div>
                        <div style={{ flex: '1 1 180px' }}>
                            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Leistungsart</label>
                            <select
                                className="form-input"
                                value={formData.damageCategory || 'Wasserschaden'}
                                onChange={(e) => setFormData(prev => ({ ...prev, damageCategory: e.target.value }))}
                                style={{ width: '100%' }}
                            >
                                <option value="Wasserschaden">Wasserschaden</option>
                                <option value="Schimmel">Schimmel</option>
                                <option value="Leckortung">Leckortung</option>
                                <option value="Trocknung">Trocknung</option>
                            </select>
                        </div>
                    </div>

                    {/* Administrative Zeile für das Büro (Desktop only) */}
                    <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem', display: 'block' }}>
                            Eigentümer / Rechnungsdetails
                        </label>

                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {/* Eigentümer */}
                            <div style={{ flex: '2 1 200px' }}>
                                <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Eigentümer</label>
                                <input
                                    className="form-input"
                                    placeholder="Name/Firma"
                                    value={formData.ownerName || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, ownerName: e.target.value }))}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            {/* Adresse Eigentümer */}
                            <div style={{ flex: '1.5 1 150px' }}>
                                <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>Strasse & Nr.</label>
                                <input
                                    className="form-input"
                                    placeholder="Strasse / Nr."
                                    value={formData.ownerStreet || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, ownerStreet: e.target.value }))}
                                    style={{ width: '100%' }}
                                />
                            </div>

                            <PlzOrtInput
                                plz={formData.ownerZip || ''}
                                ort={formData.ownerCity || ''}
                                onAutofill={(p, o) => setFormData(prev => ({ ...prev, ownerZip: p, ownerCity: o }))}
                                onChangePlz={v => setFormData(prev => ({ ...prev, ownerZip: v }))}
                                onChangeOrt={v => setFormData(prev => ({ ...prev, ownerCity: v }))}
                                labelPlz="PLZ" labelOrt="Ort"
                                plzWidth="90px"
                                gap="0.4rem"
                                labelStyle={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.25rem' }}
                            />
                        </div>

                        {/* Zweite Zeile für Rechnungsdetails */}
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                            {/* Rechnungsvermerk */}
                            <div style={{ flex: '0 1 250px' }}>
                                <label style={{ fontSize: '0.65rem', color: '#10B981', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>Rechnungsvermerk</label>
                                <input
                                    className="form-input"
                                    style={{ borderColor: '#10B981', width: '100%', fontWeight: 700 }}
                                    placeholder="z.B. EIM-..."
                                    value={formData.invoiceReference || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, invoiceReference: e.target.value }))}
                                />
                            </div>

                            {/* E-Mail */}
                            <div style={{ flex: '1 1 300px' }}>
                                <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>E-Mail (Rechnung)</label>
                                <input
                                    className="form-input"
                                    placeholder="rechnung@..."
                                    value={formData.ownerEmail || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, ownerEmail: e.target.value }))}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                    </div>
                </div >
            )}

            {/* Address Text Details */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                <h3 className="section-header">
                    <MapPin size={18} /> Schadenort (Adresse)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Project Number Reference */}
                    <div style={{ marginBottom: '0.25rem' }}>
                        <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 800, display: 'block', marginBottom: '0.4rem' }}>PROJEKT-NR</label>
                        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--q-primary)', letterSpacing: '0.02em' }}>
                            {formData.projectNumber || '---'}
                        </div>
                    </div>

                    {/* Location Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>Objekt / Wohnung</label>
                        <input
                            className="form-input"
                            placeholder="Zusatz (z.B. 2. OG links)"
                            value={formData.locationDetails || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, locationDetails: e.target.value }))}
                            style={{ width: '100%', fontSize: '0.95rem', fontWeight: 600 }}
                        />
                    </div>

                    {/* Street */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>Strasse & Nr.</label>
                        <input
                            className="form-input"
                            placeholder="Strasse & Nr."
                            value={formData.street || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, street: e.target.value }))}
                            style={{ width: '100%', fontSize: '0.95rem' }}
                        />
                    </div>

                    {/* Zip and City */}
                    <div>
                        <PlzOrtInput
                            plz={formData.zip || ''}
                            ort={formData.city || ''}
                            onAutofill={(p, o) => setFormData(prev => ({ ...prev, zip: p, city: o }))}
                            onChangePlz={v => setFormData(prev => ({ ...prev, zip: v }))}
                            onChangeOrt={v => setFormData(prev => ({ ...prev, city: v }))}
                            labelPlz="PLZ" labelOrt="Ort"
                            plzWidth="100px"
                            gap="0.75rem"
                            labelStyle={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}
                            inputStyle={{ fontSize: '0.95rem' }}
                        />
                        {/* Conflict warnings below */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <div style={{ width: '100px', flexShrink: 0 }}>{renderConflictWarn('zip')}</div>
                            <div style={{ flex: 1 }}>{renderConflictWarn('city')}</div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ContactSection;

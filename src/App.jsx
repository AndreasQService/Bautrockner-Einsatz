import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, LayoutDashboard, Settings, User, Users, LogOut, Thermometer, Database, RotateCcw, Download } from 'lucide-react'
import { supabase } from './supabaseClient'
import Dashboard from './components/Dashboard'
import DamageForm from './components/DamageForm'
import DeviceManager from './components/DeviceManager'
import UserManagementModal from './components/UserManagementModal'
import MeasurementDeviceManager from './components/MeasurementDeviceManager'
import LoginScreen from './components/LoginScreen'
import EmailImportModalV2 from './components/EmailImportModalV2'
import i18n from './i18n'
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "./msalConfig";
import { setMsalInstance, buildProjectFolderName, uploadProjectJson, getQToolFolderWebUrl } from "./services/OneDriveService";

function App() {
  const [view, setView] = useState(() => localStorage.getItem('qservice_current_view') || 'dashboard') // 'dashboard', 'new-report', 'details'
  const [selectedReport, setSelectedReport] = useState(() => {
    const savedId = localStorage.getItem('qservice_selected_report_id');
    const savedReports = localStorage.getItem('qservice_reports_prod');
    if (savedId && savedReports) {
      try {
        const reports = JSON.parse(savedReports);
        return reports.find(r => r.id === savedId) || null;
      } catch (e) {
        return null;
      }
    }
    return null;
  })

  // Authentication / User Management State
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMeasurementManager, setShowMeasurementManager] = useState(false);
  const [currentUser, setCurrentUser] = useState({ id: 1, name: 'Admin User', role: 'admin' }); // Auto-login as admin
  const [isSessionActive, setIsSessionActive] = useState(true); // Single-Session: nur 1 Gerät aktiv
  const sessionTokenRef = useRef(null);
  const presenceChannelRef = useRef(null);
  const isSessionActiveRef = useRef(true); // Ref für handleSaveReport-Zugriff

  // Ref immer synchron halten
  useEffect(() => { isSessionActiveRef.current = isSessionActive; }, [isSessionActive]);
  const [userRole, setUserRole] = useState('admin'); // 'admin' | 'technician' | 'user'
  const [isTechnicianMode, setIsTechnicianMode] = useState(false); // Mode state
  const [showEmailImport, setShowEmailImport] = useState(false);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(localStorage.getItem('qtool_selected_mic') || '');

  // MSAL hooks for OneDrive
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // OneDrive: MSAL-Instanz sofort registrieren sobald verfügbar
  useEffect(() => {
    setMsalInstance(instance);

    // Automatischer Silent-Login beim App-Start
    // Wenn ein Account gespeichert ist (vorheriger Login), wird der Token
    // still erneuert → OneDrive ist sofort verbunden ohne Benutzeraktion
    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      instance.acquireTokenSilent({
        scopes: ['Files.ReadWrite.All'],
        account: accounts[0],
      }).then(result => {
        console.log('[MSAL] ✅ Automatisch angemeldet:', accounts[0].name);
      }).catch(err => {
        // Silent fehlgeschlagen (Token abgelaufen, kein Netz)
        // Kein automatischer Redirect — Benutzer kann manuell einloggen
        console.warn('[MSAL] Silent-Login fehlgeschlagen:', err.message);
      });
    } else {
      console.log('[MSAL] Kein gespeicherter Account — manueller Login erforderlich');
    }
  }, [instance]);

  // ── Single-Session: Supabase Realtime Presence ────────────────────────────────
  // Wenn ein neues Gerät QTool öffnet, wird die alte Sitzung blockiert (kein Autosave)
  useEffect(() => {
    if (!supabase) return;

    // Eindeutiges Session-Token für dieses Gerät
    let token = sessionStorage.getItem('qtool_session_token');
    if (!token) {
      token = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      sessionStorage.setItem('qtool_session_token', token);
    }
    sessionTokenRef.current = token;

    const deviceInfo = /iPad|iPhone|Android/i.test(navigator.userAgent) ? 'Mobil' : 'Desktop';
    const channel = supabase.channel('qtool_global_session', {
      config: { presence: { key: token } }
    });

    channel
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        // Anderes Gerät hat sich verbunden
        if (key !== sessionTokenRef.current) {
          console.log('[Session] Neue Sitzung erkannt auf:', newPresences[0]?.device, '– diese Sitzung wird inaktiv');
          setIsSessionActive(false);
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        // Anderes Gerät hat sich getrennt → diese Sitzung wieder aktiv
        if (key !== sessionTokenRef.current) {
          const state = channel.presenceState();
          const others = Object.keys(state).filter(k => k !== sessionTokenRef.current);
          if (others.length === 0) {
            console.log('[Session] Andere Sitzung getrennt – diese Sitzung ist wieder aktiv');
            setIsSessionActive(true);
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            device: deviceInfo,
            token,
            since: new Date().toISOString()
          });
        }
      });

    presenceChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // iOS-Tastatur: Eingabefeld automatisch sichtbar halten (Techniker-Modus)
  useEffect(() => {
    if (!isTechnicianMode) return;

    let focusedEl = null;

    // Nächsten scrollbaren Vorfahren finden (Modal-Body oder window)
    const getScrollParent = (el) => {
      let node = el.parentElement;
      while (node) {
        const style = window.getComputedStyle(node);
        const overflow = style.overflowY;
        if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    const scrollElIntoView = (el) => {
      if (!el) return;
      const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const rect = el.getBoundingClientRect();
      if (rect.bottom > viewportHeight - 20) {
        const scrollParent = getScrollParent(el);
        if (scrollParent) {
          const parentRect = scrollParent.getBoundingClientRect();
          const offset = rect.bottom - parentRect.top - scrollParent.clientHeight + 80;
          scrollParent.scrollBy({ top: offset, behavior: 'smooth' });
        } else {
          window.scrollBy({ top: rect.bottom - viewportHeight + 80, behavior: 'smooth' });
        }
      }
    };

    const handleFocus = (e) => {
      const el = e.target;
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return;
      focusedEl = el;
      // Sofort + nach Tastatur-Animation scrollen
      setTimeout(() => scrollElIntoView(el), 100);
      setTimeout(() => scrollElIntoView(el), 500);
    };

    const handleBlur = (e) => {
      const el = e.target;
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') return;
      focusedEl = null;
    };

    // Feuert wenn iOS-Tastatur fertig erschienen ist (zuverlässiger als Timeout)
    const handleViewportResize = () => {
      if (focusedEl) {
        setTimeout(() => scrollElIntoView(focusedEl), 50);
      }
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
    };
  }, [isTechnicianMode]);

  const handleLoginOneDrive = async () => {
    try {
      // Veralteten MSAL-Interaction-Status löschen → verhindert interaction_in_progress
      Object.keys(sessionStorage)
        .filter(k => k.includes('interaction.status') || k.includes('request.origin') || k.includes('request.state'))
        .forEach(k => sessionStorage.removeItem(k));
      // loginRedirect funktioniert auf allen Plattformen (Desktop + iPad/Chrome)
      // Voraussetzung: Vercel-URL muss in Azure App Registration als Redirect URI eingetragen sein
      await instance.loginRedirect(loginRequest);
    } catch (e) {
      console.error("MSAL Login Error:", e);
      // alert() wird von Safari in async Kontext geblockt → Toast verwenden
      showToast("OneDrive Fehler: " + (e.message || 'Unbekannt'), 'error');
    }
  };

  const handleLogoutOneDrive = () => {
    instance.logoutRedirect().catch(e => {
      console.error("MSAL Logout Error:", e);
    });
  };

  // Users List (Managed here to share with LoginScreen)
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem('qtool_users_v2');
    return saved ? JSON.parse(saved) : [
      { id: 1, name: 'Admin User', role: 'admin', password: 'admin' },
      { id: 2, name: 'Techniker 1', role: 'technician', password: '123' }
    ];
  });

  // Persist users changes
  useEffect(() => {
    localStorage.setItem('qtool_users_v2', JSON.stringify(users));
  }, [users]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    setUserRole(user.role);
    // Automatically set mode based on role
    setIsTechnicianMode(user.role === 'technician');
    showToast(`Angemeldet als ${user.name}`, 'success');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUserRole('admin');
    setIsTechnicianMode(false);
    setView('dashboard');
    setSelectedReport(null);
  };

  // Initialize reports from LocalStorage
  const [reports, setReports] = useState(() => {
    const saved = localStorage.getItem('qservice_reports_prod');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse reports from local storage", e);
      }
    }
    return [];
  });

  // Persist view and selected report state
  useEffect(() => {
    localStorage.setItem('qservice_current_view', view);
    if (selectedReport && selectedReport.id) {
      localStorage.setItem('qservice_selected_report_id', selectedReport.id);
    } else {
      localStorage.removeItem('qservice_selected_report_id');
    }
  }, [view, selectedReport]);

  // Fetch reports from Supabase on mount
  useEffect(() => {
    if (!supabase) return;

    const fetchReports = async () => {
      const { data, error } = await supabase
        .from('damage_reports')
        .select('report_data, updated_at')
        .is('deleted_at', null)          // ← Soft-Delete: nur nicht-gelöschte laden
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reports from Supabase:', error);
      } else if (data) {
        const loadedReports = data.map(row => ({
          ...row.report_data,
          _supabase_updated_at: row.updated_at,  // ← Konfliktschutz: Zeitstempel merken
          images: (row.report_data.images || []).map(img => ({
            ...img,
            includeInReport: img.includeInReport !== false
          }))
        }));
        if (loadedReports.length > 0) {
          setReports(loadedReports);

          // Save a cached version to LocalStorage (only latest 10, and no base64)
          try {
            const cachedReports = loadedReports.slice(0, 10).map(r => ({
              ...r,
              damageTypeImage: (r.damageTypeImage && r.damageTypeImage.startsWith('data:')) ? null : r.damageTypeImage,
              exteriorPhoto: (r.exteriorPhoto && r.exteriorPhoto.startsWith('data:')) ? null : r.exteriorPhoto,
              images: r.images ? r.images.map(img => ({
                ...img,
                preview: (img.preview && (img.preview.startsWith('blob:') || img.preview.startsWith('data:'))) ? null : img.preview
              })) : []
            }));
            localStorage.setItem('qservice_reports_prod', JSON.stringify(cachedReports));
          } catch (e) {
            console.warn("Initial LocalStorage cache failed:", e.message);
          }
        }
      }
    };

    fetchReports();
  }, []);

  const handleSelectReport = (report) => {
    setSelectedReport(report)
    setView('details')
  }

  const handleCancelEntry = () => {
    setView('dashboard')
    setSelectedReport(null)
  }

  const handleSaveReport = useCallback(async (updatedReport, silent = false) => {
    let finalReport = { ...updatedReport };
    if (!finalReport.id) {
      // Immer UUID verwenden — verhindert ID-Kollisionen die zu Datenverlust führen
      finalReport.id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `TMP-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    if (!finalReport.date) finalReport.date = new Date().toISOString();

    setReports(currentReports => {
      let newReports;
      const exists = currentReports.find(r => r.id === finalReport.id);

      if (exists) {
        newReports = currentReports.map(r => r.id === finalReport.id ? finalReport : r);
      } else {
        newReports = [finalReport, ...currentReports];
      }

      // 1. Persist to LocalStorage (Shrink if too large)
      try {
        // Only save metadata and limited content to LocalStorage to prevent QuotaExceededError
        // We keep full data in memory and in Supabase
        const minimalReports = newReports.slice(0, 15).map(r => ({
          ...r,
          // Strip heavy image content from LocalStorage
          damageTypeImage: (r.damageTypeImage && r.damageTypeImage.startsWith('data:')) ? null : r.damageTypeImage,
          exteriorPhoto: (r.exteriorPhoto && r.exteriorPhoto.startsWith('data:')) ? null : r.exteriorPhoto,
          images: r.images ? r.images.map(img => ({
            ...img,
            preview: (img.preview && (img.preview.startsWith('blob:') || img.preview.startsWith('data:'))) ? null : img.preview
          })) : []
        }));

        try {
          localStorage.setItem('qservice_reports_prod', JSON.stringify(minimalReports));
        } catch (innerE) {
          if (innerE.name === 'QuotaExceededError') {
            // If still failing, keep only the most recent 5
            localStorage.setItem('qservice_reports_prod', JSON.stringify(minimalReports.slice(0, 5)));
          }
        }
      } catch (e) {
        console.warn("LocalStorage caching failed, but in-memory state remains:", e.message);
      }
      return newReports;
    });

    if (!silent || (!updatedReport.id && finalReport.id)) {
      setSelectedReport(prev => {
        if (!prev || prev.id === finalReport.id || !updatedReport.id) return finalReport;
        return prev;
      });
      if (!silent) setView('details');
    }

    if (supabase) {
      // ── Sitzungsschutz: Kein Supabase-Save wenn anderes Gerät aktiv ist ───────────
      if (!isSessionActiveRef.current) {
        console.warn('[Session] Sitzung inaktiv – Supabase-Save blockiert für:', finalReport.id);
        return finalReport; // Nur lokal im Memory, kein Supabase-Write
      }

      const now = new Date().toISOString();
      // _supabase_updated_at ist ein internes Feld – nicht in die DB speichern
      const { _supabase_updated_at: loadedAt, ...reportForStorage } = finalReport;

      const rowData = {
        id: finalReport.id,
        project_title: finalReport.projectTitle,
        client: finalReport.client,
        address: finalReport.address,
        status: finalReport.status,
        assigned_to: finalReport.assignedTo,
        date: finalReport.date,
        drying_started: finalReport.dryingStarted,
        report_data: reportForStorage,  // ohne _supabase_updated_at
        updated_at: now
      };

      const oneDriveBackup = () => {
        try {
          const odFolder = buildProjectFolderName(
            finalReport.projectNumber || finalReport.id || 'Unbekannt',
            finalReport
          );
          uploadProjectJson(odFolder, finalReport).catch(e =>
            console.warn('[OneDrive] JSON-Backup fehlgeschlagen:', e.message)
          );
        } catch (e) {
          console.warn('[OneDrive] JSON-Backup fehlgeschlagen:', e.message);
        }
      };

      // ─── Konfliktschutz: Nur speichern wenn kein neueres Update existiert ───────
      if (loadedAt && finalReport.id && !finalReport.id.startsWith('TMP-')) {
        const { data: updateResult, error } = await supabase
          .from('damage_reports')
          .update(rowData)
          .eq('id', finalReport.id)
          .lte('updated_at', loadedAt)  // Nur wenn DB-Version ≤ geladene Version
          .select('id');

        if (error) {
          console.error('Error saving to Supabase:', error);
          showToast(`⚠️ Speicherfehler: ${error.message || error.code || 'Supabase-Fehler'}. Daten nur lokal gesichert!`, 'error');
        } else if (!updateResult || updateResult.length === 0) {
          // Konflikt: Ein anderes Gerät hat neuere Daten → NICHT überschreiben
          console.warn('[Sync-Konflikt] Neuere Version in Supabase – abgebrochen:', finalReport.id);
          showToast('⚠️ Neuere Version auf anderem Gerät! Seite neu laden.', 'warning');
        } else {
          // Erfolgreich: _supabase_updated_at aktualisieren damit nächster Save erlaubt ist
          setReports(prev => prev.map(r => r.id === finalReport.id ? { ...r, _supabase_updated_at: now } : r));
          oneDriveBackup();
        }
      } else {
        // Neues Projekt oder kein bekannter Zeitstempel → einfaches Upsert
        supabase.from('damage_reports').upsert(rowData).then(({ error }) => {
          if (error) {
            console.error('Error saving to Supabase:', error);
            showToast(`⚠️ Speicherfehler: ${error.message || error.code || 'Supabase-Fehler'}. Daten nur lokal gesichert!`, 'error');
          } else {
            setReports(prev => prev.map(r => r.id === finalReport.id ? { ...r, _supabase_updated_at: now } : r));
            oneDriveBackup();
          }
        });
      }
    }

    return finalReport;
  }, [supabase]);

  const handleNavigateToReport = (identifier) => {
    if (!identifier) return;
    const report = reports.find(r => r.id === identifier || r.projectTitle === identifier || r.projectNumber === identifier);
    if (report) {
      handleSelectReport(report);
      showToast(`Auftrag "${report.projectTitle || report.id}" geöffnet`, 'success');
    } else {
      showToast(`Auftrag "${identifier}" nicht gefunden`, 'error');
    }
  };

  const handleDeleteReport = async (reportId) => {
    const reportToDelete = reports.find(r => r.id === reportId);
    if (!reportToDelete) return;

    // ── Soft-Delete: Projekt aus lokalem State entfernen, aber in DB nur markieren ──
    setReports(prev => {
      const newReports = prev.filter(r => r.id !== reportId);
      try {
        localStorage.setItem('qservice_reports_prod', JSON.stringify(newReports));
      } catch (e) {
        console.error("LocalStorage Update Failed", e);
      }
      return newReports;
    });

    if (selectedReport && selectedReport.id === reportId) {
      setSelectedReport(null);
      setView('dashboard');
    }

    if (supabase) {
      // SOFT-DELETE: Nur als gelöscht markieren – NIEMALS permanent löschen!
      // Wiederherstellung möglich über Supabase Dashboard oder SQL:
      //   UPDATE damage_reports SET deleted_at = NULL WHERE id = '<id>';
      const { error } = await supabase
        .from('damage_reports')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: currentUser?.name || 'unbekannt'
        })
        .eq('id', reportId);

      if (error) {
        console.error('[Soft-Delete] Supabase-Fehler:', error);
        showToast(`Fehler: ${error.message || error.code || 'Unbekannt'}`, 'error');
      } else {
        showToast('Projekt gelöscht (wiederherstellbar)', 'success');
      }
    } else {
      showToast('Projekt lokal gelöscht', 'success');
    }
  };

  // ── Backup: Alle Projekte als JSON-Datei herunterladen ──────────────────────
  const handleDownloadBackup = async () => {
    try {
      let backupData = reports;
      if (supabase) {
        const { data, error } = await supabase
          .from('damage_reports')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        if (!error && data) backupData = data;
      }
      const blob = new Blob(
        [JSON.stringify(backupData, null, 2)],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qtool-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`✅ Backup gespeichert (${backupData.length} Projekte)`, 'success');
    } catch (e) {
      showToast(`Backup fehlgeschlagen: ${e.message}`, 'error');
    }
  };

  const handleEmailImport = (importedData) => {
    if (!importedData) return;

    const newId = `P-${Date.now()}`;

    // ── V4 Felder (EmailImportModalV2 Parser V4) ──
    const ag = importedData.auftraggeber || {};            // V4
    const av = importedData.auftrag_verwaltung || {};      // V3 Compat
    const rd = importedData.rechnungs_details || {};
    const so = importedData.schadenort || {};
    const pd = importedData.projekt_daten || {};

    // Auftraggeber: V4 hat "firma" + "kontaktperson", V3 hatte "firma" + "ansprechperson"
    const clientFirma = ag.firma || av.firma || '';
    const kontaktperson = ag.kontaktperson || av.ansprechperson || '';

    // Schadenort
    const street = [so.strasse, so.hausnummer].filter(Boolean).join(' ') || so.strasse_nr || '';
    const zip    = so.plz || '';
    const city   = so.ort || '';

    // Projekttitel: V4 hat projektTitel top-level
    const projektTitel = importedData.projektTitel || pd.titel || '';

    // Beschreibung: V4 hat beschreibung top-level, V3 in projekt_daten
    const beschreibung = importedData.beschreibung || pd.beschreibung || '';

    // Referenznummer: in rechnungs_details.referenz (V4) oder projekt_daten (V3)
    const projectNum = rd.referenz || pd.referenz_nummer || pd.erp_id || '';

    // Rollenumwandlung
    const rolleMap = {
      'verwaltung':          'Verwaltung',
      'mieter':              'Mieter',
      'eigentuemer':         'Eigentümer',
      'rechnungsempfaenger': 'Eigentümer',
      'dienstleister':       'Handwerker',
      'handwerker':          'Handwerker',
      'sanitaer':            'Handwerker',
      'dachdecker':          'Handwerker',
      'hauswart':            'Hauswart',
      'sonstiges':           'Mieter',
      'Eigentümer':          'Eigentümer',
      'Verwaltung':          'Verwaltung',
      'Handwerker':          'Handwerker',
      'Hauswart':            'Hauswart',
      'Mieter':              'Mieter',
    };

    const newReport = {
      id: newId,
      projectTitle: projektTitel || projectNum || clientFirma || 'Importiertes Projekt',
      projectNumber: projectNum,
      orderNumber:   pd.auftrags_nr || '',

      // Auftraggeber / Verwaltung
      client:      clientFirma,
      clientStreet: av.adresse || ag.adresse || '',
      clientZip:   av.plz || ag.plz || '',
      clientCity:  av.ort || ag.ort || '',
      clientPhone: ag.telefon || av.telefon || '',
      clientEmail: ag.email || av.email || '',
      assignedTo:  kontaktperson,

      // Schadenort
      street,
      zip,
      city,
      address: [street, zip && city ? `${zip} ${city}` : (zip || city)].filter(Boolean).join(', '),
      locationDetails: so.etage_wohnung || so.stockwerk || so.wohnung || '',

      // Eigentümer / Rechnungsdetails (V4: alle Felder vorhanden)
      ownerName:        rd.eigentuemer || '',
      ownerStreet:      rd.strasse || '',
      ownerZip:         rd.plz || '',
      ownerCity:        rd.ort || '',
      ownerEmail:       rd.email_rechnung || '',
      invoiceReference: rd.referenz || rd.vermerk || '',

      description: beschreibung,
      status: 'Schadenaufnahme',
      date: new Date().toISOString(),

      // Priorität V4
      priority: importedData.priority || '',

      contacts: (importedData.kontakte || []).map(c => ({
        name:      c.name || c.firma || '',
        phone:     c.telefon || '',
        email:     c.email || '',
        role:      rolleMap[c.rolle] || 'Sonstiges',
        apartment: c.wohnung || c.etage || '',
        floor:     c.stockwerk || c.etage || '',
        note:      c.zweck || '',
      })),

      rooms: [],
      images: [],
      equipment: [],
      measures: '',
      findings: '',
      history: []
    };

    handleSaveReport(newReport);
    setShowEmailImport(false);
    showToast('Projekt erfolgreich importiert', 'success');
  };

  const refreshDevices = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn("Media devices API not available");
        return;
      }
      // Request permission only if not granted to avoid jumping UI
      await navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => console.warn("Mic permission denied", err));

      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(d => d.kind === 'audioinput');
      setAudioDevices(mics);

      if (mics.length > 0 && !selectedDeviceId) {
        const defaultMic = mics.find(m => m.deviceId === 'default') || mics[0];
        setSelectedDeviceId(defaultMic.deviceId);
      }
    } catch (err) {
      console.error("Error enumerating devices:", err);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  const handleSelectDeviceId = (id) => {
    setSelectedDeviceId(id);
    localStorage.setItem('qtool_selected_mic', id);
  };

  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const ToastMarkup = toast && (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: toast.type === 'success' ? '#10B981' : '#EF4444',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontWeight: '500',
      animation: 'slideIn 0.3s ease-out'
    }}>
      {toast.type === 'success' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      )}
      {toast.message}
    </div>
  );

  // --- LOGIN SCREEN CHECK ---
  if (!currentUser) {
    return (
      <div className="app">
        {ToastMarkup}
        <LoginScreen users={users} onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app">
      {/* ── Session-Inaktiv-Banner ───────────────────────────────────── */}
      {!isSessionActive && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
          background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
          color: 'white', padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 2px 12px rgba(220,38,38,0.5)', gap: '1rem'
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
            ⚠️ Diese Sitzung ist inaktiv – QTool ist auf einem anderen Geråt geöffnet. Kein automatisches Speichern.
          </span>
          <button
            onClick={async () => {
              // Sitzung zurückfordern: neues Token → anderes Gerät wird inaktiv
              const newToken = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`);
              sessionStorage.setItem('qtool_session_token', newToken);
              sessionTokenRef.current = newToken;
              if (presenceChannelRef.current) {
                await presenceChannelRef.current.track({
                  device: /iPad|iPhone|Android/i.test(navigator.userAgent) ? 'Mobil' : 'Desktop',
                  token: newToken,
                  since: new Date().toISOString()
                });
              }
              setIsSessionActive(true);
            }}
            style={{
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)',
              color: 'white', padding: '4px 12px', borderRadius: '6px',
              cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0
            }}
          >
            Hier weiterarbeiten
          </button>
        </div>
      )}
      {ToastMarkup}

      <header className="app-header">
        <div className="container header-content" style={{ position: 'relative' }}>
          <div className="logo-area" style={{ flexShrink: 0 }}>
            <div className="logo-img-container">
              <img
                src="/logo.png"
                alt="QService"
                style={{ height: '40px', width: 'auto' }}
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
              />
              <div style={{ display: 'none', width: 40, height: 40, backgroundColor: 'var(--q-primary)', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>Q</div>
            </div>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Q-Service AG</span>
          </div>

          <nav style={{ flexGrow: 1, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
            {view !== 'dashboard' && (
              <button className="btn btn-outline" onClick={handleCancelEntry} style={{ padding: '0.5rem 1rem' }}>
                <LayoutDashboard size={18} />
                <span className="hide-mobile">Dashboard</span>
              </button>
            )}

            {view === 'dashboard' && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {userRole === 'admin' && (
                  <button
                    className={`btn ${isTechnicianMode ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setIsTechnicianMode(!isTechnicianMode)}
                    style={{ padding: '0.5rem 1rem' }}
                  >
                    {isTechnicianMode ? 'Techniker' : 'Desktop'}
                  </button>
                )}

                {!isTechnicianMode && (
                  <>
                    <button className="btn btn-primary" onClick={() => { setSelectedReport(null); setView('new-report'); }}>
                      <Plus size={18} />
                      {i18n.t('newOrder')}
                    </button>

                    <button className="btn btn-outline" onClick={() => setShowEmailImport(true)}>
                      <Database size={18} />
                      <span className="hide-mobile">Import</span>
                    </button>

                    {!isAuthenticated ? (
                      <button
                        className="btn btn-outline"
                        onClick={handleLoginOneDrive}
                        disabled={inProgress !== 'none'}
                        style={{ color: inProgress !== 'none' ? 'var(--text-muted)' : '#0078D4', borderColor: inProgress !== 'none' ? 'var(--border)' : '#0078D4', gap: '0.4rem', opacity: inProgress !== 'none' ? 0.5 : 1 }}
                        title={inProgress !== 'none' ? 'MSAL wird initialisiert...' : 'Mit OneDrive verbinden'}
                      >
                        <Database size={18} />
                        <span className="hide-mobile">{inProgress !== 'none' ? 'Verbinde...' : 'OneDrive Login'}</span>
                      </button>
                    ) : (
                      <>
                        <button className="btn btn-outline" onClick={handleLogoutOneDrive} style={{ color: '#10B981', borderColor: '#10B981', gap: '0.4rem' }}>
                          <Database size={18} />
                          <span className="hide-mobile">OneDrive OK ({accounts[0]?.name?.split(' ')[0]})</span>
                        </button>
                        <button
                          className="btn btn-outline"
                          title="QTool-Ordner in OneDrive öffnen"
                          onClick={async () => {
                            const url = await getQToolFolderWebUrl();
                            if (url) window.open(url, '_blank');
                            else window.open('https://onedrive.live.com/', '_blank');
                          }}
                          style={{ color: '#0078D4', borderColor: '#0078D4', padding: '0 0.6rem' }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                        </button>
                      </>
                    )}
                  </>
                )}

                {/* Admin Tools Group */}
                {userRole === 'admin' && !isTechnicianMode && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    padding: '3px',
                    borderRadius: '9999px',
                    border: '1px solid var(--border)',
                  }}>
                    <button
                      className="btn btn-ghost"
                      onClick={handleDownloadBackup}
                      title="Backup als JSON herunterladen"
                      style={{ padding: '0.5rem', color: '#10B981' }}
                    >
                      <Download size={18} />
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => {
                        if (confirm('Lokal gespeicherte Berichte (Cache) löschen? Echte Daten in der Cloud bleiben erhalten.')) {
                          localStorage.removeItem('qservice_reports_prod');
                          window.location.reload();
                        }
                      }}
                      title="Cache leeren"
                      style={{ padding: '0.5rem', color: '#FBBF24' }}
                    >
                      <RotateCcw size={18} />
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setView('devices')}
                      title="Geräteverwaltung"
                      style={{ padding: '0.5rem', color: view === 'devices' ? 'var(--q-primary)' : 'inherit' }}
                    >
                      <Settings size={18} />
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setShowMeasurementManager(true)}
                      title="Messgeräte"
                      style={{ padding: '0.5rem' }}
                    >
                      <Thermometer size={18} />
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setShowUserModal(true)}
                      title="Benutzer"
                      style={{ padding: '0.5rem' }}
                    >
                      <Users size={18} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* User-Info Pill – ganz rechts, immer sichtbar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(255,255,255,0.04)',
              padding: '4px 10px 4px 12px',
              borderRadius: '9999px',
              border: '1px solid var(--border)',
              flexShrink: 0,
              marginLeft: '0.25rem'
            }}>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-main)' }}>{currentUser.name}</div>
                <div style={{ color: 'var(--q-primary)', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase' }}>{currentUser.role}</div>
              </div>
              <button
                onClick={handleLogout}
                className="btn btn-ghost"
                title="Abmelden"
                style={{ padding: '0.35rem', color: '#F87171', borderRadius: '50%' }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="container" style={{ marginTop: isTechnicianMode ? '1rem' : '2rem', padding: isTechnicianMode ? '0.5rem' : '1rem', maxWidth: isTechnicianMode ? undefined : 'none' }}>
        {view === 'dashboard' && <Dashboard
          reports={reports}
          onSelectReport={handleSelectReport}
          onDeleteReport={handleDeleteReport}
          mode={isTechnicianMode ? 'technician' : 'desktop'}
          supabase={supabase}
          currentUser={currentUser}
          onReportsChanged={async () => {
            // Reload from Supabase after a status change
            const { data } = await supabase.from('damage_reports').select('report_data, updated_at').is('deleted_at', null).order('created_at', { ascending: false });
            if (data) setReports(data.map(r => ({ ...r.report_data, _supabase_updated_at: r.updated_at })));
          }}
        />}
        {view === 'devices' && <DeviceManager reports={reports} onBack={() => setView('dashboard')} onNavigateToReport={handleNavigateToReport} />}
        {(view === 'new-report' || view === 'details') && (
          <div style={{ position: 'relative' }}>
            {/* ── Sitzungssperre: Overlay blockiert alle Eingaben wenn inaktiv ── */}
            {!isSessionActive && (
              <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 9000,
                backgroundColor: 'rgba(220, 38, 38, 0.08)',
                cursor: 'not-allowed',
                pointerEvents: 'all',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  background: 'rgba(220,38,38,0.92)',
                  color: 'white',
                  padding: '1.5rem 2.5rem',
                  borderRadius: '16px',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  textAlign: 'center',
                  boxShadow: '0 8px 40px rgba(220,38,38,0.5)',
                  maxWidth: '400px',
                  lineHeight: 1.5,
                  pointerEvents: 'none'
                }}>
                  🔒 Gesperrt<br />
                  <span style={{ fontWeight: 400, fontSize: '0.9rem' }}>
                    QTool ist auf einem anderen Gerät aktiv.<br />
                    Benutze den roten Banner oben um diese Sitzung zu übernehmen.
                  </span>
                </div>
              </div>
            )}
            <DamageForm
              key={selectedReport ? selectedReport.id : 'new'}
              onCancel={handleCancelEntry}
              onSave={handleSaveReport}
              initialData={selectedReport}
              mode={isTechnicianMode ? 'technician' : 'desktop'}
            />
          </div>
        )}
      </main>

      {/* Render User Management Modal */}
      {showUserModal && <UserManagementModal onClose={() => setShowUserModal(false)} users={users} setUsers={setUsers} />}
      {showMeasurementManager && <MeasurementDeviceManager onClose={() => setShowMeasurementManager(false)} />}
      {showEmailImport && (
        <EmailImportModalV2
          onClose={() => setShowEmailImport(false)}
          onImport={handleEmailImport}
          audioDevices={audioDevices}
          selectedDeviceId={selectedDeviceId}
          onSelectDeviceId={handleSelectDeviceId}
          onRefreshDevices={refreshDevices}
        />
      )}
    </div>
  )
}

export default App

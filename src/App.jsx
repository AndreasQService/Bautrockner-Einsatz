import { useState, useEffect } from 'react'
import { Plus, LayoutDashboard, Settings } from 'lucide-react'
import { supabase } from './supabaseClient'
import Dashboard from './components/Dashboard'
import DamageForm from './components/DamageForm'
import DeviceManager from './components/DeviceManager'

function App() {
  const [view, setView] = useState('dashboard') // 'dashboard', 'new-report', 'details'
  const [selectedReport, setSelectedReport] = useState(null)



  // Initialize reports from LocalStorage
  const [reports, setReports] = useState(() => {
    const saved = localStorage.getItem('qservice_reports_prod'); // Changed key to reset data
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse reports from local storage", e);
      }
    }
    return []; // Return empty array instead of mock data
  });

  // Fetch reports from Supabase on mount
  useEffect(() => {
    if (!supabase) return;

    const fetchReports = async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('content'); // Select only the JSON content

      if (error) {
        console.error('Error fetching reports from Supabase:', error);
      } else if (data && data.length > 0) {
        // Unwrap the content
        const loadedReports = data.map(row => row.content);
        setReports(loadedReports);
        localStorage.setItem('qservice_reports_prod', JSON.stringify(loadedReports)); // Update storage key
      }
    };

    fetchReports();
  }, []);

  const [isTechnicianMode, setIsTechnicianMode] = useState(false); // New state for Technician View

  const handleSelectReport = (report) => {
    setSelectedReport(report)
    setView('details')
  }

  const handleCancelEntry = () => {
    setView('dashboard')
    setSelectedReport(null)
  }

  const handleSaveReport = (updatedReport, silent = false) => {
    let newReports;

    // Check if it's an existing report
    const exists = reports.find(r => r.id === updatedReport.id);

    if (exists) {
      newReports = reports.map(r => r.id === updatedReport.id ? updatedReport : r);
      setReports(newReports);
      setSelectedReport(updatedReport); // Update selected report to reflect changes
    } else {
      // New report
      const newReport = {
        ...updatedReport,
        id: `WS-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
        date: new Date().toISOString().split('T')[0],
        lat: 52.52 + (Math.random() - 0.5) * 0.1, // Mock coords
        lng: 13.40 + (Math.random() - 0.5) * 0.1
      };
      newReports = [newReport, ...reports];
      setReports(newReports);
      setSelectedReport(newReport); // Select the new report
    }

    // Persist to LocalStorage
    localStorage.setItem('qservice_reports_prod', JSON.stringify(newReports)); // Update storage key

    // Persist to Supabase
    if (supabase) {
      const reportToSave = exists ? updatedReport : newReports[0];

      // We perform an upsert with the JSONwrapper
      supabase
        .from('reports')
        .upsert({
          id: reportToSave.id,
          content: reportToSave,
          updated_at: new Date().toISOString()
        })
        .then(({ error }) => {
          if (error) console.error('Error saving to Supabase:', error);
          else console.log('Successfully saved to Supabase');
        });
    }

    if (!silent) {
      setView('details'); // Stay in details view, do not go back to dashboard
    }
    // setSelectedReport(null); // Removed reset
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="container header-content">
          <div className="logo-area">
            {/* Placeholder for Logo - Replace with actual logo path */}
            {/* Logo */}
            <div className="logo-img-container">
              <img src="/logo.png" alt="QService" style={{ height: '40px', width: 'auto' }} onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
              <div style={{ display: 'none', width: 40, height: 40, backgroundColor: 'var(--primary)', borderRadius: '50%', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>Q</div>
            </div>
            <span>Q-Service AG</span>
          </div>
          <nav>
            {view !== 'dashboard' && (
              <button className="btn btn-outline" onClick={handleCancelEntry}>
                <LayoutDashboard size={18} />
                Dashboard
              </button>
            )}
            {view === 'dashboard' && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => setView('devices')}
                >
                  <Settings size={18} style={{ marginRight: '0.5rem' }} />
                  Geräte
                </button>

                <button
                  className={`btn ${isTechnicianMode ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setIsTechnicianMode(!isTechnicianMode)}
                  title="Techniker-Ansicht umschalten"
                >
                  {isTechnicianMode ? 'Techniker' : 'Desktop'}
                </button>
                <button className="btn btn-primary" onClick={() => { setSelectedReport(null); setView('new-report'); }}>
                  <Plus size={18} />
                  Neuer Auftrag
                </button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="container" style={{ marginTop: '2rem' }}>
        {view === 'dashboard' && <Dashboard reports={reports} onSelectReport={handleSelectReport} mode={isTechnicianMode ? 'technician' : 'desktop'} />}
        {view === 'devices' && <DeviceManager onBack={() => setView('dashboard')} />}
        {(view === 'new-report' || view === 'details') && (
          <DamageForm
            key={selectedReport ? selectedReport.id : 'new'}
            onCancel={handleCancelEntry}
            onSave={handleSaveReport}
            initialData={selectedReport}
            mode={isTechnicianMode ? 'technician' : 'desktop'}
          />
        )}
      </main>
    </div>
  )
}

export default App

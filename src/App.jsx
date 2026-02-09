import { useState, useEffect } from 'react'
import { Plus, LayoutDashboard, Settings } from 'lucide-react'
import { supabase } from './supabaseClient'
import Dashboard from './components/Dashboard'
import DamageForm from './components/DamageForm'
import DeviceManager from './components/DeviceManager'

function App() {
  const [view, setView] = useState('dashboard') // 'dashboard', 'new-report', 'details'
  const [selectedReport, setSelectedReport] = useState(null)

  // Mock Data Generation (Moved from Dashboard)
  const generateMockReports = () => {
    const reports = [];
    const propertyTypes = ['Einfamilienhaus', 'Mehrfamilienhaus', 'Büro / Praxis', 'Mietwohnung', 'Gewerbeimmobilien'];
    const damageTypes = ['Rohrbruch Küche', 'Leckage Heizung', 'Wasserschaden Decke', 'Rohrbruch Keller', 'Leitungsschaden Bad'];
    const assigned = ['Max Mustermann', 'Lisa Meyer', 'Tom Schulze', 'Sarah Weber'];
    const streets = ['Kriesbachstrasse'];
    const names = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker', 'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann'];
    const sources = ['Xhemil Ademi', 'Adi Shala', 'Andreas Strehler'];

    // Mock Images for testing
    const MOCK_IMAGE_URLS = [
      'https://images.unsplash.com/photo-1584622050111-993a426fbf0a?auto=format&fit=crop&q=80&w=300&ixlib=rb-4.0.3', // Wall damage
      'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&q=80&w=300&ixlib=rb-4.0.3', // Floor drying
      'https://images.unsplash.com/photo-1581092921461-eab62e97a783?auto=format&fit=crop&q=80&w=300&ixlib=rb-4.0.3', // Repair
      'https://plus.unsplash.com/premium_photo-1664302152981-42373070445?auto=format&fit=crop&q=80&w=300&ixlib=rb-4.0.3' // Construction
    ];

    // Helper to generate random equipment
    const getMockEquipment = (baseDate) => {
      const items = [];
      const deviceTypes = ['Bautrockner', 'Ventilator', 'Turbine', 'Heizplatte'];
      const rooms = ['Keller', 'Wohnzimmer', 'Bad', 'Flur', 'Schlafzimmer'];
      const apartments = ['EG Links', 'EG Rechts', '1. OG Links', '1. OG Rechts', 'DG'];

      // Randomly add 1-4 devices
      const count = Math.floor(Math.random() * 4) + 1;
      for (let k = 0; k < count; k++) {
        items.push({
          id: Date.now() + Math.random(),
          deviceNumber: k + 1,
          type: deviceTypes[Math.floor(Math.random() * deviceTypes.length)],
          room: rooms[Math.floor(Math.random() * rooms.length)],
          apartment: Math.random() > 0.3 ? apartments[Math.floor(Math.random() * apartments.length)] : '',
          startDate: (() => {
            const start = baseDate ? new Date(baseDate) : new Date();
            // Random delay 0-5 days
            const delay = Math.floor(Math.random() * 5);
            start.setDate(start.getDate() + delay);
            return start.toISOString().split('T')[0];
          })(),
          counterStart: Math.floor(Math.random() * 1000)
        });
      }
      return items;
    };

    // Generate 112 random reports
    const statuses = ['Schadenaufnahme', 'Leckortung', 'Trocknung', 'Instandsetzung'];

    for (let i = 0; i < 112; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const isDrying = status === 'Trocknung';

      // Random date within last 6 months
      const date = new Date(Date.now() - Math.floor(Math.random() * 180) * 24 * 60 * 60 * 1000);

      // If drying, set start date appropriately
      let dryingStarted = null;
      if (isDrying) {
        // Random duration 1-40 days
        const duration = Math.floor(Math.random() * 40) + 1;
        dryingStarted = new Date(Date.now() - duration * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      }

      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const projectTitle = `P-${year}-${month}-${String(1000 + i)}`;

      const mockRooms = [
        { id: 1, name: 'Küche', apartment: 'EG Links' },
        { id: 2, name: 'Bad', apartment: 'EG Links' },
        { id: 3, name: 'Flur', apartment: 'EG Links' }
      ];

      // Generate random mock images
      const imgCount = Math.floor(Math.random() * 7); // 0-6 images
      const reportImages = [];
      for (let j = 0; j < imgCount; j++) {
        const randomImgUrl = MOCK_IMAGE_URLS[Math.floor(Math.random() * MOCK_IMAGE_URLS.length)];
        const randomRoom = mockRooms[Math.floor(Math.random() * mockRooms.length)];

        reportImages.push({
          file: null,
          preview: randomImgUrl,
          name: `IMG_${20250000 + Math.floor(Math.random() * 10000)}.jpg`,
          date: date.toISOString(),
          assignedTo: randomRoom.name,
          roomId: randomRoom.id,
          description: Math.random() > 0.5 ? 'Feuchtigkeit sichtbar' : ''
        });
      }

      reports.push({
        id: projectTitle, // Use projectTitle as ID for now or separate field
        projectTitle: projectTitle,
        client: (i % 3 === 0 ? `Firma ${names[i % names.length]} GmbH` : (i % 2 === 0 ? `Fam. ${names[i % names.length]}` : `Herr/Frau ${names[i % names.length]}`)) + `, ${(Math.floor(Math.random() * 5) + 1)}. OG ${Math.random() > 0.5 ? 'links' : 'rechts'}`,
        clientSource: sources[i % sources.length],
        address: `${streets[i % streets.length]} ${Math.floor(Math.random() * 100) + 1}, 8600 Dübendorf`,
        type: damageTypes[i % damageTypes.length],
        propertyType: propertyTypes[i % propertyTypes.length],
        status: status,
        date: date.toISOString().split('T')[0],
        assignedTo: assigned[i % assigned.length],
        lat: 52.52 + (Math.random() - 0.5) * 0.1,
        lng: 13.40 + (Math.random() - 0.5) * 0.1,
        dryingStarted: dryingStarted,
        equipment: isDrying ? getMockEquipment(dryingStarted) : [],
        imageCount: imgCount,
        images: reportImages,
        contacts: [
          { name: names[(i + 1) % names.length], phone: '0170 1234567', apartment: 'EG Links' },
          { name: 'Hausmeister Krause', phone: '030 9876543', apartment: 'Objektbetreuung' }
        ],
        rooms: mockRooms
      });
    }

    // Sort by date desc
    reports.sort((a, b) => new Date(b.date) - new Date(a.date));

    return reports;
  };

  // Initialize reports from LocalStorage or generate mock data
  const [reports, setReports] = useState(() => {
    const saved = localStorage.getItem('qservice_reports');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse reports from local storage", e);
      }
    }
    const initial = generateMockReports();
    localStorage.setItem('qservice_reports', JSON.stringify(initial));
    return initial;
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
        localStorage.setItem('qservice_reports', JSON.stringify(loadedReports));
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
    localStorage.setItem('qservice_reports', JSON.stringify(newReports));

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

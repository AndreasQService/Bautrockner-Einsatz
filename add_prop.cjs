const fs = require('fs');

// Add isTechnicianMode prop to DamageForm's calls to MeasurementModal
let df = fs.readFileSync('src/components/DamageForm.jsx', 'utf8');
df = df.replace(
    /<MeasurementModal\s+key=\{activeRoomForMeasurement\?\.id \|\| 'none'\}\s+isOpen=\{showMeasurementModal\}/g,
    "<MeasurementModal\n                    isTechnicianMode={mode === 'technician'}\n                    key={activeRoomForMeasurement?.id || 'none'}\n                    isOpen={showMeasurementModal}"
);
fs.writeFileSync('src/components/DamageForm.jsx', df);

// Add isTechnicianMode to MeasurementModal
let mm = fs.readFileSync('src/components/MeasurementModal.jsx', 'utf8');
mm = mm.replace(
    /const MeasurementModal = \(\{ isOpen, onClose, onSave, onStartNew, onBackToDashboard, rooms, allRooms = \[\], projectTitle, address, apartments = \[\], initialData, readOnly, measurementHistory \}\) => \{/,
    "const MeasurementModal = ({ isTechnicianMode, isOpen, onClose, onSave, onStartNew, onBackToDashboard, rooms, allRooms = [], projectTitle, address, apartments = [], initialData, readOnly, measurementHistory }) => {"
);
mm = mm.replace(
    /return createPortal\([\s\n]*<div style=\{\{ position: 'fixed', inset: 0, backgroundColor: 'rgba\(255,255,255,0\.85\)', backdropFilter: 'blur\(4px\)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0\.75rem' \}\}>/g,
    "return createPortal(\n        <div className={isTechnicianMode ? 'force-dark-mode' : ''} style={{ position: 'fixed', inset: 0, backgroundColor: isTechnicianMode ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}>"
);
fs.writeFileSync('src/components/MeasurementModal.jsx', mm);
console.log('Added isTechnicianMode prop');

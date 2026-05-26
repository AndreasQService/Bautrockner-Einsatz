# QTool Component Map & Architectural Boundaries

This document maps the core systems of QTool to prevent architectural drift and identify protection zones.

## 1. PDF Reporting System

QTool is currently in a migration phase from a legacy DOM-screenshot architecture to a structured PDF rendering engine.

### Legacy PDF Export (DOM Screenshots)
- **Primary Trigger**: "Bericht erstellen & Speichern" button inside the `showReportModal` (Modal).
- **Trigger Component**: `DamageForm.jsx` (~line 7683).
- **Handler**: `generatePDFContent` (~line 2410).
- **Capture Method**: `html2canvas` is called directly on the `#print-report` element.
- **Legacy Files**: Logic is tightly coupled within `DamageForm.jsx`. Uses `jspdf` and `html2canvas` directly.

### Modern PDF Export (v2 Engine)
- **Primary Trigger**: "Schadensbericht PDF" button in the main UI action bar.
- **Trigger Component**: `DamageForm.jsx` (Desktop: ~line 5952, Technician: ~line 6272).
- **Handler**: `handleGeneratePDF` -> `generatePDFExport`.
- **Architecture**: Structured data passed to specialized PDF components.
- **Files**:
  - `/src/pdf/DamageReportPDF.jsx`: Root PDF layout and document definition.
  - `/src/pdf/PDFHeader.jsx`: Company logo, project header, and metadata.
  - `/src/pdf/PDFPhotos.jsx`: Photo grid rendering.
  - `/src/pdf/PDFMeasurements.jsx`: Room measurements and data tables.
  - `/src/pdf/PDFDevices.jsx`: Drying equipment and device tracking.
  - `/src/pdf/PDFFooter.jsx`: Page numbering and legal footer.
  - `/src/pdf/PDFStyles.js`: Unified PDF styling system (separate from browser CSS).
  - `/src/pdf/PDFUtils.js`: Data mapping and formatting utilities.

---

## 2. Workflow & Status System

The workflow system governs the progression of a project through its lifecycle.

### Core Logic
- **`WorkflowStatusOverview.jsx`**: Manages the dashboard timeline view, SLA calculation, and manual status overrides. Uses `localStorage` key `qtool_wf_v4`.
- **`DamageForm.jsx`**: Contains the `WorkflowButtons` and step-by-step rendering logic.
- **`useDamageForm.js`**: Central hook for business logic related to form state and data flow.

### Protection Zones
- **STRICTLY PROTECT**: `WorkflowStatusOverview.jsx` logic for SLA and status calculation. Do NOT touch during PDF or UI tasks unless explicitly requested.

---

## 3. Measurement & Sketch System

Handles physical measurements and visual sketches of water damage.

### Components
- **`MeasurementModal.jsx`**: The fullscreen editor for sketches and measurements.
  - **Layer 1**: Grid/Background (`gridCanvasRef`).
  - **Layer 2**: Hand-drawn annotations (`canvasRef`).
  - **Overlay**: `DraggablePhoto` components for image overlays (non-destructive).
- **`RoomManager.jsx`**: Manages the list of rooms and associations with measurement data.
- **`DamageForm/sections/MeasurementSection.jsx`**: UI display of measurement data within the main form.

### Export Logic
- Measurements are exported as PNG/PDF from `MeasurementModal.jsx` using a local `html2canvas`/`jsPDF` stack before being attached to the main report.

---

## 4. Technician Mode (Mobile First)

A dedicated UI optimized for mobile technicians in the field.

### Entry Points
- **`TechnicianModeView.jsx`**: The main container for the mobile UI.
- **`App.jsx`**: Manages the `isTechnicianMode` global state and mode switching logic.
- **`Dashboard.jsx`**: Renders different list views based on the active mode.

---

## 5. Synchronization & Upload System

Handles data persistence across local storage, Supabase, and OneDrive.

### Storage Layers
1. **Supabase**: Primary database for structured project data. Logic in `App.jsx` (polling/sync) and `supabaseClient.js`.
2. **OneDrive**: Storage for binary assets (Photos, PDFs). Logic in `OneDriveService.js` and `DamageForm.jsx`.
3. **IndexedDB**: Offline upload queue for photos to handle unstable field connections.
   - **`src/lib/uploads/db.js`**: Database abstraction for the queue.
   - **`src/services/PhotoStorage.js`**: Local caching for photo previews.

---

## 6. Critical "God" Components

These files are oversized and contain cross-cutting concerns. Exercise extreme caution when editing.

1.  **`DamageForm.jsx` (~7800 lines)**:
    - **Responsibilities**: UI rendering, state coordination, legacy PDF export, OneDrive integration, section management.
    - **Risk**: High coupling between unrelated systems. Small changes can cause regressions in legacy exports.
2.  **`App.jsx` (~1100 lines)**:
    - **Responsibilities**: Authentication, routing, global state, Supabase sync, environment initialization.
3.  **`MeasurementModal.jsx` (~1200 lines)**:
    - **Responsibilities**: Sketching engine, canvas management, measurement data entry, local PDF generation.

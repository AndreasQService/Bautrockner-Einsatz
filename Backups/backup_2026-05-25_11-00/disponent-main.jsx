import React from 'react';
import ReactDOM from 'react-dom/client';
import DisponentMockup from './components/mockups/DisponentMockup';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div className="app-container">
      <DisponentMockup />
    </div>
  </React.StrictMode>
);

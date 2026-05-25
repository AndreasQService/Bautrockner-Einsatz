import React from 'react';
import ReactDOM from 'react-dom/client';
import HandwerkerModeMockup from './components/mockups/HandwerkerModeMockup';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div className="app-container">
      <HandwerkerModeMockup />
    </div>
  </React.StrictMode>
);

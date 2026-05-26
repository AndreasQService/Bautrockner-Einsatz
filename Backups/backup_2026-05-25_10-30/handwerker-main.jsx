import React from 'react';
import ReactDOM from 'react-dom/client';
import HandwerkerMockup from './components/mockups/HandwerkerMockup';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <div className="app-container">
      <HandwerkerMockup />
    </div>
  </React.StrictMode>
);

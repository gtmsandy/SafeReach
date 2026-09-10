import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import 'leaflet/dist/leaflet.css';
import './styles/theme.css';
import './i18n';
import { seedDatabase } from './logic/offlineDB';
import { initTheme } from './logic/theme';
import { initTriageSyncListener } from './logic/triageSync';

seedDatabase();
initTheme();
initTriageSyncListener();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthProvider';
import { App } from './App';
import './styles/tokens.css';
import './styles.css';
import { darstellungAnwenden, darstellungLesen } from './lib/darstellung';
darstellungAnwenden(darstellungLesen());
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(AuthProvider, { children: _jsx(App, {}) }) }));
// Kartenkacheln auf dem Gerät zwischenspeichern (spart mobile Daten)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
}

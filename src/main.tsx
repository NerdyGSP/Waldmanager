import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthProvider';
import { App } from './App';
import './styles/tokens.css';
import './styles.css';
import { darstellungAnwenden, darstellungLesen } from './lib/darstellung';

darstellungAnwenden(darstellungLesen());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

// Service Worker: App-Hülle für den Start ohne Netz und Kartenkacheln auf dem Gerät
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => undefined);
  });
}

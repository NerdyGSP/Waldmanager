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

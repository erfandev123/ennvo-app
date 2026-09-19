import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Catch internal Firestore stream assertion errors gracefully
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.message && (event.message.includes('INTERNAL ASSERTION FAILED') || event.message.includes('Unexpected state'))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('Caught non-fatal Firestore internal assertion error:', event.message);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || '');
    if (reason.includes('INTERNAL ASSERTION FAILED') || reason.includes('Unexpected state')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn('Caught non-fatal Firestore unhandled promise rejection:', reason);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

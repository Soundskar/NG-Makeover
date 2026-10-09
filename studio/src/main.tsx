import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './auth/auth';
import { ErrorBoundary, reloadForNewVersion } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui';
import { I18nProvider } from './i18n/i18n';
// Baloo 2 (greetings, titles, amounts) and Mukta (everything else): both from
// Ek Type, an Indian type foundry, so English, Hindi and the ₹ sign match.
// Served from the app itself; the browser only fetches the scripts a page uses.
import '@fontsource-variable/baloo-2';
import '@fontsource/mukta/400.css';
import '@fontsource/mukta/600.css';
import '@fontsource/mukta/700.css';
import './styles/app.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
  },
});

// A screen of the old version failed to load after an update: reload once.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadForNewVersion()) e.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ErrorBoundary>
          <AuthProvider>
            <ToastProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </ToastProvider>
          </AuthProvider>
        </ErrorBoundary>
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);

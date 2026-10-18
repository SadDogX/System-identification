import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './core/auth.tsx';
import { RouterProvider } from './core/router.tsx';
import { App } from './App.tsx';
import '@app/shared/ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </RouterProvider>
  </StrictMode>,
);

/// <reference types="vite-plugin-pwa/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import './index.css';

// The offline cache (service worker, vite.config.ts registerType 'autoUpdate'): when a new build is published, the
// page reloads once the new worker takes over — before, a returning player kept seeing the previous build. A mission
// in progress is saved on the device, so the reload continues it.
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

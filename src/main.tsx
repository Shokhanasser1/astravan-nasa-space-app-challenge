/// <reference types="vite-plugin-pwa/client" />
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { audio } from './audio/audio';
import './index.css';
import './ui/flight-deck.css'; // after index.css: the Flight Deck skin is one layer over the base styles

// The offline cache (service worker, vite.config.ts registerType 'autoUpdate'): when a new build is published, the
// page reloads once the new worker takes over — before, a returning player kept seeing the previous build. A mission
// in progress is saved on the device, so the reload continues it.
registerSW({ immediate: true });

// Flight Deck: every panel key ticks when pressed (the key's travel is the visual twin; silent when sound is off).
const KEYS = '.abtn, .machine-btn, .entry-chip, .entry-swatch, .pass-guest, .crew-seat';
document.addEventListener(
  'pointerdown',
  (e) => {
    const key = (e.target as Element | null)?.closest?.(KEYS);
    if (!key || (key as HTMLButtonElement).disabled) return;
    audio.unlock();
    audio.key();
  },
  { passive: true },
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { load, save } from '../lib/storage';
import { features } from '../config/features';

/**
 * Fire-and-forget results to our PocketBase. The network never blocks the game: records go into an outbox
 * in localStorage and are sent in the background, retried when online. Anonymous only: a random device id,
 * no names, no free text typed by children.
 * VITE_API_URL is set at build time. Without it: `npm run dev` uses the local `npm run db` through the Vite
 * proxy (same origin); a production build without it does not send.
 */
const ENV = import.meta.env ?? ({} as ImportMetaEnv);
const BASE: string | null = ENV.VITE_API_URL ? String(ENV.VITE_API_URL).replace(/\/$/, '') : ENV.DEV ? '' : null;
const OUTBOX = 'outbox';
const MAX_OUTBOX = 200;
const TIMEOUT_MS = 4000;
export const APP_VERSION: string = ENV.VITE_APP_VERSION || 'dev';

type Collection = 'playtests' | 'runs';
type Item = { collection: Collection; record: Record<string, unknown> };

let flushing = false;

export function deviceId(): string {
  let id = load<string | null>('device', null);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() ?? `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    save('device', id);
  }
  return id;
}

export function send(collection: Collection, record: Record<string, unknown>) {
  if (!features.sendResults) return; // off: the pitch promises nothing goes to a server
  const box = load<Item[]>(OUTBOX, []);
  box.push({ collection, record: { ...record, device: deviceId(), app: APP_VERSION } });
  save(OUTBOX, box.slice(-MAX_OUTBOX));
  void flush();
}

export async function flush(fetchImpl: typeof fetch = globalThis.fetch) {
  if (!features.sendResults || BASE === null || flushing || globalThis.navigator?.onLine === false) return;
  flushing = true;
  try {
    let box = load<Item[]>(OUTBOX, []);
    while (box.length) {
      const { collection, record } = box[0];
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetchImpl(`${BASE}/api/collections/${collection}/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
          signal: ctrl.signal,
        });
      } catch {
        return; // offline or timeout: keep the outbox
      } finally {
        clearTimeout(timer);
      }
      if (res.status === 429 || res.status >= 500) return; // busy: retry later
      box = load<Item[]>(OUTBOX, []).slice(1); // 2xx sent, other 4xx can never succeed: drop
      save(OUTBOX, box);
    }
  } finally {
    flushing = false;
  }
}

globalThis.addEventListener?.('online', () => void flush());

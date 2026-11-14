// Smoke test for the database rules. Run while PocketBase is up:
//   npm run db:smoke                          local (http://127.0.0.1:8090)
//   npm run db:smoke -- https://<domain>      the VPS
// Checks: health, the game can create records, nobody can read them back, bad records are rejected.
// Leaves two small test records (device "smoke-test"); delete them in the admin UI if you like.
const base = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '');
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`ok    ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${name}: ${e.message}`);
  }
}

async function req(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // empty or non-JSON body
  }
  return { status: res.status, json };
}

function expectStatus(r, want) {
  if (r.status !== want) throw new Error(`HTTP ${r.status}, expected ${want}: ${JSON.stringify(r.json)}`);
}

const device = 'smoke-test';

await check('health', async () => expectStatus(await req('GET', '/api/health'), 200));

await check('game can create a playtest', async () => {
  const r = await req('POST', '/api/collections/playtests/records', {
    device,
    phase: 'before',
    answers: { gravity: 'higher', air: 'silent', radiation: 'inside' },
    correct: 2,
    session: 'smoke',
    lang: 'en',
    level: 'pilot',
    app: 'smoke',
  });
  expectStatus(r, 200);
  if (!r.json?.created) throw new Error('no "created" timestamp');
});

await check('game can create a run', async () => {
  const r = await req('POST', '/api/collections/runs/records', {
    device,
    week: '2021-10-25',
    crew: 7,
    science: 14,
    title: 'smoke',
    guesses: 5,
    summary: { shelter: [] },
    duration: 420,
    lang: 'uz',
    level: 'cadet',
    app: 'smoke',
  });
  expectStatus(r, 200);
});

await check('guests cannot list playtests', async () =>
  expectStatus(await req('GET', '/api/collections/playtests/records'), 403),
);
await check('guests cannot list runs', async () => expectStatus(await req('GET', '/api/collections/runs/records'), 403));

await check('invalid phase is rejected', async () =>
  expectStatus(await req('POST', '/api/collections/playtests/records', { device, phase: 'during' }), 400),
);
await check('unknown language is rejected', async () =>
  expectStatus(await req('POST', '/api/collections/runs/records', { device, week: '2021-10-25', lang: 'de' }), 400),
);
await check('missing device is rejected', async () =>
  expectStatus(await req('POST', '/api/collections/playtests/records', { phase: 'after' }), 400),
);

console.log(failed ? `db:smoke: ${failed} failed (${base})` : `db:smoke: all passed (${base})`);
// exitCode instead of process.exit(): exiting while fetch sockets close trips a libuv assertion on Windows.
process.exitCode = failed ? 1 : 0;

// Local PocketBase for development, same version and migrations as the server.
//   npm run db                                   start on http://127.0.0.1:8090 (admin UI: /_/)
//   npm run db -- superuser upsert a@b.c pass    any other PocketBase command
// The official binary is downloaded once into .pocketbase/bin (git-ignored) and checked against
// the release's checksums.txt. Data lives in .pocketbase/data. Schema changes made in the local
// admin UI are written as migration files into server/pb_migrations (automigrate): commit them.
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const VERSION = '0.40.6'; // keep in sync with server/docker-compose.yml
const root = fileURLToPath(new URL('..', import.meta.url));
const home = join(root, '.pocketbase');
const binDir = join(home, 'bin');
const exe = join(binDir, process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase');
const os = { win32: 'windows', darwin: 'darwin', linux: 'linux' }[process.platform];
const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
const release = `https://github.com/pocketbase/pocketbase/releases/download/v${VERSION}`;

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
}

async function ensureBinary() {
  if (existsSync(exe)) return;
  if (!os || !arch) throw new Error(`No PocketBase build for ${process.platform}/${process.arch}`);
  mkdirSync(binDir, { recursive: true });
  const name = `pocketbase_${VERSION}_${os}_${arch}.zip`;
  const zip = join(binDir, name);
  console.log(`Downloading PocketBase ${VERSION} (${os}/${arch})...`);
  await download(`${release}/${name}`, zip);

  const sums = await (await fetch(`${release}/checksums.txt`)).text();
  const expected = sums.split('\n').find((l) => l.trim().endsWith(name))?.split(/\s+/)[0];
  const actual = createHash('sha256').update(readFileSync(zip)).digest('hex');
  if (!expected || expected !== actual) {
    rmSync(zip, { force: true });
    throw new Error(`Checksum mismatch for ${name}: expected ${expected}, got ${actual}`);
  }

  const unzip =
    process.platform === 'linux'
      ? spawnSync('unzip', ['-o', zip, '-d', binDir], { stdio: 'inherit' })
      : spawnSync('tar', ['-xf', zip, '-C', binDir], { stdio: 'inherit' });
  rmSync(zip, { force: true });
  if (unzip.status !== 0 || !existsSync(exe)) throw new Error('Could not unpack PocketBase (Linux needs `unzip`)');
}

await ensureBinary();

const args = process.argv.slice(2);
const command = args.length ? args : ['serve', '--http=127.0.0.1:8090'];
const child = spawn(
  exe,
  [...command, `--dir=${join(home, 'data')}`, `--migrationsDir=${join(root, 'server', 'pb_migrations')}`],
  { stdio: 'inherit' },
);
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));

// Scene screenshots for people and agents (developer guide §07, rule 6: "give the scene agent eyes").
//   ./shot.sh                                  default view, phone 390×844 and laptop 1280×760
//   ./shot.sh '{"plant":0}' '{"plant":4,"wall":2}'   one shot per view override (merged into the real view)
//   SHOT_URL=http://localhost:5173 ./shot.sh   use a running dev server instead of a fresh build
//   SHOT_PORT=4190 ./shot.sh                   own preview port (another session may hold 4174: then the shot
//                                              silently measures THEIR build)
//   SHOT_PARAMS=models ./shot.sh               extra address parameters (here: the NASA models, features.nasaModels)
//   SHOT_PARAMS=demo=storm ./shot.sh           a judge link (morning of day 4)
//   SHOT_ENTRY=1 ./shot.sh                     stay on the reception desk (default: check in as a guest and play)
//   SHOT_COST=1 ./shot.sh                      also print the costliest groups and every shadow caster
// Prints renderer.info (draw calls, triangles) for each shot. Images go to shots/ (git-ignored).
// The phone shot is a touch device (pointer: coarse), so it runs the real 'phone' tier, not a laptop's 'pcLow'.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const views = process.argv.slice(2).length ? process.argv.slice(2) : ['{}'];
const sizes = [
  { name: 'phone', width: 390, height: 844, touch: true },
  { name: 'laptop', width: 1280, height: 760, touch: false },
];

let server = null;
let base = process.env.SHOT_URL;
if (!base) {
  const port = process.env.SHOT_PORT ?? '4174';
  base = `http://localhost:${port}`;
  server = spawn('npx', ['vite', 'preview', '--port', port, '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

/** In the page: draw calls per top-level group (two levels under the scene) and the shadow casters. */
function cost() {
  const hb = window.__hb7;
  if (!hb?.scene) return null;
  const groups = new Map();
  const casters = [];
  const name = (o) => o.name || o.type;
  hb.scene.traverseVisible((o) => {
    if (!o.isMesh && !o.isPoints && !o.isLine) return;
    const path = [];
    for (let p = o; p && p !== hb.scene; p = p.parent) path.unshift(name(p));
    const key = path.slice(0, 2).join(' / ');
    const g = groups.get(key) ?? { meshes: 0, tris: 0 };
    const geo = o.geometry;
    const count = geo?.index ? geo.index.count : (geo?.attributes?.position?.count ?? 0);
    const inst = o.isInstancedMesh ? o.count : 1;
    g.meshes += 1;
    g.tris += o.isMesh ? Math.round((count / 3) * inst) : 0;
    groups.set(key, g);
    if (o.castShadow && o.isMesh) casters.push(`${path.slice(-3).join('/')} (${Math.round((count / 3) * inst)})`);
  });
  const top = [...groups.entries()].sort((a, b) => b[1].meshes - a[1].meshes).slice(0, 15);
  return { top, casters };
}

mkdirSync(join(root, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [i, v] of views.entries()) {
    for (const s of sizes) {
      const page = await browser.newPage({ viewport: { width: s.width, height: s.height }, hasTouch: s.touch, isMobile: s.touch });
      const url = `${base}/?shot&view=${encodeURIComponent(v)}${process.env.SHOT_PARAMS ? `&${process.env.SHOT_PARAMS}` : ''}`;
      await page.goto(url);
      await page.waitForSelector('canvas', { timeout: 30000 });
      const start = page.getByTestId('start-mission');
      if (!process.env.SHOT_ENTRY && (await start.isVisible({ timeout: 8000 }).catch(() => false))) {
        await start.click();
        await page.waitForTimeout(9000);
      } else {
        await page.waitForTimeout(1500);
      }
      const info = await page.evaluate(() => {
        const hb = window.__hb7;
        return hb ? { calls: hb.calls, triangles: hb.triangles } : null;
      });
      const file = join(root, 'shots', `view${i}-${s.name}.png`);
      await page.screenshot({ path: file });
      console.log(`${file}  view=${v}  calls=${info?.calls ?? '?'}  triangles=${info?.triangles ?? '?'}`);
      if (process.env.SHOT_COST) {
        const c = await page.evaluate(cost);
        if (c) {
          for (const [k, g] of c.top) console.log(`    ${String(g.meshes).padStart(4)} meshes ${String(g.tris).padStart(7)} tris  ${k}`);
          console.log(`    shadow casters: ${c.casters.length}`);
          for (const k of c.casters) console.log(`      ${k}`);
        }
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  // (Windows: kill() ends only the shell, the preview server kept the port and the next shot measured an old build)
  if (server && process.platform === 'win32') spawn('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
  else server?.kill();
}

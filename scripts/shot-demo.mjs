// Screenshots + draw calls/triangles of the third-person Moon demo (public/oy/demo/), like shot.mjs for the app.
//   node scripts/shot-demo.mjs                  default view, phone 390×844 and laptop 1280×760
//   node scripts/shot-demo.mjs 'q=low' 'look=0' one shot set per extra address query
//   SHOT_URL=http://localhost:5173 node scripts/shot-demo.mjs   use a running dev server
// SwiftShader renders it: trust the counts, not the FPS. Images go to shots/ (git-ignored).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const queries = process.argv.slice(2).length ? process.argv.slice(2) : [''];
const sizes = [
  { name: 'phone', width: 390, height: 844, touch: true },
  { name: 'laptop', width: 1280, height: 760, touch: false },
];

let server = null;
let base = process.env.SHOT_URL;
if (!base) {
  base = 'http://localhost:4175';
  server = spawn('npx', ['vite', '--port', '4175', '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/oy/demo/`)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

mkdirSync(join(root, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [i, q] of queries.entries()) {
    for (const s of sizes) {
      const page = await browser.newPage({
        viewport: { width: s.width, height: s.height },
        hasTouch: s.touch,
        isMobile: s.touch,
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(`${base}/oy/demo/index.html${q ? `?${q}` : ''}`);
      try {
        await page.waitForFunction(() => window.__demo, null, { timeout: 120000 });
      } catch {
        const text = await page.evaluate(() => document.getElementById('loadText')?.textContent);
        console.log(`no scene after 120 s: "${text}"  ${errors.join(' | ')}`);
        await page.screenshot({ path: join(root, 'shots', `demo${i}-${s.name}-stuck.png`) });
        await page.close();
        continue;
      }
      const cam = new URLSearchParams(q).get('cam');   // cam=yaw,pitch,dist: turn the camera before the shot
      if (cam) {
        await page.evaluate((v) => {
          const [yaw, pitch, dist] = v.split(',').map(Number);
          const inp = window.__demo.input;
          if (Number.isFinite(yaw)) inp.yaw = window.__demo.game.facing + Math.PI + yaw;
          if (Number.isFinite(pitch)) inp.pitch = pitch;
          if (Number.isFinite(dist)) inp.dist = dist;
        }, cam);
      }
      await page.waitForTimeout(2500);
      const info = await page.evaluate(() => {
        const r = window.__demo.renderer.info;
        const look = window.__look ? window.__look.stats() : null;
        // with the look on, renderer.info holds only the last pass: take the look's sum of the camera passes
        return { calls: look ? look.calls : r.render.calls, triangles: look ? look.triangles : r.render.triangles, textures: r.memory.textures, look };
      });
      const file = join(root, 'shots', `demo${i}-${s.name}.png`);
      await page.screenshot({ path: file });
      console.log(`${file}  ?${q}  calls=${info.calls}  triangles=${info.triangles}  textures=${info.textures}` +
        (info.look ? `  look=${JSON.stringify(info.look)}` : '') + (errors.length ? `  ERRORS: ${errors.join(' | ')}` : ''));
      await page.close();
    }
  }
} finally {
  await browser.close();
  server?.kill();
}

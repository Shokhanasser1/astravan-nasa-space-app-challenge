// Scene screenshots for people and agents (developer guide §07, rule 6: "give the scene agent eyes").
//   ./shot.sh                                  default view, phone 390×844 and laptop 1280×760
//   ./shot.sh '{"plant":0}' '{"plant":4,"wall":2}'   one shot per view override (merged into the real view)
//   SHOT_URL=http://localhost:5173 ./shot.sh   use a running dev server instead of a fresh build
// Prints renderer.info (draw calls, triangles) for each shot. Images go to shots/ (git-ignored).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('..', import.meta.url));
const views = process.argv.slice(2).length ? process.argv.slice(2) : ['{}'];
const sizes = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'laptop', width: 1280, height: 760 },
];

let server = null;
let base = process.env.SHOT_URL;
if (!base) {
  base = 'http://localhost:4174';
  server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { cwd: root, shell: true, stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

mkdirSync(join(root, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const [i, v] of views.entries()) {
    for (const s of sizes) {
      const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
      const url = `${base}/?shot&view=${encodeURIComponent(v)}`;
      await page.goto(url);
      await page.waitForSelector('canvas', { timeout: 30000 });
      await page.waitForTimeout(1500);
      const info = await page.evaluate(() => window.__hb7 ?? null);
      const file = join(root, 'shots', `view${i}-${s.name}.png`);
      await page.screenshot({ path: file });
      console.log(`${file}  view=${v}  calls=${info?.calls ?? '?'}  triangles=${info?.triangles ?? '?'}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server?.kill();
}

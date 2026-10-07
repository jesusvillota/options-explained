/**
 * Visual check of every page: builds must exist (npm run build). Serves dist/
 * with `astro preview`, then for each page × theme × viewport takes a
 * screenshot into screenshots/ and reports console errors, KaTeX errors and
 * horizontal overflow. Exits non-zero if any problem is found.
 *
 *   npm run screenshots              # all pages
 *   npm run screenshots -- 02        # only pages whose path contains "02"
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const PORT = 4329;
const BASE = `http://localhost:${PORT}/options-explained/`;
const OUT = 'screenshots';
const filter = process.argv[2];

function pages() {
  const found = [''];
  const dir = 'dist/chapters';
  if (existsSync(dir)) for (const d of readdirSync(dir)) if (statSync(join(dir, d)).isDirectory()) found.push(`chapters/${d}/`);
  return filter ? found.filter((p) => p.includes(filter)) : found;
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview server did not start');
}

async function launch() {
  try {
    return await chromium.launch();
  } catch {
    // Pre-installed Chromium in some environments (e.g. Claude Code cloud sessions).
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
}

// Run Astro's CLI directly (not via npx) so that killing it really stops the server.
const server = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'preview', '--port', String(PORT), '--ignore-lock'], { stdio: 'ignore' });
let problems = 0;
try {
  await waitForServer();
  mkdirSync(OUT, { recursive: true });
  const browser = await launch();
  const viewports = { desktop: { width: 1280, height: 900 }, phone: { width: 375, height: 800 } };
  for (const path of pages()) {
    for (const theme of ['dark', 'light']) {
      for (const [vpName, viewport] of Object.entries(viewports)) {
        const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
        await context.addInitScript((t) => localStorage.setItem('theme', t), theme);
        const page = await context.newPage();
        const errors = [];
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(BASE + path, { waitUntil: 'networkidle' });
        // Scroll through so client:visible islands hydrate.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 500) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(600);
        const katexErrors = await page.locator('.katex-error').count();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        const name = `${(path || 'home').replace(/\/$/, '').replace(/\//g, '_')}-${theme}-${vpName}.png`;
        await page.screenshot({ path: join(OUT, name), fullPage: true });
        const issues = [];
        if (errors.length) issues.push(`console errors: ${errors.join(' | ')}`);
        if (katexErrors) issues.push(`${katexErrors} KaTeX error(s)`);
        if (overflow > 1) issues.push(`horizontal overflow of ${overflow}px`);
        problems += issues.length;
        console.log(`${issues.length ? '✗' : '✓'} ${name}${issues.length ? `\n    ${issues.join('\n    ')}` : ''}`);
        await context.close();
      }
    }
  }
  await browser.close();
} finally {
  server.kill();
}
if (problems) {
  console.error(`\n${problems} problem(s) found.`);
  process.exit(1);
}

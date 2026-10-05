/* global document, window */
// usage: npm run shoot -- /login / /notes   (dev server must be running on :5173)
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const env = Object.fromEntries((existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '')
  .split(/\r?\n/).filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const BASE = process.env.SHOOT_BASE ?? 'http://localhost:5174';
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ['/login'];
mkdirSync('.shots', { recursive: true });

const browser = await chromium.launch();
for (const theme of ['night', 'daybreak']) {
  for (const [label, width, height] of [['phone', 375, 812], ['desktop', 1280, 800]]) {
    const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme === 'night' ? 'dark' : 'light' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    if (env.SMOKE_EMAIL && env.SMOKE_PASSWORD) {
      await page.goto(`${BASE}/login`);
      await page.getByLabel('Email').fill(env.SMOKE_EMAIL);
      await page.getByLabel('Password', { exact: true }).fill(env.SMOKE_PASSWORD);
      await page.getByRole('button', { name: 'Log in' }).click();
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15_000 }).catch(() => {});
    }
    for (const r of routes) {
      errors.length = 0;
      await page.goto(`${BASE}${r}`);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      const file = `.shots/${(r.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home')}-${label}-${theme}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(`${file}${overflow ? '  ⚠ horizontal overflow' : ''}${errors.length ? `  ⚠ ${errors.length} console error(s): ${errors[0]}` : ''}`);
    }
    await ctx.close();
  }
}
await browser.close();

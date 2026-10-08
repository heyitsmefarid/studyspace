/* global document, window */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { installFixtures, noteId, deckId, quizId, partner } from './smoke-fixtures.mjs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.trimStart().startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')]));
const base = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5174';
const browser = await chromium.launch(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : { channel: 'msedge' });
let checks = 0;
let failures = 0;
async function check(name, fn) {
  try { await fn(); checks++; console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`); }
}
try {
  for (const width of [1280, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await installFixtures(context, env.VITE_SUPABASE_URL);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const routes = ['/', '/notes', `/notes/${noteId}`, '/decks', `/decks/${deckId}`, `/decks/${deckId}/study`, '/quizzes', `/quizzes/${quizId}`, `/quizzes/${quizId}/take`, `/quiz/take?mode=deck&deck=${deckId}`, '/tutor', '/planner', '/planner?view=week', '/planner?view=day', '/planner/ai', '/study', '/stats', '/profile', `/profile/${partner}`, '/space', '/chat', '/notifications', '/settings', ...['profile', 'partner', 'subjects', 'password', 'appearance', 'notifications', 'privacy', 'study', 'nova'].map((s) => `/settings/${s}`), '/onboarding', '/set-password', '/does-not-exist'];
    for (const path of routes) await check(`${width}px ${path}`, async () => {
      errors.length = 0;
      await page.goto(base + path);
      await page.waitForLoadState('networkidle');
      assert.equal(new URL(page.url()).pathname, path.split('?')[0], 'route redirected unexpectedly');
      const text = await page.locator('body').innerText();
      assert.ok(text.length > 30, 'page is blank');
      assert.ok(!/Something went wrong|Something drifted|Unexpected Application Error/.test(text), text);
      assert.deepEqual(errors, [], 'browser runtime error');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'horizontal overflow');
    });
    await context.close();
  }
  if (!process.argv.includes('--routes-only')) {
    for (const [path, table] of [['/notes', 'notes'], ['/decks', 'decks'], ['/quizzes', 'quizzes'], ['/planner', 'tasks'], ['/planner/ai', 'study_plans'], ['/stats', 'quiz_attempts'], ['/chat', 'study_rooms'], ['/notifications', 'notifications']]) {
      await check(`load failure and retry ${path}`, async () => {
        const context = await browser.newContext();
        const fixture = await installFixtures(context, env.VITE_SUPABASE_URL);
        fixture.failures.add(table);
        const page = await context.newPage();
        try {
          await page.goto(base + path);
          const retry = page.getByRole('button', { name: 'Try again', exact: true });
          await retry.waitFor({ timeout: 12000 });
          fixture.failures.delete(table);
          await retry.click();
          await retry.waitFor({ state: 'hidden' });
          assert.equal(new URL(page.url()).pathname, path);
        } finally { await context.close(); }
      });
    }
  }
} finally { await browser.close(); }
console.log(`${checks} checks passed; ${failures} failed`);
if (failures) process.exitCode = 1;

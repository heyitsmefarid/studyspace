import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { installFixtures } from './smoke-fixtures.mjs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((line) => line.includes('=') && !line.trimStart().startsWith('#')).map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')]));
const base = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: process.env.SMOKE_CHANNEL ?? 'msedge' });
let failures = 0;

try {
  for (const flow of ['signup', 'reset', 'set-password']) {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    if (flow === 'set-password') await installFixtures(context, env.VITE_SUPABASE_URL);
    else await context.route(`${new URL(env.VITE_SUPABASE_URL).origin}/**`, (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Test-only unavailable response' }) }));
    const page = await context.newPage();
    try {
      await page.goto(`${base}/${flow === 'reset' ? 'login' : flow}`);
      const action = flow === 'signup' ? 'signUp' : flow === 'reset' ? 'resetPasswordForEmail' : 'updateUser';
      await page.evaluate(async (action) => {
        const { supabase } = await import('/src/lib/supabase.ts');
        supabase.auth[action] = async () => { throw new TypeError('Failed to fetch'); };
      }, action);
      if (flow === 'reset') await page.getByRole('button', { name: 'Forgot password?' }).click();
      if (flow !== 'set-password') await page.getByLabel('Email', { exact: true }).fill('test@example.test');
      if (flow !== 'reset') {
        await page.getByLabel(flow === 'signup' ? 'Password' : 'New password', { exact: true }).fill('TestPassword42!');
        await page.getByLabel('Confirm password', { exact: true }).fill('TestPassword42!');
      }
      const submit = page.getByRole('button', { name: flow === 'signup' ? 'Create account' : flow === 'reset' ? 'Send reset link' : 'Save password', exact: true });
      await submit.click();
      await page.getByRole('alert').filter({ hasText: 'check your connection' }).waitFor({ timeout: 3000 });
      assert.equal(await submit.isEnabled(), true, 'form must become usable after rejection');
      assert.equal(new URL(page.url()).pathname, `/${flow === 'reset' ? 'login' : flow}`);
      console.log(`PASS ${flow}: rejected request reports error and unlocks retry`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${flow}: ${error.message}`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }

if (failures) process.exitCode = 1;

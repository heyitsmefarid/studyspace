/* global window, PopStateEvent */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { installFixtures, quizId } from './smoke-fixtures.mjs';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((line) => line.includes('=') && !line.trimStart().startsWith('#')).map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '')]));
const base = process.env.SMOKE_BASE ?? 'http://127.0.0.1:5174';
const browser = await chromium.launch({ channel: process.env.SMOKE_CHANNEL ?? 'msedge' });
let failures = 0;
let passed = 0;

async function check(name, run) {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  try {
    const fixture = await installFixtures(context, env.VITE_SUPABASE_URL);
    const page = await context.newPage();
    await run(page, context, fixture);
    passed++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.message}`);
  } finally { await context.close(); }
}

const takePath = `/quizzes/${quizId}/take?mode=timed`;
async function answerAndSubmit(page) {
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: /^\d+ Cell$/ }).click();
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
}

try {
  for (const minutes of ['Infinity', '-5']) {
    await check(`invalid quiz timer minutes=${minutes}`, async (page) => {
      await page.goto(`${base}${takePath}&minutes=${minutes}`);
      await page.getByRole('button', { name: 'Start', exact: true }).waitFor();
      assert.match(await page.locator('main').innerText(), /1 minutes/);
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      await page.getByRole('heading', { name: 'What is the basic unit of life?' }).waitFor();
      assert.doesNotMatch(await page.locator('main').innerText(), /Infinity|NaN/);
      assert.equal(new URL(page.url()).pathname, `/quizzes/${quizId}/take`);
    });
  }

  await check('retrying a quiz save preserves answers without opening a fresh quiz', async (page, context, fixture) => {
    let requests = 0;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await context.route(`${new URL(env.VITE_SUPABASE_URL).origin}/rest/v1/quiz_attempts**`, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      requests++;
      if (requests === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Temporary save failure', code: 'TEST_FAILURE' }) });
      await gate;
      return route.fallback();
    });
    try {
      await page.goto(base + takePath);
      await answerAndSubmit(page);
      await page.getByRole('button', { name: 'Retry save', exact: true }).click();
      assert.match(await page.locator('main').innerText(), /Saving your answers/);
      assert.equal(await page.getByRole('button', { name: 'Start', exact: true }).count(), 0);
      release();
      await page.waitForURL('**/attempts/*');
      assert.equal(fixture.tables.quiz_attempts.length, 1);
      assert.equal(fixture.tables.quiz_attempts[0].answers[0].chosen, 'Cell');
      assert.equal(requests, 2);
    } finally { release(); }
  });

  await check('a new quiz URL clears the previous save failure', async (page, _context, fixture) => {
    const secondId = '55555555-5555-4555-8555-555555555556';
    fixture.tables.quizzes.push({ ...fixture.tables.quizzes[0], id: secondId, title: 'Second quiz' });
    fixture.tables.quiz_questions.push({ ...fixture.tables.quiz_questions[0], id: '88888888-8888-4888-8888-888888888889', quiz_id: secondId });
    fixture.failures.add('quiz_attempts');
    await page.goto(base + takePath);
    await answerAndSubmit(page);
    await page.getByRole('button', { name: 'Retry save', exact: true }).waitFor();
    await page.evaluate((path) => {
      window.history.pushState({ ...window.history.state, idx: (window.history.state?.idx ?? 0) + 1 }, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }, `/quizzes/${secondId}/take?mode=timed`);
    await page.getByRole('heading', { name: 'Second quiz', exact: true }).waitFor({ timeout: 5000 });
    assert.equal(await page.getByRole('button', { name: 'Retry save', exact: true }).count(), 0);
  });
} finally { await browser.close(); }

console.log(`${passed} quiz checks passed; ${failures} failed`);
if (failures) process.exitCode = 1;

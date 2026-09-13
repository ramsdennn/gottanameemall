// Run against an isolated local test server on port 5174. Pass the Playwright module path.
// All inserted test runs are removed by exact run ID in finally.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : 'playwright');
const origin = 'http://127.0.0.1:5174';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1380, height: 1000 } });
const page = await context.newPage();
const inserted = new Set();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
context.on('request', request => {
  if (request.method() === 'POST' && request.url() === origin + '/api/leaderboard') inserted.add(request.postDataJSON().runId);
});
const click = name => page.getByRole('button', { name, exact: true }).click();
const visible = async locator => { await locator.waitFor({ state: 'visible' }); };
const ready = target => target.waitForFunction(() => !!document.querySelector('.start-buttons button:last-child:not(:disabled)'));
const standby = async () => {
  await page.locator('.leaderboard-scroll[aria-busy="false"]').waitFor();
  assert.equal(await page.locator('.leaderboard-error').count(), 0);
};
const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Page should not overflow horizontally');
mkdirSync('outputs/leaderboard', { recursive: true });
try {
  await page.goto(origin);
  await page.getByRole('button', { name: 'Play', exact: true }).waitFor();
  await ready(page);
  await page.getByRole('checkbox', { name: 'Generation 3', exact: true }).press('Space');
  await visible(page.getByText("Note: These region selections don't have a leaderboard.", { exact: true }));
  await click('View Leaderboard'); await standby();
  assert.equal(await page.locator('.leaderboard-choice.selected').first().innerText(), 'Kanto');
  await click('MAIN MENU');
  assert.equal(await page.getByRole('checkbox', { name: 'Generation 3', exact: true }).isChecked(), true);
  await page.getByRole('checkbox', { name: 'Generation 3', exact: true }).press('Space');
  await page.screenshot({ path: 'outputs/leaderboard/menu.png', fullPage: true });
  await click('Play');
  await page.getByRole('textbox', { name: 'Name a Pokémon' }).fill('Bulbasaur');
  await page.locator('[data-pokemon="1"][data-state="caught"]').waitFor();
  await click('Give up');
  await visible(page.getByText('OAK:', { exact: true }));
  await page.locator('.oak-scene').evaluate(image => image.decode());
  await page.screenshot({ path: 'outputs/leaderboard/oak.png', fullPage: true });
  await click('Submit to Leaderboard'); await standby();
  assert.equal(await page.locator('.chosen-avatar').innerText(), 'Default');
  await page.getByLabel('Your name').fill('ABCDEFGHIJK');
  assert.equal(await page.getByLabel('Your name').inputValue(), 'ABCDEFGHIJ');
  await page.getByLabel('Your name').fill('QA-Sprout');
  await page.getByRole('searchbox').fill('386');
  assert.equal(await page.locator('.avatar-choice').count(), 4);
  await page.getByRole('button', { name: '386 Deoxys (Speed)', exact: true }).click();
  await page.getByRole('searchbox').fill('Bulbasaur');
  await page.getByRole('button', { name: '001 Bulbasaur', exact: true }).click();
  await page.getByRole('searchbox').fill('');
  assert.equal(await page.locator('.avatar-choice').count(), 393);
  await page.screenshot({ path: 'outputs/leaderboard/submit-desktop.png', fullPage: true });
  // A failed POST retains the draft, and retry submits successfully to real storage.
  await page.route('**/api/leaderboard', route => route.request().method() === 'POST' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Test connection failure. Please try again.' }) }) : route.continue());
  await click('Submit to Leaderboard');
  await visible(page.getByRole('alert'));
  assert.equal(await page.getByLabel('Your name').inputValue(), 'QA-Sprout');
  assert.equal(await page.locator('.chosen-avatar').innerText(), 'Bulbasaur');
  await page.unroute('**/api/leaderboard');
  await click('Submit to Leaderboard');
  await visible(page.getByText('Your score is on the leaderboard!', { exact: true })); await standby();
  await visible(page.locator('.own-entry'));
  assert.match(await page.locator('.own-entry').innerText(), /QA-Sprout/);
  const current = await (await fetch(origin + '/api/leaderboard?category=kanto&difficulty=easy')).json();
  assert.ok(current.entries.some(entry => entry.name === 'QA-Sprout' && entry.avatar === '001MS' && entry.correct === 1));
  await page.screenshot({ path: 'outputs/leaderboard/standings.png', fullPage: true });
  await click('Back to results');
  await visible(page.getByText('OAK:', { exact: true }));
  await click('See what I missed');
  await click('View Leaderboard'); await standby();
  await click('Back to results');
  await visible(page.getByRole('button', { name: "Back to Oak's advice", exact: true }));
  await click('View Leaderboard'); await standby();
  await click('MAIN MENU');
  await click('View Leaderboard'); await standby();
  assert.equal(await page.locator('.leaderboard-submit').count(), 0);
  // A separate browser context sees the same durable score.
  const other = await browser.newPage();
  await other.goto(origin); await ready(other); await other.getByRole('button', { name: 'View Leaderboard', exact: true }).click();
  await visible(other.getByRole('cell', { name: 'QA-Sprout', exact: true }));
  await other.close();
  // Verify local persistence across a page reload.
  await page.reload(); await ready(page); await click('View Leaderboard'); await standby();
  await visible(page.getByRole('cell', { name: 'QA-Sprout', exact: true }));
  console.log('PASS: submission, retry, avatars, results navigation and shared persistence.');

  // Full board fixture in a previously empty category; never alter existing scores.
  const fullBoard = { category: 'kanto-johto-hoenn', difficulty: 'very-hard' };
  const before = await (await fetch(origin + '/api/leaderboard?' + new URLSearchParams(fullBoard))).json();
  assert.equal(before.total, 0, 'Full-board test requires an empty local category');
  for (let batch = 0; batch < 20; batch++) {
    await Promise.all(Array.from({ length: Math.min(50, 999 - batch * 50) }, async (_, i) => {
      const runId = randomUUID(); inserted.add(runId);
      const response = await fetch(origin + '/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fullBoard, runId, name: `QA${String(batch * 50 + i).padStart(3, '0')}`, avatar: '000MS', correct: batch * 50 + i === 998 ? 1 : 2, elapsedMs: 10000 + batch * 50 + i, status: 'gave-up' }) });
      assert.equal(response.status, 200);
    }));
  }
  await click('Kanto + Johto + Hoenn'); await click('Very hard'); await standby();
  assert.equal(await page.locator('tbody tr').count(), 50);
  // Incremental network failure preserves the existing first 50 entries.
  let failOnce = true;
  await page.route('**/api/leaderboard?**', route => {
    if (route.request().url().includes('cursor=') && failOnce) {
      failOnce = false;
      return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary loading failure.' }) });
    }
    return route.continue();
  });
  await page.locator('.leaderboard-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await visible(page.getByText('Temporary loading failure.', { exact: true }));
  assert.equal(await page.locator('tbody tr').count(), 50);
  await click('Try again');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 100);
  await page.unroute('**/api/leaderboard?**');
  for (let rows = 100; rows < 999; rows += 50) {
    await page.locator('.leaderboard-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await page.waitForFunction(expected => document.querySelectorAll('tbody tr').length >= expected, Math.min(rows + 50, 999));
  }
  assert.equal(await page.locator('tbody tr').count(), 999);
  assert.equal(await page.locator('tbody tr').last().locator('td').first().innerText(), '999');
  await click('Easy'); await standby();
  assert.equal(await page.locator('tbody tr').count(), 0);
  assert.equal(await page.locator('.leaderboard-scroll').evaluate(element => element.scrollTop), 0);

  // Returning to a full board after submission automatically finds a low-ranked entry.
  await click('MAIN MENU');
  await page.getByRole('checkbox', { name: 'Generation 2', exact: true }).press('Space');
  await page.getByRole('checkbox', { name: 'Generation 3', exact: true }).press('Space');
  await page.getByRole('radio', { name: 'Very hard No help and in Pokédex order', exact: true }).press('Space');
  await click('Play'); await click('Give up');
  await click('Submit to Leaderboard'); await standby();
  await page.getByLabel('Your name').fill('QA-Cutoff');
  await click('Submit to Leaderboard');
  await visible(page.getByText('Your score didn’t make the top 999.', { exact: true }));
  await click('MAIN MENU');
  await click('Play');
  await page.getByRole('textbox', { name: 'Name a Pokémon' }).fill('Bulbasaur');
  await page.locator('[data-pokemon="1"][data-state="caught"]').waitFor();
  await click('Give up'); await click('Submit to Leaderboard'); await standby();
  await page.getByLabel('Your name').fill('QA-Last');
  await click('Submit to Leaderboard');
  await visible(page.getByText('Your score is on the leaderboard!', { exact: true }));
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 999);
  await visible(page.locator('.own-entry'));
  assert.equal(await page.locator('.own-entry td').first().innerText(), '999');
  assert.ok(await page.locator('.leaderboard-scroll').evaluate(element => element.scrollTop > 30000));
  console.log('PASS: scroll through 999 entries, load retry, cutoff rejection and automatic rank-999 highlight.');
  await click('MAIN MENU');

  // Complete a real Kanto run through the input to exercise the completion entry point.
  await page.getByRole('checkbox', { name: 'Generation 2', exact: true }).press('Space');
  await page.getByRole('checkbox', { name: 'Generation 3', exact: true }).press('Space');
  await page.getByRole('radio', { name: 'Hard No help', exact: true }).press('Space');
  await click('Play');
  const catalogue = JSON.parse(readFileSync('public/pokemon/catalogue.json', 'utf8')).filter(pokemon => pokemon.generation === 1);
  for (const pokemon of catalogue) {
    const input = page.getByRole('textbox', { name: 'Name a Pokémon' });
    await input.fill(pokemon.name);
    if (catalogue.some(other => other.id > pokemon.id && other.name.toLowerCase().startsWith(pokemon.name.toLowerCase()))) await input.press('Enter');
  }
  await visible(page.getByText('OAK:', { exact: true }));
  await click('Submit to Leaderboard'); await standby();
  await page.getByLabel('Your name').fill('QA-FullDex');
  await click('Submit to Leaderboard');
  await visible(page.getByText('Your score is on the leaderboard!', { exact: true })); await standby();
  assert.match(await page.locator('.own-entry').innerText(), /151/);
  // Mobile layout, reduced motion, and keyboard focus.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await noOverflow();
  await page.screenshot({ path: 'outputs/leaderboard/mobile-standings.png', fullPage: true });
  const src = await page.locator('.own-entry img').evaluate(image => image.currentSrc);
  assert.match(src, /-still\.png$/);
  await click('MAIN MENU'); await noOverflow();
  await click('Play'); await click('Give up');
  await page.screenshot({ path: 'outputs/leaderboard/mobile-oak.png', fullPage: true });
  await noOverflow();
  await click('See what I missed'); await click('Submit to Leaderboard'); await standby();
  await page.screenshot({ path: 'outputs/leaderboard/mobile-submit.png', fullPage: true });
  await noOverflow();
  await page.getByLabel('Your name').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.getByRole('searchbox').evaluate(element => element === document.activeElement), true);
  await click('Cancel');
  await visible(page.getByRole('button', { name: "Back to Oak's advice", exact: true }));
  assert.deepEqual(errors, []);
  console.log('PASS: submission, retry, avatars, results navigation, 999-row scrolling, cutoff, completion, shared persistence, mobile and reduced motion.');
} catch (error) {
  console.error('Browser errors:', errors);
  await page.screenshot({ path: 'outputs/leaderboard/failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  const db = new DatabaseSync('.cache/leaderboard-e2e.sqlite');
  db.exec('BEGIN IMMEDIATE');
  for (const runId of inserted) {
    db.prepare('DELETE FROM leaderboard_entries WHERE run_id = ?').run(runId);
    db.prepare('DELETE FROM leaderboard_receipts WHERE run_id = ?').run(runId);
  }
  db.exec('COMMIT'); db.close();
}

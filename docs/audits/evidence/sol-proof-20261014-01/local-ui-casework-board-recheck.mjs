import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// Recheck of DATA-04 recipient views after author erasure: the first run read the work queue while
// "Laen eelpöördumisi..." was still shown. Here the queue is read only after loading has finished.
const [root, harnessPath, out] = process.argv.slice(2);
const {harness} = await import(pathToFileURL(harnessPath));
const h = await harness(root);
const result = {checkedAt: new Date().toISOString(), steps: []};
try {
  const page = await (await h.login('specialist')).newPage();
  await page.goto('/eelpoordumised', {waitUntil: 'networkidle', timeout: 90000});
  await page.getByText(/Laen eelpöördumisi/).first().waitFor({state: 'detached', timeout: 60000}).catch(() => {});
  await page.waitForTimeout(1500);
  const radios = await page.getByRole('radio').evaluateAll(els => els.map(el => (el.getAttribute('aria-label') || el.closest('label')?.innerText || el.parentElement?.innerText || '').replace(/\s+/g, ' ').trim()));
  const stillLoading = await page.getByText(/Laen eelpöördumisi/).count();
  const items = await page.locator('#main').getByText(/Kustutatud kasutaja pöördumine|Eelpöördumine 20\.10/).allInnerTexts();
  result.steps.push({page: '/eelpoordumised', stillLoading, radios, items: items.slice(0, 5)});
  await page.goto('/toolaud/juhtumitoo', {waitUntil: 'networkidle', timeout: 90000});
  await page.waitForTimeout(2000);
  const board = await page.locator('#main').getByRole('link', {name: /Eelpöördumine 20\.10/}).allInnerTexts();
  result.steps.push({page: '/toolaud/juhtumitoo', boardLinks: board});
} catch (error) {
  result.error = String(error.message).split('\n').slice(0, 3).join(' | ');
} finally {
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n');
  await h.close();
}
console.log(JSON.stringify(result));

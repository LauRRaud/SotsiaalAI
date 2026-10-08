import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadFrameworkDocument } from '../lib/frameworkDocument.js';
import { getWorkerFrameworkDocxHref, WORKER_FRAMEWORK_VERSION,
  WORKER_FRAMEWORK_REVIEW_STORAGE_KEY, WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY,
  WORKER_FRAMEWORK_SIGNED_HREF } from '../lib/frameworkAcceptances.js';

for (const locale of ['et', 'en', 'ru']) {
  test(`framework ${locale}: rendered content and download use the current brand`, async () => {
    const document = await loadFrameworkDocument(locale);
    assert.match(document.title, /Sotsiaal\.pro/);
    assert.match(document.html, /OÜ Küberloome/);
    assert.doesNotMatch(JSON.stringify(document), /SotsiaalAI|Sotsiaal\.pro OÜ/);
    assert.ok(document.documentBlocks.length > 10);
    const href = getWorkerFrameworkDocxHref(locale);
    assert.ok(href.includes(WORKER_FRAMEWORK_VERSION));
    const download = await readFile(`public${href}`);
    assert.equal(download.subarray(0, 2).toString(), 'PK');
  });
}

test('new review state is isolated while the historical signed document remains available', async () => {
  assert.notEqual(WORKER_FRAMEWORK_VERSION, '2026-07-06');
  assert.ok(WORKER_FRAMEWORK_REVIEW_STORAGE_KEY.endsWith(WORKER_FRAMEWORK_VERSION));
  assert.ok(WORKER_FRAMEWORK_REGISTER_ACK_STORAGE_KEY.endsWith(WORKER_FRAMEWORK_VERSION));
  assert.equal(WORKER_FRAMEWORK_SIGNED_HREF, '/legal/sotsiaalai_tooalase_kasutuse_raamleping.asice');
  assert.ok((await readFile(`public${WORKER_FRAMEWORK_SIGNED_HREF}`)).length > 0);
});

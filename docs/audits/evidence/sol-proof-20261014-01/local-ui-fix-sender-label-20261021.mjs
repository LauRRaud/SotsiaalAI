import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// 21.10 check of fix A3 on the real page: the client's own list says "asutus avas" for the pre-inquiry the organisation
// only opened (cmvgnfwiv001008ts4oq2iux1, local-ui-open-semantics.json) and keeps "vastu võetud" for a personal recipient.
const [root, harnessPath, out] = process.argv.slice(2);
const {harness} = await import(pathToFileURL(harnessPath));
const h = await harness(root);
const rec = {runId: 'sol-proof-20261014-01', checkpointDate: '2026-10-21', environment: 'isolated local copy at localhost:3002, code = fix worktree with the 21.10 fixes, database sol_proof_20261020_local; headless browser', checks: []};
try {
  const page = await (await h.login('client')).newPage();
  await page.goto('/eelpoordumised', {waitUntil: 'networkidle', timeout: 90000});
  await page.getByText(/Laen eelpöördumisi/).first().waitFor({state: 'detached', timeout: 60000}).catch(() => {});
  await page.waitForTimeout(2000);
  await page.getByRole('button', {name: /^Minu eelpöördumised/}).first().click(); await page.waitForTimeout(2500);
  const text = (await page.locator('#main').innerText()).replace(/\s+/g, ' ');
  const row = (text.match(/SOL TEST UI avamise tähendus[^]{0,160}/) || [''])[0];
  rec.listText = text.slice(0, 1500);
  rec.checks.push({case_id: 'FLOW-01', variant_id: 'client_list_shows_opened_for_organisation', status: /asutus avas/.test(row) && !/vastu võetud/.test(row) ? 'PASS' : 'FAIL',
    evidence_mode: 'CURRENT_RUNTIME', entrypoint: 'real pre-inquiry page of the synthetic client in the isolated local copy', actual: {row: row.slice(0, 160), before20_10: 'vastu võetud 20.10.2026'}});
} catch (error) {
  rec.error = String(error.message).split('\n').slice(0, 3).join(' | ');
} finally { fs.writeFileSync(out, JSON.stringify(rec, null, 2) + '\n'); await h.close(); }
console.log(JSON.stringify({checks: rec.checks.map(c => `${c.variant_id}:${c.status}:${c.actual.row.slice(0, 120)}`), error: rec.error || null}));

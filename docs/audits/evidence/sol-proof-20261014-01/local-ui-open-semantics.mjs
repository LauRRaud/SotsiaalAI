import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// What the client is told when the organisation's coordinator only opens a new inquiry and nobody has accepted the work.
const [root, harnessPath] = process.argv.slice(2);
const {harness} = await import(pathToFileURL(harnessPath));
const h = await harness(root);
const ORG = 'cmvgiy1ly0000b0tsx3ok71wd', TITLE = 'SOL TEST UI avamise tähendus';
const rec = {runId: 'sol-proof-20261014-01', serverRelease: 'f15b4866f9a3305c1d9de5ee93fcd3cdbfc76ff9', checkpointDate: '2026-10-20',
  environment: 'isolated local copy at localhost:3002 (code 03960df1), database sol_proof_20261020_local; headless browser', checks: [], observations: [], screens: [], network: [], newPaidCalls: false, externalMessagesSent: false};
const save = () => fs.writeFileSync('local-ui-open-semantics.json', JSON.stringify(rec, null, 2) + '\n');
const aria = async (page, label) => { const a = await page.locator('main').first().ariaSnapshot(); rec.screens.push({label, aria: a.slice(0, 3000)}); save(); return a; };
const current = async page => (await page.getByRole('main').getByText(/^Samm \d+\/11/).first().innerText()).trim();
const goStep = async (page, n) => { if ((await current(page)).startsWith(`Samm ${n}/11`)) return; await page.getByRole('button', {name: /Kõik sammud/}).first().click(); await page.waitForTimeout(400); await page.getByRole('button', {name: new RegExp('^Samm ' + n + '/11')}).first().click(); await page.waitForTimeout(1200); };
const myState = async page => { await page.goto('/eelpoordumised', {waitUntil: 'networkidle'}); await page.waitForTimeout(1200); await page.getByRole('button', {name: /Minu eelpöördumised/}).click(); await page.waitForTimeout(1500);
  const art = page.getByRole('main').getByRole('article').filter({hasText: TITLE}).first(); return (await art.innerText()).replace(/\s+/g, ' ').trim(); };
try {
  const {prisma} = h;
  const cli = await (await h.login('client')).newPage();
  cli.on('response', async r => { const u = new URL(r.url()); if (u.pathname === '/api/pre-inquiries' && r.request().method() === 'POST') { const b = await r.json().catch(() => null); rec.network.push({status: r.status(), id: b?.inquiry?.id, inquiryStatus: b?.inquiry?.status}); save(); } });
  await cli.goto('/eelpoordumised', {waitUntil: 'networkidle', timeout: 90000});
  await cli.getByText('Mul on kontakt juba olemas', {exact: true}).first().click(); await cli.waitForTimeout(1200);
  await cli.getByRole('button', {name: 'Organisatsiooni vastuvõtutiim'}).click(); await cli.waitForTimeout(1500);
  await cli.getByRole('main').getByRole('article').filter({hasText: 'SOL TEST — sünteetiline vastuvõtutiim'}).getByRole('button', {name: 'Ava'}).click(); await cli.waitForTimeout(1200);
  await cli.getByRole('button', {name: 'Vali see kontakt'}).click(); await cli.waitForTimeout(1500);
  await goStep(cli, 1); await cli.getByRole('button', {name: /^Kirjeldan olukorda oma sõnadega/}).click(); await cli.waitForTimeout(1500);
  await goStep(cli, 2); await cli.getByLabel('Olukorra kirjeldus').fill('SOL TEST avamise tähendus. Sünteetiline olukord: vajan nõu testtelefoni seadistamisel.');
  await goStep(cli, 9); await cli.getByRole('main').getByPlaceholder('Lühike pealkiri').fill(TITLE);
  await goStep(cli, 10); await cli.getByRole('main').getByRole('button', {name: /^Saada platvormis/}).click(); await cli.waitForTimeout(3000);
  const inquiryId = rec.network.at(-1)?.id;
  const before = await myState(cli);
  // The coordinator only opens the package.
  const item = await prisma.organizationInboxItem.findFirst({where: {organizationId: ORG, sourceId: inquiryId}, select: {id: true}});
  const coord = await (await h.login('provider')).newPage();
  await coord.goto(`/org/${ORG}/vastuvott/${item.id}`, {waitUntil: 'networkidle', timeout: 90000}); await coord.waitForTimeout(2000);
  await aria(coord, 'coordinator_opened_only');
  const db = await prisma.preInquiry.findUnique({where: {id: inquiryId}, select: {status: true, openedAt: true}});
  const inbox = await prisma.organizationInboxItem.findUnique({where: {id: item.id}, select: {status: true, _count: {select: {assignments: true}}}});
  const after = await myState(cli);
  rec.checks.push({case_id: 'FLOW-01', variant_id: 'client_state_before_opening', status: /saadetud|ootab/i.test(before) && !/vastu võetud/i.test(before) ? 'PASS' : 'FAIL', evidence_mode: 'CURRENT_RUNTIME', entrypoint: 'Eelpöördumine > Minu eelpöördumised', actual: {inquiryId, shown: before}});
  rec.observations.push({status: 'NOT_PROVEN', case_id: 'FLOW-01', variant_id: 'client_state_after_coordinator_only_opened',
    actual: {shown: after, preInquiryStatus: db.status, openedAt: Boolean(db.openedAt), inboxStatus: inbox.status, assignments: inbox._count.assignments},
    note: /vastu võetud/i.test(after) && inbox._count.assignments === 0 ? 'The client is told "vastu võetud" although only the coordinator opened the package and no worker is assigned or has accepted. Whether opening by the intake team counts as acceptance is a product decision; recorded for Astra/Fable and the owner.' : 'The client is not told the inquiry was accepted before a worker accepted it.'});
  save();
  console.log(JSON.stringify({before, after, inboxStatus: inbox.status, assignments: inbox._count.assignments, openedAt: Boolean(db.openedAt)}));
} catch (e) { rec.error = String(e.message).split('\n').slice(0, 3).join(' | '); save(); console.log('ERROR', rec.error); }
finally { save(); await h.close(); }

import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// FLOW-01 / OPS-01 through the real UI in the isolated local copy. The client sent the inquiry through the UI
// (local-ui-preinquiry-send.json). The first run of this script (local-ui-intake-flow-raw.json) checked arrival and the
// coordinator's package and assigned the work in the UI (POST .../assign 201); it then stopped on a wrong relation name
// in the harness query. This resumable run reads that state and continues: the specialist accepts in the UI and the
// client's own view is read.
const [root, harnessPath, inquiryId] = process.argv.slice(2);
const {harness} = await import(pathToFileURL(harnessPath));
const h = await harness(root);
const ORG = 'cmvgiy1ly0000b0tsx3ok71wd', SPECIALIST = 'cmv7uufv50003u3kmxjmb35yj';
const raw = JSON.parse(fs.readFileSync('local-ui-intake-flow-raw.json', 'utf8'));
const rec = {runId: 'sol-proof-20261014-01', serverRelease: 'f15b4866f9a3305c1d9de5ee93fcd3cdbfc76ff9', checkpointDate: '2026-10-20',
  environment: 'isolated local copy (code 03960df1 = deployed application code) at localhost:3002, database sol_proof_20261020_local; headless browser, each actor in its own context',
  inquiryId, checks: [], screens: [], network: [], rawRun: 'local-ui-intake-flow-raw.json', newPaidCalls: false, externalMessagesSent: false};
for (const c of raw.checks) rec.checks.push({...c, measuredIn: 'raw run before the assignment'});
const save = () => fs.writeFileSync('local-ui-intake-flow.json', JSON.stringify(rec, null, 2) + '\n');
const check = (case_id, variant_id, ok, actual) => { rec.checks.push({case_id, variant_id, status: ok ? 'PASS' : 'FAIL', evidence_mode: 'CURRENT_RUNTIME', entrypoint: 'real UI in the isolated local copy', actual}); save(); };
const aria = async (page, label) => { const a = await page.locator('main').first().ariaSnapshot(); rec.screens.push({label, url: new URL(page.url()).pathname, aria: a.slice(0, 4000)}); save(); return a; };
const watch = (page, actor) => page.on('response', r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && r.request().method() !== 'GET') rec.network.push({actor, method: r.request().method(), path: u.pathname, status: r.status()}); });
try {
  const {prisma} = h;
  rec.network.push(...raw.network.map(n => ({...n, measuredIn: 'raw run'})));
  const item = await prisma.organizationInboxItem.findFirst({where: {organizationId: ORG, sourceId: inquiryId}, select: {id: true, status: true, assignments: {select: {status: true, acceptedAt: true, assignee: {select: {userId: true}}}}}});
  check('OPS-01', 'coordinator_assignment_waits_for_worker', item.status === 'ASSIGNED' && item.assignments.some(a => a.assignee.userId === SPECIALIST && a.status === 'PENDING' && !a.acceptedAt),
    {itemStatus: item.status, assignments: item.assignments.map(a => ({status: a.status, toSpecialist: a.assignee.userId === SPECIALIST, accepted: Boolean(a.acceptedAt)}))});
  // The client before acceptance: list and detail after the coordinator opened the package.
  const cli = await (await h.login('client')).newPage(); watch(cli, 'client');
  const pre = await prisma.preInquiry.findUnique({where: {id: inquiryId}, select: {status: true, openedAt: true}});
  await cli.goto('/minu-jagamised', {waitUntil: 'networkidle', timeout: 90000}); await cli.waitForTimeout(1200);
  await cli.getByRole('button', {name: /Saadetud eelpöördumised/}).click(); await cli.waitForTimeout(1200);
  const list = await aria(cli, 'client_sent_list_after_opening');
  await cli.getByRole('button', {name: /SOL TEST UI saatmine/}).first().click(); await cli.waitForTimeout(1500);
  const detail = await aria(cli, 'client_detail_after_opening');
  const withdraw = await cli.getByRole('main').getByRole('button', {name: /tagasi/i}).count();
  check('FLOW-07', 'opened_inquiry_cannot_be_withdrawn_in_client_ui', Boolean(pre.openedAt) && withdraw === 0,
    {openedAt: Boolean(pre.openedAt), withdrawButtons: withdraw, listShowsOpened: /avatud|vastu|töös/i.test(list), detailState: (detail.match(/(saadetud[^\n"]*|avatud[^\n"]*|vastu võetud[^\n"]*|ootab[^\n"]*)/i) || [null])[0]});
  // The specialist accepts.
  const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
  await spec.goto(`/org/${ORG}/vastuvott/${item.id}`, {waitUntil: 'networkidle', timeout: 90000}); await spec.waitForTimeout(1200);
  await spec.getByRole('radio', {name: 'Töö'}).click(); await spec.waitForTimeout(1000);
  const question = await aria(spec, 'specialist_work_question');
  await spec.getByRole('button', {name: 'Võtan vastu'}).click(); await spec.waitForTimeout(2500);
  const after = await aria(spec, 'specialist_after_accept');
  const accepted = await prisma.organizationInboxItem.findUnique({where: {id: item.id}, select: {status: true, assignments: {select: {status: true, acceptedAt: true, assignee: {select: {userId: true}}}}}});
  check('OPS-01', 'assigned_specialist_accepts_in_ui', accepted.assignments.some(a => a.assignee.userId === SPECIALIST && a.acceptedAt),
    {questionShown: /Kas võtad selle vastu/.test(question), itemStatus: accepted.status, assignment: accepted.assignments.map(a => ({status: a.status, accepted: Boolean(a.acceptedAt)})), afterAcceptControls: (after.match(/button "[^"]+"/g) || []).slice(0, 8)});
  // The client after acceptance.
  await cli.goto('/minu-jagamised', {waitUntil: 'networkidle'}); await cli.waitForTimeout(1200);
  await cli.getByRole('button', {name: /Saadetud eelpöördumised/}).click(); await cli.waitForTimeout(1200);
  await cli.getByRole('button', {name: /SOL TEST UI saatmine/}).first().click(); await cli.waitForTimeout(1500);
  const finalView = await aria(cli, 'client_detail_after_acceptance');
  check('FLOW-01', 'client_sees_acceptance_in_own_view', /vastu võetud|võttis vastu|vastuvõetud/i.test(finalView),
    {stateText: (finalView.match(/(vastu võetud[^\n"]*|võttis vastu[^\n"]*|saadetud[^\n"]*|ootab[^\n"]*)/i) || [null])[0]});
  console.log(JSON.stringify(rec.checks.map(c => c.variant_id + ':' + c.status)));
} catch (e) {
  rec.error = String(e.message).split('\n').slice(0, 3).join(' | '); save(); console.log('ERROR', rec.error);
} finally { save(); await h.close(); }

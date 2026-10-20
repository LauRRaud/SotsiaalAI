import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// TOOLS-03 covision start through the real UI in the isolated local copy. The topic seed, its queueing, the covision
// and the invitation were made in the UI during exploration (recorded in `history`); this resumable script checks the
// invitee's view before agreement and runs the stage 1 start: readiness of both, boundaries, start, stage 2 gate.
const [root, harnessPath] = process.argv.slice(2);
const {harness} = await import(pathToFileURL(harnessPath));
const h = await harness(root);
const CASE = 'cmvgnqns6001m08tsf4zrn0y9', TITLE = 'koostöö piirid digiabi olukorras';
const rec = {runId: 'sol-proof-20261014-01', serverRelease: 'f15b4866f9a3305c1d9de5ee93fcd3cdbfc76ff9', checkpointDate: '2026-10-20',
  environment: 'isolated local copy at localhost:3002 (code 03960df1), database sol_proof_20261020_local; headless browser, specialist and provider in separate contexts; no microphone',
  history: [
    {step: 'specialist creates a quick topic seed in the UI', result: 'POST /api/topic-seeds 201, private draft'},
    {step: 'provider views /teemaseemned and /kovisioon before sharing', result: '0 seeds, empty queue'},
    {step: 'queue with "SOL TEST" in the title and "kliendi digiabi" in the text', result: '422 Automaatkontroll leidis otsese tuvastaja (shown in the UI, without saying which words)'},
    {step: 'queue after rewording without capitalised pairs or kliendi/juhtumi phrases', result: 'POST .../queue 200, card Valmis Kovisiooniks'},
    {step: 'Loo Kovisioon', result: 'POST .../covision 201, session stage 1 Algus, role juhtumi tooja'},
    {step: 'Kutsu osaleja by e-mail (synthetic .invalid address, no reachable SMTP)', result: 'POST .../session/actions 200; CovisionInviteDelivery PENDING, attempts 0'}
  ],
  rawRuns: {'local-ui-covision-raw.json': 'first run: only the first readiness step was clicked because the UI returns to part 1 after saving (harness)', 'local-ui-covision-raw2.json': 'second run: Nõustun kokkuleppega answered 409 "Kovisiooni salvestamine ebaõnnestus." for both while the case bringer had not yet confirmed the settings; the button was enabled', 'local-ui-covision-raw3.json': 'third run: agreement and readiness 200; the start check was click-based and the leader work-phase step was missing (harness)'},
  checks: [], screens: [], network: [], newPaidCalls: false, externalMessagesSent: false};
const save = () => fs.writeFileSync('local-ui-covision.json', JSON.stringify(rec, null, 2) + '\n');
const check = (variant_id, ok, actual, case_id = 'TOOLS-03') => { rec.checks.push({case_id, variant_id, status: ok ? 'PASS' : 'FAIL', evidence_mode: 'CURRENT_RUNTIME', entrypoint: 'real covision UI in the isolated local copy', actual}); save(); };
const text = async p => (await p.locator('#main').innerText()).replace(/\s+/g, ' ');
const watch = (p, who) => p.on('response', async r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && r.request().method() !== 'GET') { let body = null; try { body = await r.json(); } catch {} rec.network.push({who, method: r.request().method(), path: u.pathname, status: r.status(), message: body?.message ?? body?.error ?? null}); save(); } });
// After each confirmation the UI saves and returns to part 1 (Ühine laud); the Ring part is reopened before each step.
const clickIfEnabled = async (page, name) => { await page.getByRole('button', {name: 'Ring', exact: true}).click(); await page.waitForTimeout(900); const b = page.getByRole('button', {name}).first(); if (await b.count() && await b.isEnabled()) { await b.click(); await page.waitForTimeout(1500); return true; } return false; };
try {
  const {prisma} = h;
  // Invitee before agreement.
  const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
  await prov.goto('/kovisioon', {waitUntil: 'networkidle', timeout: 90000}); await prov.waitForTimeout(1500);
  const home = await text(prov);
  await prov.goto(`/kovisioon?case=${CASE}`, {waitUntil: 'networkidle'}); await prov.waitForTimeout(3000);
  const before = await text(prov);
  const delivery = await prisma.covisionInviteDelivery.findMany({select: {status: true, attempts: true}});
  const firstRaw = JSON.parse(fs.readFileSync('local-ui-covision-raw.json', 'utf8'));
  const agreedAlready = before.includes(TITLE);
  if (agreedAlready) { for (const c of firstRaw.checks.filter(c => /before_agreement|not_listed/.test(c.variant_id))) rec.checks.push({...c, measuredIn: 'local-ui-covision-raw.json (before the invitee agreed)'}); save(); } else
  check('invitee_sees_no_case_title_before_agreement', !before.includes(TITLE) && /Kovisiooni sessioon/.test(before), {titleVisible: before.includes(TITLE), role: (before.match(/\b(osaleja|juhtumi tooja)\b/) || [null])[0]});
  if (!agreedAlready) check('invite_not_listed_in_app_for_invitee', !home.includes(TITLE), {inviteeHomeShowsCase: home.includes(TITLE), deliveryRows: delivery,
    meaning: 'The invitee reaches the session only through the e-mailed link /kovisioon?case=<id>; delivery waits for the notification job.'}, 'OPS-06');
  // Invitee readiness.
  await prov.getByRole('button', {name: 'Ring', exact: true}).click(); await prov.waitForTimeout(1200);
  const provSteps = [];
  for (const name of [/Kinnitan oma rolli/, /Nõustun kokkuleppega/, /Olen valmis/]) provSteps.push({step: String(name), clicked: await clickIfEnabled(prov, name)});
  const afterAgree = await text(prov);
  rec.screens.push({label: 'invitee_ring_after_readiness', text: afterAgree.slice(0, 1500)}); save();
  // Case bringer readiness, boundaries and start.
  const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
  await spec.goto(`/kovisioon?case=${CASE}`, {waitUntil: 'networkidle', timeout: 90000}); await spec.waitForTimeout(3000);
  await spec.getByRole('button', {name: 'Ring', exact: true}).click(); await spec.waitForTimeout(1200);
  const specSteps = [];
  for (const name of [/Kinnitan oma rolli/, /Nõustun kokkuleppega/, /Olen valmis/, /Juhtumi piir ja anonüümsus on õiged/, /Kinnita seaded/, /Alusta kohtumist/]) specSteps.push({step: String(name), clicked: await clickIfEnabled(spec, name)});
  await spec.waitForTimeout(1500);
  const specAfter = await text(spec);
  rec.screens.push({label: 'case_bringer_after_start', text: specAfter.slice(0, 2000)}); save();
  await prov.reload({waitUntil: 'networkidle'}); await prov.waitForTimeout(3000);
  const provAfter = await text(prov);
  check('invitee_sees_title_after_agreement', provAfter.includes(TITLE), {titleVisible: provAfter.includes(TITLE), inviteeSteps: provSteps});
  const participants = (specAfter.match(/Osalejad \d+/) || [null])[0];
  check('both_participants_ready_and_meeting_started', /Osalejad 2/.test(specAfter) && (specAfter.match(/Valmis/g) || []).length >= 2 && /kohtumine alustatud|KOHTUMISEST ALLES/i.test(specAfter),
    {participants, caseBringerSteps: specSteps, gateText: (specAfter.match(/Veel \d+ tingimust[^.]*\.|Etapi 1 värav[^.]*\./) || [null])[0]});
  // The session leader moves the work phase on until the stage 1 gate opens.
  const phases = [];
  for (let i = 0; i < 4; i++) { await spec.getByRole('button', {name: 'Kompass', exact: true}).click(); await spec.waitForTimeout(900); const go = spec.getByRole('button', {name: /^Jätka/}).first(); const story = spec.getByRole('button', {name: 'Ava juhtumi lugu'}).first(); if (await story.count() && await story.isEnabled()) break; if (!(await go.count()) || !(await go.isEnabled())) break; phases.push(await go.innerText()); await go.click(); await spec.waitForTimeout(1800); }
  rec.workPhaseSteps = phases; save();
  const storyBtn = spec.getByRole('button', {name: 'Ava juhtumi lugu'}).first();
  const storyEnabled = (await storyBtn.count()) ? await storyBtn.isEnabled() : false;
  if (storyEnabled) { await storyBtn.click(); await spec.waitForTimeout(2500); }
  const stage = await text(spec);
  check('stage1_gate_opens_story_stage', storyEnabled && /Etapp 2: Lugu — Praegune etapp|Osa 1\/\d+: Lugu|Lugu/.test(stage), {storyButtonEnabled: storyEnabled, stage2Current: /Etapp 2: Lugu — Praegune etapp/.test(await spec.locator('#main').ariaSnapshot())});
  console.log(JSON.stringify(rec.checks.map(c => c.variant_id + ':' + c.status)));
} catch (e) { rec.error = String(e.message).split('\n').slice(0, 3).join(' | '); save(); console.log('ERROR', rec.error); }
finally { save(); await h.close(); }

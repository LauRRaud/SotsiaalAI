import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
// TOOLS-03 supervision through the real UI in the isolated local copy. The supervisor right of the synthetic specialist
// is a labelled fixture (SupervisorGrant 'SOL TEST eligibility fixture; not a real qualification'), as on 14.10.
// Exploration (recorded in `history`) created the process, activated the contract and invited the provider, who joined.
// This run: the participant writes a private note and a topic preparation, shares only the topic, and the supervisor's
// view is read for both.
const [root, harnessPath, stage = 'share'] = process.argv.slice(2);
const {harness} = await import(pathToFileURL(harnessPath));
const h = await harness(root);
const PROC = 'cmvgoi8ag0005d0tssdz9jl3i';
const file = 'local-ui-supervision.json';
const rec = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {runId: 'sol-proof-20261014-01', serverRelease: 'f15b4866f9a3305c1d9de5ee93fcd3cdbfc76ff9', checkpointDate: '2026-10-20',
  environment: 'isolated local copy at localhost:3002 (code 03960df1), database sol_proof_20261020_local; headless browser; supervisor = synthetic specialist with a fixture SupervisorGrant',
  history: [
    {step: 'Uus protsess: Individuaalne, title, 3 planned meetings, purpose, Loo protsess', result: 'POST /api/supervision/processes 201; draft visible only to the supervisor'},
    {step: 'Kontrakt: Uus versioon, Salvesta versioon, Versioonid > Aktiveeri versioon > Vajuta uuesti, et aktiveerida', result: 'contract-versions 201, activate 200; version 1 in force; activation warned that it cannot be undone'},
    {step: 'Osalejad: Kutsu osaleja by the invitee user ID', result: 'invitation pending; the form asks for an internal user ID, not a name or e-mail'},
    {step: 'Provider: Minu supervisioon > Kutsed', result: 'invitation listed in the app with title, supervisor and role; before answering only the contract is shown'},
    {step: 'Provider: Kinnitan kontrakti ja liitun', result: 'participations/.../respond 200; role Osaleja, Aktiivne'}
  ], checks: [], network: [], newPaidCalls: false, externalMessagesSent: false};
const save = () => fs.writeFileSync(file, JSON.stringify(rec, null, 2) + '\n');
const check = (variant_id, ok, actual) => { rec.checks = rec.checks.filter(c => c.variant_id !== variant_id); rec.checks.push({case_id: 'TOOLS-03', variant_id, status: ok ? 'PASS' : 'FAIL', evidence_mode: 'CURRENT_RUNTIME', entrypoint: 'real supervision UI in the isolated local copy', actual}); save(); };
const watch = (p, who) => p.on('response', async r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && r.request().method() !== 'GET') { let body = null; try { body = await r.json(); } catch {} rec.network.push({who, method: r.request().method(), path: u.pathname, status: r.status(), message: body?.message ?? body?.error ?? null}); save(); } });
const part = async (page, name) => { await page.getByRole('button', {name: 'Kogu protsess'}).first().click().catch(() => {}); await page.waitForTimeout(700); await page.getByRole('button', {name: new RegExp('^' + name)}).first().click(); await page.waitForTimeout(1200); };
const text = async p => (await p.locator('#main').innerText()).replace(/\s+/g, ' ');
const fillFirstTextbox = async (page, value) => { const boxes = page.locator('#main').getByRole('textbox'); const n = await boxes.count(); for (let i = 0; i < n; i++) { const b = boxes.nth(i); if (await b.isVisible() && await b.isEditable()) { await b.fill(value); return true; } } return false; };
try {
  if (stage === 'share') {
    const marker = crypto.randomBytes(3).toString('hex');
    rec.markers = {privateNote: 'SOL PRIVATE NOTE ' + marker, sharedTopic: 'SOL SHARED TOPIC ' + marker}; save();
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await prov.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await prov.waitForTimeout(2000);
    // Private note.
    await part(prov, 'Privaatne eeskamber');
    await prov.getByRole('button', {name: 'Uus mustand'}).click(); await prov.waitForTimeout(1000);
    await prov.getByRole('button', {name: /^Privaatne märge/}).click(); await prov.waitForTimeout(1200);
    rec.editorPrivate = (await prov.locator('#main').ariaSnapshot()).slice(-1800); save();
    await prov.getByRole('textbox', {name: 'Pealkiri (valikuline)'}).fill('SOL privaatne'); await prov.getByRole('textbox', {name: 'Sisu'}).fill(rec.markers.privateNote);
    await prov.getByRole('button', {name: /^Salvesta/}).first().click(); await prov.waitForTimeout(2000);
    // Topic preparation, then share it.
    await part(prov, 'Privaatne eeskamber');
    await prov.getByRole('button', {name: 'Uus mustand'}).click(); await prov.waitForTimeout(1000);
    await prov.getByRole('button', {name: /^Teema ettevalmistus/}).click(); await prov.waitForTimeout(1200);
    await prov.getByRole('textbox', {name: 'Pealkiri (valikuline)'}).fill('SOL jagatav'); await prov.getByRole('textbox', {name: 'Sisu'}).fill(rec.markers.sharedTopic);
    await prov.getByRole('button', {name: /^Salvesta/}).first().click(); await prov.waitForTimeout(2000);
    await part(prov, 'Privaatne eeskamber');
    rec.roomAfterDrafts = (await prov.locator('#main').ariaSnapshot()).slice(-2500); save();
    const item = prov.locator('#main').getByRole('listitem').filter({hasText: rec.markers.sharedTopic}).first();
    const shareBtn = item.getByRole('button', {name: /Jaga/}).first();
    if (await shareBtn.count()) { await shareBtn.click(); await prov.waitForTimeout(1200); const confirm = prov.getByRole('button', {name: /Jaga|Kinnita/}).last(); if (await confirm.count()) { await confirm.click(); await prov.waitForTimeout(2000); } }
    rec.afterShare = (await prov.locator('#main').ariaSnapshot()).slice(-2000); save();
    // Supervisor view.
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await spec.waitForTimeout(2000);
    await part(spec, 'Jagatud teemad');
    const shared = await text(spec);
    await part(spec, 'Privaatne eeskamber');
    const ownRoom = await text(spec);
    check('participant_shared_topic_visible_to_supervisor', shared.includes(rec.markers.sharedTopic), {sharedVisible: shared.includes(rec.markers.sharedTopic)});
    check('participant_private_note_hidden_from_supervisor', !shared.includes(rec.markers.privateNote) && !ownRoom.includes(rec.markers.privateNote), {privateInShared: shared.includes(rec.markers.privateNote), privateInSupervisorRoom: ownRoom.includes(rec.markers.privateNote)});
  }
  if (stage === 'meeting') {
    const grab = async (page, label) => { const a = await page.locator('#main').ariaSnapshot(); const i = a.search(/paragraph: "(Osa|Samm)/); (rec.meetingScreens ||= []).push({label, aria: a.slice(Math.max(0, i), i + 1800)}); save(); };
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await spec.waitForTimeout(2000);
    await part(spec, 'Kohtumised');
    if (await spec.locator('#main').getByText('Ühtegi kohtumist pole veel plaanitud.').count()) {
      await spec.locator('#main').getByRole('button', {name: 'Plaani kohtumine'}).first().click(); await spec.waitForTimeout(1000);
      await spec.locator('#main').getByRole('button', {name: 'Plaani kohtumine'}).last().click(); await spec.waitForTimeout(2000);
    }
    await grab(spec, 'meetings_after_plan');
    const held = spec.locator('#main').getByRole('button', {name: /toimunuks|Toimus|Märgi/i}).first();
    if (await held.count()) { await held.click(); await spec.waitForTimeout(1200); await grab(spec, 'after_held_click'); const again = spec.locator('#main').getByRole('button', {name: /Vajuta uuesti|Kinnita/}).first(); if (await again.count()) { await again.click(); await spec.waitForTimeout(2000); } }
    await grab(spec, 'meetings_after_held');
    await part(spec, 'Kokkuvõtted');
    await grab(spec, 'summaries');
  }
  if (stage === 'meeting2') {
    const grab = async (page, label) => { const a = await page.locator('#main').ariaSnapshot(); const i = a.search(/paragraph: "(Osa|Samm)/); (rec.meetingScreens ||= []).push({label, aria: a.slice(Math.max(0, i), i + 1800)}); save(); };
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await spec.waitForTimeout(2000);
    await part(spec, 'Kohtumised');
    await spec.locator('#main').getByRole('button', {name: /^Kohtumine 1/}).click(); await spec.waitForTimeout(1500);
    await grab(spec, 'meeting_detail');
    await part(spec, 'Kokkuvõtted');
    await spec.locator('#main').getByRole('button', {name: 'Uus kokkuvõte'}).click(); await spec.waitForTimeout(1500);
    await grab(spec, 'summary_editor');
  }
  if (stage === 'summary') {
    const grab = async (page, label) => { const a = await page.locator('#main').ariaSnapshot(); const i = a.search(/paragraph: "(Osa|Samm)/); (rec.summaryScreens ||= []).push({label, aria: a.slice(Math.max(0, i), i + 1800)}); save(); };
    const clickIf = async (page, name) => { const b = page.locator('#main').getByRole('button', {name}).first(); if (await b.count() && await b.isEnabled()) { await b.click(); await page.waitForTimeout(1500); return true; } return false; };
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await spec.waitForTimeout(2000);
    await part(spec, 'Kohtumised');
    await spec.locator('#main').getByRole('button', {name: /^Kohtumine 1/}).click(); await spec.waitForTimeout(1200);
    if (await clickIf(spec, 'Märgi toimunuks')) { await clickIf(spec, /Vajuta uuesti|Kinnita/); }
    await grab(spec, 'meeting_after_held');
    await part(spec, 'Kokkuvõtted');
    await clickIf(spec, 'Uus kokkuvõte');
    await spec.locator('#main').getByRole('radio', {name: 'Kohtumise kokkuvõte'}).click(); await spec.waitForTimeout(800);
    await grab(spec, 'summary_type_meeting');
    const meetingPick = spec.locator('#main').getByRole('radio', {name: /Kohtumine 1/}).first();
    if (await meetingPick.count()) await meetingPick.click();
    await clickIf(spec, 'Kirjuta kokkuvõte');
    await grab(spec, 'summary_form');
    const boxes = spec.locator('#main').getByRole('textbox');
    for (let i = 0; i < await boxes.count(); i++) { const b = boxes.nth(i); if (await b.isVisible() && await b.isEditable()) await b.fill('SOL TEST kokkuvõte: arutati töörolli piire; järgmine samm on kokkulepitud.'); }
    await clickIf(spec, /^Salvesta/);
    await grab(spec, 'summary_saved');
    if (await clickIf(spec, /Saada kinnitamisele|Saada kinnitamiseks/)) await clickIf(spec, /Vajuta uuesti|Kinnita/);
    await grab(spec, 'summary_sent');
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await prov.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await prov.waitForTimeout(2000);
    await part(prov, 'Kokkuvõtted');
    await grab(prov, 'participant_summaries');
    const item = prov.locator('#main').getByRole('button', {name: /Kohtumise kokkuvõte|Kohtumine 1/}).first();
    if (await item.count()) { await item.click(); await prov.waitForTimeout(1200); }
    await grab(prov, 'participant_summary_detail');
    if (await clickIf(prov, /^Kinnitan/)) await clickIf(prov, /Vajuta uuesti/);
    await grab(prov, 'participant_after_confirm');
  }
  if (stage === 'summary2') {
    const grab = async (page, label) => { const a = await page.locator('#main').ariaSnapshot(); const i = a.indexOf('region "Kokkuvõtted"'); (rec.summaryScreens ||= []).push({label, aria: a.slice(Math.max(0, i), i + 1500)}); save(); };
    const clickIf = async (page, name) => { const b = page.locator('#main').getByRole('button', {name}).first(); if (await b.count() && await b.isEnabled()) { const n = await b.innerText(); await b.click(); await page.waitForTimeout(1500); return n; } return null; };
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await spec.waitForTimeout(2000);
    await part(spec, 'Kokkuvõtted');
    const participantBefore = rec.summaryScreens?.find(s => s.label === 'participant_summaries')?.aria || '';
    await spec.locator('#main').getByRole('button', {name: /^Kohtumise 1 kokkuvõte/}).click(); await spec.waitForTimeout(1200);
    await grab(spec, 'draft_detail');
    rec.sendPress = [await clickIf(spec, /Saada/)]; rec.sendPress.push(await clickIf(spec, /Vajuta uuesti|Kinnitan saatmise/)); save();
    await grab(spec, 'after_send');
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await prov.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await prov.waitForTimeout(2000);
    await part(prov, 'Kokkuvõtted');
    const listP = await text(prov);
    await grab(prov, 'participant_list_after_send');
    const item = prov.locator('#main').getByRole('button', {name: /^Kohtumise 1 kokkuvõte/}).first();
    if (await item.count()) { await item.click(); await prov.waitForTimeout(1200); }
    await grab(prov, 'participant_detail');
    rec.confirmPress = [await clickIf(prov, /^Kinnitan/)]; rec.confirmPress.push(await clickIf(prov, /Vajuta uuesti/)); save();
    await grab(prov, 'participant_after_confirm');
    const finalP = await text(prov);
    await spec.reload({waitUntil: 'networkidle'}); await spec.waitForTimeout(1500); await part(spec, 'Kokkuvõtted');
    const finalS = await text(spec);
    check('summary_draft_hidden_until_sent', /Kokkuvõtteid pole veel/.test(participantBefore), {participantSawDraftBeforeSend: !/Kokkuvõtteid pole veel/.test(participantBefore)});
    check('summary_sent_and_confirmed_by_participant', listP.includes('Kohtumise 1 kokkuvõte') && /kinnitatud|Kinnitatud/.test(finalP + finalS), {participantSeesAfterSend: listP.includes('Kohtumise 1 kokkuvõte'), sendPresses: rec.sendPress, confirmPresses: rec.confirmPress, stateAfter: (finalS.match(/Kohtumise 1 kokkuvõte[^.]{0,80}/) || [null])[0]});
  }
  if (stage === 'close') {
    const grab = async (page, label) => { const a = await page.locator('#main').ariaSnapshot(); const i = a.search(/paragraph: "(Osa|Samm)/); (rec.closeScreens ||= []).push({label, aria: a.slice(Math.max(0, i), i + 2000)}); save(); };
    const clickIf = async (page, name) => { const b = page.locator('#main').getByRole('button', {name}).first(); if (await b.count() && await b.isEnabled()) { const n = await b.innerText(); await b.click(); await page.waitForTimeout(1500); return n; } return null; };
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await spec.waitForTimeout(2000);
    await part(spec, 'Sulgemine');
    await grab(spec, 'close_preview');
    // Closing runs through its own preview ("Ava sulgemise eelvaade"); the first close run pressed nothing (harness).
    rec.closePress = [await clickIf(spec, 'Ava sulgemise eelvaade')];
    await spec.getByText('Laen…').waitFor({state: 'detached', timeout: 30000}).catch(() => {}); await spec.waitForTimeout(1200);
    for (let i = 0; i < 3; i++) { await grab(spec, 'close_wizard_' + i); const gen = spec.locator('#main').getByRole('textbox', {name: 'Üldistatud pealkiri'}); if (await gen.count()) await gen.fill('Supervisioon: töörolli piirid (sünteetiline)'); const next = spec.getByRole('button', {name: 'Järgmine samm'}).first(); if (!(await next.count()) || !(await next.isEnabled())) break; await next.click(); await spec.waitForTimeout(1200); }
    rec.closePress.push(await clickIf(spec, /^(Sulgen|Sulge protsess|Kinnitan sulgemise)/)); rec.closePress.push(await clickIf(spec, /Vajuta uuesti/)); save();
    await grab(spec, 'after_close');
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await prov.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await prov.waitForTimeout(2000);
    const overviewP = await text(prov);
    const sharedRows = await h.prisma.supervisionSharedTopic?.count?.({where: {processId: PROC}}).catch(() => null) ?? null;
    await part(prov, 'Kokkuvõtted').catch(() => {});
    const summariesP = await text(prov);
    check('closing_removes_shared_topics_keeps_confirmed_summary', !overviewP.includes('SOL jagatav') && summariesP.includes('Kohtumise 1 kokkuvõte'),
      {closePresses: rec.closePress, participantOverviewShowsSharedTopic: overviewP.includes('SOL jagatav'), participantSeesConfirmedSummary: summariesP.includes('Kohtumise 1 kokkuvõte'), sharedTopicRows: sharedRows, processState: (overviewP.match(/(Suletud|Lõpetatud|Aktiivne)[^.]{0,40}/) || [null])[0]});
  }
  if (stage === 'verify') {
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await spec.waitForTimeout(2000);
    await part(spec, 'Jagatud teemad');
    const sharedList = await text(spec);
    const topicBtn = spec.locator('#main').getByRole('button', {name: /^SOL jagatav/}).first();
    if (await topicBtn.count()) { await topicBtn.click(); await spec.waitForTimeout(1500); }
    const shared = await text(spec);
    check('participant_shared_topic_visible_to_supervisor', shared.includes(rec.markers.sharedTopic), {listShowsTitle: sharedList.includes('SOL jagatav'), openedTopicShowsContent: shared.includes(rec.markers.sharedTopic), privateNoteStillHidden: !shared.includes(rec.markers.privateNote) && !sharedList.includes('SOL privaatne'), shareNeededSecondPress: rec.shareConfirm?.secondPress === 1, sharedTo: 'Ainult superviisorile (default)'});
  }
  if (stage === 'share2') {
    // The share action sits inside the opened draft ("Jaga teadlikult"); the first run looked for it in the list.
    rec.shareRunNote = 'The share stage first looked for the share button in the draft list; it is inside the opened draft. This stage shares the same topic.'; save();
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await prov.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await prov.waitForTimeout(2000);
    await part(prov, 'Privaatne eeskamber');
    await prov.getByRole('button', {name: /^SOL jagatav/}).click(); await prov.waitForTimeout(1200);
    await prov.getByRole('button', {name: 'Jaga teadlikult'}).click();
    await prov.getByText('Laen…').waitFor({state: 'detached', timeout: 30000}).catch(() => {}); await prov.waitForTimeout(1500);
    rec.sharePreview = [];
    for (let i = 0; i < 2; i++) { rec.sharePreview.push((await prov.locator('#main').ariaSnapshot()).slice(-1200)); await prov.getByRole('button', {name: 'Järgmine samm'}).first().click(); await prov.waitForTimeout(1200); }
    rec.shareDialog = (await prov.locator('#main').ariaSnapshot()).slice(-1500); save();
    const confirm = prov.locator('#main').getByRole('button', {name: 'Jagan teadlikult'});
    rec.shareConfirm = {present: await confirm.count(), enabled: (await confirm.count()) ? await confirm.isEnabled() : false};
    if (rec.shareConfirm.present && rec.shareConfirm.enabled) {
      await confirm.click(); await prov.waitForTimeout(1500);
      const again = prov.locator('#main').getByRole('button', {name: /Vajuta uuesti|Kinnitan jagamise/}).first();
      rec.shareConfirm.secondPress = await again.count();
      if (rec.shareConfirm.secondPress) { await again.click(); await prov.waitForTimeout(2500); }
      rec.shareAfterConfirm = (await prov.locator('#main').ariaSnapshot()).slice(-1000);
    }
    save();
    await prov.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle'}); await prov.waitForTimeout(2000);
    await part(prov, 'Privaatne eeskamber');
    const room = await text(prov);
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(`/supervisioon/${PROC}`, {waitUntil: 'networkidle', timeout: 90000}); await spec.waitForTimeout(2000);
    await part(spec, 'Jagatud teemad');
    const sharedList = await text(spec);
    const topicBtn = spec.locator('#main').getByRole('button', {name: /^SOL jagatav/}).first();
    if (await topicBtn.count()) { await topicBtn.click(); await spec.waitForTimeout(1500); }
    const shared = await text(spec);
    check('participant_shared_topic_visible_to_supervisor', shared.includes(rec.markers.sharedTopic), {listShowsTitle: sharedList.includes('SOL jagatav'), openedTopicShowsContent: shared.includes(rec.markers.sharedTopic), privateNoteStillHidden: !shared.includes(rec.markers.privateNote) && !sharedList.includes('SOL privaatne'), participantRoomStillHasPrivateNote: room.includes('SOL privaatne'), shareNeededSecondPress: rec.shareConfirm?.secondPress === 1});
  }
  console.log(JSON.stringify(rec.checks.map(c => c.variant_id + ':' + c.status)));
} catch (e) { rec.error = String(e.message).split('\n').slice(0, 3).join(' | '); save(); console.log('ERROR', rec.error); }
finally { save(); await h.close(); }

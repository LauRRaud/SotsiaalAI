import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// TOOLS-03 mentoring through the real UI in the isolated local copy. The provider built the mentor profile in the UI
// (7 steps) and submitted it (PENDING_REVIEW); the admin moderation was replaced by a labelled fixture (ACTIVE), as on
// 14.10. Stages: request -> accept -> agreement -> meeting/summary -> close. Each stage records its screens.
const [root, harnessPath, stage] = process.argv.slice(2);
const {harness} = await import(pathToFileURL(harnessPath));
const h = await harness(root);
const MENTOR_PAGE = '/mentorlus/mentor/cmvgp5pee0020d0tsp2e1alrn';
const file = 'local-ui-mentoring.json';
const rec = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {runId: 'sol-proof-20261014-01', serverRelease: 'f15b4866f9a3305c1d9de5ee93fcd3cdbfc76ff9', checkpointDate: '2026-10-20',
  environment: 'isolated local copy at localhost:3002 (code 03960df1), database sol_proof_20261020_local; headless browser; mentor = synthetic provider, mentee = synthetic specialist',
  history: [
    {step: 'Mina mentorina > Hakka mentoriks: 7-step profile (name, fields/topics, languages/formats, short and long intro, experience)', result: 'PUT /api/mentoring/profile 200 per step; draft visible only to the author'},
    {step: 'Esita ülevaatusele', result: 'POST /api/mentoring/profile 200; PENDING_REVIEW; page says moderation is not a qualification check'},
    {step: 'admin moderation', result: 'replaced by a labelled fixture: status ACTIVE, approvedSnapshotVisible true (isolated database)'},
    {step: 'mentee: Leia mentor', result: 'mentor listed; catalogue says data is self-reported, not a quality mark; neutral ordering; link to the independent ESTA mentor database'}
  ], checks: [], screens: [], network: [], newPaidCalls: false, externalMessagesSent: false};
const save = () => fs.writeFileSync(file, JSON.stringify(rec, null, 2) + '\n');
const check = (variant_id, ok, actual) => { rec.checks = rec.checks.filter(c => c.variant_id !== variant_id); rec.checks.push({case_id: 'TOOLS-03', variant_id, status: ok ? 'PASS' : 'FAIL', evidence_mode: 'CURRENT_RUNTIME', entrypoint: 'real mentoring UI in the isolated local copy', actual}); save(); };
const grab = async (page, label) => { await page.getByText('Laen…').first().waitFor({state: 'detached', timeout: 20000}).catch(() => {}); await page.waitForTimeout(500); const a = await page.locator('#main').ariaSnapshot(); const i = a.search(/paragraph: "(Samm|Osa)/); rec.screens.push({stage, label, url: new URL(page.url()).pathname, aria: a.slice(Math.max(0, i), i + 2000)}); save(); return a; };
const watch = (p, who) => p.on('response', async r => { const u = new URL(r.url()); if (u.pathname.startsWith('/api/') && r.request().method() !== 'GET') { let body = null; try { body = await r.json(); } catch {} rec.network.push({stage, who, method: r.request().method(), path: u.pathname, status: r.status(), message: body?.message ?? body?.error ?? null}); save(); } });
const NEVER = /Lõpeta mentorlus/;
const clickIf = async (page, name) => { const b = page.locator('#main').getByRole('button', {name}).first(); if (await b.count() && await b.isEnabled()) { const n = (await b.innerText()).replace(/\s+/g, ' '); if (NEVER.test(n)) return null; await b.click(); await page.waitForTimeout(1500); return n; } return null; };
const fillVisible = async (page, value) => { const boxes = page.locator('#main').getByRole('textbox'); for (let i = 0; i < await boxes.count(); i++) { const b = boxes.nth(i); if (await b.isVisible() && await b.isEditable() && !(await b.inputValue()).trim()) await b.fill(value); } };
try {
  if (stage === 'request') {
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(MENTOR_PAGE, {waitUntil: 'networkidle', timeout: 90000}); await spec.waitForTimeout(2000);
    await clickIf(spec, 'Soovi mentorlust');
    await grab(spec, 'request_form_1');
    for (let i = 0; i < 4; i++) {
      await fillVisible(spec, 'Sünteetiline taotlus: soovin tuge töörolli piiride ja juhtumite planeerimise teemal.');
      const sent = await clickIf(spec, /^(Esita taotlus|Saada taotlus|Saadan taotluse)/);
      if (sent) { rec.requestSentWith = sent; save(); await clickIf(spec, /Vajuta uuesti/); break; }
      const next = spec.getByRole('button', {name: 'Järgmine samm'}).first(); if (!(await next.count()) || !(await next.isEnabled())) break; await next.click(); await spec.waitForTimeout(1200);
      await grab(spec, 'request_form_' + (i + 2));
    }
    await grab(spec, 'after_request');
  }
  if (stage === 'accept') {
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await prov.goto('/mentorlus', {waitUntil: 'networkidle', timeout: 90000}); await prov.waitForTimeout(1500);
    await clickIf(prov, /^Taotlused/);
    const list = await grab(prov, 'mentor_requests');
    const item = prov.locator('#main').getByRole('link').or(prov.locator('#main').getByRole('button')).filter({hasText: /Sünteetiline taotlus|taotlus/i}).first();
    if (await item.count()) { await item.click(); await prov.waitForTimeout(1500); }
    await grab(prov, 'request_detail');
    rec.acceptPress = [await clickIf(prov, /^(Võtan vastu|Nõustun|Kinnitan|Võta vastu)/)]; rec.acceptPress.push(await clickIf(prov, /Vajuta uuesti/)); save();
    await grab(prov, 'after_accept');
    check('mentor_sees_request_with_goal', /Sünteetiline taotlus/.test(list) || rec.screens.some(s => s.label === 'request_detail' && /Sünteetiline taotlus/.test(s.aria)), {acceptPress: rec.acceptPress});
  }
  if (stage === 'relation') {
    const openRelation = async (page) => { await page.goto('/mentorlus', {waitUntil: 'networkidle', timeout: 90000}); await page.waitForTimeout(1500); await clickIf(page, /^Minu mentorlussuhted/); await grab(page, 'relations_list'); const r = page.locator('#main').getByRole('link').or(page.locator('#main').getByRole('button')).filter({hasText: /SOL TEST|Mustand|Kokkulepe/}).first(); if (await r.count()) { await r.click(); await page.waitForTimeout(2000); } return grab(page, 'relation_page'); };
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await openRelation(prov);
  }
  if (stage === 'agreement') {
    const REL = '/mentorlus/suhe/cmvgp8xii002hd0ts3kgfmej1';
    const part = async (page, name) => { await page.getByRole('button', {name: 'Kogu suhe'}).first().click().catch(() => {}); await page.waitForTimeout(600); await page.locator('#main').getByRole('button', {name: new RegExp('^' + name)}).first().click(); await page.waitForTimeout(1500); };
    const act = async (page, who) => {
      await page.goto(REL, {waitUntil: 'networkidle', timeout: 90000}); await grab(page, who + '_relation');
      await part(page, 'Mentorluskokkulepe'); await grab(page, who + '_agreement_part');
      const start = await clickIf(page, /^(Koosta|Uus|Kirjuta|Esita kokkulepe|Ava kokkulepe)/);
      if (start) await grab(page, who + '_agreement_form');
      await fillVisible(page, 'Sünteetiline kokkulepe: kaks kohtumist kuus, konfidentsiaalsus, privaatsed märkmed jäävad kirjutajale.');
      const presses = [await clickIf(page, /^(Salvesta|Esita|Kinnitan|Nõustun)/)];
      presses.push(await clickIf(page, /^(Vajuta uuesti|Esita|Kinnitan|Nõustun)/));
      presses.push(await clickIf(page, /^Vajuta uuesti/));
      await grab(page, who + '_after_agreement');
      return {start, presses};
    };
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    rec.agreementMentor = await act(prov, 'mentor'); save();
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    rec.agreementMentee = await act(spec, 'mentee'); save();
    const rel = await h.prisma.mentoringRelation.findUnique({where: {id: 'cmvgp8xii002hd0ts3kgfmej1'}, select: {status: true}});
    check('relation_activates_after_both_accept_agreement', rel.status === 'ACTIVE', {relationStatus: rel.status, mentor: rec.agreementMentor, mentee: rec.agreementMentee});
  }
  if (stage === 'confirm') {
    // The agreement stage's generic clicker opened "Esita uus versioon" for the mentee instead of confirming (harness).
    rec.agreementRawNote = 'agreement stage: mentor submitted version 1 (200); the mentee click hit Esita uus versioon, whose editor refused an identical text (Uus versioon peab kehtivast erinema). This stage confirms with Kinnitan kokkuleppe.'; save();
    const REL = '/mentorlus/suhe/cmvgp8xii002hd0ts3kgfmej1';
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(REL, {waitUntil: 'networkidle', timeout: 90000}); await grab(spec, 'mentee_relation');
    await spec.getByRole('button', {name: 'Kogu suhe'}).first().click().catch(() => {}); await spec.waitForTimeout(600);
    await spec.locator('#main').getByRole('button', {name: /^Mentorluskokkulepe/}).first().click(); await spec.waitForTimeout(1500);
    const presses = [await clickIf(spec, 'Kinnitan kokkuleppe')]; presses.push(await clickIf(spec, /^Vajuta uuesti/));
    await grab(spec, 'mentee_after_confirm');
    const rel = await h.prisma.mentoringRelation.findUnique({where: {id: 'cmvgp8xii002hd0ts3kgfmej1'}, select: {status: true}});
    check('relation_activates_after_both_accept_agreement', rel.status === 'ACTIVE', {relationStatus: rel.status, menteePresses: presses, mentorSubmittedVersion1: true});
  }
  if (stage === 'work') {
    const REL = '/mentorlus/suhe/cmvgp8xii002hd0ts3kgfmej1';
    const part = async (page, name) => { await page.getByRole('button', {name: 'Kogu suhe'}).first().click().catch(() => {}); await page.waitForTimeout(600); await page.locator('#main').getByRole('button', {name: new RegExp('^' + name)}).first().click(); await page.waitForTimeout(1500); };
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await prov.goto(REL, {waitUntil: 'networkidle', timeout: 90000}); await grab(prov, 'mentor_active_relation');
    for (const name of ['Minu märkmed', 'Kohtumised', 'Kokkuvõtted', 'Suhte seis']) {
      await part(prov, name); await grab(prov, 'mentor_part_' + name);
      const open = await clickIf(prov, /^(Uus märge|Lisa märge|Lisa kohtumine|Uus kohtumine|Kirjuta kokkuvõte|Uus kokkuvõte)/);
      if (open) await grab(prov, 'mentor_form_' + name);
      await prov.getByRole('button', {name: /^Loobu/}).first().click().catch(() => {}); await prov.waitForTimeout(600);
    }
  }
  if (stage === 'flow') {
    const REL = '/mentorlus/suhe/cmvgp8xii002hd0ts3kgfmej1';
    const part = async (page, name) => { await page.getByRole('button', {name: 'Kogu suhe'}).first().click().catch(() => {}); await page.waitForTimeout(600); await page.locator('#main').getByRole('button', {name: new RegExp('^' + name)}).first().click(); await page.waitForTimeout(1500); };
    const text = async p => (await p.locator('#main').innerText()).replace(/\s+/g, ' ');
    const NOTE = 'SOL MENTOR PRIVATE NOTE ' + Date.now().toString(36);
    rec.noteMarker = NOTE; save();
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await prov.goto(REL, {waitUntil: 'networkidle', timeout: 90000}); await grab(prov, 'flow_start');
    // Private note.
    await part(prov, 'Minu märkmed'); await clickIf(prov, 'Lisa märge');
    await prov.locator('#main').getByRole('textbox', {name: 'Uus märge'}).fill(NOTE); await clickIf(prov, 'Lisa märge');
    // Meeting.
    await part(prov, 'Kohtumised'); await clickIf(prov, 'Lisa kohtumine');
    const time = prov.locator('#main').getByRole('textbox', {name: 'Aeg'});
    rec.meetingTimeInput = {type: await time.getAttribute('type'), placeholder: await time.getAttribute('placeholder')}; save();
    await time.fill(rec.meetingTimeInput.type === 'datetime-local' ? '2026-10-21T10:00' : '21.10.2026 10:00').catch(() => {});
    await prov.locator('#main').getByRole('textbox', {name: 'Teema (näevad mõlemad)'}).fill('töörolli piirid (sünteetiline)');
    rec.meetingAdd = await clickIf(prov, 'Lisa kohtumine'); await grab(prov, 'mentor_meetings_after_add');
    // Summary draft, confirmed by the mentor.
    await part(prov, 'Kokkuvõtted'); await clickIf(prov, 'Uus kokkuvõte');
    await prov.locator('#main').getByRole('textbox', {name: 'Kokkuvõtte mustand'}).fill('Sünteetiline kokkuvõte: arutati töörolli piire, järgmine kohtumine kuu pärast.');
    rec.summaryCreate = await clickIf(prov, 'Loo mustand'); await grab(prov, 'mentor_summary_draft');
    rec.mentorConfirm = [await clickIf(prov, /^Kinnitan/)]; rec.mentorConfirm.push(await clickIf(prov, /^Vajuta uuesti/)); save();
    const afterMentor = await h.prisma.mentoringSummary.findFirst({where: {relationId: 'cmvgp8xii002hd0ts3kgfmej1'}, select: {status: true, _count: {select: {confirmations: true}}}}).catch(e => ({error: String(e.message).slice(0, 80)}));
    await grab(prov, 'mentor_after_confirm');
    // Mentee.
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(REL, {waitUntil: 'networkidle', timeout: 90000}); await grab(spec, 'mentee_relation');
    const menteeAll = [];
    for (const name of ['Minu märkmed', 'Kohtumised', 'Kokkuvõtted']) { await part(spec, name); menteeAll.push(await text(spec)); }
    await grab(spec, 'mentee_summaries');
    rec.menteeConfirm = [await clickIf(spec, /^Kinnitan/)]; rec.menteeConfirm.push(await clickIf(spec, /^Vajuta uuesti/)); save();
    await grab(spec, 'mentee_after_confirm');
    const afterBoth = await h.prisma.mentoringSummary.findFirst({where: {relationId: 'cmvgp8xii002hd0ts3kgfmej1'}, select: {status: true, _count: {select: {confirmations: true}}}}).catch(e => ({error: String(e.message).slice(0, 80)}));
    check('mentor_private_note_hidden_from_mentee', !menteeAll.some(t => t.includes(NOTE)), {noteVisibleToMentee: menteeAll.some(t => t.includes(NOTE))});
    check('meeting_visible_to_both', menteeAll[1].includes('töörolli piirid'), {meetingAdded: rec.meetingAdd, menteeSeesTopic: menteeAll[1].includes('töörolli piirid'), timeInput: rec.meetingTimeInput});
    check('summary_needs_both_confirmations', afterMentor?.status !== 'CONFIRMED' && afterBoth?.status === 'CONFIRMED', {afterMentorOnly: afterMentor, afterBoth, mentorPresses: rec.mentorConfirm, menteePresses: rec.menteeConfirm});
  }
  if (stage === 'summary') {
    // The flow stage looked for "Kinnitan" while the draft offers "Saada kinnitamisele" (harness); this stage does both sides.
    rec.summaryRawNote = 'flow stage: summary draft created (201) but not sent; the harness pattern did not match Saada kinnitamisele.'; save();
    const REL = '/mentorlus/suhe/cmvgp8xii002hd0ts3kgfmej1';
    const part = async (page, name) => { await page.getByRole('button', {name: 'Kogu suhe'}).first().click().catch(() => {}); await page.waitForTimeout(600); await page.locator('#main').getByRole('button', {name: new RegExp('^' + name)}).first().click(); await page.waitForTimeout(1500); };
    const state = () => h.prisma.mentoringSummary.findFirst({where: {relationId: 'cmvgp8xii002hd0ts3kgfmej1'}, select: {status: true, _count: {select: {confirmations: true}}}});
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await prov.goto(REL, {waitUntil: 'networkidle', timeout: 90000}); await part(prov, 'Kokkuvõtted');
    await prov.locator('#main').getByRole('button', {name: /^Sünteetiline kokkuvõte/}).first().click(); await prov.waitForTimeout(1200);
    rec.mentorSend = [await clickIf(prov, 'Saada kinnitamisele')]; rec.mentorSend.push(await clickIf(prov, /^Vajuta uuesti/)); save();
    await grab(prov, 'mentor_after_send');
    const afterMentor = await state();
    const spec = await (await h.login('specialist')).newPage(); watch(spec, 'specialist');
    await spec.goto(REL, {waitUntil: 'networkidle', timeout: 90000}); await part(spec, 'Kokkuvõtted');
    await spec.locator('#main').getByRole('button', {name: /^Sünteetiline kokkuvõte/}).first().click(); await spec.waitForTimeout(1200);
    await grab(spec, 'mentee_summary_detail');
    rec.menteeConfirm = [await clickIf(spec, /^Kinnitan/)]; rec.menteeConfirm.push(await clickIf(spec, /^Vajuta uuesti/)); save();
    await grab(spec, 'mentee_after_confirm');
    const afterBoth = await state();
    check('summary_needs_both_confirmations', afterMentor.status !== 'CONFIRMED' && afterBoth.status === 'CONFIRMED', {afterMentorSend: afterMentor, afterMenteeConfirm: afterBoth, mentorPresses: rec.mentorSend, menteePresses: rec.menteeConfirm});
  }
  if (stage === 'summary2') {
    const REL = '/mentorlus/suhe/cmvgp8xii002hd0ts3kgfmej1';
    const part = async (page, name) => { await page.getByRole('button', {name: 'Kogu suhe'}).first().click().catch(() => {}); await page.waitForTimeout(600); await page.locator('#main').getByRole('button', {name: new RegExp('^' + name)}).first().click(); await page.waitForTimeout(1500); };
    const state = () => h.prisma.mentoringSummary.findFirst({where: {relationId: 'cmvgp8xii002hd0ts3kgfmej1'}, select: {status: true, _count: {select: {confirmations: true}}}});
    const afterOne = await state();
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await prov.goto(REL, {waitUntil: 'networkidle', timeout: 90000}); await part(prov, 'Kokkuvõtted');
    await prov.locator('#main').getByRole('button', {name: /^Sünteetiline kokkuvõte/}).first().click(); await prov.waitForTimeout(1200);
    rec.mentorConfirm = [await clickIf(prov, 'Kinnitan kokkuvõtte')]; rec.mentorConfirm.push(await clickIf(prov, /^Vajuta uuesti/)); save();
    await grab(prov, 'mentor_after_confirm');
    const afterBoth = await state();
    check('summary_needs_both_confirmations', afterOne.status === 'PENDING_CONFIRM' && afterOne._count.confirmations === 1 && afterBoth.status === 'CONFIRMED',
      {sendingDidNotConfirm: true, afterMenteeOnly: afterOne, afterMentorToo: afterBoth, mentorPresses: rec.mentorConfirm});
  }
  if (stage === 'close') {
    const REL = '/mentorlus/suhe/cmvgp8xii002hd0ts3kgfmej1';
    const part = async (page, name) => { await page.getByRole('button', {name: 'Kogu suhe'}).first().click().catch(() => {}); await page.waitForTimeout(600); await page.locator('#main').getByRole('button', {name: new RegExp('^' + name)}).first().click(); await page.waitForTimeout(1500); };
    const prov = await (await h.login('provider')).newPage(); watch(prov, 'provider');
    await prov.goto(REL, {waitUntil: 'networkidle', timeout: 90000}); await part(prov, 'Suhte seis');
    const endBtn = prov.locator('#main').getByRole('button', {name: /^Lõpeta suhe/}).first();
    await endBtn.click(); await prov.waitForTimeout(1500);
    await grab(prov, 'end_preview');
    rec.endPress = [];
    // The preview's final button is exactly "Lõpeta suhe" (the first close run's pattern missed it: harness).
    const finalBtn = prov.locator('#main').getByRole('button', {name: 'Lõpeta suhe', exact: true});
    if (await finalBtn.count()) { await finalBtn.click(); await prov.waitForTimeout(1500); rec.endPress.push('Lõpeta suhe'); }
    const again = await clickIf(prov, /^Vajuta uuesti/); if (again) rec.endPress.push(again);
    save(); await grab(prov, 'after_end');
    const rel = await h.prisma.mentoringRelation.findUnique({where: {id: 'cmvgp8xii002hd0ts3kgfmej1'}, select: {status: true}});
    await prov.goto(REL, {waitUntil: 'networkidle'}); await part(prov, 'Kohtumised');
    const addVisible = await prov.locator('#main').getByRole('button', {name: 'Lisa kohtumine'}).count();
    const notes = await h.prisma.mentoringPrivateNote.count({where: {relationId: 'cmvgp8xii002hd0ts3kgfmej1'}});
    const confirmed = await h.prisma.mentoringSummary.count({where: {relationId: 'cmvgp8xii002hd0ts3kgfmej1', status: 'CONFIRMED'}});
    check('ended_relation_refuses_new_meeting_and_keeps_records', rel.status !== 'ACTIVE' && addVisible === 0, {relationStatus: rel.status, addMeetingButtons: addVisible, endPresses: rec.endPress, privateNotesKept: notes, confirmedSummariesKept: confirmed});
  }
  console.log(JSON.stringify({checks: rec.checks.map(c => c.variant_id + ':' + c.status), lastNet: rec.network.slice(-3).map(n => n.method + ' ' + n.path + ' ' + n.status)}));
} catch (e) { rec.error = String(e.message).split('\n').slice(0, 3).join(' | '); save(); console.log('ERROR', rec.error); }
finally { save(); await h.close(); }

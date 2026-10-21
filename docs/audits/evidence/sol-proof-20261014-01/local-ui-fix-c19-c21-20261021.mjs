import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// 21.10 checks of the fixes C19 (work due date), C20 (supervision invitation by e-mail) and C21 (covision invitation
// visible in the invitee's list) in the isolated local copy through the same HTTP routes the pages call and the real
// pages. Synthetic accounts only; the supervisor right is a labelled 2-hour fixture revoked at the end; the due date
// set on a synthetic inbox item is removed at the end.
const [root, harnessPath, out] = process.argv.slice(2);
const {harness, ACTORS} = await import(pathToFileURL(harnessPath));
const h = await harness(root);
const ORG = 'cmvgiy1ly0000b0tsx3ok71wd';
const rec = {rawRuns: {'local-ui-fix-c19-c21-20261021-raw.json': 'PRODUCT: the date pattern of the first C19 code had lost its backslashes (/^(d{4})…/), so every date was refused as invalid; fixed before commit. Harness: the invitation route answers 201, and the card check expected one continuous text.', 'local-ui-fix-c19-c21-20261021-raw2.json': 'harness: the card kicker is upper-cased by CSS; the card read "KUTSE OOTAB VASTUST Kutse Kovisiooni …" (product correct)'}, runId: 'sol-proof-20261014-01', checkpointDate: '2026-10-21', environment: 'isolated local copy at localhost:3002, code = origin/main 85eb5b81 with the C19-C21 fixes, database sol_proof_20261020_local; headless browser', checks: [], api: []};
const save = () => fs.writeFileSync(out, JSON.stringify(rec, null, 2) + '\n');
const check = (case_id, variant_id, ok, actual) => { rec.checks.push({case_id, variant_id, status: ok ? 'PASS' : 'FAIL', evidence_mode: 'CURRENT_RUNTIME', entrypoint: 'HTTP routes and real pages in the isolated local copy', actual}); save(); };
const call = async (ctx, method, path, data) => { const r = await ctx.request.fetch(path, {method, data, headers: {'x-ui-locale': 'et', 'accept-language': 'et'}}); let body = null; try { body = await r.json(); } catch {} rec.api.push({method, path: path.replace(/[a-z0-9]{20,}/g, '<id>'), status: r.status(), messageKey: body?.messageKey ?? null}); return {status: r.status(), body}; };
const today = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Europe/Tallinn'}).format(new Date());
let grant = null, dueItem = null, coordinatorCtx = null;
try {
  const {prisma} = h;
  const spec = await h.login('specialist'), prov = await h.login('provider'), client = await h.login('client');
  const emails = Object.fromEntries(await Promise.all(Object.entries(ACTORS).map(async ([k, a]) => [k, (await prisma.user.findUnique({where: {id: a.id}, select: {email: true}})).email])));

  // C20: supervision invitation by e-mail.
  grant = await prisma.supervisorGrant.create({data: {userId: ACTORS.specialist.id, grantBasis: 'SOL TEST eligibility fixture; not a real qualification (local copy 21.10, C20)', validUntil: new Date(Date.now() + 2 * 3600000)}});
  const proc = await call(spec, 'POST', '/api/supervision/processes', {type: 'INDIVIDUAL', title: 'SOL TEST kutse e-posti järgi', goal: 'Sünteetiline protsess kutse kontrolliks.', plannedMeetingCount: 1});
  const processId = proc.body?.process?.id || proc.body?.id;
  const byEmail = await call(spec, 'POST', `/api/supervision/processes/${processId}/invites`, {email: emails.provider.toUpperCase()});
  const invited = (byEmail.body?.process?.participants || byEmail.body?.participants || []).some(p => p.status === 'INVITED');
  const dbInvited = await prisma.supervisionParticipation.findFirst({where: {processId, userId: ACTORS.provider.id}, select: {status: true}});
  check('TOOLS-03', 'supervision_invite_by_email', [200, 201].includes(byEmail.status) && dbInvited?.status === 'INVITED', {status: byEmail.status, participationStatus: dbInvited?.status ?? null, listedInResponse: invited, emailCaseDifferent: true, before20_10: 'internal user ID only'});
  const unknown = await call(spec, 'POST', `/api/supervision/processes/${processId}/invites`, {email: 'sol-test-not-registered@example.invalid'});
  const clientRole = await call(spec, 'POST', `/api/supervision/processes/${processId}/invites`, {email: emails.client});
  check('TOOLS-03', 'supervision_invite_unknown_and_wrong_role_same_answer', unknown.status === 422 && clientRole.status === 422 && unknown.body?.messageKey === 'supervision.errors.invitee_not_found' && clientRole.body?.messageKey === unknown.body?.messageKey,
    {unknown: {status: unknown.status, messageKey: unknown.body?.messageKey}, clientRole: {status: clientRole.status, messageKey: clientRole.body?.messageKey}});

  // C21: covision invitation card in the invitee's list.
  const seed = (await call(spec, 'POST', '/api/topic-seeds', {title: 'Koostöö piirid võrgustikutöös (sünteetiline)', contextType: 'adult', caseType: 'current', whyNow: 'Ebaselge, kes võrgustikus vastutab; olukord on üldistatud (sünteetiline katse).', requestedSupport: ['boundaries'], importance: 5, safetyGate: 'no_immediate_risk'})).body?.seed;
  const queued = (await call(spec, 'POST', `/api/topic-seeds/${seed.id}/queue`, {expectedVersion: seed.version, confirmedNoIdentifiers: true, confirmedPrivacyReview: false})).body?.seed;
  const started = await call(spec, 'POST', `/api/topic-seeds/${seed.id}/covision`, {expectedVersion: queued.version});
  const caseId = started.body?.covisionCaseId;
  const session = await call(spec, 'GET', `/api/covision/${caseId}/session`);
  await call(spec, 'POST', `/api/covision/${caseId}/session/actions`, {action: 'INVITE_PARTICIPANT', expectedVersion: session.body?.session?.version, payload: {email: emails.provider, role: 'PARTICIPANT'}});
  const page = await prov.newPage();
  await page.goto('/kovisioon', {waitUntil: 'networkidle', timeout: 90000}); await page.waitForTimeout(3000);
  const main = (await page.locator('main').first().innerText()).replace(/\s+/g, ' ');
  const low = main.toLowerCase(); // the kicker is upper-cased by CSS
  const card = low.includes('kutse ootab vastust') && main.includes('Kutse Kovisiooni') && main.includes('Juhtumi pealkiri ja sisu avanevad');
  const button = await page.getByRole('button', {name: 'Vaata kutset'}).count();
  check('TOOLS-03', 'covision_invitation_card_in_invitee_list', card && button > 0, {cardText: card, viewInvitationButtons: button, titleHidden: !main.includes('Koostöö piirid võrgustikutöös'), before20_10: 'card with an empty heading'});

  // C19: work due date set by the coordinator.
  const grantRow = await prisma.organizationCapabilityGrant.findFirst({where: {capability: 'INBOX_COORDINATOR', revokedAt: null, membership: {organizationId: ORG, status: 'ACTIVE'}}, select: {membership: {select: {userId: true}}}});
  const coordKey = Object.entries(ACTORS).find(([, a]) => a.id === grantRow?.membership?.userId)?.[0];
  rec.coordinator = coordKey || null;
  coordinatorCtx = coordKey === 'specialist' ? spec : coordKey === 'provider' ? prov : coordKey === 'client' ? client : null;
  dueItem = await prisma.organizationInboxItem.findFirst({where: {organizationId: ORG, status: {notIn: ['CLOSED', 'REJECTED', 'RECALLED']}}, orderBy: {receivedAt: 'desc'}, select: {id: true, status: true}});
  rec.dueItem = dueItem;
  const set = await call(coordinatorCtx, 'PATCH', `/api/org/${ORG}/inbox/${dueItem.id}`, {dueOn: today});
  const item = await call(coordinatorCtx, 'GET', `/api/org/${ORG}/inbox/${dueItem.id}`);
  const list = await call(coordinatorCtx, 'GET', `/api/org/${ORG}/inbox`);
  const row = (list.body?.items || []).find(i => i.id === dueItem.id);
  const past = await call(coordinatorCtx, 'PATCH', `/api/org/${ORG}/inbox/${dueItem.id}`, {dueOn: '2020-01-01'});
  const audit = await prisma.dataAuditLog.findFirst({where: {action: 'org.inbox_due_date_set', resourceId: dueItem.id}, orderBy: {createdAt: 'desc'}, select: {meta: true}});
  check('OPS-03', 'due_date_settable_via_product_path', set.status === 200 && set.body?.due?.dueOn === today && item.body?.item?.dueOn === today && item.body?.item?.overdue === false && row?.dueOn === today,
    {set: set.status, dueOn: item.body?.item?.dueOn ?? null, overdueToday: item.body?.item?.overdue ?? null, listRowDueOn: row?.dueOn ?? null, auditMeta: audit?.meta ?? null, before20_10: 'dueAt had readers but no writer'});
  check('OPS-03', 'due_date_in_past_refused', past.status === 400 && past.body?.messageKey === 'org.errors.inbox_due_in_past', {status: past.status, messageKey: past.body?.messageKey ?? null});
  const p2 = await coordinatorCtx.newPage();
  await p2.goto(`/org/${ORG}/vastuvott/${dueItem.id}`, {waitUntil: 'networkidle', timeout: 90000}); await p2.waitForTimeout(2500);
  const pkg = (await p2.locator('main').first().innerText()).replace(/\s+/g, ' ');
  await p2.getByRole('radio', {name: /Töö/}).first().click().catch(() => {}); await p2.waitForTimeout(1200);
  const workText = (await p2.locator('main').first().innerText()).replace(/\s+/g, ' ');
  const shownDay = today.split('-').reverse().join('.');
  check('OPS-03', 'due_date_visible_on_item_page', pkg.includes(`Töö tähtaeg`) && pkg.includes(shownDay) && /Salvesta tähtaeg/.test(workText), {factShown: pkg.includes(shownDay), formShown: /Salvesta tähtaeg/.test(workText)});
} catch (error) {
  rec.error = String(error.message).split('\n').slice(0, 3).join(' | ');
} finally {
  if (dueItem && coordinatorCtx) { await call(coordinatorCtx, 'PATCH', `/api/org/${ORG}/inbox/${dueItem.id}`, {dueOn: null}).catch(() => {}); rec.dueCleared = true; }
  if (grant) { await h.prisma.supervisorGrant.update({where: {id: grant.id}, data: {revokedAt: new Date()}}); rec.fixtureGrantRevoked = true; }
  save(); await h.close();
}
console.log(JSON.stringify({checks: rec.checks.map(c => `${c.variant_id}:${c.status}`), coordinator: rec.coordinator, error: rec.error || null}));

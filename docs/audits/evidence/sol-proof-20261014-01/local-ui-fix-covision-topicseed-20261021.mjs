import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// 21.10 checks of fixes A4 (topic seed privacy check) and A5 (covision agreement waits for the settings) in the isolated
// local copy: the seeds and the covision are made through the same HTTP routes the pages call, the invitee's view is the
// real page in a headless browser. Synthetic accounts and a .invalid invitation address only.
const [root, harnessPath, out] = process.argv.slice(2);
const {harness} = await import(pathToFileURL(harnessPath));
const h = await harness(root);
const rec = {runId: 'sol-proof-20261014-01', checkpointDate: '2026-10-21', environment: 'isolated local copy at localhost:3002, code = fix worktree with the 21.10 fixes, database sol_proof_20261020_local; headless browser', checks: [], api: []};
const save = () => fs.writeFileSync(out, JSON.stringify(rec, null, 2) + '\n');
const check = (case_id, variant_id, ok, actual) => { rec.checks.push({case_id, variant_id, status: ok ? 'PASS' : 'FAIL', evidence_mode: 'CURRENT_RUNTIME', entrypoint: 'HTTP routes and real covision page in the isolated local copy', actual}); save(); };
const call = async (ctx, method, path, data) => { const r = await ctx.request.fetch(path, {method, data, headers: {'x-ui-locale': 'et'}}); let body = null; try { body = await r.json(); } catch {} rec.api.push({method, path: path.replace(/[a-z0-9]{20,}/g, '<id>'), status: r.status()}); return {status: r.status(), body}; };
const seedBody = title => ({title, contextType: 'adult', caseType: 'current', whyNow: 'Ebaselge, kes võrgustikus vastutab; olukord on üldistatud (sünteetiline katse).', requestedSupport: ['boundaries'], importance: 5, safetyGate: 'no_immediate_risk'});
try {
  const spec = await h.login('specialist'), prov = await h.login('provider');
  // A4: a name is still stopped and the answer says which words; an institution name passes.
  const named = await call(spec, 'POST', '/api/topic-seeds', seedBody('SOL TEST Mari Maasikas ja koostöö'));
  const namedSeed = named.body?.seed;
  const namedQueue = await call(spec, 'POST', `/api/topic-seeds/${namedSeed.id}/queue`, {expectedVersion: namedSeed.version, confirmedNoIdentifiers: true, confirmedPrivacyReview: false});
  const flagged = (namedQueue.body?.privacyMatches || []).map(m => m.text);
  check('TOOLS-03', 'topic_seed_name_blocked_with_flagged_words', namedQueue.status === 422 && flagged.some(t => t.includes('Mari Maasikas')), {status: namedQueue.status, messageKey: namedQueue.body?.messageKey, privacyMatches: flagged});
  const institution = await call(spec, 'POST', '/api/topic-seeds', seedBody('Koostöö Eesti Töötukassaga digiabi olukorras'));
  const instSeed = institution.body?.seed;
  const instQueue = await call(spec, 'POST', `/api/topic-seeds/${instSeed.id}/queue`, {expectedVersion: instSeed.version, confirmedNoIdentifiers: true, confirmedPrivacyReview: false});
  check('TOOLS-03', 'topic_seed_institution_name_passes', instQueue.status === 200, {status: instQueue.status, messageKey: instQueue.body?.messageKey ?? null, before20_10: '422 PERSON_NAME for "Eesti Töötukassaga"'});

  // A5: the invitee cannot accept the agreement before the case bringer confirmed the settings, and sees why.
  const started = await call(spec, 'POST', `/api/topic-seeds/${instSeed.id}/covision`, {expectedVersion: instQueue.body.seed.version});
  const caseId = started.body?.covisionCaseId;
  rec.covisionStartKeys = Object.keys(started.body || {}); save();
  const session = await call(spec, 'GET', `/api/covision/${caseId}/session`);
  const version = session.body?.session?.version ?? session.body?.version;
  const provider = await h.prisma.user.findUnique({where: {id: 'cmv7uufvh0006u3kmo6mc5zrr'}, select: {email: true}});
  const invited = await call(spec, 'POST', `/api/covision/${caseId}/session/actions`, {action: 'INVITE_PARTICIPANT', expectedVersion: version, payload: {email: provider.email, role: 'PARTICIPANT'}});
  rec.invite = {status: invited.status, caseFound: Boolean(caseId)}; save();
  const page = await prov.newPage();
  await page.goto(`/kovisioon?case=${caseId}`, {waitUntil: 'networkidle', timeout: 90000}); await page.waitForTimeout(2500);
  // The confirmations are in the Ring part; the page saves and returns to part 1 after each one (as in local-ui-covision.mjs).
  const ring = async p => { await p.getByRole('button', {name: 'Ring', exact: true}).click(); await p.waitForTimeout(1200); };
  await ring(page); await page.getByRole('button', {name: /Kinnitan oma rolli/}).first().click(); await page.waitForTimeout(2500); await ring(page);
  const agreeBefore = page.getByRole('button', {name: /Nõustun kokkuleppega/}).first();
  const disabledBefore = (await agreeBefore.count()) ? !(await agreeBefore.isEnabled()) : null;
  const hintBefore = await page.getByText('Kokkuleppega saad nõustuda, kui juhtumi tooja on seaded kinnitanud.').count();
  check('TOOLS-03', 'agreement_waits_for_settings_with_reason', disabledBefore === true && hintBefore > 0, {agreementDisabled: disabledBefore, reasonShown: hintBefore > 0, before20_10: 'enabled; pressing it answered 409 "Kovisiooni salvestamine ebaõnnestus."'});
  // The case bringer confirms the case and the settings through the real page.
  const sp = await spec.newPage();
  await sp.goto(`/kovisioon?case=${caseId}`, {waitUntil: 'networkidle', timeout: 90000}); await sp.waitForTimeout(2500);
  const pressed = [];
  for (const name of [/Kinnitan oma rolli/, /Juhtumi piir ja anonüümsus on õiged/, /Kinnita seaded/]) {
    await sp.getByRole('button', {name: 'Ring', exact: true}).click().catch(() => {}); await sp.waitForTimeout(900);
    const b = sp.getByRole('button', {name}).first();
    if (await b.count() && await b.isEnabled()) { await b.click(); await sp.waitForTimeout(1800); pressed.push(String(name)); }
  }
  rec.caseBringerPressed = pressed; save();
  await page.reload({waitUntil: 'networkidle'}); await page.waitForTimeout(2500);
  await ring(page);
  const agreeAfter = page.getByRole('button', {name: /Nõustun kokkuleppega/}).first();
  const enabledAfter = (await agreeAfter.count()) ? await agreeAfter.isEnabled() : null;
  let acceptStatus = null;
  if (enabledAfter) {
    const response = page.waitForResponse(r => r.url().includes('/session/actions') && r.request().method() === 'POST', {timeout: 20000});
    await agreeAfter.click(); acceptStatus = (await response).status();
  }
  check('TOOLS-03', 'agreement_enabled_after_settings_and_saves', enabledAfter === true && acceptStatus === 200, {agreementEnabled: enabledAfter, acceptStatus, caseBringerPressed: pressed});
} catch (error) {
  rec.error = String(error.message).split('\n').slice(0, 3).join(' | ');
} finally { save(); await h.close(); }
console.log(JSON.stringify({checks: rec.checks.map(c => `${c.variant_id}:${c.status}`), error: rec.error || null}));

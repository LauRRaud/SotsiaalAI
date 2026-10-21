import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// 21.10 check of fix A6: the supervision close wizard keeps the final press locked while the mandatory generalised title
// is missing and says why. A new synthetic process of the synthetic supervisor (fixture SupervisorGrant, as on 20.10)
// is created through the same route the page calls and closed through the real page.
const [root, harnessPath, out] = process.argv.slice(2);
const {harness} = await import(pathToFileURL(harnessPath));
const h = await harness(root);
const rec = {runId: 'sol-proof-20261014-01', checkpointDate: '2026-10-21', environment: 'isolated local copy at localhost:3002, code = fix worktree with the 21.10 fixes, database sol_proof_20261020_local; headless browser', checks: [], steps: []};
const save = () => fs.writeFileSync(out, JSON.stringify(rec, null, 2) + '\n');
const check = (variant_id, ok, actual) => { rec.checks.push({case_id: 'TOOLS-03', variant_id, status: ok ? 'PASS' : 'FAIL', evidence_mode: 'CURRENT_RUNTIME', entrypoint: 'real supervision close page in the isolated local copy', actual}); save(); };
const finalButton = page => page.getByRole('button', {name: /^Sulgen protsessi lõplikult/}).first();
async function toLastStep(page) {
  for (let i = 0; i < 4; i++) {
    const next = page.getByRole('button', {name: 'Järgmine samm'}).first();
    if (!(await next.count()) || !(await next.isEnabled())) break;
    await next.click(); await page.waitForTimeout(1000);
  }
}
try {
  // Labelled eligibility fixture for this check only (the 20.10 one expired the same evening); revoked at the end.
  const grant = await h.prisma.supervisorGrant.create({data: {userId: 'cmv7uufv50003u3kmxjmb35yj', grantBasis: 'SOL TEST eligibility fixture; not a real qualification (local copy 21.10)', validUntil: new Date(Date.now() + 2 * 3600000)}});
  rec.fixtureGrant = {id: grant.id, validUntil: grant.validUntil}; save();
  const ctx = await h.login('specialist');
  let created = null;
  for (const type of ['INDIVIDUAL', 'individual', 'INDIVIDUAALNE']) {
    const r = await ctx.request.post('/api/supervision/processes', {data: {type, title: 'SOL TEST sulgemise kontroll', goal: 'Sünteetiline protsess sulgemisviisardi kontrolliks.', plannedMeetingCount: 1}});
    rec.steps.push({create: type, status: r.status()});
    if (r.ok()) { created = await r.json(); break; }
  }
  const processId = created?.process?.id || created?.id;
  rec.processFound = Boolean(processId); save();
  const page = await ctx.newPage();
  await page.goto(`/supervisioon/${processId}/sulge`, {waitUntil: 'networkidle', timeout: 90000}); await page.waitForTimeout(2500);
  await toLastStep(page);
  const button = finalButton(page);
  const lockedWithoutTitle = (await button.count()) ? !(await button.isEnabled()) : null;
  const reasonShown = await page.getByText('Üldistatud pealkiri on puudu.').count();
  check('close_final_press_locked_without_title', lockedWithoutTitle === true && reasonShown > 0, {finalButtonFound: (await button.count()) > 0, locked: lockedWithoutTitle, reasonShown: reasonShown > 0, before20_10: 'two presses possible, then returned to step 2'});
  await page.reload({waitUntil: 'networkidle'}); await page.waitForTimeout(2500);
  for (let i = 0; i < 4; i++) {
    const field = page.getByRole('textbox', {name: 'Üldistatud pealkiri'});
    if (await field.count()) { await field.fill('Supervisioon: töörolli piirid (sünteetiline)'); break; }
    const next = page.getByRole('button', {name: 'Järgmine samm'}).first();
    if (!(await next.count())) break;
    await next.click(); await page.waitForTimeout(1000);
  }
  await toLastStep(page);
  const enabledWithTitle = (await finalButton(page).count()) ? await finalButton(page).isEnabled() : null;
  let closeStatus = null;
  if (enabledWithTitle) {
    await finalButton(page).click(); await page.waitForTimeout(800);
    const again = page.getByRole('button', {name: /Vajuta uuesti/}).first();
    const response = page.waitForResponse(r => r.url().includes('/close') && r.request().method() === 'POST', {timeout: 20000});
    if (await again.count()) await again.click();
    closeStatus = (await response).status();
  }
  check('close_with_title_enabled_and_closes', enabledWithTitle === true && closeStatus === 200, {enabled: enabledWithTitle, closeStatus});
} catch (error) {
  rec.error = String(error.message).split('\n').slice(0, 3).join(' | ');
} finally {
  if (rec.fixtureGrant) { await h.prisma.supervisorGrant.update({where: {id: rec.fixtureGrant.id}, data: {revokedAt: new Date()}}); rec.fixtureGrant.revoked = true; }
  save(); await h.close();
}
console.log(JSON.stringify({checks: rec.checks.map(c => `${c.variant_id}:${c.status}`), steps: rec.steps, error: rec.error || null}));

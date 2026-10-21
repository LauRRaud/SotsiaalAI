import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
// 21.10 check of the owner's decisions in the isolated local copy: the chat shows an admin which role it answers as,
// and the key-authenticated background jobs pass the closed gate while money and data-export jobs stay behind it.
// The admin is a labelled synthetic fixture of the local database only; its one-time login token stays in this process.
const require = createRequire(import.meta.url);
const {chromium} = require('C:/Users/rauds/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core');
const [root, out] = process.argv.slice(2);
assert.match(process.env.DATABASE_URL || '', /\/sol_proof_20261020_local(\?|$)/, 'Only the isolated local database is allowed');
const {prisma} = await import(pathToFileURL(root + '/lib/prisma.js'));
const BASE = 'http://localhost:3002';
// Expected labels are the catalogue's role names (messages/et.json workspace_feature_pages.roles), not the code fallbacks.
const rec = {rawRuns: {'local-ui-admin-role-caption-20261021-raw.json': 'harness: expected the code fallback "Spetsialist"; the page shows the catalogue name "Sotsiaaltöö spetsialist" (product correct)'}, runId: 'sol-proof-20261014-01', checkpointDate: '2026-10-21', environment: 'isolated local copy at localhost:3002, code = origin/main b83b4cf5 plus the 21.10 owner-decision changes, database sol_proof_20261020_local; headless browser', checks: []};
const check = (case_id, variant_id, ok, actual) => rec.checks.push({case_id, variant_id, status: ok ? 'PASS' : 'FAIL', evidence_mode: 'CURRENT_RUNTIME', entrypoint: 'local copy HTTP routes and real chat page', actual});
const browser = await chromium.launch({headless: true, args: ['--mute-audio'], executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe'});
try {
  // Jobs through the closed gate.
  const ctx0 = await browser.newContext({baseURL: BASE});
  const status = {};
  for (const job of ['notifications', 'practice-reviews', 'payment-emails', 'subscription-renewals', 'subscription-reconcile', 'usage-reservation-reaper', 'data-exports']) {
    const r = await ctx0.request.post('/api/jobs/' + job, {headers: {'x-cron-key': 'sol-test-wrong-key'}});
    let body = null; try { body = await r.json(); } catch {}
    status[job] = {status: r.status(), body: body?.error || body?.message || body?.messageKey || null};
  }
  const open = ['notifications', 'practice-reviews'], gated = ['payment-emails', 'subscription-renewals', 'subscription-reconcile', 'usage-reservation-reaper', 'data-exports'];
  check('OPS-06', 'safety_and_notification_jobs_reach_their_key_check', open.every(j => status[j].status === 401), {jobs: Object.fromEntries(open.map(j => [j, status[j]])), before21_10: '503 platform_not_open'});
  check('OPS-06', 'money_and_export_jobs_stay_behind_the_gate', gated.every(j => status[j].status === 503 && status[j].body === 'platform_not_open'), {jobs: Object.fromEntries(gated.map(j => [j, status[j]]))});
  // Admin chat caption.
  const email = 'sol-proof-20261021-admin@example.invalid';
  const admin = await prisma.user.upsert({where: {email}, update: {}, create: {email, emailVerified: new Date(), role: 'ADMIN', isAdmin: true, profile: {create: {firstName: 'SOL TEST', lastName: 'Admin (lokaalne fixture)'}}}, select: {id: true}});
  rec.fixtureAdmin = {email, note: 'local isolated database only'};
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.loginTempToken.create({data: {userId: admin.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 300000), requiresOtp: false}});
  const ctx = await browser.newContext({baseURL: BASE, locale: 'et-EE', viewport: {width: 1280, height: 900}});
  const csrf = await (await ctx.request.get('/api/auth/csrf')).json();
  await ctx.request.post('/api/auth/callback/credentials', {form: {csrfToken: csrf.csrfToken, temp_login_token: token, callbackUrl: BASE + '/admin', json: 'true'}});
  const session = await (await ctx.request.get('/api/auth/session')).json();
  assert.equal(session?.user?.id, admin.id, 'admin login failed');
  await ctx.request.put('/api/profile/view-role', {data: {viewRole: null}});
  const page = await ctx.newPage();
  await page.goto('/vestlus', {waitUntil: 'networkidle', timeout: 90000}); await page.waitForTimeout(4000);
  const caption = page.locator('.admin-role-view-cycle__caption').first();
  const before = (await caption.count()) ? (await caption.innerText()).trim() : null;
  await page.getByRole('button', {name: 'Pöörduja'}).first().click(); await page.waitForTimeout(3000);
  const after = (await caption.count()) ? (await caption.innerText()).trim() : null;
  const role = await (await ctx.request.get('/api/auth/session')).json();
  check('ENV-03', 'admin_chat_shows_answering_role', before === 'Vastan kui: Sotsiaaltöö spetsialist' && after === 'Vastan kui: Pöörduja', {captionWithoutViewRole: before, captionAfterSwitchToClient: after});
  await ctx.request.put('/api/profile/view-role', {data: {viewRole: null}});
  rec.restoredViewRole = true; rec.sessionRoleAfter = role?.user?.role ?? null;
} catch (error) {
  rec.error = String(error.message).split('\n').slice(0, 3).join(' | ');
} finally {
  fs.writeFileSync(out, JSON.stringify(rec, null, 2) + '\n');
  await browser.close(); await prisma.$disconnect();
}
console.log(JSON.stringify({checks: rec.checks.map(c => `${c.variant_id}:${c.status}`), error: rec.error || null, caption: rec.checks.find(c => c.variant_id === 'admin_chat_shows_answering_role')?.actual}));

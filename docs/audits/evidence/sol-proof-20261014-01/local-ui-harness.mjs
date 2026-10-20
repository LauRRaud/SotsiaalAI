import crypto from 'node:crypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
// Local UI harness for the isolated copy (http://localhost:3002, database sol_proof_20261020_local). Each actor gets
// its own browser context; the one-time login token is created and used inside this process and never printed or saved.
const require = createRequire(import.meta.url);
const {chromium} = require('C:/Users/rauds/AppData/Local/npm-cache/_npx/31e32ef8478fbf80/node_modules/playwright-core');
export const BASE = 'http://localhost:3002';
export const ACTORS = {
  client: {id: 'cmv7uufuo0000u3kmo9ausfgt', role: 'CLIENT'},
  specialist: {id: 'cmv7uufv50003u3kmxjmb35yj', role: 'SOCIAL_WORKER'},
  provider: {id: 'cmv7uufvh0006u3kmo6mc5zrr', role: 'SERVICE_PROVIDER'}
};

export async function harness(root) {
  assert.match(process.env.DATABASE_URL || '', /\/sol_proof_20261020_local(\?|$)/, 'Only the isolated local database is allowed');
  const {prisma} = await import(pathToFileURL(root + '/lib/prisma.js'));
  const browser = await chromium.launch({headless: true, args: ['--mute-audio'], executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe'});
  const contexts = {};
  async function login(key) {
    const actor = ACTORS[key];
    const user = await prisma.user.findUnique({where: {id: actor.id}, select: {email: true, isAdmin: true, role: true}});
    assert.ok(user && user.email.endsWith('@example.invalid') && !user.isAdmin && user.role === actor.role, 'Not the synthetic actor');
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.loginTempToken.create({data: {userId: actor.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 300000), requiresOtp: false}});
    const context = await browser.newContext({baseURL: BASE, locale: 'et-EE', viewport: {width: 1280, height: 900}});
    const csrf = await (await context.request.get('/api/auth/csrf')).json();
    await context.request.post('/api/auth/callback/credentials', {form: {csrfToken: csrf.csrfToken, temp_login_token: token, callbackUrl: BASE + '/admin', json: 'true'}});
    const session = await (await context.request.get('/api/auth/session')).json();
    assert.equal(session?.user?.id, actor.id, 'login failed for ' + key);
    contexts[key] = context;
    return context;
  }
  // A readable picture of the page: headings, visible text and the names of the controls.
  async function snapshot(page, label, file) {
    const data = await page.evaluate(() => {
      const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const name = el => (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      return {
        url: location.pathname + location.search,
        title: document.title,
        text: (document.querySelector('main') || document.body).innerText.replace(/\n{2,}/g, '\n').slice(0, 3000),
        controls: [...document.querySelectorAll('button,a[href],input,textarea,select,[role=radio],[role=tab],[role=button]')].filter(visible)
          .map(el => `${el.tagName.toLowerCase()}${el.getAttribute('role') ? '[' + el.getAttribute('role') + ']' : ''}${el.type && el.tagName === 'INPUT' ? ':' + el.type : ''} ${name(el)}${el.disabled ? ' (disabled)' : ''}`).slice(0, 120)
      };
    });
    if (file) { const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []; all.push({label, ...data}); fs.writeFileSync(file, JSON.stringify(all, null, 2) + '\n'); }
    return data;
  }
  async function close() { await browser.close(); await prisma.$disconnect(); }
  return {prisma, browser, login, snapshot, close, contexts};
}

// Pöörduja eelpöördumise vaated: tekstid on kataloogis ja igal vaatel on nimi.
//
// Vaated loevad teksti nimeruumist `workspace_feature_pages.pre_inquiries`
// kujul tr("võti", "varutekst"). Võti, mida kataloogis ei ole, jääks inglise ja
// vene keeles eestikeelseks varutekstiks ilma, et keegi seda märkaks.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PRE_INQUIRY_SENDER_STATE_KEYS } from '../lib/preInquirySenderState.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const catalog = (lang) => JSON.parse(read(`../messages/${lang}.json`)).workspace_feature_pages.pre_inquiries;
const at = (node, key) => key.split('.').reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), node);
const SOURCES = [
  '../components/workspace/preInquiry/CollectViews.jsx',
  '../components/workspace/preInquiry/DomainsView.jsx',
  '../components/workspace/preInquiry/FlowViews.jsx',
  '../components/workspace/preInquiry/ReceiverViews.jsx',
  '../components/workspace/WorkspaceFeaturePage.jsx'
];
const RECEIVER_KEYS = ['queue', 'inquiry', 'info', 'check', 'plan', 'prepare', 'network', 'settings'];
const FLOW_KEYS = ['journey', 'path', 'situation', 'who', 'urgency', 'domains', 'context', 'assistant', 'review', 'recipient', 'text', 'send', 'saved'];

test('vaadete tekstivõtmed on kataloogis kolmes keeles', () => {
  const keys = new Set();
  for (const source of SOURCES) {
    for (const match of read(source).matchAll(/\btr\(\s*"([a-z_.0-9]+)"/g)) keys.add(match[1]);
  }
  assert.ok(keys.size > 40, `võtmeid leiti ${keys.size}`);
  for (const lang of ['et', 'en', 'ru']) {
    const messages = catalog(lang);
    const missing = [...keys].filter((key) => typeof at(messages, key) !== 'string');
    assert.deepEqual(missing, [], lang);
  }
});

test('igal töövoo vaatel on nimi ja lühinimi kiirmenüü jaoks', () => {
  const page = read('../components/workspace/WorkspaceFeaturePage.jsx');
  for (const key of FLOW_KEYS) assert.ok(page.includes(`"${key}"`), `leht kasutab vaadet ${key}`);
  for (const lang of ['et', 'en', 'ru']) {
    const steps = catalog(lang).steps;
    assert.equal(typeof steps.label, 'string');
    for (const key of FLOW_KEYS) {
      assert.ok(steps[key]?.title && steps[key]?.short, `${lang}: ${key}`);
    }
  }
});

test('vastuvõtja vaadetel on nimi ja lühinimi ning seisu sõnad kannavad oma kohatäitjaid', () => {
  const page = read('../components/workspace/WorkspaceFeaturePage.jsx');
  for (const key of RECEIVER_KEYS) assert.ok(page.includes(`"${key}"`), `leht kasutab vaadet ${key}`);
  for (const lang of ['et', 'en', 'ru']) {
    const receiver = catalog(lang).views.receiver;
    for (const key of RECEIVER_KEYS) {
      assert.ok(receiver.steps[key]?.title && receiver.steps[key]?.short, `${lang}: ${key}`);
    }
    assert.ok(receiver.state.new.includes('{days}'), lang);
    for (const key of ['accepted', 'contact_later', 'contact_due']) assert.ok(receiver.state[key].includes('{date}'), `${lang}: ${key}`);
    for (const key of ['group_new', 'group_mine', 'group_archived']) assert.ok(receiver.queue[key].includes('{count}'), `${lang}: ${key}`);
  }
});

test('vastuvõtja vaade ei näita töövoo koodi ega ava esimest pöördumist ise', () => {
  const page = read('../components/workspace/WorkspaceFeaturePage.jsx');
  assert.ok(!page.includes('{inquiry.status || "DRAFT"}'), 'loend ei trüki olekukoodi');
  assert.ok(!page.includes(': receiverInquiries[0] || null'), 'esimest pöördumist ei avata vaikimisi');
});

test('pöörduja seisu sõnad on kataloogis iga seisu jaoks', () => {
  const states = PRE_INQUIRY_SENDER_STATE_KEYS;
  assert.equal(states.length, 10);
  for (const lang of ['et', 'en', 'ru']) {
    const labels = catalog(lang).sender_state;
    for (const state of states) assert.equal(typeof labels[state], 'string', `${lang}: ${state}`);
    assert.ok(labels.accepted.includes('{date}') && labels.sent_waiting.includes('{days}'), lang);
  }
});

test('paneelis ei ole üldist „Edasi" nuppu ega kerimise vihjet', () => {
  const stage = read('../components/stage/StepFlight.jsx') + read('../components/stage/StepPanel.jsx');
  assert.ok(!stage.includes('scroll-frames'), 'kerimise vihje on eemaldatud');
  const form = read('../components/wellbeing/WellbeingStepForm.jsx');
  assert.ok(!form.includes('next_to'), 'tööheaolu vormis ei ole „Edasi: …" nuppu');
  assert.ok(read('../components/stage/StepRail.jsx').includes('next.onClick'), 'edasi liigutakse kiirmenüü noolest');
});

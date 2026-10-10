// Server vastab tõrke korral tõlkevõtmega ja `errorJson` paneb vastuse väljale `message` selle
// võtme lause. Kui võtit kataloogis ei ole, läheb väljale võti ise ja leht näitab inimesele
// toorest võtit (näiteks „pre_inquiries.errors.save_failed"). See test nõuab, et koodis
// kasutatud tõrke- ja nimevõtmed on kataloogis lausena olemas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serverT } from '../lib/i18n/serverMessages.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = (locale) => JSON.parse(readFileSync(join(root, 'messages', `${locale}.json`), 'utf8'));
const et = catalog('et');
const lookup = (messages, key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), messages);

/* Rühmad, mille võtmed on inimesele näidatavad laused (mitte auditi ega sündmuste nimed). */
const MESSAGE_GROUPS = /^(api\.|pre_inquiries\.errors\.|covision\.errors\.|covision\.next_action\.|materials_page\.errors\.|documents\.errors\.|documents\.agent_workspace\.|privacy\.|service_provider_profile\.errors\.|research\.error\.|home_care\.errors\.|wellbeing\.pilot\.|wellbeing\.aggregate\.|workspace\.kind\.)/;

/* Võtme kujuga sõned, mis ei jõua inimeseni: arendaja või seadistuse vead ja terviseseisu koodid. */
const INTERNAL = new Set([
  'api.auth.account_deleted.email_from_missing',
  'api.auth.login.base_url_missing',
  'api.notifications.invalid_dedupe',
  'api.notifications.invalid_email_policy',
  'api.notifications.invalid_source',
  'api.notifications.invalid_target',
  'api.notifications.invalid_type'
]);

function walk(dir, list = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else if (/\.(js|jsx)$/.test(entry.name)) list.push(full);
  }
  return list;
}

function usedMessageKeys() {
  const namespaces = new Set(Object.keys(et));
  const literal = /(["'`])([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+){1,5})\1/g;
  const used = new Map();
  for (const file of ['app', 'lib', 'components'].flatMap((dir) => walk(join(root, dir)))) {
    for (const match of readFileSync(file, 'utf8').matchAll(literal)) {
      const key = match[2];
      if (!namespaces.has(key.split('.')[0]) || !MESSAGE_GROUPS.test(key)) continue;
      if (!used.has(key)) used.set(key, relative(root, file).split(sep).join('/'));
    }
  }
  return used;
}

test('koodis kasutatud tõrkevõtmed on kataloogis lausena olemas', () => {
  const used = usedMessageKeys();
  assert.ok(used.size > 400, `leitud ${used.size} võtit; otsing on katki`);
  const missing = [];
  for (const [key, file] of used) {
    const value = lookup(et, key);
    /* Rühma nimi (objekt) ei ole viga: kood liidab sellele ise lõpu. */
    if (typeof value === 'string' || (value && typeof value === 'object')) continue;
    if (!INTERNAL.has(key)) missing.push(`${key} (${file})`);
  }
  assert.deepEqual(missing, []);
});

test('server annab eelpöördumise tõrke kohta lause, mitte võtme', () => {
  const keys = [
    'pre_inquiries.errors.save_failed',
    'pre_inquiries.errors.send_failed',
    'pre_inquiries.errors.accept_failed',
    'pre_inquiries.errors.sent_cannot_be_edited',
    'pre_inquiries.errors.service_selection_required',
    'pre_inquiries.errors.recipient_email_required',
    'api.errors.rate_limited',
    'api.rooms.summary_not_confirmed',
    'privacy.confirmation_required'
  ];
  for (const locale of ['et', 'en', 'ru']) {
    for (const key of keys) {
      const text = serverT(locale, key, undefined, key);
      assert.notEqual(text, key, `${locale}: ${key}`);
      assert.ok(text.length > 8 && /\s/.test(text), `${locale}: ${key} = ${text}`);
      assert.equal(/[—–]/.test(text), false, `${locale}: ${key}`);
    }
  }
  /* Sama lause mõlema võtme all: leht ja server ei tohi sama asja kohta eri juttu rääkida. */
  for (const locale of ['et', 'en', 'ru']) {
    const messages = catalog(locale);
    for (const name of ['save_failed', 'accept_failed', 'send_failed', 'workflow_save_failed']) {
      assert.equal(lookup(messages, `pre_inquiries.errors.${name}`), lookup(messages, `workspace_feature_pages.pre_inquiries.errors.${name}`), `${locale}: ${name}`);
    }
  }
});

test('kohtumise kokkuvõtte dokumendi pealkiri on lehe keeles', () => {
  assert.equal(serverT('et', 'documents.agent_workspace.meeting_summary.document_title', undefined, 'Meeting summary'), 'Kohtumise kokkuvõte');
  assert.equal(serverT('ru', 'documents.agent_workspace.meeting_summary.document_title', undefined, 'Meeting summary'), 'Итог встречи');
});

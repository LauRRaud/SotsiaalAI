// Kõne tõrke korral läheb ekraanile lause, mitte kood. Kõne marsruudid vastavad koodiga
// (`call.participants_full`) ja kõneriba näitas seda otse; lause oli ainult kolmel koodil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { callErrorText } from '../lib/calls/errorText.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = (locale) => JSON.parse(readFileSync(join(root, 'messages', `${locale}.json`), 'utf8'));
const lookup = (messages, key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), messages);
const translator = (locale) => {
  const messages = catalog(locale);
  return (key) => {
    const value = lookup(messages, key);
    return typeof value === 'string' ? value : key;
  };
};
const KEY_SHAPE = /^[a-z][a-z0-9_]*(?:\.[A-Za-z0-9_]+)+$/;

function walk(dir, list = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, list);
    else if (/\.(js|jsx)$/.test(entry.name)) list.push(full);
  }
  return list;
}

/** Kõik koodis kasutatud kõne tõrkekoodid. */
function callCodes() {
  const codes = new Set();
  for (const file of ['app', 'lib', 'components'].flatMap((dir) => walk(join(root, dir)))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/["'`](call\.[a-z_]+)["'`]/g)) codes.add(match[1]);
  }
  return [...codes].sort();
}

test('iga kõne tõrkekood annab kolmes keeles lause', () => {
  const codes = callCodes();
  assert.ok(codes.length >= 40, `leitud ${codes.length} koodi; otsing on katki`);
  for (const locale of ['et', 'en', 'ru']) {
    const t = translator(locale);
    for (const code of codes) {
      const text = callErrorText(code, t);
      assert.ok(text && !KEY_SHAPE.test(text) && /\s/.test(text), `${locale}: ${code} = ${text}`);
    }
  }
});

test('koodil on oma lause; tundmatu ja sisemine kood saavad üldise lause', () => {
  const t = translator('et');
  const messages = catalog('et');
  assert.equal(callErrorText('call.participants_full', t), messages.calls.errors.participants_full);
  assert.equal(callErrorText('call.not_active', t), messages.calls.errors.not_active);
  /* Laused, mis olid kataloogis juba teise nime all. Kaks mahupiiri on eri lausega. */
  assert.equal(callErrorText('call.livekit_not_configured', t), messages.calls.not_configured);
  assert.equal(callErrorText('call.recording_storage_quota_exceeded', t), messages.calls.recording_storage_quota_exceeded);
  assert.equal(callErrorText('call.recording_too_large', t), messages.calls.recording_too_large);
  assert.notEqual(messages.calls.recording_storage_quota_exceeded, messages.calls.recording_too_large);
  /* Sisemine kood ja kood, mida veel ei tunta. */
  assert.equal(callErrorText('call.egress_start_timeout', t), messages.calls.errors.generic);
  assert.equal(callErrorText('call.midagi_uut', t), messages.calls.errors.generic);
  /* Ruumi värava vastused tulevad sama teed pidi: tellimus, arhiiv, ligipääs. */
  assert.equal(callErrorText('api.common.subscription_required', t), messages.api.common.subscription_required);
  assert.equal(callErrorText('api.rooms.archived_readonly', t), messages.api.rooms.archived_readonly);
  assert.equal(callErrorText('calls.recording_stop_unconfirmed', t), messages.calls.recording_stop_unconfirmed);
  /* Valmis lause läheb edasi muutmata; tõrke puudumisel teksti ei ole. */
  assert.equal(callErrorText('Serveri lause.', t), 'Serveri lause.');
  assert.equal(callErrorText('', t), '');
  assert.equal(callErrorText(null, t), '');
  /* Ilma tõlkijata ei jõua kood ikkagi ekraanile: tulemus on tühi ja kõneriba paneb oma varulause. */
  assert.equal(callErrorText('call.not_active', null), '');
});

test('kõne alustamise või liitumise tõrge jõuab vestluse veareale', () => {
  /* Kõneriba näitab tõrget ainult avatud kõne detailides. Väljaspool kõnet ei jõudnud tõrge
     ekraanile üldse: nupp „Alusta helikõnet" ei teinud nähtavalt midagi. */
  const chat = readFileSync(join(root, 'components/alalehed/ChatBody.jsx'), 'utf8').replace(/\r\n/g, '\n');
  const start = chat.indexOf('const roomCallError = roomCallSession?.error || "";');
  const effect = chat.slice(start, chat.indexOf('}, [roomCallError, roomCallJoined, t]);', start));
  assert.ok(start > 0 && effect.length > 0);
  /* Üks kord tõrke kohta; kõnes olles näitab tõrget kõneriba ise. */
  assert.match(effect, /if \(roomCallJoined \|\| shownRoomCallErrorRef\.current === roomCallError\) return;/);
  assert.match(effect, /if \(!roomCallError\) \{\n\s+shownRoomCallErrorRef\.current = "";\n\s+return;\n\s+\}/);
  assert.match(effect, /const message = callErrorText\(roomCallError, t\);\n\s+if \(message\) setErrorBanner\(message\);/);
  /* Taustapäringu ja ligipääsu kadumise tõrkeid veareale ei tooda. */
  const quiet = chat.slice(chat.indexOf('const ROOM_CALL_QUIET_ERRORS = new Set(['), chat.indexOf(']);', chat.indexOf('const ROOM_CALL_QUIET_ERRORS')));
  for (const code of ['call.load_failed', 'call.mic_not_controlled_here', 'api.rooms.access_denied', 'api.rooms.not_found', 'api.common.unauthorized']) {
    assert.ok(quiet.includes(`"${code}"`), code);
  }
  assert.equal(quiet.includes('subscription_required'), false, 'tellimuse puudumine peab ekraanile jõudma');
});

test('kõneriba ei näita tõrke koodi otse', () => {
  const bar = readFileSync(join(root, 'components/rooms/RoomCallBar.jsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(bar, /import \{ callErrorText \} from "@\/lib\/calls\/errorText";/);
  assert.match(bar, /: callErrorText\(error, t\) \|\| text\(t, "calls\.errors\.generic", "[^"]+"\)\}/);
  assert.equal(/:\s*error\}/.test(bar), false, 'toorest koodi ei kuvata');
  /* Laused ei sisalda mõttekriipse ja igal keelel on sama hulk lauseid. */
  const sizes = ['et', 'en', 'ru'].map((locale) => {
    const errors = catalog(locale).calls.errors;
    for (const [name, text] of Object.entries(errors)) assert.equal(/[—–]/.test(text), false, `${locale}: ${name}`);
    return Object.keys(errors).length;
  });
  assert.deepEqual(sizes, [sizes[0], sizes[0], sizes[0]]);
});

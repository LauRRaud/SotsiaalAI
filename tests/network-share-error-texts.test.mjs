// Võrgustikujagamise keeldumine jõuab inimeseni lausena, mitte koodina.
//
// Marsruudid vastavad koodiga (`network_share.not_editable`). Töötaja koostamisvaade ja
// saaja postkast näitasid seda koodi ekraanil, sest üldine abiline tagastas sõnumi enda.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { networkShareErrorText } from '../lib/network/shareErrorText.js';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

function files(dir) {
  const out = [];
  for (const name of readdirSync(new URL(dir, root))) {
    const path = `${dir}/${name}`;
    if (statSync(new URL(path, root)).isDirectory()) out.push(...files(path));
    else if (/\.(js|jsx)$/.test(name)) out.push(path);
  }
  return out;
}

/* Kõik koodid, mida jagamise teenuskiht ja marsruudid võivad vastata: täpselt üks lõik pärast
   `network_share.` ja kohe sulgev jutumärk (tõlkevõtmetel nagu `network_share.errors.x` on lõike rohkem). */
const codes = new Set();
for (const path of [...files('lib/network'), ...files('app/api/network-shares'), 'lib/rooms/accessGuard.js']) {
  for (const match of read(path).matchAll(/["'`]network_share\.([a-z0-9_]+)["'`]/g)) codes.add(match[1]);
}

test('võrgustikujagamise iga kood on kolmes keeles lausena olemas', () => {
  assert.ok(codes.size >= 40, `leitud ${codes.size} koodi; otsing on katki`);
  for (const locale of ['et', 'en', 'ru']) {
    const errors = JSON.parse(read(`messages/${locale}.json`)).network_share.errors;
    for (const code of codes) {
      assert.ok(typeof errors[code] === 'string' && errors[code].trim().length > 8, `${locale}: ${code}`);
      /* Lause, mitte kood ega võti. */
      assert.equal(/network_share\.|_/.test(errors[code]), false, `${locale}: ${code} = ${errors[code]}`);
    }
  }
});

test('kood → lause; tundmatu kood, võõras tekst ja puuduv tõlge annavad varuteksti', () => {
  const catalog = JSON.parse(read('messages/et.json'));
  const t = (key) => key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), catalog) ?? key;
  const fallback = 'Toiming ebaõnnestus.';

  assert.equal(networkShareErrorText(t, 'network_share.participation_end_in_past', fallback), 'Kaasamise lõpp ei saa olla minevikus.');
  assert.equal(networkShareErrorText(t, ' network_share.not_editable ', fallback), 'Seda jagamist ei saa enam muuta.');
  /* Üldine võti (nt sisselogimata) lahendatakse samuti. */
  assert.equal(networkShareErrorText(t, 'api.common.unauthorized', fallback), catalog.api.common.unauthorized);

  /* Serveri sõnumit ennast ekraanile ei lasta. */
  for (const foreign of [
    'network_share.code_that_does_not_exist',
    'network_share.errors.action_failed',
    'relation "NetworkShare" does not exist',
    'my_sharings.share_errors.content_changed',
    '<b>tere</b>',
    '',
    null,
    undefined,
    42,
    { message: 'x' }
  ]) {
    assert.equal(networkShareErrorText(t, foreign, fallback), fallback, String(foreign));
  }
  /* Tõlkija, mis tagastab võtme või tühja, ei lase samuti koodi läbi. */
  assert.equal(networkShareErrorText((key) => key, 'network_share.not_found', fallback), fallback);
  assert.equal(networkShareErrorText(() => '', 'network_share.not_found', fallback), fallback);
  assert.equal(networkShareErrorText(null, 'network_share.not_found', fallback), fallback);
});

test('töötaja koostamisvaade ja saaja postkast kasutavad seda abilist', () => {
  for (const path of ['components/network/NetworkShareComposer.jsx', 'components/network/NetworkShareInbox.jsx']) {
    const source = read(path);
    assert.match(source, /networkShareErrorText\(t, payload\?\.message, /, path);
    assert.equal(source.includes('resolveApiMessage'), false, path);
  }
});

// Ekraanile läheb lause, mitte tõlkevõti.
//
// Paljud marsruudid vastavad keeldumisel võtmega sõnumi väljal ja ilma `messageKey`-ta
// (`{ ok: false, message: "network_share.not_editable" }`). Üldine abiline tagastas siis
// sõnumi enda ja inimene nägi toorest võtit. Abilist kasutab mitukümmend vaadet.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveApiMessage } from '../lib/i18n/resolveApiMessage.js';

const catalog = JSON.parse(readFileSync(new URL('../messages/et.json', import.meta.url), 'utf8'));
/* Sama käitumine mis rakenduse tõlkijal: puuduv võti tagastab võtme enda. */
const t = (key) => {
  const value = String(key).split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), catalog);
  return typeof value === 'string' ? value : key;
};
const FALLBACK_KEY = 'my_sharings.errors.action_failed';
const FALLBACK = catalog.my_sharings.errors.action_failed;
const resolve = (payload, extra = {}) => resolveApiMessage({ payload, t, fallbackKey: FALLBACK_KEY, ...extra });

test('võti sõnumi väljal tõlgitakse, mitte ei näidata', () => {
  assert.equal(resolve({ ok: false, message: 'api.common.unauthorized' }), catalog.api.common.unauthorized);
  assert.equal(resolve({ ok: false, message: 'journeys.errors.archived' }), catalog.journeys.errors.archived);
  assert.equal(resolve({ ok: false, message: '  api.common.forbidden  ' }), catalog.api.common.forbidden);
});

test('tõlketa võti ei jõua ekraanile: selle asemel on varutekst', () => {
  for (const raw of ['network_share.code_without_a_sentence', 'some.unknown.key', 'api.rooms.this_is_missing']) {
    const text = resolve({ ok: false, message: raw });
    assert.equal(text, FALLBACK, raw);
  }
  /* Ka siis, kui tõlketa on nii `messageKey` kui ka võtmekujuline sõnum. */
  assert.equal(resolve({ messageKey: 'x.missing_key', message: 'y.other_missing' }), FALLBACK);
  assert.equal(resolve({ messageKey: 'x.missing_key', message: 'x.missing_key' }), FALLBACK);
  assert.equal(resolve({ messageKey: 'x.missing_key' }), FALLBACK);
  /* Tõlgitav võti sõnumi väljal päästab ka tõlketa `messageKey` korral. */
  assert.equal(resolve({ messageKey: 'x.missing_key', message: 'api.common.forbidden' }), catalog.api.common.forbidden);
});

test('lause serverilt ja tõlgitud messageKey käituvad nagu enne', () => {
  assert.equal(resolve({ messageKey: 'api.common.forbidden', message: 'ignored sentence' }), catalog.api.common.forbidden);
  /* Tõlketa `messageKey` kõrval olev lause läheb edasi. */
  assert.equal(resolve({ messageKey: 'x.missing_key', message: 'Faili ei leitud.' }), 'Faili ei leitud.');
  for (const sentence of ['Faili ei leitud.', 'Viga', 'Viga.', 'Liiga palju päringuid, proovi hiljem.', 'E-post example.com ei sobi', '409']) {
    assert.equal(resolve({ ok: false, message: sentence }), sentence, sentence);
  }
});

test('varutekstide järjekord: kutsuja võti, kutsuja tekst, üldine lause; toores võti ainult tõlkijata', () => {
  assert.equal(resolve({}), FALLBACK);
  assert.equal(resolve(null), FALLBACK);
  assert.equal(resolve({ message: '   ' }), FALLBACK);
  /* Kutsuja varuvõtmel ei ole tõlget: kasutatakse tema teksti. */
  assert.equal(resolveApiMessage({ payload: { message: 'a.b' }, t, fallbackKey: 'missing.fallback', fallbackText: 'Ei õnnestunud.' }), 'Ei õnnestunud.');
  /* Ei võtit ega teksti: üldine lause, mitte võti. */
  assert.equal(resolveApiMessage({ payload: { message: 'a.b' }, t, fallbackKey: 'missing.fallback' }), catalog.api.common.server_error);
  assert.equal(resolveApiMessage({ payload: { message: 'a.b' }, t }), catalog.api.common.server_error);
  /* Tõlkijata (serveris või testis) jääb vana käitumine: midagi peab tagasi tulema. */
  assert.equal(resolveApiMessage({ payload: { message: 'a.b' }, fallbackKey: 'k.fallback' }), 'a.b');
  assert.equal(resolveApiMessage({ payload: { messageKey: 'm.key' }, fallbackText: 'Tekst' }), 'Tekst');
  assert.equal(resolveApiMessage({ payload: {}, fallbackKey: 'k.fallback' }), 'k.fallback');
  assert.equal(resolveApiMessage({ payload: {} }), '');
  /* Tõlkija, mis tagastab tühja või mitte-teksti, ei lase samuti võtit läbi. */
  assert.equal(resolveApiMessage({ payload: { message: 'a.b' }, t: () => '', fallbackText: 'Tekst' }), 'Tekst');
  assert.equal(resolveApiMessage({ payload: { message: 'a.b' }, t: () => undefined, fallbackText: 'Tekst' }), 'Tekst');
});

// Isikuandmete kontroll: mida tuvastaja märkab ja mida mitte, millal küsitakse kinnitust ja
// kuidas konto seadete lüliti selle küsimise välja lülitab (omaniku soov 11.10.2026).
//
// Tuvastajal ei olnud enne ühtegi testi. Mõõtmine 11.10.2026: 25 tavalisest lausest sai 13 vale
// hoiatuse (kuupäev, summa, arve- ja viitenumber, registrikood, IBAN, sõna sees olevad numbrid).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { detectPersonalData, isEstonianPersonalCode, redactPersonalData } from '../lib/privacy/piiFilter.js';
import { evaluateTextPrivacy, privacyConfirmationResponsePayload } from '../lib/privacy/privacyGuard.js';
import { localizePrivacyPayload, privacyLocaleFromRequest } from '../lib/privacy/privacyTexts.js';
import {
  STANDING_SEND_ORIGINAL,
  readPrivacyPromptEnabled,
  resolvePrivacyDecision,
  savePrivacyPromptEnabled
} from '../lib/privacy/promptPreference.js';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const kinds = (text) => detectPersonalData(text).categories;

test('tavaline lause ei ole isikuandmed: kuupäev, summa, arve- ja viitenumber, registrikood, IBAN', () => {
  const plain = [
    'Taotluse tähtaeg on 2026-10-11.',
    'Ajavahemik 2026-01-01 - 2026-12-31.',
    'Kohtumine on 11.10.2026 kell 14.00.',
    'Sissetulek oli eelmisel aastal 12 345 678 senti.',
    'Hüvitis on 1 234 567 eurot.',
    'Eelarve on 45 000 000 ja lisaeelarve 5 000 000.',
    'Toetus oli 3 500 000 eurot.',
    'Arve number 20261011 on tasutud.',
    'Arve nr 51234567 on tasutud.',
    'Määruse number on 2025-123456-7.',
    'Viitenumber 123456789012.',
    'Viitenumber 5123456.',
    'Registrikood 12345678.',
    'Registrikood 80123456.',
    'Asutuse nimi on Proovi vald f1234567.',
    'IBAN EE382200221020145685.',
    'Sotsiaalhoolekande seadus § 17 lõige 1 punkt 2.',
    'Abi saab numbrilt 116 111 või 112.',
    'Ohvriabi kriisitelefon 116 006 töötab ööpäev läbi.',
    'Riigiinfo telefon 1247.',
    'Vaata lehte https://www.sotsiaalkindlustusamet.ee/abivahendid.',
    'Summa on 150.50 eurot kuus alates 01.01.2027 kuni 31.12.2027.',
    'Korteri pind on 54,3 ruutmeetrit ja üür 450 eurot.',
    'Lapsed on sündinud 2015 ja 2018.',
    'Tellimuse number 39001010001 ei ole isikukood: kontrollnumber ei klapi.',
    'Läksin mööda vana teed 5 kilomeetrit.'
  ];
  for (const text of plain) assert.deepEqual(kinds(text), [], text);
});

test('telefon, isikukood, e-post ja aadress märgatakse ning varjatakse ainult leitud osa', () => {
  const found = [
    ['Minu telefon on 5123 4567.', 'phone', 'Minu telefon on [telefoninumber].'],
    ['Tel 51234567', 'phone', 'Tel [telefoninumber]'],
    ['Helista mulle +372 5123 4567.', 'phone', 'Helista mulle [telefoninumber].'],
    ['Helista 00372 512 3456 või kirjuta.', 'phone', 'Helista [telefoninumber] või kirjuta.'],
    ['Number on 55 123 456, helista õhtul.', 'phone', 'Number on [telefoninumber], helista õhtul.'],
    ['Kodune number 443 0123 vastab hommikuti.', 'phone', 'Kodune number [telefoninumber] vastab hommikuti.'],
    ['Ema isikukood on 44001010002.', 'estonian_personal_code', 'Ema isikukood on [isikukood].'],
    ['Kirjuta mulle mari.maasikas@example.ee.', 'email', 'Kirjuta mulle [e-posti aadress].'],
    ['Elan aadressil Pikk tn 12-3, Tallinn.', 'address', 'Elan aadressil [aadress], Tallinn.'],
    ['Ema elab J. V. Jannseni tn 4 teisel korrusel.', 'address', 'Ema elab [aadress] teisel korrusel.']
  ];
  for (const [text, kind, masked] of found) {
    assert.deepEqual(kinds(text), [kind], text);
    assert.equal(redactPersonalData(text).redactedText, masked, text);
  }
  /* Mitu liiki ühes tekstis: iga liik üks kord, loendur näitab kordusi. */
  const mixed = detectPersonalData('Tel 5123 4567 ja 5765 4321, e-post a.b@example.ee');
  assert.deepEqual(mixed.findings.map((item) => [item.type, item.count]), [['phone', 2], ['email', 1]]);
});

test('asutuse üldkontakt märgatakse endiselt: seda ei saa inimese omast eristada', () => {
  /* Teadlik piir, mitte viga: inimene otsustab ise. Lause ülejäänud osa jääb alles. */
  assert.equal(redactPersonalData('Vallavalitsus asub aadressil Tartu mnt 5.').redactedText, 'Vallavalitsus asub aadressil [aadress].');
  assert.equal(redactPersonalData('Helista vallamajja 776 0200 tööajal.').redactedText, 'Helista vallamajja [telefoninumber] tööajal.');
  assert.deepEqual(kinds('Kirjuta aadressil info@proovivald.ee.'), ['email']);
});

test('isikukood: sugu ja sajand, kuupäev ja kontrollnumber', () => {
  for (const code of ['44001010002', '39001010000', '48505050018', '60102030029']) assert.equal(isEstonianPersonalCode(code), true, code);
  /* Vale kontrollnumber, võimatu kuu ja päev, vale esimene number, vale pikkus. */
  for (const code of ['44001010005', '44013010002', '44001320002', '74001010002', '4400101000', '440010100021', '']) {
    assert.equal(isEstonianPersonalCode(code), false, code);
  }
  /* Pikema numbri sees olevat koodi ei märgata. */
  assert.deepEqual(kinds('Viide 9440010100025.'), []);
});

test('kinnitust küsitakse isikuandmetega tekstis; privaatses töövoos võib saata siiski, avalikus mitte', () => {
  const text = 'Minu telefon on 5123 4567.';
  const asked = evaluateTextPrivacy(text, { workflow: 'room_private' });
  assert.deepEqual([asked.ok, asked.needsPrivacyConfirmation, asked.allowOriginal, asked.processedText], [false, true, true, '']);
  assert.deepEqual(asked.actions, ['edit', 'use_redacted', 'send_original']);
  assert.equal(asked.warning, 'Tekstis võib olla isikuandmeid: telefoninumber. Saada ainult see, mida on päriselt vaja.');

  const original = evaluateTextPrivacy(text, { workflow: 'room_private', privacyDecision: { action: 'send_original' } });
  assert.deepEqual([original.ok, original.processedText, original.appliedDecision], [true, text, 'send_original']);
  const masked = evaluateTextPrivacy(text, { workflow: 'room_private', privacyDecision: 'use_redacted' });
  assert.deepEqual([masked.ok, masked.processedText], [true, 'Minu telefon on [telefoninumber].']);

  /* Avalik tekst: „saada siiski" ei ole valikute seas ja seda ei arvestata. */
  for (const workflow of ['help_listing_public', 'help_request_public', 'help_offer_public', 'rag_index']) {
    const open = evaluateTextPrivacy(text, { workflow, privacyDecision: { action: 'send_original' } });
    assert.deepEqual([open.ok, open.needsPrivacyConfirmation, open.allowOriginal], [false, true, false], workflow);
    assert.deepEqual(open.actions, ['edit', 'use_redacted'], workflow);
  }
  /* Isikuandmeteta tekst läheb alati läbi. */
  assert.deepEqual(evaluateTextPrivacy('Tere, vajan abi koduteenuse taotlemisel.', { workflow: 'help_listing_public' }).ok, true);
});

function userDb(row) {
  const calls = [];
  return {
    calls,
    user: {
      findUnique: async (query) => {
        calls.push(query);
        return row;
      },
      updateMany: async (query) => {
        calls.push(query);
        return { count: row ? 1 : 0 };
      }
    }
  };
}

test('lüliti: vaikimisi sees; väljas on püsiv otsus „saada siiski", inimese enda valik jääb peale', async () => {
  /* Vaikimisi sees: konto puudub, veerg puudub, tabelit ei ole (test ilma kasutajateta). */
  assert.equal(await readPrivacyPromptEnabled('u1', { db: userDb(null) }), true);
  assert.equal(await readPrivacyPromptEnabled('u1', { db: userDb({}) }), true);
  assert.equal(await readPrivacyPromptEnabled('u1', { db: {} }), true);
  assert.equal(await readPrivacyPromptEnabled('', { db: userDb({ privacyPromptEnabled: false }) }), true);
  assert.equal(await readPrivacyPromptEnabled('u1', { db: userDb({ privacyPromptEnabled: true }) }), true);
  const off = userDb({ privacyPromptEnabled: false });
  assert.equal(await readPrivacyPromptEnabled('u1', { db: off }), false);
  assert.deepEqual(off.calls, [{ where: { id: 'u1' }, select: { privacyPromptEnabled: true } }]);

  /* Sees: otsus jääb selleks, mille inimene andis (ka „ei midagi"). */
  const on = userDb({ privacyPromptEnabled: true });
  assert.equal(await resolvePrivacyDecision('u1', undefined, { db: on }), undefined);
  /* Väljas ja valikut ei ole: püsiv „saada siiski". */
  assert.equal(await resolvePrivacyDecision('u1', undefined, { db: userDb({ privacyPromptEnabled: false }) }), STANDING_SEND_ORIGINAL);
  assert.equal(await resolvePrivacyDecision('u1', {}, { db: userDb({ privacyPromptEnabled: false }) }), STANDING_SEND_ORIGINAL);
  assert.deepEqual(STANDING_SEND_ORIGINAL, { action: 'send_original' });
  /* Inimese enda valik selle teksti kohta jääb peale ja andmebaasi ei küsita. */
  const untouched = userDb({ privacyPromptEnabled: false });
  for (const decision of [{ action: 'use_redacted' }, 'edit', { privacyDecision: 'send_original' }]) {
    assert.equal(await resolvePrivacyDecision('u1', decision, { db: untouched }), decision);
  }
  assert.deepEqual(untouched.calls, []);
});

test('lüliti väljas: privaatses töövoos ei küsita, avalikus küsitakse endiselt', async () => {
  const text = 'Minu telefon on 5123 4567.';
  const decision = await resolvePrivacyDecision('u1', undefined, { db: userDb({ privacyPromptEnabled: false }) });
  for (const workflow of ['chat_private', 'room_private', 'pre_inquiry', 'document_generation', 'document_refinement']) {
    const result = evaluateTextPrivacy(text, { workflow, privacyDecision: decision });
    assert.deepEqual([result.ok, result.needsPrivacyConfirmation, result.processedText], [true, false, text], workflow);
  }
  const listing = evaluateTextPrivacy(text, { workflow: 'help_listing_public', privacyDecision: decision });
  assert.deepEqual([listing.ok, listing.needsPrivacyConfirmation, listing.processedText], [false, true, '']);
});

test('lüliti salvestamine: ainult tõeväärtus ja ainult olemasolev konto', async () => {
  const db = userDb({ id: 'u1' });
  assert.deepEqual(await savePrivacyPromptEnabled('u1', false, { db }), { enabled: false });
  assert.deepEqual(db.calls, [{ where: { id: 'u1' }, data: { privacyPromptEnabled: false } }]);
  assert.deepEqual(await savePrivacyPromptEnabled('u1', true, { db }), { enabled: true });
  for (const value of ['false', 0, null, undefined]) assert.equal(await savePrivacyPromptEnabled('u1', value, { db }), null);
  assert.equal(await savePrivacyPromptEnabled('', false, { db }), null);
  assert.equal(await savePrivacyPromptEnabled('puudub', false, { db: userDb(null) }), null);
});

test('hoiatuse lause ja liikide nimed on lehe keeles', () => {
  const payload = privacyConfirmationResponsePayload(
    evaluateTextPrivacy('Tel 5123 4567, kood 44001010002, mari@example.ee, Pikk tn 12', { workflow: 'chat_private' })
  );
  assert.deepEqual(payload.findings.map((item) => item.type), ['phone', 'estonian_personal_code', 'email', 'address']);

  /* Lause ei korda leitud liike: lehed näitavad neid `findings` järgi omal real (enne oli
     sama liik küsimuses kaks korda). */
  const et = localizePrivacyPayload(payload, 'et');
  assert.equal(et.warning, 'Tekstis võib olla isikuandmeid. Saada ainult see, mida on päriselt vaja.');
  assert.deepEqual(et.findings.map((item) => item.label), ['telefoninumber', 'isikukood', 'e-posti aadress', 'aadress']);
  const en = localizePrivacyPayload(payload, 'en');
  assert.equal(en.warning, 'The text may contain personal data. Send only what is really needed.');
  assert.deepEqual(en.findings.map((item) => item.label), ['phone number', 'personal identification code', 'e-mail address', 'address']);
  assert.deepEqual(en.spans.map((item) => item.label).sort(), ['address', 'e-mail address', 'personal identification code', 'phone number']);
  const ru = localizePrivacyPayload(payload, 'ru');
  assert.match(ru.warning, /^В тексте могут быть персональные данные\. /u);
  assert.deepEqual(ru.findings.map((item) => item.label).slice(0, 2), ['номер телефона', 'личный код']);
  /* Muu vastus ei muutu: varjatud tekst, valikud ja võti on samad. */
  for (const key of ['ok', 'message', 'messageKey', 'workflow', 'redactedText', 'actions', 'allowOriginal', 'categories']) {
    assert.deepEqual(en[key], payload[key], key);
  }
  /* Tundmatu liik (teine tuvastaja) jääb oma nimega; tühi ja kinnituseta vastus jääb samaks. */
  const other = localizePrivacyPayload({ needsPrivacyConfirmation: true, findings: [{ type: 'person', label: 'nimi' }], warning: 'x' }, 'en');
  assert.deepEqual(other.findings, [{ type: 'person', label: 'nimi' }]);
  assert.deepEqual(localizePrivacyPayload(undefined, 'en'), {});
  const plain = { ok: true };
  assert.equal(localizePrivacyPayload(plain, 'en'), plain);

  /* Lehe keel tuleb keelevaliku küpsisest, siis päisest; brauseri keel ei ole lehe keel. */
  const request = (headers, jar) => ({ headers: { get: (name) => headers[name] ?? null }, ...(jar ? { cookies: { get: (name) => (jar[name] ? { value: jar[name] } : undefined) } } : {}) });
  assert.equal(privacyLocaleFromRequest(request({ 'accept-language': 'en-US' }, { NEXT_LOCALE: 'ru' })), 'ru');
  assert.equal(privacyLocaleFromRequest(request({ cookie: 'a=1; NEXT_LOCALE=en; b=2', 'accept-language': 'ru' })), 'en');
  assert.equal(privacyLocaleFromRequest(request({ 'x-ui-locale': 'ru' })), 'ru');
  assert.equal(privacyLocaleFromRequest(request({ 'accept-language': 'en-US' })), 'et');
  assert.equal(privacyLocaleFromRequest(undefined), 'et');
});

test('lüliti on läbi viidud igas kohas, kus server kinnitust küsib, ja konto seadete lehel', () => {
  /* Neli serveri kohta, kus küsitakse: kontrolli marsruut (vestlus, hääl, dokumendid), ruumi
     sõnum, eelpöördumise abi ja eelpöördumise salvestamine, saatmine ning parandus. */
  assert.match(source('../app/api/rooms/[roomId]/messages/route.js'), /privacyDecision: await resolvePrivacyDecision\(auth\.userId, payload\?\.privacyDecision\)/);

  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(source(`../messages/${locale}.json`));
    const texts = [
      messages.privacy_guard.warning,
      ...Object.values(messages.privacy_guard.types),
      ...Object.values(messages.profile.privacy_prompt)
    ];
    assert.equal(texts.length, 10, locale);
    for (const text of texts) {
      assert.ok(text.length > 4, locale);
      assert.equal(/[\u2014\u2013]/.test(text), false, locale);
    }
    assert.equal(/[{}]/.test(messages.privacy_guard.warning), false, locale);
  }
});

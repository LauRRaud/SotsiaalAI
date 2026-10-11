// TEENUSEPROFIIL — nimekontroll küsib registrikoodi kohta äriregistrit ennast, koopia on varuks.
//
// Omanik 11.10.2026: „aegajalt tekib uusi ettevõtteid, lisaks muudetakse nime, osad suletakse ka."
// Ainult koopiaga (registri seis faili tegemise päeval) oli uus ja ümber nimetatud asutus kuni
// faili värskendamiseni liiga rangelt kinni ja suletud asutus liiga leebelt lahti. Need testid
// hoiavad kolme juhtu ja kaht piiri: registrisse läheb ainult registrikood (mitte kunagi nimi) ja
// „ei tea" ei ole kunagi „sobib".
//
// Võrku ükski test ei lähe: äriregistri vastus on võltspäring. Nimed ja koodid on väljamõeldud.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  LiveRegisterStatus,
  PLAIN_NAME_LIVE_FORMS,
  REGISTER_LIVE_URL,
  checkRegisterName,
  fetchRegisterEntry,
  resetLiveRegisterCache
} from '../lib/businessRegisterNameCheck.js';
import { registerNamePairHash, resetRegisterNamesCache } from '../lib/businessRegisterNames.js';
import { RegisterNamePublicationError, assertRegisterNameForPublication } from '../lib/serviceProviderRepresentation.js';

/* `npm test` lülitab otsepäringu välja, et ükski test võrku ei läheks. Siin on see sees, sest iga
   päring saab võltsvastuse (`fetchImpl`). */
process.env.BUSINESS_REGISTER_LIVE = 'on';

/* Äriregistri teenuse vastuse kuju (mõõdetud 11.10.2026): kood arvuna, õiguslik vorm numbrina tekstis. */
const row = (code, name, { status = 'R', form = '5' } = {}) => ({
  company_id: 1, reg_code: Number(code), name, historical_names: [], status, legal_address: 'x', zip_code: '00000', legal_form: form, url: 'x'
});

/* Võltsregister: `rows` on read, mida teenus selle päringu peale annab; `calls` kogub aadressid. */
function fakeRegister(rowsFor) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    const query = new URL(String(url)).searchParams.get('q');
    const rows = typeof rowsFor === 'function' ? rowsFor(query) : rowsFor;
    if (rows instanceof Error) throw rows;
    if (rows && rows.raw) return rows.raw;
    return { ok: true, json: async () => ({ status: 'OK', data: rows }) };
  };
  return { calls, fetchImpl };
}

/* Koopia (ajutine fail): 10000010 juriidiline isik, 10000040 füüsilisest isikust ettevõtja. */
function copyFile(lines = ['10000010\tN\tHea Hoolekanne OÜ', `10000040\tH\t${registerNamePairHash('10000040', 'Mari Maasikas')}`, '10000070\tN\tVana Nimega Hooldus OÜ']) {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ar-otse-')), 'names.tsv');
  writeFileSync(file, `${lines.join('\n')}\n`);
  resetRegisterNamesCache();
  return file;
}

const fresh = () => {
  resetLiveRegisterCache();
  resetRegisterNamesCache();
};

test('registrisse läheb ainult registrikood ja loeb ainult täpselt selle koodiga rida', async () => {
  fresh();
  const register = fakeRegister([
    row('20000001', 'Kood 10000010 Nimes OÜ'),
    row('10000010', '  Hea   Hoolekanne OÜ '),
    row('10000011', 'Naaber OÜ')
  ]);
  const answer = await fetchRegisterEntry(' 10000010 ', { fetchImpl: register.fetchImpl });
  assert.deepEqual(answer, { status: 'found', registered: true, entry: { name: 'Hea Hoolekanne OÜ', hash: null } });
  assert.equal(register.calls.length, 1);
  assert.equal(register.calls[0].url, `${REGISTER_LIVE_URL}?q=10000010`);
  assert.ok(register.calls[0].init.signal, 'päringul on ajalõpp');
  /* Teenus otsib ka nimede seest: rida, mille kood on teine, ei ole vastus. */
  fresh();
  assert.deepEqual(await fetchRegisterEntry('10000010', { fetchImpl: fakeRegister([row('20000001', 'Kood 10000010 Nimes OÜ')]).fetchImpl }), { status: 'not_found' });
  assert.deepEqual(await fetchRegisterEntry('10000012', { fetchImpl: fakeRegister([]).fetchImpl }), { status: 'not_found' });
});

test('vigase kujuga koodi ei küsita ja väljalülitatud otsepäring ei lähe võrku', async () => {
  fresh();
  const register = fakeRegister([row('10000010', 'Hea Hoolekanne OÜ')]);
  for (const code of ['', '   ', 'abc', '12', '1234567890123', null, undefined]) {
    assert.deepEqual(await fetchRegisterEntry(code, { fetchImpl: register.fetchImpl }), { status: 'not_found' }, String(code));
  }
  process.env.BUSINESS_REGISTER_LIVE = 'off';
  try {
    assert.deepEqual(await fetchRegisterEntry('10000010', { fetchImpl: register.fetchImpl }), { status: 'unavailable' });
  } finally {
    process.env.BUSINESS_REGISTER_LIVE = 'on';
  }
  assert.deepEqual(await fetchRegisterEntry('10000010', { fetchImpl: null }), { status: 'unavailable' });
  assert.equal(register.calls.length, 0);
});

test('inimese nimi: füüsilisest isikust ettevõtja ja tundmatu vormi nimi jääb ainult räsina', async () => {
  fresh();
  const person = await fetchRegisterEntry('10000040', { fetchImpl: fakeRegister([row('10000040', 'Mari Maasikas', { form: '3' })]).fetchImpl });
  assert.deepEqual(person, { status: 'found', registered: true, entry: { name: null, hash: registerNamePairHash('10000040', 'mari maasikas') } });
  assert.equal(JSON.stringify(person).includes('Maasikas'), false);
  const unknownForm = await fetchRegisterEntry('10000041', { fetchImpl: fakeRegister([row('10000041', 'Uue Vormiga Ühendus', { form: '99' })]).fetchImpl });
  assert.equal(unknownForm.entry.name, null);
  const noForm = await fetchRegisterEntry('10000042', { fetchImpl: fakeRegister([{ reg_code: 10000042, name: 'Vormita Ühendus', status: 'R' }]).fetchImpl });
  assert.equal(noForm.entry.name, null);
  assert.equal(PLAIN_NAME_LIVE_FORMS.has('3'), false);
  for (const form of ['1', '5', '7', '8', '22']) assert.equal(PLAIN_NAME_LIVE_FORMS.has(form), true, form);
});

test('register ei vasta: vigane vastus, veakood, võrguviga ja ajalõpp on „ei tea”', async () => {
  const cases = {
    'veakood': { raw: { ok: false, status: 503, json: async () => ({}) } },
    'mitte JSON': { raw: { ok: true, json: async () => { throw new SyntaxError('x'); } } },
    'vale kuju': { raw: { ok: true, json: async () => ({ status: 'OK', data: 'x' }) } },
    'teenuse viga': { raw: { ok: true, json: async () => ({ status: 'ERROR', data: [] }) } },
    'nimeta rida': { raw: { ok: true, json: async () => ({ status: 'OK', data: [{ reg_code: 10000010, name: '', status: 'R', legal_form: '5' }] }) } },
    'võrguviga': new Error('ECONNRESET')
  };
  for (const [label, reply] of Object.entries(cases)) {
    fresh();
    assert.deepEqual(await fetchRegisterEntry('10000010', { fetchImpl: fakeRegister(reply).fetchImpl }), { status: 'unavailable' }, label);
  }
  fresh();
  const hanging = (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
  assert.deepEqual(await fetchRegisterEntry('10000010', { fetchImpl: hanging, timeoutMs: 20 }), { status: 'unavailable' });
});

test('vastus jääb kümneks minutiks meelde; pärast ebaõnnestumist registrit pool minutit ei küsita', async () => {
  fresh();
  let clock = 1_000_000;
  const now = () => clock;
  const register = fakeRegister((query) => (query === '10000010' ? [row('10000010', 'Hea Hoolekanne OÜ')] : []));
  const ask = (code, fetchImpl = register.fetchImpl) => fetchRegisterEntry(code, { fetchImpl, now });
  await ask('10000010');
  await ask('10000010');
  await ask('10000099');
  await ask('10000099');
  assert.equal(register.calls.length, 2, 'sama koodi kohta üks päring, ka siis, kui vastus oli „ei ole”');
  clock += 9 * 60 * 1000;
  await ask('10000010');
  assert.equal(register.calls.length, 2);
  clock += 2 * 60 * 1000;
  await ask('10000010');
  assert.equal(register.calls.length, 3, 'kümne minuti järel küsitakse uuesti');

  /* Ebaõnnestumine: järgmised päringud (ka teise koodi kohta) ei oota ajalõppu, vaid saavad kohe „ei tea". */
  const down = fakeRegister(new Error('ETIMEDOUT'));
  assert.deepEqual(await ask('10000020', down.fetchImpl), { status: 'unavailable' });
  assert.deepEqual(await ask('10000021', register.fetchImpl), { status: 'unavailable' });
  assert.equal(down.calls.length, 1);
  assert.equal(register.calls.length, 3);
  /* Meelde jäänud vastus kehtib ka pausi ajal. */
  assert.equal((await ask('10000010')).status, 'found');
  clock += 31 * 1000;
  assert.deepEqual(await ask('10000021', register.fetchImpl), { status: 'not_found' });
  assert.equal(register.calls.length, 4);
  assert.deepEqual(Object.values(LiveRegisterStatus).sort(), ['found', 'not_found', 'unavailable']);
});

/* Nimekontroll võltsregistriga: `rowsFor` nagu `fakeRegister`. */
function checker(rowsFor, file) {
  const register = fakeRegister(rowsFor);
  const check = (registryCode, organizationName) => checkRegisterName(
    { registryCode, organizationName },
    { file, fetchEntry: (code) => fetchRegisterEntry(code, { fetchImpl: register.fetchImpl }) }
  );
  return { check, calls: register.calls };
}

test('uus asutus: koopias teda ei ole, register tunneb: kinnitada ja avaldada saab kohe', async () => {
  fresh();
  const file = copyFile();
  const { check } = checker([row('10000099', 'Uus Hooldus OÜ')], file);
  assert.deepEqual(await check('10000099', 'uus hooldus oü'), { result: 'match', registerName: 'Uus Hooldus OÜ', source: 'live' });
  assert.deepEqual(await check('10000099', 'Hoopis Teine OÜ'), { result: 'mismatch', registerName: 'Uus Hooldus OÜ', source: 'live' });
  const next = { status: 'PUBLISHED', registryCode: '10000099', organizationName: 'Uus Hooldus OÜ' };
  assertRegisterNameForPublication(next, await check(next.registryCode, next.organizationName));
  /* Ainult koopiaga oli sama asutus kinni kuni faili värskendamiseni. */
  fresh();
  const silent = checker(new Error('offline'), file);
  assert.deepEqual(await silent.check('10000099', 'Uus Hooldus OÜ'), { result: 'code_not_listed', registerName: null, source: 'copy' });
});

test('ümber nimetatud asutus: loeb registri praegune nimi, mitte koopia vana nimi', async () => {
  fresh();
  const file = copyFile();
  const { check } = checker([row('10000070', 'Uue Nimega Hooldus OÜ')], file);
  assert.deepEqual(await check('10000070', 'Uue Nimega Hooldus OÜ'), { result: 'match', registerName: 'Uue Nimega Hooldus OÜ', source: 'live' });
  /* Vana nimi enam ei sobi ja vorm saab pakkuda uut nime. */
  assert.deepEqual(await check('10000070', 'Vana Nimega Hooldus OÜ'), { result: 'mismatch', registerName: 'Uue Nimega Hooldus OÜ', source: 'live' });
});

test('suletud asutus: koopias on ta alles, registris enam mitte: kinnitada ega avaldada ei saa', async () => {
  const file = copyFile();
  const gone = { status: 'PUBLISHED', registryCode: '10000010', organizationName: 'Hea Hoolekanne OÜ' };
  for (const [label, rows] of [
    ['registrist kustutatud', []],
    ['likvideerimisel', [row('10000010', 'Hea Hoolekanne OÜ', { status: 'L' })]],
    ['pankrotis', [row('10000010', 'Hea Hoolekanne OÜ', { status: 'N' })]],
    ['seisuta', [{ reg_code: 10000010, name: 'Hea Hoolekanne OÜ', legal_form: '5' }]]
  ]) {
    fresh();
    const { check } = checker(rows, file);
    const answer = await check(gone.registryCode, gone.organizationName);
    assert.deepEqual(answer, { result: 'code_not_listed', registerName: null, source: 'live' }, label);
    assert.throws(() => assertRegisterNameForPublication(gone, answer), (error) => error.message === RegisterNamePublicationError.CODE_NOT_LISTED, label);
  }
});

test('register ei vasta: vastus tuleb koopiast; kui ka koopiat ei saa lugeda, on vastus „ei tea”', async () => {
  fresh();
  const file = copyFile();
  const silent = checker(new Error('offline'), file);
  assert.deepEqual(await silent.check('10000010', 'hea hoolekanne oü'), { result: 'match', registerName: 'Hea Hoolekanne OÜ', source: 'copy' });
  assert.deepEqual(await silent.check('10000010', 'Tuntud Hooldekodu AS'), { result: 'mismatch', registerName: 'Hea Hoolekanne OÜ', source: 'copy' });
  assert.deepEqual(await silent.check('10000040', 'Mari Maasikas'), { result: 'match', registerName: null, source: 'copy' });

  fresh();
  const nothing = checker(new Error('offline'), path.join(tmpdir(), 'ar-otse-puudub', 'names.tsv'));
  const coded = await nothing.check('10000010', 'Hea Hoolekanne OÜ');
  assert.deepEqual(coded, { result: 'unavailable', registerName: null, source: 'copy' });
  assert.throws(
    () => assertRegisterNameForPublication({ status: 'PUBLISHED', registryCode: '10000010', organizationName: 'Hea Hoolekanne OÜ' }, coded),
    (error) => error.message === RegisterNamePublicationError.REGISTER_UNAVAILABLE && error.status === 503
  );
  /* Register vastab, koopiat ei ole: registrikoodiga profiil saab vastuse registrist. */
  fresh();
  const liveOnly = checker([row('10000010', 'Hea Hoolekanne OÜ')], path.join(tmpdir(), 'ar-otse-puudub', 'names.tsv'));
  assert.deepEqual(await liveOnly.check('10000010', 'Hea Hoolekanne OÜ'), { result: 'match', registerName: 'Hea Hoolekanne OÜ', source: 'live' });
  /* Registrikoodita profiili kohta ei saa registrilt küsida: ilma koopiata on vastus „ei tea". */
  assert.deepEqual(await liveOnly.check('', 'Juta Kask'), { result: 'unavailable', registerName: null, source: 'copy' });
});

test('registrikoodita profiil: nime ei saadeta registrisse kunagi', async () => {
  fresh();
  const file = copyFile();
  const { check, calls } = checker([row('10000010', 'Hea Hoolekanne OÜ')], file);
  assert.deepEqual(await check('', 'Hea Hoolekanne OÜ'), { result: 'code_required', registerName: null, source: 'copy' });
  assert.deepEqual(await check(null, 'Juta Kask'), { result: 'free', registerName: null, source: 'copy' });
  assert.deepEqual(await check('   ', 'Mari Maasikas'), { result: 'free', registerName: null, source: 'copy' });
  assert.equal(calls.length, 0, 'registrikoodita profiili kohta päringut ei tehta');
  /* Registrikoodiga profiili päringus on ainult kood: nime ega selle osa aadressis ei ole. */
  await check('10000010', 'Salajane Nimi OÜ');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${REGISTER_LIVE_URL}?q=10000010`);
  assert.equal(/salajane|nimi/iu.test(JSON.stringify(calls[0])), false);
});

test('füüsilisest isikust ettevõtja registri vastuses: sobib või ei sobi, nime ei näidata', async () => {
  fresh();
  const file = copyFile();
  const { check } = checker([row('10000045', 'Tiit Tamm', { form: '3' })], file);
  assert.deepEqual(await check('10000045', 'tiit  TAMM'), { result: 'match', registerName: null, source: 'live' });
  assert.deepEqual(await check('10000045', 'Tiit Kask'), { result: 'mismatch', registerName: null, source: 'live' });
});

test('ühiktestid ei lähe võrku ja vorm saab koopia kuupäeva ainult koopia vastusega', () => {
  const runner = readFileSync(new URL('../scripts/run-unit-tests.mjs', import.meta.url), 'utf8');
  assert.match(runner, /BUSINESS_REGISTER_LIVE: "off"/);
  const route = readFileSync(new URL('../app/api/service-provider/profile/register-name/route.js', import.meta.url), 'utf8');
  assert.match(route, /const fromCopy = check\.source === RegisterNameSource\.COPY;/);
  assert.match(route, /registerDate: fromCopy \? /);
  /* Kutsujad küsivad registrit enne koopiat. */
  for (const file of ['../lib/serviceProviderProfiles.js', '../lib/serviceProviderRepresentation.js', '../lib/org/serviceProfile.js', '../app/api/service-provider/profile/register-name/route.js']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /checkRegisterName[^\n]*from "@\/lib\/businessRegisterNameCheck"/, file);
  }
});

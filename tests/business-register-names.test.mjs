// TEENUSEPROFIIL — asutuse nimi peab vastama äriregistrile.
//
// Kaks auku, mille need testid kinni hoiavad:
//   1. registrikoodi sai kinnitada ja avaldada profiilil, mille nimi oli hoopis teine: nüüd ei saa
//      registrikoodiga profiili kinnitada ega avaldada nimega, mis ei ole registris selle koodi nimi;
//   2. registrikoodita profiil sai kanda mis tahes asutuse nime ilma kinnituseta: nüüd ei avaldu
//      registrikoodita profiil, mille nimi on registrisse kantud asutuse nimi.
// Kui registrifaili ei saa lugeda, on vastus „ei tea" ja see ei ole „sobib".
//
// Kõik nimed ja koodid siin on väljamõeldud; register on ajutine fail.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { contactHashCollector, registerCompanies } from '../lib/businessRegisterContacts.js';
import { checkRegisterName as checkRegisterNameFresh } from '../lib/businessRegisterNameCheck.js';
import {
  PLAIN_NAME_LEGAL_FORMS,
  RegisterNameResult,
  loadRegisterNames,
  loadRegisterNamesOrNull,
  normalizeOrganizationName,
  registerNameCheck,
  registerNameCollector,
  registerNamePairHash,
  registerNamesFileFrom,
  resetRegisterNamesCache
} from '../lib/businessRegisterNames.js';
import { updateOrganizationProfile } from '../lib/org/serviceProfile.js';
import { serviceProviderProfileErrorDescriptor } from '../lib/serviceProviderProfileBoundary.js';
import {
  AdminRepresentationNameError,
  RegisterNamePublicationError,
  RepresentationLinkError,
  assertRegisterNameForPublication,
  confirmRepresentationAsAdmin,
  confirmRepresentationByLink,
  describeRepresentationForOwner,
  listRepresentationAdminRows,
  requestRepresentationLink
} from '../lib/serviceProviderRepresentation.js';
import {
  createServiceProfileForm,
  profileViewStates,
  registerNameKey,
  registerNameState,
  serviceProfilePublishChecks,
  serviceProfilePublishState
} from '../components/workspace/serviceProfile/profileModel.js';
import { representationView } from '../components/workspace/serviceProfile/representationRules.js';

const NOW = new Date('2026-10-11T08:00:00.000Z');
const UPDATED = new Date('2026-10-10T10:00:00.000Z');
const TOKEN = 'c'.repeat(64);
const hashToken = (token) => createHash('sha256').update(`test:${token}`).digest('hex');

/* Äriregistri faili kuju: iga väli omal real, asutus algab kaheksa tühiku taandega. */
function company({ code, name, form = 'OÜ', status = 'R' }) {
  return [
    '    {',
    `        "ariregistri_kood":${code},`,
    `        "nimi":${JSON.stringify(name)},`,
    '        "yldandmed":{',
    `            "staatus":"${status}",`,
    `            "oiguslik_vorm":${form === null ? 'null' : JSON.stringify(form)},`,
    '            "staatused":[',
    '                {',
    '                    "staatus":"X",',
    '                }',
    '            ],',
    '            "arinimed":[',
    '                {',
    '                    "sisu":"Vana Nimi OÜ",',
    '                    "lopp_kpv":"01.01.2020"',
    '                }',
    '            ],',
    '            "sidevahendid":[],',
    '            "oiguslikud_vormid":[',
    '                {',
    '                    "oiguslik_vorm":"AS",',
    '                    "nimi":"sügavam nimi, mitte asutuse oma"',
    '                }',
    '            ]',
    '        }',
    '    },'
  ];
}

async function* linesOf(...companies) {
  yield '[';
  for (const lines of companies) for (const line of lines) yield line;
  yield ']';
}

const REGISTER = [
  company({ code: 10000030, name: 'Mittetulundusühing "Soe Tuba"', form: 'MTÜ' }),
  company({ code: 10000010, name: 'Hea Hoolekanne OÜ' }),
  company({ code: 10000020, name: 'Abi OÜ' }),
  company({ code: 10000040, name: 'Mari Maasikas', form: 'FIE' }),
  company({ code: 10000050, name: 'Likvideeritav Hooldus OÜ', status: 'L' }),
  company({ code: 10000060, name: 'Tundmatu Vormiga Ühendus', form: 'UUSVORM' }),
  company({ code: 10000070, name: 'Kalda Valla Hooldekodu', form: 'KOVAS' })
];

async function collect(...companies) {
  const names = registerNameCollector();
  const contacts = contactHashCollector();
  for await (const item of registerCompanies(linesOf(...companies))) {
    names.add(item);
    contacts.add(item);
  }
  return { names: names.result(), contacts: contacts.result() };
}

async function registerFile(...companies) {
  const { names } = await collect(...(companies.length ? companies : REGISTER));
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'ar-nimed-')), 'names.tsv');
  writeFileSync(file, registerNamesFileFrom(names.entries));
  resetRegisterNamesCache();
  return file;
}

/* Need testid käivad koopia ja väravate kohta: register „ei vasta" ja vastus tuleb koopiast.
   Registri enda vastust hoiab tests/business-register-name-check.test.mjs. */
const registerSilent = async () => ({ status: 'unavailable' });
async function checkRegisterName(input, { file } = {}) {
  const { source, ...answer } = await checkRegisterNameFresh(input, { file, fetchEntry: registerSilent });
  assert.equal(source, 'copy');
  return answer;
}
const check = (file, registryCode, organizationName) => checkRegisterName({ registryCode, organizationName }, { file });

test('nimede võrdlus talub suurtähti, jutumärke ja tühikuid, aga mitte teist nime', () => {
  const same = normalizeOrganizationName('Mittetulundusühing "Soe Tuba"');
  for (const spelling of [
    'mittetulundusühing soe tuba',
    'MITTETULUNDUSÜHING „SOE TUBA“',
    '  Mittetulundusühing   «Soe Tuba»  ',
    "Mittetulundusühing 'Soe Tuba'"
  ]) {
    assert.equal(normalizeOrganizationName(spelling), same, spelling);
  }
  for (const other of ['Mittetulundusühing Soe Tuba 2', 'MTÜ Soe Tuba', 'Soe Tuba', 'Mittetulundusühing Soetuba', 'Mittetulundusühing Soe, Tuba']) {
    assert.notEqual(normalizeOrganizationName(other), same, other);
  }
  assert.equal(normalizeOrganizationName('Hooldus – Abi OÜ'), normalizeOrganizationName('Hooldus - Abi OÜ'));
  assert.equal(normalizeOrganizationName(null), '');
});

test('registrifailist loetakse asutuse enda nimi, seis ja õiguslik vorm, mitte sügavamad samanimelised väljad', async () => {
  const seen = [];
  for await (const item of registerCompanies(linesOf(...REGISTER))) seen.push(item);
  assert.equal(seen.length, 7);
  assert.deepEqual(
    { code: seen[1].code, name: seen[1].name, status: seen[1].status, legalForm: seen[1].legalForm },
    { code: '10000010', name: 'Hea Hoolekanne OÜ', status: 'R', legalForm: 'OÜ' }
  );
  assert.equal(seen[3].legalForm, 'FIE');
  assert.equal(seen[4].status, 'L');
});

test('nimede fail: ainult registrisse kantud asutused, koodi järjekorras; inimese nimi ainult räsina', async () => {
  const { names } = await collect(...REGISTER);
  assert.equal(names.entries.size, 6, 'likvideerimisel asutus jääb välja');
  assert.equal(names.plainNames, 4);
  assert.equal(names.hashedNames, 2);
  assert.deepEqual(names.byLegalForm, { MTÜ: 1, OÜ: 2, FIE: 1, UUSVORM: 1, KOVAS: 1 });
  const text = registerNamesFileFrom(names.entries).toString('utf8');
  assert.deepEqual(text.split('\n').filter(Boolean).map((line) => line.split('\t').slice(0, 2).join(' ')), [
    '10000010 N', '10000020 N', '10000030 N', '10000040 H', '10000060 H', '10000070 N'
  ]);
  /* Füüsilisest isikust ettevõtja ja tundmatu vormiga asutuse nime failis ei ole. */
  assert.equal(text.includes('Maasikas'), false);
  assert.equal(text.includes('Tundmatu'), false);
  assert.ok(text.includes('10000010\tN\tHea Hoolekanne OÜ\n'));
  assert.ok(text.includes(`10000040\tH\t${registerNamePairHash('10000040', 'mari  MAASIKAS')}\n`));
  assert.match(registerNamePairHash('10000040', 'Mari Maasikas'), /^[a-f0-9]{16}$/u);
  assert.equal(registerNamePairHash('10000040', ''), '');
  assert.equal(PLAIN_NAME_LEGAL_FORMS.has('FIE'), false);
});

test('registrikoodiga profiil: nimi sobib, ei sobi, koodi ei ole registris', async () => {
  const file = await registerFile();
  assert.deepEqual(await check(file, '10000010', 'Hea Hoolekanne OÜ'), { result: 'match', registerName: 'Hea Hoolekanne OÜ' });
  assert.deepEqual(await check(file, ' 10000010 ', '  hea   HOOLEKANNE oü '), { result: 'match', registerName: 'Hea Hoolekanne OÜ' });
  assert.deepEqual(await check(file, '10000030', 'Mittetulundusühing „Soe Tuba“'), { result: 'match', registerName: 'Mittetulundusühing "Soe Tuba"' });
  /* Teine nimi, ka teise asutuse päris nimi, ei sobi; vastus ütleb, mis nimi registris on. */
  assert.deepEqual(await check(file, '10000010', 'Abi OÜ'), { result: 'mismatch', registerName: 'Hea Hoolekanne OÜ' });
  assert.deepEqual(await check(file, '10000010', 'Hea Hoolekanne'), { result: 'mismatch', registerName: 'Hea Hoolekanne OÜ' });
  assert.deepEqual(await check(file, '10000010', ''), { result: 'mismatch', registerName: 'Hea Hoolekanne OÜ' });
  assert.deepEqual(await check(file, '10000070', 'Kalda valla hooldekodu'), { result: 'match', registerName: 'Kalda Valla Hooldekodu' });
  /* Kood, mida failis ei ole: tundmatu, likvideerimisel asutuse oma ja vigase kujuga. */
  for (const code of ['10000011', '10000050', '99999999', '1', 'abc', '10000010x9']) {
    assert.deepEqual(await check(file, code, 'Hea Hoolekanne OÜ'), { result: 'code_not_listed', registerName: null }, code);
  }
});

test('füüsilisest isikust ettevõtja: kontroll ütleb sobib või ei sobi, aga nime ei näita', async () => {
  const file = await registerFile();
  assert.deepEqual(await check(file, '10000040', 'mari maasikas'), { result: 'match', registerName: null });
  assert.deepEqual(await check(file, '10000040', 'Mari Vaarikas'), { result: 'mismatch', registerName: null });
  /* Sama nimi teise koodi all ei sobi: räsi on paari (kood, nimi) kohta. */
  assert.deepEqual(await check(file, '10000060', 'Mari Maasikas'), { result: 'mismatch', registerName: null });
  assert.deepEqual(await check(file, '10000060', 'Tundmatu vormiga ühendus'), { result: 'match', registerName: null });
});

test('registrikoodita profiil: registrisse kantud asutuse nimi nõuab koodi, eraisiku nimi ja osa nimest mitte', async () => {
  const file = await registerFile();
  for (const name of ['Hea Hoolekanne OÜ', 'HEA HOOLEKANNE OÜ', 'mittetulundusühing soe tuba', 'Kalda Valla Hooldekodu']) {
    assert.deepEqual(await check(file, '', name), { result: 'code_required', registerName: null }, name);
  }
  assert.deepEqual(await check(file, null, 'Hea Hoolekanne OÜ'), { result: 'code_required', registerName: null });
  assert.deepEqual(await check(file, '   ', 'Abi OÜ'), { result: 'code_required', registerName: null });
  /* Võrreldakse tervet nime: lühike või tavaline sõna, osa nimest ja pikem nimi ei anna häiret. */
  for (const name of ['Abi', 'Hea Hoolekanne', 'Hoolekanne', 'Soe Tuba', 'Hea Hoolekanne OÜ Tartu osakond', 'OÜ', 'Juta Kask', '']) {
    assert.deepEqual(await check(file, '', name), { result: 'free', registerName: null }, name);
  }
  /* Inimese nimi, mis on ühtlasi füüsilisest isikust ettevõtja nimi, avaldub nagu enne. */
  assert.deepEqual(await check(file, '', 'Mari Maasikas'), { result: 'free', registerName: null });
  /* Likvideerimisel asutust failis ei ole. */
  assert.deepEqual(await check(file, '', 'Likvideeritav Hooldus OÜ'), { result: 'free', registerName: null });
});

test('kui registrifaili ei saa lugeda, on vastus „ei tea”, mitte „sobib”', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ar-nimed-'));
  resetRegisterNamesCache();
  const missing = path.join(dir, 'puudub.tsv');
  assert.deepEqual(await check(missing, '10000010', 'Hea Hoolekanne OÜ'), { result: 'unavailable', registerName: null });
  assert.deepEqual(await check(missing, '', 'Juta Kask'), { result: 'unavailable', registerName: null });
  assert.equal(await loadRegisterNamesOrNull({ file: missing }), null);
  await assert.rejects(loadRegisterNames({ file: missing }));
  const broken = {
    'tyhi.tsv': '',
    'reavahetuseta.tsv': '10000010\tN\tHea Hoolekanne OÜ',
    'vale-jarjekord.tsv': '10000020\tN\tAbi OÜ\n10000010\tN\tHea Hoolekanne OÜ\n',
    'kordus.tsv': '10000010\tN\tHea Hoolekanne OÜ\n10000010\tN\tAbi OÜ\n',
    'vale-liik.tsv': '10000010\tX\tHea Hoolekanne OÜ\n',
    'nimeta.tsv': '10000010\tN\t\n',
    'tabeldamata.tsv': '10000010 N Hea Hoolekanne OÜ\n'
  };
  for (const [name, content] of Object.entries(broken)) {
    const file = path.join(dir, name);
    writeFileSync(file, content);
    assert.deepEqual(await check(file, '10000010', 'Hea Hoolekanne OÜ'), { result: 'unavailable', registerName: null }, name);
  }
  assert.deepEqual(registerNameCheck(null, { registryCode: '', organizationName: 'Juta Kask' }), { result: 'unavailable', registerName: null });
  /* Ebaõnnestunud lugemist ei jäeta meelde: parandatud fail loetakse järgmisel korral. */
  const file = path.join(dir, 'tyhi.tsv');
  writeFileSync(file, '10000010\tN\tHea Hoolekanne OÜ\n');
  assert.equal((await check(file, '10000010', 'hea hoolekanne oü')).result, 'match');
  resetRegisterNamesCache();
});

test('avaldamise nimevärav: läbi lasevad ainult „registri nimi” ja „registris sellist nime ei ole”', () => {
  const coded = { status: 'PUBLISHED', registryCode: '10000010', organizationName: 'Hea Hoolekanne OÜ' };
  const codeless = { status: 'PUBLISHED', registryCode: null, organizationName: 'Juta Kask' };
  const throwsKey = (next, nameCheck, key, status, field) => assert.throws(
    () => assertRegisterNameForPublication(next, nameCheck),
    (error) => error.message === key && error.status === status && (field === undefined || error.details?.field === field),
    `${key} (${JSON.stringify(nameCheck)})`
  );
  assertRegisterNameForPublication(coded, { result: 'match', registerName: 'Hea Hoolekanne OÜ' });
  assertRegisterNameForPublication(codeless, { result: 'free', registerName: null });
  throwsKey(coded, { result: 'mismatch', registerName: 'Hea Hoolekanne OÜ' }, RegisterNamePublicationError.NAME_MISMATCH, 400, 'organizationName');
  throwsKey(coded, { result: 'code_not_listed', registerName: null }, RegisterNamePublicationError.CODE_NOT_LISTED, 400, 'registryCode');
  throwsKey(codeless, { result: 'code_required', registerName: null }, RegisterNamePublicationError.CODE_REQUIRED, 400, 'registryCode');
  /* „Ei tea" ei ole „sobib": lugematu fail, puuduv vastus ja tundmatu vastus ei lase avaldada. */
  for (const next of [coded, codeless]) {
    for (const nameCheck of [{ result: 'unavailable', registerName: null }, null, undefined, {}, { result: 'ok' }]) {
      throwsKey(next, nameCheck, RegisterNamePublicationError.REGISTER_UNAVAILABLE, 503);
    }
  }
  /* Vastus peab käima sama liiki profiili kohta: koodita profiili „vaba" ei luba koodiga profiili. */
  throwsKey(coded, { result: 'free', registerName: null }, RegisterNamePublicationError.REGISTER_UNAVAILABLE, 503);
  throwsKey(codeless, { result: 'match', registerName: null }, RegisterNamePublicationError.REGISTER_UNAVAILABLE, 503);
  /* Mustandit, peidetud ja ülevaatusel profiili nimi ei takista. */
  for (const status of ['DRAFT', 'HIDDEN', 'REVIEW', undefined]) {
    assertRegisterNameForPublication({ ...coded, status }, { result: 'mismatch', registerName: 'Hea Hoolekanne OÜ' });
    assertRegisterNameForPublication({ ...codeless, status }, null);
  }
  const mismatch = (() => {
    try {
      assertRegisterNameForPublication(coded, { result: 'mismatch', registerName: 'Hea Hoolekanne OÜ' });
    } catch (error) {
      return error;
    }
    return null;
  })();
  assert.equal(mismatch.details.registerName, 'Hea Hoolekanne OÜ');
});

test('avaldamise värav päris failiga: mõlemad augud on kinni', async () => {
  const file = await registerFile();
  const publish = async (registryCode, organizationName) => {
    const next = { status: 'PUBLISHED', registryCode, organizationName };
    assertRegisterNameForPublication(next, await checkRegisterName(next, { file }));
  };
  /* Auk 1: registrikood ühe asutuse oma, nimi hoopis teine. */
  await assert.rejects(publish('10000010', 'Tuntud Hooldekodu AS'), (error) => error.message === RegisterNamePublicationError.NAME_MISMATCH);
  await assert.rejects(publish('10000010', 'Abi OÜ'), (error) => error.message === RegisterNamePublicationError.NAME_MISMATCH);
  /* Auk 2: registrisse kantud asutuse nimi ilma registrikoodita. */
  await assert.rejects(publish(null, 'Hea Hoolekanne OÜ'), (error) => error.message === RegisterNamePublicationError.CODE_REQUIRED);
  await assert.rejects(publish('', 'abi oü'), (error) => error.message === RegisterNamePublicationError.CODE_REQUIRED);
  /* Lubatud: registri nimi oma koodiga ja eraisiku nimi ilma koodita. */
  await publish('10000010', 'Hea Hoolekanne OÜ');
  await publish(null, 'Juta Kask');
  await publish(null, 'Mari Maasikas');
});

test('salvestamine küsib nimekontrolli salvestatava nime ja koodi kohta ning kutsub väravat samas tehingus', () => {
  const source = readFileSync(new URL('../lib/serviceProviderProfiles.js', import.meta.url), 'utf8');
  assert.match(source, /const registerNameCheck = normalizedBase\.status === "PUBLISHED"\s+\? await \(options\.checkRegisterName \|\| checkRegisterName\)\(\{\s+registryCode: normalizedBase\.registryCode,\s+organizationName: normalizedBase\.organizationName\s+\}\)\s+: null;/);
  assert.match(source, /assertRepresentationForPublication\(normalizedBase, existing\);[\s\S]{0,400}assertRegisterNameForPublication\(normalizedBase, registerNameCheck\);/);
});

function fakeDb(profile) {
  const state = { profile: profile ? { ...profile } : null, events: [] };
  const matches = (where = {}) => Boolean(state.profile) && Object.entries(where).every(([key, value]) => (
    value && typeof value === 'object' && !(value instanceof Date) ? true : state.profile[key] === value
  ));
  const tx = {
    serviceProviderProfile: {
      findFirst: async ({ where }) => (matches(where) ? { ...state.profile } : null),
      findMany: async () => (state.profile ? [{ ...state.profile }] : []),
      updateMany: async ({ where, data }) => {
        if (!matches(where)) return { count: 0 };
        Object.assign(state.profile, data);
        return { count: 1 };
      }
    },
    domainEvent: { create: async ({ data }) => { state.events.push(data); return data; } }
  };
  return { ...tx, $transaction: async (run) => run(tx), state };
}

const profile = (over = {}) => ({
  id: 'prof_1',
  ownerId: 'user_1',
  ownershipMode: 'SOLO',
  organizationName: 'Hea Hoolekanne OÜ',
  registryCode: '10000010',
  status: 'DRAFT',
  updatedAt: UPDATED,
  representationConfirmedAt: null,
  representationRegistryCode: null,
  representationMethod: null,
  representationConfirmedById: null,
  representationBasis: null,
  representationRequestHash: null,
  representationRequestCode: null,
  representationRequestExpiresAt: null,
  representationRequestSentAt: null,
  owner: { email: 'omanik@example.test' },
  ...over
});

const rejectsWith = (promise, key, status) => assert.rejects(promise, (error) => error.message === key && error.status === status);

test('haldur ei saa kinnitada koodi nime all, mis ei ole registris selle koodi nimi', async () => {
  const file = await registerFile();
  const checkName = (input) => checkRegisterName(input, { file });
  const confirm = (db, over = {}) => confirmRepresentationAsAdmin(
    { profileId: 'prof_1', adminUserId: 'admin_1', registryCode: db.state.profile.registryCode, basis: 'Juhatuse liikme volitus' },
    { db, now: NOW, checkName, ...over }
  );
  /* Omaniku leitud juhtum: kood on ühe asutuse oma, profiili nimi hoopis teine. */
  const wrongName = fakeDb(profile({ organizationName: 'Tuntud Hooldekodu AS' }));
  await rejectsWith(confirm(wrongName), AdminRepresentationNameError.NAME_MISMATCH, 409);
  const unknownCode = fakeDb(profile({ registryCode: '10000011' }));
  await rejectsWith(confirm(unknownCode), AdminRepresentationNameError.CODE_NOT_LISTED, 409);
  const unreadable = fakeDb(profile());
  await rejectsWith(confirm(unreadable, { checkName: async () => ({ result: 'unavailable', registerName: null }) }), AdminRepresentationNameError.REGISTER_UNAVAILABLE, 503);
  for (const db of [wrongName, unknownCode, unreadable]) {
    assert.equal(db.state.profile.representationConfirmedAt, null);
    assert.equal(db.state.events.length, 0);
  }
  /* Registri nimega (suurtähed ei loe) kinnitus läheb läbi ja rida kannab nimekontrolli. */
  const right = fakeDb(profile({ organizationName: 'HEA HOOLEKANNE OÜ' }));
  const row = await confirm(right);
  assert.equal(row.confirmed, true);
  assert.equal(row.nameCheck, 'match');
  assert.equal(row.registerName, 'Hea Hoolekanne OÜ');
  assert.equal(right.state.profile.representationRegistryCode, '10000010');
});

test('halduri loend näitab registri nime profiili nime kõrval', async () => {
  const file = await registerFile();
  const loadNames = () => loadRegisterNamesOrNull({ file });
  const checkName = (input) => checkRegisterName(input, { file });
  const [wrong] = await listRepresentationAdminRows({ db: fakeDb(profile({ organizationName: 'Tuntud Hooldekodu AS' })), loadNames, checkName });
  assert.equal(wrong.nameCheck, 'mismatch');
  assert.equal(wrong.registerName, 'Hea Hoolekanne OÜ');
  const [right] = await listRepresentationAdminRows({ db: fakeDb(profile()), loadNames, checkName });
  assert.equal(right.nameCheck, 'match');
  const nothing = async () => ({ result: 'unavailable', registerName: null });
  const [unknown] = await listRepresentationAdminRows({ db: fakeDb(profile()), loadNames: async () => null, checkName: nothing });
  assert.equal(unknown.nameCheck, 'unavailable');
  assert.equal(unknown.registerName, null);
  /* Kinnitamata rida saab sama vastuse, mida kinnitamine ise küsiks (register, siis koopia): uus
     asutus, mida koopias ei ole, peab loendis olema kinnitatav. Kinnitatud rida loetakse koopiast. */
  const asked = [];
  const registerKnows = async (input) => { asked.push(input); return { result: 'match', registerName: 'Uus Hooldus OÜ' }; };
  const fresh = profile({ registryCode: '10000099', organizationName: 'Uus Hooldus OÜ' });
  const [waiting] = await listRepresentationAdminRows({ db: fakeDb(fresh), loadNames, checkName: registerKnows });
  assert.equal(waiting.nameCheck, 'match');
  assert.deepEqual(asked, [{ registryCode: '10000099', organizationName: 'Uus Hooldus OÜ' }]);
  const confirmed = { ...fresh, representationConfirmedAt: NOW, representationRegistryCode: '10000099', representationMethod: 'ADMIN' };
  const [done] = await listRepresentationAdminRows({ db: fakeDb(confirmed), loadNames, checkName: registerKnows });
  assert.equal(done.nameCheck, 'code_not_listed');
  assert.equal(asked.length, 1);
});

test('kinnituslink: vale nimega profiili kohta asutuse postkasti kirja ei lähe', async () => {
  const file = await registerFile();
  const mails = [];
  const options = (db, over = {}) => ({
    db,
    now: NOW,
    checkContact: async () => 'match',
    checkName: (input) => checkRegisterName(input, { file }),
    sendMail: async (mail) => { mails.push(mail); },
    prepareToken: () => ({ token: TOKEN, tokenHash: hashToken(TOKEN) }),
    ...over
  });
  const wrongName = fakeDb(profile({ organizationName: 'Tuntud Hooldekodu AS' }));
  await rejectsWith(requestRepresentationLink({ ownerId: 'user_1', email: 'info@heahoolekanne.test' }, options(wrongName)), RepresentationLinkError.NAME_MISMATCH, 409);
  const unknownCode = fakeDb(profile({ registryCode: '10000011' }));
  await rejectsWith(requestRepresentationLink({ ownerId: 'user_1', email: 'info@heahoolekanne.test' }, options(unknownCode)), RepresentationLinkError.CODE_NOT_LISTED, 409);
  const unreadable = fakeDb(profile());
  await rejectsWith(
    requestRepresentationLink({ ownerId: 'user_1', email: 'info@heahoolekanne.test' }, options(unreadable, { checkName: async () => ({ result: 'unavailable', registerName: null }) })),
    RepresentationLinkError.REGISTER_UNAVAILABLE,
    503
  );
  assert.equal(mails.length, 0);
  for (const db of [wrongName, unknownCode, unreadable]) assert.equal(db.state.profile.representationRequestHash, null);
  const right = fakeDb(profile());
  await requestRepresentationLink({ ownerId: 'user_1', email: 'info@heahoolekanne.test' }, options(right));
  assert.equal(mails.length, 1);
  assert.equal(mails[0].organizationName, 'Hea Hoolekanne OÜ');
});

test('kinnituslink: pärast lingi saatmist muudetud nimi kinnitust ei saa', async () => {
  const file = await registerFile();
  const checkName = (input) => checkRegisterName(input, { file });
  const pending = (over = {}) => profile({
    representationRequestHash: hashToken(TOKEN),
    representationRequestCode: '10000010',
    representationRequestExpiresAt: new Date(NOW.getTime() + 86400000),
    representationRequestSentAt: new Date(NOW.getTime() - 3600000),
    ...over
  });
  const renamed = fakeDb(pending({ organizationName: 'Tuntud Hooldekodu AS' }));
  await rejectsWith(confirmRepresentationByLink({ ownerId: 'user_1', token: TOKEN }, { db: renamed, now: NOW, hashToken, checkName }), RepresentationLinkError.NAME_MISMATCH, 409);
  assert.equal(renamed.state.profile.representationConfirmedAt, null);
  /* Link jääb alles: kui nimi on parandatud, saab sama lingiga kinnitada. */
  assert.equal(renamed.state.profile.representationRequestHash, hashToken(TOKEN));
  renamed.state.profile.organizationName = 'Hea Hoolekanne OÜ';
  const result = await confirmRepresentationByLink({ ownerId: 'user_1', token: TOKEN }, { db: renamed, now: NOW, hashToken, checkName });
  assert.equal(result.confirmed, true);
  assert.equal(renamed.state.profile.representationRegistryCode, '10000010');
});

test('organisatsiooni profiil: avaldatud profiili nime ei saa muuta mööda nimeväravat', async () => {
  const file = await registerFile();
  const checkName = (input) => checkRegisterName(input, { file });
  const context = {
    kind: 'organization',
    userId: 'user_1',
    organization: { id: 'org_1' },
    capabilities: [{ capability: 'SERVICE_PROFILE_EDITOR', scopeType: 'ORGANIZATION' }]
  };
  const orgDb = (row) => {
    const state = { row: { id: 'prof_org', organizationId: 'org_1', ownershipMode: 'ORGANIZATION', updatedAt: UPDATED, ...row }, audits: 0 };
    const tx = {
      serviceProviderProfile: {
        findFirst: async () => ({ ...state.row }),
        updateMany: async ({ data }) => { Object.assign(state.row, data); return { count: 1 }; },
        findUnique: async () => ({ ...state.row })
      },
      dataAuditLog: { create: async () => { state.audits += 1; } }
    };
    return { ...tx, $transaction: async (run) => run(tx), state };
  };
  const rename = (db, organizationName, over = {}) => updateOrganizationProfile(
    context,
    { profileId: 'prof_org', expectedUpdatedAt: UPDATED.toISOString(), data: { organizationName } },
    { db, checkName, ...over }
  );
  /* Kinnitatud ja avaldatud profiil: nimi jääb registri nimeks. */
  const published = orgDb({ status: 'PUBLISHED', registryCode: '10000010', organizationName: 'Hea Hoolekanne OÜ' });
  await rejectsWith(rename(published, 'Tuntud Hooldekodu AS'), RegisterNamePublicationError.NAME_MISMATCH, 400);
  await rejectsWith(rename(published, 'Hea Hoolekanne OÜ', { checkName: async () => ({ result: 'unavailable', registerName: null }) }), RegisterNamePublicationError.REGISTER_UNAVAILABLE, 409);
  assert.equal(published.state.row.organizationName, 'Hea Hoolekanne OÜ');
  assert.equal(published.state.audits, 0);
  await rename(published, 'HEA HOOLEKANNE OÜ');
  assert.equal(published.state.row.organizationName, 'HEA HOOLEKANNE OÜ');
  /* Registrikoodita avaldatud profiil ei saa võtta registrisse kantud asutuse nime. */
  const codeless = orgDb({ status: 'PUBLISHED', registryCode: null, organizationName: 'Juta Kask' });
  await rejectsWith(rename(codeless, 'Abi OÜ'), RegisterNamePublicationError.CODE_REQUIRED, 400);
  await rename(codeless, 'Juta Kask ja pojad');
  /* Mustandi nime register ei takista; muu välja muutmine nimekontrolli ei küsi. */
  const draft = orgDb({ status: 'DRAFT', registryCode: '10000010', organizationName: 'Hea Hoolekanne OÜ' });
  await rename(draft, 'Tuntud Hooldekodu AS');
  await updateOrganizationProfile(
    context,
    { profileId: 'prof_org', expectedUpdatedAt: UPDATED.toISOString(), data: { phone: '5550000' } },
    { db: published, checkName: async () => { throw new Error('nimekontrolli ei tohi küsida'); } }
  );
});

test('teenuseosutaja vaade ja kinnitusleht: nimi, mis ei vasta registrile, tuleb enne parandada', async () => {
  const file = await registerFile();
  const checkName = (input) => checkRegisterName(input, { file });
  const wrong = await describeRepresentationForOwner('user_1', { db: fakeDb(profile({ organizationName: 'Tuntud Hooldekodu AS' })), now: NOW, checkName });
  assert.equal(wrong.nameCheck, 'mismatch');
  assert.equal(wrong.registerName, 'Hea Hoolekanne OÜ');
  const right = await describeRepresentationForOwner('user_1', { db: fakeDb(profile()), now: NOW, checkName });
  assert.equal(right.nameCheck, 'match');
  /* Registrikoodita profiili kohta kinnituslehel nime ei kontrollita. */
  const codeless = await describeRepresentationForOwner('user_1', { db: fakeDb(profile({ registryCode: null })), now: NOW, checkName });
  assert.equal(codeless.nameCheck, null);

  const base = { session: 'authenticated', loaded: true, forbidden: false, hasToken: false, done: false, link: null };
  const state = (over) => ({ hasProfile: true, required: true, confirmed: false, nameCheck: 'match', ...over });
  assert.equal(representationView({ ...base, state: state() }), 'request');
  assert.equal(representationView({ ...base, state: state({ nameCheck: 'mismatch' }) }), 'name');
  assert.equal(representationView({ ...base, state: state({ nameCheck: 'code_not_listed' }) }), 'name');
  /* Kehtiv link ega varasem kinnitus ei vii vale nimega profiili kinnitamise vaatesse. */
  assert.equal(representationView({ ...base, hasToken: true, link: { valid: true }, state: state({ nameCheck: 'mismatch' }) }), 'name');
  assert.equal(representationView({ ...base, state: state({ nameCheck: 'mismatch', confirmed: true }) }), 'name');
  /* „Ei tea" jätab vormi ette: saatmisel vastab server oma lausega. */
  assert.equal(representationView({ ...base, state: state({ nameCheck: 'unavailable' }) }), 'request');
  assert.equal(representationView({ ...base, state: { hasProfile: true, required: false, nameCheck: null } }), 'no_profile');
});

test('vorm: nimekontrolli vastus loeb ainult praeguse nime ja koodi kohta', () => {
  const form = { ...createServiceProfileForm(), organizationName: ' Tuntud Hooldekodu AS ', registryCode: '10000010 ' };
  assert.equal(registerNameKey(form), '10000010\nTuntud Hooldekodu AS');
  const answer = { key: registerNameKey(form), result: 'mismatch', registerName: 'Hea Hoolekanne OÜ', registerDate: '2026-10-11' };
  assert.deepEqual(registerNameState(form, answer), { result: 'mismatch', registerName: 'Hea Hoolekanne OÜ', registerDate: '2026-10-11', problem: true });
  /* Pärast muudatust vana vastus ei loe, kuni uus tuleb. */
  assert.equal(registerNameState({ ...form, organizationName: 'Hea Hoolekanne OÜ' }, answer), null);
  assert.equal(registerNameState({ ...form, registryCode: '10000020' }, answer), null);
  assert.equal(registerNameState(form, null), null);
  assert.equal(registerNameState(form, { ...answer, result: 'match' }).problem, false);
  assert.equal(registerNameState(form, { ...answer, result: 'free' }).problem, false);
  for (const result of ['mismatch', 'code_not_listed', 'code_required', 'unavailable']) {
    assert.equal(registerNameState(form, { ...answer, result }).problem, true, result);
  }
  /* Vorm tunneb täpselt neid vastuseid, mida server annab. */
  assert.deepEqual(Object.values(RegisterNameResult).sort(), ['code_not_listed', 'code_required', 'free', 'match', 'mismatch', 'unavailable']);
});

test('vorm: nimi, mis ei vasta registrile, takistab avaldatud profiili salvestamist ja rida viib sammu „Organisatsioon”', () => {
  const published = {
    ...createServiceProfileForm(),
    organizationName: 'Tuntud Hooldekodu AS',
    registryCode: '10000010',
    status: 'PUBLISHED',
    email: 'info@heahoolekanne.test',
    serviceItems: [{ name: 'Koduteenus', status: 'PUBLISHED', mapVisible: true }]
  };
  const state = (result, registerName = '') => registerNameState(published, { key: registerNameKey(published), result, registerName });
  assert.deepEqual(serviceProfilePublishState(published).blocking, []);
  assert.deepEqual(serviceProfilePublishState(published, null, state('match')).blocking, []);
  for (const result of ['mismatch', 'code_not_listed', 'code_required', 'unavailable']) {
    assert.deepEqual(serviceProfilePublishState(published, null, state(result)).blocking, ['register_name'], result);
    assert.deepEqual(serviceProfilePublishState({ ...published, status: 'DRAFT' }, null, state(result)).blocking, [], `${result}: mustand`);
  }
  const row = (register) => serviceProfilePublishChecks(published, null, null, null, register).find((item) => item.key === 'register_name');
  assert.equal(row(null), undefined);
  assert.equal(row(state('free')), undefined);
  assert.deepEqual(
    { ok: row(state('match')).ok, blocking: row(state('match')).blocking, textKey: row(state('match')).textKey },
    { ok: true, blocking: false, textKey: 'publish_checks.register_name_ok' }
  );
  const mismatch = row(state('mismatch', 'Hea Hoolekanne OÜ'));
  assert.deepEqual(
    { ok: mismatch.ok, blocking: mismatch.blocking, view: mismatch.view, textKey: mismatch.textKey, detailVars: mismatch.detailVars },
    { ok: false, blocking: true, view: 'who', textKey: 'publish_checks.register_name_mismatch', detailVars: { name: 'Hea Hoolekanne OÜ' } }
  );
  /* Füüsilisest isikust ettevõtja: rida ilma nimeta. */
  assert.equal(row(state('mismatch')).detailKey, undefined);
  assert.equal(row(state('code_required')).textKey, 'publish_checks.register_code_required');
  assert.equal(row(state('code_not_listed')).textKey, 'publish_checks.register_code_not_listed');
  assert.equal(row(state('unavailable')).textKey, 'publish_checks.register_unavailable');
  /* Mustandil rida ei takista, aga jääb „vaata üle" hulka; samm jääb pooleli. */
  assert.equal(serviceProfilePublishChecks({ ...published, status: 'DRAFT' }, null, null, null, state('mismatch')).find((item) => item.key === 'register_name').blocking, false);
  assert.equal(profileViewStates(published, null, null, null, state('mismatch')).who, 'partial');
  assert.equal(profileViewStates(published, null, null, null, state('match')).who, 'done');
  assert.equal(profileViewStates(published, null).who, 'done');
});

test('serveri vastus: „praegu ei saa kontrollida” jõuab inimeseni oma lausega, muu 503 mitte', () => {
  const unavailable = Object.assign(new Error(RegisterNamePublicationError.REGISTER_UNAVAILABLE), { status: 503 });
  assert.deepEqual(serviceProviderProfileErrorDescriptor(unavailable, 'service_provider_profile.errors.save_failed', 'corr-12345678'), {
    status: 503,
    messageKey: RegisterNamePublicationError.REGISTER_UNAVAILABLE,
    extras: { correlationId: 'corr-12345678' }
  });
  const other = Object.assign(new Error('midagi muud'), { status: 503 });
  assert.equal(serviceProviderProfileErrorDescriptor(other, 'service_provider_profile.errors.save_failed', 'corr-12345678').messageKey, 'service_provider_profile.errors.save_failed');
  for (const key of [RegisterNamePublicationError.NAME_MISMATCH, RegisterNamePublicationError.CODE_NOT_LISTED, RegisterNamePublicationError.CODE_REQUIRED]) {
    const error = Object.assign(new Error(key), { status: 400, details: { field: 'organizationName' } });
    assert.deepEqual(serviceProviderProfileErrorDescriptor(error, 'x', 'corr-12345678'), { status: 400, messageKey: key, extras: { details: { field: 'organizationName' } } });
  }
});

test('iga uus keeld ja vormi rida on kolmes keeles lausega olemas', () => {
  const keys = [
    ...Object.values(RegisterNamePublicationError),
    RepresentationLinkError.NAME_MISMATCH,
    RepresentationLinkError.CODE_NOT_LISTED,
    ...Object.values(AdminRepresentationNameError),
    ...['name_title', 'name_mismatch', 'name_mismatch_hidden', 'code_not_listed'].map((key) => `service_provider_profile.representation.${key}`),
    ...['mismatch', 'mismatch_hidden', 'use', 'code_not_listed', 'code_required', 'unavailable', 'as_of'].map((key) => `workspace_feature_pages.service_profile.register_name.${key}`),
    ...['register_name_ok', 'register_name_mismatch', 'register_code_not_listed', 'register_code_required', 'register_unavailable', 'register_name_detail'].map((key) => `workspace_feature_pages.service_profile.publish_checks.${key}`),
    ...['name_match', 'name_mismatch', 'name_mismatch_hidden', 'name_code_not_listed', 'name_unavailable', 'confirm_blocked'].map((key) => `admin.service_representation.${key}`)
  ];
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    for (const key of keys) {
      const text = key.split('.').reduce((node, part) => node?.[part], messages);
      assert.ok(typeof text === 'string' && text.length > 10, `${locale}: ${key}`);
    }
    /* Kohatäited, mida leht täidab, on igas keeles alles. */
    assert.ok(messages.service_provider_profile.representation.name_mismatch.includes('{registerName}'), locale);
    assert.ok(messages.workspace_feature_pages.service_profile.register_name.mismatch.includes('{name}'), locale);
    assert.ok(messages.workspace_feature_pages.service_profile.register_name.as_of.includes('{date}'), locale);
    assert.ok(messages.admin.service_representation.name_mismatch.includes('{name}'), locale);
  }
});

test('hoidlas olev nimede fail on terve: päis klapib, read on koodi järjekorras ja loetavad', async () => {
  const file = new URL('../src/server/data/business-register-names.tsv', import.meta.url);
  const content = readFileSync(file);
  const meta = JSON.parse(readFileSync(new URL('../src/server/data/business-register-names.meta.json', import.meta.url), 'utf8'));
  const contacts = JSON.parse(readFileSync(new URL('../src/server/data/business-register-contact-hashes.meta.json', import.meta.url), 'utf8'));
  assert.equal(content.length, meta.bytes);
  assert.equal(createHash('sha256').update(content).digest('hex'), meta.sha256);
  assert.equal(meta.entries, meta.plainNames + meta.hashedNames);
  assert.ok(meta.plainNames > 250000, String(meta.plainNames));
  assert.ok(meta.hashedNames > 10000, String(meta.hashedNames));
  /* Mõlemad kontrollfailid on tehtud registri samast seisust. */
  assert.equal(meta.sourceLastModified, contacts.sourceLastModified);
  assert.equal(meta.entries, contacts.registered);
  /* Failis ei ole Windowsi reavahetusi: read loetakse baidinihete järgi. */
  assert.equal(content.includes(13), false);
  resetRegisterNamesCache();
  const register = await loadRegisterNames({ file: path.resolve('src/server/data/business-register-names.tsv') });
  assert.equal(register.entries, meta.entries);
  /* Füüsilisest isikust ettevõtja real on räsi, mitte nimi. */
  let hashed = 0;
  let start = 0;
  while (start < content.length) {
    const end = content.indexOf(10, start);
    const tab = content.indexOf(9, start);
    if (content[tab + 1] === 72) {
      hashed += 1;
      if (hashed <= 200) assert.match(content.toString('latin1', tab + 3, end), /^[a-f0-9]{16}$/u);
    }
    start = end + 1;
  }
  assert.equal(hashed, meta.hashedNames);
  assert.ok(meta.hashedNames >= meta.byLegalForm.FIE, 'iga füüsilisest isikust ettevõtja on räsina');
  resetRegisterNamesCache();
});

// Teenuseprofiili leht ütleb asutuse kinnituse seisu ENNE salvestamist.
//
// Server lubab registrikoodiga profiili avaldada alles pärast kinnitust
// (lib/serviceProviderRepresentation.js). Leht näitas seda seni ainult veana pärast
// salvestamise vajutust. Otsus, mida leht näitab ja mida ta pakub, on mudelis
// (components/workspace/serviceProfile/profileModel.js); siin on selle käitumine ja
// võrdlus serveri väravaga.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PROFILE_VIEW_KEYS,
  REPRESENTATION_PATH,
  createServiceProfileForm,
  profileViewStates,
  profileViewSummaries,
  representationDate,
  representationStatus,
  serviceProfileOptionSets,
  serviceProfilePublishChecks,
  serviceProfilePublishState,
  statusChoices,
  withRepresentationState
} from '../components/workspace/serviceProfile/profileModel.js';
import { assertRepresentationForPublication, representationState } from '../lib/serviceProviderRepresentation.js';
import { REPRESENTATION_CONFIRM_PATH } from '../lib/serviceProviderRepresentationMail.js';

const CONFIRMED_AT = '2026-10-11T08:00:00.000Z';
const LANGS = ['et', 'en', 'ru'];
const catalog = (lang) => JSON.parse(fs.readFileSync(new URL(`../messages/${lang}.json`, import.meta.url), 'utf8'));
const tp = (key, fallback, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : `[${key}]`);

/* Profiil nii, nagu server selle annab: `row` on andmebaasi rida, `representation` arvutab serveri reegel. */
function served(row) {
  if (!row) return null;
  const { required, confirmed, confirmedAt, method } = representationState(row);
  return {
    updatedAt: '2026-10-10T10:00:00.000Z',
    organizationName: 'Hea Hoolekanne OÜ',
    registryCode: row.registryCode || '',
    status: row.status || 'DRAFT',
    email: 'info@hoolekanne.example',
    serviceItems: [{ id: 'svc-a', name: 'Koduteenus', status: 'PUBLISHED' }],
    representation: { required, confirmed, confirmedAt, method }
  };
}
const unconfirmedRow = { registryCode: '12345678' };
const confirmedRow = {
  registryCode: '12345678',
  representationConfirmedAt: CONFIRMED_AT,
  representationRegistryCode: '12345678',
  representationMethod: 'ADMIN'
};
const formOf = (profile, over = {}) => ({ ...createServiceProfileForm(profile), ...over });

test('kolm seisu: koodita, kood kinnitamata, kinnitatud', () => {
  const noCode = served({ registryCode: '' });
  assert.deepEqual(
    representationStatus(formOf(noCode), noCode),
    { kind: 'none', blocksPublish: false, step: null, code: '', confirmedAt: null, line: null },
    'registrikoodita profiil avaldatakse nagu varem ja rida ei ole'
  );

  const open = served(unconfirmedRow);
  const unconfirmed = representationStatus(formOf(open), open);
  assert.equal(unconfirmed.kind, 'unconfirmed');
  assert.equal(unconfirmed.blocksPublish, true);
  assert.equal(unconfirmed.step, 'confirm', 'salvestatud vormilt saab kohe kinnitamise lehele');
  assert.equal(unconfirmed.line.key, 'representation.unconfirmed');

  const done = served(confirmedRow);
  const confirmed = representationStatus(formOf(done), done);
  assert.equal(confirmed.kind, 'confirmed');
  assert.equal(confirmed.blocksPublish, false);
  assert.equal(confirmed.step, null);
  assert.equal(confirmed.confirmedAt, CONFIRMED_AT);
  assert.equal(confirmed.line.key, 'representation.confirmed');
});

test('salvestamata vormilt kinnitamise lehele ei saadeta', () => {
  /* Kinnitamise leht on teine leht: sinna minnes kaoksid salvestamata muudatused. */
  const open = served(unconfirmedRow);
  const dirty = representationStatus(formOf(open, { organizationName: 'Uus nimi' }), open, { dirty: true });
  assert.deepEqual([dirty.kind, dirty.step, dirty.line.key], ['unconfirmed', 'save', 'representation.save_first']);

  /* Uus profiil: koodi ei ole serveris veel olemas, kinnitada ei ole midagi. */
  const fresh = representationStatus(formOf(null, { registryCode: '12345678' }), null, { dirty: true });
  assert.deepEqual([fresh.kind, fresh.blocksPublish, fresh.step, fresh.line.key], ['unsaved', true, 'save', 'representation.save_first']);

  /* Kinnitatud profiilil muudetud kood: kinnitus on vana koodi kohta ja lause nimetab selle. */
  const done = served(confirmedRow);
  const changed = representationStatus(formOf(done, { registryCode: '87654321' }), done, { dirty: true });
  assert.deepEqual([changed.kind, changed.blocksPublish, changed.step, changed.code], ['changed', true, 'save', '12345678']);
  assert.equal(changed.line.key, 'representation.changed');
  assert.equal(changed.confirmedAt, null, 'vana koodi kuupäeva uue koodi juures ei näidata');

  /* Koodi kustutamine: registrikoodita profiil ei vaja kinnitust. */
  assert.equal(representationStatus(formOf(done, { registryCode: '  ' }), done, { dirty: true }).kind, 'none');
  /* Tühikud koodi ümber ei tee sellest teist koodi (server puhastab samamoodi). */
  assert.equal(representationStatus(formOf(done, { registryCode: ' 12345678 ' }), done, { dirty: true }).kind, 'confirmed');
});

test('seisu, mida server kaasa ei andnud, leht ise välja ei mõtle', () => {
  const profile = { ...served(unconfirmedRow), representation: undefined };
  const status = representationStatus(formOf(profile), profile);
  assert.deepEqual([status.kind, status.blocksPublish, status.line], ['unknown', false, null]);
  assert.deepEqual(serviceProfilePublishState(formOf(profile, { status: 'PUBLISHED' }), status).blocking, []);
});

test('lehe otsus on sama mis serveri väraval', () => {
  /* Iga juhtum: rida andmebaasis ja kood vormil. Leht lukustab avaldamise täpselt siis,
     kui server avaldatud profiili salvestamise tagasi lükkaks. */
  const cases = [
    [null, ''],
    [null, '12345678'],
    [{ registryCode: '' }, ''],
    [{ registryCode: '' }, '12345678'],
    [unconfirmedRow, '12345678'],
    [unconfirmedRow, '87654321'],
    [unconfirmedRow, ''],
    [confirmedRow, '12345678'],
    [confirmedRow, ' 12345678'],
    [confirmedRow, '87654321'],
    [confirmedRow, ''],
    /* Kood on pärast kinnitust muudetud ja salvestatud: kinnitus on teise koodi kohta. */
    [{ ...confirmedRow, registryCode: '87654321' }, '87654321']
  ];
  for (const [row, formCode] of cases) {
    const profile = served(row);
    let serverRefuses = false;
    try {
      /* Server puhastab koodi enne väravat (`normalizeText`): tühikud servadest maha. */
      assertRepresentationForPublication({ status: 'PUBLISHED', registryCode: formCode.trim() || null }, row);
    } catch {
      serverRefuses = true;
    }
    const status = representationStatus(formOf(profile, { registryCode: formCode }), profile);
    assert.equal(status.blocksPublish, serverRefuses, `rida ${JSON.stringify(row?.registryCode)} / ${JSON.stringify(row?.representationRegistryCode)}, vorm ${JSON.stringify(formCode)}`);
  }

  /* ÜKS TEADAOLEV ERINEVUS. Kood kinnitati, muudeti ja salvestati ning kirjutati siis vormil
     tagasi kinnitatud koodiks. Server lubaks avaldada (kinnitus on selle koodi kohta alles), aga
     leht ei tea, mis koodi kohta kinnitus on: profiiliga tuleb kaasa ainult salvestatud koodi seis.
     Leht on siin rangem ja juhatab mustandina salvestama; pärast seda on seis „kinnitatud". */
  const staleRow = { ...confirmedRow, registryCode: '87654321' };
  const stale = served(staleRow);
  assert.doesNotThrow(() => assertRepresentationForPublication({ status: 'PUBLISHED', registryCode: '12345678' }, staleRow));
  const typedBack = representationStatus(formOf(stale, { registryCode: '12345678' }), stale, { dirty: true });
  assert.deepEqual([typedBack.kind, typedBack.blocksPublish, typedBack.step], ['unsaved', true, 'save']);
  const afterDraftSave = served({ ...staleRow, registryCode: '12345678' });
  assert.equal(representationStatus(formOf(afterDraftSave), afterDraftSave).kind, 'confirmed');
});

test('kinnitamata asutusega ei saa avaldatud profiili salvestada, mustandi saab', () => {
  const open = served(unconfirmedRow);
  const status = representationStatus(formOf(open), open);
  assert.deepEqual(serviceProfilePublishState(formOf(open, { status: 'PUBLISHED' }), status).blocking, ['representation']);
  for (const draft of ['DRAFT', 'REVIEW', 'HIDDEN']) {
    assert.deepEqual(serviceProfilePublishState(formOf(open, { status: draft }), status).blocking, [], draft);
  }
  const done = served(confirmedRow);
  assert.deepEqual(serviceProfilePublishState(formOf(done, { status: 'PUBLISHED' }), representationStatus(formOf(done), done)).blocking, []);
  /* Ilma seisuta (vana kutse) kinnitust ei arvestata. */
  assert.deepEqual(serviceProfilePublishState(formOf(open, { status: 'PUBLISHED' })).blocking, []);
});

test('staatust „Avaldatud" ei pakuta, kui avaldamine ei õnnestuks', () => {
  const options = serviceProfileOptionSets((key, fallback) => fallback).status;
  const values = (list) => list.map((option) => option.value);
  const open = served(unconfirmedRow);
  const blocked = representationStatus(formOf(open), open);
  assert.deepEqual(values(statusChoices(options, 'DRAFT', blocked)), ['DRAFT', 'REVIEW', 'HIDDEN']);
  /* Juba avaldatud profiilil (avaldatud enne reeglit) on see praegune väärtus ja jääb näha,
     ka siis, kui inimene vormil vahepeal teise staatuse valib. */
  assert.deepEqual(values(statusChoices(options, 'PUBLISHED', blocked)), ['DRAFT', 'REVIEW', 'PUBLISHED', 'HIDDEN']);
  assert.deepEqual(values(statusChoices(options, 'DRAFT', blocked, 'PUBLISHED')), ['DRAFT', 'REVIEW', 'PUBLISHED', 'HIDDEN']);
  assert.deepEqual(values(statusChoices(options, 'DRAFT', blocked, 'DRAFT')), ['DRAFT', 'REVIEW', 'HIDDEN']);
  const done = served(confirmedRow);
  assert.equal(statusChoices(options, 'DRAFT', representationStatus(formOf(done), done)), options);
  assert.equal(statusChoices(options, 'DRAFT', null), options);
});

test('avaldamise kontroll: rida ütleb seisu ja viib sinna, kus midagi teha saab', () => {
  const open = served(unconfirmedRow);
  const status = representationStatus(formOf(open), open);
  const rows = serviceProfilePublishChecks(formOf(open, { status: 'PUBLISHED' }), null, null, status);
  const row = rows.find((item) => item.key === 'representation');
  assert.deepEqual(
    { ok: row.ok, blocking: row.blocking, view: row.view, href: row.href, textKey: row.textKey },
    { ok: false, blocking: true, view: 'who', href: REPRESENTATION_PATH, textKey: 'publish_checks.representation_missing' }
  );
  assert.ok(PROFILE_VIEW_KEYS.includes(row.view));
  assert.equal(rows.indexOf(row), 1, 'rida on kohe staatuse rea järel');
  /* Mustandil on rida „vaata üle", mitte „puudu": salvestamist see ei takista. */
  const draftRow = serviceProfilePublishChecks(formOf(open), null, null, status).find((item) => item.key === 'representation');
  assert.deepEqual([draftRow.ok, draftRow.blocking], [false, false]);
  /* Salvestamata vormilt linki ei ole: rida viib registrikoodi vaatesse. */
  const dirty = representationStatus(formOf(open), open, { dirty: true });
  assert.equal(serviceProfilePublishChecks(formOf(open), null, null, dirty).find((item) => item.key === 'representation').href, undefined);

  const done = served(confirmedRow);
  const okRow = serviceProfilePublishChecks(formOf(done), null, null, representationStatus(formOf(done), done)).find((item) => item.key === 'representation');
  assert.deepEqual([okRow.ok, okRow.blocking, okRow.textKey, okRow.href], [true, false, 'publish_checks.representation_confirmed', undefined]);

  /* Registrikoodita profiilil rida ei ole. */
  const noCode = served({ registryCode: '' });
  const none = serviceProfilePublishChecks(formOf(noCode), null, null, representationStatus(formOf(noCode), noCode));
  assert.ok(!none.some((item) => item.key === 'representation'));
  assert.ok(!serviceProfilePublishChecks(formOf(open), null).some((item) => item.key === 'representation'), 'ilma seisuta rida ei teki');

  /* Kontrolli samm ja kokkuvõte loevad kinnitamata asutust lahtise asjana. */
  const options = serviceProfileOptionSets((key, fallback) => fallback);
  const form = formOf(open);
  const before = profileViewSummaries(form, null, { tp, options }).check;
  const after = profileViewSummaries(form, null, { tp, options, representation: status }).check;
  const count = (text) => Number(/"count":(\d+)/.exec(text)?.[1] || 0);
  assert.equal(count(after), count(before) + 1);
  assert.notEqual(profileViewStates(form, null, null, status).check, 'done');
});

test('lehele naastes loetud seis jõuab profiilile ainult sama registrikoodi kohta', () => {
  const open = served(unconfirmedRow);
  const fresh = { hasProfile: true, registryCode: '12345678', required: true, confirmed: true, confirmedAt: CONFIRMED_AT, method: 'EMAIL_LINK' };
  const updated = withRepresentationState(open, fresh);
  assert.deepEqual(updated.representation, { required: true, confirmed: true, confirmedAt: CONFIRMED_AT, method: 'EMAIL_LINK' });
  assert.equal(updated.updatedAt, open.updatedAt, 'profiili muu sisu jääb samaks');
  assert.equal(representationStatus(formOf(updated), updated).kind, 'confirmed');
  /* Midagi ei muutunud: sama objekt, leht ei joonista uuesti. */
  assert.equal(withRepresentationState(open, { ...fresh, confirmed: false, confirmedAt: null }), open);
  assert.equal(withRepresentationState(updated, fresh), updated);
  /* Teise koodi seis, puuduv profiil või tühi vastus ei muuda midagi. */
  assert.equal(withRepresentationState(open, { ...fresh, registryCode: '87654321' }), open);
  assert.equal(withRepresentationState(open, { hasProfile: false }), open);
  assert.equal(withRepresentationState(open, null), open);
  assert.equal(withRepresentationState(null, fresh), null);
});

test('kuupäev on lehe keeles ja loetamatu kuupäev ei jäta lausesse tühja kohta', () => {
  assert.equal(representationDate(CONFIRMED_AT, 'et'), new Intl.DateTimeFormat('et', { dateStyle: 'medium' }).format(new Date(CONFIRMED_AT)));
  assert.notEqual(representationDate(CONFIRMED_AT, 'et'), representationDate(CONFIRMED_AT, 'en'));
  assert.ok(representationDate(CONFIRMED_AT, 'ru').includes('2026'));
  assert.equal(representationDate('', 'et'), '');
  assert.equal(representationDate('ei ole kuupäev', 'et'), '');
  const done = served(confirmedRow);
  const undated = { ...done, representation: { ...done.representation, confirmedAt: null } };
  assert.equal(representationStatus(formOf(undated), undated).line.key, 'publish_checks.representation_confirmed');
});

test('laused on kataloogis kolmes keeles ja räägivad samast lehest mis serveri vealause', () => {
  assert.equal(REPRESENTATION_PATH, REPRESENTATION_CONFIRM_PATH, 'link viib samale lehele, kuhu kinnituskiri');
  const done = served(confirmedRow);
  const open = served(unconfirmedRow);
  const lines = [
    representationStatus(formOf(done), done),
    representationStatus(formOf(open), open),
    representationStatus(formOf(open), open, { dirty: true }),
    representationStatus(formOf(done, { registryCode: '87654321' }), done)
  ].map((status) => status.line);
  assert.deepEqual(lines.map((line) => line.key), [
    'representation.confirmed',
    'representation.unconfirmed',
    'representation.save_first',
    'representation.changed'
  ]);
  for (const lang of LANGS) {
    const messages = catalog(lang);
    const page = messages.workspace_feature_pages.service_profile;
    const text = (key) => key.split('.').reduce((node, part) => node?.[part], page);
    for (const line of lines) assert.equal(typeof text(line.key), 'string', `${lang}: ${line.key}`);
    assert.ok(text('representation.confirmed').includes('{date}'), `${lang}: kuupäeva koht`);
    assert.ok(text('representation.changed').includes('{code}'), `${lang}: koodi koht`);
    for (const key of ['publish_checks.representation_confirmed', 'publish_checks.representation_missing']) {
      assert.equal(typeof text(key), 'string', `${lang}: ${key}`);
    }
    /* Lause nimetab lehte sama nimega, mis on lingil ja serveri vealauses. */
    const pageName = text('representation.open');
    assert.ok(text('representation.save_first').includes(pageName), `${lang}: lehe nimi lauses`);
    assert.ok(text('representation.changed').includes(pageName), `${lang}: lehe nimi lauses`);
    assert.ok(messages.service_provider_profile.errors.publish_representation_required.includes(pageName), `${lang}: sama nimi vealauses`);
    /* Toorväärtusi (kinnituse viis) lausetes ei ole. */
    for (const line of lines) assert.ok(!/ADMIN|EMAIL_LINK|\{method\}/.test(text(line.key)), `${lang}: ${line.key}`);
  }
  /* Eesti varutekst mudelis on sama mis kataloogis. */
  const et = catalog('et').workspace_feature_pages.service_profile;
  for (const line of lines) assert.equal(line.fallback, line.key.split('.').reduce((node, part) => node?.[part], et), line.key);
});

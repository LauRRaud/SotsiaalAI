// TEENUSEPROFIIL — kinnitus, et profiili tegija esindab seda asutust.
//
// Auk: teenuseosutaja kontoga inimene sai kirjutada profiili võõra asutuse nime ja registrikoodi,
// profiili avaldada ja saada ka märgise „tegevusluba kontrollitud". Reegel: registrikoodiga
// profiili ei avaldata enne kinnitust; kinnitus kehtib ühe registrikoodi kohta.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REPRESENTATION_REQUIRED_KEY,
  assertRepresentationForPublication,
  confirmRepresentationAsAdmin,
  listRepresentationAdminRows,
  representationState,
  revokeRepresentationAsAdmin
} from '../lib/serviceProviderRepresentation.js';

const NOW = new Date('2026-10-11T08:00:00.000Z');
const UPDATED = new Date('2026-10-10T10:00:00.000Z');
/* Nimekontroll äriregistri vastu antakse ette nagu kontaktikontroll: need testid käivad kinnituse
   enda kohta. Nime reegleid hoiab tests/business-register-names.test.mjs. */
const nameMatches = async () => ({ result: 'match', registerName: 'Hea Hoolekanne OÜ' });

function fakeDb(profile, { entries = [{ providerProfileId: profile?.id, status: 'PUBLISHED' }] } = {}) {
  const state = { profile: profile ? { ...profile } : null, entries: entries.map((entry) => ({ ...entry })), events: [] };
  const matches = (where = {}) => state.profile
    && (!where.id || where.id === state.profile.id)
    && (!where.ownershipMode || where.ownershipMode === state.profile.ownershipMode)
    && (!('registryCode' in where) || typeof where.registryCode === 'object' || where.registryCode === state.profile.registryCode);
  const tx = {
    serviceProviderProfile: {
      findFirst: async ({ where }) => (matches(where) ? { ...state.profile } : null),
      findMany: async () => (state.profile ? [{ ...state.profile }] : []),
      updateMany: async ({ where, data }) => {
        if (!matches(where)) return { count: 0 };
        Object.assign(state.profile, data);
        return { count: 1 };
      },
      update: async ({ where, data }) => {
        assert.equal(where.id, state.profile.id);
        Object.assign(state.profile, data);
        return { ...state.profile };
      }
    },
    serviceMapEntry: {
      updateMany: async ({ where, data }) => {
        const hit = state.entries.filter((entry) => entry.providerProfileId === where.providerProfileId);
        hit.forEach((entry) => Object.assign(entry, data));
        return { count: hit.length };
      }
    },
    domainEvent: { create: async ({ data }) => { state.events.push(data); return data; } }
  };
  return { ...tx, $transaction: async (run) => run(tx), state };
}

const profile = (over = {}) => ({
  id: 'prof_1',
  ownershipMode: 'SOLO',
  organizationName: 'Hea Hoolekanne OÜ',
  registryCode: '12345678',
  status: 'DRAFT',
  updatedAt: UPDATED,
  representationConfirmedAt: null,
  representationRegistryCode: null,
  representationMethod: null,
  representationBasis: null,
  owner: { email: 'omanik@example.test' },
  ...over
});

test('seis: registrikoodita profiil ei vaja kinnitust, koodiga vajab', () => {
  assert.deepEqual(representationState({ registryCode: '' }), { required: false, confirmed: false, confirmedAt: null, method: null, stale: false });
  assert.deepEqual(representationState({ registryCode: '  ' }).required, false);
  const open = representationState(profile());
  assert.equal(open.required, true);
  assert.equal(open.confirmed, false);
});

test('seis: kinnitus kehtib ainult selle koodi kohta, mille kohta see anti', () => {
  const confirmed = profile({ representationConfirmedAt: NOW, representationRegistryCode: '12345678', representationMethod: 'ADMIN' });
  assert.deepEqual(representationState(confirmed), { required: true, confirmed: true, confirmedAt: NOW, method: 'ADMIN', stale: false });
  const changed = representationState({ ...confirmed, registryCode: '87654321' });
  assert.equal(changed.confirmed, false);
  assert.equal(changed.stale, true);
  assert.equal(changed.confirmedAt, null);
  /* Tühikud koodi ümber ei tee sellest teist koodi. */
  assert.equal(representationState({ ...confirmed, registryCode: ' 12345678 ' }).confirmed, true);
});

test('värav: registrikoodiga profiili ei avaldata ilma kinnituseta', () => {
  assert.throws(
    () => assertRepresentationForPublication({ status: 'PUBLISHED', registryCode: '12345678' }, null),
    (error) => error.message === REPRESENTATION_REQUIRED_KEY && error.status === 400 && error.details.field === 'registryCode'
  );
  assert.throws(
    () => assertRepresentationForPublication({ status: 'PUBLISHED', registryCode: '12345678' }, profile()),
    (error) => error.message === REPRESENTATION_REQUIRED_KEY
  );
});

test('värav: mustand, registrikoodita profiil ja kinnitatud profiil lähevad läbi', () => {
  assertRepresentationForPublication({ status: 'DRAFT', registryCode: '12345678' }, null);
  assertRepresentationForPublication({ status: 'HIDDEN', registryCode: '12345678' }, profile());
  assertRepresentationForPublication({ status: 'PUBLISHED', registryCode: null }, null);
  assertRepresentationForPublication(
    { status: 'PUBLISHED', registryCode: '12345678' },
    profile({ representationConfirmedAt: NOW, representationRegistryCode: '12345678', representationMethod: 'ADMIN' })
  );
});

test('värav: pärast registrikoodi muutmist vana kinnitus avaldada ei lase', () => {
  const existing = profile({ representationConfirmedAt: NOW, representationRegistryCode: '12345678', representationMethod: 'ADMIN' });
  assert.throws(
    () => assertRepresentationForPublication({ status: 'PUBLISHED', registryCode: '87654321' }, existing),
    (error) => error.message === REPRESENTATION_REQUIRED_KEY
  );
});

test('värav loeb kinnitust andmebaasi realt, mitte salvestatavast sisendist', () => {
  /* Teenuseosutaja ei saa kinnitust päringuga kaasa saata. */
  assert.throws(
    () => assertRepresentationForPublication(
      { status: 'PUBLISHED', registryCode: '12345678', representationConfirmedAt: NOW, representationRegistryCode: '12345678' },
      profile()
    ),
    (error) => error.message === REPRESENTATION_REQUIRED_KEY
  );
});

test('haldur kinnitab: alus on kohustuslik ja kood peab olema see, mida haldur nägi', async () => {
  const db = fakeDb(profile());
  await assert.rejects(
    confirmRepresentationAsAdmin({ profileId: 'prof_1', adminUserId: 'admin_1', registryCode: '12345678', basis: 'ok' }, { db, now: NOW }),
    (error) => error.message === 'admin.service_representation.errors.basis_required' && error.status === 400
  );
  await assert.rejects(
    confirmRepresentationAsAdmin({ profileId: 'prof_1', adminUserId: 'admin_1', registryCode: '99999999', basis: 'Juhatuse liikme volitus' }, { db, now: NOW }),
    (error) => error.message === 'admin.service_representation.errors.registry_code_changed' && error.status === 409
  );
  assert.equal(db.state.profile.representationConfirmedAt, null);
  assert.equal(db.state.events.length, 0);

  const row = await confirmRepresentationAsAdmin(
    { profileId: 'prof_1', adminUserId: 'admin_1', registryCode: '12345678', basis: '  Juhatuse liikme   digiallkirjaga volitus  ' },
    { db, now: NOW, checkName: nameMatches }
  );
  assert.equal(row.confirmed, true);
  assert.equal(row.method, 'ADMIN');
  assert.equal(db.state.profile.representationRegistryCode, '12345678');
  assert.equal(db.state.profile.representationConfirmedById, 'admin_1');
  assert.equal(db.state.profile.representationBasis, 'Juhatuse liikme digiallkirjaga volitus');
  /* Teenuseosutaja avatud vorm ei tohi halduri kinnituse pärast konflikti anda. */
  assert.equal(db.state.profile.updatedAt, UPDATED);
  assert.equal(db.state.events[0].type, 'SERVICE_PROVIDER_REPRESENTATION_CONFIRMED');
  assert.equal(db.state.events[0].actorUserId, 'admin_1');
});

test('tühi profiili või halduri tunnus ei jõua päringusse', async () => {
  const db = fakeDb(profile());
  for (const input of [{ profileId: '', adminUserId: 'admin_1' }, { profileId: 'prof_1', adminUserId: '' }, { profileId: undefined, adminUserId: undefined }]) {
    await assert.rejects(
      confirmRepresentationAsAdmin({ ...input, registryCode: '12345678', basis: 'Juhatuse liikme volitus' }, { db, now: NOW }),
      (error) => error.status === 404
    );
    await assert.rejects(revokeRepresentationAsAdmin(input, { db, now: NOW }), (error) => error.status === 404);
  }
  assert.equal(db.state.events.length, 0);
});

test('tagasivõtmine: avaldatud profiil ja kaardi kirje lähevad samas tehingus peitu', async () => {
  const db = fakeDb(profile({
    status: 'PUBLISHED',
    representationConfirmedAt: NOW,
    representationRegistryCode: '12345678',
    representationMethod: 'ADMIN',
    representationBasis: 'Volitus'
  }));
  const later = new Date('2026-10-12T09:00:00.000Z');
  const row = await revokeRepresentationAsAdmin({ profileId: 'prof_1', adminUserId: 'admin_1' }, { db, now: later, checkName: nameMatches });
  assert.equal(row.confirmed, false);
  assert.equal(row.status, 'HIDDEN');
  assert.equal(db.state.profile.status, 'HIDDEN');
  assert.equal(db.state.profile.hiddenAt, later);
  assert.equal(db.state.profile.representationConfirmedAt, null);
  assert.equal(db.state.profile.representationBasis, null);
  assert.equal(db.state.entries[0].status, 'HIDDEN');
  /* `updatedAt` liigub: teenuseosutaja avatud vorm saab konflikti ega avalda vana seisu pealt. */
  assert.equal(db.state.profile.updatedAt, later);
  assert.deepEqual(db.state.events[0].meta.hidden, true);
});

test('tagasivõtmine: mustandi seis ega kaardi kirje ei muutu', async () => {
  const db = fakeDb(
    profile({ representationConfirmedAt: NOW, representationRegistryCode: '12345678', representationMethod: 'ADMIN' }),
    { entries: [{ providerProfileId: 'prof_1', status: 'DRAFT' }] }
  );
  const row = await revokeRepresentationAsAdmin({ profileId: 'prof_1', adminUserId: 'admin_1' }, { db, now: NOW, checkName: nameMatches });
  assert.equal(row.status, 'DRAFT');
  assert.equal(db.state.profile.updatedAt, UPDATED);
  assert.equal(db.state.entries[0].status, 'DRAFT');
});

test('halduri loend: kinnitamata on ees ja alus läheb ainult haldurile', async () => {
  const rows = await listRepresentationAdminRows({ db: fakeDb(profile()), loadNames: async () => null, checkName: nameMatches });
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), [
    'basis', 'confirmed', 'confirmedAt', 'confirmedRegistryCode', 'id', 'method', 'nameCheck', 'organizationName',
    'ownerEmail', 'registerName', 'registryCode', 'stale', 'status', 'updatedAt'
  ]);
});

test('salvestamine kutsub väravat samas tehingus loetud reaga ja profiil kannab ainult seisu', () => {
  const source = readFileSync(new URL('../lib/serviceProviderProfiles.js', import.meta.url), 'utf8');
  assert.match(source, /validateServiceProviderProfilePublication\(normalizedBase, serviceItems\);[\s\S]{0,400}assertRepresentationForPublication\(normalizedBase, existing\);/);
  assert.match(source, /representation: \(\(\{ required, confirmed, confirmedAt, method \}\)/);
  assert.doesNotMatch(source, /representationBasis/);
});

test('avaldamise keeld jõuab teenuseosutajani oma lausega kõigis kolmes keeles', () => {
  const boundary = readFileSync(new URL('../lib/serviceProviderProfileBoundary.js', import.meta.url), 'utf8');
  assert.ok(boundary.includes(`"${REPRESENTATION_REQUIRED_KEY}"`));
  for (const locale of ['et', 'en', 'ru']) {
    const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
    assert.ok(messages.service_provider_profile.errors.publish_representation_required.length > 40, locale);
    assert.ok(messages.admin.service_representation.errors.registry_code_changed, locale);
    assert.ok(messages.admin.hub.items.service_representation, locale);
  }
});

// KODUTEENUS K1 — ligipääsupiirid, kordussaatmine ja parandusjälg PÄRIS andmebaasis.
//
// MIKS MITTE VÕLTS-ANDMEBAAS: meeskonnapõhine õigus elab Prisma `where`-is,
// osaline unikaalindeks, CHECK-id ja muutumatuse triggerid elavad migratsiooni
// SQL-is. Mälus fake ei tõenda neist ühtegi (04.08 õppetund: roheline fake-sviit
// ei näinud puuduvat tabelit ega võõra kirje lugemist).
//
// Käivitamine (eraldatud kohalik baas, kuhu on rakendatud kõik migratsioonid):
//   TZ=UTC HOME_CARE_TEST_DATABASE_URL=postgresql://…@localhost:5432/…home_care_probe \
//     node --import ./scripts/register-node-source-loader.mjs --test tests/home-care.integration.test.mjs
// `npm test` seda faili ei käivita.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolveOrgAccessContext } from '../lib/org/accessContext.js';
import { endMembership } from '../lib/org/members.js';
import {
  addCardLine,
  addTeamMember,
  createClient,
  listClientUnitOptions,
  listClients,
  openClient,
  openClientWithReason,
  removeTeamMember,
  replaceCardLine,
  searchClients,
  setClientStatus,
  updateClient
} from '../lib/homeCare/clients.js';
import {
  correctEntry,
  createEntry,
  listEntries,
  listEntryRevisions,
  retractEntry,
  searchEntries,
  setIncidentStatus
} from '../lib/homeCare/entries.js';
import { searchWords } from '../lib/homeCare/search.js';
import {
  addIncidentUpdate,
  assignIncident,
  getIncident,
  getIncidentTrail,
  listIncidentAssignees,
  listIncidents,
  locateEntryForViewer
} from '../lib/homeCare/incidents.js';
import {
  chronologyContentHash,
  createChronologyRelease,
  draftChronology,
  getChronologyClient,
  getChronologyRelease,
  listChronologyReleases
} from '../lib/homeCare/chronology.js';
import { getCallCounts } from '../lib/homeCare/calls.js';
import { createHomeCareExport, getHomeCareExportOverview, prepareHomeCareExport } from '../lib/homeCare/export.js';
import { HOME_CARE_EXPORT_KEYS, checkHomeCareExport } from '../lib/homeCare/exportFormat.js';
import { applyClientImport, previewClientImport } from '../lib/homeCare/clientImport.js';
import { importHistory, readHistory, removeHistory, searchHistory } from '../lib/homeCare/importedHistory.js';
import {
  findDoorTagOrganization,
  getDoorTag,
  issueDoorTag,
  locateDoorTagForViewer,
  revokeDoorTag
} from '../lib/homeCare/doorTags.js';
import { getCoordinatorOverview } from '../lib/homeCare/overview.js';
import { assertNotificationRecipient, serializeNotificationEvent } from '../lib/notifications.js';

const url = new URL(process.env.HOME_CARE_TEST_DATABASE_URL || 'postgres://invalid/invalid');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('home_care_probe')) {
  throw Error('isolated HOME_CARE_TEST_DATABASE_URL (localhost, …home_care_probe) required');
}
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
test.after(() => db.$disconnect());

const ENV = { ORG_WORKSPACE_ENABLED: '1', HOME_CARE_ENABLED: '1' };
const NOW = new Date('2026-10-09T08:00:00Z');
const at = (iso) => new Date(iso);

async function expectError(promise, status, messageKey) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `status ${error.status} (${error.messageKey || error.message})`);
    if (messageKey) assert.equal(error.messageKey, messageKey);
    return true;
  });
}

/** Asutus A (hooldusjuht, kolm hooldajat, kõrvaline liige) ja asutus B. */
async function fixture(t) {
  const tag = randomUUID().slice(0, 8);
  const userIds = [];
  const orgIds = [];

  async function user(first, last) {
    const row = await db.user.create({
      data: {
        email: `hc-${tag}-${first.toLowerCase()}@example.invalid`,
        role: 'SERVICE_PROVIDER',
        profile: { create: { firstName: first, lastName: last } }
      }
    });
    userIds.push(row.id);
    return row;
  }
  async function org(name, { withModule = true } = {}) {
    const row = await db.organization.create({
      data: { displayName: `${name} ${tag}`, legalKind: 'COMPANY', status: 'ACTIVE', activatedAt: NOW, verifiedAt: NOW }
    });
    orgIds.push(row.id);
    if (withModule) {
      await db.organizationModule.create({
        data: { organizationId: row.id, moduleKey: 'HOME_CARE', status: 'ACTIVE', validFrom: at('2026-01-01T00:00:00Z') }
      });
    }
    return row;
  }
  async function member(organization, account, { coordinator = false } = {}) {
    const row = await db.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: account.id,
        seatRole: 'SERVICE_PROVIDER',
        status: 'ACTIVE',
        startedAt: at('2026-01-01T00:00:00Z')
      }
    });
    if (coordinator) {
      await db.organizationCapabilityGrant.create({
        data: {
          membershipId: row.id,
          capability: 'HOME_CARE_COORDINATOR',
          scopeType: 'ORGANIZATION',
          validFrom: at('2026-01-01T00:00:00Z')
        }
      });
    }
    return row;
  }
  const ctx = (account, organization, env = ENV, now = NOW) =>
    resolveOrgAccessContext({ userId: account.id, requestedOrganizationId: organization.id }, { db, env, now });

  const orgA = await org('Hoolekanne A');
  const orgB = await org('Hoolekanne B');
  const users = {
    lead: await user('Juta', 'Juht'),
    anu: await user('Anu', 'Hooldaja'),
    bert: await user('Bert', 'Hooldaja'),
    cover: await user('Cia', 'Asendaja'),
    clerk: await user('Dan', 'Raamatupidaja'),
    leadB: await user('Eve', 'Juht')
  };
  const members = {
    lead: await member(orgA, users.lead, { coordinator: true }),
    anu: await member(orgA, users.anu),
    bert: await member(orgA, users.bert),
    cover: await member(orgA, users.cover),
    clerk: await member(orgA, users.clerk),
    leadB: await member(orgB, users.leadB, { coordinator: true })
  };

  t.after(async () => {
    /* Organisatsiooni kustutus viib kaskaadiga kaasa kliendid, meeskonnad,
       kirjed, parandusjäljed ja avamised; see on ühtlasi kaskaadi proov. */
    await db.organization.deleteMany({ where: { id: { in: orgIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  });

  return { tag, orgA, orgB, users, members, ctx, org, member, user };
}

/* Vaikimisi ilma teavitusteta ja ilma morfoloogiata (selles masinas seda ei
   ole): teavituste ja otsingu testid annavad need ise ette. */
const deps = (now = NOW) => ({ db, now, env: ENV, notify: null, analyzer: null });
const depsWithNotify = (now = NOW) => ({ db, now, env: ENV, analyzer: null });
/* Morfoloogia asendaja: annab algvormi nagu päris analüsaator (`vmet<lemma>`).
   Tõendab meie poolt: kui algvorm on olemas, leiab otsing kõik sõnavormid. */
const LEMMAS = { võtme: 'võti', võtmed: 'võti', tütre: 'tütar', tütrele: 'tütar', andsin: 'andma', lekib: 'lekkima' };
const lemmaAnalyzer = { analyze: async (texts) => texts.map((text) => searchWords(text).map((word) => `vmet${LEMMAS[word] || word}`).join(' ')) };
const depsWithLemmas = (now = NOW) => ({ db, now, env: ENV, notify: null, analyzer: lemmaAnalyzer });

test('hooldusjuht loob kliendi; hooldaja ei saa; võõras asutus ei näe', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);

  const { client } = await createClient(lead, { displayName: '  Linda   Tamm ', internalCode: 'LT-1', address: 'Kase 3' }, deps());
  assert.equal(client.displayName, 'Linda Tamm');
  assert.equal(client.status, 'ACTIVE');
  assert.equal(client.version, 1);

  await expectError(createClient(anu, { displayName: 'Ei tohi' }, deps()), 403, 'org.errors.missing_capability');
  await expectError(createClient(lead, { displayName: 'Teine', internalCode: 'LT-1' }, deps()), 409, 'home_care.errors.internal_code_taken');
  /* Sama tunnus teises asutuses on lubatud: unikaalsus on asutuse sees. */
  const other = await createClient(leadB, { displayName: 'Linda Tamm', internalCode: 'LT-1' }, deps());
  assert.ok(other.client.id);

  /* Teise asutuse hooldusjuht A kliendi ID-ga: 404, mitte 403. */
  await expectError(openClient(leadB, client.id, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(createEntry(leadB, client.id, { text: 'võõras' }, deps()), 404);

  const audit = await db.dataAuditLog.findMany({ where: { resourceId: client.id } });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'org.home_care_client_created');
  assert.equal(audit[0].meta.clientId, client.id);
  assert.equal(JSON.stringify(audit[0].meta).includes('Linda'), false, 'auditis ei tohi olla kliendi nime');
});

test('meeskond näeb, asendaja avab põhjusega, kõrvaline liige saab 404', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const cover = await f.ctx(f.users.cover, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);

  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  const { client: otherClient } = await createClient(lead, { displayName: 'Mart Mets' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  /* Cia on hooldaja (teise kliendi meeskonnas), aga mitte Linda meeskonnas. */
  await addTeamMember(lead, otherClient.id, { membershipId: f.members.cover.id }, deps());

  /* Meeskonnaliige. */
  const page = await openClient(anu, client.id, deps());
  assert.equal(page.access.basis, 'TEAM');
  assert.equal(page.access.canEditCard, true);
  assert.deepEqual(page.team.map((row) => row.name), ['Anu Hooldaja']);
  assert.deepEqual(page.recentOpeners.map((row) => [row.name, row.basis]), [['Anu Hooldaja', 'TEAM']]);

  /* Vaikse akna sees uut avamisrida ei teki; pärast seda tekib. */
  await openClient(anu, client.id, deps(at('2026-10-09T08:05:00Z')));
  assert.equal(await db.careClientAccess.count({ where: { clientId: client.id } }), 1);
  await openClient(anu, client.id, deps(at('2026-10-09T08:20:00Z')));
  assert.equal(await db.careClientAccess.count({ where: { clientId: client.id } }), 2);

  /* Loend: Anu näeb Lindat, Cia ainult Marti. */
  assert.deepEqual((await listClients(anu, {}, deps())).clients.map((row) => row.displayName), ['Linda Tamm']);
  assert.deepEqual((await listClients(cover, {}, deps())).clients.map((row) => row.displayName), ['Mart Mets']);
  assert.equal((await listClients(lead, {}, deps())).clients.length, 2);

  /* Asendaja: leiab nime järgi, aga leht nõuab põhjust. */
  const found = await searchClients(cover, { q: 'lin' }, deps());
  assert.deepEqual(found.clients, [{ id: client.id, displayName: 'Linda Tamm', status: 'ACTIVE', needsReason: true }]);
  await expectError(openClient(cover, client.id, deps()), 403, 'home_care.errors.access_reason_required');
  await expectError(createEntry(cover, client.id, { text: 'ilma loata' }, deps()), 403, 'home_care.errors.access_reason_required');
  await expectError(openClientWithReason(cover, client.id, {}, deps()), 400, 'home_care.errors.access_reason_required');

  const granted = await openClientWithReason(cover, client.id, { reasonCode: 'COVERING', reason: 'Anu on haige' }, deps());
  /* Luba kehtib asutuse kalendripäeva lõpuni (Europe/Tallinn, UTC+3): 21:00Z. */
  assert.equal(granted.validUntil, '2026-10-09T21:00:00.000Z');
  const viaReason = await openClient(cover, client.id, deps(at('2026-10-09T09:00:00Z')));
  assert.equal(viaReason.access.basis, 'REASON');
  assert.equal(viaReason.access.canEditCard, false);
  await expectError(addCardLine(cover, client.id, { kind: 'ACCESS', text: 'Võti naabril' }, deps(at('2026-10-09T09:01:00Z'))), 403, 'home_care.errors.card_team_only');
  /* Asendaja saab käigu kirja panna. */
  const written = await createEntry(cover, client.id, { text: 'Asenduskäik tehtud', clientRequestId: `req-${f.tag}-cover` }, deps(at('2026-10-09T09:30:00Z')));
  assert.equal(written.created, true);
  /* Järgmisel päeval luba enam ei kehti. */
  await expectError(openClient(cover, client.id, deps(at('2026-10-10T06:00:00Z'))), 403, 'home_care.errors.access_reason_required');

  const reasonAudit = await db.dataAuditLog.findMany({ where: { resourceId: client.id, action: 'org.home_care_client_opened_with_reason' } });
  assert.equal(reasonAudit.length, 1);
  assert.equal(reasonAudit[0].meta.reasonCode, 'COVERING');
  assert.equal(JSON.stringify(reasonAudit[0].meta).includes('haige'), false, 'põhjuse vabatekst ei lähe auditisse');

  /* Kõrvaline liige (ei ole ühegi kliendi meeskonnas): ei leia ega ava. */
  assert.deepEqual((await listClients(clerk, {}, deps())).clients, []);
  assert.deepEqual((await searchClients(clerk, { q: 'linda' }, deps())).clients, []);
  await expectError(openClient(clerk, client.id, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(openClientWithReason(clerk, client.id, { reasonCode: 'OTHER' }, deps()), 404, 'home_care.errors.client_not_found');

  /* Hooldusjuht näeb „viimati avasid" loendis asendajat koos alusega. */
  const leadPage = await openClient(lead, client.id, deps(at('2026-10-09T10:00:00Z')));
  assert.equal(leadPage.access.basis, 'COORDINATOR');
  assert.ok(leadPage.recentOpeners.some((row) => row.name === 'Cia Asendaja' && row.basis === 'REASON'));
});

test('lipp ja moodul: väljas olles 404', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());

  await expectError(openClient(lead, client.id, { db, now: NOW, env: { ORG_WORKSPACE_ENABLED: '1' } }), 404);
  await expectError(listClients(lead, {}, { db, env: { ORG_WORKSPACE_ENABLED: '1', HOME_CARE_ENABLED: '0' } }), 404);

  /* Moodulita asutus: hooldusjuhi luba ei kehti (moodulita capability filtreeritakse kontekstist). */
  const bare = await f.org('Moodulita', { withModule: false });
  const owner = await f.user('Fred', 'Juht');
  await f.member(bare, owner, { coordinator: true });
  const bareCtx = await f.ctx(owner, bare);
  await expectError(listClients(bareCtx, {}, deps()), 404, 'org.errors.not_found');
  await expectError(createClient(bareCtx, { displayName: 'Ei teki' }, deps()), 404, 'org.errors.not_found');
});

test('meeskond: kordus ei tekita teist rida; eemaldamine jätab ajaloo; lahkumine lõpetab read', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());

  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  const again = await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  assert.equal(again.team.length, 1);
  assert.equal(await db.careClientTeamMember.count({ where: { clientId: client.id } }), 1);
  /* Osaline unikaalindeks on andmebaasi oma: otse kirjutades tuleb P2002. */
  await assert.rejects(
    db.careClientTeamMember.create({ data: { clientId: client.id, membershipId: f.members.anu.id } }),
    (error) => error.code === 'P2002'
  );

  /* Teise asutuse liikmesust ei saa meeskonda panna. */
  await expectError(addTeamMember(lead, client.id, { membershipId: f.members.leadB.id }, deps()), 400, 'home_care.errors.invalid_member');
  /* Teise asutuse hooldusjuht ei saa A kliendi meeskonda muuta. */
  await expectError(addTeamMember(leadB, client.id, { membershipId: f.members.leadB.id }, deps()), 404);

  const removed = await removeTeamMember(lead, client.id, f.members.anu.id, deps(at('2026-10-09T09:00:00Z')));
  assert.deepEqual(removed.team, []);
  const anu = await f.ctx(f.users.anu, f.orgA);
  /* Eemaldatud hooldaja ei ole enam ühegi kliendi meeskonnas → 404. */
  await expectError(openClient(anu, client.id, deps(at('2026-10-09T09:01:00Z'))), 404);
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps(at('2026-10-09T09:02:00Z')));
  assert.equal(await db.careClientTeamMember.count({ where: { clientId: client.id } }), 2, 'vana rida jääb ajalukku');

  await addTeamMember(lead, client.id, { membershipId: f.members.bert.id }, deps());
  await endMembership(f.orgA.id, f.members.bert.id, { actorUserId: f.users.lead.id, reason: 'test' }, { db, now: at('2026-10-09T10:00:00Z') });
  const active = await db.careClientTeamMember.findMany({ where: { clientId: client.id, endedAt: null } });
  assert.deepEqual(active.map((row) => row.membershipId), [f.members.anu.id]);
});

test('püsikaart: kuni viis rida, muutmine jätab vana rea ajalukku', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());

  let card;
  for (const text of ['Võti on naabril (krt 4)', 'Koer on sõbralik', 'Ei ava ust enne 9', 'Häirenupp randmel', 'Libe trepp']) {
    ({ card } = await addCardLine(anu, client.id, { kind: 'ACCESS', text }, deps()));
  }
  assert.equal(card.length, 5);
  await expectError(addCardLine(anu, client.id, { kind: 'RISK', text: 'Kuues' }, deps()), 409, 'home_care.errors.card_full');
  await expectError(addCardLine(anu, client.id, { kind: 'VALE', text: 'x' }, deps()), 400, 'home_care.errors.invalid_card_kind');

  const target = card[1];
  ({ card } = await replaceCardLine(anu, client.id, target.id, { kind: 'RISK', text: 'Koer hammustab võõraid' }, deps(at('2026-10-09T09:00:00Z'))));
  assert.equal(card.length, 5);
  assert.equal(card[1].text, 'Koer hammustab võõraid');
  assert.equal(card[1].position, target.position);
  const history = await db.careClientCardLine.findMany({ where: { clientId: client.id, endedAt: { not: null } } });
  assert.equal(history.length, 1);
  assert.equal(history[0].text, 'Koer on sõbralik');
  assert.equal(history[0].endedByMembershipId, f.members.anu.id);
  /* Teise kliendi rea ID selle kliendi all: 404. */
  const { client: other } = await createClient(lead, { displayName: 'Mart Mets' }, deps());
  await expectError(replaceCardLine(lead, other.id, card[0].id, { kind: 'OTHER', text: 'x' }, deps()), 404, 'home_care.errors.card_line_not_found');
});

test('kirje: kordussaatmine, nähtavus, teade järgmisele, hiljem kirjutatud', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.bert.id }, deps());

  /* Kordussaatmine: sama võti + sama sisu = sama kirje; muu sisu = 409. */
  const key = `req-${f.tag}-1`;
  const first = await createEntry(anu, client.id, { text: 'Tõin toidu, kõik korras', clientRequestId: key, occurredAt: '2026-10-09T07:30:00Z' }, deps());
  const repeat = await createEntry(anu, client.id, { text: 'Tõin toidu, kõik korras', clientRequestId: key, occurredAt: '2026-10-09T07:30:00Z' }, deps(at('2026-10-09T08:01:00Z')));
  assert.equal(first.created, true);
  assert.equal(repeat.created, false);
  assert.equal(repeat.entry.id, first.entry.id);
  await expectError(createEntry(anu, client.id, { text: 'Muu sisu', clientRequestId: key }, deps()), 409, 'home_care.errors.idempotency_conflict');
  /* Sama võti teisel autoril on teine kirje, mitte võõra kirje tagastus. */
  const bertSameKey = await createEntry(bert, client.id, { text: 'Berti kirje', clientRequestId: key }, deps());
  assert.equal(bertSameKey.created, true);
  assert.notEqual(bertSameKey.entry.id, first.entry.id);
  assert.equal(await db.careClientEntry.count({ where: { clientId: client.id } }), 2);

  assert.equal(first.entry.authorName, 'Anu Hooldaja');
  assert.equal(first.entry.writtenLater, false);
  /* „Kirjutatud hiljem" tuleb serveri kellast: seadme väide, et kirje kirjutati
     kohe pärast sündmust, märki ära ei võta. */
  const late = await createEntry(
    anu,
    client.id,
    { text: 'Eile õhtul kukkus peaaegu', occurredAt: '2026-10-08T17:00:00Z', deviceCreatedAt: '2026-10-08T17:05:00Z' },
    deps()
  );
  assert.equal(late.entry.writtenLater, true);
  /* Vigane keha, NUL-märk ja liiga suur versioon on 400, mitte 500. */
  await expectError(createEntry(anu, client.id, null, deps()), 400, 'home_care.errors.entry_text_required');
  await expectError(createEntry(anu, client.id, { text: { toString: 0 } }, deps()), 400, 'home_care.errors.entry_text_required');
  await expectError(updateClient(lead, client.id, { version: 3000000000, address: 'x' }, deps()), 400, 'home_care.errors.version_required');
  await expectError(createEntry(anu, client.id, { text: 'Homme', occurredAt: '2026-10-10T08:00:00Z' }, deps()), 400, 'home_care.errors.occurred_at_in_future');
  await expectError(createEntry(anu, client.id, { text: '   ' }, deps()), 400, 'home_care.errors.entry_text_required');

  /* Mure: näevad autor ja hooldusjuht; teine hooldaja näeb ainult märget. */
  const concern = await createEntry(anu, client.id, { kind: 'CONCERN', text: 'Poeg võtab pensioni ära' }, deps());
  assert.equal(concern.entry.coordinatorOnly, true);
  const bertPage = await openClient(bert, client.id, deps());
  assert.equal(bertPage.entries.items.some((row) => row.id === concern.entry.id), false);
  assert.equal(bertPage.talkToCoordinator, true);
  const anuPage = await openClient(anu, client.id, deps());
  assert.equal(anuPage.entries.items.some((row) => row.id === concern.entry.id), true);
  assert.equal(anuPage.talkToCoordinator, false);
  const leadPage = await openClient(lead, client.id, deps());
  assert.equal(leadPage.entries.items.some((row) => row.id === concern.entry.id), true);
  /* Bert ei saa murekirjet ka ID järgi parandada ega näha selle ajalugu. */
  await expectError(correctEntry(bert, client.id, concern.entry.id, { text: 'x', kind: 'CONCERN', reason: 'proov', revision: 1 }, deps()), 404, 'home_care.errors.entry_not_found');
  /* Ainult teksti saatev parandus EI muuda muret tavaliseks kirjeks ega nihuta
     sündmuse aega: saatmata väljad jäävad nii, nagu need kirjel on. */
  const concernFixed = await correctEntry(
    anu,
    client.id,
    concern.entry.id,
    { text: 'Poeg võtab pensioni ära, nägin kahel korral', reason: 'Täpsustus', revision: 1 },
    deps(at('2026-10-09T08:10:00Z'))
  );
  assert.equal(concernFixed.entry.kind, 'CONCERN');
  assert.equal(concernFixed.entry.coordinatorOnly, true);
  assert.equal(concernFixed.entry.occurredAt, concern.entry.occurredAt);
  assert.equal((await openClient(bert, client.id, deps())).entries.items.some((row) => row.id === concern.entry.id), false);
  await expectError(listEntryRevisions(bert, client.id, concern.entry.id, deps()), 404, 'home_care.errors.entry_not_found');

  /* Teade järgmisele: autori ja hooldusjuhi lugemine ei loe; teise hooldaja oma loeb. */
  const handover = await createEntry(anu, client.id, { kind: 'HANDOVER', text: 'Homme tuleb õde kell 10' }, deps());
  let overview = await getCoordinatorOverview(lead, deps());
  assert.deepEqual(overview.unreadHandovers.map((row) => row.id), [handover.entry.id]);
  await openClient(anu, client.id, deps(at('2026-10-09T08:30:00Z')));
  await openClient(lead, client.id, deps(at('2026-10-09T08:31:00Z')));
  overview = await getCoordinatorOverview(lead, deps());
  assert.equal(overview.unreadHandovers.length, 1);
  await openClient(bert, client.id, deps(at('2026-10-09T08:32:00Z')));
  overview = await getCoordinatorOverview(lead, deps());
  assert.equal(overview.unreadHandovers.length, 0);
  const reads = await db.careClientEntryRead.findMany({ where: { entryId: handover.entry.id } });
  assert.deepEqual(reads.map((row) => row.membershipId), [f.members.bert.id]);

  /* Ülevaade: „pärast eilset" on asutuse kalendripäev (eilne algus 07.10 21:00Z). */
  assert.equal(overview.since, '2026-10-07T21:00:00.000Z');
  assert.equal(overview.recent.length, 5);
  assert.ok(overview.recent.every((row) => row.client.displayName === 'Linda Tamm'));
  /* Hooldaja ülevaadet ei näe. */
  await expectError(getCoordinatorOverview(anu, deps()), 403, 'org.errors.missing_capability');

  /* Filter: liik ja kalendripäev; leheküljed. */
  const onlyHandover = await listEntries(anu, client.id, { kind: 'HANDOVER' }, deps());
  assert.deepEqual(onlyHandover.items.map((row) => row.id), [handover.entry.id]);
  const yesterday = await listEntries(anu, client.id, { from: '2026-10-08', to: '2026-10-08' }, deps());
  assert.deepEqual(yesterday.items.map((row) => row.id), [late.entry.id]);
  const pageOne = await listEntries(anu, client.id, { take: 2 }, deps());
  assert.equal(pageOne.items.length, 2);
  assert.equal(pageOne.hasMore, true);
  const pageTwo = await listEntries(anu, client.id, { take: 2, cursor: pageOne.nextCursor }, deps());
  assert.equal(pageTwo.items.some((row) => pageOne.items.some((seen) => seen.id === row.id)), false);
  await expectError(listEntries(anu, client.id, { cursor: 'sodi' }, deps()), 400, 'org.errors.invalid_cursor');

  /* Päeviku lugemine lehe marsruudist mööda jätab samuti avamisjälje. */
  const opensBefore = await db.careClientAccess.count({ where: { clientId: client.id, membershipId: f.members.bert.id } });
  await listEntries(bert, client.id, {}, deps(at('2026-10-09T12:00:00Z')));
  assert.equal(
    await db.careClientAccess.count({ where: { clientId: client.id, membershipId: f.members.bert.id } }),
    opensBefore + 1
  );

  /* Kordus tuntakse ära ka siis, kui aeg jäi saatmata ja server pani selle ise:
     teisel katsel on serveri kell teine, kirje on sama. */
  const noTime = { text: 'Ajata kirje', clientRequestId: `req-${f.tag}-notime` };
  const noTimeFirst = await createEntry(anu, client.id, noTime, deps(at('2026-10-09T12:10:00Z')));
  const noTimeRepeat = await createEntry(anu, client.id, noTime, deps(at('2026-10-09T12:11:00Z')));
  assert.equal(noTimeRepeat.created, false);
  assert.equal(noTimeRepeat.entry.id, noTimeFirst.entry.id);
  assert.equal(noTimeRepeat.entry.occurredAt, '2026-10-09T12:10:00.000Z');
});

test('parandus ja tühistus jätavad jälje; parandusjälge ei saa muuta', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.bert.id }, deps());
  const { client: other } = await createClient(lead, { displayName: 'Mart Mets' }, deps());

  const { entry } = await createEntry(anu, client.id, { text: 'Andsin hommikused ravimid', contactMode: 'VISIT' }, deps());
  await openClient(anu, client.id, deps());
  await expectError(correctEntry(anu, client.id, entry.id, { text: 'Uus' }, deps()), 400, 'home_care.errors.reason_required');
  /* Kolleeg näeb kirjet, aga ei paranda seda. */
  await expectError(correctEntry(anu, client.id, entry.id, { text: 'Uus', reason: 'Versioonita' }, deps()), 400, 'home_care.errors.version_required');
  await expectError(correctEntry(bert, client.id, entry.id, { text: 'Uus', reason: 'Tahan', revision: 1 }, deps()), 403, 'home_care.errors.entry_not_editable');
  /* Teise kliendi all sama kirje ID: 404. */
  await expectError(correctEntry(lead, other.id, entry.id, { text: 'Uus', reason: 'Vale klient', revision: 1 }, deps()), 404, 'home_care.errors.entry_not_found');

  const corrected = await correctEntry(anu, client.id, entry.id, { text: 'Tuletasin ravimeid meelde, võttis ise', reason: 'Kirjutasin valesti: ei andnud, vaid tuletasin meelde', revision: 1 }, deps(at('2026-10-09T09:00:00Z')));
  assert.equal(corrected.entry.revision, 2);
  assert.equal(corrected.entry.corrected, true);
  assert.equal(corrected.entry.text, 'Tuletasin ravimeid meelde, võttis ise');
  /* Parandus ei nihuta sündmuse aega paranduse hetkeks ega muuda liiki. */
  assert.equal(corrected.entry.occurredAt, entry.occurredAt);
  assert.equal(corrected.entry.kind, 'NOTE');
  /* Vana vormi pealt (nähtud versioon 1) tehtud parandus ei kirjuta uut üle
     ega tee sama parandust kaks korda. */
  await expectError(
    correctEntry(lead, client.id, entry.id, { text: 'Vana vormi sisu', reason: 'Hiline salvestus', revision: 1 }, deps()),
    409,
    'home_care.errors.entry_changed'
  );
  assert.equal(await db.careClientEntryRevision.count({ where: { entryId: entry.id } }), 1);

  const { revisions } = await listEntryRevisions(anu, client.id, entry.id, deps());
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0].kind, 'CORRECTION');
  assert.equal(revisions[0].text, 'Andsin hommikused ravimid');
  assert.equal(revisions[0].revision, 1);
  assert.equal(revisions[0].actorName, 'Anu Hooldaja');

  /* Muutumatus on andmebaasi oma: UPDATE parandusjäljele ja avamislogile kukub. */
  await assert.rejects(db.careClientEntryRevision.updateMany({ where: { entryId: entry.id }, data: { reason: 'võltsitud' } }), /immutable/);
  await assert.rejects(db.careClientAccess.updateMany({ where: { clientId: client.id }, data: { actorName: 'Keegi teine' } }), /immutable/);
  /* Tühja põhjusega parandusrida ei lase ka andmebaas sisse. */
  await assert.rejects(
    db.careClientEntryRevision.create({ data: { entryId: entry.id, clientId: client.id, kind: 'CORRECTION', text: 'x', entryKind: 'NOTE', contactMode: 'VISIT', occurredAt: NOW, revision: 2, reason: '   ', actorMembershipId: f.members.anu.id, actorName: 'x' } }),
    /reason_not_blank/
  );
  /* Põhjusega avamine ilma koodita ei mahu andmebaasi. */
  await assert.rejects(
    db.careClientAccess.create({ data: { organizationId: f.orgA.id, clientId: client.id, membershipId: f.members.anu.id, actorName: 'x', basis: 'REASON' } }),
    /reason_has_code/
  );

  /* Hooldusjuht tühistab; teine tühistus ja parandus pärast seda on 409. */
  await expectError(retractEntry(lead, client.id, entry.id, { reason: 'Vana vaade', revision: 1 }, deps()), 409, 'home_care.errors.entry_changed');
  const retracted = await retractEntry(lead, client.id, entry.id, { reason: 'Kirje läks vale kliendi alla', revision: 2 }, deps(at('2026-10-09T10:00:00Z')));
  assert.equal(retracted.entry.text, null);
  assert.equal(retracted.entry.revision, 3);
  assert.ok(retracted.entry.retractedAt);
  await expectError(retractEntry(lead, client.id, entry.id, { reason: 'Uuesti', revision: 3 }, deps()), 409, 'home_care.errors.entry_retracted');
  await expectError(correctEntry(anu, client.id, entry.id, { text: 'Uus', reason: 'Hilja', revision: 3 }, deps()), 409, 'home_care.errors.entry_retracted');
  const after = await listEntryRevisions(lead, client.id, entry.id, deps());
  assert.deepEqual(after.revisions.map((row) => [row.kind, row.revision]), [['RETRACTION', 2], ['CORRECTION', 1]]);
  assert.equal(after.revisions[0].text, 'Tuletasin ravimeid meelde, võttis ise');
  /* Rida on alles: kirjet ei kustutata. */
  assert.equal(await db.careClientEntry.count({ where: { id: entry.id } }), 1);
});

test('erijuhtum: liigid, vaikimisi nähtavus, seis hooldusjuhi käes', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.bert.id }, deps());

  await expectError(createEntry(anu, client.id, { kind: 'INCIDENT', text: 'Kukkus' }, deps()), 400, 'home_care.errors.invalid_incident_type');
  const fall = await createEntry(
    anu,
    client.id,
    {
      kind: 'INCIDENT',
      incidentType: 'FALL',
      text: 'Leidsin köögi põrandalt, teadvusel',
      incidentAssessment: 'Arvan, et libises vaibal',
      incidentActions: [{ code: 'CALLED_112', at: '2026-10-09T07:40:00Z' }, { code: 'INFORMED_COORDINATOR' }, { code: 'CALLED_112' }]
    },
    deps()
  );
  assert.equal(fall.entry.incident.type, 'FALL');
  assert.equal(fall.entry.incident.status, 'OPEN');
  assert.deepEqual(fall.entry.incident.actions.map((row) => row.code), ['CALLED_112', 'INFORMED_COORDINATOR']);
  assert.equal(fall.entry.coordinatorOnly, false);

  /* Väärkohtlemise kahtlus on vaikimisi ainult autorile ja hooldusjuhile. */
  const abuse = await createEntry(anu, client.id, { kind: 'INCIDENT', incidentType: 'ABUSE_SUSPICION', text: 'Sinikad käsivartel' }, deps());
  assert.equal(abuse.entry.coordinatorOnly, true);
  const bertPage = await openClient(bert, client.id, deps());
  assert.deepEqual(bertPage.entries.items.map((row) => row.id), [fall.entry.id]);

  /* Erijuhtumit ei saa parandusega tavaliseks kirjeks muuta. */
  await expectError(correctEntry(anu, client.id, fall.entry.id, { kind: 'NOTE', text: 'Polnud midagi', reason: 'Proov', revision: 1 }, deps()), 400, 'home_care.errors.incident_kind_fixed');
  /* Ainult teksti parandus jätab erijuhtumi liigi, hinnangu ja sammud alles. */
  const fallFixed = await correctEntry(anu, client.id, fall.entry.id, { text: 'Leidsin köögi põrandalt, teadvusel, rääkis selgelt', reason: 'Täpsustus', revision: 1 }, deps());
  assert.equal(fallFixed.entry.incident.type, 'FALL');
  assert.equal(fallFixed.entry.incident.assessment, 'Arvan, et libises vaibal');
  assert.deepEqual(fallFixed.entry.incident.actions, fall.entry.incident.actions);
  /* Autor ei saa erijuhtumit tühistada: see võtaks lahtise juhtumi registrist maha. */
  await expectError(
    retractEntry(anu, client.id, fall.entry.id, { reason: 'Eksisin', revision: 2 }, deps()),
    403,
    'home_care.errors.incident_retract_coordinator'
  );

  let overview = await getCoordinatorOverview(lead, deps());
  assert.equal(overview.openIncidents.length, 2);
  await expectError(setIncidentStatus(anu, client.id, fall.entry.id, { status: 'CLOSED' }, deps()), 403, 'org.errors.missing_capability');
  await setIncidentStatus(lead, client.id, fall.entry.id, { status: 'IN_REVIEW' }, deps());
  const closed = await setIncidentStatus(lead, client.id, fall.entry.id, { status: 'CLOSED', note: 'Vaip eemaldatud, tütar teavitatud' }, deps(at('2026-10-09T12:00:00Z')));
  assert.equal(closed.entry.incident.status, 'CLOSED');
  assert.equal(closed.entry.incident.resolvedAt, '2026-10-09T12:00:00.000Z');
  overview = await getCoordinatorOverview(lead, deps());
  assert.deepEqual(overview.openIncidents.map((row) => row.id), [abuse.entry.id]);
  await expectError(setIncidentStatus(lead, client.id, fall.entry.id, { status: 'MUU' }, deps()), 400, 'home_care.errors.invalid_incident_status');

  /* Piiratud nähtavust ei saa autor liigi muutmisega maha võtta: kirjel võib
     olla hooldusjuhi lahendusmärkus. Hooldusjuht saab. */
  await setIncidentStatus(lead, client.id, abuse.entry.id, { status: 'CLOSED', note: 'Teatatud politseile' }, deps());
  const declassify = await correctEntry(anu, client.id, abuse.entry.id, { incidentType: 'OTHER', text: 'Sinikad käsivartel', reason: 'Liik oli vale', revision: 1 }, deps());
  assert.equal(declassify.entry.incident.type, 'OTHER');
  assert.equal(declassify.entry.coordinatorOnly, true);
  assert.equal((await openClient(bert, client.id, deps())).entries.items.some((row) => row.id === abuse.entry.id), false);
  const byLead = await correctEntry(lead, client.id, abuse.entry.id, { incidentType: 'OTHER', text: 'Sinikad käsivartel', reason: 'Võib meeskonnale näidata', revision: 2 }, deps());
  assert.equal(byLead.entry.coordinatorOnly, false);
  /* Hooldusjuht võib erijuhtumi tühistada. */
  const gone = await retractEntry(lead, client.id, abuse.entry.id, { reason: 'Topeltkirje', revision: 3 }, deps());
  assert.ok(gone.entry.retractedAt);
});

test('kliendi andmed: versioonikontroll ja seis', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());

  await expectError(updateClient(lead, client.id, { address: 'Uus 1' }, deps()), 400, 'home_care.errors.version_required');
  const updated = await updateClient(lead, client.id, { version: 1, address: 'Uus 1', contactPhone: '5550001' }, deps());
  assert.equal(updated.client.version, 2);
  assert.equal(updated.client.address, 'Uus 1');
  /* Vana versiooniga muutja saab konflikti, mitte ei kirjuta üle. */
  await expectError(updateClient(lead, client.id, { version: 1, address: 'Vana aken' }, deps()), 409, 'home_care.errors.version_conflict');
  await expectError(updateClient(anu, client.id, { version: 2, address: 'Hooldaja' }, deps()), 403, 'org.errors.missing_capability');

  /* Alus on kohustuslik (K1-j): ära oleval ja lõppenud kliendil peab olema kirjas, miks;
     teise seisu alus ei sobi. Keeldumine ei muuda midagi. */
  await expectError(setClientStatus(lead, client.id, { version: 2, status: 'AWAY' }, deps()), 400, 'home_care.errors.status_reason_required');
  await expectError(setClientStatus(lead, client.id, { version: 2, status: 'AWAY', statusReason: 'DIED' }, deps()), 400, 'home_care.errors.status_reason_required');
  await expectError(setClientStatus(lead, client.id, { version: 2, status: 'ENDED', statusReason: 'HOSPITAL' }, deps()), 400, 'home_care.errors.status_reason_required');
  assert.equal(await db.careClientStatusChange.count({ where: { clientId: client.id } }), 0);

  const away = await setClientStatus(lead, client.id, { version: 2, status: 'AWAY', statusReason: 'HOSPITAL', statusNote: 'Haiglas alates 9.10' }, deps());
  assert.equal(away.client.status, 'AWAY');
  assert.equal(away.client.statusReason, 'HOSPITAL');
  assert.equal(away.client.version, 3);
  const ended = await setClientStatus(lead, client.id, { version: 3, status: 'ENDED', statusReason: 'MOVED' }, deps());
  assert.equal(ended.client.status, 'ENDED');
  assert.equal(ended.client.statusReason, 'MOVED');
  /* Lõpetatud klient ei ole vaikimisi loendis ega otsingus, aga leht avaneb. */
  assert.deepEqual((await listClients(anu, {}, deps())).clients, []);
  assert.equal((await listClients(lead, { status: 'ENDED' }, deps())).clients.length, 1);
  assert.equal((await openClient(anu, client.id, deps())).client.status, 'ENDED');
  assert.equal((await listClients(lead, { status: 'ENDED' }, deps())).clients[0].statusReason, 'MOVED');

  /* UUESTI TEENUSELE (SKA juhendi ptk 5: takistuse kadumisel on inimesel taas õigus teenusele).
     Alus kaob, varasem lõpetamine jääb ajalukku ja seda ei kirjutata üle. */
  const back = await setClientStatus(lead, client.id, { version: 4, status: 'ACTIVE', statusReason: 'MOVED' }, deps());
  assert.deepEqual([back.client.status, back.client.statusReason], ['ACTIVE', null]);
  assert.deepEqual(
    back.statusHistory.map((row) => [row.fromStatus, row.toStatus, row.reason]),
    [['ENDED', 'ACTIVE', null], ['AWAY', 'ENDED', 'MOVED'], ['ACTIVE', 'AWAY', 'HOSPITAL']]
  );
  assert.equal(back.statusHistory[2].note, 'Haiglas alates 9.10');
  assert.ok(back.statusHistory.every((row) => row.actorName && row.changedAt));

  /* Hooldaja näeb ajalugu kliendi lehel, aga seisu ei muuda. */
  assert.equal((await openClient(anu, client.id, deps())).statusHistory.length, 3);
  await expectError(setClientStatus(anu, client.id, { version: 5, status: 'AWAY', statusReason: 'HOSPITAL' }, deps()), 403, 'org.errors.missing_capability');
  /* Vana versiooniga muutus ei jäta ajalukku rida. */
  await expectError(setClientStatus(lead, client.id, { version: 4, status: 'ENDED', statusReason: 'DIED' }, deps()), 409, 'home_care.errors.version_conflict');
  assert.equal(await db.careClientStatusChange.count({ where: { clientId: client.id } }), 3);

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) => db.careClientStatusChange.create({ data: { organizationId: f.orgA.id, clientId: client.id, fromStatus: 'ACTIVE', ...data } });
  await assert.rejects(raw({ toStatus: 'ENDED' }), /CareClientStatusChange_reason_check/);
  await assert.rejects(raw({ toStatus: 'ACTIVE', reason: 'MOVED' }), /CareClientStatusChange_reason_check/);
  await assert.rejects(raw({ toStatus: 'AWAY', reason: 'DIED' }), /CareClientStatusChange_reason_check/);
  await assert.rejects(raw({ fromStatus: 'GONE', toStatus: 'ACTIVE' }), /CareClientStatusChange_status_check/);
  await assert.rejects(db.careClient.update({ where: { id: client.id }, data: { statusReason: 'WHATEVER' } }), /CareClient_statusReason_check/);
});

test('lõpetatud teenus: päevikusse kirjutab ainult hooldusjuht', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Maie Kask' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  const last = { text: 'Viimane käik.', occurredAt: '2026-10-09T07:30:00Z', clientRequestId: `end-${f.tag}-1` };
  const first = await createEntry(anu, client.id, last, deps());
  await setClientStatus(lead, client.id, { version: 1, status: 'ENDED', statusReason: 'OWN_WISH' }, deps());

  await expectError(
    createEntry(anu, client.id, { text: 'Hiline kirje.', clientRequestId: `end-${f.tag}-2` }, deps()),
    409,
    'home_care.errors.client_ended'
  );
  /* Enne lõpetamist salvestunud kirje kordussaatmine vastab endiselt sama
     kirjega (seade ei pruukinud esimest vastust kätte saada); uut rida ei teki. */
  const repeat = await createEntry(anu, client.id, last, deps());
  assert.equal(repeat.created, false);
  assert.equal(repeat.entry.id, first.entry.id);
  await expectError(
    createEntry(anu, client.id, { ...last, text: 'Sama võti, muu sisu.' }, deps()),
    409,
    'home_care.errors.idempotency_conflict'
  );
  /* Asendaja lõpetatud kliendi lehte põhjusega ei ava; ka varem antud luba ei kehti. */
  const { client: other } = await createClient(lead, { displayName: 'Teine klient' }, deps());
  await addTeamMember(lead, other.id, { membershipId: f.members.cover.id }, deps());
  const cover = await f.ctx(f.users.cover, f.orgA);
  await expectError(openClient(cover, client.id, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(
    openClientWithReason(cover, client.id, { reasonCode: 'COVERING' }, deps()),
    404,
    'home_care.errors.client_not_found'
  );
  const byLead = await createEntry(lead, client.id, { text: 'Lõpetamise märkus.', clientRequestId: `end-${f.tag}-3` }, deps());
  assert.equal(byLead.created, true);
  const page = await listEntries(anu, client.id, {}, deps());
  assert.deepEqual(page.items.map((item) => item.text).sort(), ['Lõpetamise märkus.', 'Viimane käik.']);
});

test('üksuse hooldusjuht: klient peab olema tema üksuses; valik näitab ainult tema alampuud', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  const south = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Lõuna ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: {
      membershipId: f.members.bert.id,
      capability: 'HOME_CARE_COORDINATOR',
      scopeType: 'UNIT',
      scopeUnitId: north.id,
      validFrom: at('2026-01-01T00:00:00Z')
    }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);

  const leadOptions = await listClientUnitOptions(lead, deps());
  assert.equal(leadOptions.unitRequired, false);
  assert.deepEqual(leadOptions.units.map((unit) => unit.id).sort(), [north.id, south.id].sort());
  const bertOptions = await listClientUnitOptions(bert, deps());
  assert.equal(bertOptions.unitRequired, true);
  assert.deepEqual(bertOptions.units.map((unit) => unit.id), [north.id]);
  assert.deepEqual(await listClientUnitOptions(anu, deps()), { units: [], unitRequired: false });

  /* Üksuse hooldusjuht ei saa klienti luua üksuseta ega võõrasse üksusesse. */
  await expectError(createClient(bert, { displayName: 'Üksuseta' }, deps()), 403, 'org.errors.missing_capability');
  await expectError(createClient(bert, { displayName: 'Võõras', unitId: south.id }, deps()), 403, 'org.errors.missing_capability');
  const own = await createClient(bert, { displayName: 'Põhja klient', unitId: north.id }, deps());
  const other = await createClient(lead, { displayName: 'Lõuna klient', unitId: south.id }, deps());

  assert.deepEqual((await listClients(bert, {}, deps())).clients.map((row) => row.id), [own.client.id]);
  assert.equal((await openClient(bert, own.client.id, deps())).access.basis, 'COORDINATOR');
  /* Võõra üksuse klienti ta hooldusjuhina ei näe: leht küsib põhjust nagu
     igalt teiselt hooldajalt ja ülevaade seda klienti ei sisalda. */
  await expectError(openClient(bert, other.client.id, deps()), 403, 'home_care.errors.access_reason_required');
  await createEntry(lead, other.client.id, { text: 'Lõuna kirje.', clientRequestId: `unit-${f.tag}-1` }, deps());
  await createEntry(bert, own.client.id, { text: 'Põhja kirje.', clientRequestId: `unit-${f.tag}-2` }, deps());
  const overview = await getCoordinatorOverview(bert, deps());
  assert.deepEqual(overview.recent.map((entry) => entry.client.id), [own.client.id]);
});

test('põhjusega luba: kehtib ainult hooldajale; kordus õnnestub ka pärast ligipääsu kadumist', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  const { client: own } = await createClient(lead, { displayName: 'Mart Mets' }, deps());
  await addTeamMember(lead, own.id, { membershipId: f.members.cover.id }, deps());
  await addTeamMember(lead, own.id, { membershipId: f.members.bert.id }, deps());
  let cover = await f.ctx(f.users.cover, f.orgA);

  await openClientWithReason(cover, client.id, { reasonCode: 'COVERING' }, deps());
  const body = { text: 'Asenduskäik', companionMembershipId: f.members.bert.id, clientRequestId: `grant-${f.tag}-1` };
  const saved = await createEntry(cover, client.id, body, deps(at('2026-10-09T09:00:00Z')));
  assert.equal(saved.entry.companionName, 'Bert Hooldaja');

  /* Hooldusjuht eemaldab Cia tema ainsast meeskonnast: ta ei ole enam hooldaja
     ja ka tänane põhjusega luba enam ei kehti. */
  await removeTeamMember(lead, own.id, f.members.cover.id, deps(at('2026-10-09T10:00:00Z')));
  cover = await f.ctx(f.users.cover, f.orgA);
  await expectError(openClient(cover, client.id, deps(at('2026-10-09T10:05:00Z'))), 404, 'home_care.errors.client_not_found');
  await expectError(listEntries(cover, client.id, {}, deps(at('2026-10-09T10:05:00Z'))), 404, 'home_care.errors.client_not_found');
  await expectError(
    createEntry(cover, client.id, { text: 'Uus kirje', clientRequestId: `grant-${f.tag}-2` }, deps(at('2026-10-09T10:06:00Z'))),
    404,
    'home_care.errors.client_not_found'
  );

  /* Juba salvestunud kirje kordus vastab endiselt sama kirjega, kuigi ligipääs
     on kadunud ja kaasas olnud kolleegi liikmesus lõppenud. */
  await endMembership(f.orgA.id, f.members.bert.id, { actorUserId: f.users.lead.id, reason: 'Lahkus' }, { db });
  const repeat = await createEntry(cover, client.id, body, deps(at('2026-10-09T10:10:00Z')));
  assert.equal(repeat.created, false);
  assert.equal(repeat.entry.id, saved.entry.id);
  assert.equal(await db.careClientEntry.count({ where: { clientId: client.id } }), 1);
});

test('arhiveeritud üksuse kliendi andmeid saab muuta; arhiveeritud üksusesse viia ei saa', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const unit = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Vana ${f.tag}`, type: 'TEAM' } });
  const { client } = await createClient(lead, { displayName: 'Üksuse klient', unitId: unit.id }, deps());
  const { client: free } = await createClient(lead, { displayName: 'Üksuseta klient' }, deps());
  await db.organizationUnit.update({ where: { id: unit.id }, data: { status: 'ARCHIVED', archivedAt: NOW } });

  const edited = await updateClient(lead, client.id, { version: 1, contactPhone: '5550002', unitId: unit.id }, deps());
  assert.equal(edited.client.contactPhone, '5550002');
  assert.equal(edited.client.unitId, unit.id);
  await expectError(updateClient(lead, free.id, { version: 1, unitId: unit.id }, deps()), 400, 'home_care.errors.invalid_unit');

  /* Sama tunnus kahel kliendil: eelkontroll annab 409. */
  await updateClient(lead, client.id, { version: 2, internalCode: `K-${f.tag}` }, deps());
  await expectError(updateClient(lead, free.id, { version: 1, internalCode: `K-${f.tag}` }, deps()), 409, 'home_care.errors.internal_code_taken');
});

test('erijuhtumite register: skoop, vaated, filtrid ja loendurid', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.bert.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const { client: inNorth } = await createClient(lead, { displayName: 'Põhja klient', unitId: north.id }, deps());
  const { client: noUnit } = await createClient(lead, { displayName: 'Üksuseta klient' }, deps());
  await addTeamMember(lead, inNorth.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, noUnit.id, { membershipId: f.members.anu.id }, deps());

  const fall = await createEntry(anu, inNorth.id, { kind: 'INCIDENT', incidentType: 'FALL', text: 'Kukkus köögis', occurredAt: '2026-10-09T07:00:00Z' }, deps());
  const complaint = await createEntry(anu, noUnit.id, { kind: 'INCIDENT', incidentType: 'COMPLAINT', text: 'Kaebus hilinemise kohta', occurredAt: '2026-10-08T10:00:00Z' }, deps());
  const thanks = await createEntry(anu, noUnit.id, { kind: 'INCIDENT', incidentType: 'THANKS', text: 'Tänas abi eest', occurredAt: '2026-10-07T10:00:00Z' }, deps());
  const mistake = await createEntry(anu, noUnit.id, { kind: 'INCIDENT', incidentType: 'OTHER', text: 'Vale klient', occurredAt: '2026-10-09T06:00:00Z' }, deps());
  await createEntry(anu, noUnit.id, { text: 'Tavaline kirje registrisse ei kuulu' }, deps());
  await retractEntry(lead, noUnit.id, mistake.entry.id, { reason: 'Vale klient', revision: 1 }, deps());
  await setIncidentStatus(lead, noUnit.id, thanks.entry.id, { status: 'CLOSED', note: 'Edastatud meeskonnale' }, deps());

  /* Vaikimisi lahtised, uuemad ees; tühistatud erijuhtumit registris ei ole. */
  const open = await listIncidents(lead, {}, deps());
  assert.equal(open.filter, 'ACTIVE');
  assert.deepEqual(open.items.map((row) => row.id), [fall.entry.id, complaint.entry.id]);
  assert.deepEqual(open.items.map((row) => row.client.displayName), ['Põhja klient', 'Üksuseta klient']);
  assert.deepEqual(open.counts, { OPEN: 2, IN_REVIEW: 0, CLOSED: 1 });
  const closed = await listIncidents(lead, { status: 'CLOSED' }, deps());
  assert.deepEqual(closed.items.map((row) => row.id), [thanks.entry.id]);
  assert.equal(closed.items[0].updateCount, 1);
  assert.equal((await listIncidents(lead, { status: 'ALL' }, deps())).items.length, 3);

  /* Filtrid: liik, kalendripäev, klient; leheküljed. */
  assert.deepEqual((await listIncidents(lead, { type: 'COMPLAINT' }, deps())).items.map((row) => row.id), [complaint.entry.id]);
  assert.deepEqual((await listIncidents(lead, { from: '2026-10-09', to: '2026-10-09' }, deps())).items.map((row) => row.id), [fall.entry.id]);
  assert.deepEqual((await listIncidents(lead, { clientId: noUnit.id }, deps())).items.map((row) => row.id), [complaint.entry.id]);
  const pageOne = await listIncidents(lead, { take: 1 }, deps());
  assert.equal(pageOne.hasMore, true);
  const pageTwo = await listIncidents(lead, { take: 1, cursor: pageOne.nextCursor }, deps());
  assert.deepEqual(pageTwo.items.map((row) => row.id), [complaint.entry.id]);
  await expectError(listIncidents(lead, { status: 'MUU' }, deps()), 400, 'home_care.errors.invalid_incident_status');

  /* Üksuse hooldusjuht näeb ainult oma üksuse klientide erijuhtumeid; hooldaja registrit ei näe. */
  const bertOpen = await listIncidents(bert, {}, deps());
  assert.deepEqual(bertOpen.items.map((row) => row.id), [fall.entry.id]);
  assert.deepEqual(bertOpen.counts, { OPEN: 1, IN_REVIEW: 0, CLOSED: 0 });
  await expectError(listIncidents(anu, {}, deps()), 403, 'org.errors.missing_capability');
  assert.equal((await getIncident(bert, fall.entry.id, deps())).client.displayName, 'Põhja klient');
  await expectError(getIncident(bert, complaint.entry.id, deps()), 404, 'home_care.errors.entry_not_found');
  /* Tühistatud erijuhtumit registris ei ole, ka mitte ühekaupa küsides. */
  await expectError(getIncident(lead, mistake.entry.id, deps()), 404, 'home_care.errors.entry_not_found');

  /* Vastutaja, kes ei ole enam hooldusjuht selle kliendi skoobis, on registris märgitud. */
  await assignIncident(lead, inNorth.id, fall.entry.id, { membershipId: f.members.bert.id }, deps());
  const fresh = (await listIncidents(lead, {}, deps())).items.find((row) => row.id === fall.entry.id);
  assert.equal(fresh.incident.assignee.name, 'Bert Hooldaja');
  assert.equal(fresh.assigneeStale, false);
  await db.organizationCapabilityGrant.updateMany({ where: { membershipId: f.members.bert.id }, data: { revokedAt: NOW } });
  const drifted = (await listIncidents(lead, {}, deps())).items.find((row) => row.id === fall.entry.id);
  assert.equal(drifted.assigneeStale, true);
  assert.equal((await getIncident(lead, fall.entry.id, deps())).assigneeStale, true);
});

test('juhtumi käik: täiendus, seis ja vastutaja; kes mida näeb', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.bert.id }, deps());
  const { entry } = await createEntry(anu, client.id, { kind: 'INCIDENT', incidentType: 'FALL', text: 'Kukkus köögis' }, deps());
  const note = await createEntry(anu, client.id, { text: 'Tavaline kirje' }, deps());

  await expectError(addIncidentUpdate(anu, client.id, entry.id, { text: '  ' }, deps()), 400, 'home_care.errors.text_required');
  await expectError(addIncidentUpdate(anu, client.id, note.entry.id, { text: 'x' }, deps()), 400, 'home_care.errors.not_an_incident');
  /* Kolleeg näeb erijuhtumit päevikus, aga käiku ei näe ega täienda. */
  await expectError(addIncidentUpdate(bert, client.id, entry.id, { text: 'Kolleegi täiendus' }, deps()), 403, 'home_care.errors.entry_not_editable');
  await expectError(getIncidentTrail(bert, client.id, entry.id, deps()), 403, 'home_care.errors.entry_not_editable');
  await expectError(getIncidentTrail(clerk, client.id, entry.id, deps()), 404, 'home_care.errors.client_not_found');

  const byAuthor = await addIncidentUpdate(anu, client.id, entry.id, { text: 'Tütar helistas tagasi, tuleb õhtul.' }, deps(at('2026-10-09T08:10:00Z')));
  assert.equal(byAuthor.update.kind, 'NOTE');
  assert.equal(byAuthor.update.byCoordinator, false);
  await addIncidentUpdate(lead, client.id, entry.id, { text: 'Rääkisin perearstiga; kahtlus ravimite koostoimele.' }, deps(at('2026-10-09T08:20:00Z')));
  await setIncidentStatus(lead, client.id, entry.id, { status: 'IN_REVIEW' }, deps(at('2026-10-09T08:30:00Z')));

  /* Vastutaja peab olema hooldusjuht, kelle skoobis klient on. */
  assert.deepEqual((await listIncidentAssignees(lead, client.id, deps())).assignees.map((row) => row.name), ['Juta Juht']);
  await expectError(assignIncident(lead, client.id, entry.id, { membershipId: f.members.anu.id }, deps()), 400, 'home_care.errors.invalid_member');
  /* Puuduv võti ei ole „võta vastutaja maha": vigane keha on 400. */
  await expectError(assignIncident(lead, client.id, entry.id, {}, deps()), 400, 'home_care.errors.invalid_member');
  await expectError(assignIncident(lead, client.id, entry.id, null, deps()), 400, 'home_care.errors.invalid_member');
  await expectError(assignIncident(anu, client.id, entry.id, { membershipId: f.members.lead.id }, deps()), 403, 'org.errors.missing_capability');
  const assigned = await assignIncident(lead, client.id, entry.id, { membershipId: f.members.lead.id }, deps(at('2026-10-09T08:40:00Z')));
  assert.deepEqual(assigned.entry.incident.assignee, { membershipId: f.members.lead.id, name: 'Juta Juht' });
  /* Sama vastutaja uuesti määramine ei tee uut rida. */
  await assignIncident(lead, client.id, entry.id, { membershipId: f.members.lead.id }, deps());
  await setIncidentStatus(lead, client.id, entry.id, { status: 'CLOSED', note: 'Vaip eemaldatud' }, deps(at('2026-10-09T09:00:00Z')));

  const trail = await getIncidentTrail(lead, client.id, entry.id, deps());
  assert.deepEqual(
    trail.updates.map((row) => [row.kind, row.actorName, row.byCoordinator]),
    [['NOTE', 'Anu Hooldaja', false], ['NOTE', 'Juta Juht', true], ['STATUS', 'Juta Juht', true], ['ASSIGNED', 'Juta Juht', true], ['STATUS', 'Juta Juht', true]]
  );
  assert.deepEqual([trail.updates[2].fromStatus, trail.updates[2].toStatus], ['OPEN', 'IN_REVIEW']);
  assert.equal(trail.updates[3].assigneeName, 'Juta Juht');
  assert.equal(trail.updates[3].assigned, true);
  assert.equal(trail.updates[4].text, 'Vaip eemaldatud');
  /* Autor näeb ainult oma täiendust, mitte hooldusjuhi märkmeid. */
  const own = await getIncidentTrail(anu, client.id, entry.id, deps());
  assert.deepEqual(own.updates.map((row) => row.text), ['Tütar helistas tagasi, tuleb õhtul.']);
  assert.equal(JSON.stringify(own).includes('perearstiga'), false);

  /* Vastutaja mahavõtmine jätab samuti rea. */
  const unassigned = await assignIncident(lead, client.id, entry.id, { membershipId: null }, deps(at('2026-10-09T09:10:00Z')));
  assert.equal(unassigned.entry.incident.assignee, null);
  const lastRow = (await getIncidentTrail(lead, client.id, entry.id, deps())).updates.at(-1);
  assert.equal(lastRow.kind, 'ASSIGNED');
  assert.equal(lastRow.assigned, false);

  /* Käik on muutmatu ja tühja täiendust andmebaas sisse ei lase. */
  await assert.rejects(db.careIncidentUpdate.updateMany({ where: { entryId: entry.id }, data: { text: 'võltsitud' } }), /immutable/);
  await assert.rejects(
    db.careIncidentUpdate.create({ data: { organizationId: f.orgA.id, clientId: client.id, entryId: entry.id, kind: 'NOTE', text: '  ', actorMembershipId: f.members.lead.id, actorName: 'x' } }),
    /note_has_text/
  );
  /* Tühistatud erijuhtumile täiendust ei lisata. */
  await retractEntry(lead, client.id, entry.id, { reason: 'Topelt', revision: 1 }, deps());
  await expectError(addIncidentUpdate(lead, client.id, entry.id, { text: 'Hiline' }, deps()), 409, 'home_care.errors.entry_retracted');
});

test('teavitused: hooldusjuht saab teate ilma sisuta, kirjutaja ise mitte', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.bert.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const { client: inNorth } = await createClient(lead, { displayName: 'Põhja klient', unitId: north.id }, deps());
  const { client: noUnit } = await createClient(lead, { displayName: 'Üksuseta klient' }, deps());
  await addTeamMember(lead, inNorth.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, noUnit.id, { membershipId: f.members.anu.id }, deps());
  const eventsFor = (user) => db.notificationEvent.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'asc' } });

  /* Tavaline kirje teadet ei tee. */
  await createEntry(anu, inNorth.id, { text: 'Tavaline kirje' }, depsWithNotify());
  assert.equal((await eventsFor(f.users.lead)).length, 0);

  /* Erijuhtum üksuse kliendi juures: teate saavad kogu asutuse ja selle üksuse hooldusjuht. */
  const body = { kind: 'INCIDENT', incidentType: 'FALL', text: 'Salajane sisu: kukkus köögis', clientRequestId: `ntf-${f.tag}-1` };
  const fall = await createEntry(anu, inNorth.id, body, depsWithNotify());
  let leadEvents = await eventsFor(f.users.lead);
  assert.deepEqual(leadEvents.map((row) => row.type), ['HOME_CARE_INCIDENT_REPORTED']);
  assert.equal(leadEvents[0].sourceId, fall.entry.id);
  assert.equal(leadEvents[0].targetKind, 'CARE_CLIENT_ENTRY');
  assert.equal(leadEvents[0].workspaceId, f.orgA.id);
  assert.equal((await eventsFor(f.users.bert)).length, 1);
  assert.equal((await eventsFor(f.users.anu)).length, 0, 'kirjutaja ise teadet ei saa');
  assert.equal((await eventsFor(f.users.clerk)).length, 0);
  /* Teavituse reas ei ole kliendi nime, teksti ega liiki; link ei kanna asutuse ega kliendi ID-d. */
  const stored = JSON.stringify(leadEvents[0]);
  for (const secret of ['Põhja klient', 'Salajane', 'FALL', inNorth.id]) assert.equal(stored.includes(secret), false, secret);
  const shown = serializeNotificationEvent(leadEvents[0]);
  assert.equal(shown.href, `/org/koduteenus/kirje/${fall.entry.id}`);
  assert.equal(shown.labelKey, 'notifications.events.home_care_incident_reported');

  /* Kordussaatmine teist teadet ei tee. */
  await createEntry(anu, inNorth.id, body, depsWithNotify(at('2026-10-09T08:05:00Z')));
  assert.equal((await eventsFor(f.users.lead)).length, 1);

  /* Mure üksuseta kliendi juures: ainult kogu asutuse hooldusjuht, oma tüübiga. */
  const concern = await createEntry(anu, noUnit.id, { kind: 'CONCERN', text: 'Poeg võtab pensioni' }, depsWithNotify());
  leadEvents = await eventsFor(f.users.lead);
  assert.deepEqual(leadEvents.map((row) => row.type), ['HOME_CARE_INCIDENT_REPORTED', 'HOME_CARE_CONCERN_RAISED']);
  assert.equal((await eventsFor(f.users.bert)).length, 1);

  /* Hooldusjuhi enda erijuhtum: talle endale teadet ei tule, teisele hooldusjuhile tuleb. */
  await createEntry(lead, inNorth.id, { kind: 'INCIDENT', incidentType: 'OTHER', text: 'Juhi kirje' }, depsWithNotify());
  assert.equal((await eventsFor(f.users.lead)).length, 2);
  assert.equal((await eventsFor(f.users.bert)).length, 2);

  /* Autori täiendus on omaette teade; hooldusjuhi täiendus teadet ei tee. */
  const followUp = { text: 'Tütar helistas', clientRequestId: `upd-${f.tag}-1` };
  const sent = await addIncidentUpdate(anu, inNorth.id, fall.entry.id, followUp, depsWithNotify());
  assert.equal(sent.created, true);
  assert.equal((await eventsFor(f.users.lead)).length, 3);
  /* Täienduse kordussaatmine ei tee teist rida ega teist teadet; sama võti muu tekstiga on 409. */
  const resent = await addIncidentUpdate(anu, inNorth.id, fall.entry.id, followUp, depsWithNotify(at('2026-10-09T08:15:00Z')));
  assert.equal(resent.created, false);
  assert.equal(resent.update.id, sent.update.id);
  assert.equal(await db.careIncidentUpdate.count({ where: { entryId: fall.entry.id } }), 1);
  assert.equal((await eventsFor(f.users.lead)).length, 3);
  await expectError(
    addIncidentUpdate(anu, inNorth.id, fall.entry.id, { ...followUp, text: 'Muu tekst' }, depsWithNotify()),
    409,
    'home_care.errors.idempotency_conflict'
  );
  await addIncidentUpdate(lead, inNorth.id, fall.entry.id, { text: 'Juhi märkus' }, depsWithNotify());
  assert.equal((await eventsFor(f.users.lead)).length, 3);
  assert.equal((await eventsFor(f.users.bert)).length, 3);

  /* Vastutaja määramine: teade määratule, iseendale määrates mitte. */
  await assignIncident(lead, inNorth.id, fall.entry.id, { membershipId: f.members.bert.id }, depsWithNotify());
  const bertEvents = await eventsFor(f.users.bert);
  assert.equal(bertEvents.at(-1).type, 'HOME_CARE_INCIDENT_ASSIGNED');
  await assignIncident(lead, inNorth.id, fall.entry.id, { membershipId: f.members.lead.id }, depsWithNotify());
  assert.equal((await eventsFor(f.users.lead)).length, 3);

  /* Teavituse link viib sinna, kuhu vaataja õigus lubab; õiguseta liige saab 404. */
  assert.deepEqual(await locateEntryForViewer(lead, fall.entry.id, deps()), { clientId: inNorth.id, kind: 'INCIDENT', isCoordinator: true, retracted: false });
  assert.deepEqual(await locateEntryForViewer(anu, fall.entry.id, deps()), { clientId: inNorth.id, kind: 'INCIDENT', isCoordinator: false, retracted: false });
  assert.equal((await locateEntryForViewer(lead, concern.entry.id, deps())).kind, 'CONCERN');
  await expectError(locateEntryForViewer(clerk, fall.entry.id, deps()), 404, 'home_care.errors.client_not_found');
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  await expectError(locateEntryForViewer(leadB, fall.entry.id, deps()), 404, 'home_care.errors.entry_not_found');

  /* Parandusega mureks muudetud kirje on hooldusjuhile uus mure ja teeb teate. */
  const plain = await createEntry(anu, noUnit.id, { text: 'Algul tavaline kirje' }, depsWithNotify());
  const before = (await eventsFor(f.users.lead)).length;
  await correctEntry(anu, noUnit.id, plain.entry.id, { kind: 'CONCERN', text: 'Tegelikult mure', reason: 'Vale liik', revision: 1 }, depsWithNotify());
  const afterFix = await eventsFor(f.users.lead);
  assert.equal(afterFix.length, before + 1);
  assert.equal(afterFix.at(-1).type, 'HOME_CARE_CONCERN_RAISED');
  /* Autor muudab mure liigi tagasi: piiratud nähtavus jääb, seega teade ei kao. */
  await correctEntry(anu, noUnit.id, plain.entry.id, { kind: 'NOTE', text: 'Tegelikult mure', reason: 'Proov', revision: 2 }, depsWithNotify());
  const kept = afterFix.at(-1);
  await assertNotificationRecipient(db, { type: kept.type, userId: f.users.lead.id, sourceId: kept.sourceId, targetId: kept.targetId });

  /* Teadet näidatakse ainult senikaua, kuni inimene on hooldusjuht, kelle
     skoobis klient on: üksuse hooldusjuhi teade kaob, kui tema luba ära võetakse. */
  const bertEvent = (await eventsFor(f.users.bert))[0];
  const probe = { type: bertEvent.type, userId: f.users.bert.id, sourceId: bertEvent.sourceId, targetId: bertEvent.targetId };
  await assertNotificationRecipient(db, probe);
  await db.organizationCapabilityGrant.updateMany({ where: { membershipId: f.members.bert.id }, data: { revokedAt: NOW } });
  await assert.rejects(assertNotificationRecipient(db, probe), (error) => error.status === 404);
  /* Tühistatud erijuhtumi teade ei jää loendisse ja suunaja viib kliendi lehele. */
  await retractEntry(lead, inNorth.id, fall.entry.id, { reason: 'Proov', revision: 1 }, deps());
  const leadFirst = (await eventsFor(f.users.lead))[0];
  await assert.rejects(
    assertNotificationRecipient(db, { type: leadFirst.type, userId: f.users.lead.id, sourceId: leadFirst.sourceId, targetId: leadFirst.targetId }),
    (error) => error.status === 404
  );
  assert.equal((await locateEntryForViewer(lead, fall.entry.id, deps())).retracted, true);
});

test('päeviku otsing: sõnavormid, sõna algus, nähtavus, parandus ja tühistus', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.bert.id }, deps());

  const key = await createEntry(anu, client.id, { text: 'Võti on naabri käes.', occurredAt: '2026-10-09T07:00:00Z' }, depsWithLemmas());
  const keys = await createEntry(anu, client.id, { text: 'Andsin võtmed tütrele.', occurredAt: '2026-10-09T07:10:00Z' }, depsWithLemmas());
  const machine = await createEntry(anu, client.id, { kind: 'HANDOVER', text: 'Pesumasin lekib.', occurredAt: '2026-10-08T10:00:00Z' }, depsWithLemmas());
  const concern = await createEntry(anu, client.id, { kind: 'CONCERN', text: 'Tütar võtab raha ära.', occurredAt: '2026-10-09T07:20:00Z' }, depsWithLemmas());
  const ids = (page) => page.items.map((row) => row.id);
  const find = (who, q, extra = {}) => searchEntries(who, client.id, { q, ...extra }, depsWithLemmas());

  /* Algvorm leiab kõik sõnavormid ja vastupidi. */
  assert.deepEqual(ids(await find(bert, 'võti')), [keys.entry.id, key.entry.id]);
  assert.deepEqual(ids(await find(bert, 'võtmed')), [keys.entry.id, key.entry.id]);
  /* Mitu sõna: kõik peavad kirjes olema. */
  assert.deepEqual(ids(await find(bert, 'võti tütar')), [keys.entry.id]);
  /* Sõna algus leiab pikema sõna. */
  assert.deepEqual(ids(await find(bert, 'pesu')), [machine.entry.id]);
  /* Nähtavus on sama mis päevikus: muret näevad autor ja hooldusjuht. */
  assert.deepEqual(ids(await find(bert, 'tütar')), [keys.entry.id]);
  assert.deepEqual(ids(await find(lead, 'tütar')), [concern.entry.id, keys.entry.id]);
  assert.deepEqual(ids(await find(anu, 'raha')), [concern.entry.id]);
  /* Liigi ja päeva filter kehtivad koos otsinguga. */
  assert.deepEqual(ids(await find(bert, 'pesu', { kind: 'HANDOVER' })), [machine.entry.id]);
  assert.deepEqual(ids(await find(bert, 'pesu', { kind: 'NOTE' })), []);
  assert.deepEqual(ids(await find(bert, 'võti', { from: '2026-10-08', to: '2026-10-08' })), []);
  assert.deepEqual(ids(await find(bert, 'olematusõna')), []);

  /* Otsing on päeviku lugemine: jätab avamisjälje ja märgib teate loetuks. */
  assert.ok((await db.careClientAccess.count({ where: { clientId: client.id, membershipId: f.members.bert.id } })) >= 1);
  assert.equal(await db.careClientEntryRead.count({ where: { entryId: machine.entry.id, membershipId: f.members.bert.id } }), 1);

  /* Ligipääs ja sisend. */
  await expectError(find(clerk, 'võti'), 404, 'home_care.errors.client_not_found');
  await expectError(find(bert, 'v'), 400, 'home_care.errors.search_too_short');
  await expectError(searchEntries(bert, client.id, null, depsWithLemmas()), 400, 'home_care.errors.search_too_short');

  /* Parandus teeb otsinguabi uue teksti järgi; numbrid on samuti otsitavad. */
  await correctEntry(anu, client.id, key.entry.id, { text: 'Uksekood on 4321.', reason: 'Võtit enam ei ole', revision: 1 }, depsWithLemmas());
  assert.deepEqual(ids(await find(bert, 'võti')), [keys.entry.id]);
  assert.deepEqual(ids(await find(bert, '4321')), [key.entry.id]);
  /* Tühistatud kirjet otsing ei leia ja selle otsinguabi kustub. */
  await retractEntry(lead, client.id, keys.entry.id, { reason: 'Vale klient', revision: 1 }, deps());
  assert.deepEqual(ids(await find(bert, 'võti')), []);
  const gone = await db.careClientEntry.findUnique({ where: { id: keys.entry.id }, select: { searchText: true, searchVersion: true } });
  assert.deepEqual(gone, { searchText: null, searchVersion: null });

  /* Ilma morfoloogiata salvestub kirje ikka ja on leitav sõna, sõna alguse ja
     tüve järgi; märge ütleb, et algvorme ei ole. */
  const plain = await createEntry(anu, client.id, { text: 'Leidsin võtmed riiulilt.' }, deps());
  const stored = await db.careClientEntry.findUnique({ where: { id: plain.entry.id }, select: { searchVersion: true, searchText: true } });
  assert.equal(stored.searchVersion, 'sb1');
  assert.equal(stored.searchText.includes('vmet'), false);
  const noMorph = (q) => searchEntries(bert, client.id, { q }, deps());
  assert.deepEqual(ids(await noMorph('võtmed')), [plain.entry.id]);
  assert.deepEqual(ids(await noMorph('võtme')), [plain.entry.id]);
  assert.deepEqual(ids(await noMorph('riiul')), [plain.entry.id]);
  const withLemmas = await db.careClientEntry.findUnique({ where: { id: machine.entry.id }, select: { searchVersion: true } });
  assert.equal(withLemmas.searchVersion, 'vm1');
});

test('kronoloogia: mustand, väljastus hetkekoopiana, tööloend ja ligipääs', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.bert.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  const { client: northClient } = await createClient(lead, { displayName: 'Põhja klient', unitId: north.id }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, northClient.id, { membershipId: f.members.anu.id }, deps());

  const add = (clientId, body) => createEntry(anu, clientId, body, deps());
  const e1 = await add(client.id, { text: 'Tõin toidu. Naaber Mati Kask oli külas.', occurredAt: '2026-10-07T07:00:00Z' });
  const e2 = await add(client.id, { kind: 'HANDOVER', text: 'Pesumasin lekib.', occurredAt: '2026-10-08T06:00:00Z' });
  const e3 = await add(client.id, { kind: 'CONCERN', text: 'Poeg võtab pensioni ära.', occurredAt: '2026-10-08T09:00:00Z' });
  const e4 = await add(client.id, { kind: 'INCIDENT', incidentType: 'FALL', text: 'Leidsin köögi põrandalt.', occurredAt: '2026-10-09T04:00:00Z' });
  const e5 = await add(client.id, { text: 'Vale kliendi kirje.', occurredAt: '2026-10-08T07:00:00Z' });
  const e6 = await add(client.id, { text: 'Septembri kirje.', occurredAt: '2026-09-01T07:00:00Z' });
  const foreign = await add(northClient.id, { text: 'Teise kliendi kirje.', occurredAt: '2026-10-08T07:00:00Z' });
  await retractEntry(lead, client.id, e5.entry.id, { reason: 'Vale klient', revision: 1 }, deps());
  const period = { from: '2026-10-07', to: '2026-10-09' };

  /* Mustand: ajavahemiku kirjed vanemast uuemani; tühistatud kirjet ei ole,
     piiratud nähtavusega kirje on kaasas ja märgitud. */
  const draft = await draftChronology(lead, client.id, period, deps());
  assert.deepEqual(draft.items.map((row) => row.entryId), [e1.entry.id, e2.entry.id, e3.entry.id, e4.entry.id]);
  assert.deepEqual(draft.items.map((row) => row.coordinatorOnly), [false, false, true, false]);
  assert.equal(draft.client.displayName, 'Linda Tamm');
  await expectError(draftChronology(lead, client.id, { from: '2026-10-07' }, deps()), 400, 'home_care.errors.chronology_period_required');
  await expectError(draftChronology(lead, client.id, { from: '2026-10-09', to: '2026-10-07' }, deps()), 400, 'home_care.errors.invalid_date');
  /* Ainult hooldusjuht, kelle skoobis klient on. */
  await expectError(draftChronology(anu, client.id, period, deps()), 403, 'org.errors.missing_capability');
  await expectError(draftChronology(bert, client.id, period, deps()), 403, 'home_care.errors.access_reason_required');
  await expectError(draftChronology(clerk, client.id, period, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(getChronologyClient(anu, client.id, deps()), 403, 'org.errors.missing_capability');
  assert.deepEqual(await getChronologyClient(lead, client.id, deps()), { id: client.id, displayName: 'Linda Tamm' });

  /* Väljastus: kohustuslikud väljad ja kirjete kontroll. */
  const base = { ...period, requester: 'PPA, uurija M. Tamm', basis: 'Päring nr 12-3/45', registryRef: '2026/1-9/77', summary: 'Kolm kirjet kolmest päevast.' };
  const make = (who, clientId, extra) => createChronologyRelease(who, clientId, { ...base, ...extra }, deps(at('2026-10-09T10:00:00Z')));
  const pick = (created, extra) => ({ entryId: created.entry.id, revision: 1, ...extra });
  const one = [pick(e1)];
  await expectError(make(lead, client.id, { items: one, requester: ' ' }), 400, 'home_care.errors.chronology_requester_required');
  await expectError(make(lead, client.id, { items: one, basis: '' }), 400, 'home_care.errors.chronology_basis_required');
  await expectError(make(lead, client.id, { items: [] }), 400, 'home_care.errors.chronology_items_required');
  await expectError(make(lead, client.id, { items: [pick(e6)] }), 400, 'home_care.errors.chronology_entry_invalid');
  await expectError(make(lead, client.id, { items: [pick(e5, { revision: 2 })] }), 400, 'home_care.errors.chronology_entry_invalid');
  await expectError(make(lead, client.id, { items: [pick(foreign)] }), 400, 'home_care.errors.chronology_entry_invalid');
  await expectError(make(lead, client.id, { items: [pick(e1, { text: '   ' })] }), 400, 'home_care.errors.chronology_text_required');
  /* Versioon on kohustuslik: ilma selleta ei ole teada, mida koostaja nägi. */
  await expectError(make(lead, client.id, { items: [{ entryId: e1.entry.id }] }), 400, 'home_care.errors.version_required');
  await expectError(make(anu, client.id, { items: one }), 403, 'org.errors.missing_capability');
  assert.equal(await db.careChronologyRelease.count({ where: { clientId: client.id } }), 0);

  /* Valik ei pea olema ajajärjestuses; dokumendis on kirjed ajajärjestuses.
     Kolmanda isiku nimi on tekstist eemaldatud. */
  const { release } = await make(lead, client.id, {
    items: [pick(e4), pick(e1, { text: 'Tõin toidu. Naaber oli külas.' }), pick(e2)]
  });
  assert.equal(release.entryCount, 3);
  assert.match(release.contentSha256, /^[a-f0-9]{64}$/);
  assert.equal(release.createdByName, 'Juta Juht');
  assert.equal(release.createdAt, '2026-10-09T10:00:00.000Z');

  const document = await getChronologyRelease(lead, release.id, deps());
  assert.deepEqual(document.items.map((row) => row.position), [1, 2, 3]);
  assert.deepEqual(document.items.map((row) => row.text), ['Tõin toidu. Naaber oli külas.', 'Pesumasin lekib.', 'Leidsin köögi põrandalt.']);
  assert.deepEqual(document.items.map((row) => row.redacted), [true, false, false]);
  assert.equal(document.items[2].incidentType, 'FALL');
  assert.equal(document.release.requester, 'PPA, uurija M. Tamm');
  /* Kaanelehe räsi on dokumendi sisust uuesti arvutatav. */
  assert.equal(
    chronologyContentHash({
      clientName: document.release.clientName,
      fromDay: document.release.periodFromDay,
      toDay: document.release.periodToDay,
      requester: document.release.requester,
      basis: document.release.basis,
      registryRef: document.release.registryRef,
      summary: document.release.summary,
      items: document.items
    }),
    release.contentSha256
  );
  /* Teksti lühendamine dokumendis päeviku kirjet ei muuda. */
  assert.equal((await db.careClientEntry.findUnique({ where: { id: e1.entry.id }, select: { text: true } })).text, 'Tõin toidu. Naaber Mati Kask oli külas.');

  /* HETKEKOOPIA: hilisem parandus ja tühistus väljastatud dokumenti ei muuda. */
  await correctEntry(anu, client.id, e2.entry.id, { text: 'Pesumasin on korras.', reason: 'Meister käis', revision: 1 }, deps());
  await retractEntry(lead, client.id, e4.entry.id, { reason: 'Proov', revision: 1 }, deps());
  const later = await getChronologyRelease(lead, release.id, deps());
  assert.deepEqual(later.items.map((row) => row.text), document.items.map((row) => row.text));
  /* Koostaja nägi kirje esimest versiooni, autor parandas vahepeal: dokumenti
     ei lähe tekst, mida koostaja ei näinud. Uue versiooniga õnnestub. */
  await expectError(make(lead, client.id, { items: [pick(e2)] }), 409, 'home_care.errors.chronology_entry_changed');
  assert.equal(await db.careChronologyRelease.count({ where: { clientId: client.id } }), 1);
  assert.equal((await draftChronology(lead, client.id, period, deps())).items.find((row) => row.entryId === e2.entry.id).revision, 2);
  /* Muutmatus on andmebaasi oma. */
  await assert.rejects(db.careChronologyRelease.updateMany({ where: { id: release.id }, data: { requester: 'Keegi teine' } }), /immutable/);
  await assert.rejects(db.careChronologyReleaseItem.updateMany({ where: { releaseId: release.id }, data: { text: 'võltsitud' } }), /immutable/);
  await assert.rejects(
    db.careChronologyRelease.create({ data: { organizationId: f.orgA.id, clientId: client.id, clientName: 'x', periodFromDay: '2026-10-01', periodToDay: '2026-10-02', requester: '  ', basis: 'x', entryCount: 1, contentSha256: 'x', createdByMembershipId: f.members.lead.id, createdByName: 'x' } }),
    /requester_not_blank/
  );

  /* Dokumendi avab ainult hooldusjuht, kelle skoobis klient on; teistele on see olematu. */
  for (const who of [anu, bert, clerk, leadB]) {
    await expectError(getChronologyRelease(who, release.id, deps()), 404, who === leadB ? 'home_care.errors.release_not_found' : 'home_care.errors.release_not_found');
  }

  /* KORDUSSAATMINE: sama võti ja sama sisu annab sama väljastuse, mitte teist
     rida; sama võti teise sisuga on viga. Ka samaaegsed saatmised jätavad ühe. */
  const key = '11111111-2222-4333-8444-555555555555';
  const keyed = { items: [pick(e1)], clientRequestId: key };
  const first = await make(lead, client.id, keyed);
  assert.equal(first.repeated, undefined);
  const again = await make(lead, client.id, keyed);
  assert.equal(again.repeated, true);
  assert.equal(again.release.id, first.release.id);
  await expectError(make(lead, client.id, { ...keyed, requester: 'Keegi teine' }), 409, 'home_care.errors.idempotency_conflict');
  await expectError(make(lead, client.id, { ...keyed, clientRequestId: 'x y' }), 400, 'home_care.errors.invalid_request_id');
  const racedKey = '11111111-2222-4333-8444-666666666666';
  const raced = await Promise.all([1, 2, 3].map(() => make(lead, client.id, { ...keyed, clientRequestId: racedKey })));
  assert.equal(new Set(raced.map((result) => result.release.id)).size, 1);
  assert.equal(raced.filter((result) => !result.repeated).length, 1);
  assert.equal(await db.careChronologyRelease.count({ where: { clientId: client.id } }), 3);
  assert.equal(await db.careChronologyReleaseItem.count({ where: { releaseId: raced[0].release.id } }), 1);
  /* Proovi read ära, et tööloendi kontroll allpool loeks ainult kaht dokumenti. */
  await db.careChronologyRelease.deleteMany({ where: { id: { in: [first.release.id, raced[0].release.id] } } });

  /* Tööloend hooldusjuhi skoobis. */
  const { release: northRelease } = await make(bert, northClient.id, { items: [pick(foreign)] });
  assert.deepEqual((await listChronologyReleases(bert, {}, deps())).items.map((row) => row.id), [northRelease.id]);
  assert.equal((await listChronologyReleases(lead, {}, deps())).items.length, 2);
  assert.deepEqual((await listChronologyReleases(lead, { clientId: client.id }, deps())).items.map((row) => row.id), [release.id]);
  assert.equal(JSON.stringify(await listChronologyReleases(lead, {}, deps())).includes('Pesumasin'), false, 'tööloend ei kanna dokumendi sisu');
  await expectError(listChronologyReleases(anu, {}, deps()), 403, 'org.errors.missing_capability');
  assert.deepEqual((await listChronologyReleases(leadB, {}, deps())).items, []);

  /* Audit: ainult ID-d. */
  const audit = await db.dataAuditLog.findMany({ where: { resourceId: release.id, action: 'org.home_care_chronology_released' } });
  assert.equal(audit.length, 1);
  assert.deepEqual(Object.keys(audit[0].meta).sort(), ['clientId', 'organizationId', 'releaseId']);

  /* Kliendi kustutamisel kustub ka väljastus (kaskaad ei jää muutmatuse taha). */
  await db.careClient.delete({ where: { id: northClient.id } });
  assert.equal(await db.careChronologyRelease.count({ where: { id: northRelease.id } }), 0);
});

test('võrguta kirje: ooteaeg nihutab sündmuse aega, kordus teise ooteajaga on sama kirje', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  const HOUR = 60 * 60 * 1000;
  const key = '22222222-3333-4444-8555-666666666666';
  const body = { text: 'Tõin toidu ja ravimid.', clientRequestId: key };

  /* Kirje sündis kell 05:00 keldris ilma levita ja jõudis serverisse 08:00. */
  const first = await createEntry(anu, client.id, { ...body, waitedMs: 3 * HOUR }, deps());
  assert.equal(first.created, true);
  assert.equal(first.entry.occurredAt, '2026-10-09T05:00:00.000Z');
  assert.equal(first.entry.createdAt, '2026-10-09T08:00:00.000Z');
  assert.deepEqual([first.entry.writtenLater, first.entry.sentLater], [false, true]);
  const stored = await db.careClientEntry.findUnique({ where: { id: first.entry.id }, select: { deviceQueuedSec: true } });
  assert.equal(stored.deviceQueuedSec, 3 * 3600);

  /* Vastus läks kaotsi; järjekord saadab tund hiljem uuesti, ooteaeg on nüüd
     neli tundi. See on SAMA kirje, mitte konflikt ega teine kirje, ja esimese
     salvestuse aeg jääb. */
  const again = await createEntry(anu, client.id, { ...body, waitedMs: 4 * HOUR }, deps(at('2026-10-09T09:00:00Z')));
  assert.equal(again.created, false);
  assert.equal(again.entry.id, first.entry.id);
  assert.equal(again.entry.occurredAt, '2026-10-09T05:00:00.000Z');
  assert.equal(await db.careClientEntry.count({ where: { clientId: client.id } }), 1);
  /* Sama võti teise tekstiga on endiselt konflikt. */
  await expectError(createEntry(anu, client.id, { ...body, text: 'Muu tekst', waitedMs: HOUR }, deps()), 409, 'home_care.errors.idempotency_conflict');

  /* KORDUS ENNE OOTEAJA KONTROLLI. Seade oli üle 30 päeva võrguta ega saanud
     esimese salvestuse vastust: uus saatmine peab vastama „salvestatud", mitte
     käskima juba päevikus olevat kirjet uuesti kirjutada. */
  const stale = await createEntry(anu, client.id, { ...body, waitedMs: 40 * 24 * HOUR }, deps(at('2026-11-18T08:00:00Z')));
  assert.equal(stale.created, false);
  assert.equal(stale.entry.id, first.entry.id);
  /* Uue võtmega sama pikk ooteaeg on endiselt viga ja kirjet ei teki. */
  await expectError(
    createEntry(anu, client.id, { text: 'Uus kirje', clientRequestId: '22222222-3333-4444-8555-777777777777', waitedMs: 40 * 24 * HOUR }, deps()),
    400,
    'home_care.errors.invalid_waited'
  );

  /* Vigane ooteaeg lükatakse tagasi enne salvestamist. */
  await expectError(createEntry(anu, client.id, { text: 'x', waitedMs: -5 }, deps()), 400, 'home_care.errors.invalid_waited');
  await expectError(createEntry(anu, client.id, { text: 'x', waitedMs: 31 * 24 * HOUR }, deps()), 400, 'home_care.errors.invalid_waited');
  assert.equal(await db.careClientEntry.count({ where: { clientId: client.id } }), 1);

  /* Erijuhtum järjekorrast: sammu kellaaeg on sündmuse, mitte kohalejõudmise oma. */
  const fall = await createEntry(
    anu,
    client.id,
    { kind: 'INCIDENT', incidentType: 'FALL', text: 'Leidsin põrandalt.', incidentActions: [{ code: 'CALLED_112' }], waitedMs: HOUR },
    deps()
  );
  assert.equal(fall.entry.occurredAt, '2026-10-09T07:00:00.000Z');
  assert.equal(fall.entry.incident.actions[0].at, '2026-10-09T07:00:00.000Z');

  /* PARANDUS ei muuda ooteaega ega nihuta sündmuse aega. */
  const fixed = await correctEntry(anu, client.id, first.entry.id, { text: 'Tõin toidu.', reason: 'Täpsustus', revision: 1, waitedMs: 9 * HOUR }, deps(at('2026-10-09T10:00:00Z')));
  assert.equal(fixed.entry.occurredAt, '2026-10-09T05:00:00.000Z');
  assert.equal(fixed.entry.sentLater, true);
  assert.equal((await db.careClientEntry.findUnique({ where: { id: first.entry.id }, select: { deviceQueuedSec: true } })).deviceQueuedSec, 3 * 3600);

  /* Negatiivset väärtust ei lase läbi ka andmebaas ise. */
  await assert.rejects(
    db.careClientEntry.update({ where: { id: first.entry.id }, data: { deviceQueuedSec: -1 } }),
    /device_queued_not_negative/
  );

  /* Päeviku loend kannab sama märki. */
  const listed = await listEntries(anu, client.id, {}, deps());
  assert.equal(listed.items.find((row) => row.id === first.entry.id).sentLater, true);
});

test('klientide sissetoomine tabelist: eelvaade, kordused, skoop ja kõik-või-mitte-midagi', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  const south = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Lõuna ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.bert.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  await createClient(lead, { displayName: 'Olemas Olev', internalCode: 'OO-1' }, deps());
  await createClient(lead, { displayName: 'Lõuna Leida', unitId: south.id }, deps());

  const text = [
    'Nimi\tTunnus\tAadress\tTelefon\tMärkus\tSünniaasta',
    'Linda Tamm\tLT-1\tKase 3\t5551234\tTütar Mari\t1940',
    'Olemas Olev\tOO-1\t\t\t\t',
    'Jaan Kask\t\tTamme 5\t\t\t',
    'olemas olev\t\t\t\t\t',
    '\tX-1\t\t\t\t'
  ].join('\n');

  /* EELVAADE ei salvesta midagi. */
  const before = await db.careClient.count({ where: { organizationId: f.orgA.id } });
  const preview = await previewClientImport(lead, { text }, deps());
  assert.deepEqual(preview.columns.sort(), ['address', 'contactNote', 'contactPhone', 'displayName', 'internalCode']);
  assert.deepEqual(preview.ignoredHeaders, ['Sünniaasta']);
  assert.deepEqual(preview.rows.map((row) => [row.line, row.status]), [[2, 'new'], [3, 'exists'], [4, 'new'], [5, 'same_name'], [6, 'error']]);
  assert.deepEqual(preview.summary, { total: 5, new: 2, exists: 1, repeated: 0, sameName: 1, errors: 1 });
  assert.equal(await db.careClient.count({ where: { organizationId: f.orgA.id } }), before);
  /* Eelvaade ei kanna aadressi ega telefoni tagasi: ainult nimi, tunnus ja seis. */
  assert.deepEqual(Object.keys(preview.rows[0]).sort(), ['displayName', 'errorKey', 'internalCode', 'line', 'status']);

  /* Ainult hooldusjuht; võõras asutus loob oma asutusse, mitte siia. */
  await expectError(previewClientImport(anu, { text }, deps()), 403, 'org.errors.missing_capability');
  await expectError(applyClientImport(anu, { text }, deps()), 403, 'org.errors.missing_capability');
  /* Üksuse hooldusjuht: ainult oma üksusesse; teise üksuse klientide nimesid eelvaade ei reeda. */
  await expectError(previewClientImport(bert, { text }, deps()), 403, 'org.errors.missing_capability');
  await expectError(applyClientImport(bert, { text, unitId: south.id }, deps()), 403, 'org.errors.missing_capability');
  const scoped = await previewClientImport(bert, { text: 'Nimi\nLõuna Leida\nOlemas Olev', unitId: north.id }, deps());
  assert.deepEqual(scoped.rows.map((row) => row.status), ['new', 'new']);
  await expectError(previewClientImport(lead, { text, unitId: 'cmv0aaaaaaaaaaaaaaaaaaaaa' }, deps()), 400, 'home_care.errors.invalid_unit');
  await expectError(previewClientImport(lead, { text: 'Aadress\nKase 3' }, deps()), 400, 'home_care.errors.import_name_column_missing');
  await expectError(applyClientImport(lead, { text: '' }, deps()), 400, 'home_care.errors.import_empty');

  /* SISSETOOMINE: uued read; samanimeline ainult kinnitusega. */
  const first = await applyClientImport(lead, { text }, deps());
  assert.equal(first.created, 2);
  assert.equal(first.summary.sameNameSkipped, 1);
  const linda = await db.careClient.findFirst({ where: { organizationId: f.orgA.id, internalCode: 'LT-1' } });
  assert.deepEqual(
    [linda.displayName, linda.address, linda.contactPhone, linda.contactNote, linda.status, linda.unitId, linda.createdByMembershipId],
    ['Linda Tamm', 'Kase 3', '5551234', 'Tütar Mari', 'ACTIVE', null, f.members.lead.id]
  );
  /* Iga loodud klient jätab sama auditirea mis käsitsi loodu, ilma nimeta. */
  const audit = await db.dataAuditLog.findMany({ where: { resourceId: linda.id } });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'org.home_care_client_created');
  assert.equal(JSON.stringify(audit[0].meta).includes('Linda'), false);

  /* SAMA TABEL TEIST KORDA ei tekita ühtegi kordust: tunnusega rida on olemas,
     tunnuseta rida on nüüd „sama nimi". */
  const again = await applyClientImport(lead, { text }, deps());
  assert.equal(again.created, 0);
  assert.deepEqual(again.summary, { total: 5, new: 0, exists: 2, repeated: 0, sameName: 2, errors: 1, sameNameSkipped: 2 });
  assert.equal(await db.careClient.count({ where: { organizationId: f.orgA.id } }), before + 2);

  /* Kinnitatud samanimeline tuuakse üle (rida 5 on teine inimene). */
  const confirmed = await applyClientImport(lead, { text, confirmedLines: [5, 6, 99, -1, 'x'] }, deps());
  assert.equal(confirmed.created, 1);
  assert.equal(await db.careClient.count({ where: { organizationId: f.orgA.id, displayName: { equals: 'olemas olev', mode: 'insensitive' } } }), 2);

  /* Üksuse hooldusjuht toob oma üksusesse; klient saab selle üksuse. */
  const toNorth = await applyClientImport(bert, { text: 'Nimi;Tunnus\nPõhja Peeter;PP-1', unitId: north.id }, deps());
  assert.equal(toNorth.created, 1);
  assert.equal((await db.careClient.findFirst({ where: { organizationId: f.orgA.id, internalCode: 'PP-1' } })).unitId, north.id);

  /* Teise asutuse sama tunnus ei sega (kordumatus on asutuse piires). */
  const other = await applyClientImport(leadB, { text: 'Nimi;Tunnus\nLinda Tamm;LT-1' }, deps());
  assert.equal(other.created, 1);

  /* KÕIK VÕI MITTE MIDAGI. Teise kliendi loomine ebaõnnestub (keegi lõi sama
     tunnusega kliendi eelvaate ja sissetoomise vahel): ka esimene rida võetakse
     tagasi ja hooldusjuht saab teate tabel uuesti kontrollida. */
  let creates = 0;
  const failing = new Proxy(db, {
    get(target, prop) {
      if (prop !== '$transaction') return Reflect.get(target, prop);
      return (run, options) =>
        target.$transaction(
          (tx) =>
            run(
              new Proxy(tx, {
                get(inner, key) {
                  if (key !== 'careClient') return Reflect.get(inner, key);
                  return new Proxy(inner.careClient, {
                    get(model, method) {
                      if (method !== 'create') return Reflect.get(model, method);
                      return (args) => {
                        creates += 1;
                        if (creates === 2) throw Object.assign(new Error('unique'), { code: 'P2002' });
                        return model.create(args);
                      };
                    }
                  });
                }
              })
            ),
          options
        );
    }
  });
  const countBefore = await db.careClient.count({ where: { organizationId: f.orgA.id } });
  await expectError(
    applyClientImport(lead, { text: ['Nimi;Tunnus', 'Esimene Uus;EU-1', 'Teine Uus;TU-2'].join('\n') }, { ...deps(), db: failing }),
    409,
    'home_care.errors.import_changed'
  );
  assert.equal(creates, 2);
  assert.equal(await db.careClient.count({ where: { organizationId: f.orgA.id } }), countBefore);
  assert.equal(await db.careClient.count({ where: { organizationId: f.orgA.id, internalCode: 'EU-1' } }), 0);

  /* Lipp väljas: sissetoomist ei ole. */
  const offContext = await f.ctx(f.users.lead, f.orgA, { ORG_WORKSPACE_ENABLED: '1' });
  await expectError(previewClientImport(offContext, { text }, { db, env: { ORG_WORKSPACE_ENABLED: '1' } }), 404);
});

test('imporditud ajalugu: ületoomine, lugemine lehekülgede kaupa, otsing, eemaldamine ja ligipääs', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const cover = await f.ctx(f.users.cover, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  const { client: otherClient } = await createClient(lead, { displayName: 'Jaan Kask' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  /* Cia on teise kliendi meeskonnas: selle kliendi juures on ta asendaja, kes peab andma põhjuse. */
  await addTeamMember(lead, otherClient.id, { membershipId: f.members.cover.id }, deps());

  /* 60 lõiku: võtme kokkulepe ühes kohas, pesumasin teises. */
  const paragraphs = Array.from({ length: 60 }, (_, index) => `Käik ${index + 1}. ${'Tõin toidu ja koristasin. '.repeat(20).trim()}`);
  paragraphs[4] += ' Võtme andis naaber Mati Kask.';
  paragraphs[40] += ' Pesumasin lekkis jälle.';
  const text = paragraphs.join('\r\n\r\n');

  /* Ainult hooldusjuht toob üle; sisendi kontroll. */
  await expectError(importHistory(anu, client.id, { title: 'Drive', text }, deps()), 403, 'org.errors.missing_capability');
  await expectError(importHistory(clerk, client.id, { title: 'Drive', text }, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(importHistory(leadB, client.id, { title: 'Drive', text }, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(importHistory(lead, client.id, { title: '  ', text }, deps()), 400, 'home_care.errors.history_title_required');
  await expectError(importHistory(lead, client.id, { title: 'Drive', text: '  \n ' }, deps()), 400, 'home_care.errors.history_text_required');
  await expectError(importHistory(lead, client.id, { title: 'Drive', text: 'x'.repeat(1_000_001) }, deps()), 400, 'home_care.errors.history_too_large');
  assert.equal(await db.careImportedHistory.count({ where: { clientId: client.id } }), 0);

  const { history } = await importHistory(lead, client.id, { title: ' Drive’i päevik  2023–2026 ', text }, deps(at('2026-10-09T09:00:00Z')));
  assert.equal(history.title, 'Drive’i päevik 2023–2026');
  assert.equal(history.importedByName, 'Juta Juht');
  assert.equal(history.createdAt, '2026-10-09T09:00:00.000Z');
  assert.ok(history.blockCount > 1 && history.blockCount <= 60);
  /* Midagi ei kadunud: lõigud kokku annavad sama teksti (reavahetused ühtlustatud). */
  const stored = await db.careImportedHistoryBlock.findMany({ where: { historyId: history.id }, orderBy: { position: 'asc' } });
  assert.equal(stored.length, history.blockCount);
  assert.deepEqual(stored.map((row) => row.position), stored.map((_, index) => index + 1));
  assert.equal(stored.map((row) => row.text).join('\n\n'), paragraphs.join('\n\n'));
  assert.equal(history.charCount, stored.reduce((sum, row) => sum + row.text.length, 0));
  assert.ok(stored.every((row) => row.searchText && row.searchVersion === 'sb1'));

  /* SAMA TEKST TEIST KORDA ei lähe (ka teiste reavahetustega); teisele kliendile läheb. */
  await expectError(importHistory(lead, client.id, { title: 'Uuesti', text: paragraphs.join('\n\n') }, deps()), 409, 'home_care.errors.history_already_imported');
  assert.equal(await db.careImportedHistory.count({ where: { clientId: client.id } }), 1);
  const second = await importHistory(lead, otherClient.id, { title: 'Sama tekst', text }, deps());
  assert.ok(second.history.id);

  /* Ajalugu on kliendi lehe andmetes loendina (ilma tekstita). */
  const opened = await openClient(anu, client.id, deps());
  assert.deepEqual(opened.histories.map((row) => row.id), [history.id]);
  assert.equal(JSON.stringify(opened.histories).includes('Pesumasin'), false);

  /* LUGEMINE lehekülgede kaupa, teksti järjekorras; loeb meeskond, mitte kõrvaline. */
  const pageOne = await readHistory(anu, client.id, history.id, {}, deps());
  assert.equal(pageOne.blocks[0].position, 1);
  assert.ok(pageOne.blocks[0].text.startsWith('Käik 1.'));
  const collected = [...pageOne.blocks];
  let cursor = pageOne;
  while (cursor.hasMore) {
    cursor = await readHistory(anu, client.id, history.id, { after: String(cursor.nextAfter) }, deps());
    collected.push(...cursor.blocks);
  }
  assert.deepEqual(collected.map((block) => block.position), stored.map((row) => row.position));
  await expectError(readHistory(clerk, client.id, history.id, {}, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(readHistory(cover, client.id, history.id, {}, deps()), 403, 'home_care.errors.access_reason_required');
  /* Teise kliendi ajalugu selle kliendi alt ei avane. */
  await expectError(readHistory(lead, client.id, second.history.id, {}, deps()), 404, 'home_care.errors.history_not_found');
  /* Lugemine jätab kliendi avamislogisse rea. */
  assert.ok((await db.careClientAccess.count({ where: { clientId: client.id, membershipId: f.members.anu.id } })) >= 1);

  /* OTSING: sõna ja sõna algus leiavad õige lõigu; teise kliendi teksti ei leia. */
  const key = await searchHistory(anu, client.id, { q: 'naaber Mati' }, deps());
  assert.equal(key.items.length, 1);
  assert.ok(key.items[0].text.includes('Võtme andis naaber Mati Kask.'));
  assert.equal(key.items[0].title, 'Drive’i päevik 2023–2026');
  const wash = await searchHistory(anu, client.id, { q: 'pesu' }, deps());
  assert.equal(wash.items.length, 1);
  assert.ok(wash.items[0].text.includes('Pesumasin lekkis jälle.'));
  assert.deepEqual((await searchHistory(anu, client.id, { q: 'olematu' }, deps())).items, []);
  await expectError(searchHistory(anu, client.id, { q: 'a' }, deps()), 400, 'home_care.errors.search_too_short');
  await expectError(searchHistory(clerk, client.id, { q: 'pesu' }, deps()), 404, 'home_care.errors.client_not_found');
  /* Päeviku otsing imporditud teksti kirjete hulka ei too. */
  assert.deepEqual((await searchEntries(anu, client.id, { q: 'pesu' }, deps())).items, []);

  /* Audit: ainult ID-d. */
  const audit = await db.dataAuditLog.findMany({ where: { resourceId: history.id } });
  assert.deepEqual(audit.map((row) => row.action), ['org.home_care_history_imported']);
  assert.deepEqual(Object.keys(audit[0].meta).sort(), ['clientId', 'historyId', 'organizationId']);

  /* EEMALDAMINE: ainult hooldusjuht; lõigud kustuvad koos ajalooga. */
  await expectError(removeHistory(anu, client.id, history.id, deps()), 403, 'org.errors.missing_capability');
  await expectError(removeHistory(lead, otherClient.id, history.id, deps()), 404, 'home_care.errors.history_not_found');
  assert.deepEqual(await removeHistory(lead, client.id, history.id, deps()), { removed: true });
  assert.equal(await db.careImportedHistoryBlock.count({ where: { historyId: history.id } }), 0);
  assert.equal((await openClient(anu, client.id, deps())).histories.length, 0);
  /* Pärast eemaldamist saab sama teksti uuesti üle tuua. */
  const again = await importHistory(lead, client.id, { title: 'Uuesti', text }, deps());
  assert.ok(again.history.id);

  /* Kliendi kustutamisel kustub ka ajalugu. */
  await db.careClient.delete({ where: { id: otherClient.id } });
  assert.equal(await db.careImportedHistory.count({ where: { id: second.history.id } }), 0);
  /* Andmebaas ei luba tühja pealkirja. */
  await assert.rejects(
    db.careImportedHistory.create({ data: { organizationId: f.orgA.id, clientId: client.id, title: '  ', charCount: 1, blockCount: 1, contentSha256: 'x', importedByMembershipId: f.members.lead.id, importedByName: 'x' } }),
    /title_not_blank/
  );
});

test('uksesilt: üks kehtiv silt, uus tühistab vana, silt ei anna ligipääsu', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const cover = await f.ctx(f.users.cover, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  const { client: otherClient } = await createClient(lead, { displayName: 'Jaan Kask' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, otherClient.id, { membershipId: f.members.cover.id }, deps());
  const site = { siteUrl: 'https://sotsiaal.pro' };

  /* Alguses silti ei ole; sildi teeb ainult hooldusjuht. */
  assert.deepEqual(await getDoorTag(lead, client.id, { ...deps(), ...site }), { client: { id: client.id, displayName: 'Linda Tamm' }, tag: null });
  await expectError(getDoorTag(anu, client.id, deps()), 403, 'org.errors.missing_capability');
  await expectError(issueDoorTag(anu, client.id, deps()), 403, 'org.errors.missing_capability');
  await expectError(issueDoorTag(clerk, client.id, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(issueDoorTag(leadB, client.id, deps()), 404, 'home_care.errors.client_not_found');

  const { tag } = await issueDoorTag(lead, client.id, { ...deps(at('2026-10-09T09:00:00Z')), ...site });
  assert.match(tag.url, /^https:\/\/sotsiaal\.pro\/org\/koduteenus\/uks\/[A-Za-z0-9_-]{22}$/);
  assert.equal(tag.createdAt, '2026-10-09T09:00:00.000Z');
  assert.ok(tag.qr.side >= 37 && tag.qr.d.startsWith('M'));
  const token = tag.url.split('/').pop();
  /* Aadressis ei ole asutuse ega kliendi ID-d ega nime. */
  for (const secret of [f.orgA.id, client.id, 'Linda', 'Tamm']) assert.equal(tag.url.includes(secret), false, secret);
  assert.equal((await getDoorTag(lead, client.id, { ...deps(), ...site })).tag.url, tag.url);

  /* SILT EI ANNA LIGIPÄÄSU: kes klienti ei näe, saab sama vastuse mis olematu sildi puhul. */
  assert.equal(await findDoorTagOrganization(token, { db }), f.orgA.id);
  assert.deepEqual(await locateDoorTagForViewer(anu, token, deps()), { clientId: client.id });
  assert.deepEqual(await locateDoorTagForViewer(lead, token, deps()), { clientId: client.id });
  /* Teise kliendi hooldaja jõuab kliendi lehele, kus temalt küsitakse põhjust. */
  assert.deepEqual(await locateDoorTagForViewer(cover, token, deps()), { clientId: client.id });
  await expectError(openClient(cover, client.id, deps()), 403, 'home_care.errors.access_reason_required');
  /* Kõrvaline liige ja teine asutus: 404. */
  await expectError(locateDoorTagForViewer(clerk, token, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(locateDoorTagForViewer(leadB, token, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(locateDoorTagForViewer(anu, 'x'.repeat(22), deps()), 404, 'home_care.errors.client_not_found');
  await expectError(locateDoorTagForViewer(anu, 'liiga-lühike', deps()), 404, 'home_care.errors.client_not_found');
  assert.equal(await findDoorTagOrganization('x'.repeat(22), { db }), null);
  assert.equal(await findDoorTagOrganization("'; DROP TABLE x; --", { db }), null);

  /* UUS SILT tühistab eelmise: vana aadress lakkab töötamast. */
  const second = await issueDoorTag(lead, client.id, { ...deps(at('2026-10-10T09:00:00Z')), ...site });
  assert.notEqual(second.tag.url, tag.url);
  await expectError(locateDoorTagForViewer(anu, token, deps()), 404, 'home_care.errors.client_not_found');
  assert.equal(await findDoorTagOrganization(token, { db }), null);
  const newToken = second.tag.url.split('/').pop();
  assert.deepEqual(await locateDoorTagForViewer(anu, newToken, deps()), { clientId: client.id });
  assert.equal(await db.careClientDoorTag.count({ where: { clientId: client.id } }), 2);
  assert.equal(await db.careClientDoorTag.count({ where: { clientId: client.id, revokedAt: null } }), 1);
  /* Kaks kehtivat silti ühel kliendil ei luba ka andmebaas ise. */
  await assert.rejects(
    db.careClientDoorTag.create({ data: { organizationId: f.orgA.id, clientId: client.id, token: 'y'.repeat(22), createdByMembershipId: f.members.lead.id } }),
    /one_active_per_client|Unique constraint/
  );
  /* Samaaegsed „tee uus silt" jätavad ühe kehtiva. */
  await Promise.all([1, 2, 3].map(() => issueDoorTag(lead, client.id, deps())));
  assert.equal(await db.careClientDoorTag.count({ where: { clientId: client.id, revokedAt: null } }), 1);

  /* TÜHISTAMINE: ainult hooldusjuht; pärast seda silti ei ole. */
  await expectError(revokeDoorTag(anu, client.id, deps()), 403, 'org.errors.missing_capability');
  assert.deepEqual(await revokeDoorTag(lead, client.id, deps()), { revoked: true });
  assert.deepEqual(await revokeDoorTag(lead, client.id, deps()), { revoked: false });
  assert.equal((await getDoorTag(lead, client.id, deps())).tag, null);
  await expectError(locateDoorTagForViewer(anu, newToken, deps()), 404, 'home_care.errors.client_not_found');

  /* Audit: ainult ID-d, tunnust seal ei ole. */
  const audit = await db.dataAuditLog.findMany({ where: { action: { in: ['org.home_care_door_tag_issued', 'org.home_care_door_tag_revoked'] }, meta: { path: ['clientId'], equals: client.id } } });
  assert.ok(audit.length >= 3);
  assert.ok(audit.every((row) => Object.keys(row.meta).sort().join() === 'clientId,organizationId,tagId'));
  assert.equal(JSON.stringify(audit).includes(token), false);
  assert.equal(JSON.stringify(audit).includes(newToken), false);

  /* Kliendi kustutamisel kustuvad ka sildid. */
  await issueDoorTag(lead, otherClient.id, deps());
  await db.careClient.delete({ where: { id: otherClient.id } });
  assert.equal(await db.careClientDoorTag.count({ where: { clientId: otherClient.id } }), 0);
});

test('kõnemärge ja loendur: kirje väljad, kuu arvud skoobis, telefoninumbri järgi leiab ainult hooldusjuht', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.bert.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm', contactPhone: '+372 555 12 34' }, deps());
  const { client: northClient } = await createClient(lead, { displayName: 'Põhja Peeter', unitId: north.id, contactPhone: '5559876' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, northClient.id, { membershipId: f.members.anu.id }, deps());

  const callNote = (clientId, topic, caller, occurredAt, extra = {}) =>
    createEntry(anu, clientId, { text: 'Kõne.', contactMode: 'PHONE', callTopic: topic, callCaller: caller, occurredAt, ...extra }, deps());
  const first = await callNote(client.id, 'STATUS', 'RELATIVE', '2026-10-02T08:00:00Z');
  assert.deepEqual(first.entry.call, { topic: 'STATUS', caller: 'RELATIVE' });
  assert.equal(first.entry.contactMode, 'PHONE');
  await callNote(client.id, 'STATUS', 'RELATIVE', '2026-10-05T08:00:00Z');
  await callNote(client.id, 'CHANGE', 'CLIENT', '2026-10-06T08:00:00Z');
  await callNote(northClient.id, 'CONCERN', 'RELATIVE', '2026-10-07T08:00:00Z');
  /* Septembri kõned ja kuuvahetus asutuse ajas: 30.09 kell 21:30 UTC on Tallinnas juba 1. oktoober. */
  await callNote(client.id, 'STATUS', 'OTHER', '2026-09-15T08:00:00Z');
  await callNote(client.id, 'OTHER', 'CLIENT', '2026-09-30T21:30:00Z');
  /* Tavaline kirje ja tavaline telefonikirje loendurisse ei lähe. */
  await createEntry(anu, client.id, { text: 'Käik.' }, deps());
  const plainPhone = await createEntry(anu, client.id, { text: 'Helistasin apteeki.', contactMode: 'PHONE' }, deps());
  assert.equal(plainPhone.entry.call, null);
  /* Tühistatud kõnemärge loendurisse ei lähe. */
  const wrong = await callNote(client.id, 'CONCERN', 'CLIENT', '2026-10-08T07:00:00Z');
  await retractEntry(lead, client.id, wrong.entry.id, { reason: 'Vale klient', revision: 1 }, deps());

  const october = await getCallCounts(lead, { month: '2026-10' }, deps());
  assert.equal(october.month, '2026-10');
  assert.equal(october.previousMonth, '2026-09');
  /* Käesolevast kuust edasi ei sirvita. */
  assert.equal(october.nextMonth, null);
  assert.equal(october.counts.total, 5);
  assert.deepEqual(october.counts.byTopic, { STATUS: 2, CHANGE: 1, CONCERN: 1, OTHER: 1 });
  assert.deepEqual(october.counts.byCaller, { RELATIVE: 3, CLIENT: 2, OTHER: 0 });
  assert.equal(october.counts.matrix.STATUS.RELATIVE, 2);
  assert.equal(october.counts.matrix.OTHER.CLIENT, 1);
  assert.equal(october.previous.total, 1);
  assert.deepEqual(october.previous.byTopic, { STATUS: 1, CHANGE: 0, CONCERN: 0, OTHER: 0 });
  /* Vaikimisi kuu on käesolev (testi „praegu" on 09.10.2026). */
  assert.equal((await getCallCounts(lead, {}, deps())).month, '2026-10');
  const september = await getCallCounts(lead, { month: '2026-09' }, deps());
  assert.equal(september.counts.total, 1);
  assert.equal(september.nextMonth, '2026-10');
  /* Vastuses ei ole nimesid ega teksti. */
  assert.equal(/Linda|Peeter|Kõne\./.test(JSON.stringify(october)), false);

  /* SKOOP: üksuse hooldusjuht näeb oma üksuse kõnesid; hooldaja ja teine asutus ei näe. */
  const scoped = await getCallCounts(bert, { month: '2026-10' }, deps());
  assert.equal(scoped.counts.total, 1);
  assert.deepEqual(scoped.counts.byTopic, { STATUS: 0, CHANGE: 0, CONCERN: 1, OTHER: 0 });
  await expectError(getCallCounts(anu, {}, deps()), 403, 'org.errors.missing_capability');
  assert.equal((await getCallCounts(leadB, { month: '2026-10' }, deps())).counts.total, 0);
  await expectError(getCallCounts(lead, { month: '2026-13' }, deps()), 400, 'home_care.errors.invalid_month');

  /* Kõnemärke väljad: sisendi kontroll, parandus ja andmebaasi reeglid. */
  await expectError(createEntry(anu, client.id, { text: 'x', contactMode: 'PHONE', callTopic: 'STATUS' }, deps()), 400, 'home_care.errors.invalid_call');
  const visit = await createEntry(anu, client.id, { text: 'Käik', contactMode: 'VISIT', callTopic: 'STATUS', callCaller: 'CLIENT' }, deps());
  assert.equal(visit.entry.call, null);
  const corrected = await correctEntry(anu, client.id, first.entry.id, { text: 'Tegelikult käisin kohal.', contactMode: 'VISIT', reason: 'Vale kontakti viis', revision: 1 }, deps());
  assert.equal(corrected.entry.call, null);
  assert.equal((await getCallCounts(lead, { month: '2026-10' }, deps())).counts.byTopic.STATUS, 1);
  /* Parandusjälg hoiab, mis kõnemärge enne oli. */
  const trail = await db.careClientEntryRevision.findFirst({ where: { entryId: first.entry.id } });
  assert.deepEqual([trail.snapshot.callTopic, trail.snapshot.callCaller], ['STATUS', 'RELATIVE']);
  await assert.rejects(db.careClientEntry.update({ where: { id: visit.entry.id }, data: { callTopic: 'STATUS' } }), /call_fields_together/);
  await assert.rejects(db.careClientEntry.update({ where: { id: visit.entry.id }, data: { callTopic: 'STATUS', callCaller: 'CLIENT' } }), /call_only_on_phone/);

  /* TELEFONINUMBRI JÄRGI: ainult hooldusjuht, oma skoobis; kirjaviis ei loe. */
  const byPhone = await searchClients(lead, { q: '555 1234' }, deps());
  assert.deepEqual(byPhone.clients.map((row) => [row.displayName, row.matchedPhone]), [['Linda Tamm', true]]);
  assert.deepEqual((await searchClients(lead, { q: '+3725551234' }, deps())).clients.map((row) => row.displayName), ['Linda Tamm']);
  /* Alla viie numbri ei otsita: lühike jupp sobiks liiga paljudele. */
  assert.deepEqual((await searchClients(lead, { q: '5551' }, deps())).clients, []);
  /* Hooldaja numbri järgi ei leia, ka oma klienti mitte. */
  assert.deepEqual((await searchClients(anu, { q: '5551234' }, deps())).clients, []);
  /* Üksuse hooldusjuht leiab ainult oma üksuse kliendi. */
  assert.deepEqual((await searchClients(bert, { q: '5551234' }, deps())).clients, []);
  assert.deepEqual((await searchClients(bert, { q: '5559876' }, deps())).clients.map((row) => row.displayName), ['Põhja Peeter']);
  /* Nimeotsing töötab nagu enne ja nimega leitu ei tule teist korda. */
  assert.deepEqual((await searchClients(lead, { q: 'Linda' }, deps())).clients.map((row) => [row.displayName, row.matchedPhone]), [['Linda Tamm', undefined]]);
});

test('täielik väljavõte: üks hetk andmebaasist, arvud ja viited klapivad, ainult kogu asutuse hooldusjuht', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.bert.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const cover = await f.ctx(f.users.cover, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);

  /* Asutus A: iga kogu saab vähemalt ühe rea. */
  const { client } = await createClient(
    lead,
    { displayName: 'Linda Tamm', internalCode: 'LT-9', address: 'Kase 3, Rakvere', contactPhone: '+372 555 12 34', contactNote: 'Tütar Mari helistab õhtuti.' },
    deps()
  );
  const { client: northClient } = await createClient(lead, { displayName: 'Põhja Peeter', unitId: north.id }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, northClient.id, { membershipId: f.members.cover.id }, deps());
  await addCardLine(anu, client.id, { kind: 'ACCESS', text: 'Võti on naabri käes.' }, deps());
  const note = await createEntry(anu, client.id, { text: 'Tõin toidu.', occurredAt: '2026-10-07T07:00:00Z' }, deps());
  await createEntry(anu, client.id, { kind: 'HANDOVER', text: 'Pesumasin lekib.', occurredAt: '2026-10-08T06:00:00Z' }, deps());
  const concern = await createEntry(anu, client.id, { kind: 'CONCERN', text: 'Poeg võtab pensioni ära.', occurredAt: '2026-10-08T09:00:00Z' }, deps());
  const fall = await createEntry(anu, client.id, { kind: 'INCIDENT', incidentType: 'FALL', text: 'Leidsin köögi põrandalt.', occurredAt: '2026-10-09T04:00:00Z' }, deps());
  await addIncidentUpdate(anu, client.id, fall.entry.id, { text: 'Tütar tuleb õhtul.' }, deps(at('2026-10-09T08:10:00Z')));
  const call = await createEntry(anu, client.id, { text: 'Tütar küsis seisu.', contactMode: 'PHONE', callTopic: 'STATUS', callCaller: 'RELATIVE', occurredAt: '2026-10-08T12:00:00Z' }, deps());
  await correctEntry(anu, client.id, note.entry.id, { text: 'Tõin toidu ja ravimid.', reason: 'Täpsustus', revision: 1 }, deps());
  const wrong = await createEntry(anu, client.id, { text: 'Vale kliendi kirje.', occurredAt: '2026-10-08T07:00:00Z' }, deps());
  await retractEntry(lead, client.id, wrong.entry.id, { reason: 'Vale klient', revision: 1 }, deps());
  await openClient(lead, client.id, deps());
  await openClientWithReason(cover, client.id, { reasonCode: 'COVERING', reason: 'Anu on haige' }, deps());
  /* Asendaja avab lehe: teade järgmisele saab lugemismärgi. */
  await openClient(cover, client.id, deps());
  await importHistory(lead, client.id, { title: 'Drive’i päevik', text: 'Esimene lõik.\n\nTeine lõik.\n\nKolmas lõik.' }, deps());
  await createChronologyRelease(
    lead,
    client.id,
    { from: '2026-10-07', to: '2026-10-09', requester: 'PPA', basis: 'Päring nr 1', items: [{ entryId: fall.entry.id, revision: 1 }] },
    deps(at('2026-10-09T10:00:00Z'))
  );
  await issueDoorTag(lead, client.id, deps());
  const tag = await db.careClientDoorTag.findFirst({ where: { clientId: client.id }, select: { token: true } });
  /* Seisu ajalugu (K1-j): ära ja tagasi, et väljavõttes oleks ka see kogu. */
  const northVersion = (await db.careClient.findUnique({ where: { id: northClient.id }, select: { version: true } })).version;
  await setClientStatus(lead, northClient.id, { version: northVersion, status: 'AWAY', statusReason: 'HOSPITAL' }, deps());
  await setClientStatus(lead, northClient.id, { version: northVersion + 1, status: 'ACTIVE' }, deps());
  /* Lehekülgede kaupa lugemine: üle kahe lehe avamisi, et ükski rida ei jääks vahele ega korduks. */
  await db.careClientAccess.createMany({
    data: Array.from({ length: 1100 }, () => ({
      organizationId: f.orgA.id,
      clientId: northClient.id,
      membershipId: f.members.cover.id,
      actorName: 'Cia Asendaja',
      basis: 'TEAM'
    }))
  });

  /* Asutus B: selle andmed ei tohi asutuse A faili sattuda. */
  const { client: foreignClient } = await createClient(leadB, { displayName: 'Võõras Klient' }, deps());
  await createEntry(leadB, foreignClient.id, { text: 'Teise asutuse kirje.' }, deps());

  const exportRows = () =>
    db.dataAuditLog.findMany({
      where: { action: 'org.home_care_export_created', meta: { path: ['organizationId'], equals: f.orgA.id } },
      orderBy: { createdAt: 'asc' }
    });

  /* ÕIGUS: ainult kogu asutuse hooldusjuht; keeldumine ei jäta jälge ega anna faili. */
  await expectError(createHomeCareExport(anu, { reasonCode: 'BACKUP' }, deps()), 403, 'org.errors.missing_capability');
  await expectError(createHomeCareExport(clerk, { reasonCode: 'BACKUP' }, deps()), 403, 'org.errors.missing_capability');
  await expectError(createHomeCareExport(bert, { reasonCode: 'BACKUP' }, deps()), 403, 'home_care.errors.export_whole_org_only');
  await expectError(getHomeCareExportOverview(bert, deps()), 403, 'home_care.errors.export_whole_org_only');
  await expectError(getHomeCareExportOverview(anu, deps()), 403, 'org.errors.missing_capability');
  await expectError(createHomeCareExport(lead, {}, deps()), 400, 'home_care.errors.invalid_export_reason');
  await expectError(createHomeCareExport(lead, { reasonCode: 'CURIOSITY' }, deps()), 400, 'home_care.errors.invalid_export_reason');
  await expectError(createHomeCareExport(lead, { reasonCode: 'BACKUP' }, { db, env: { ORG_WORKSPACE_ENABLED: '1', HOME_CARE_ENABLED: '0' } }), 404);
  assert.equal((await exportRows()).length, 0);

  const read = (result) => {
    const raw = gunzipSync(result.body);
    return { raw, text: raw.toString('utf8'), doc: JSON.parse(raw.toString('utf8')) };
  };
  const result = await createHomeCareExport(lead, { reasonCode: 'leaving' }, deps(at('2026-10-09T12:00:00Z')));
  const { raw, text, doc } = read(result);

  /* Kontrollsumma ja suurus on PAKKIMATA failist: seda näeb asutus oma kettal. */
  assert.equal(createHash('sha256').update(raw).digest('hex'), result.contentSha256);
  assert.equal(raw.length, result.byteCount);
  assert.equal(result.body.length, result.packedByteCount);

  /* Kuju: päis, kogud lepitud järjekorras, lõpus koguarvud. */
  assert.deepEqual(Object.keys(doc), ['format', 'version', 'exportId', 'generatedAt', 'organization', 'exportedBy', 'reasonCode', 'manifest', ...HOME_CARE_EXPORT_KEYS, 'totals']);
  assert.equal(doc.exportId, result.exportId);
  assert.equal(doc.generatedAt, '2026-10-09T12:00:00.000Z');
  assert.equal(doc.reasonCode, 'LEAVING');
  assert.equal(doc.organization.id, f.orgA.id);
  assert.deepEqual(doc.exportedBy, { membershipId: f.members.lead.id, name: 'Juta Juht' });
  assert.deepEqual(doc.manifest.includes, [...HOME_CARE_EXPORT_KEYS]);
  assert.ok(doc.manifest.excludes.every((item) => item.key && item.why));

  /* Sisemine kooskõla: koguarvud, kordumatud ID-d, iga viide leiab oma rea. */
  const check = checkHomeCareExport(doc);
  assert.deepEqual(check.problems, []);
  assert.deepEqual(check.notes, []);
  assert.deepEqual(doc.totals, result.totals);
  assert.equal(result.rowCount, Object.values(doc.totals).reduce((sum, count) => sum + count, 0));

  /* Koguarvud on samad mis andmebaasis (sõltumatu päring iga kogu kohta). */
  const ofOrg = { organizationId: f.orgA.id };
  const expected = {
    units: await db.organizationUnit.count({ where: ofOrg }),
    /* Ainult need, kellele read viitavad: koostaja, hooldaja ja asendaja. */
    people: 3,
    clients: await db.careClient.count({ where: ofOrg }),
    teamMembers: await db.careClientTeamMember.count({ where: { client: ofOrg } }),
    cardLines: await db.careClientCardLine.count({ where: { client: ofOrg } }),
    entries: await db.careClientEntry.count({ where: ofOrg }),
    entryRevisions: await db.careClientEntryRevision.count({ where: { entry: ofOrg } }),
    entryReads: await db.careClientEntryRead.count({ where: { entry: ofOrg } }),
    incidentUpdates: await db.careIncidentUpdate.count({ where: ofOrg }),
    accessLog: await db.careClientAccess.count({ where: ofOrg }),
    chronologyReleases: await db.careChronologyRelease.count({ where: ofOrg }),
    chronologyReleaseItems: await db.careChronologyReleaseItem.count({ where: { release: ofOrg } }),
    importedHistories: await db.careImportedHistory.count({ where: ofOrg }),
    importedHistoryBlocks: await db.careImportedHistoryBlock.count({ where: ofOrg }),
    doorTags: await db.careClientDoorTag.count({ where: ofOrg }),
    clientStatusChanges: await db.careClientStatusChange.count({ where: ofOrg }),
    auditEvents: await db.dataAuditLog.count({
      where: { action: { startsWith: 'org.home_care_' }, meta: { path: ['organizationId'], equals: f.orgA.id }, createdAt: { lt: (await exportRows())[0].createdAt } }
    })
  };
  assert.deepEqual(doc.totals, expected);
  for (const key of HOME_CARE_EXPORT_KEYS) assert.ok(doc.totals[key] > 0, `kogu ${key} on tühi: test ei tõenda seda`);
  assert.ok(doc.totals.accessLog > 1100);

  /* Sisu: kliendi andmed, piiratud nähtavusega kirje, tühistatud kirje, kõnemärge, parandusjälg, põhjusega avamine. */
  const exported = doc.clients.find((row) => row.id === client.id);
  assert.deepEqual(
    [exported.displayName, exported.internalCode, exported.address, exported.contactPhone, exported.contactNote, exported.status],
    ['Linda Tamm', 'LT-9', 'Kase 3, Rakvere', '+372 555 12 34', 'Tütar Mari helistab õhtuti.', 'ACTIVE']
  );
  assert.equal(doc.clients.find((row) => row.id === northClient.id).unitId, north.id);
  const entry = (id) => doc.entries.find((row) => row.id === id);
  assert.equal(entry(concern.entry.id).coordinatorOnly, true);
  assert.equal(entry(note.entry.id).text, 'Tõin toidu ja ravimid.');
  assert.equal(entry(note.entry.id).revision, 2);
  assert.ok(entry(wrong.entry.id).retractedAt);
  assert.deepEqual([entry(call.entry.id).callTopic, entry(call.entry.id).callCaller], ['STATUS', 'RELATIVE']);
  assert.equal(entry(fall.entry.id).incidentType, 'FALL');
  assert.equal(entry(note.entry.id).authorName, 'Anu Hooldaja');
  assert.deepEqual(doc.entryRevisions.map((row) => row.kind).sort(), ['CORRECTION', 'RETRACTION']);
  assert.equal(doc.entryRevisions.find((row) => row.kind === 'CORRECTION').text, 'Tõin toidu.');
  assert.ok(doc.accessLog.some((row) => row.basis === 'REASON' && row.reasonCode === 'COVERING' && row.reason === 'Anu on haige'));
  assert.deepEqual(doc.importedHistoryBlocks.map((row) => row.text), ['Esimene lõik.\n\nTeine lõik.\n\nKolmas lõik.']);
  assert.equal(doc.chronologyReleases[0].requester, 'PPA');
  assert.equal(doc.chronologyReleaseItems[0].entryId, fall.entry.id);
  /* Töötajatest on failis ainult need, kellele read viitavad, ja ainult nimega: Bert ja raamatupidaja ei ole kirjetes ega jälgedes. */
  assert.deepEqual(doc.people.map((row) => row.name).sort(), ['Anu Hooldaja', 'Cia Asendaja', 'Juta Juht']);
  assert.ok(doc.people.every((row) => Object.keys(row).sort().join() === 'id,name'));
  for (const absent of ['Bert Hooldaja', 'Dan Raamatupidaja', f.members.bert.id, f.members.clerk.id]) assert.equal(text.includes(absent), false, absent);
  /* Tööloend: ainult koduteenuse read, ainult see asutus, tegija liikmesuse ID-na. */
  assert.ok(doc.auditEvents.every((row) => row.action.startsWith('org.home_care_') && row.meta.organizationId === f.orgA.id));
  assert.ok(doc.auditEvents.every((row) => doc.people.some((person) => person.id === row.actorMembershipId)));

  /* Mida failis EI OLE: sildi tunnus, tehnilised väljad, konto andmed, teise asutuse read. */
  assert.ok(tag.token.length >= 22);
  assert.equal(text.includes(tag.token), false);
  for (const key of ['token', 'searchText', 'searchVersion', 'clientRequestId', 'requestSha256', 'requestHash', 'actorUserId', 'userId', 'email']) {
    assert.equal(text.includes(`"${key}"`), false, key);
  }
  assert.equal(text.includes('@example.invalid'), false);
  for (const foreign of ['Võõras Klient', 'Teise asutuse kirje.', foreignClient.id, f.orgB.id, f.members.leadB.id, 'Eve Juht']) {
    assert.equal(text.includes(foreign), false, foreign);
  }

  /* TÖÖLOEND: üks rida, ainult ID, kood, arvud ja kontrollsumma. */
  const rows = await exportRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].resourceId, result.exportId);
  assert.equal(rows[0].resourceType, 'CARE_EXPORT');
  assert.equal(rows[0].actorUserId, f.users.lead.id);
  assert.deepEqual(rows[0].meta, {
    organizationId: f.orgA.id,
    membershipId: f.members.lead.id,
    exportId: result.exportId,
    reasonCode: 'LEAVING',
    clientCount: 2,
    entryCount: doc.totals.entries,
    rowCount: result.rowCount,
    byteCount: result.byteCount,
    contentSha256: result.contentSha256
  });

  /* Lehe sisu: põhiarvud ja viimased väljavõtted. */
  const overview = await getHomeCareExportOverview(lead, deps());
  assert.deepEqual(overview.counts, {
    clients: 2,
    entries: doc.totals.entries,
    accessLog: doc.totals.accessLog,
    importedHistories: 1,
    chronologyReleases: 1
  });
  assert.equal(overview.recent.length, 1);
  assert.deepEqual(
    [overview.recent[0].id, overview.recent[0].byName, overview.recent[0].reasonCode, overview.recent[0].rowCount, overview.recent[0].byteCount, overview.recent[0].contentSha256],
    [result.exportId, 'Juta Juht', 'LEAVING', result.rowCount, result.byteCount, result.contentSha256]
  );

  /* ÜKS HETK. Keset lugemist (pärast kliente, enne kirjeid) lisab teine ühendus
     uue kliendi ja talle kirje. Fail peab olema hetkest enne seda: uut kirjet ei
     ole ja ükski viide ei jää õhku. Ilma hetktõmmiseta oleks failis kirje, mille
     klienti seal ei ole. */
  let injected = null;
  const interleaved = new Proxy(db, {
    get(target, prop) {
      if (prop !== '$transaction') return Reflect.get(target, prop);
      return (callback, options) =>
        target.$transaction(
          (tx) =>
            callback(
              new Proxy(tx, {
                get(inner, key) {
                  if (key !== 'careClientEntry') return Reflect.get(inner, key);
                  return new Proxy(inner.careClientEntry, {
                    get(model, method) {
                      if (method !== 'findMany') return Reflect.get(model, method);
                      return async (args) => {
                        if (!injected) {
                          const late = await createClient(lead, { displayName: 'Hiljem Lisatud' }, deps());
                          const lateEntry = await createEntry(lead, late.client.id, { text: 'Lisatud keset väljavõtet.' }, deps());
                          injected = { clientId: late.client.id, entryId: lateEntry.entry.id };
                        }
                        return model.findMany(args);
                      };
                    }
                  });
                }
              })
            ),
          options
        );
    }
  });
  const second = await createHomeCareExport(lead, { reasonCode: 'BACKUP' }, { ...deps(at('2026-10-09T12:05:00Z')), db: interleaved });
  const snapshot = read(second);
  assert.ok(injected);
  assert.equal(await db.careClientEntry.count({ where: { id: injected.entryId } }), 1);
  assert.deepEqual(checkHomeCareExport(snapshot.doc).problems, []);
  assert.equal(snapshot.text.includes(injected.entryId), false);
  assert.equal(snapshot.text.includes(injected.clientId), false);
  assert.equal(snapshot.doc.totals.clients, 2);
  assert.equal(snapshot.doc.totals.entries, doc.totals.entries);
  /* Eelmise väljavõtte tööloendi rida on järgmises failis. */
  assert.ok(snapshot.doc.auditEvents.some((row) => row.action === 'org.home_care_export_created' && row.resourceId === result.exportId));
  assert.notEqual(second.exportId, result.exportId);
  assert.notEqual(second.contentSha256, result.contentSha256);
  assert.equal((await exportRows()).length, 2);

  /* Liiga suur fail: viga, mitte poolik fail, ja tööloendisse rida ei teki. */
  await expectError(createHomeCareExport(lead, { reasonCode: 'BACKUP' }, { ...deps(), maxPackedBytes: 64 }), 413, 'home_care.errors.export_too_large');
  assert.equal((await exportRows()).length, 2);
  await expectError(createHomeCareExport(lead, { reasonCode: 'BACKUP' }, { ...deps(), maxRawBytes: 1000 }), 413, 'home_care.errors.export_too_large');
  /* Tehingu ajapiir on sama teade, mitte „proovi uuesti". */
  const expired = new Proxy(db, {
    get(target, prop) {
      if (prop !== '$transaction') return Reflect.get(target, prop);
      return async () => {
        throw Object.assign(new Error('Transaction already closed'), { code: 'P2028' });
      };
    }
  });
  await expectError(createHomeCareExport(lead, { reasonCode: 'BACKUP' }, { ...deps(), db: expired }), 413, 'home_care.errors.export_too_large');
  /* Küsija katkestas: tööd ei viida lõpuni ja jälge faili kohta, mida keegi ei saanud, ei teki. */
  await assert.rejects(createHomeCareExport(lead, { reasonCode: 'BACKUP' }, { ...deps(), signal: AbortSignal.abort() }), { name: 'AbortError' });
  assert.equal((await exportRows()).length, 2);

  /* Värav ilma koostamata (marsruut teeb selle enne sageduspiiri): sama otsus mis koostamisel. */
  assert.deepEqual(prepareHomeCareExport(lead, { reasonCode: 'authority' }, { env: ENV }), { reasonCode: 'AUTHORITY' });
  assert.throws(() => prepareHomeCareExport(bert, { reasonCode: 'BACKUP' }, { env: ENV }), (error) => error.status === 403 && error.messageKey === 'home_care.errors.export_whole_org_only');
  assert.throws(() => prepareHomeCareExport(lead, {}, { env: ENV }), (error) => error.status === 400);

  /* ÜKS KORRAGA asutuse kohta: teine samaaegne katse saab vea, mitte teist ühendust ja mälu.
     Pärast esimese lõppu (ka pärast viga) saab jälle teha. */
  const together = await Promise.allSettled([
    createHomeCareExport(lead, { reasonCode: 'BACKUP' }, deps()),
    createHomeCareExport(lead, { reasonCode: 'BACKUP' }, deps())
  ]);
  assert.deepEqual(together.map((outcome) => outcome.status), ['fulfilled', 'rejected']);
  assert.deepEqual([together[1].reason.status, together[1].reason.messageKey], [409, 'home_care.errors.export_in_progress']);
  assert.equal((await exportRows()).length, 3);
  /* Teise asutuse väljavõte samal ajal on lubatud. */
  const both = await Promise.allSettled([
    createHomeCareExport(lead, { reasonCode: 'BACKUP' }, deps()),
    createHomeCareExport(leadB, { reasonCode: 'BACKUP' }, deps())
  ]);
  assert.deepEqual(both.map((outcome) => outcome.status), ['fulfilled', 'fulfilled']);

  /* Ilma etteantud kellata on `generatedAt` võetud hetktõmmise ajal: midagi hilisemat failis ei ole. */
  const before = Date.now();
  const timed = read(await createHomeCareExport(lead, { reasonCode: 'BACKUP' }, { db, env: ENV }));
  const stamp = Date.parse(timed.doc.generatedAt);
  assert.ok(stamp >= before && stamp <= Date.now());
  for (const key of ['clients', 'entries', 'accessLog', 'auditEvents']) {
    assert.ok(timed.doc[key].every((row) => Date.parse(row.createdAt) <= stamp), key);
  }

  /* Teise asutuse fail on tema oma. */
  const other = read(await createHomeCareExport(leadB, { reasonCode: 'BACKUP' }, deps()));
  assert.deepEqual(checkHomeCareExport(other.doc).problems, []);
  assert.deepEqual(other.doc.clients.map((row) => row.displayName), ['Võõras Klient']);
  assert.equal(other.text.includes('Linda Tamm'), false);
  assert.equal(other.doc.totals.accessLog, await db.careClientAccess.count({ where: { organizationId: f.orgB.id } }));
});

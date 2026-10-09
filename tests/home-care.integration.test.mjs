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
import { createActivity, listActivities, seedDefaultActivities, updateActivity } from '../lib/homeCare/activities.js';
import { activateCarePlan, discardCarePlanDraft, getCarePlanEditor, getCarePlans, saveCarePlanDraft } from '../lib/homeCare/carePlans.js';
import { CARE_ACTIVITY_GROUPS } from '../lib/homeCare/constants.js';
import { getDeadlines } from '../lib/homeCare/deadlines.js';
import { createDecision, getDecisionEditor, getDecisions, retractDecision, updateDecision } from '../lib/homeCare/decisions.js';
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
import { getMonthSummary } from '../lib/homeCare/provided.js';
import { createAbsence, getAbsences, removeAbsence, updateAbsence } from '../lib/homeCare/absences.js';
import { cancelVisit, getDayPlan, getMyDay, getWeekPlan, moveVisit, restoreVisit } from '../lib/homeCare/dayPlan.js';
import { changeSlot, createSlots, endSlot, getClientSlots, getSlotEditor } from '../lib/homeCare/slots.js';
import { handleObstacle, reportObstacle, withdrawObstacle } from '../lib/homeCare/obstacles.js';
import { clearWorkNature, setWorkNature } from '../lib/homeCare/workNature.js';
import { addPrecondition, closePrecondition } from '../lib/homeCare/preconditions.js';
import { addKey, closeKey, getKeyRegister, handOverKey } from '../lib/homeCare/keys.js';
import { addMoneyEntry, retractMoneyEntry } from '../lib/homeCare/money.js';
import { markSupply, trackSupply, untrackSupply } from '../lib/homeCare/supplies.js';
import { saveDoorSteps } from '../lib/homeCare/doorSteps.js';
import { handleChangeSignal, saveUsualState } from '../lib/homeCare/changes.js';
import { clearCrisisProfile, getCrisisList, setCrisisProfile } from '../lib/homeCare/crisis.js';
import { getReferralContacts, saveReferralContacts } from '../lib/homeCare/referralContacts.js';
import { addWorkerRecord, endWorkerRecord, getWorkerCards } from '../lib/homeCare/workerRecords.js';
import { getFridgeSheet } from '../lib/homeCare/fridgeSheet.js';
import { getMonthOpenItems } from '../lib/homeCare/monthClose.js';
import { endRelative, saveRelative } from '../lib/homeCare/relatives.js';
import { composeNoAnswerText } from '../lib/homeCare/noAnswerText.js';
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
  await expectError(setClientStatus(lead, client.id, { version: 4, status: 'ENDED', statusReason: 'DIED', statusNote: 'Tütar helistas' }, deps()), 409, 'home_care.errors.version_conflict');
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
  /* Toimingute kataloog (K2-a) ja hoolduskava (K2-b), et väljavõttes oleksid ka need kogud. */
  const exportCatalogue = (await seedDefaultActivities(lead, deps())).activities;
  const exportDraft = (
    await saveCarePlanDraft(lead, northClient.id, { goals: 'Kodus edasi elada.', lines: [{ activityId: exportCatalogue[0].id, frequencyKind: 'WEEKLY', frequencyCount: 1, mode: 'TOGETHER' }] }, deps())
  ).draft;
  await activateCarePlan(lead, northClient.id, { version: exportDraft.version }, deps());
  /* Käigu kirje (K2-d): tehtud toiming kirje küljes, et väljavõttes oleks ka see kogu. */
  await createEntry(lead, northClient.id, { visitMinutes: 30, activities: [{ activityId: exportCatalogue[0].id, mode: 'TOGETHER' }] }, deps());
  /* Käigumuster (K3-a): korduv käik meeskonna liikmele, et väljavõttes oleks ka see kogu. */
  const exportSlot = (await createSlots(lead, northClient.id, { weekdays: [1], startTime: '09:00', plannedMinutes: 45, workerMembershipId: f.members.cover.id }, deps())).slots[0];
  /* Puudumine (K3-c): meeskonna liikme tulevane plaaniline puudumine. */
  await createAbsence(lead, { membershipId: f.members.cover.id, fromDay: '2026-10-20', toDay: '2026-10-21', kind: 'PLANNED' }, deps());
  await setWorkNature(lead, client.id, { kinds: ['PHYSICAL'], reason: 'Tõstmine ilma tõstukita.' }, deps());
  await addPrecondition(lead, client.id, { kind: 'CLEANING', responsible: 'Linna sotsiaaltöötaja' }, deps());
  await addKey(lead, client.id, { tag: '5', holderMembershipId: f.members.anu.id }, deps());
  await addMoneyEntry(anu, client.id, { kind: 'RECEIVED', amount: '10' }, deps());
  const trackedSupply = await trackSupply(lead, client.id, { kind: 'FIREWOOD', responsible: 'Poeg' }, deps());
  await markSupply(anu, client.id, trackedSupply.supplyId, { state: 'LOW' }, deps());
  await saveDoorSteps(lead, client.id, { steps: ['Koputa aknale'] }, deps());
  /* Tavaline seis ja märkamine (K5-a), et väljavõttes oleksid ka need kogud. */
  await saveUsualState(lead, client.id, { areas: { MOOD: 'Jutukas' } }, deps());
  await db.careChangeSignal.create({ data: { organizationId: f.orgA.id, clientId: client.id, area: 'MOOD', reason: 'MAJOR' } });
  /* Kriisivalmidus (K5-b), et väljavõttes oleks ka see kogu. */
  await setCrisisProfile(lead, client.id, { level: 'DAILY', dependencies: ['HEATING'] }, deps());
  /* Loend „kuhu suunata" (K5-c), et väljavõttes oleks ka see kogu. */
  await saveReferralContacts(lead, { contacts: [{ name: 'Valla sotsiaaltöötaja', phone: '5555 1234' }] }, deps());
  /* Töötaja kaardi rida (K5-e), et väljavõttes oleks ka see kogu. */
  await addWorkerRecord(lead, { membershipId: f.members.anu.id, kind: 'BACKGROUND_CHECK', doneOn: '2026-01-10' }, deps());
  /* Lähedane ja jagamisaste (K5-k), et väljavõttes oleks ka see kogu. */
  await saveRelative(lead, client.id, { name: 'Mari Tamm', relation: 'tütar', level: 1 }, deps());
  const obstacleOfAnu = await reportObstacle(anu, { kind: 'LATE_30' }, deps());
  await handleObstacle(lead, obstacleOfAnu.obstacle.id, {}, deps());
  /* Ühe päeva erand (K3-b): järgmise esmaspäeva käik jääb ära. */
  await cancelVisit(lead, northClient.id, exportSlot.id, { day: '2026-10-12', reason: 'OTHER' }, deps());
  /* Otsus ja maht (K2-c), et väljavõttes oleks ka see kogu. */
  await createDecision(lead, northClient.id, { kind: 'ACT', validFrom: '2026-09-01', volumeHours: '6,5', volumePeriod: 'WEEK' }, deps());
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
    activities: await db.careActivity.count({ where: ofOrg }),
    carePlans: await db.carePlan.count({ where: ofOrg }),
    carePlanLines: await db.carePlanLine.count({ where: { plan: ofOrg } }),
    decisions: await db.careDecision.count({ where: ofOrg }),
    entryActivities: await db.careEntryActivity.count({ where: ofOrg }),
    visitSlots: await db.careVisitSlot.count({ where: ofOrg }),
    visitChanges: await db.careVisitChange.count({ where: ofOrg }),
    absences: await db.careAbsence.count({ where: ofOrg }),
    obstacles: await db.careObstacle.count({ where: ofOrg }),
    workNatures: await db.careWorkNature.count({ where: ofOrg }),
    preconditions: await db.carePrecondition.count({ where: ofOrg }),
    keys: await db.careKey.count({ where: ofOrg }),
    keyHandovers: await db.careKeyHandover.count({ where: ofOrg }),
    moneyEntries: await db.careMoneyEntry.count({ where: ofOrg }),
    supplies: await db.careClientSupply.count({ where: ofOrg }),
    supplyChecks: await db.careSupplyCheck.count({ where: ofOrg }),
    doorSteps: await db.careDoorStep.count({ where: ofOrg }),
    usualStates: await db.careUsualState.count({ where: ofOrg }),
    changeSignals: await db.careChangeSignal.count({ where: ofOrg }),
    crisisProfiles: await db.careCrisisProfile.count({ where: ofOrg }),
    referralContacts: await db.careReferralContact.count({ where: ofOrg }),
    workerRecords: await db.careWorkerRecord.count({ where: ofOrg }),
    clientRelatives: await db.careClientRelative.count({ where: ofOrg }),
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

test('toimingute kataloog: määruse rühmad, asutuse oma sõnastus, õigused ja arhiveerimine', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  /* Anu on hooldaja alles siis, kui ta on mõne kliendi meeskonnas. */
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());

  /* Asutuse töötaja, kes ei ole hooldaja, kataloogi ei näe (404, mitte 403). */
  await expectError(listActivities(anu, {}, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(listActivities(clerk, {}, deps()), 404, 'home_care.errors.client_not_found');
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());

  /* Tühi algus: hooldaja loeb, muuta ei saa. */
  assert.deepEqual(await listActivities(anu, {}, deps()), { activities: [], canEdit: false });
  await expectError(createActivity(anu, { group: 'HEATING', name: 'Ahju kütmine' }, deps()), 403, 'org.errors.missing_capability');
  await expectError(seedDefaultActivities(anu, deps()), 403, 'org.errors.missing_capability');

  /* ALGNE LOEND: üks toiming iga määruse rühma kohta, määruse sõnastuses ja järjekorras. */
  const seeded = await seedDefaultActivities(lead, deps());
  assert.equal(seeded.activities.length, 16);
  assert.deepEqual(seeded.activities.map((item) => item.group), [...CARE_ACTIVITY_GROUPS]);
  assert.deepEqual(seeded.activities.slice(0, 2).map((item) => [item.domain, item.name]), [
    ['HOME_HELP', 'Sisseostude tegemine ja koju toomine'],
    ['HOME_HELP', 'Teenuste kasutamine ja asjaajamine']
  ]);
  assert.equal(seeded.activities[15].domain, 'PERSONAL_HELP');
  /* Teist korda algset loendit peale ei kirjutata. */
  await expectError(seedDefaultActivities(lead, deps()), 409, 'home_care.errors.activity_catalogue_not_empty');

  /* ASUTUSE OMA TOIMING oma sõnadega, rühma lõppu. */
  await expectError(createActivity(lead, { group: 'HEATING' }, deps()), 400, 'home_care.errors.activity_name_required');
  await expectError(createActivity(lead, { name: 'Ahju kütmine' }, deps()), 400, 'home_care.errors.activity_group_required');
  await expectError(createActivity(lead, { group: 'KÜTE', name: 'Ahju kütmine' }, deps()), 400, 'home_care.errors.activity_group_required');
  const wood = (await createActivity(lead, { group: 'HEATING', name: '  Puude tuppa toomine ja  tuha väljaviimine ', note: 'Talvel iga käik.' }, deps())).activity;
  assert.deepEqual([wood.group, wood.domain, wood.name, wood.note, wood.position, wood.version], ['HEATING', 'HOME_HELP', 'Puude tuppa toomine ja tuha väljaviimine', 'Talvel iga käik.', 1, 1]);
  /* Sama nimi teist korda (suur- ja väiketähte eristamata) on viga, mitte teine rida. */
  await expectError(createActivity(lead, { group: 'HOUSEKEEPING', name: 'puude tuppa toomine ja tuha väljaviimine' }, deps()), 409, 'home_care.errors.activity_name_taken');

  /* MUUTMINE: versiooniga; vana versioon ei kirjuta üle. */
  const renamed = (await updateActivity(lead, wood.id, { version: 1, name: 'Puude toomine ja tuha väljaviimine' }, deps())).activity;
  assert.deepEqual([renamed.name, renamed.note, renamed.version], ['Puude toomine ja tuha väljaviimine', 'Talvel iga käik.', 2]);
  await expectError(updateActivity(lead, wood.id, { version: 1, name: 'Vana aken' }, deps()), 409, 'home_care.errors.version_conflict');
  await expectError(updateActivity(anu, wood.id, { version: 2, name: 'Hooldaja' }, deps()), 403, 'org.errors.missing_capability');
  /* Teise asutuse hooldusjuht ei näe ega muuda. */
  await expectError(updateActivity(leadB, wood.id, { version: 2, name: 'Võõras' }, deps()), 404, 'home_care.errors.activity_not_found');
  assert.deepEqual((await listActivities(leadB, { includeArchived: true }, deps())).activities, []);

  /* ARHIVEERIMINE: toiming kaob loendist, nimi vabaneb; muutja näeb arhiivi, hooldaja mitte. */
  const archived = (await updateActivity(lead, wood.id, { version: 2, archived: true }, deps())).activity;
  assert.ok(archived.archivedAt);
  assert.equal((await listActivities(anu, { includeArchived: true }, deps())).activities.length, 16);
  assert.equal((await listActivities(lead, {}, deps())).activities.length, 16);
  assert.equal((await listActivities(lead, { includeArchived: true }, deps())).activities.length, 17);
  const again = (await createActivity(lead, { group: 'HEATING', name: 'Puude toomine ja tuha väljaviimine' }, deps())).activity;
  /* Taastamine ei tohi tekitada kahte kehtivat sama nimega toimingut. */
  await expectError(updateActivity(lead, wood.id, { version: 3, archived: false }, deps()), 409, 'home_care.errors.activity_name_taken');
  await updateActivity(lead, again.id, { version: 1, archived: true }, deps());
  const restored = (await updateActivity(lead, wood.id, { version: 3, archived: false }, deps())).activity;
  assert.equal(restored.archivedAt, null);

  /* Andmebaas hoiab vigase rea eemal. */
  const raw = (data) => db.careActivity.create({ data: { organizationId: f.orgA.id, ...data } });
  await assert.rejects(raw({ group: 'KÜTE', name: 'Midagi' }), /CareActivity_group_check/);
  await assert.rejects(raw({ group: 'HEATING', name: '   ' }), /CareActivity_name_check/);

  /* AUDIT: mis muutus ja mis toiming, mitte toimingu nimi. */
  const audit = await db.dataAuditLog.findMany({
    where: { action: 'org.home_care_activity_changed', meta: { path: ['organizationId'], equals: f.orgA.id } },
    orderBy: { createdAt: 'asc' }
  });
  assert.deepEqual(audit.map((row) => row.meta.change), ['seeded', 'created', 'updated', 'archived', 'created', 'archived', 'restored']);
  for (const row of audit) {
    assert.ok(Object.keys(row.meta).every((key) => ['organizationId', 'activityId', 'change'].includes(key)), JSON.stringify(row.meta));
    assert.equal(JSON.stringify(row.meta).includes('Puude'), false);
  }
});

test('hoolduskava: mustand, kehtestamine, asendamine, õigused ja lugemine', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  const catalogue = (await seedDefaultActivities(lead, deps())).activities;
  const byGroup = (group) => catalogue.find((item) => item.group === group);
  const heating = byGroup('HEATING');
  const hygiene = byGroup('HYGIENE');
  const medication = byGroup('MEDICATION');
  const line = (activity, extra = {}) => ({ activityId: activity.id, frequencyKind: 'WEEKLY', frequencyCount: 3, mode: 'TOGETHER', ...extra });

  /* Algus: kava ei ole; meeskond loeb, mustandit ei näe ega tee. */
  assert.deepEqual(await getCarePlans(anu, client.id, deps()), { active: null, draft: null, history: [], canEdit: false });
  assert.equal((await openClient(anu, client.id, deps())).plan, null);
  await expectError(saveCarePlanDraft(anu, client.id, { lines: [line(heating)] }, deps()), 403, 'org.errors.missing_capability');
  /* Meeskonda mittekuuluv hooldaja ja teise asutuse hooldusjuht klienti ei näe. */
  await expectError(getCarePlans(bert, client.id, deps()), 404);
  await expectError(getCarePlans(leadB, client.id, deps()), 404);
  await expectError(saveCarePlanDraft(leadB, client.id, { lines: [] }, deps()), 404);

  /* Vigane rida ei salvestu. */
  await expectError(saveCarePlanDraft(lead, client.id, { lines: [{ activityId: heating.id, frequencyKind: 'WEEKLY', mode: 'TOGETHER' }] }, deps()), 400, 'home_care.errors.plan_frequency_count_invalid');
  await expectError(saveCarePlanDraft(lead, client.id, { lines: [line(heating, { frequencyCount: 61 })] }, deps()), 400, 'home_care.errors.plan_frequency_count_invalid');
  await expectError(saveCarePlanDraft(lead, client.id, { lines: [line(heating, { mode: 'ALONE' })] }, deps()), 400, 'home_care.errors.plan_mode_required');
  await expectError(saveCarePlanDraft(lead, client.id, { lines: [line(heating, { frequencyKind: 'YEARLY' })] }, deps()), 400, 'home_care.errors.plan_frequency_required');
  await expectError(saveCarePlanDraft(lead, client.id, { lines: [line(heating), line(heating)] }, deps()), 400, 'home_care.errors.plan_activity_repeated');
  await expectError(saveCarePlanDraft(lead, client.id, { lines: [{ ...line(heating), activityId: 'cmolematutoiming000000000' }] }, deps()), 400, 'home_care.errors.plan_activity_unknown');
  assert.equal(await db.carePlan.count({ where: { clientId: client.id } }), 0);

  /* MUSTAND: eesmärgid, ülevaatuse päev ja read; toimingu nimi ja rühm tulevad kataloogist. */
  let draft = (
    await saveCarePlanDraft(
      lead,
      client.id,
      {
        goals: '  Linda tahab kodus edasi elada ja ise süüa teha. ',
        reviewOn: '2027-04-01',
        lines: [
          line(heating, { frequencyNote: 'E, K, R hommikul', critical: true, note: 'Talvel iga käik.' }),
          line(hygiene, { frequencyKind: 'DAILY', frequencyCount: 1, mode: 'GUIDE' }),
          { activityId: medication.id, frequencyKind: 'AS_NEEDED', frequencyCount: 9, mode: 'GUIDE' }
        ]
      },
      deps()
    )
  ).draft;
  assert.deepEqual([draft.number, draft.status, draft.version, draft.goals, draft.reviewOn], [1, 'DRAFT', 1, 'Linda tahab kodus edasi elada ja ise süüa teha.', '2027-04-01']);
  assert.deepEqual(
    draft.lines.map((item) => [item.activityName, item.activityGroup, item.frequencyKind, item.frequencyCount, item.mode, item.critical]),
    [
      [heating.name, 'HEATING', 'WEEKLY', 3, 'TOGETHER', true],
      [hygiene.name, 'HYGIENE', 'DAILY', 1, 'GUIDE', false],
      /* „Vajadusel" on ilma arvuta, ka siis, kui arv saadeti. */
      [medication.name, 'MEDICATION', 'AS_NEEDED', null, 'GUIDE', false]
    ]
  );
  /* Mustand ei ole meeskonnale näha ja kliendi lehel kava veel ei ole. */
  assert.equal((await getCarePlans(anu, client.id, deps())).draft, null);
  assert.equal((await openClient(anu, client.id, deps())).plan, null);

  /* Muutmine nõuab nähtud versiooni; salvestus asendab read tervikuna. */
  await expectError(saveCarePlanDraft(lead, client.id, { lines: [line(heating)] }, deps()), 400, 'home_care.errors.version_required');
  await expectError(saveCarePlanDraft(lead, client.id, { version: 7, lines: [line(heating)] }, deps()), 409, 'home_care.errors.version_conflict');
  draft = (await saveCarePlanDraft(lead, client.id, { version: 1, goals: draft.goals, reviewOn: draft.reviewOn, lines: [line(heating), line(hygiene, { frequencyKind: 'DAILY', frequencyCount: 1, mode: 'GUIDE' })] }, deps())).draft;
  assert.deepEqual([draft.version, draft.lines.length], [2, 2]);
  assert.equal(await db.carePlan.count({ where: { clientId: client.id } }), 1);

  /* KEHTESTAMINE: mustandist saab kehtiv kava; meeskond näeb seda kliendi lehel. */
  await expectError(activateCarePlan(anu, client.id, { version: 2 }, deps()), 403, 'org.errors.missing_capability');
  await expectError(activateCarePlan(lead, client.id, { version: 1 }, deps()), 409, 'home_care.errors.version_conflict');
  const first = await activateCarePlan(lead, client.id, { version: 2 }, deps());
  assert.deepEqual([first.active.number, first.active.status, first.draft, first.history.length], [1, 'ACTIVE', null, 0]);
  assert.ok(first.active.activatedAt && first.active.activatedByName);
  const seen = (await openClient(anu, client.id, deps())).plan;
  assert.deepEqual([seen.number, seen.goals, seen.lines.length], [1, 'Linda tahab kodus edasi elada ja ise süüa teha.', 2]);
  await expectError(activateCarePlan(lead, client.id, { version: 3 }, deps()), 404, 'home_care.errors.plan_draft_not_found');

  /* Kataloogis ümber nimetatud toiming ei muuda kehtivat kava. */
  await updateActivity(lead, heating.id, { version: heating.version, name: 'Puude toomine ja ahju kütmine' }, deps());
  assert.equal((await openClient(anu, client.id, deps())).plan.lines[0].activityName, heating.name);

  /* UUS KAVA: mustand number 2; tühja kava ei kehtestata; kehtestamine asendab eelmise, mis jääb alles. */
  const empty = (await saveCarePlanDraft(lead, client.id, { lines: [] }, deps())).draft;
  assert.deepEqual([empty.number, empty.lines.length], [2, 0]);
  await expectError(activateCarePlan(lead, client.id, { version: 1 }, deps()), 400, 'home_care.errors.plan_empty');
  const second = (await saveCarePlanDraft(lead, client.id, { version: 1, reviewOn: '2027-10-01', lines: [line(heating, { frequencyKind: 'DAILY', frequencyCount: 2, mode: 'FOR' })] }, deps())).draft;
  /* Uus rida kannab toimingu uut nime. */
  assert.equal(second.lines[0].activityName, 'Puude toomine ja ahju kütmine');
  const replaced = await activateCarePlan(lead, client.id, { version: 2 }, deps());
  assert.deepEqual([replaced.active.number, replaced.active.lines.length, replaced.history.map((item) => [item.number, item.lineCount])], [2, 1, [[1, 2]]]);
  assert.ok(replaced.history[0].replacedAt);
  assert.deepEqual(
    (await db.carePlan.findMany({ where: { clientId: client.id }, orderBy: { number: 'asc' }, select: { number: true, status: true } })).map((row) => [row.number, row.status]),
    [[1, 'REPLACED'], [2, 'ACTIVE']]
  );

  /* Arhiveeritud toimingut uude kavasse panna ei saa. */
  await updateActivity(lead, hygiene.id, { version: hygiene.version, archived: true }, deps());
  await expectError(saveCarePlanDraft(lead, client.id, { lines: [line(hygiene)] }, deps()), 400, 'home_care.errors.plan_activity_unknown');

  /* MUSTANDI ÄRAVISKAMINE ei puuduta kehtivat kava. */
  const third = (await saveCarePlanDraft(lead, client.id, { lines: [line(medication)] }, deps())).draft;
  await expectError(discardCarePlanDraft(anu, client.id, { version: third.version }, deps()), 403, 'org.errors.missing_capability');
  assert.deepEqual(await discardCarePlanDraft(lead, client.id, { version: third.version }, deps()), { draft: null });
  assert.equal((await getCarePlans(lead, client.id, deps())).active.number, 2);

  /* Kava koostamise vaade: klient, kehtiv kava, varasemad ja kehtivad toimingud (arhiveeritut ei ole). */
  const editor = await getCarePlanEditor(lead, client.id, deps());
  assert.deepEqual([editor.client.displayName, editor.active.number, editor.draft, editor.history.length, editor.activities.length], ['Linda Tamm', 2, null, 1, 15]);
  await expectError(getCarePlanEditor(anu, client.id, deps()), 403, 'org.errors.missing_capability');

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const plan = (data) => db.carePlan.create({ data: { organizationId: f.orgA.id, clientId: client.id, number: 9, ...data } });
  await assert.rejects(plan({ status: 'ACTIVE', activatedAt: new Date() }), /CarePlan_clientId_active_key|Unique constraint/);
  await assert.rejects(plan({ status: 'ACTIVE' }), /CarePlan_state_check/);
  await assert.rejects(plan({ status: 'DRAFT', activatedAt: new Date() }), /CarePlan_state_check/);
  await assert.rejects(plan({ status: 'REPLACED', activatedAt: new Date() }), /CarePlan_state_check/);
  await assert.rejects(plan({ status: 'CLOSED' }), /CarePlan_(status|state)_check/);
  const activeId = (await db.carePlan.findFirst({ where: { clientId: client.id, status: 'ACTIVE' }, select: { id: true } })).id;
  const row = (data) => db.carePlanLine.create({ data: { planId: activeId, clientId: client.id, activityName: 'Proov', activityGroup: 'HEATING', frequencyKind: 'WEEKLY', frequencyCount: 1, mode: 'FOR', ...data } });
  await assert.rejects(row({ frequencyCount: null }), /CarePlanLine_frequency_check/);
  await assert.rejects(row({ frequencyKind: 'AS_NEEDED' }), /CarePlanLine_frequency_check/);
  await assert.rejects(row({ frequencyCount: 61 }), /CarePlanLine_frequency_check/);
  await assert.rejects(row({ mode: 'ALONE' }), /CarePlanLine_mode_check/);
  await assert.rejects(row({ activityGroup: 'KÜTE' }), /CarePlanLine_activityGroup_check/);
  await assert.rejects(row({ activityId: heating.id }), /CarePlanLine_planId_activityId_key|Unique constraint/);

  /* AUDIT: kehtestamine jätab rea ainult ID-dega. */
  const audit = await db.dataAuditLog.findMany({
    where: { action: 'org.home_care_plan_activated', meta: { path: ['organizationId'], equals: f.orgA.id } },
    orderBy: { createdAt: 'asc' }
  });
  assert.equal(audit.length, 2);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['clientId', 'organizationId', 'planId']);
});

test('otsus ja maht: sisestamine, kehtiv otsus, parandamine, tühistamine ja õigused', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  const { client: other } = await createClient(lead, { displayName: 'Teine Klient' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  const input = {
    kind: 'ACT',
    issuerName: '  Haapsalu   Linnavalitsus ',
    documentNumber: '12-3/45',
    decidedOn: '2026-08-25',
    validFrom: '2026-09-01',
    validUntil: '2026-12-31',
    volumeHours: '6,5',
    volumePeriod: 'WEEK',
    feeNote: 'tasuta',
    note: 'Lisaks toidu kojutoomine.'
  };

  /* Algus: otsust ei ole. Tänane päev on asutuse ajavööndi päev. */
  assert.deepEqual(await getDecisions(anu, client.id, deps()), { today: '2026-10-09', current: null, decisions: [], canEdit: false });
  assert.equal((await openClient(anu, client.id, deps())).decision, null);

  /* Sisestab ainult hooldusjuht; meeskonda mittekuuluv ja teise asutuse juht klienti ei näe. */
  await expectError(createDecision(anu, client.id, input, deps()), 403, 'org.errors.missing_capability');
  await expectError(getDecisions(bert, client.id, deps()), 404);
  await expectError(createDecision(leadB, client.id, input, deps()), 404);

  /* Vigane sisend ei salvestu. */
  const bad = (patch, key) => expectError(createDecision(lead, client.id, { ...input, ...patch }, deps()), 400, key);
  await bad({ kind: 'ORDER' }, 'home_care.errors.decision_kind_required');
  await bad({ validFrom: '' }, 'home_care.errors.decision_valid_from_required');
  await bad({ validFrom: '2026-02-30' }, 'home_care.errors.invalid_date');
  await bad({ validUntil: '2026-08-31' }, 'home_care.errors.decision_period_invalid');
  await bad({ volumeHours: 'palju' }, 'home_care.errors.decision_volume_invalid');
  await bad({ volumeHours: '0' }, 'home_care.errors.decision_volume_invalid');
  await bad({ volumeHours: '6.555' }, 'home_care.errors.decision_volume_invalid');
  await bad({ volumeHours: '169' }, 'home_care.errors.decision_volume_invalid');
  await bad({ volumePeriod: 'YEAR' }, 'home_care.errors.decision_volume_period_required');
  assert.equal(await db.careDecision.count({ where: { clientId: client.id } }), 0);

  /* SISESTAMINE: tunnid hoitakse minutites; päevi kehtivuse lõpuni on 83 (9.10 → 31.12). */
  const made = await createDecision(lead, client.id, input, deps());
  assert.deepEqual(
    [made.current.id, made.current.kind, made.current.issuerName, made.current.documentNumber, made.current.decidedOn],
    [made.decisionId, 'ACT', 'Haapsalu Linnavalitsus', '12-3/45', '2026-08-25']
  );
  assert.deepEqual(
    [made.current.validFrom, made.current.validUntil, made.current.volumeMinutes, made.current.volumePeriod, made.current.state, made.current.daysLeft],
    ['2026-09-01', '2026-12-31', 390, 'WEEK', 'IN_FORCE', 83]
  );
  assert.deepEqual([made.current.feeNote, made.current.note, made.current.version, made.decisions.length], ['tasuta', 'Lisaks toidu kojutoomine.', 1, 1]);
  assert.ok(made.current.createdByName);

  /* Meeskond näeb kehtivat otsust (ka kliendi lehel), aga mitte otsuste loendit. */
  const seen = await getDecisions(anu, client.id, deps());
  assert.deepEqual([seen.current.id, seen.decisions, seen.canEdit], [made.decisionId, [], false]);
  assert.equal((await openClient(anu, client.id, deps())).decision.volumeMinutes, 390);

  /* Tulevane tähtajatu haldusleping ilma mahuta: kehtiv otsus ei muutu, loend on uuem ees. */
  const next = await createDecision(lead, client.id, { kind: 'CONTRACT', validFrom: '2027-01-01' }, deps());
  assert.equal(next.current.id, made.decisionId);
  assert.deepEqual(
    next.decisions.map((row) => [row.kind, row.state, row.validUntil, row.volumeMinutes, row.volumePeriod, row.daysLeft]),
    [
      ['CONTRACT', 'UPCOMING', null, null, null, null],
      ['ACT', 'IN_FORCE', '2026-12-31', 390, 'WEEK', 83]
    ]
  );
  /* Mahu väli tühi: perioodi ei küsita ega salvestata. */
  assert.equal((await db.careDecision.findUnique({ where: { id: next.decisionId } })).volumePeriod, null);

  /* PARANDAMINE nõuab nähtud versiooni ja hooldusjuhti. */
  await expectError(updateDecision(lead, client.id, made.decisionId, input, deps()), 400, 'home_care.errors.version_required');
  await expectError(updateDecision(lead, client.id, made.decisionId, { ...input, version: 7 }, deps()), 409, 'home_care.errors.version_conflict');
  await expectError(updateDecision(anu, client.id, made.decisionId, { ...input, version: 1 }, deps()), 403, 'org.errors.missing_capability');
  await expectError(updateDecision(leadB, client.id, made.decisionId, { ...input, version: 1 }, deps()), 404);
  /* Teise kliendi kaudu sama otsust muuta ei saa. */
  await expectError(updateDecision(lead, other.id, made.decisionId, { ...input, version: 1 }, deps()), 404, 'home_care.errors.decision_not_found');
  const edited = await updateDecision(lead, client.id, made.decisionId, { ...input, version: 1, volumeHours: 20, volumePeriod: 'MONTH', validUntil: null }, deps());
  assert.deepEqual(
    [edited.current.volumeMinutes, edited.current.volumePeriod, edited.current.validUntil, edited.current.daysLeft, edited.current.version],
    [1200, 'MONTH', null, null, 2]
  );

  /* Kattuv ajutine lisaotsus: kehtivaks loetakse hiliseima algusega otsus. */
  const extra = await createDecision(lead, client.id, { kind: 'ACT', validFrom: '2026-10-01', validUntil: '2026-10-31', volumeHours: '10', volumePeriod: 'WEEK' }, deps());
  assert.deepEqual([extra.current.id, extra.current.volumeMinutes, extra.current.daysLeft], [extra.decisionId, 600, 22]);

  /* TÜHISTAMINE: rida jääb alles, kehtivaks saab uuesti eelmine otsus. */
  await expectError(retractDecision(anu, client.id, extra.decisionId, { version: 1 }, deps()), 403, 'org.errors.missing_capability');
  await expectError(retractDecision(lead, client.id, extra.decisionId, {}, deps()), 400, 'home_care.errors.version_required');
  await expectError(retractDecision(lead, client.id, extra.decisionId, { version: 4 }, deps()), 409, 'home_care.errors.version_conflict');
  const retracted = await retractDecision(lead, client.id, extra.decisionId, { version: 1 }, deps());
  assert.equal(retracted.current.id, made.decisionId);
  const gone = retracted.decisions.find((row) => row.id === extra.decisionId);
  assert.deepEqual([gone.state, gone.daysLeft, Boolean(gone.retractedAt), Boolean(gone.retractedByName)], ['RETRACTED', null, true, true]);
  await expectError(retractDecision(lead, client.id, extra.decisionId, { version: 2 }, deps()), 409, 'home_care.errors.decision_retracted');
  await expectError(updateDecision(lead, client.id, extra.decisionId, { ...input, version: 2 }, deps()), 409, 'home_care.errors.decision_retracted');
  assert.equal(await db.careDecision.count({ where: { clientId: client.id } }), 3);

  /* Otsuste lehe algseis on hooldusjuhile; meeskonna liikmele 403 (leht teeb sellest 404). */
  const editor = await getDecisionEditor(lead, client.id, deps());
  assert.deepEqual([editor.client.displayName, editor.today, editor.current.id, editor.decisions.length, editor.canEdit], ['Linda Tamm', '2026-10-09', made.decisionId, 3, true]);
  await expectError(getDecisionEditor(anu, client.id, deps()), 403, 'org.errors.missing_capability');

  /* Seis sõltub päevast: 2027. aasta jaanuaris kehtib juba haldusleping. */
  const later = await getDecisions(lead, client.id, deps(at('2027-01-05T08:00:00Z')));
  assert.deepEqual([later.today, later.current.id], ['2027-01-05', next.decisionId]);

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) => db.careDecision.create({ data: { organizationId: f.orgA.id, clientId: client.id, kind: 'ACT', validFrom: '2026-01-01', ...data } });
  await assert.rejects(raw({ kind: 'ORDER' }), /CareDecision_kind_check/);
  await assert.rejects(raw({ validFrom: '01.01.2026' }), /CareDecision_days_check/);
  await assert.rejects(raw({ decidedOn: 'eile' }), /CareDecision_days_check/);
  await assert.rejects(raw({ validUntil: '2025-12-31' }), /CareDecision_period_check/);
  await assert.rejects(raw({ volumeMinutes: 60 }), /CareDecision_volume_check/);
  await assert.rejects(raw({ volumePeriod: 'WEEK' }), /CareDecision_volume_check/);
  await assert.rejects(raw({ volumeMinutes: 10081, volumePeriod: 'WEEK' }), /CareDecision_volume_check/);
  await assert.rejects(raw({ volumeMinutes: 0, volumePeriod: 'MONTH' }), /CareDecision_volume_check/);
  await assert.rejects(raw({ volumeMinutes: 60, volumePeriod: 'YEAR' }), /CareDecision_volume_check/);

  /* AUDIT: iga muutus jätab rea ainult ID-de ja muutuse liigiga. */
  const audit = await db.dataAuditLog.findMany({
    where: { action: 'org.home_care_decision_changed', meta: { path: ['organizationId'], equals: f.orgA.id } },
    orderBy: { createdAt: 'asc' }
  });
  assert.deepEqual(audit.map((entry) => entry.meta.change).sort(), ['created', 'created', 'created', 'retracted', 'updated']);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'decisionId', 'organizationId']);
});

test('tähtajad: lõppevad otsused, otsuseta kliendid, ülevaatamist ootavad ja puuduvad kavad', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.bert.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const catalogue = (await seedDefaultActivities(lead, deps())).activities;
  const make = async (displayName, extra = {}) => (await createClient(lead, { displayName, ...extra }, deps())).client;
  const decide = (client, validFrom, validUntil) => createDecision(lead, client.id, { kind: 'ACT', validFrom, validUntil }, deps());
  const plan = async (client, reviewOn) => {
    const { draft } = await saveCarePlanDraft(
      lead,
      client.id,
      { reviewOn, lines: [{ activityId: catalogue[0].id, frequencyKind: 'WEEKLY', frequencyCount: 1, mode: 'TOGETHER' }] },
      deps()
    );
    await activateCarePlan(lead, client.id, { version: draft.version }, deps());
  };

  /* Täna on 09.10.2026. */
  const aino = await make('Aino Lõppev', { unitId: north.id }); // otsus lõpeb 20 päeva pärast, kava üle tähtaja
  await decide(aino, '2026-01-01', '2026-10-29');
  await plan(aino, '2026-10-01');
  const bruno = await make('Bruno Hiljem'); // otsus lõpeb 50 päeva pärast, kava ülevaatus 30 päeva pärast
  await decide(bruno, '2026-01-01', '2026-11-28');
  await plan(bruno, '2026-11-08');
  const celia = await make('Celia Kaetud'); // otsus lõpeb varsti, aga järgmine on sisestatud; kava ülevaatus kaugel
  await decide(celia, '2026-01-01', '2026-10-20');
  await decide(celia, '2026-10-21', '2027-10-20');
  await plan(celia, '2027-03-01');
  const dora = await make('Dora Tähtajatu'); // tähtajatu otsus, kaval ülevaatuse päeva ei ole
  await decide(dora, '2026-01-01', null);
  await plan(dora, null);
  const eedi = await make('Eedi Lõppenud'); // otsus lõppes, uus algab hiljem; kava ei ole
  await decide(eedi, '2026-01-01', '2026-09-30');
  await decide(eedi, '2026-11-01', null);
  const fred = await make('Fred Uus'); // otsust ega kava ei ole; ajutiselt ära
  await setClientStatus(lead, fred.id, { version: 1, status: 'AWAY', statusReason: 'HOSPITAL' }, deps());
  const gerda = await make('Gerda Lõpetatud'); // lõppenud teenusega klienti ei loeta
  await setClientStatus(lead, gerda.id, { version: 1, status: 'ENDED', statusReason: 'MOVED' }, deps());
  const helju = await make('Helju Tühistatud'); // ainus otsus on tühistatud
  const mistake = await decide(helju, '2026-01-01', null);
  await retractDecision(lead, helju.id, mistake.decisionId, { version: 1 }, deps());
  await plan(helju, '2026-12-31');

  const view = await getDeadlines(lead, deps());
  assert.deepEqual([view.today, view.clientCount, view.truncated], ['2026-10-09', 7, false]);
  assert.deepEqual(
    view.decisionsEnding.map((item) => [item.client.displayName, item.validUntil, item.daysLeft, item.soon]),
    [
      ['Aino Lõppev', '2026-10-29', 20, true],
      ['Bruno Hiljem', '2026-11-28', 50, false]
    ]
  );
  assert.deepEqual(
    view.noDecision.map((item) => [item.client.displayName, item.client.status, item.lastEndedOn, item.nextFrom]),
    [
      ['Eedi Lõppenud', 'ACTIVE', '2026-09-30', '2026-11-01'],
      ['Fred Uus', 'AWAY', null, null],
      ['Helju Tühistatud', 'ACTIVE', null, null]
    ]
  );
  assert.deepEqual(
    view.plansDue.map((item) => [item.client.displayName, item.planNumber, item.reviewOn, item.daysLeft, item.overdue]),
    [
      ['Aino Lõppev', 1, '2026-10-01', -8, true],
      ['Bruno Hiljem', 1, '2026-11-08', 30, false]
    ]
  );
  assert.deepEqual(view.noPlan.map((item) => item.client.displayName), ['Eedi Lõppenud', 'Fred Uus']);

  /* Üksuse hooldusjuht näeb ainult oma üksuse kliente. */
  const scoped = await getDeadlines(bert, deps());
  assert.deepEqual(
    [scoped.clientCount, scoped.decisionsEnding.map((item) => item.client.displayName), scoped.noDecision, scoped.plansDue.length, scoped.noPlan],
    [1, ['Aino Lõppev'], [], 1, []]
  );
  /* Hooldaja ei ole hooldusjuht; teise asutuse juht näeb oma (tühja) asutust. */
  await expectError(getDeadlines(anu, deps()), 403, 'org.errors.missing_capability');
  const foreign = await getDeadlines(leadB, deps());
  assert.deepEqual([foreign.clientCount, foreign.decisionsEnding, foreign.noDecision, foreign.plansDue, foreign.noPlan], [0, [], [], [], []]);

  /* Päev hiljem kui Aino otsuse lõpp: ta on otsuseta klientide seas. */
  const after = await getDeadlines(lead, deps(at('2026-10-30T08:00:00Z')));
  assert.deepEqual(after.noDecision.map((item) => [item.client.displayName, item.lastEndedOn])[0], ['Aino Lõppev', '2026-10-29']);
});

test('käigu kirje: kestus, tehtud toimingud kavast ja kataloogist, kordussaatmine, parandus ja kronoloogia', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  const catalogue = (await seedDefaultActivities(lead, deps())).activities;
  const byGroup = (group) => catalogue.find((item) => item.group === group);
  const heating = byGroup('HEATING');
  const hygiene = byGroup('HYGIENE');
  const shopping = byGroup('SHOPPING');
  const laundry = byGroup('LAUNDRY');
  /* Kehtivas kavas on kütmine ja hügieen; ostud ja pesu on kataloogis, aga mitte kavas. */
  const { draft } = await saveCarePlanDraft(
    lead,
    client.id,
    {
      lines: [
        { activityId: heating.id, frequencyKind: 'DAILY', frequencyCount: 1, mode: 'FOR', critical: true },
        { activityId: hygiene.id, frequencyKind: 'WEEKLY', frequencyCount: 2, mode: 'ASSIST' }
      ]
    },
    deps()
  );
  await activateCarePlan(lead, client.id, { version: draft.version }, deps());
  const heatingLine = (await openClient(anu, client.id, deps())).plan.lines.find((line) => line.activityId === heating.id);
  const shape = (entry) => (entry.visit ? [entry.visit.minutes, entry.visit.activities.map((item) => [item.name, item.group, item.mode, item.outsidePlan])] : null);

  /* Vigane käigu kirje ei salvestu. */
  const bad = (input, key) => expectError(createEntry(anu, client.id, input, deps()), 400, key);
  await bad({ visitMinutes: 0, text: 'x' }, 'home_care.errors.visit_minutes_invalid');
  await bad({ activities: [{ activityId: 'cmv0olematutoiming00000000', mode: 'FOR' }] }, 'home_care.errors.visit_activity_unknown');
  await bad({ activities: [{ activityId: heating.id, mode: 'FOR' }, { activityId: heating.id, mode: 'GUIDE' }] }, 'home_care.errors.visit_activity_repeated');
  await bad({ activities: [{ activityId: heating.id, mode: 'ALONE' }] }, 'home_care.errors.visit_mode_required');
  await bad({ kind: 'HANDOVER', activities: [{ activityId: heating.id, mode: 'FOR' }] }, 'home_care.errors.entry_text_required');
  assert.equal(await db.careClientEntry.count({ where: { clientId: client.id } }), 0);

  /* TAVALINE KÄIK ILMA TEKSTITA: toiming kavast kannab kava sõnastust ja viidet kava reale;
     kavas puuduv toiming tuleb kataloogist ja on kavaväline. */
  const body = {
    visitMinutes: 45,
    activities: [
      { activityId: heating.id, mode: 'FOR' },
      { activityId: shopping.id, mode: 'TOGETHER' }
    ],
    clientRequestId: `visit-${f.tag}-1`
  };
  const made = await createEntry(anu, client.id, body, deps());
  const visit = made.entry;
  assert.deepEqual([made.created, visit.text, visit.kind, visit.contactMode], [true, '', 'NOTE', 'VISIT']);
  assert.deepEqual(shape(visit), [45, [[heating.name, 'HEATING', 'FOR', false], [shopping.name, 'SHOPPING', 'TOGETHER', true]]]);
  const stored = await db.careEntryActivity.findMany({ where: { entryId: visit.id }, orderBy: { position: 'asc' } });
  assert.deepEqual(
    stored.map((row) => [row.planLineId, row.activityId, row.outsidePlan, row.organizationId, row.clientId]),
    [
      [heatingLine.id, heating.id, false, f.orgA.id, client.id],
      [null, shopping.id, true, f.orgA.id, client.id]
    ]
  );

  /* KORDUSSAATMINE: sama keha annab sama kirje ja toimingute ridu ei teki juurde; muu sisu on konflikt. */
  const again = await createEntry(anu, client.id, body, deps());
  assert.deepEqual([again.created, again.entry.id, shape(again.entry)], [false, visit.id, shape(visit)]);
  assert.equal(await db.careEntryActivity.count({ where: { entryId: visit.id } }), 2);
  await expectError(createEntry(anu, client.id, { ...body, visitMinutes: 50 }, deps()), 409, 'home_care.errors.idempotency_conflict');
  await expectError(
    createEntry(anu, client.id, { ...body, activities: [{ activityId: heating.id, mode: 'GUIDE' }, body.activities[1]] }, deps()),
    409,
    'home_care.errors.idempotency_conflict'
  );

  /* Telefonikontaktil käigu välju ei ole. */
  const phone = (await createEntry(anu, client.id, { contactMode: 'PHONE', text: 'Helistas tütar.', visitMinutes: 30, activities: [{ activityId: heating.id, mode: 'FOR' }] }, deps())).entry;
  assert.equal(phone.visit, null);
  assert.equal(await db.careEntryActivity.count({ where: { entryId: phone.id } }), 0);

  /* Käigu kirje on näha päevikus ja hooldusjuhi ülevaates. */
  const page = await listEntries(lead, client.id, {}, deps());
  assert.deepEqual(shape(page.items.find((item) => item.id === visit.id)), shape(visit));
  const overview = await getCoordinatorOverview(lead, deps());
  assert.deepEqual(shape(overview.recent.find((item) => item.id === visit.id)), shape(visit));

  /* PARANDUS. Kataloogi ümbernimetamine kirjet ei muuda; ainult teksti saatev parandus jätab käigu kirje alles. */
  await updateActivity(lead, heating.id, { version: heating.version, name: 'Ahju kütmine' }, deps());
  const first = (await correctEntry(anu, client.id, visit.id, { text: 'Tõin ka ajalehe.', reason: 'Lisan märkuse.', revision: 1 }, deps())).entry;
  assert.deepEqual([first.text, first.revision, shape(first)], ['Tõin ka ajalehe.', 2, shape(visit)]);
  /* Toimingute parandus: olemasolev toiming hoiab oma nime ja kavaviite, muutub tegemise viis;
     eemaldatud toiming kaob ja lisatud kavaväline toiming tuleb kataloogist; kestus tühjendatakse. */
  const second = (
    await correctEntry(
      anu,
      client.id,
      visit.id,
      {
        text: 'Tõin ka ajalehe.',
        reason: 'Parandan toimingud.',
        revision: 2,
        visitMinutes: null,
        activities: [
          { activityId: heating.id, mode: 'TOGETHER' },
          { activityId: laundry.id, mode: 'FOR' }
        ]
      },
      deps()
    )
  ).entry;
  assert.deepEqual(shape(second), [null, [[heating.name, 'HEATING', 'TOGETHER', false], [laundry.name, 'LAUNDRY', 'FOR', true]]]);
  assert.equal((await db.careEntryActivity.findFirst({ where: { entryId: visit.id, activityId: heating.id } })).planLineId, heatingLine.id);
  /* Parandusjälg hoiab käigu kirje sellisena, nagu see enne parandust oli. */
  const { revisions } = await listEntryRevisions(anu, client.id, visit.id, deps());
  assert.deepEqual(
    revisions.map((row) => [row.revision, row.text, row.visit?.minutes, row.visit?.activities.map((item) => [item.name, item.mode, item.outsidePlan])]),
    [
      [2, 'Tõin ka ajalehe.', 45, [[heating.name, 'FOR', false], [shopping.name, 'TOGETHER', true]]],
      [1, '', 45, [[heating.name, 'FOR', false], [shopping.name, 'TOGETHER', true]]]
    ]
  );
  /* Kontakti viisi muutmine telefoniks võtab käigu kirje maha. */
  const third = (await correctEntry(anu, client.id, visit.id, { text: 'Tegelikult oli see kõne.', contactMode: 'PHONE', reason: 'Vale kontakti viis.', revision: 3 }, deps())).entry;
  assert.equal(third.visit, null);
  assert.equal(await db.careEntryActivity.count({ where: { entryId: visit.id } }), 0);
  assert.equal((await db.careClientEntry.findUnique({ where: { id: visit.id } })).visitMinutes, null);

  /* Arhiveeritud ja teise asutuse toimingut uuele kirjele märkida ei saa. */
  await updateActivity(lead, laundry.id, { version: laundry.version, archived: true }, deps());
  await bad({ activities: [{ activityId: laundry.id, mode: 'FOR' }] }, 'home_care.errors.visit_activity_unknown');
  const foreign = (await seedDefaultActivities(leadB, deps())).activities[0];
  await bad({ activities: [{ activityId: foreign.id, mode: 'FOR' }] }, 'home_care.errors.visit_activity_unknown');

  /* TÜHISTATUD kirjel käigu kirjet aktiivsel pinnal ei ole; read jäävad andmebaasi alles. */
  const gone = (await createEntry(anu, client.id, { visitMinutes: 30, activities: [{ activityId: hygiene.id, mode: 'ASSIST' }] }, deps())).entry;
  const retracted = (await retractEntry(anu, client.id, gone.id, { reason: 'Vale klient.', revision: 1 }, deps())).entry;
  assert.equal(retracted.visit, null);
  assert.equal(await db.careEntryActivity.count({ where: { entryId: gone.id } }), 1);

  /* KRONOLOOGIA: käigu kirje rida lisandub tekstile; tekstita käik ei ole tühi rida. */
  const withText = (await createEntry(anu, client.id, { text: 'Kõik korras.', visitMinutes: 30, activities: [{ activityId: hygiene.id, mode: 'ASSIST' }], occurredAt: '2026-10-09T06:00:00Z' }, deps())).entry;
  const tickOnly = (await createEntry(anu, client.id, { visitMinutes: 20, activities: [{ activityId: heating.id, mode: 'FOR' }], occurredAt: '2026-10-09T07:00:00Z' }, deps())).entry;
  const chronology = await draftChronology(lead, client.id, { from: '2026-10-09', to: '2026-10-09' }, deps());
  const textOf = (entryId) => chronology.items.find((item) => item.entryId === entryId).text;
  assert.equal(textOf(withText.id), `Kõik korras.\nKäik kestis 30 min. Tehtud: ${hygiene.name} (aitasin osaliselt).`);
  /* Kava rida kannab toimingu nime kava kehtestamise hetkest, mitte kataloogi uut nime. */
  assert.equal(textOf(tickOnly.id), `Käik kestis 20 min. Tehtud: ${heating.name} (tegin tema eest).`);
  /* Muutmata tekstiga väljastus ei ole „muudetud"; väljastatud rida on sama tekst. */
  const release = await createChronologyRelease(
    lead,
    client.id,
    {
      from: '2026-10-09',
      to: '2026-10-09',
      requester: 'Politsei- ja Piirivalveamet',
      basis: 'Päring 09.10.2026',
      items: [
        { entryId: withText.id, revision: 1 },
        { entryId: tickOnly.id, revision: 1 }
      ]
    },
    deps()
  );
  const releasedItems = await db.careChronologyReleaseItem.findMany({ where: { releaseId: release.release.id }, orderBy: { position: 'asc' } });
  assert.deepEqual(
    releasedItems.map((item) => [item.text, item.redacted]),
    [
      [textOf(withText.id), false],
      [textOf(tickOnly.id), false]
    ]
  );

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const row = (data) =>
    db.careEntryActivity.create({
      data: { organizationId: f.orgA.id, entryId: tickOnly.id, clientId: client.id, activityName: 'Proov', activityGroup: 'HEATING', mode: 'FOR', ...data }
    });
  await assert.rejects(row({ mode: 'ALONE' }), /CareEntryActivity_mode_check/);
  await assert.rejects(row({ activityGroup: 'KÜTE' }), /CareEntryActivity_activityGroup_check/);
  await assert.rejects(row({ activityName: '  ' }), /CareEntryActivity_activityName_check/);
  await assert.rejects(row({ activityId: heating.id }), /CareEntryActivity_entryId_activityId_key|Unique constraint/);
  await assert.rejects(row({ outsidePlan: true, planLineId: heatingLine.id }), /CareEntryActivity_outsidePlan_check/);
  await assert.rejects(db.careClientEntry.update({ where: { id: tickOnly.id }, data: { visitMinutes: 1441 } }), /CareClientEntry_visitMinutes_check/);
  await assert.rejects(db.careClientEntry.update({ where: { id: tickOnly.id }, data: { visitMinutes: 0 } }), /CareClientEntry_visitMinutes_check/);
});

test('osutatud aeg: kliendi lehe nädal ja kuu ning hooldusjuhi kuu kokkuvõte', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.bert.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const heating = (await seedDefaultActivities(lead, deps())).activities.find((item) => item.group === 'HEATING');
  const make = async (displayName, extra = {}) => (await createClient(lead, { displayName, ...extra }, deps())).client;
  const done = [{ activityId: heating.id, mode: 'FOR' }];
  const visit = (who, client, occurredAt, extra = {}) => createEntry(who, client.id, { occurredAt, activities: done, ...extra }, deps());

  /* Täna on reede 09.10.2026; nädal on 05.10 kuni 11.10. */
  const linda = await make('Linda Tamm');
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await createDecision(lead, linda.id, { kind: 'ACT', validFrom: '2026-09-01', volumeHours: '6,5', volumePeriod: 'WEEK' }, deps());
  await visit(anu, linda, '2026-10-05T07:00:00Z', { visitMinutes: 60 });
  await visit(anu, linda, '2026-10-07T07:00:00Z', { visitMinutes: 45, companionMembershipId: f.members.bert.id });
  await visit(anu, linda, '2026-10-02T07:00:00Z'); // eelmine nädal, kestus märkimata
  await visit(anu, linda, '2026-09-30T07:00:00Z', { visitMinutes: 30 }); // september
  /* Ei loe: tekstiga kirje ilma käigu kirjeta, telefonikõne ja tühistatud käik. */
  await createEntry(anu, linda.id, { text: 'Rääkisime ilmast.', occurredAt: '2026-10-08T07:00:00Z' }, deps());
  await createEntry(anu, linda.id, { contactMode: 'PHONE', text: 'Helistas tütar.', occurredAt: '2026-10-08T08:00:00Z' }, deps());
  const wrong = (await visit(anu, linda, '2026-10-06T07:00:00Z', { visitMinutes: 90 })).entry;
  await retractEntry(anu, linda.id, wrong.id, { reason: 'Vale klient.', revision: 1 }, deps());
  /* Ära jäänud käik on erijuhtum „ei avanud ust". */
  const missed = (await createEntry(anu, linda.id, { kind: 'INCIDENT', incidentType: 'DOOR_NOT_OPENED', text: 'Ei avanud ust.', occurredAt: '2026-10-08T06:00:00Z' }, deps())).entry;

  const peeter = await make('Peeter Põhi', { unitId: north.id });
  await createDecision(lead, peeter.id, { kind: 'ACT', validFrom: '2026-10-06', volumeHours: '20', volumePeriod: 'MONTH' }, deps());
  await visit(lead, peeter, '2026-10-06T08:00:00Z', { visitMinutes: 120 });
  await make('Mari Maht');
  const endel = await make('Endel Lõppenud');
  await visit(lead, endel, '2026-10-01T08:00:00Z', { visitMinutes: 20 });
  await setClientStatus(lead, endel.id, { version: 1, status: 'ENDED', statusReason: 'MOVED' }, deps());

  /* KLIENDI LEHT: selle nädala ja selle kuu käigud ja aeg; näeb kogu meeskond. */
  assert.deepEqual((await openClient(anu, linda.id, deps())).provided, {
    week: { fromDay: '2026-10-05', toDay: '2026-10-11', visits: 2, minutes: 105, withoutLength: 0 },
    month: { month: '2026-10', visits: 3, minutes: 105, withoutLength: 1 }
  });
  assert.deepEqual((await openClient(lead, peeter.id, deps())).provided.week, { fromDay: '2026-10-05', toDay: '2026-10-11', visits: 1, minutes: 120, withoutLength: 0 });

  /* KUU KOKKUVÕTE: jooksev kuu, otsustatud aeg tänase päevani. */
  const view = await getMonthSummary(lead, {}, deps());
  assert.deepEqual(
    [view.month, view.previousMonth, view.nextMonth, view.today, view.fromDay, view.untilDay, view.complete, view.truncated],
    ['2026-10', '2026-09', null, '2026-10-09', '2026-10-01', '2026-10-09', false, false]
  );
  assert.deepEqual(view.totals, { visits: 5, minutes: 245, withoutLength: 1, missed: 1, cancelled: 0, notDone: 0 });
  assert.deepEqual(
    view.clients.map((row) => [row.client.displayName, row.client.status, row.visits, row.minutes, row.withoutLength, row.missed, row.volumeMinutes, row.volumePeriod, row.expectedMinutes]),
    [
      /* Lõppenud teenusega klient on kokkuvõttes, sest tal oli selles kuus käik. */
      ['Endel Lõppenud', 'ENDED', 1, 20, 0, 0, null, null, null],
      /* 9 päeva nädalamahust 6,5 tundi: 9 × 390 / 7 = 501 minutit. */
      ['Linda Tamm', 'ACTIVE', 3, 105, 1, 1, 390, 'WEEK', 501],
      ['Mari Maht', 'ACTIVE', 0, 0, 0, 0, null, null, null],
      /* Otsus algas 06.10: 4 päeva kuumahust 20 tundi oktoobris: 4 × 1200 / 31 = 155 minutit. */
      ['Peeter Põhi', 'ACTIVE', 1, 120, 0, 0, 1200, 'MONTH', 155]
    ]
  );
  /* Töötajad: autor saab käigu aja; „kaasas" olnud töötaja saab selle eraldi real. Kliendi aeg loetakse üks kord. */
  const worker = (membershipId) => view.workers.find((row) => row.membershipId === membershipId);
  assert.deepEqual(
    [f.members.anu.id, f.members.lead.id, f.members.bert.id].map((id) => [worker(id).visits, worker(id).minutes, worker(id).companionVisits, worker(id).companionMinutes]),
    [
      [3, 105, 0, 0],
      [2, 140, 0, 0],
      [0, 0, 1, 45]
    ]
  );
  assert.equal(view.workers.length, 3);
  assert.deepEqual(view.workers.map((row) => row.name), [...view.workers.map((row) => row.name)].sort((a, b) => a.localeCompare(b, 'et')));
  assert.deepEqual(
    view.missed.map((row) => [row.entryId, row.client.displayName, row.type, row.occurredAt]),
    [[missed.id, 'Linda Tamm', 'DOOR_NOT_OPENED', '2026-10-08T06:00:00.000Z']]
  );

  /* SEPTEMBER: terve kuu; Peetri otsus ei kehtinud veel. */
  const september = await getMonthSummary(lead, { month: '2026-09' }, deps());
  assert.deepEqual(
    [september.month, september.nextMonth, september.untilDay, september.complete, september.totals],
    ['2026-09', '2026-10', '2026-09-30', true, { visits: 1, minutes: 30, withoutLength: 0, missed: 0, cancelled: 0, notDone: 0 }]
  );
  const row = (summary, name) => summary.clients.find((item) => item.client.displayName === name);
  assert.deepEqual([row(september, 'Linda Tamm').minutes, row(september, 'Linda Tamm').expectedMinutes], [30, 1671]);
  assert.deepEqual([row(september, 'Peeter Põhi').volumeMinutes, row(september, 'Peeter Põhi').expectedMinutes], [null, null]);
  /* Lõppenud teenusega klient, kellel selles kuus käiku ei olnud, kokkuvõttes ei ole. */
  assert.equal(row(september, 'Endel Lõppenud'), undefined);

  /* Tulevane kuu: otsustatud aega ei arvutata; vigane kuu on viga. */
  const future = await getMonthSummary(lead, { month: '2026-11' }, deps());
  assert.deepEqual(
    [future.untilDay, future.complete, future.totals.visits, future.clients.every((item) => item.expectedMinutes === null)],
    [null, false, 0, true]
  );
  await expectError(getMonthSummary(lead, { month: '2026-13' }, deps()), 400, 'home_care.errors.invalid_month');

  /* Üksuse hooldusjuht näeb ainult oma üksuse klienti ja tema käikude tegijat. */
  const scoped = await getMonthSummary(bert, {}, deps());
  assert.deepEqual(
    [scoped.clients.map((item) => item.client.displayName), scoped.totals, scoped.workers.map((item) => item.membershipId), scoped.missed],
    [['Peeter Põhi'], { visits: 1, minutes: 120, withoutLength: 0, missed: 0, cancelled: 0, notDone: 0 }, [f.members.lead.id], []]
  );
  /* Hooldaja ei ole hooldusjuht; teise asutuse juht näeb oma tühja asutust. */
  await expectError(getMonthSummary(anu, {}, deps()), 403, 'org.errors.missing_capability');
  const foreign = await getMonthSummary(leadB, {}, deps());
  assert.deepEqual([foreign.clients, foreign.workers, foreign.missed, foreign.totals.visits], [[], [], [], 0]);
});

test('käigu lõpetamine erandite kaudu: tegemata toiming põhjusega, parandus, kuu kokkuvõte ja kronoloogia', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  const catalogue = (await seedDefaultActivities(lead, deps())).activities;
  const byGroup = (group) => catalogue.find((item) => item.group === group);
  const heating = byGroup('HEATING');
  const hygiene = byGroup('HYGIENE');
  const nutrition = byGroup('NUTRITION');
  const shopping = byGroup('SHOPPING');
  const { draft } = await saveCarePlanDraft(
    lead,
    client.id,
    {
      lines: [
        { activityId: heating.id, frequencyKind: 'DAILY', frequencyCount: 1, mode: 'FOR', critical: true },
        { activityId: hygiene.id, frequencyKind: 'WEEKLY', frequencyCount: 2, mode: 'ASSIST' },
        { activityId: nutrition.id, frequencyKind: 'DAILY', frequencyCount: 1, mode: 'GUIDE' }
      ]
    },
    deps()
  );
  await activateCarePlan(lead, client.id, { version: draft.version }, deps());
  const shape = (entry) => entry.visit.activities.map((item) => [item.name, item.mode, item.outcome, item.outsidePlan]);

  /* Vigane: tundmatu tulemus; tegemata saab jääda ainult kava toiming. */
  const bad = (activities, key) => expectError(createEntry(anu, client.id, { activities }, deps()), 400, key);
  await bad([{ activityId: hygiene.id, outcome: 'MAYBE' }], 'home_care.errors.visit_outcome_invalid');
  await bad([{ activityId: shopping.id, outcome: 'REFUSED' }], 'home_care.errors.visit_outcome_plan_only');
  assert.equal(await db.careClientEntry.count({ where: { clientId: client.id } }), 0);

  /* KÄIK ERANDITEGA: üks tehtud, üks keeldus, üks polnud vaja. Tegemata real on kava rea viis. */
  const made = (
    await createEntry(
      anu,
      client.id,
      {
        visitMinutes: 40,
        occurredAt: '2026-10-08T07:00:00Z',
        activities: [
          { activityId: heating.id, mode: 'FOR' },
          { activityId: hygiene.id, outcome: 'REFUSED', mode: 'GUIDE' },
          { activityId: nutrition.id, outcome: 'NOT_NEEDED' }
        ]
      },
      deps()
    )
  ).entry;
  assert.deepEqual(shape(made), [
    [heating.name, 'FOR', 'DONE', false],
    [hygiene.name, 'ASSIST', 'REFUSED', false],
    [nutrition.name, 'GUIDE', 'NOT_NEEDED', false]
  ]);
  assert.equal(made.text, '');
  /* Ainult tegemata jäänud toimingutega käik on samuti käigu kirje. */
  const none = (await createEntry(anu, client.id, { occurredAt: '2026-10-07T07:00:00Z', activities: [{ activityId: hygiene.id, outcome: 'COULD_NOT' }] }, deps())).entry;
  assert.deepEqual(shape(none), [[hygiene.name, 'ASSIST', 'COULD_NOT', false]]);
  /* Tulemuseta päring (varasem vorm, seadme järjekord) on tehtud toiming. */
  const legacy = (await createEntry(anu, client.id, { occurredAt: '2026-10-06T07:00:00Z', activities: [{ activityId: shopping.id, mode: 'TOGETHER' }] }, deps())).entry;
  assert.deepEqual(shape(legacy), [[shopping.name, 'TOGETHER', 'DONE', true]]);

  /* PARANDUS: keeldumine osutus tehtuks ja tehtu jäi tegelikult tegemata; kirjel olev rida hoiab oma viisi. */
  const fixed = (
    await correctEntry(
      anu,
      client.id,
      made.id,
      {
        text: '',
        reason: 'Märkisin valesti.',
        revision: 1,
        activities: [
          { activityId: heating.id, outcome: 'COULD_NOT' },
          { activityId: hygiene.id, mode: 'TOGETHER' },
          { activityId: nutrition.id, outcome: 'NOT_NEEDED' }
        ]
      },
      deps()
    )
  ).entry;
  assert.deepEqual(shape(fixed), [
    [heating.name, 'FOR', 'COULD_NOT', false],
    [hygiene.name, 'TOGETHER', 'DONE', false],
    [nutrition.name, 'GUIDE', 'NOT_NEEDED', false]
  ]);
  /* Kirjel olevat kavavälist toimingut tegemata jäänuks parandada ei saa. */
  await expectError(
    correctEntry(anu, client.id, legacy.id, { text: '', reason: 'Proov.', revision: 1, activities: [{ activityId: shopping.id, outcome: 'REFUSED' }] }, deps()),
    400,
    'home_care.errors.visit_outcome_plan_only'
  );
  /* Parandusjälg hoiab tulemused sellisena, nagu need enne parandust olid. */
  const { revisions } = await listEntryRevisions(anu, client.id, made.id, deps());
  assert.deepEqual(revisions[0].visit.activities.map((item) => [item.name, item.outcome]), [
    [heating.name, 'DONE'],
    [hygiene.name, 'REFUSED'],
    [nutrition.name, 'NOT_NEEDED']
  ]);

  /* KUU KOKKUVÕTE: tegemata toimingud põhjuse kaupa; tühistatud kirje toiminguid ei loeta. */
  const wrong = (await createEntry(anu, client.id, { occurredAt: '2026-10-05T07:00:00Z', activities: [{ activityId: hygiene.id, outcome: 'REFUSED' }] }, deps())).entry;
  await retractEntry(anu, client.id, wrong.id, { reason: 'Vale klient.', revision: 1 }, deps());
  const summary = await getMonthSummary(lead, {}, deps());
  const row = summary.clients.find((item) => item.client.id === client.id);
  assert.deepEqual([row.visits, row.minutes, row.withoutLength, row.notDone], [3, 40, 2, { REFUSED: 0, NOT_NEEDED: 1, COULD_NOT: 2 }]);
  assert.equal(summary.totals.notDone, 3);

  /* KRONOLOOGIA: tehtud ja tegemata toimingud on eraldi lausetes. */
  const chronology = await draftChronology(lead, client.id, { from: '2026-10-08', to: '2026-10-08' }, deps());
  assert.equal(
    chronology.items.find((item) => item.entryId === made.id).text,
    `Käik kestis 40 min. Tehtud: ${hygiene.name} (tegime koos). Tegemata: ${heating.name} (ei saanud teha); ${nutrition.name} (polnud vaja).`
  );

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) =>
    db.careEntryActivity.create({
      data: { organizationId: f.orgA.id, entryId: none.id, clientId: client.id, activityName: 'Proov', activityGroup: 'HEATING', mode: 'FOR', ...data }
    });
  await assert.rejects(raw({ outcome: 'MAYBE' }), /CareEntryActivity_outcome_check/);
  await assert.rejects(raw({ outcome: 'REFUSED', outsidePlan: true }), /CareEntryActivity_outcome_plan_check/);
  /* Vaikeväärtus: rida ilma tulemuseta (eelmine rakenduse versioon) on tehtud. */
  assert.equal((await raw({})).outcome, 'DONE');
});

test('käigumuster: korduvad käigud, muudatus tänasest, lõpetamine, õigused ja hooldaja tänane päev', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const { client } = await createClient(lead, { displayName: 'Linda Tamm', address: 'Kase 3' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  const input = { weekdays: [5, 1, 3], startTime: '09:00', plannedMinutes: 45, workerMembershipId: f.members.anu.id, note: 'Hommikune käik' };

  /* Algus: mustrit ei ole. Täna on reede 09.10.2026. */
  assert.deepEqual(await getClientSlots(anu, client.id, deps()), { today: '2026-10-09', slots: [], canEdit: false });
  assert.deepEqual([(await openClient(anu, client.id, deps())).today, (await openClient(anu, client.id, deps())).slots], ['2026-10-09', []]);

  /* Lisab ainult hooldusjuht; meeskonda mittekuuluv ja teise asutuse juht klienti ei näe. */
  await expectError(createSlots(anu, client.id, input, deps()), 403, 'org.errors.missing_capability');
  await expectError(getClientSlots(bert, client.id, deps()), 404);
  await expectError(createSlots(leadB, client.id, input, deps()), 404);

  /* Vigane sisend ei salvestu. */
  const bad = (patch, key) => expectError(createSlots(lead, client.id, { ...input, ...patch }, deps()), 400, key);
  await bad({ weekdays: [] }, 'home_care.errors.slot_weekday_required');
  await bad({ weekdays: [0] }, 'home_care.errors.slot_weekday_required');
  await bad({ weekdays: [1, 8] }, 'home_care.errors.slot_weekday_required');
  await bad({ startTime: '9:00' }, 'home_care.errors.slot_time_invalid');
  await bad({ startTime: '24:00' }, 'home_care.errors.slot_time_invalid');
  await bad({ plannedMinutes: 4 }, 'home_care.errors.slot_minutes_invalid');
  await bad({ plannedMinutes: 721 }, 'home_care.errors.slot_minutes_invalid');
  await bad({ workerMembershipId: f.members.bert.id }, 'home_care.errors.slot_worker_not_in_team');
  await bad({ validFrom: '2026-10-08' }, 'home_care.errors.slot_from_past');
  await bad({ validFrom: '2026-11-01', validUntil: '2026-10-31' }, 'home_care.errors.slot_period_invalid');
  assert.equal(await db.careVisitSlot.count({ where: { clientId: client.id } }), 0);

  /* LISAMINE: üks rida iga valitud nädalapäeva kohta, nädalapäevade järjekorras. */
  const made = await createSlots(lead, client.id, input, deps());
  assert.deepEqual(
    made.slots.map((slot) => [slot.weekday, slot.startTime, slot.startMinute, slot.plannedMinutes, slot.worker.membershipId, slot.worker.active, slot.note, slot.validFrom, slot.validUntil, slot.version]),
    [1, 3, 5].map((weekday) => [weekday, '09:00', 540, 45, f.members.anu.id, true, 'Hommikune käik', '2026-10-09', null, 1])
  );
  assert.ok(made.slots[0].worker.name);
  assert.deepEqual(made.team.map((member) => [member.membershipId, member.recentVisits]), [[f.members.anu.id, 0]]);
  assert.equal((await openClient(anu, client.id, deps())).slots.length, 3);
  /* Reede õhtune käik ilma töötajata. */
  const evening = (await createSlots(lead, client.id, { weekdays: [5], startTime: '17:30', plannedMinutes: 30 }, deps())).slots.find((slot) => slot.startTime === '17:30');
  assert.deepEqual([evening.weekday, evening.worker, evening.note], [5, null, null]);

  /* TÄNANE PÄEV: hooldajale määratud tänased käigud; tehtud ei ole veel midagi. */
  const mine = async (now) => (await getMyDay(anu, deps(now))).visits.map((visit) => [visit.startTime, visit.done]);
  const day = await getMyDay(anu, deps());
  assert.deepEqual(
    [day.today, day.weekday, day.visits.map((visit) => [visit.startTime, visit.plannedMinutes, visit.client.displayName, visit.client.address, visit.note, visit.done])],
    ['2026-10-09', 5, [['09:00', 45, 'Linda Tamm', 'Kase 3', 'Hommikune käik', false]]]
  );
  /* Käigu kirje täna (ka kolleegi kirjutatud) teeb päeva esimese plaanitud käigu tehtuks. */
  await createEntry(lead, client.id, { text: 'Käidud.', visitMinutes: 40, occurredAt: '2026-10-09T06:10:00Z' }, deps());
  assert.deepEqual(await mine(), [['09:00', true]]);
  /* Õhtune käik määratakse samale hooldajale (rida algas täna: muudetakse kohapeal). Üks kirje katab ainult esimese käigu. */
  const assigned = await changeSlot(lead, client.id, evening.id, { version: 1, startTime: '17:30', plannedMinutes: 30, workerMembershipId: f.members.anu.id }, deps());
  assert.deepEqual(
    assigned.slots.filter((slot) => slot.weekday === 5).map((slot) => [slot.id === evening.id || slot.startTime === '09:00', slot.startTime, slot.version]),
    [
      [true, '09:00', 1],
      [true, '17:30', 2]
    ]
  );
  assert.deepEqual(await mine(), [
    ['09:00', true],
    ['17:30', false]
  ]);
  /* Määramise juures on näha, mitu käigu kirjet töötaja selle kliendi juures 28 päeva jooksul kirjutas. */
  await createEntry(anu, client.id, { text: 'Õhtune käik.', visitMinutes: 25, occurredAt: '2026-10-09T07:30:00Z' }, deps());
  assert.deepEqual((await getSlotEditor(lead, client.id, deps())).team.map((member) => member.recentVisits), [1]);
  assert.deepEqual(await mine(), [
    ['09:00', true],
    ['17:30', true]
  ]);
  await expectError(getSlotEditor(anu, client.id, deps()), 403, 'org.errors.missing_capability');
  /* Kellel täna käike ei ole, saab tühja päeva; ajutiselt ära oleva kliendi käike tänases päevas ei ole. */
  assert.deepEqual((await getMyDay(bert, deps())).visits, []);
  const clientVersion = (await db.careClient.findUnique({ where: { id: client.id }, select: { version: true } })).version;
  await setClientStatus(lead, client.id, { version: clientVersion, status: 'AWAY', statusReason: 'HOSPITAL' }, deps());
  assert.deepEqual(await mine(), []);
  await setClientStatus(lead, client.id, { version: clientVersion + 1, status: 'ACTIVE' }, deps());

  /* MUUDATUS TÄNASEST, kui rida on juba kehtinud (kolmapäev 14.10): vana rida lõpeb eilsega, uus algab täna. */
  const later = at('2026-10-14T08:00:00Z');
  const monday = made.slots.find((slot) => slot.weekday === 1);
  const change = { startTime: '10:00', plannedMinutes: 60, workerMembershipId: null };
  await expectError(changeSlot(lead, client.id, monday.id, change, deps(later)), 400, 'home_care.errors.version_required');
  await expectError(changeSlot(lead, client.id, monday.id, { ...change, version: 9 }, deps(later)), 409, 'home_care.errors.version_conflict');
  await expectError(changeSlot(anu, client.id, monday.id, { ...change, version: 1 }, deps(later)), 403, 'org.errors.missing_capability');
  const moved = await changeSlot(lead, client.id, monday.id, { ...change, version: 1 }, deps(later));
  assert.deepEqual(
    (await db.careVisitSlot.findMany({ where: { clientId: client.id, weekday: 1 }, orderBy: { validFrom: 'asc' } })).map((row) => [row.startMinute, row.plannedMinutes, row.workerMembershipId, row.validFrom, row.validUntil]),
    [
      [540, 45, f.members.anu.id, '2026-10-09', '2026-10-13'],
      [600, 60, null, '2026-10-14', null]
    ]
  );
  /* Vaade näitab ainult kehtivat rida; möödunud esmaspäeva (12.10) plaan on endine, järgmisel esmaspäeval hooldajal käiku ei ole. */
  assert.deepEqual(moved.slots.filter((slot) => slot.weekday === 1).map((slot) => [slot.startTime, slot.worker]), [['10:00', null]]);
  assert.deepEqual(await mine(at('2026-10-12T05:00:00Z')), [['09:00', false]]);
  assert.deepEqual(await mine(at('2026-10-19T05:00:00Z')), []);

  /* LÕPETAMINE: tagasiulatuvalt ei saa; vaikimisi on viimane päev eile; lõpetatud rida ei muudeta. */
  const wednesday = made.slots.find((slot) => slot.weekday === 3);
  await expectError(endSlot(lead, client.id, wednesday.id, { version: 1, lastDay: '2026-10-10' }, deps(later)), 400, 'home_care.errors.slot_end_past');
  await expectError(endSlot(anu, client.id, wednesday.id, { version: 1 }, deps(later)), 403, 'org.errors.missing_capability');
  const ended = await endSlot(lead, client.id, wednesday.id, { version: 1 }, deps(later));
  assert.deepEqual(ended.slots.filter((slot) => slot.weekday === 3), []);
  assert.equal((await db.careVisitSlot.findUnique({ where: { id: wednesday.id } })).validUntil, '2026-10-13');
  await expectError(endSlot(lead, client.id, wednesday.id, { version: 2 }, deps(later)), 409, 'home_care.errors.slot_ended');
  await expectError(changeSlot(lead, client.id, wednesday.id, { ...change, version: 2 }, deps(later)), 409, 'home_care.errors.slot_ended');
  /* Rida, mis ei ole veel alanud, kustub lõpetamisel: see ei ole kunagi kehtinud. */
  const saturday = (await createSlots(lead, client.id, { weekdays: [6], startTime: '11:00', plannedMinutes: 30, validFrom: '2026-11-01' }, deps(later))).slots.find((slot) => slot.weekday === 6);
  assert.equal(saturday.validFrom, '2026-11-01');
  await endSlot(lead, client.id, saturday.id, { version: 1 }, deps(later));
  assert.equal(await db.careVisitSlot.count({ where: { id: saturday.id } }), 0);
  /* Teise kliendi kaudu rida muuta ei saa. */
  const { client: other } = await createClient(lead, { displayName: 'Teine Klient' }, deps());
  await expectError(endSlot(lead, other.id, evening.id, { version: 2 }, deps(later)), 404, 'home_care.errors.slot_not_found');

  /* Meeskonnast eemaldatud hooldaja tänases päevas seda klienti enam ei ole, kuigi rida on talle määratud. */
  await removeTeamMember(lead, client.id, f.members.anu.id, deps(at('2026-10-16T05:00:00Z')));
  assert.deepEqual(await mine(at('2026-10-16T06:00:00Z')), []);
  await expectError(createSlots(lead, client.id, { ...input, weekdays: [2] }, deps(at('2026-10-16T06:00:00Z'))), 400, 'home_care.errors.slot_worker_not_in_team');

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) =>
    db.careVisitSlot.create({ data: { organizationId: f.orgA.id, clientId: client.id, weekday: 1, startMinute: 540, plannedMinutes: 30, validFrom: '2026-10-09', ...data } });
  await assert.rejects(raw({ weekday: 8 }), /CareVisitSlot_weekday_check/);
  await assert.rejects(raw({ startMinute: 1440 }), /CareVisitSlot_startMinute_check/);
  await assert.rejects(raw({ plannedMinutes: 4 }), /CareVisitSlot_plannedMinutes_check/);
  await assert.rejects(raw({ validFrom: '09.10.2026' }), /CareVisitSlot_days_check/);
  await assert.rejects(raw({ validUntil: '2026-10-08' }), /CareVisitSlot_days_check/);

  /* AUDIT: iga muutus jätab rea ainult ID-de ja muutuse liigiga. */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_slot_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual(
    audit.map((entry) => entry.meta.change).sort(),
    ['changed', 'created', 'created', 'created', 'created', 'created', 'created', 'ended', 'ended', 'removed']
  );
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'organizationId', 'slotId']);
});

test('päevaplaan: käigud töötaja kaupa, ümbertõstmine, ärajätmine, tagasivõtmine ja hooldaja päev', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const make = async (displayName, member, extra = {}) => {
    const { client } = await createClient(lead, { displayName, ...extra }, deps());
    await addTeamMember(lead, client.id, { membershipId: member.id }, deps());
    return client;
  };
  const linda = await make('Linda Tamm', f.members.anu, { address: 'Kase 3' });
  const peeter = await make('Peeter Põhi', f.members.bert, { unitId: north.id });
  const mari = await make('Mari Ära', f.members.anu);
  /* Muster on kehtinud alates 01.10 (neljapäev); kõik käigud on reedeti. Täna on reede 09.10, kell on Tallinnas 11.00. */
  const early = at('2026-10-01T08:00:00Z');
  const slotOf = async (client, startTime, plannedMinutes, member) =>
    (await createSlots(lead, client.id, { weekdays: [5], startTime, plannedMinutes, workerMembershipId: member?.id || null }, deps(early))).slots.find((slot) => slot.startTime === startTime);
  const lindaMorning = await slotOf(linda, '09:00', 45, f.members.anu);
  const lindaEvening = await slotOf(linda, '17:00', 30, f.members.anu);
  const peeterMorning = await slotOf(peeter, '10:00', 60, f.members.bert);
  const peeterNoon = await slotOf(peeter, '14:00', 30, null);
  await slotOf(mari, '12:00', 30, f.members.anu);
  await setClientStatus(lead, mari.id, { version: (await db.careClient.findUnique({ where: { id: mari.id } })).version, status: 'AWAY', statusReason: 'HOSPITAL' }, deps());
  await createEntry(anu, linda.id, { text: 'Käidud.', visitMinutes: 40, occurredAt: '2026-10-09T06:10:00Z' }, deps());

  const rows = (visits) => visits.map((visit) => [visit.startTime, visit.client.displayName, visit.state]);
  const today = '2026-10-09';

  /* PÄEVAPLAAN: töötaja kaupa, määramata eraldi, ajutiselt ära oleva kliendi käik eraldi. */
  const view = await getDayPlan(lead, {}, deps());
  assert.deepEqual([view.day, view.today, view.weekday, view.previousDay, view.nextDay, view.canEdit], [today, today, 5, '2026-10-08', '2026-10-10', true]);
  assert.deepEqual(view.totals, { planned: 4, minutes: 165, done: 1, missing: 0, cancelled: 0, unassigned: 1, uncovered: 0, obstacles: 0 });
  assert.deepEqual(rows(view.unassigned), [['14:00', 'Peeter Põhi', 'PLANNED']]);
  assert.deepEqual(
    view.workers.map((worker) => [worker.name, rows(worker.visits)]),
    [
      ['Anu Hooldaja', [['09:00', 'Linda Tamm', 'DONE'], ['17:00', 'Linda Tamm', 'PLANNED']]],
      ['Bert Hooldaja', [['10:00', 'Peeter Põhi', 'PLANNED']]]
    ]
  );
  assert.deepEqual(rows(view.away), [['12:00', 'Mari Ära', 'PLANNED']]);
  /* Nädal esmaspäevast pühapäevani; käigud on ainult reedel. */
  assert.deepEqual(
    view.week.map((item) => [item.day, item.weekday, item.planned, item.unassigned, item.missing]),
    [
      ['2026-10-05', 1, 0, 0, 0],
      ['2026-10-06', 2, 0, 0, 0],
      ['2026-10-07', 3, 0, 0, 0],
      ['2026-10-08', 4, 0, 0, 0],
      ['2026-10-09', 5, 4, 1, 0],
      ['2026-10-10', 6, 0, 0, 0],
      ['2026-10-11', 7, 0, 0, 0]
    ]
  );
  /* Ümber tõsta saab asutuse hooldajale (inimene, kes on mõne kliendi meeskonnas). */
  assert.deepEqual(view.careWorkers.map((worker) => worker.name), ['Anu Hooldaja', 'Bert Hooldaja']);
  /* Pärastlõunal (15.30) on kella 10 käik kirjeta; kella 14 käigu lubatud aeg ei ole veel täis. */
  const afternoon = await getDayPlan(lead, {}, deps(at('2026-10-09T12:30:00Z')));
  assert.deepEqual([afternoon.totals.missing, rows(afternoon.workers[1].visits), rows(afternoon.unassigned)], [1, [['10:00', 'Peeter Põhi', 'MISSING']], [['14:00', 'Peeter Põhi', 'PLANNED']]]);
  /* Möödunud reede (02.10): ühtegi kirjet ei ole, kõik käigud on kirjeta. */
  const past = await getDayPlan(lead, { day: '2026-10-02' }, deps());
  assert.deepEqual([past.day, past.totals.planned, past.totals.missing, past.week[0].day], ['2026-10-02', 4, 4, '2026-09-28']);

  /* Õigused: hooldaja ei näe päevaplaani ega muuda; teise asutuse juht klienti ei näe; üksuse juht näeb oma üksust. */
  await expectError(getDayPlan(anu, {}, deps()), 403, 'org.errors.missing_capability');
  const move = { day: today, workerMembershipId: f.members.anu.id, startTime: '15:00', note: 'Bert on arsti juures' };
  await expectError(moveVisit(anu, linda.id, lindaEvening.id, move, deps()), 403, 'org.errors.missing_capability');
  await expectError(moveVisit(leadB, peeter.id, peeterNoon.id, move, deps()), 404);
  const scoped = await getDayPlan(unitLead, {}, deps());
  assert.deepEqual([scoped.totals.planned, rows(scoped.unassigned), scoped.workers.map((worker) => worker.name), scoped.away], [2, [['14:00', 'Peeter Põhi', 'PLANNED']], ['Bert Hooldaja'], []]);
  /* Üksuse juht ei ole Linda (üksuseta klient) hooldusjuht ega meeskonna liige. */
  await expectError(moveVisit(unitLead, linda.id, lindaEvening.id, move, deps()), 403, 'home_care.errors.access_reason_required');

  /* Vigane ümbertõstmine ei salvestu. */
  const badMove = (patch, status, key) => expectError(moveVisit(lead, peeter.id, peeterNoon.id, { ...move, ...patch }, deps()), status, key);
  await badMove({ day: '' }, 400, 'home_care.errors.visit_day_required');
  await badMove({ day: '2026-10-08' }, 400, 'home_care.errors.visit_day_past');
  await badMove({ day: '2027-01-01' }, 400, 'home_care.errors.visit_day_far');
  await badMove({ day: '2026-10-10' }, 400, 'home_care.errors.visit_not_on_day');
  await badMove({ startTime: '25:00' }, 400, 'home_care.errors.slot_time_invalid');
  /* Töötaja, kes ei ole ühegi kliendi meeskonnas, ja teise asutuse töötaja ei ole selle asutuse hooldajad. */
  await badMove({ workerMembershipId: f.members.clerk.id }, 400, 'home_care.errors.visit_worker_invalid');
  await badMove({ workerMembershipId: f.members.leadB.id }, 400, 'home_care.errors.visit_worker_invalid');
  await expectError(moveVisit(lead, linda.id, peeterNoon.id, move, deps()), 404, 'home_care.errors.slot_not_found');
  assert.equal(await db.careVisitChange.count({ where: { organizationId: f.orgA.id } }), 0);

  /* ÜMBERTÕSTMINE: määramata käik läheb Anule (ta ei ole Peetri meeskonnas) ja kella 15 peale. */
  const moved = await moveVisit(lead, peeter.id, peeterNoon.id, move, deps());
  assert.deepEqual([moved.totals.unassigned, moved.unassigned], [0, []]);
  const covering = moved.workers[0].visits.find((visit) => visit.slotId === peeterNoon.id);
  assert.deepEqual(
    [moved.workers[0].name, covering.startTime, covering.worker.membershipId, covering.change],
    ['Anu Hooldaja', '15:00', f.members.anu.id, { kind: 'MOVED', reason: null, note: 'Bert on arsti juures', workerChanged: true, timeChanged: true }]
  );
  /* Hooldaja päev: asendus on tema päevas, kuigi ta ei ole kliendi meeskonnas; kolleegi päev ei muutunud. */
  const mine = async (who, now) => (await getMyDay(who, deps(now))).visits.map((visit) => [visit.startTime, visit.client.displayName, visit.state, visit.covering]);
  assert.deepEqual(await mine(anu), [
    ['09:00', 'Linda Tamm', 'DONE', false],
    ['15:00', 'Peeter Põhi', 'PLANNED', true],
    ['17:00', 'Linda Tamm', 'PLANNED', false]
  ]);
  assert.deepEqual(await mine(bert), [['10:00', 'Peeter Põhi', 'PLANNED', false]]);
  /* Tagasi mustri peale tõstmine kustutab erandi. */
  const back = await moveVisit(lead, peeter.id, peeterNoon.id, { day: today, workerMembershipId: null, startTime: '14:00' }, deps());
  assert.deepEqual([rows(back.unassigned), back.unassigned[0].change], [[['14:00', 'Peeter Põhi', 'PLANNED']], null]);
  assert.equal(await db.careVisitChange.count({ where: { slotId: peeterNoon.id } }), 0);
  /* Ainult töötaja vahetus: Berdi käik läheb Anule samal kellaajal. */
  const swapped = await moveVisit(lead, peeter.id, peeterMorning.id, { day: today, workerMembershipId: f.members.anu.id, startTime: '10:00' }, deps());
  const swap = swapped.workers[0].visits.find((visit) => visit.slotId === peeterMorning.id);
  assert.deepEqual([swapped.workers.map((worker) => worker.name), swap.change.workerChanged, swap.change.timeChanged], [['Anu Hooldaja'], true, false]);
  assert.deepEqual(await mine(bert), []);
  assert.deepEqual((await mine(anu)).map((row) => row[0]), ['09:00', '10:00', '17:00']);

  /* ÄRAJÄTMINE: põhjus on kohustuslik. Ära jäetud hommikune käik: päeva kirje katab õhtuse käigu. */
  await expectError(cancelVisit(lead, linda.id, lindaMorning.id, { day: today }, deps()), 400, 'home_care.errors.visit_cancel_reason_required');
  await expectError(cancelVisit(lead, linda.id, lindaMorning.id, { day: today, reason: 'LAZY' }, deps()), 400, 'home_care.errors.visit_cancel_reason_required');
  await expectError(cancelVisit(anu, linda.id, lindaMorning.id, { day: today, reason: 'OTHER' }, deps()), 403, 'org.errors.missing_capability');
  const cancelledMorning = await cancelVisit(lead, linda.id, lindaMorning.id, { day: today, reason: 'CLIENT_AWAY' }, deps());
  assert.deepEqual(
    rows(cancelledMorning.workers[0].visits.filter((visit) => visit.client.id === linda.id)),
    [['09:00', 'Linda Tamm', 'CANCELLED'], ['17:00', 'Linda Tamm', 'DONE']]
  );
  /* TAGASIVÕTMINE: käik on jälle nii, nagu mustris; ilma erandita käigul ei ole midagi tagasi võtta. */
  const restored = await restoreVisit(lead, linda.id, lindaMorning.id, { day: today }, deps());
  assert.deepEqual(rows(restored.workers[0].visits.filter((visit) => visit.client.id === linda.id)), [['09:00', 'Linda Tamm', 'DONE'], ['17:00', 'Linda Tamm', 'PLANNED']]);
  await expectError(restoreVisit(lead, linda.id, lindaMorning.id, { day: today }, deps()), 404, 'home_care.errors.visit_change_not_found');
  await expectError(restoreVisit(anu, linda.id, lindaMorning.id, { day: today }, deps()), 403, 'org.errors.missing_capability');
  /* Õhtune käik jääb ära: hooldaja näeb seda oma päevas ära jäetuna koos põhjusega. */
  const cancelled = await cancelVisit(lead, linda.id, lindaEvening.id, { day: today, reason: 'CLIENT_CANCELLED', note: 'Läheb tütre juurde' }, deps());
  assert.deepEqual(cancelled.totals, { planned: 3, minutes: 135, done: 1, missing: 0, cancelled: 1, unassigned: 1, uncovered: 0, obstacles: 0 });
  const dayOfAnu = await getMyDay(anu, deps());
  const evening = dayOfAnu.visits.find((visit) => visit.slotId === lindaEvening.id);
  assert.deepEqual([evening.state, evening.done, evening.change.reason, evening.change.note], ['CANCELLED', false, 'CLIENT_CANCELLED', 'Läheb tütre juurde']);
  /* Möödunud päeva kirjeta käigule saab põhjuse panna kuni nädal tagasi; ümber tõsta minevikku ei saa. */
  const pastCancelled = await cancelVisit(lead, linda.id, lindaMorning.id, { day: '2026-10-02', reason: 'CLIENT_AWAY' }, deps());
  assert.deepEqual([pastCancelled.day, pastCancelled.totals.missing, pastCancelled.totals.cancelled], ['2026-10-02', 3, 1]);
  await expectError(cancelVisit(lead, linda.id, lindaMorning.id, { day: '2026-09-25', reason: 'OTHER' }, deps()), 400, 'home_care.errors.visit_day_past');

  /* KUU KOKKUVÕTE loeb ära jäetud plaanitud käigud kliendi kaupa. */
  const month = await getMonthSummary(lead, {}, deps());
  assert.deepEqual(
    [month.totals.cancelled, month.clients.find((row) => row.client.id === linda.id).cancelled, month.clients.find((row) => row.client.id === peeter.id).cancelled],
    [2, 2, 0]
  );

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) =>
    db.careVisitChange.create({ data: { organizationId: f.orgA.id, clientId: peeter.id, slotId: peeterNoon.id, day: '2026-10-16', kind: 'MOVED', ...data } });
  await assert.rejects(raw({ kind: 'SKIPPED' }), /CareVisitChange_kind_check/);
  await assert.rejects(raw({ kind: 'CANCELLED' }), /CareVisitChange_kind_check/);
  await assert.rejects(raw({ kind: 'CANCELLED', reason: 'LAZY' }), /CareVisitChange_kind_check/);
  await assert.rejects(raw({ kind: 'CANCELLED', reason: 'OTHER', workerMembershipId: f.members.anu.id }), /CareVisitChange_kind_check/);
  await assert.rejects(raw({ reason: 'OTHER' }), /CareVisitChange_kind_check/);
  await assert.rejects(raw({ day: '16.10.2026' }), /CareVisitChange_day_check/);
  await assert.rejects(raw({ startMinute: 1440 }), /CareVisitChange_startMinute_check/);
  await assert.rejects(raw({ slotId: peeterMorning.id, day: today }), /CareVisitChange_slotId_day_key|Unique constraint/);

  /* AUDIT: iga erand jätab rea ainult ID-de ja muutuse liigiga. */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_visit_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual(audit.map((entry) => entry.meta.change).sort(), ['cancelled', 'cancelled', 'cancelled', 'moved', 'moved', 'restored', 'restored']);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'organizationId', 'slotId']);
});

test('puudumised ja käigu tähtsus: märkimine, õigused ning päevaplaani katmata käigud tähtsuse järjekorras', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi', unitId: north.id }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, linda.id, { membershipId: f.members.bert.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.bert.id }, deps());
  const today = '2026-10-09';
  const early = at('2026-10-01T08:00:00Z');
  const slotOf = async (client, startTime, member, priority) =>
    (await createSlots(lead, client.id, { weekdays: [5], startTime, plannedMinutes: 30, workerMembershipId: member.id, priority }, deps(early))).slots.find((slot) => slot.startTime === startTime);

  /* KÄIGU TÄHTSUS: mustri real; puudumisel on see B; tundmatu väärtus on viga. */
  const lindaMorning = await slotOf(linda, '09:00', f.members.anu, 'C');
  const lindaNoon = await slotOf(linda, '12:00', f.members.anu, 'A');
  const lindaEvening = await slotOf(linda, '17:00', f.members.anu);
  const peeterMorning = await slotOf(peeter, '10:00', f.members.bert);
  assert.deepEqual([lindaMorning.priority, lindaNoon.priority, lindaEvening.priority, peeterMorning.priority], ['C', 'A', 'B', 'B']);
  await expectError(
    createSlots(lead, linda.id, { weekdays: [1], startTime: '09:00', plannedMinutes: 30, priority: 'D' }, deps()),
    400,
    'home_care.errors.slot_priority_invalid'
  );

  /* Algus: puudumisi ei ole; hooldajad on inimesed, kes on mõne kliendi meeskonnas. */
  const empty = await getAbsences(lead, deps());
  assert.deepEqual([empty.today, empty.absences, empty.careWorkers.map((worker) => worker.name), empty.canEdit], [today, [], ['Anu Hooldaja', 'Bert Hooldaja'], true]);
  /* Puudumisi näeb ja märgib ainult hooldusjuht (ka üksuse oma); teise asutuse juht näeb oma tühja loendit. */
  const input = { membershipId: f.members.anu.id, fromDay: today, toDay: '2026-10-11', kind: 'SUDDEN' };
  await expectError(getAbsences(anu, deps()), 403, 'org.errors.missing_capability');
  await expectError(createAbsence(anu, input, deps()), 403, 'org.errors.missing_capability');
  const foreign = await getAbsences(leadB, deps());
  assert.deepEqual([foreign.absences, foreign.careWorkers], [[], []]);

  /* Vigane sisend ei salvestu. */
  const bad = (patch, key) => expectError(createAbsence(lead, { ...input, ...patch }, deps()), 400, key);
  await bad({ fromDay: '' }, 'home_care.errors.absence_days_required');
  await bad({ toDay: null }, 'home_care.errors.absence_days_required');
  await bad({ toDay: '2026-10-08' }, 'home_care.errors.absence_period_invalid');
  await bad({ fromDay: '2026-10-01' }, 'home_care.errors.absence_from_past');
  await bad({ toDay: '2027-10-10' }, 'home_care.errors.absence_too_long');
  await bad({ kind: 'SICK' }, 'home_care.errors.absence_kind_required');
  /* Töötaja, kes ei ole ühegi kliendi meeskonnas, ja teise asutuse töötaja ei ole selle asutuse hooldajad. */
  await bad({ membershipId: f.members.clerk.id }, 'home_care.errors.absence_worker_invalid');
  await bad({ membershipId: f.members.leadB.id }, 'home_care.errors.absence_worker_invalid');
  await bad({ membershipId: 'x' }, 'home_care.errors.absence_worker_invalid');
  assert.equal(await db.careAbsence.count({ where: { organizationId: f.orgA.id } }), 0);

  /* MÄRKIMINE: kolm päeva, täna kestev; sama töötaja puudumised ei tohi kattuda. */
  const made = await createAbsence(lead, input, deps());
  assert.deepEqual(
    made.absences.map((row) => [row.id, row.name, row.fromDay, row.toDay, row.days, row.kind, row.current, row.version]),
    [[made.absenceId, 'Anu Hooldaja', today, '2026-10-11', 3, 'SUDDEN', true, 1]]
  );
  await expectError(createAbsence(lead, { ...input, fromDay: '2026-10-11', toDay: '2026-10-15', kind: 'PLANNED' }, deps()), 409, 'home_care.errors.absence_overlap');
  /* Üksuse hooldusjuht märgib teise töötaja tulevase plaanilise puudumise. */
  const planned = await createAbsence(unitLead, { membershipId: f.members.bert.id, fromDay: '2026-10-20', toDay: '2026-10-21', kind: 'PLANNED' }, deps());
  assert.deepEqual(planned.absences.map((row) => [row.name, row.days, row.kind, row.current]), [
    ['Anu Hooldaja', 3, 'SUDDEN', true],
    ['Bert Hooldaja', 2, 'PLANNED', false]
  ]);

  /* PÄEVAPLAAN: puuduja tegemata käigud on omaette rühmas, tähtsamad ees (A, B, C). */
  const rows = (visits) => visits.map((visit) => [visit.startTime, visit.client.displayName, visit.priority, visit.state, visit.workerAbsent]);
  const view = await getDayPlan(lead, {}, deps());
  assert.deepEqual(rows(view.uncovered), [
    ['12:00', 'Linda Tamm', 'A', 'PLANNED', true],
    ['17:00', 'Linda Tamm', 'B', 'PLANNED', true],
    ['09:00', 'Linda Tamm', 'C', 'MISSING', true]
  ]);
  assert.deepEqual([view.totals.uncovered, view.totals.planned, view.unassigned, view.workers.map((worker) => worker.name)], [3, 4, [], ['Bert Hooldaja']]);
  assert.deepEqual(view.week.find((item) => item.day === today).uncovered, 3);
  /* Puudujat asendajaks ei pakuta; kliendi meeskond on kaasas, et tuttavat töötajat enne pakkuda. */
  assert.deepEqual(view.careWorkers.map((worker) => [worker.name, worker.absent]), [['Anu Hooldaja', true], ['Bert Hooldaja', false]]);
  assert.deepEqual([[...view.teams[linda.id]].sort(), view.teams[peeter.id]], [[f.members.anu.id, f.members.bert.id].sort(), [f.members.bert.id]]);
  await expectError(moveVisit(lead, peeter.id, peeterMorning.id, { day: today, workerMembershipId: f.members.anu.id }, deps()), 400, 'home_care.errors.visit_worker_absent');

  /* Puuduja enda päevas käike ei ole; kolleegi päev on tavaline. */
  const dayOfAnu = await getMyDay(anu, deps());
  assert.deepEqual([dayOfAnu.today, dayOfAnu.weekday, dayOfAnu.absent, dayOfAnu.visits], [today, 5, true, []]);
  /* Puudumise päevad on ka järgmiste päevade seas, käikudeta. */
  assert.deepEqual(dayOfAnu.next.map((item) => [item.day, item.absent, item.visits.map((visit) => visit.startTime)]), [
    ['2026-10-10', true, []],
    ['2026-10-11', true, []],
    ['2026-10-16', false, ['09:00', '12:00', '17:00']]
  ]);
  const dayOfBert = await getMyDay(bert, deps());
  assert.deepEqual([dayOfBert.absent, dayOfBert.visits.map((visit) => visit.startTime)], [false, ['10:00']]);

  /* Tehtud käik ei vaja asendajat: päeva kirje katab hommikuse käigu ja see läheb puuduja nime alla tehtuna. */
  await createEntry(bert, linda.id, { text: 'Käisin Anu asemel.', visitMinutes: 30, occurredAt: '2026-10-09T06:10:00Z' }, deps());
  const afterRecord = await getDayPlan(lead, {}, deps());
  assert.deepEqual(rows(afterRecord.uncovered).map((row) => row[0]), ['12:00', '17:00']);
  assert.deepEqual(afterRecord.workers.map((worker) => [worker.name, rows(worker.visits).map((row) => [row[0], row[3]])]), [
    ['Anu Hooldaja', [['09:00', 'DONE']]],
    ['Bert Hooldaja', [['10:00', 'PLANNED']]]
  ]);
  /* Tähtsaim käik tõstetakse meeskonnakaaslasele: see ei ole enam katmata ja on tema päevas. */
  const covered = await moveVisit(lead, linda.id, lindaNoon.id, { day: today, workerMembershipId: f.members.bert.id, startTime: '12:00' }, deps());
  assert.deepEqual([rows(covered.uncovered).map((row) => row[0]), covered.totals.uncovered], [['17:00'], 1]);
  assert.deepEqual((await getMyDay(bert, deps())).visits.map((visit) => [visit.startTime, visit.client.displayName, visit.covering]), [
    ['10:00', 'Peeter Põhi', false],
    ['12:00', 'Linda Tamm', false]
  ]);

  /* MUUTMINE: töötaja tuli varem tagasi. Nõuab nähtud versiooni ja hooldusjuhti; oma päevadega ei kattu iseendaga. */
  const shorter = { fromDay: today, toDay: today, kind: 'SUDDEN' };
  await expectError(updateAbsence(lead, made.absenceId, shorter, deps()), 400, 'home_care.errors.version_required');
  await expectError(updateAbsence(lead, made.absenceId, { ...shorter, version: 5 }, deps()), 409, 'home_care.errors.version_conflict');
  await expectError(updateAbsence(anu, made.absenceId, { ...shorter, version: 1 }, deps()), 403, 'org.errors.missing_capability');
  await expectError(updateAbsence(leadB, made.absenceId, { ...shorter, version: 1 }, deps()), 404, 'home_care.errors.absence_not_found');
  const updated = await updateAbsence(lead, made.absenceId, { ...shorter, version: 1 }, deps());
  assert.deepEqual(updated.absences.map((row) => [row.name, row.toDay, row.days, row.version])[0], ['Anu Hooldaja', today, 1, 2]);
  /* Muutmine ei tohi tekitada kattumist sama töötaja teise puudumisega. */
  const second = await createAbsence(lead, { ...input, fromDay: '2026-10-12', toDay: '2026-10-13', kind: 'PLANNED' }, deps());
  await expectError(updateAbsence(lead, made.absenceId, { fromDay: today, toDay: '2026-10-12', kind: 'SUDDEN', version: 2 }, deps()), 409, 'home_care.errors.absence_overlap');

  /* KUSTUTAMINE: ekslik puudumine kaob ja päevaplaanis ei ole enam katmata käike. */
  await expectError(removeAbsence(lead, made.absenceId, {}, deps()), 400, 'home_care.errors.version_required');
  await expectError(removeAbsence(anu, made.absenceId, { version: 2 }, deps()), 403, 'org.errors.missing_capability');
  const removed = await removeAbsence(lead, made.absenceId, { version: 2 }, deps());
  assert.deepEqual(removed.absences.map((row) => row.id).includes(made.absenceId), false);
  await expectError(removeAbsence(lead, made.absenceId, { version: 2 }, deps()), 404, 'home_care.errors.absence_not_found');
  const calm = await getDayPlan(lead, {}, deps());
  assert.deepEqual([calm.uncovered, calm.totals.uncovered, (await getMyDay(anu, deps())).absent], [[], 0, false]);
  assert.equal(second.absences.length, 3);

  /* Käigu tähtsuse muutus tänasest: juba kehtinud rida lõpeb ja uus kannab uut tähtsust. */
  const changed = await changeSlot(lead, linda.id, lindaEvening.id, { version: 1, startTime: '17:00', plannedMinutes: 30, workerMembershipId: f.members.anu.id, priority: 'A' }, deps());
  assert.deepEqual(changed.slots.filter((slot) => slot.startTime === '17:00').map((slot) => [slot.priority, slot.validFrom]), [['A', today]]);

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) => db.careAbsence.create({ data: { organizationId: f.orgA.id, membershipId: f.members.anu.id, fromDay: '2026-11-01', toDay: '2026-11-02', kind: 'PLANNED', ...data } });
  await assert.rejects(raw({ kind: 'SICK' }), /CareAbsence_kind_check/);
  await assert.rejects(raw({ toDay: '2026-10-31' }), /CareAbsence_days_check/);
  await assert.rejects(raw({ fromDay: '01.11.2026' }), /CareAbsence_days_check/);
  await assert.rejects(db.careVisitSlot.update({ where: { id: peeterMorning.id }, data: { priority: 'D' } }), /CareVisitSlot_priority_check/);

  /* AUDIT: puudumise muutus jätab rea ainult ID ja muutuse liigiga (töötajat, päevi ega liiki seal ei ole). */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_absence_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual(audit.map((entry) => entry.meta.change).sort(), ['created', 'created', 'created', 'removed', 'updated']);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['absenceId', 'change', 'organizationId']);
});

test('teade töötajale käikude muutumisest ja hooldaja järgmised päevad', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi' }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, linda.id, { membershipId: f.members.bert.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.bert.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.lead.id }, deps());
  const today = '2026-10-09';
  const early = at('2026-10-01T08:00:00Z');
  const TYPE = 'HOME_CARE_VISITS_CHANGED';
  const eventsFor = (user) => db.notificationEvent.findMany({ where: { userId: user.id, type: TYPE }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const counts = () => Promise.all([f.users.anu, f.users.bert, f.users.lead].map(async (user) => (await eventsFor(user)).length));
  /* Töötaja luges teate läbi: järgmine muutus toob uue. */
  const readAll = () => db.notificationEvent.updateMany({ where: { type: TYPE, workspaceId: f.orgA.id, readAt: null }, data: { readAt: NOW } });
  let tick = 0;
  const live = () => depsWithNotify(at(`2026-10-09T08:${String(++tick).padStart(2, '0')}:00Z`));

  /* MUSTER: Anule määratud käik kahel nädalapäeval toob talle ühe teate; teised ei saa midagi. */
  const made = await createSlots(lead, linda.id, { weekdays: [5, 1], startTime: '09:00', plannedMinutes: 30, workerMembershipId: f.members.anu.id }, depsWithNotify(early));
  assert.deepEqual(await counts(), [1, 0, 0]);
  const [first] = await eventsFor(f.users.anu);
  assert.deepEqual(
    [first.sourceType, first.sourceId, first.targetKind, first.targetId, first.workspaceId],
    ['ORGANIZATION_MEMBERSHIP', f.members.anu.id, 'CARE_WORKER_DAYS', f.members.anu.id, f.orgA.id]
  );
  /* Teavituse reas ei ole klienti, käiku, päeva ega kellaaega; link ei kanna asutuse ega kliendi ID-d. */
  const stored = JSON.stringify(first);
  for (const secret of ['Linda', linda.id, ...made.slots.map((slot) => slot.id), '09:00']) assert.equal(stored.includes(secret), false, secret);
  const shown = serializeNotificationEvent(first);
  assert.deepEqual([shown.href, shown.labelKey], [`/org/koduteenus/paevad/${f.members.anu.id}`, 'notifications.events.home_care_visits_changed']);
  /* Adressaat on ainult selle kehtiva liikmesuse omanik. */
  const probe = { type: TYPE, userId: f.users.anu.id, sourceId: f.members.anu.id, targetId: f.members.anu.id };
  await assertNotificationRecipient(db, probe);
  await assert.rejects(assertNotificationRecipient(db, { ...probe, userId: f.users.bert.id }), (error) => error.status === 404);
  await assert.rejects(assertNotificationRecipient(db, { ...probe, targetId: f.members.bert.id }), (error) => error.status === 404);

  /* ÜKS LUGEMATA TEADE KORRAGA: teine muutus, kui eelmine teade on lugemata, uut ei lisa. */
  await createSlots(lead, linda.id, { weekdays: [3], startTime: '11:00', plannedMinutes: 30, workerMembershipId: f.members.anu.id }, depsWithNotify(early));
  assert.deepEqual(await counts(), [1, 0, 0]);
  await readAll();
  /* Määramata käik ei puuduta kedagi; muutja ise teadet ei saa, kuigi käik on tema oma. */
  const open = await createSlots(lead, peeter.id, { weekdays: [5], startTime: '14:00', plannedMinutes: 45 }, depsWithNotify(early));
  await createSlots(lead, peeter.id, { weekdays: [2], startTime: '08:00', plannedMinutes: 30, workerMembershipId: f.members.lead.id }, depsWithNotify(early));
  assert.deepEqual(await counts(), [1, 0, 0]);

  /* MUSTRI MUUTUS: reedene käik läheb Anult Berdile: mõlemad saavad teate. */
  const friday = made.slots.find((slot) => slot.weekday === 5);
  const changed = await changeSlot(lead, linda.id, friday.id, { version: 1, startTime: '09:00', plannedMinutes: 30, workerMembershipId: f.members.bert.id }, live());
  assert.deepEqual(await counts(), [2, 1, 0]);
  const newFriday = changed.slots.find((slot) => slot.weekday === 5 && slot.startTime === '09:00');
  assert.equal(newFriday.validFrom, today);
  await readAll();

  /* PÄEV: tänane käik tõstetakse Berdilt Anule: mõlemad saavad teate. */
  await moveVisit(lead, linda.id, newFriday.id, { day: today, workerMembershipId: f.members.anu.id, startTime: '09:00' }, live());
  assert.deepEqual(await counts(), [3, 2, 0]);
  /* Sama käik jääb ära, kui teated on lugemata: uusi ei tule. */
  await cancelVisit(lead, linda.id, newFriday.id, { day: today, reason: 'CLIENT_AWAY' }, live());
  assert.deepEqual(await counts(), [3, 2, 0]);
  /* Tagasivõtmine pärast lugemist: käik on jälle mustri järgi Berdi oma, Anu päev ei muutunud. */
  await readAll();
  await restoreVisit(lead, linda.id, newFriday.id, { day: today }, live());
  assert.deepEqual(await counts(), [3, 3, 0]);
  await readAll();
  /* Ärajätmine teatab selle päeva tegijale; määramata käigu ärajätmine ei teata kellelegi. */
  await cancelVisit(lead, linda.id, newFriday.id, { day: today, reason: 'CLIENT_CANCELLED' }, live());
  await cancelVisit(lead, peeter.id, open.slots.find((slot) => slot.startTime === '14:00').id, { day: today, reason: 'OTHER' }, live());
  assert.deepEqual(await counts(), [3, 4, 0]);
  await readAll();
  /* Möödunud päeva käigule põhjuse panemine ei muuda kellegi eesolevat päeva: teadet ei tule. */
  await cancelVisit(lead, linda.id, friday.id, { day: '2026-10-02', reason: 'CLIENT_AWAY' }, live());
  assert.deepEqual(await counts(), [3, 4, 0]);

  /* HOOLDAJA JÄRGMISED PÄEVAD: homsest nädal ette, ainult päevad, kus on käike või puudumine. */
  const nextOf = async (who) =>
    (await getMyDay(who, deps())).next.map((item) => [item.day, item.weekday, item.absent, item.visits.map((visit) => [visit.startTime, visit.client.displayName, visit.state, visit.covering])]);
  assert.deepEqual(await nextOf(anu), [
    ['2026-10-12', 1, false, [['09:00', 'Linda Tamm', 'PLANNED', false]]],
    ['2026-10-14', 3, false, [['11:00', 'Linda Tamm', 'PLANNED', false]]]
  ]);
  /* Berdi järgmine reede; tänane ära jäetud käik on tema tänases päevas märgiga. */
  assert.deepEqual(await nextOf(bert), [['2026-10-16', 5, false, [['09:00', 'Linda Tamm', 'PLANNED', false]]]]);
  assert.deepEqual((await getMyDay(bert, deps())).visits.map((visit) => [visit.startTime, visit.state]), [['09:00', 'CANCELLED']]);
  /* Esmaspäevane käik tõstetakse Berdile kella 10 peale ja kolmapäevane jääb ära; Anul on teisipäevast puudumine. */
  const monday = made.slots.find((slot) => slot.weekday === 1);
  const wednesday = (await getClientSlots(lead, linda.id, deps())).slots.find((slot) => slot.weekday === 3);
  await moveVisit(lead, linda.id, monday.id, { day: '2026-10-12', workerMembershipId: f.members.bert.id, startTime: '10:00' }, live());
  await cancelVisit(lead, linda.id, wednesday.id, { day: '2026-10-14', reason: 'CLIENT_AWAY' }, live());
  assert.deepEqual(await counts(), [4, 5, 0]);
  await createAbsence(lead, { membershipId: f.members.anu.id, fromDay: '2026-10-13', toDay: '2026-10-14', kind: 'PLANNED' }, deps());
  assert.deepEqual(await nextOf(anu), [
    ['2026-10-13', 2, true, []],
    ['2026-10-14', 3, true, []]
  ]);
  assert.deepEqual(await nextOf(bert), [
    ['2026-10-12', 1, false, [['10:00', 'Linda Tamm', 'PLANNED', false]]],
    ['2026-10-16', 5, false, [['09:00', 'Linda Tamm', 'PLANNED', false]]]
  ]);

  /* MUSTRI LÕPETAMINE: täna alanud rida kustub; töötaja saab teate ka siis ja link ei jää rippuma. */
  await readAll();
  await endSlot(lead, linda.id, newFriday.id, { version: newFriday.version }, live());
  assert.equal(await db.careVisitSlot.count({ where: { id: newFriday.id } }), 0);
  assert.deepEqual(await counts(), [4, 6, 0]);
  const last = (await eventsFor(f.users.bert)).at(-1);
  await assertNotificationRecipient(db, { type: TYPE, userId: f.users.bert.id, sourceId: last.sourceId, targetId: last.targetId });
  assert.deepEqual(await nextOf(bert), [['2026-10-12', 1, false, [['10:00', 'Linda Tamm', 'PLANNED', false]]]]);
  /* Peatatud liikmesusega töötajale teadet ei tehta ja vana teade ei ole enam tema oma. */
  await readAll();
  await db.organizationMembership.update({ where: { id: f.members.bert.id }, data: { status: 'SUSPENDED' } });
  await moveVisit(lead, linda.id, monday.id, { day: '2026-10-12', workerMembershipId: f.members.anu.id, startTime: '09:00' }, live());
  assert.deepEqual(await counts(), [5, 6, 0]);
  await assert.rejects(
    assertNotificationRecipient(db, { type: TYPE, userId: f.users.bert.id, sourceId: last.sourceId, targetId: last.targetId }),
    (error) => error.status === 404
  );
});

test('hooldaja takistuse teade: teatamine, tagasivõtmine, hooldusjuhi päevaplaan ja puudumine teate juurest', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  const south = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Lõuna ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: south.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const southLead = await f.ctx(f.users.cover, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm', unitId: north.id }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi', unitId: south.id }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.bert.id }, deps());
  const today = '2026-10-09';
  const early = at('2026-10-01T08:00:00Z');
  const slotOf = async (client, startTime, member, priority) =>
    (await createSlots(lead, client.id, { weekdays: [5], startTime, plannedMinutes: 30, workerMembershipId: member.id, priority }, deps(early))).slots.find((slot) => slot.startTime === startTime);
  /* Anu päev: 07:00 (tehtud), 09:00 C, 12:00 A, 17:00 B. Bert: 10:00. Kell on 08:00 UTC = 11:00 Tallinnas. */
  await slotOf(linda, '07:00', f.members.anu);
  await slotOf(linda, '09:00', f.members.anu, 'C');
  const noon = await slotOf(linda, '12:00', f.members.anu, 'A');
  await slotOf(linda, '17:00', f.members.anu);
  await slotOf(peeter, '10:00', f.members.bert);
  await createEntry(anu, linda.id, { text: 'Hommikune käik.', visitMinutes: 30, occurredAt: '2026-10-09T04:10:00Z' }, deps());

  const TYPE = 'HOME_CARE_OBSTACLE_REPORTED';
  const eventsFor = (user) => db.notificationEvent.findMany({ where: { userId: user.id, type: TYPE }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const counts = () => Promise.all([f.users.lead, f.users.cover, f.users.anu, f.users.bert].map(async (user) => (await eventsFor(user)).length));
  let tick = 0;
  const live = () => depsWithNotify(at(`2026-10-09T08:${String(++tick).padStart(2, '0')}:00Z`));

  /* TEATAMINE: liik on kohustuslik valik; teatab ainult hooldaja (mõne kliendi meeskonnas). */
  await expectError(reportObstacle(anu, {}, live()), 400, 'home_care.errors.obstacle_kind_required');
  await expectError(reportObstacle(anu, { kind: 'SICK' }, live()), 400, 'home_care.errors.obstacle_kind_required');
  await expectError(reportObstacle(clerk, { kind: 'LATE_30' }, live()), 403, 'home_care.errors.obstacle_not_worker');
  await expectError(reportObstacle(lead, { kind: 'LATE_30' }, live()), 403, 'home_care.errors.obstacle_not_worker');
  assert.equal(await db.careObstacle.count({ where: { organizationId: f.orgA.id } }), 0);
  assert.equal((await getMyDay(anu, deps())).obstacle, null);

  const sentAt = live();
  const sent = await reportObstacle(anu, { kind: 'LATE_30' }, sentAt);
  assert.deepEqual(sent.obstacle, { id: sent.obstacle.id, kind: 'LATE_30', reportedAt: sentAt.now.toISOString(), handled: false });
  assert.deepEqual((await getMyDay(anu, deps())).obstacle, sent.obstacle);
  /* Teavitus: kogu asutuse hooldusjuht saab; Lõuna üksuse hooldusjuht ei saa, sest Anu kliendid on Põhjas. */
  assert.deepEqual(await counts(), [1, 0, 0, 0]);
  const [event] = await eventsFor(f.users.lead);
  assert.deepEqual([event.sourceType, event.sourceId, event.targetKind, event.targetId, event.workspaceId], ['CARE_OBSTACLE', sent.obstacle.id, 'CARE_OBSTACLE', sent.obstacle.id, f.orgA.id]);
  const stored = JSON.stringify(event);
  for (const secret of ['LATE_30', 'Anu', f.members.anu.id, 'Linda', linda.id]) assert.equal(stored.includes(secret), false, secret);
  assert.equal(serializeNotificationEvent(event).href, `/org/koduteenus/takistus/${sent.obstacle.id}`);
  const probe = { type: TYPE, userId: f.users.lead.id, sourceId: sent.obstacle.id, targetId: sent.obstacle.id };
  await assertNotificationRecipient(db, probe);
  await assertNotificationRecipient(db, { ...probe, userId: f.users.cover.id });
  await assert.rejects(assertNotificationRecipient(db, { ...probe, userId: f.users.bert.id }), (error) => error.status === 404);
  await assert.rejects(assertNotificationRecipient(db, { ...probe, userId: f.users.leadB.id }), (error) => error.status === 404);

  /* Sama liigi kordus ei tee uut rida ega uut teavitust (topeltvajutus). */
  const again = await reportObstacle(anu, { kind: 'LATE_30' }, live());
  assert.equal(again.obstacle.id, sent.obstacle.id);
  assert.deepEqual([await db.careObstacle.count({ where: { organizationId: f.orgA.id } }), await counts()], [1, [1, 0, 0, 0]]);

  /* PÄEVAPLAAN: lahtise teatega töötaja tegemata käigud on teate juures tähtsuse järjekorras; tehtud käik jääb tema rühma. */
  const rows = (visits) => visits.map((visit) => [visit.startTime, visit.priority, visit.state]);
  const view = await getDayPlan(lead, {}, deps());
  assert.deepEqual(
    view.obstacles.map((item) => [item.id, item.name, item.kind, item.reportedAt, rows(item.visits)]),
    [[sent.obstacle.id, 'Anu Hooldaja', 'LATE_30', sentAt.now.toISOString(), [['12:00', 'A', 'PLANNED'], ['17:00', 'B', 'PLANNED'], ['09:00', 'C', 'MISSING']]]]
  );
  assert.deepEqual(view.workers.map((worker) => [worker.name, worker.obstacle, rows(worker.visits)]), [
    ['Anu Hooldaja', null, [['07:00', 'B', 'DONE']]],
    ['Bert Hooldaja', null, [['10:00', 'B', 'PLANNED']]]
  ]);
  assert.deepEqual([view.totals.obstacles, view.totals.planned, view.totals.uncovered], [1, 5, 0]);
  /* Üksuse hooldusjuht näeb teadet ainult siis, kui töötajal on sel päeval käik tema skoobis. */
  const southView = await getDayPlan(southLead, {}, deps());
  assert.deepEqual([southView.obstacles, southView.workers.map((worker) => worker.name)], [[], ['Bert Hooldaja']]);
  /* Teade ise käike ei muuda: erandeid ega puudumisi ei tekkinud. */
  assert.deepEqual([await db.careVisitChange.count({ where: { organizationId: f.orgA.id } }), await db.careAbsence.count({ where: { organizationId: f.orgA.id } })], [0, 0]);

  /* TEINE LIIK võtab eelmise lahtise teate tagasi ja teeb uue; hooldusjuht saab uue teavituse. */
  const changed = await reportObstacle(anu, { kind: 'CAR_BROKEN' }, live());
  assert.notEqual(changed.obstacle.id, sent.obstacle.id);
  assert.deepEqual(await counts(), [2, 0, 0, 0]);
  assert.deepEqual(
    (await db.careObstacle.findMany({ where: { organizationId: f.orgA.id }, orderBy: { createdAt: 'asc' } })).map((row) => [row.kind, Boolean(row.withdrawnAt), Boolean(row.handledAt)]),
    [['LATE_30', true, false], ['CAR_BROKEN', false, false]]
  );
  /* Tagasi võetud teate teavitus ei ole enam näidatav. */
  await assert.rejects(assertNotificationRecipient(db, probe), (error) => error.status === 404);
  assert.deepEqual((await getDayPlan(lead, {}, deps())).obstacles.map((item) => item.kind), ['CAR_BROKEN']);

  /* TAGASIVÕTMINE: ainult oma teade; pärast seda teadet päevaplaanis ei ole ja käigud on tagasi töötaja rühmas. */
  await expectError(withdrawObstacle(bert, changed.obstacle.id, deps()), 404, 'home_care.errors.obstacle_not_found');
  await expectError(withdrawObstacle(lead, changed.obstacle.id, deps()), 404, 'home_care.errors.obstacle_not_found');
  await expectError(withdrawObstacle(anu, 'olematu-id', deps()), 404, 'home_care.errors.obstacle_not_found');
  assert.deepEqual(await withdrawObstacle(anu, changed.obstacle.id, live()), { obstacle: null });
  assert.deepEqual(await withdrawObstacle(anu, changed.obstacle.id, live()), { obstacle: null });
  const calm = await getDayPlan(lead, {}, deps());
  assert.deepEqual([calm.obstacles, calm.totals.obstacles, calm.workers[0].visits.length], [[], 0, 4]);
  await expectError(handleObstacle(lead, changed.obstacle.id, {}, deps()), 409, 'home_care.errors.obstacle_withdrawn');

  /* VAADATUKS MÄRKIMINE: ainult hooldusjuht; puudumist saab märkida ainult teate „ei saa täna töötada" juurest. */
  const late = await reportObstacle(anu, { kind: 'LATE_60' }, live());
  await expectError(handleObstacle(anu, late.obstacle.id, {}, deps()), 403, 'org.errors.missing_capability');
  await expectError(handleObstacle(leadB, late.obstacle.id, {}, deps()), 404, 'home_care.errors.obstacle_not_found');
  await expectError(handleObstacle(lead, late.obstacle.id, { markAbsent: true }, deps()), 400, 'home_care.errors.obstacle_absence_invalid');
  assert.deepEqual(await handleObstacle(lead, late.obstacle.id, {}, deps(at('2026-10-09T08:30:00Z'))), { day: today });
  /* Teine kord ei muuda midagi. */
  assert.deepEqual(await handleObstacle(southLead, late.obstacle.id, {}, deps(at('2026-10-09T08:40:00Z'))), { day: today });
  const handled = await db.careObstacle.findUnique({ where: { id: late.obstacle.id } });
  assert.deepEqual([handled.handledAt.toISOString(), handled.handledByMembershipId, handled.handledByName], ['2026-10-09T08:30:00.000Z', f.members.lead.id, 'Juta Juht']);
  /* Vaadatud teade: käigud on tagasi töötaja rühmas, teade on rühma juures märgiks; töötaja näeb, et teade on vaadatud. */
  const seen = await getDayPlan(lead, {}, deps());
  assert.deepEqual([seen.obstacles, seen.workers[0].name, seen.workers[0].visits.length], [[], 'Anu Hooldaja', 4]);
  assert.deepEqual(
    [seen.workers[0].obstacle.id, seen.workers[0].obstacle.kind, seen.workers[0].obstacle.handledByName, seen.workers[1].obstacle],
    [late.obstacle.id, 'LATE_60', 'Juta Juht', null]
  );
  assert.deepEqual((await getMyDay(anu, deps())).obstacle, { ...late.obstacle, handled: true });
  await expectError(withdrawObstacle(anu, late.obstacle.id, deps()), 409, 'home_care.errors.obstacle_handled');

  /* „EI SAA TÄNA TÖÖTADA": hooldusjuht märgib teate juurest päeva puudumise; tegemata käigud lähevad rühma „tegija puudub". */
  const cannot = await reportObstacle(anu, { kind: 'CANNOT_WORK' }, live());
  assert.deepEqual(await counts(), [4, 0, 0, 0]);
  assert.deepEqual(rows((await getDayPlan(lead, {}, deps())).obstacles[0].visits).map((row) => row[0]), ['12:00', '17:00', '09:00']);
  assert.deepEqual(await handleObstacle(lead, cannot.obstacle.id, { markAbsent: true }, deps()), { day: today });
  assert.deepEqual(
    (await db.careAbsence.findMany({ where: { organizationId: f.orgA.id } })).map((row) => [row.membershipId, row.fromDay, row.toDay, row.kind, row.createdByName]),
    [[f.members.anu.id, today, today, 'SUDDEN', 'Juta Juht']]
  );
  const absent = await getDayPlan(lead, {}, deps());
  assert.deepEqual([absent.obstacles, rows(absent.uncovered).map((row) => row[0]), absent.totals.uncovered], [[], ['12:00', '17:00', '09:00'], 3]);
  assert.equal((await getMyDay(anu, deps())).absent, true);
  /* Kordus ei tee teist puudumist. */
  await handleObstacle(lead, cannot.obstacle.id, { markAbsent: true }, deps());
  assert.equal(await db.careAbsence.count({ where: { organizationId: f.orgA.id } }), 1);
  /* Katmata käigu saab kolleegile tõsta nagu ikka. */
  const covered = await moveVisit(lead, linda.id, noon.id, { day: today, workerMembershipId: f.members.bert.id, startTime: '12:00' }, deps());
  assert.equal(covered.totals.uncovered, 2);

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) => db.careObstacle.create({ data: { organizationId: f.orgA.id, membershipId: f.members.bert.id, day: '2026-10-10', kind: 'LATE_30', ...data } });
  await assert.rejects(raw({ kind: 'SICK' }), /CareObstacle_kind_check/);
  await assert.rejects(raw({ day: '10.10.2026' }), /CareObstacle_day_check/);
  await assert.rejects(raw({ withdrawnAt: NOW, handledAt: NOW }), /CareObstacle_state_check/);
  await raw({});
  await assert.rejects(raw({ kind: 'LATE_60' }), (error) => error.code === 'P2002');

  /* AUDIT: iga muutus jätab rea ainult ID ja muutuse liigiga (töötajat, päeva ega takistuse liiki seal ei ole). */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_obstacle_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual(audit.map((entry) => entry.meta.change).sort(), ['handled', 'handled', 'reported', 'reported', 'reported', 'reported', 'withdrawn', 'withdrawn']);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'obstacleId', 'organizationId']);
});

test('nädalaplaan: käigud töötaja ja päeva kaupa, puudumised ette, skoop ja nädalate piirid', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi', unitId: north.id }, deps())).client;
  const mari = (await createClient(lead, { displayName: 'Mari Ära' }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, linda.id, { membershipId: f.members.bert.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.bert.id }, deps());
  await addTeamMember(lead, mari.id, { membershipId: f.members.bert.id }, deps());
  const early = at('2026-10-01T08:00:00Z');
  const add = (client, weekdays, startTime, plannedMinutes, member) =>
    createSlots(lead, client.id, { weekdays, startTime, plannedMinutes, ...(member ? { workerMembershipId: member.id } : {}) }, deps(early));
  /* Linda: E, K, R kell 9 (30 min) ja R kell 17 (60 min), Anu. Peeter: T ja N kell 10 (45 min), Bert; R kell 14 (20 min) määramata. */
  const morning = await add(linda, [1, 3, 5], '09:00', 30, f.members.anu);
  await add(linda, [5], '17:00', 60, f.members.anu);
  await add(peeter, [2, 4], '10:00', 45, f.members.bert);
  await add(peeter, [5], '14:00', 20, null);
  /* Ajutiselt ära oleva kliendi käigud ei ole kellegi koormus. */
  await add(mari, [1, 2, 3, 4, 5], '08:00', 30, f.members.bert);
  const mariNow = await db.careClient.findUnique({ where: { id: mari.id }, select: { version: true } });
  await setClientStatus(lead, mari.id, { version: mariNow.version, status: 'AWAY', statusReason: 'HOSPITAL' }, deps());

  /* Ainult hooldusjuht; teise asutuse juht näeb oma tühja nädalat; vigane päev on viga. */
  await expectError(getWeekPlan(anu, {}, deps()), 403, 'org.errors.missing_capability');
  await expectError(getWeekPlan(lead, { week: 'abc' }, deps()), 400, 'home_care.errors.invalid_date');
  const foreign = await getWeekPlan(leadB, {}, deps());
  assert.deepEqual([foreign.workers, foreign.totals], [[], { visits: 0, minutes: 0, unassigned: 0, uncovered: 0 }]);

  /* SEE NÄDAL (41: 05.10 kuni 11.10; täna on reede 09.10). */
  const cells = (row) => row.days.map((day) => day.visits);
  const now = await getWeekPlan(lead, {}, deps());
  assert.deepEqual(
    [now.week, now.monday, now.sunday, now.today, now.thisWeek, now.previousWeek, now.nextWeek],
    [41, '2026-10-05', '2026-10-11', '2026-10-09', '2026-10-05', '2026-09-28', '2026-10-12']
  );
  assert.deepEqual(
    now.days.map((day) => [day.day, day.weekday, day.visits, day.minutes, day.unassigned, day.uncovered]),
    [
      ['2026-10-05', 1, 1, 30, 0, 0],
      ['2026-10-06', 2, 1, 45, 0, 0],
      ['2026-10-07', 3, 1, 30, 0, 0],
      ['2026-10-08', 4, 1, 45, 0, 0],
      ['2026-10-09', 5, 3, 110, 1, 0],
      ['2026-10-10', 6, 0, 0, 0, 0],
      ['2026-10-11', 7, 0, 0, 0, 0]
    ]
  );
  assert.deepEqual(now.totals, { visits: 7, minutes: 260, unassigned: 1, uncovered: 0 });
  assert.deepEqual(
    now.workers.map((row) => [row.name, row.active, row.visits, row.minutes, row.uncovered, cells(row)]),
    [
      ['Anu Hooldaja', true, 4, 150, 0, [1, 0, 1, 0, 2, 0, 0]],
      ['Bert Hooldaja', true, 2, 90, 0, [0, 1, 0, 1, 0, 0, 0]]
    ]
  );
  assert.deepEqual([now.unassigned.visits, now.unassigned.minutes, now.unassigned.days.map((day) => day.visits)], [1, 20, [0, 0, 0, 0, 1, 0, 0]]);

  /* JÄRGMINE NÄDAL: Anul on kolmapäevast reedeni plaaniline puudumine; reede hommikune käik on juba Berdile tõstetud. */
  await createAbsence(lead, { membershipId: f.members.anu.id, fromDay: '2026-10-14', toDay: '2026-10-16', kind: 'PLANNED' }, deps());
  const friday = morning.slots.find((slot) => slot.weekday === 5 && slot.startTime === '09:00');
  await moveVisit(lead, linda.id, friday.id, { day: '2026-10-16', workerMembershipId: f.members.bert.id, startTime: '09:00' }, deps());
  /* Nädala leiab mis tahes selle nädala päeva järgi. */
  const next = await getWeekPlan(lead, { week: '2026-10-14' }, deps());
  assert.deepEqual([next.week, next.monday, next.previousWeek, next.nextWeek], [42, '2026-10-12', '2026-10-05', '2026-10-19']);
  assert.deepEqual(
    next.days.map((day) => [day.visits, day.minutes, day.unassigned, day.uncovered]),
    [[1, 30, 0, 0], [1, 45, 0, 0], [1, 30, 0, 1], [1, 45, 0, 0], [3, 110, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]]
  );
  assert.deepEqual(next.totals, { visits: 7, minutes: 260, unassigned: 1, uncovered: 2 });
  const [anuRow, bertRow] = next.workers;
  assert.deepEqual([anuRow.name, anuRow.visits, anuRow.minutes, anuRow.uncovered], ['Anu Hooldaja', 1, 30, 2]);
  assert.deepEqual(
    anuRow.days.map((day) => [day.visits, day.uncovered, day.absent]),
    [[1, 0, false], [0, 0, false], [0, 1, true], [0, 0, true], [0, 1, true], [0, 0, false], [0, 0, false]]
  );
  /* Asendus on asendaja koormuses: Berdil on reedel Linda hommikune käik. */
  assert.deepEqual([bertRow.name, bertRow.visits, bertRow.minutes, cells(bertRow)], ['Bert Hooldaja', 3, 120, [0, 1, 0, 1, 1, 0, 0]]);

  /* ÜKSUSE HOOLDUSJUHT näeb ainult oma üksuse klientide käike. */
  const unitView = await getWeekPlan(unitLead, {}, deps());
  assert.deepEqual([unitView.workers.map((row) => [row.name, row.visits]), unitView.totals], [[['Bert Hooldaja', 2]], { visits: 3, minutes: 110, unassigned: 1, uncovered: 0 }]);

  /* PIIRID: ette 13 ja tagasi 8 nädalat; kaugem nädal annab lähima lubatud nädala. */
  const far = await getWeekPlan(lead, { week: '2027-06-01' }, deps());
  assert.deepEqual([far.monday, far.week, far.nextWeek, far.previousWeek], ['2027-01-04', 1, null, '2026-12-28']);
  const old = await getWeekPlan(lead, { week: '2026-01-01' }, deps());
  assert.deepEqual([old.monday, old.previousWeek, old.nextWeek, old.totals.visits], ['2026-08-10', null, '2026-08-17', 0]);
  /* Eelmine nädal: muster algas neljapäeval 01.10, varasemaid käike ei ole. */
  const before = await getWeekPlan(lead, { week: now.previousWeek }, deps());
  assert.deepEqual(before.days.map((day) => day.visits), [0, 0, 0, 1, 3, 0, 0]);
  /* Nädalaplaan ei salvesta midagi. */
  assert.equal(await db.careVisitChange.count({ where: { organizationId: f.orgA.id } }), 1);
});

test('töö iseloom: märge kliendi juures, õigused ja raske töö käikude loendurid', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi', unitId: north.id }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, linda.id, { membershipId: f.members.bert.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.bert.id }, deps());
  const input = { kinds: ['PAIR_ONLY', 'PHYSICAL'], reason: '  Tõstmine voodist ratastooli   ilma tõstukita. ', reviewOn: '2026-10-20' };

  /* Algus: märget ei ole. */
  assert.equal((await openClient(anu, linda.id, deps())).workNature, null);

  /* Paneb ainult hooldusjuht, kelle skoobis klient on; vigane sisend ei salvestu. */
  await expectError(setWorkNature(anu, linda.id, input, deps()), 403, 'org.errors.missing_capability');
  await expectError(setWorkNature(unitLead, linda.id, input, deps()), 403);
  await expectError(setWorkNature(leadB, linda.id, input, deps()), 404, 'home_care.errors.client_not_found');
  const bad = (patch, key) => expectError(setWorkNature(lead, linda.id, { ...input, ...patch }, deps()), 400, key);
  await bad({ kinds: [] }, 'home_care.errors.work_nature_kinds_required');
  await bad({ kinds: 'PHYSICAL' }, 'home_care.errors.work_nature_kinds_required');
  await bad({ kinds: ['PHYSICAL', 'LAZY'] }, 'home_care.errors.work_nature_kinds_required');
  await bad({ reason: '   ' }, 'home_care.errors.work_nature_reason_required');
  await bad({ reason: 'x'.repeat(501) }, 'home_care.errors.text_too_long');
  await bad({ reviewOn: '2026-10-08' }, 'home_care.errors.work_nature_review_past');
  await bad({ reviewOn: 'homme' }, 'home_care.errors.invalid_date');
  assert.equal(await db.careWorkNature.count({ where: { organizationId: f.orgA.id } }), 0);
  await expectError(clearWorkNature(lead, linda.id, deps()), 404, 'home_care.errors.work_nature_not_found');

  /* MÄRGE: liigid sõnastiku järjekorras, põhjus ühe reana; näeb igaüks, kes tohib kliendi lehte avada. */
  const set = await setWorkNature(lead, linda.id, input, deps());
  assert.deepEqual(set.workNature, {
    id: set.workNature.id,
    kinds: ['PHYSICAL', 'PAIR_ONLY'],
    reason: 'Tõstmine voodist ratastooli ilma tõstukita.',
    reviewOn: '2026-10-20',
    setByName: 'Juta Juht',
    setAt: NOW.toISOString()
  });
  assert.deepEqual((await openClient(anu, linda.id, deps())).workNature, set.workNature);
  assert.equal((await openClient(bert, peeter.id, deps())).workNature, null);

  /* UUS MÄRGE lõpetab eelmise: kehtiv on üks, vana jääb ajalukku. Ülevaatuse päev võib puududa. */
  const later = at('2026-10-09T09:00:00Z');
  const changed = await setWorkNature(lead, linda.id, { kinds: ['MENTAL'], reason: 'Klient on sageli ärritunud.' }, deps(later));
  assert.deepEqual([changed.workNature.kinds, changed.workNature.reviewOn], [['MENTAL'], null]);
  assert.deepEqual(
    (await db.careWorkNature.findMany({ where: { clientId: linda.id }, orderBy: { createdAt: 'asc' } })).map((row) => [row.kinds, Boolean(row.endedAt), row.endedByName]),
    [[['PHYSICAL', 'PAIR_ONLY'], true, 'Juta Juht'], [['MENTAL'], false, null]]
  );
  /* Üksuse hooldusjuht paneb märke oma üksuse kliendile, ülevaatusega nädala pärast. */
  await setWorkNature(unitLead, peeter.id, { kinds: ['ENVIRONMENT'], reason: 'Ahiküte ja vesi kaevust.', reviewOn: '2026-10-16' }, deps());

  /* TÄHTAJAD: märked, mille ülevaatus on 30 päeva sees; märge ilma ülevaatuse päevata siia ei tule. */
  const deadlines = await getDeadlines(lead, deps());
  assert.deepEqual(deadlines.workNatureDue.map((item) => [item.client.displayName, item.reviewOn, item.daysLeft, item.overdue]), [['Peeter Põhi', '2026-10-16', 7, false]]);
  assert.deepEqual((await getDeadlines(lead, deps(at('2026-10-20T08:00:00Z')))).workNatureDue.map((item) => [item.daysLeft, item.overdue]), [[-4, true]]);

  /* LOENDURID. Käigud: Anu 2 × Linda juures, Bert 1 × Linda ja 1 × Peetri juures; Linda ja Peeter on mõlemad märgiga. */
  const visit = (who, client, hour) => createEntry(who, client.id, { text: 'Käik.', visitMinutes: 30, occurredAt: `2026-10-0${hour}T07:00:00Z` }, deps());
  await visit(anu, linda, 5);
  await visit(anu, linda, 6);
  await visit(bert, linda, 7);
  await visit(bert, peeter, 8);
  const month = await getMonthSummary(lead, {}, deps());
  assert.deepEqual(month.workers.map((row) => [row.name, row.visits, row.heavy]), [['Anu Hooldaja', 2, 2], ['Bert Hooldaja', 2, 2]]);
  /* Üksuse hooldusjuht näeb ainult oma üksuse käike. */
  assert.deepEqual((await getMonthSummary(unitLead, {}, deps())).workers.map((row) => [row.name, row.visits, row.heavy]), [['Bert Hooldaja', 1, 1]]);
  /* Käigu määramisel on meeskonnaliikme juures ka raske töö käikude arv KÕIGI klientide juures 28 päeva jooksul. */
  assert.deepEqual(
    (await getSlotEditor(lead, linda.id, deps())).team.map((member) => [member.name, member.recentVisits, member.heavyRecent]),
    [['Anu Hooldaja', 2, 2], ['Bert Hooldaja', 1, 2]]
  );

  /* Nädalaplaan: plaanitud käigud märgiga klientide juures töötaja kaupa. */
  const early = at('2026-10-01T08:00:00Z');
  await createSlots(lead, linda.id, { weekdays: [1, 3], startTime: '09:00', plannedMinutes: 30, workerMembershipId: f.members.anu.id }, deps(early));
  await createSlots(lead, peeter.id, { weekdays: [2], startTime: '10:00', plannedMinutes: 30, workerMembershipId: f.members.bert.id }, deps(early));
  const week = await getWeekPlan(lead, {}, deps());
  assert.deepEqual(week.workers.map((row) => [row.name, row.visits, row.heavy]), [['Anu Hooldaja', 2, 2], ['Bert Hooldaja', 1, 1]]);

  /* MAHAVÕTMINE: märget ei ole, rida jääb ajalukku; nädalaplaan loeb ainult praegu kehtivaid märkeid, kuu kokkuvõte selle kuu omi. */
  await expectError(clearWorkNature(anu, linda.id, deps()), 403, 'org.errors.missing_capability');
  assert.deepEqual(await clearWorkNature(lead, linda.id, deps(at('2026-10-09T10:00:00Z'))), { workNature: null });
  assert.equal((await openClient(anu, linda.id, deps())).workNature, null);
  assert.equal(await db.careWorkNature.count({ where: { clientId: linda.id } }), 2);
  assert.deepEqual((await getWeekPlan(lead, {}, deps())).workers.map((row) => [row.name, row.heavy]), [['Anu Hooldaja', 0], ['Bert Hooldaja', 1]]);
  assert.deepEqual((await getMonthSummary(lead, {}, deps())).workers.map((row) => row.heavy), [2, 2]);
  /* Järgmisel kuul Linda märget enam ei olnud: novembri käik tema juures ei ole raske töö käik. */
  await createEntry(anu, linda.id, { text: 'Novembri käik.', visitMinutes: 30, occurredAt: '2026-11-03T08:00:00Z' }, deps(at('2026-11-03T09:00:00Z')));
  const november = await getMonthSummary(lead, { month: '2026-11' }, deps(at('2026-11-04T08:00:00Z')));
  assert.deepEqual(november.workers.map((row) => [row.name, row.visits, row.heavy]), [['Anu Hooldaja', 1, 0]]);

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) => db.careWorkNature.create({ data: { organizationId: f.orgA.id, clientId: linda.id, kinds: ['PHYSICAL'], reason: 'Põhjus', ...data } });
  await assert.rejects(raw({ kinds: [] }), /CareWorkNature_kinds_check/);
  await assert.rejects(raw({ kinds: ['LAZY'] }), /CareWorkNature_kinds_check/);
  await assert.rejects(raw({ reason: '   ' }), /CareWorkNature_reason_check/);
  await assert.rejects(raw({ reviewOn: '20.10.2026' }), /CareWorkNature_reviewOn_check/);
  await raw({});
  await assert.rejects(raw({}), (error) => error.code === 'P2002');

  /* AUDIT: ainult ID-d ja muutuse liik (liike ega põhjust seal ei ole). */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_work_nature_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual(audit.map((entry) => entry.meta.change).sort(), ['cleared', 'set', 'set', 'set']);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'organizationId', 'workNatureId']);
});

test('eeltingimus enne teenuse algust: lisamine, lõpetamine, märk loendis ja tähtaegade nimekiri', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi', unitId: north.id }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  const input = { kind: 'CLEANING', responsible: '  Linna   sotsiaaltöötaja Mari ', dueOn: '2026-10-16' };

  /* Algus: eeltingimusi ei ole ja loendis märki ei ole. */
  assert.deepEqual((await openClient(anu, linda.id, deps())).preconditions, []);
  assert.deepEqual((await listClients(lead, {}, deps())).clients.map((row) => [row.displayName, row.waiting]), [['Linda Tamm', false], ['Peeter Põhi', false]]);

  /* Lisab ainult hooldusjuht, kelle skoobis klient on; vigane sisend ei salvestu. */
  await expectError(addPrecondition(anu, linda.id, input, deps()), 403, 'org.errors.missing_capability');
  await expectError(addPrecondition(unitLead, linda.id, input, deps()), 403);
  await expectError(addPrecondition(leadB, linda.id, input, deps()), 404, 'home_care.errors.client_not_found');
  const bad = (patch, key) => expectError(addPrecondition(lead, linda.id, { ...input, ...patch }, deps()), 400, key);
  await bad({ kind: '' }, 'home_care.errors.precondition_kind_required');
  await bad({ kind: 'PAINTING' }, 'home_care.errors.precondition_kind_required');
  await bad({ kind: 'OTHER' }, 'home_care.errors.precondition_note_required');
  await bad({ responsible: '  ' }, 'home_care.errors.precondition_responsible_required');
  await bad({ responsible: 'x'.repeat(201) }, 'home_care.errors.text_too_long');
  await bad({ dueOn: 'varsti' }, 'home_care.errors.invalid_date');
  assert.equal(await db.carePrecondition.count({ where: { organizationId: f.orgA.id } }), 0);

  /* LISAMINE: korraldaja ühe reana, tähtajani jäänud päevad tänase suhtes; näeb igaüks, kes tohib lehte avada. */
  const added = await addPrecondition(lead, linda.id, input, deps());
  assert.deepEqual(added.preconditions, [
    { id: added.preconditionId, kind: 'CLEANING', note: null, responsible: 'Linna sotsiaaltöötaja Mari', dueOn: '2026-10-16', daysLeft: 7, overdue: false, setByName: 'Juta Juht' }
  ]);
  assert.deepEqual((await openClient(anu, linda.id, deps())).preconditions, added.preconditions);
  /* Teine eeltingimus samale kliendile, ilma tähtajata; „muu" kannab täpsustust. */
  const second = await addPrecondition(lead, linda.id, { kind: 'OTHER', note: 'Trepikäsipuu on lahti', responsible: 'Poeg Jaan' }, deps(at('2026-10-09T09:00:00Z')));
  assert.deepEqual(second.preconditions.map((row) => [row.kind, row.note, row.dueOn, row.daysLeft, row.overdue]), [
    ['CLEANING', null, '2026-10-16', 7, false],
    ['OTHER', 'Trepikäsipuu on lahti', null, null, false]
  ]);
  /* Üksuse hooldusjuht lisab oma üksuse kliendile juba möödunud tähtajaga eeltingimuse. */
  const late = await addPrecondition(unitLead, peeter.id, { kind: 'HEATING', responsible: 'Vallavalitsus', dueOn: '2026-10-05' }, deps());
  assert.deepEqual(late.preconditions.map((row) => [row.daysLeft, row.overdue]), [[-4, true]]);

  /* LOEND: kliendil on märk, kuni mõni eeltingimus on täitmata. */
  assert.deepEqual((await listClients(lead, {}, deps())).clients.map((row) => [row.displayName, row.waiting]), [['Linda Tamm', true], ['Peeter Põhi', true]]);

  /* TÄHTAJAD: kõik täitmata eeltingimused; tähtajaga enne (varasem ees), tähtajata lõpus. Üksuse juht näeb oma üksust. */
  const deadlines = await getDeadlines(lead, deps());
  assert.deepEqual(
    deadlines.preconditionsOpen.map((item) => [item.client.displayName, item.kind, item.responsible, item.dueOn, item.daysLeft, item.overdue]),
    [
      ['Peeter Põhi', 'HEATING', 'Vallavalitsus', '2026-10-05', -4, true],
      ['Linda Tamm', 'CLEANING', 'Linna sotsiaaltöötaja Mari', '2026-10-16', 7, false],
      ['Linda Tamm', 'OTHER', 'Poeg Jaan', null, null, false]
    ]
  );
  assert.deepEqual((await getDeadlines(unitLead, deps())).preconditionsOpen.map((item) => item.client.displayName), ['Peeter Põhi']);

  /* LÕPETAMINE: täidetud või ei ole enam vaja; ainult hooldusjuht; lõpetatut teist korda lõpetada ei saa. */
  await expectError(closePrecondition(anu, linda.id, added.preconditionId, { outcome: 'DONE' }, deps()), 403, 'org.errors.missing_capability');
  await expectError(closePrecondition(lead, linda.id, added.preconditionId, {}, deps()), 400, 'home_care.errors.precondition_outcome_invalid');
  await expectError(closePrecondition(lead, linda.id, added.preconditionId, { outcome: 'LOST' }, deps()), 400, 'home_care.errors.precondition_outcome_invalid');
  /* Teise kliendi eeltingimust selle kliendi kaudu ei leia. */
  await expectError(closePrecondition(lead, linda.id, late.preconditionId, { outcome: 'DONE' }, deps()), 404, 'home_care.errors.precondition_not_found');
  const done = await closePrecondition(lead, linda.id, added.preconditionId, { outcome: 'DONE' }, deps(at('2026-10-09T10:00:00Z')));
  assert.deepEqual(done.preconditions.map((row) => row.kind), ['OTHER']);
  await expectError(closePrecondition(lead, linda.id, added.preconditionId, { outcome: 'DROPPED' }, deps()), 409, 'home_care.errors.precondition_closed');
  assert.deepEqual((await listClients(lead, {}, deps())).clients.map((row) => row.waiting), [true, true]);
  const dropped = await closePrecondition(lead, linda.id, second.preconditionId, { outcome: 'DROPPED' }, deps(at('2026-10-09T10:05:00Z')));
  assert.deepEqual(dropped.preconditions, []);
  assert.deepEqual((await listClients(lead, {}, deps())).clients.map((row) => [row.displayName, row.waiting]), [['Linda Tamm', false], ['Peeter Põhi', true]]);
  /* Rida jääb alles koos tulemuse ja lõpetajaga. */
  assert.deepEqual(
    (await db.carePrecondition.findMany({ where: { clientId: linda.id }, orderBy: { createdAt: 'asc' } })).map((row) => [row.kind, row.outcome, row.closedByName, row.closedAt.toISOString()]),
    [
      ['CLEANING', 'DONE', 'Juta Juht', '2026-10-09T10:00:00.000Z'],
      ['OTHER', 'DROPPED', 'Juta Juht', '2026-10-09T10:05:00.000Z']
    ]
  );

  /* Korraga lahti olevate eeltingimuste arv kliendi kohta on piiratud. */
  for (let index = 0; index < 10; index += 1) await addPrecondition(lead, linda.id, { kind: 'PEST_CONTROL', responsible: `Korraldaja ${index}` }, deps());
  await expectError(addPrecondition(lead, linda.id, input, deps()), 400, 'home_care.errors.precondition_too_many');

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) => db.carePrecondition.create({ data: { organizationId: f.orgA.id, clientId: peeter.id, kind: 'CLEANING', responsible: 'Keegi', ...data } });
  await assert.rejects(raw({ kind: 'PAINTING' }), /CarePrecondition_kind_check/);
  await assert.rejects(raw({ kind: 'OTHER' }), /CarePrecondition_note_check/);
  await assert.rejects(raw({ note: '   ' }), /CarePrecondition_note_check/);
  await assert.rejects(raw({ responsible: '  ' }), /CarePrecondition_responsible_check/);
  await assert.rejects(raw({ dueOn: '16.10.2026' }), /CarePrecondition_dueOn_check/);
  await assert.rejects(raw({ closedAt: NOW }), /CarePrecondition_outcome_check/);
  await assert.rejects(raw({ outcome: 'DONE' }), /CarePrecondition_outcome_check/);
  await assert.rejects(raw({ closedAt: NOW, outcome: 'LOST' }), /CarePrecondition_outcome_check/);

  /* AUDIT: ainult ID-d ja muutuse liik (liiki, täpsustust, korraldajat ega tähtaega seal ei ole). */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_precondition_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual([...new Set(audit.map((entry) => entry.meta.change))].sort(), ['added', 'done', 'dropped']);
  assert.equal(audit.filter((entry) => entry.meta.change === 'added').length, 13);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'organizationId', 'preconditionId']);
});

test('võtmeraamat: arvele võtmine, üleandmine, lõpetamine, võti päevaplaanis ja hooldaja päevas', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi', unitId: north.id }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, linda.id, { membershipId: f.members.bert.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.bert.id }, deps());
  const input = { tag: ' 17 ', label: 'välisuks', holderMembershipId: f.members.anu.id };

  /* Algus: võtmeid ei ole; kellele saab anda, on asutuse hooldajad. */
  const opened = await openClient(anu, linda.id, deps());
  assert.deepEqual([opened.keys, opened.keyReceivers.map((worker) => worker.name)], [[], ['Anu Hooldaja', 'Bert Hooldaja']]);

  /* Arvele võtab ainult hooldusjuht, kelle skoobis klient on; vigane sisend ei salvestu. */
  await expectError(addKey(anu, linda.id, input, deps()), 403, 'org.errors.missing_capability');
  await expectError(addKey(unitLead, linda.id, input, deps()), 403);
  await expectError(addKey(leadB, linda.id, input, deps()), 404, 'home_care.errors.client_not_found');
  const bad = (patch, key) => expectError(addKey(lead, linda.id, { ...input, ...patch }, deps()), 400, key);
  await bad({ tag: '  ' }, 'home_care.errors.key_tag_required');
  await bad({ tag: 'x'.repeat(21) }, 'home_care.errors.text_too_long');
  /* Hoidja peab olema asutuse hooldaja: raamatupidaja ja teise asutuse töötaja ei sobi. */
  await bad({ holderMembershipId: f.members.clerk.id }, 'home_care.errors.key_holder_invalid');
  await bad({ holderMembershipId: f.members.leadB.id }, 'home_care.errors.key_holder_invalid');
  assert.equal(await db.careKey.count({ where: { organizationId: f.orgA.id } }), 0);

  /* ARVELE: ripatsi number ilma tühikuteta; võti on Anu käes. Sama number teist korda ei sobi (ka teise kliendi juures). */
  const added = await addKey(lead, linda.id, input, deps());
  assert.deepEqual(added.keys, [
    { id: added.keyId, tag: '17', label: 'välisuks', holder: { membershipId: f.members.anu.id, name: 'Anu Hooldaja' }, heldSince: NOW.toISOString() }
  ]);
  await expectError(addKey(lead, peeter.id, { tag: '17' }, deps()), 409, 'home_care.errors.key_tag_taken');
  /* Teine võti jääb kontorisse; üksuse hooldusjuht võtab oma üksuse kliendi võtme arvele. */
  const office = await addKey(lead, linda.id, { tag: 'A-2' }, deps());
  assert.deepEqual(office.keys.map((key) => [key.tag, key.label, key.holder]), [['17', 'välisuks', { membershipId: f.members.anu.id, name: 'Anu Hooldaja' }], ['A-2', null, null]]);
  const peeterKey = await addKey(unitLead, peeter.id, { tag: '30', holderMembershipId: f.members.bert.id }, deps());
  /* Näeb igaüks, kes tohib kliendi lehte avada. */
  assert.deepEqual((await openClient(bert, linda.id, deps())).keys.map((key) => key.tag), ['17', 'A-2']);

  /* HOOLDAJA PÄEV: minu käes olevad võtmed ja tänase käigu võti. */
  const early = at('2026-10-01T08:00:00Z');
  const slotOf = async (client, startTime, member) =>
    (await createSlots(lead, client.id, { weekdays: [5], startTime, plannedMinutes: 30, ...(member ? { workerMembershipId: member.id } : {}) }, deps(early))).slots.find((slot) => slot.startTime === startTime);
  const lindaNoon = await slotOf(linda, '12:00', f.members.bert);
  await slotOf(linda, '15:00', f.members.anu);
  await slotOf(linda, '18:00', null);
  await slotOf(peeter, '16:00', f.members.bert);
  const dayOfAnu = await getMyDay(anu, deps());
  assert.deepEqual(dayOfAnu.keys.map((key) => [key.tag, key.label, key.client.displayName, key.clientEnded]), [['17', 'välisuks', 'Linda Tamm', false]]);
  assert.deepEqual(dayOfAnu.visits.map((visit) => [visit.startTime, visit.key]), [['15:00', { held: true, holders: [], office: false }]]);
  /* Berdil Linda võtit ei ole: tema käigu juures on kirjas, kelle käes võtmed on. Peetri võti on tal endal. */
  assert.deepEqual(
    (await getMyDay(bert, deps())).visits.map((visit) => [visit.startTime, visit.client.displayName, visit.key]),
    [
      ['12:00', 'Linda Tamm', { held: false, holders: ['Anu Hooldaja'], office: true }],
      ['16:00', 'Peeter Põhi', { held: true, holders: [], office: false }]
    ]
  );

  /* PÄEVAPLAAN: sama info hooldusjuhile; määramata käigul on kirjas, kus võtmed on. */
  const plan = await getDayPlan(lead, {}, deps());
  const keyOf = (list, time) => list.find((visit) => visit.startTime === time).key;
  const all = plan.workers.flatMap((worker) => worker.visits);
  assert.deepEqual(
    [keyOf(all, '12:00'), keyOf(all, '15:00'), keyOf(all, '16:00'), keyOf(plan.unassigned, '18:00')],
    [
      { held: false, holders: ['Anu Hooldaja'], office: true },
      { held: true, holders: [], office: false },
      { held: true, holders: [], office: false },
      { held: false, holders: ['Anu Hooldaja'], office: true }
    ]
  );

  /* ÜLEANDMINE: annab hoidja ise või hooldusjuht; saaja on asutuse hooldaja või kontor. */
  await expectError(handOverKey(bert, linda.id, added.keyId, { toMembershipId: f.members.bert.id }, deps()), 403, 'org.errors.missing_capability');
  await expectError(handOverKey(clerk, linda.id, added.keyId, { toMembershipId: f.members.bert.id }, deps()), 403, 'org.errors.missing_capability');
  await expectError(handOverKey(anu, linda.id, added.keyId, { toMembershipId: f.members.anu.id }, deps()), 400, 'home_care.errors.key_same_holder');
  await expectError(handOverKey(anu, linda.id, added.keyId, { toMembershipId: f.members.clerk.id }, deps()), 400, 'home_care.errors.key_holder_invalid');
  await expectError(handOverKey(anu, peeter.id, added.keyId, { toMembershipId: f.members.bert.id }, deps()), 404, 'home_care.errors.key_not_found');
  const later = at('2026-10-09T09:00:00Z');
  const handed = await handOverKey(anu, linda.id, added.keyId, { toMembershipId: f.members.bert.id }, deps(later));
  assert.deepEqual(handed.keys.find((key) => key.tag === '17').holder, { membershipId: f.members.bert.id, name: 'Bert Hooldaja' });
  assert.equal(handed.keys.find((key) => key.tag === '17').heldSince, later.toISOString());
  /* Nüüd on Berdi käigul võti olemas ja Anu omal ei ole. */
  assert.deepEqual((await getMyDay(bert, deps())).visits.map((visit) => visit.key.held), [true, true]);
  assert.deepEqual((await getMyDay(anu, deps())).visits.map((visit) => visit.key), [{ held: false, holders: ['Bert Hooldaja'], office: true }]);
  assert.deepEqual((await getMyDay(anu, deps())).keys, []);
  /* Hooldusjuht võtab kontori võtme ja annab Anule; Bert annab oma võtme tagasi kontorisse. */
  await handOverKey(lead, linda.id, office.keyId, { toMembershipId: f.members.anu.id }, deps(later));
  await handOverKey(bert, linda.id, added.keyId, { toMembershipId: null }, deps(at('2026-10-09T10:00:00Z')));
  assert.deepEqual((await openClient(lead, linda.id, deps())).keys.map((key) => [key.tag, key.holder?.name || null]), [['17', null], ['A-2', 'Anu Hooldaja']]);
  /* Üleandmiste jälg: kellelt, kellele ja kes kirja pani. */
  assert.deepEqual(
    (await db.careKeyHandover.findMany({ where: { keyId: added.keyId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })).map((row) => [row.fromName, row.toName, row.recordedByName]),
    [
      [null, 'Anu Hooldaja', 'Juta Juht'],
      ['Anu Hooldaja', 'Bert Hooldaja', 'Anu Hooldaja'],
      ['Bert Hooldaja', null, 'Bert Hooldaja']
    ]
  );

  /* VÕTMERAAMAT: hooldusjuhi skoobis; lõppenud teenusega kliendi võti on tagastamata võtmete seas; hoidja, kes ei ole enam töötaja, on märgitud. */
  await expectError(getKeyRegister(anu, deps()), 403, 'org.errors.missing_capability');
  const register = await getKeyRegister(lead, deps());
  assert.deepEqual(
    [register.total, register.unreturned, register.keys.map((key) => [key.client.displayName, key.tag, key.holder?.name || null, key.holderInactive])],
    [3, [], [['Linda Tamm', '17', null, false], ['Linda Tamm', 'A-2', 'Anu Hooldaja', false], ['Peeter Põhi', '30', 'Bert Hooldaja', false]]]
  );
  assert.deepEqual((await getKeyRegister(unitLead, deps())).keys.map((key) => key.tag), ['30']);
  assert.deepEqual((await getKeyRegister(leadB, deps())).total, 0);
  const peeterNow = await db.careClient.findUnique({ where: { id: peeter.id }, select: { version: true } });
  await setClientStatus(lead, peeter.id, { version: peeterNow.version, status: 'ENDED', statusReason: 'MOVED' }, deps());
  await db.organizationMembership.update({ where: { id: f.members.bert.id }, data: { status: 'SUSPENDED' } });
  const afterEnd = await getKeyRegister(lead, deps());
  assert.deepEqual(afterEnd.unreturned.map((key) => [key.client.displayName, key.tag, key.clientEnded, key.holderInactive]), [['Peeter Põhi', '30', true, true]]);
  assert.deepEqual(afterEnd.keys.map((key) => key.tag), ['17', 'A-2']);

  /* LÕPETAMINE: tagastatud kliendile või kadunud; ainult hooldusjuht; lõpetatud võtit üle anda ei saa ja number vabaneb. */
  await expectError(closeKey(anu, linda.id, office.keyId, { outcome: 'RETURNED' }, deps()), 403, 'org.errors.missing_capability');
  await expectError(closeKey(lead, linda.id, office.keyId, { outcome: 'SOLD' }, deps()), 400, 'home_care.errors.key_outcome_invalid');
  const closed = await closeKey(lead, linda.id, office.keyId, { outcome: 'LOST' }, deps(at('2026-10-09T11:00:00Z')));
  assert.deepEqual(closed.keys.map((key) => key.tag), ['17']);
  await expectError(handOverKey(lead, linda.id, office.keyId, { toMembershipId: null }, deps()), 409, 'home_care.errors.key_closed');
  await expectError(closeKey(lead, linda.id, office.keyId, { outcome: 'RETURNED' }, deps()), 409, 'home_care.errors.key_closed');
  await closeKey(lead, peeter.id, peeterKey.keyId, { outcome: 'RETURNED' }, deps());
  assert.deepEqual((await getKeyRegister(lead, deps())).unreturned, []);
  const reused = await addKey(lead, linda.id, { tag: 'a-2' }, deps());
  assert.deepEqual(reused.keys.map((key) => key.tag), ['17', 'a-2']);
  assert.deepEqual(
    (await db.careKey.findMany({ where: { organizationId: f.orgA.id, closedAt: { not: null } }, orderBy: { tag: 'asc' } })).map((row) => [row.tag, row.outcome, row.closedByName]),
    [['30', 'RETURNED', 'Juta Juht'], ['A-2', 'LOST', 'Juta Juht']]
  );
  /* Berdil Linda võtit ei ole: mõlemad võtmed on kontoris. */
  assert.equal((await getDayPlan(lead, {}, deps())).workers.flatMap((worker) => worker.visits).find((visit) => visit.slotId === lindaNoon.id).key.held, false);

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) => db.careKey.create({ data: { organizationId: f.orgA.id, clientId: linda.id, tag: '99', ...data } });
  await assert.rejects(raw({ tag: '   ' }), /CareKey_tag_check/);
  await assert.rejects(raw({ label: '  ' }), /CareKey_label_check/);
  await assert.rejects(raw({ closedAt: NOW }), /CareKey_outcome_check/);
  await assert.rejects(raw({ outcome: 'LOST' }), /CareKey_outcome_check/);
  await assert.rejects(raw({ closedAt: NOW, outcome: 'SOLD' }), /CareKey_outcome_check/);
  await assert.rejects(raw({ tag: '17' }), (error) => error.code === 'P2002');

  /* AUDIT: ainult ID-d ja muutuse liik (ripatsi numbrit, kirjeldust ega hoidjat seal ei ole). */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_key_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual(audit.map((entry) => entry.meta.change).sort(), ['added', 'added', 'added', 'added', 'handed_over', 'handed_over', 'handed_over', 'lost', 'returned']);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'keyId', 'organizationId']);
});

test('kliendi raha: saadud, kulutatud ja tagastatud, jääk hoidja kaupa, tühistamine ja lahtine jääk hooldusjuhile', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi', unitId: north.id }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, linda.id, { membershipId: f.members.bert.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.bert.id }, deps());
  const today = '2026-10-09';

  /* Algus: raha kellegi käes ei ole. */
  const empty = (await openClient(anu, linda.id, deps())).money;
  assert.deepEqual(empty, { today, balanceCents: 0, entries: [], holders: [] });

  /* Kirja paneb see, kes tohib kliendi lehte avada; vigane sisend ei salvestu. */
  await expectError(addMoneyEntry(clerk, linda.id, { kind: 'RECEIVED', amount: '10' }, deps()), 404, 'home_care.errors.client_not_found');
  const bad = (patch, key) => expectError(addMoneyEntry(anu, linda.id, { kind: 'RECEIVED', amount: '20', ...patch }, deps()), 400, key);
  await bad({ kind: 'STOLEN' }, 'home_care.errors.money_kind_required');
  for (const amount of ['', '0', '-5', '12,345', 'kümme', '1e3', '10001', '10000.01']) await bad({ amount }, 'home_care.errors.money_amount_invalid');
  await bad({ kind: 'SPENT', amount: '5' }, 'home_care.errors.money_note_required');
  await bad({ occurredOn: '2026-10-10' }, 'home_care.errors.money_day_invalid');
  await bad({ occurredOn: '2026-09-01' }, 'home_care.errors.money_day_invalid');
  /* Kulutada ega tagastada ei saa raha, mida käes ei ole. */
  await bad({ kind: 'RETURNED', amount: '1' }, 'home_care.errors.money_exceeds_balance');
  assert.equal(await db.careMoneyEntry.count({ where: { organizationId: f.orgA.id } }), 0);

  /* SAADUD, KULUTATUD, TAGASTATUD: jääk on sentides ja koma ning punkt on mõlemad lubatud. */
  const got = await addMoneyEntry(anu, linda.id, { kind: 'RECEIVED', amount: '20' }, deps());
  assert.deepEqual([got.money.balanceCents, got.money.entries.map((row) => [row.kind, row.amountCents, row.note, row.occurredOn, row.canRetract])], [2000, [['RECEIVED', 2000, null, today, true]]]);
  const spent = await addMoneyEntry(anu, linda.id, { kind: 'SPENT', amount: '12,35', note: '  Pood:   leib ja piim ' }, deps(at('2026-10-09T08:10:00Z')));
  assert.deepEqual([spent.money.balanceCents, spent.money.entries[0].note, spent.money.entries[0].amountCents], [765, 'Pood: leib ja piim', 1235]);
  await expectError(addMoneyEntry(anu, linda.id, { kind: 'RETURNED', amount: '7.66' }, deps()), 400, 'home_care.errors.money_exceeds_balance');
  const back = await addMoneyEntry(anu, linda.id, { kind: 'RETURNED', amount: '7.65' }, deps(at('2026-10-09T08:20:00Z')));
  assert.deepEqual([back.money.balanceCents, back.money.entries.map((row) => row.kind)], [0, ['RETURNED', 'SPENT', 'RECEIVED']]);

  /* Iga hoidja jääk on eraldi: Bert näeb ainult oma ridu, hooldusjuht näeb kõigi hoidjate jääke ja ridu. */
  await addMoneyEntry(bert, linda.id, { kind: 'RECEIVED', amount: '50', occurredOn: '2026-10-01' }, deps(at('2026-10-01T09:00:00Z')));
  await addMoneyEntry(bert, linda.id, { kind: 'SPENT', amount: '9,90', note: 'Apteek', occurredOn: '2026-10-01' }, deps(at('2026-10-01T10:00:00Z')));
  const ofBert = (await openClient(bert, linda.id, deps())).money;
  assert.deepEqual([ofBert.balanceCents, ofBert.entries.map((row) => [row.kind, row.canRetract]), ofBert.holders], [4010, [['SPENT', false], ['RECEIVED', false]], []]);
  assert.equal((await openClient(anu, linda.id, deps())).money.entries.length, 3);
  const ofLead = (await openClient(lead, linda.id, deps())).money;
  assert.deepEqual(ofLead.holders, [{ membershipId: f.members.bert.id, name: 'Bert Hooldaja', balanceCents: 4010, lastOn: '2026-10-01' }]);
  assert.deepEqual([ofLead.balanceCents, ofLead.entries.length, ofLead.entries.every((row) => row.canRetract), ofLead.entries[0].holderName], [0, 5, true, 'Anu Hooldaja']);

  /* HOOLDAJA AVALEHT: kliendid, kelle raha on tema käes. */
  await addMoneyEntry(bert, peeter.id, { kind: 'RECEIVED', amount: '5' }, deps());
  assert.deepEqual((await getMyDay(bert, deps())).money, [
    { client: { id: linda.id, displayName: 'Linda Tamm' }, balanceCents: 4010 },
    { client: { id: peeter.id, displayName: 'Peeter Põhi' }, balanceCents: 500 }
  ]);
  assert.deepEqual((await getMyDay(anu, deps())).money, []);

  /* TÄHTAJAD: jääk, mille viimasest reast on üle nädala; tänane jääk sinna ei kuulu. Üksuse juht näeb oma üksust. */
  const deadlines = await getDeadlines(lead, deps());
  assert.deepEqual(deadlines.moneyOpen.map((item) => [item.client.displayName, item.holderName, item.balanceCents, item.lastOn, item.days]), [['Linda Tamm', 'Bert Hooldaja', 4010, '2026-10-01', 8]]);
  assert.deepEqual((await getDeadlines(unitLead, deps())).moneyOpen, []);
  assert.deepEqual((await getDeadlines(unitLead, deps(at('2026-10-20T08:00:00Z')))).moneyOpen.map((item) => [item.client.displayName, item.balanceCents, item.days]), [['Peeter Põhi', 500, 11]]);

  /* TÜHISTAMINE: autor samal päeval, hooldusjuht igal ajal; võõrast rida ei leia; jääk ei tohi minna alla nulli. */
  const bertRows = await db.careMoneyEntry.findMany({ where: { clientId: linda.id, holderMembershipId: f.members.bert.id }, orderBy: { createdAt: 'asc' } });
  await expectError(retractMoneyEntry(anu, linda.id, bertRows[0].id, deps()), 404, 'home_care.errors.money_not_found');
  await expectError(retractMoneyEntry(bert, linda.id, bertRows[1].id, deps()), 403, 'org.errors.missing_capability');
  await expectError(retractMoneyEntry(unitLead, linda.id, bertRows[1].id, deps()), 403, 'home_care.errors.access_reason_required');
  /* Saadud raha rida ei saa tühistada, kui sellest on juba kulutatud: 50 − 9,90 jääks −9,90. */
  await addMoneyEntry(bert, linda.id, { kind: 'SPENT', amount: '40.10', note: 'Elektriarve' }, deps());
  await expectError(retractMoneyEntry(lead, linda.id, bertRows[0].id, deps()), 409, 'home_care.errors.money_retract_negative');
  const afterRetract = await retractMoneyEntry(lead, linda.id, bertRows[1].id, deps(at('2026-10-09T09:00:00Z')));
  assert.deepEqual(afterRetract.money.holders.map((holder) => [holder.name, holder.balanceCents]), [['Bert Hooldaja', 990]]);
  await expectError(retractMoneyEntry(lead, linda.id, bertRows[1].id, deps()), 409, 'home_care.errors.money_retracted');
  /* Anu tühistab oma tänase tagastuse: raha on jälle tema käes. */
  const anuRows = await db.careMoneyEntry.findMany({ where: { clientId: linda.id, holderMembershipId: f.members.anu.id }, orderBy: { createdAt: 'asc' } });
  const undone = await retractMoneyEntry(anu, linda.id, anuRows[2].id, deps(at('2026-10-09T09:30:00Z')));
  assert.deepEqual([undone.money.balanceCents, undone.money.entries.map((row) => row.kind)], [765, ['SPENT', 'RECEIVED']]);
  /* Tühistatud rida jääb alles koos tühistajaga. */
  const kept = await db.careMoneyEntry.findUnique({ where: { id: bertRows[1].id } });
  assert.deepEqual([kept.amountCents, kept.retractedByName, kept.retractedAt.toISOString()], [990, 'Juta Juht', '2026-10-09T09:00:00.000Z']);

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) =>
    db.careMoneyEntry.create({ data: { organizationId: f.orgA.id, clientId: linda.id, holderMembershipId: f.members.anu.id, kind: 'RECEIVED', amountCents: 100, occurredOn: today, ...data } });
  await assert.rejects(raw({ kind: 'STOLEN' }), /CareMoneyEntry_kind_check/);
  await assert.rejects(raw({ amountCents: 0 }), /CareMoneyEntry_amount_check/);
  await assert.rejects(raw({ amountCents: 1000001 }), /CareMoneyEntry_amount_check/);
  await assert.rejects(raw({ note: '  ' }), /CareMoneyEntry_note_check/);
  await assert.rejects(raw({ occurredOn: '09.10.2026' }), /CareMoneyEntry_occurredOn_check/);

  /* AUDIT: ainult ID-d ja muutuse liik (summat, liiki ega märkust seal ei ole). */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_money_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual([audit.filter((entry) => entry.meta.change === 'added').length, audit.filter((entry) => entry.meta.change === 'retracted').length], [7, 2]);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'moneyEntryId', 'organizationId']);
});

test('tagasiside küsimine: kellelt on aeg küsida ja mis lõppenud teenuste kohta tagasiside puudub', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  /* Kliendid eri aegadest: vana (teenusel poolteist aastat), uus (kuu aega) ja kolm kuud teenusel olnud. */
  const make = async (displayName, createdAt, unitId) => {
    const { client } = await createClient(lead, { displayName, ...(unitId ? { unitId } : {}) }, deps(at(createdAt)));
    await db.careClient.update({ where: { id: client.id }, data: { createdAt: at(createdAt) } });
    await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
    return client;
  };
  const vana = await make('Vana Klient', '2025-04-01T08:00:00Z');
  const uus = await make('Uus Klient', '2026-09-10T08:00:00Z');
  const kolm = await make('Kolme Kuu Klient', '2026-07-01T08:00:00Z', north.id);
  const kiidetud = await make('Kiidetud Klient', '2025-04-01T08:00:00Z');
  const feedback = (client, incidentType, occurredAt) =>
    createEntry(anu, client.id, { kind: 'INCIDENT', incidentType, text: 'Tagasiside.', occurredAt }, deps(at(occurredAt)));
  /* Vanal kliendil on tagasiside 14 kuu tagant, kiidetud kliendil kuu tagant. Kukkumine ei ole tagasiside. */
  await feedback(vana, 'FEEDBACK', '2025-08-01T09:00:00Z');
  await feedback(kiidetud, 'THANKS', '2026-09-20T09:00:00Z');
  await feedback(uus, 'FALL', '2026-10-01T09:00:00Z');

  const names = (list) => list.map((item) => [item.client.displayName, item.lastOn, item.days]);
  const view = await getDeadlines(lead, deps());
  /* Kauem küsimata enne: vana klient (viimane tagasiside 434 päeva tagasi), siis kolm kuud teenusel olnud klient, kellelt ei ole kordagi küsitud. */
  assert.deepEqual(names(view.feedbackOverdue), [
    ['Vana Klient', '2025-08-01', 434],
    ['Kolme Kuu Klient', null, 100]
  ]);
  assert.deepEqual(view.feedbackAtEnd, []);
  /* Üksuse hooldusjuht näeb oma üksuse kliente. */
  assert.deepEqual(names((await getDeadlines(unitLead, deps())).feedbackOverdue), [['Kolme Kuu Klient', null, 100]]);

  /* Kaebus loeb samuti tagasisideks; tühistatud kirje ei loe. */
  const complaint = await feedback(kolm, 'COMPLAINT', '2026-10-08T09:00:00Z');
  assert.deepEqual(names((await getDeadlines(lead, deps())).feedbackOverdue).map((row) => row[0]), ['Vana Klient']);
  await retractEntry(lead, kolm.id, complaint.entry.id, { reason: 'Vale klient', revision: 1 }, deps());
  assert.deepEqual(names((await getDeadlines(lead, deps())).feedbackOverdue).map((row) => row[0]), ['Vana Klient', 'Kolme Kuu Klient']);

  /* TEENUSE LÕPP: lõppenud teenus ilma tagasisideta on nimekirjas; surma korral ei küsita; kuu enne lõppu kirja pandud tagasiside loeb. */
  const end = async (client, statusReason, when) => {
    const row = await db.careClient.findUnique({ where: { id: client.id }, select: { version: true } });
    await setClientStatus(lead, client.id, { version: row.version, status: 'ENDED', statusReason, statusNote: 'Lähedane teatas' }, deps(at(when)));
  };
  await end(uus, 'MOVED', '2026-10-05T10:00:00Z');
  await end(vana, 'DIED', '2026-10-06T10:00:00Z');
  await end(kiidetud, 'NO_LONGER_NEEDED', '2026-10-07T10:00:00Z');
  const ended = await getDeadlines(lead, deps());
  assert.deepEqual(ended.feedbackAtEnd.map((item) => [item.client.displayName, item.endedOn, item.lastOn]), [['Uus Klient', '2026-10-05', null]]);
  /* Lõppenud teenusega kliendid ei ole enam korrapärase küsimise nimekirjas. */
  assert.deepEqual(names(ended.feedbackOverdue).map((row) => row[0]), ['Kolme Kuu Klient']);
  /* Pärast lõppu kirja pandud tagasiside võtab kliendi nimekirjast; kolm kuud hiljem lõppemist enam ei näidata. */
  await createEntry(lead, uus.id, { kind: 'INCIDENT', incidentType: 'FEEDBACK', text: 'Tütar oli rahul.', occurredAt: '2026-10-08T09:00:00Z' }, deps());
  assert.deepEqual((await getDeadlines(lead, deps())).feedbackAtEnd, []);
  const later = await getDeadlines(lead, deps(at('2027-02-01T08:00:00Z')));
  assert.deepEqual(later.feedbackAtEnd, []);
});

test('varud kliendi kodus: jälgimine, seisu märkimine ja lõppevad varud hooldusjuhile', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi', unitId: north.id }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.bert.id }, deps());

  /* Algus: varusid ei jälgita. */
  assert.deepEqual((await openClient(anu, linda.id, deps())).supplies, []);

  /* Jälgimise lülitab sisse hooldusjuht, kelle skoobis klient on; ravimivaru valikus ei ole. */
  await expectError(trackSupply(anu, linda.id, { kind: 'FIREWOOD', responsible: 'Poeg' }, deps()), 403, 'org.errors.missing_capability');
  await expectError(trackSupply(unitLead, linda.id, { kind: 'FIREWOOD', responsible: 'Poeg' }, deps()), 403);
  await expectError(trackSupply(lead, linda.id, { kind: 'MEDICINE', responsible: 'Poeg' }, deps()), 400, 'home_care.errors.supply_kind_required');
  await expectError(trackSupply(lead, linda.id, { kind: 'FIREWOOD', responsible: '  ' }, deps()), 400, 'home_care.errors.supply_responsible_required');
  assert.equal(await db.careClientSupply.count({ where: { organizationId: f.orgA.id } }), 0);

  const wood = await trackSupply(lead, linda.id, { kind: 'FIREWOOD', responsible: ' Poeg   Jaan ' }, deps());
  assert.deepEqual(wood.supplies, [{ id: wood.supplyId, kind: 'FIREWOOD', responsible: 'Poeg Jaan', state: null, stateNote: null, checkedAt: null, checkedByName: null }]);
  await expectError(trackSupply(lead, linda.id, { kind: 'FIREWOOD', responsible: 'Keegi teine' }, deps()), 409, 'home_care.errors.supply_already_tracked');
  /* Varud on alati sõnastiku järjekorras, mitte lisamise järjekorras. */
  const hygiene = await trackSupply(lead, linda.id, { kind: 'HYGIENE', responsible: 'Tütar' }, deps());
  const water = await trackSupply(lead, linda.id, { kind: 'WATER', responsible: 'Hooldaja' }, deps());
  assert.deepEqual(water.supplies.map((row) => row.kind), ['FIREWOOD', 'WATER', 'HYGIENE']);
  const food = await trackSupply(unitLead, peeter.id, { kind: 'FOOD', responsible: 'Vald' }, deps());

  /* SEISU MÄRGIB igaüks, kes tohib kliendi lehte avada; teise kliendi varu selle kliendi kaudu ei leia. */
  await expectError(markSupply(clerk, linda.id, wood.supplyId, { state: 'LOW' }, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(markSupply(anu, peeter.id, food.supplyId, { state: 'LOW' }, deps()), 403, 'home_care.errors.access_reason_required');
  await expectError(markSupply(anu, linda.id, wood.supplyId, { state: 'EMPTY' }, deps()), 400, 'home_care.errors.supply_state_required');
  await expectError(markSupply(anu, linda.id, food.supplyId, { state: 'LOW' }, deps()), 404, 'home_care.errors.supply_not_found');
  const low = await markSupply(anu, linda.id, wood.supplyId, { state: 'LOW', note: ' Jätkub umbes   kolmeks päevaks ' }, deps(at('2026-10-09T08:10:00Z')));
  assert.deepEqual(low.supplies[0], {
    id: wood.supplyId,
    kind: 'FIREWOOD',
    responsible: 'Poeg Jaan',
    state: 'LOW',
    stateNote: 'Jätkub umbes kolmeks päevaks',
    checkedAt: '2026-10-09T08:10:00.000Z',
    checkedByName: 'Anu Hooldaja'
  });
  await markSupply(anu, linda.id, water.supplyId, { state: 'OUT' }, deps(at('2026-10-09T08:20:00Z')));
  await markSupply(lead, linda.id, hygiene.supplyId, { state: 'ENOUGH' }, deps());
  await markSupply(bert, peeter.id, food.supplyId, { state: 'LOW' }, deps(at('2026-10-09T08:05:00Z')));
  assert.deepEqual((await openClient(anu, linda.id, deps())).supplies.map((row) => [row.kind, row.state, row.checkedByName]), [
    ['FIREWOOD', 'LOW', 'Anu Hooldaja'],
    ['WATER', 'OUT', 'Anu Hooldaja'],
    ['HYGIENE', 'ENOUGH', 'Juta Juht']
  ]);

  /* TÄHTAJAD: otsas varu enne, siis lõppevad varem märgitud enne; piisav varu nimekirjas ei ole. Üksuse juht näeb oma üksust. */
  const open = (list) => list.map((item) => [item.client.displayName, item.kind, item.state, item.responsible]);
  assert.deepEqual(open((await getDeadlines(lead, deps())).suppliesOpen), [
    ['Linda Tamm', 'WATER', 'OUT', 'Hooldaja'],
    ['Peeter Põhi', 'FOOD', 'LOW', 'Vald'],
    ['Linda Tamm', 'FIREWOOD', 'LOW', 'Poeg Jaan']
  ]);
  assert.deepEqual(open((await getDeadlines(unitLead, deps())).suppliesOpen), [['Peeter Põhi', 'FOOD', 'LOW', 'Vald']]);

  /* UUS MÄRKIMINE asendab seisu ja märkuse; iga märkimine jääb ajalukku. */
  const refilled = await markSupply(anu, linda.id, wood.supplyId, { state: 'ENOUGH' }, deps(at('2026-10-09T09:00:00Z')));
  assert.deepEqual([refilled.supplies[0].state, refilled.supplies[0].stateNote], ['ENOUGH', null]);
  assert.deepEqual(
    (await db.careSupplyCheck.findMany({ where: { supplyId: wood.supplyId }, orderBy: { createdAt: 'asc' } })).map((row) => [row.state, row.note, row.checkedByName]),
    [['LOW', 'Jätkub umbes kolmeks päevaks', 'Anu Hooldaja'], ['ENOUGH', null, 'Anu Hooldaja']]
  );
  /* Lõppenud teenusega kliendi varu hooldusjuhi nimekirjas ei ole. */
  const peeterNow = await db.careClient.findUnique({ where: { id: peeter.id }, select: { version: true } });
  await setClientStatus(lead, peeter.id, { version: peeterNow.version, status: 'ENDED', statusReason: 'MOVED' }, deps());
  assert.deepEqual(open((await getDeadlines(lead, deps())).suppliesOpen), [['Linda Tamm', 'WATER', 'OUT', 'Hooldaja']]);

  /* JÄLGIMISE LÕPETAMINE: ainult hooldusjuht; lõpetatud varu ei saa märkida; sama varu saab uuesti sisse lülitada. */
  await expectError(untrackSupply(anu, linda.id, water.supplyId, deps()), 403, 'org.errors.missing_capability');
  const stopped = await untrackSupply(lead, linda.id, water.supplyId, deps(at('2026-10-09T10:00:00Z')));
  assert.deepEqual(stopped.supplies.map((row) => row.kind), ['FIREWOOD', 'HYGIENE']);
  await expectError(markSupply(anu, linda.id, water.supplyId, { state: 'ENOUGH' }, deps()), 409, 'home_care.errors.supply_ended');
  await expectError(untrackSupply(lead, linda.id, water.supplyId, deps()), 409, 'home_care.errors.supply_ended');
  assert.deepEqual((await getDeadlines(lead, deps())).suppliesOpen, []);
  const again = await trackSupply(lead, linda.id, { kind: 'WATER', responsible: 'Naaber' }, deps());
  assert.deepEqual(again.supplies.map((row) => [row.kind, row.state, row.responsible]), [['FIREWOOD', 'ENOUGH', 'Poeg Jaan'], ['WATER', null, 'Naaber'], ['HYGIENE', 'ENOUGH', 'Tütar']]);
  assert.equal(await db.careClientSupply.count({ where: { clientId: linda.id } }), 4);

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) => db.careClientSupply.create({ data: { organizationId: f.orgA.id, clientId: linda.id, kind: 'FOOD', responsible: 'Keegi', ...data } });
  await assert.rejects(raw({ kind: 'MEDICINE' }), /CareClientSupply_kind_check/);
  await assert.rejects(raw({ responsible: '  ' }), /CareClientSupply_responsible_check/);
  await assert.rejects(raw({ state: 'EMPTY', checkedAt: NOW }), /CareClientSupply_state_check/);
  await assert.rejects(raw({ state: 'LOW' }), /CareClientSupply_state_check/);
  await assert.rejects(raw({ checkedAt: NOW }), /CareClientSupply_state_check/);
  await assert.rejects(raw({ stateNote: '  ' }), /CareClientSupply_stateNote_check/);
  await assert.rejects(raw({ kind: 'FIREWOOD' }), (error) => error.code === 'P2002');
  await assert.rejects(
    db.careSupplyCheck.create({ data: { organizationId: f.orgA.id, supplyId: wood.supplyId, clientId: linda.id, state: 'EMPTY' } }),
    /CareSupplyCheck_state_check/
  );

  /* AUDIT: ainult ID-d ja muutuse liik (varu liiki, seisu, märkust ega täiendajat seal ei ole). */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_supply_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  const count = (change) => audit.filter((entry) => entry.meta.change === change).length;
  assert.deepEqual([count('tracked'), count('marked'), count('untracked')], [5, 5, 1]);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'organizationId', 'supplyId']);
});

test('sammud „kui uks ei avane": loendi salvestamine, õigused ja erijuhtumi kirje sammudest', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi' }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.bert.id }, deps());
  const input = { steps: ['  Koputa magamistoa   aknale ', '', 'Helista naabrile Maiele, kellel on võti', 'Helista pojale', '   '] };

  /* Algus: samme ei ole. */
  assert.deepEqual((await openClient(anu, linda.id, deps())).doorSteps, []);

  /* Muudavad kliendi meeskond ja hooldusjuht; teise kliendi hooldaja (põhjusega avaja) ja võõras ei muuda. */
  await expectError(saveDoorSteps(clerk, linda.id, input, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(saveDoorSteps(bert, linda.id, input, deps()), 403, 'home_care.errors.access_reason_required');
  await openClientWithReason(bert, linda.id, { reasonCode: 'COVERING', reason: 'Anu on haige' }, deps());
  await expectError(saveDoorSteps(bert, linda.id, input, deps()), 403, 'org.errors.missing_capability');
  await expectError(saveDoorSteps(leadB, linda.id, input, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(saveDoorSteps(anu, linda.id, { steps: 'Koputa' }, deps()), 400, 'home_care.errors.door_steps_invalid');
  await expectError(saveDoorSteps(anu, linda.id, { steps: Array.from({ length: 9 }, (_, index) => `Samm ${index + 1}`) }, deps()), 400, 'home_care.errors.door_steps_too_many');
  await expectError(saveDoorSteps(anu, linda.id, { steps: ['x'.repeat(201)] }, deps()), 400, 'home_care.errors.text_too_long');
  assert.equal(await db.careDoorStep.count({ where: { organizationId: f.orgA.id } }), 0);

  /* SALVESTAMINE: tühjad read jäävad välja, järjekord jääb, tekst on ühe reana. */
  const saved = await saveDoorSteps(anu, linda.id, input, deps());
  assert.deepEqual(saved.doorSteps.map((step) => [step.position, step.text]), [
    [1, 'Koputa magamistoa aknale'],
    [2, 'Helista naabrile Maiele, kellel on võti'],
    [3, 'Helista pojale']
  ]);
  /* Näeb igaüks, kes tohib kliendi lehte avada, ka põhjusega avaja. */
  assert.deepEqual((await openClient(bert, linda.id, deps())).doorSteps.map((step) => step.text), saved.doorSteps.map((step) => step.text));
  /* Sama loend uuesti ei tee uusi ridu. */
  const again = await saveDoorSteps(lead, linda.id, { steps: saved.doorSteps.map((step) => step.text) }, deps());
  assert.deepEqual(again.doorSteps.map((step) => step.id), saved.doorSteps.map((step) => step.id));
  assert.equal(await db.careDoorStep.count({ where: { clientId: linda.id } }), 3);

  /* UUS LOEND lõpetab eelmise read; vana kokkulepe jääb alles. */
  const later = at('2026-10-09T09:00:00Z');
  const changed = await saveDoorSteps(lead, linda.id, { steps: ['Helista pojale', 'Ära helista kohe tütrele Soome'] }, deps(later));
  assert.deepEqual(changed.doorSteps.map((step) => [step.position, step.text]), [[1, 'Helista pojale'], [2, 'Ära helista kohe tütrele Soome']]);
  const all = await db.careDoorStep.findMany({ where: { clientId: linda.id }, orderBy: [{ createdAt: 'asc' }, { position: 'asc' }] });
  assert.deepEqual(all.map((row) => [row.text, Boolean(row.endedAt), row.createdByName]), [
    ['Koputa magamistoa aknale', true, 'Anu Hooldaja'],
    ['Helista naabrile Maiele, kellel on võti', true, 'Anu Hooldaja'],
    ['Helista pojale', true, 'Anu Hooldaja'],
    ['Helista pojale', false, 'Juta Juht'],
    ['Ära helista kohe tütrele Soome', false, 'Juta Juht']
  ]);

  /* „EI SAA SISSE": sammudest kokku pandud tekst läheb tavalise kirje teed pidi erijuhtumiks ja hooldusjuht saab teate. */
  const translate = (key, vars = {}) =>
    ({
      'home_care.no_answer.text_head': 'Ei saanud sisse.',
      'home_care.no_answer.text_step': `kell ${vars.time}: ${vars.step}`,
      'home_care.no_answer.text_skipped': `Tegemata sammud: ${vars.steps}`,
      'home_care.no_answer.text_none_done': 'Ühtegi kokkulepitud sammu ei ole märgitud.',
      'home_care.no_answer.text_no_steps': 'Kokkulepitud samme ei ole.'
    })[key];
  const text = composeNoAnswerText(translate, changed.doorSteps, { [changed.doorSteps[0].id]: '11:02' }, 'Poeg tuleb tunni pärast võtmega.');
  assert.equal(text, 'Ei saanud sisse.\nkell 11:02: Helista pojale\nTegemata sammud: Ära helista kohe tütrele Soome\nPoeg tuleb tunni pärast võtmega.');
  const incident = await createEntry(anu, linda.id, { kind: 'INCIDENT', incidentType: 'DOOR_NOT_OPENED', text, clientRequestId: `door-${f.tag}-1` }, depsWithNotify());
  assert.deepEqual([incident.entry.kind, incident.entry.incident.type, incident.entry.text], ['INCIDENT', 'DOOR_NOT_OPENED', text]);
  const events = await db.notificationEvent.findMany({ where: { userId: f.users.lead.id, type: 'HOME_CARE_INCIDENT_REPORTED', sourceId: incident.entry.id } });
  assert.equal(events.length, 1);

  /* TÜHI LOEND: kokkulepitud samme enam ei ole. */
  const cleared = await saveDoorSteps(lead, linda.id, { steps: [] }, deps(at('2026-10-09T10:00:00Z')));
  assert.deepEqual(cleared.doorSteps, []);
  assert.equal(await db.careDoorStep.count({ where: { clientId: linda.id, endedAt: null } }), 0);

  /* Andmebaas hoiab vigase rea eemal ka siis, kui rakendus eksib. */
  const raw = (data) => db.careDoorStep.create({ data: { organizationId: f.orgA.id, clientId: peeter.id, position: 1, text: 'Koputa', ...data } });
  await assert.rejects(raw({ position: 0 }), /CareDoorStep_position_check/);
  await assert.rejects(raw({ position: 9 }), /CareDoorStep_position_check/);
  await assert.rejects(raw({ text: '   ' }), /CareDoorStep_text_check/);
  await raw({});
  await assert.rejects(raw({ text: 'Teine samm samal kohal' }), (error) => error.code === 'P2002');

  /* AUDIT: ainult kliendi ID ja muutuse liik (sammude teksti seal ei ole). */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_door_steps_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual(audit.map((entry) => entry.meta.change).sort(), ['cleared', 'saved', 'saved']);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'organizationId']);
});

test('peatamine ja lõpetamine: surma allikas, teade käikude töötajatele ja kaua ära olnud kliendid', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi' }, deps())).client;
  for (const client of [linda, peeter]) await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  for (const member of [f.members.bert, f.members.cover]) await addTeamMember(lead, linda.id, { membershipId: member.id }, deps());
  const early = at('2026-08-01T08:00:00Z');
  await createSlots(lead, linda.id, { weekdays: [1, 5], startTime: '09:00', plannedMinutes: 30, workerMembershipId: f.members.anu.id }, deps(early));
  await createSlots(lead, linda.id, { weekdays: [3], startTime: '09:00', plannedMinutes: 30, workerMembershipId: f.members.bert.id }, deps(early));
  /* Määramata käik ja juba lõppenud rida ei too kellelegi teadet. */
  await createSlots(lead, linda.id, { weekdays: [2], startTime: '12:00', plannedMinutes: 30 }, deps(early));
  await createSlots(lead, linda.id, { weekdays: [4], startTime: '12:00', plannedMinutes: 30, workerMembershipId: f.members.cover.id, validUntil: '2026-08-20' }, deps(early));
  const TYPE = 'HOME_CARE_VISITS_CHANGED';
  const counts = () =>
    Promise.all([f.users.anu, f.users.bert, f.users.cover, f.users.lead].map((user) => db.notificationEvent.count({ where: { userId: user.id, type: TYPE } })));
  const readAll = () => db.notificationEvent.updateMany({ where: { type: TYPE, workspaceId: f.orgA.id, readAt: null }, data: { readAt: NOW } });
  const version = async (client) => (await db.careClient.findUnique({ where: { id: client.id }, select: { version: true } })).version;
  const set = async (client, input, when) => setClientStatus(lead, client.id, { version: await version(client), ...input }, depsWithNotify(at(when)));
  assert.deepEqual(await counts(), [0, 0, 0, 0]);

  /* PEATAMINE: mõlemad mustris määratud töötajad saavad ühe teate; lõppenud rea töötaja ja juht ei saa. */
  await set(linda, { status: 'AWAY', statusReason: 'HOSPITAL' }, '2026-09-01T08:00:00Z');
  assert.deepEqual(await counts(), [1, 1, 0, 0]);
  /* Põhjuse muutus samas seisus (haiglast lähedase juurde) päevi ei muuda: teadet ei tule. */
  await readAll();
  await set(linda, { status: 'AWAY', statusReason: 'WITH_FAMILY' }, '2026-09-02T08:00:00Z');
  assert.deepEqual(await counts(), [1, 1, 0, 0]);
  /* Käigumustrita klient: kedagi ei ole teavitada. */
  await set(peeter, { status: 'AWAY', statusReason: 'HOSPITAL' }, '2026-10-01T08:00:00Z');
  assert.deepEqual(await counts(), [1, 1, 0, 0]);

  /* KAUA ÄRA: üle 30 päeva ära olnud klient on nimekirjas, hiljuti lahkunu ei ole. */
  const due = (await getDeadlines(lead, deps())).awayLong;
  assert.deepEqual(
    due.map((item) => [item.client.displayName, item.since, item.days, item.reason]),
    [['Linda Tamm', '2026-09-02', 37, 'WITH_FAMILY']]
  );

  /* TAGASI TEENUSELE: käigud jätkuvad, töötajad saavad teate. */
  await set(linda, { status: 'ACTIVE' }, '2026-10-09T08:10:00Z');
  assert.deepEqual(await counts(), [2, 2, 0, 0]);
  assert.deepEqual((await getDeadlines(lead, deps())).awayLong, []);
  await readAll();

  /* SURM: ilma allikata ei salvestata; tühikud ei ole allikas; muu alus allikat ei nõua. */
  const died = { status: 'ENDED', statusReason: 'DIED' };
  await expectError(set(linda, died, '2026-10-09T08:20:00Z'), 400, 'home_care.errors.status_source_required');
  await expectError(set(linda, { ...died, statusNote: '   ' }, '2026-10-09T08:20:00Z'), 400, 'home_care.errors.status_source_required');
  assert.deepEqual([(await db.careClient.findUnique({ where: { id: linda.id } })).status, await counts()], ['ACTIVE', [2, 2, 0, 0]]);
  const ended = await set(linda, { ...died, statusNote: 'Tütar Mari helistas' }, '2026-10-09T08:21:00Z');
  assert.deepEqual([ended.client.status, ended.client.statusReason, ended.client.statusNote], ['ENDED', 'DIED', 'Tütar Mari helistas']);
  assert.deepEqual(await counts(), [3, 3, 0, 0]);
  /* Teavituses ei ole klienti ega põhjust. */
  const stored = JSON.stringify(await db.notificationEvent.findMany({ where: { type: TYPE, workspaceId: f.orgA.id } }));
  for (const secret of ['Linda', linda.id, 'DIED', 'Mari']) assert.equal(stored.includes(secret), false, secret);
  await set(peeter, { status: 'ENDED', statusReason: 'MOVED' }, '2026-10-09T08:22:00Z');
  /* Lõppenud teenusega klient ei ole enam „ära" nimekirjas; mustri read jäid alles (ekslik lõpetamine on tagasi võetav). */
  assert.deepEqual((await getDeadlines(lead, deps())).awayLong, []);
  assert.equal(await db.careVisitSlot.count({ where: { clientId: linda.id } }), 5);
});

test('„kas midagi oli teisiti?": tavaline seis, vastus käigu kirjel, märkamise reegel ja hooldusjuhi vastus', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const cover = await f.ctx(f.users.cover, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi' }, deps())).client;
  for (const member of [f.members.anu, f.members.bert]) await addTeamMember(lead, linda.id, { membershipId: member.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.anu.id }, deps());

  /* TAVALINE SEIS: meeskond ja hooldusjuht kirjutavad; kõrvaline ja teine asutus ei saa. */
  assert.deepEqual((await openClient(anu, linda.id, deps())).usualState, []);
  const first = await saveUsualState(anu, linda.id, { areas: { MOOD: ' Jutukas,  räägib lastelastest ', MOBILITY: 'Liigub rulaatoriga' } }, deps());
  assert.deepEqual(first.usualState.map((row) => [row.area, row.text, row.byName]), [
    ['MOBILITY', 'Liigub rulaatoriga', 'Anu Hooldaja'],
    ['MOOD', 'Jutukas, räägib lastelastest', 'Anu Hooldaja']
  ]);
  /* Muudetud valdkonna eelmine rida lõpeb; muutmata jääb puutumata; tühi tekst eemaldab valdkonna. */
  const second = await saveUsualState(lead, linda.id, { areas: { MOOD: 'Vaikne, aga vastab', MOBILITY: 'Liigub rulaatoriga', HOME: '' } }, deps(at('2026-10-09T08:05:00Z')));
  assert.deepEqual(second.usualState.map((row) => [row.area, row.text, row.byName]), [
    ['MOBILITY', 'Liigub rulaatoriga', 'Anu Hooldaja'],
    ['MOOD', 'Vaikne, aga vastab', 'Juta Juht']
  ]);
  await saveUsualState(lead, linda.id, { areas: { MOBILITY: '' } }, deps(at('2026-10-09T08:06:00Z')));
  assert.deepEqual((await openClient(bert, linda.id, deps())).usualState.map((row) => row.area), ['MOOD']);
  assert.equal(await db.careUsualState.count({ where: { clientId: linda.id } }), 3);
  await expectError(saveUsualState(clerk, linda.id, { areas: { MOOD: 'x' } }, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(saveUsualState(leadB, linda.id, { areas: { MOOD: 'x' } }, deps()), 404);
  await expectError(saveUsualState(bert, peeter.id, { areas: { MOOD: 'x' } }, deps()), 403, 'home_care.errors.access_reason_required');

  /* VASTUS KÄIGU KIRJEL. „Ei" ei ava midagi; üks tavaline „jah" samuti mitte. */
  const TYPE = 'HOME_CARE_CHANGE_NOTICED';
  const noticed = () => Promise.all([f.users.lead, f.users.anu, f.users.bert].map((user) => db.notificationEvent.count({ where: { userId: user.id, type: TYPE } })));
  const signals = () => db.careChangeSignal.findMany({ where: { clientId: linda.id }, orderBy: [{ openedAt: 'asc' }, { area: 'asc' }] });
  const visit = (who, change, text, when) =>
    createEntry(who, linda.id, { kind: 'NOTE', contactMode: 'VISIT', text, change, occurredAt: when }, depsWithNotify(at(when)));
  const no = await visit(anu, { answer: 'NO' }, 'Kõik nagu ikka', '2026-09-20T09:00:00Z');
  assert.deepEqual(no.entry.change, { answer: 'NO', areas: [], major: false });
  const one = await visit(anu, { answer: 'YES', areas: ['MOOD', 'EATING'] }, 'Ei tahtnud süüa ega rääkida', '2026-09-21T09:00:00Z');
  assert.deepEqual(one.entry.change, { answer: 'YES', areas: ['EATING', 'MOOD'], major: false });
  /* Sama hooldaja teine märge ei loe: muutust peab nägema teine silmapaar. */
  await visit(anu, { answer: 'YES', areas: ['MOOD'] }, 'Ikka vaikne', '2026-09-23T09:00:00Z');
  assert.deepEqual([(await signals()).length, await noticed()], [0, [0, 0, 0]]);
  await expectError(visit(anu, { answer: 'YES', areas: ['MOOD'] }, '', '2026-09-24T09:00:00Z'), 400, 'home_care.errors.change_text_required');

  /* TEINE HOOLDAJA 14 päeva sees, sama valdkond: märkamine tekib selle valdkonna kohta; hooldusjuht saab teate. */
  const two = await visit(bert, { answer: 'YES', areas: ['MOOD', 'HOME'] }, 'Vaikne, nõud pesemata', '2026-10-02T09:00:00Z');
  let rows = await signals();
  assert.deepEqual(rows.map((row) => [row.area, row.reason, row.entryId, row.handledAt]), [['MOOD', 'TWO_WORKERS', two.entry.id, null]]);
  assert.deepEqual(await noticed(), [1, 0, 0]);
  /* Teavituses ei ole klienti, valdkonda ega teksti; link viib suunajale. */
  const event = await db.notificationEvent.findFirst({ where: { userId: f.users.lead.id, type: TYPE } });
  const stored = JSON.stringify(event);
  for (const secret of ['Linda', linda.id, 'MOOD', 'Vaikne']) assert.equal(stored.includes(secret), false, secret);
  const shown = serializeNotificationEvent(event);
  assert.deepEqual([shown.href, shown.labelKey], [`/org/koduteenus/muutus/${rows[0].id}`, 'notifications.events.home_care_change_noticed']);
  await assertNotificationRecipient(db, { type: TYPE, userId: f.users.lead.id, sourceId: rows[0].id, targetId: rows[0].id });
  await assert.rejects(assertNotificationRecipient(db, { type: TYPE, userId: f.users.anu.id, sourceId: rows[0].id, targetId: rows[0].id }), (error) => error.status === 404);
  /* Lahtise märkamise kõrvale teist ei teki; liiga vana märge (üle 14 päeva) paari ei anna. */
  await visit(anu, { answer: 'YES', areas: ['MOOD'] }, 'Sama', '2026-10-03T09:00:00Z');
  await visit(bert, { answer: 'YES', areas: ['EATING'] }, 'Sõi vähe', '2026-10-08T09:00:00Z');
  assert.deepEqual((await signals()).map((row) => row.area), ['MOOD']);

  /* SUUR MUUTUS avab märkamise kohe, ka ühe hooldaja märkega. */
  const big = await visit(anu, { answer: 'YES', areas: ['MOBILITY'], major: true }, 'Ei saanud voodist üles', '2026-10-09T07:30:00Z');
  rows = await signals();
  assert.deepEqual(rows.map((row) => [row.area, row.reason]), [['MOOD', 'TWO_WORKERS'], ['MOBILITY', 'MAJOR']]);
  assert.equal(rows[1].entryId, big.entry.id);
  assert.deepEqual(await noticed(), [2, 0, 0]);
  /* Ilma teavitusteta kutsuja ei saada ka seda teadet; kordussaatmine ei ava teist märkamist. */
  const body = { kind: 'NOTE', contactMode: 'VISIT', text: 'Nahk punetab', change: { answer: 'YES', areas: ['SKIN_PAIN'], major: true }, clientRequestId: randomUUID() };
  await createEntry(bert, linda.id, body, deps(at('2026-10-09T07:40:00Z')));
  await createEntry(bert, linda.id, body, depsWithNotify(at('2026-10-09T07:41:00Z')));
  assert.deepEqual([(await signals()).length, await noticed()], [3, [2, 0, 0]]);

  /* KLIENDI LEHT: märkamisi näeb ainult hooldusjuht; päevikus on vastus kirje küljes. */
  assert.equal((await openClient(anu, linda.id, deps())).changeSignals, null);
  const page = await openClient(lead, linda.id, deps());
  assert.deepEqual(page.changeSignals.open.map((row) => [row.area, row.reason, row.days]), [
    ['MOOD', 'TWO_WORKERS', 7],
    ['MOBILITY', 'MAJOR', 0],
    ['SKIN_PAIN', 'MAJOR', 0]
  ]);
  assert.deepEqual(page.entries.items.find((item) => item.id === big.entry.id).change, { answer: 'YES', areas: ['MOBILITY'], major: true });
  /* TÄHTAEGADE LEHT: kõige kauem oodanu ees. */
  const due = (await getDeadlines(lead, deps())).changesOpen;
  assert.deepEqual(due.map((row) => [row.client.displayName, row.area, row.days]), [
    ['Linda Tamm', 'MOOD', 7],
    ['Linda Tamm', 'MOBILITY', 0],
    ['Linda Tamm', 'SKIN_PAIN', 0]
  ]);

  /* VASTUS: ainult hooldusjuht, liik kohustuslik, üks kord. */
  const mood = rows[0];
  await expectError(handleChangeSignal(anu, mood.id, { outcome: 'WATCHING' }, deps()), 403, 'org.errors.missing_capability');
  await expectError(handleChangeSignal(leadB, mood.id, { outcome: 'WATCHING' }, deps()), 404, 'home_care.errors.change_signal_not_found');
  await expectError(handleChangeSignal(lead, mood.id, { note: 'x' }, deps()), 400, 'home_care.errors.change_outcome_required');
  const handled = await handleChangeSignal(lead, mood.id, { outcome: 'TOLD_RELATIVE', note: '  Tütar tuleb  nädalavahetusel ' }, deps(at('2026-10-09T09:00:00Z')));
  assert.deepEqual(handled.changeSignals.open.map((row) => row.area), ['MOBILITY', 'SKIN_PAIN']);
  assert.deepEqual(handled.changeSignals.handled.map((row) => [row.area, row.outcome, row.note, row.handledByName]), [
    ['MOOD', 'TOLD_RELATIVE', 'Tütar tuleb nädalavahetusel', 'Juta Juht']
  ]);
  await expectError(handleChangeSignal(lead, mood.id, { outcome: 'WATCHING' }, deps()), 409, 'home_care.errors.change_signal_handled');

  /* Vastuse saanud märked uut märkamist ei ava: alles kahe eri hooldaja UUED märked teevad seda. */
  await visit(anu, { answer: 'YES', areas: ['MOOD'] }, 'Jälle vaikne', '2026-10-09T10:00:00Z');
  assert.equal((await signals()).filter((row) => row.area === 'MOOD').length, 1);
  await visit(bert, { answer: 'YES', areas: ['MOOD'] }, 'Ei vastanud küsimustele', '2026-10-09T11:00:00Z');
  assert.deepEqual((await signals()).filter((row) => row.area === 'MOOD').map((row) => Boolean(row.handledAt)), [true, false]);

  /* ANDMEBAAS hoiab reeglid ka ilma teenuseta. */
  const raw = (data) => db.careClientEntry.create({ data: { organizationId: f.orgA.id, clientId: linda.id, authorMembershipId: f.members.anu.id, authorName: 'x', kind: 'NOTE', contactMode: 'VISIT', text: 'x', occurredAt: NOW, ...data } });
  await assert.rejects(raw({ changeAnswer: 'YES', changeAreas: [] }), /CareClientEntry_changeAreas_check/);
  await assert.rejects(raw({ changeAnswer: 'NO', changeAreas: ['MOOD'] }), /CareClientEntry_changeAreas_check/);
  await assert.rejects(raw({ changeAnswer: 'YES', changeAreas: ['MUU'] }), /CareClientEntry_changeAreas_check/);
  await assert.rejects(raw({ changeAnswer: 'VIST' }), /CareClientEntry_changeAnswer_check/);
  await assert.rejects(raw({ changeAreas: ['MOOD'] }), /CareClientEntry_changeAreas_check/);
  await assert.rejects(raw({ changeMajor: true }), /CareClientEntry_changeAreas_check/);
  await assert.rejects(db.careChangeSignal.create({ data: { organizationId: f.orgA.id, clientId: linda.id, area: 'MOBILITY', reason: 'MAJOR' } }), /CareChangeSignal_open_key|Unique constraint/);
  await assert.rejects(db.careChangeSignal.create({ data: { organizationId: f.orgA.id, clientId: peeter.id, area: 'HOME', reason: 'MAJOR', handledAt: NOW } }), /CareChangeSignal_handled_check/);
  await assert.rejects(db.careUsualState.create({ data: { organizationId: f.orgA.id, clientId: linda.id, area: 'MOOD', text: 'teine kehtiv' } }), /CareUsualState_active_key|Unique constraint/);

  /* AUDIT: ainult kliendi ID ja muutuse liik. */
  const audit = await db.dataAuditLog.findMany({
    where: { action: { in: ['org.home_care_usual_state_changed', 'org.home_care_change_signal_handled'] }, meta: { path: ['organizationId'], equals: f.orgA.id } }
  });
  assert.deepEqual(audit.map((entry) => `${entry.action}:${entry.meta.change}`).sort(), [
    'org.home_care_change_signal_handled:handled',
    'org.home_care_usual_state_changed:saved',
    'org.home_care_usual_state_changed:saved',
    'org.home_care_usual_state_changed:saved'
  ]);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'organizationId']);
});

test('kriisivalmidus: hinnang kliendi juures, õigused, nimekiri rühmade kaupa ja nädala käiguaeg', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm', address: 'Pikk 1', contactPhone: '5555 1234' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi', unitId: north.id }, deps())).client;
  const uus = (await createClient(lead, { displayName: 'Uus Klient' }, deps())).client;
  const ended = (await createClient(lead, { displayName: 'Lõppenud Klient' }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await createSlots(lead, linda.id, { weekdays: [1, 3, 5], startTime: '09:00', plannedMinutes: 30, workerMembershipId: f.members.anu.id }, deps(at('2026-10-01T08:00:00Z')));
  /* Lõppenud mustririda nädala aega ei loe. */
  await createSlots(lead, linda.id, { weekdays: [2], startTime: '12:00', plannedMinutes: 60, validUntil: '2026-10-05' }, deps(at('2026-10-01T08:00:00Z')));

  /* HINNANG: ainult hooldusjuht; meeskond loeb. */
  assert.equal((await openClient(anu, linda.id, deps())).crisis, null);
  await expectError(setCrisisProfile(anu, linda.id, { level: 'DAILY' }, deps()), 403, 'org.errors.missing_capability');
  await expectError(setCrisisProfile(leadB, linda.id, { level: 'DAILY' }, deps()), 404);
  await expectError(setCrisisProfile(lead, linda.id, { dependencies: ['WATER'] }, deps()), 400, 'home_care.errors.crisis_level_required');
  await expectError(clearCrisisProfile(lead, linda.id, deps()), 404, 'home_care.errors.crisis_not_found');
  const first = await setCrisisProfile(lead, linda.id, { level: 'WEEKLY', dependencies: ['HEATING'] }, deps());
  assert.deepEqual([first.crisis.level, first.crisis.dependencies, first.crisis.setByName], ['WEEKLY', ['HEATING'], 'Juta Juht']);
  /* Uus hinnang lõpetab eelmise; rida jääb alles. */
  const second = await setCrisisProfile(lead, linda.id, { level: 'DAILY', dependencies: ['HEATING', 'ELECTRICITY'], helper: ' Poeg  Mart ', note: 'Hapnikuaparaat' }, deps(at('2026-10-09T08:05:00Z')));
  assert.deepEqual([second.crisis.level, second.crisis.dependencies, second.crisis.helper, second.crisis.note], ['DAILY', ['ELECTRICITY', 'HEATING'], 'Poeg Mart', 'Hapnikuaparaat']);
  assert.deepEqual((await openClient(anu, linda.id, deps())).crisis.level, 'DAILY');
  assert.deepEqual((await db.careCrisisProfile.findMany({ where: { clientId: linda.id }, orderBy: { createdAt: 'asc' } })).map((row) => [row.level, Boolean(row.endedAt)]), [
    ['WEEKLY', true],
    ['DAILY', false]
  ]);
  await setCrisisProfile(unitLead, peeter.id, { level: 'SELF' }, deps());
  await expectError(setCrisisProfile(unitLead, linda.id, { level: 'SELF' }, deps()), 403);
  /* Lõppenud teenusega klient nimekirja ei tule, kuigi tal on hinnang. */
  await setCrisisProfile(lead, ended.id, { level: 'DAILY' }, deps());
  const endedVersion = (await db.careClient.findUnique({ where: { id: ended.id }, select: { version: true } })).version;
  await setClientStatus(lead, ended.id, { version: endedVersion, status: 'ENDED', statusReason: 'MOVED' }, deps());

  /* NIMEKIRI: rühmad kiireloomulisuse järjekorras, nädala käiguaeg, hindamata eraldi. */
  const list = await getCrisisList(lead, deps());
  assert.deepEqual(list.groups.map((group) => [group.level, group.clients.map((item) => item.client.displayName), group.weeklyMinutes]), [
    ['DAILY', ['Linda Tamm'], 90],
    ['WEEKLY', [], 0],
    ['SELF', ['Peeter Põhi'], 0]
  ]);
  assert.deepEqual([list.groups[0].clients[0].address, list.groups[0].clients[0].phone, list.groups[0].clients[0].weeklyMinutes], ['Pikk 1', '5555 1234', 90]);
  assert.deepEqual(list.unset.map((item) => item.client.displayName), ['Uus Klient']);
  assert.deepEqual([list.clientCount, list.truncated, list.today], [3, false, '2026-10-09']);
  /* Üksuse hooldusjuht näeb ainult oma üksuse kliente; hooldaja ei näe nimekirja. */
  const scoped = await getCrisisList(unitLead, deps());
  assert.deepEqual([scoped.groups.flatMap((group) => group.clients.map((item) => item.client.displayName)), scoped.unset.length], [['Peeter Põhi'], 0]);
  await expectError(getCrisisList(anu, deps()), 403, 'org.errors.missing_capability');

  /* MAHAVÕTMINE: klient läheb tagasi hindamata hulka. */
  assert.equal((await clearCrisisProfile(lead, linda.id, deps())).crisis, null);
  assert.deepEqual((await getCrisisList(lead, deps())).unset.map((item) => item.client.displayName), ['Linda Tamm', 'Uus Klient']);
  assert.equal(uus.id.length > 0, true);

  /* ANDMEBAAS hoiab reeglid ka ilma teenuseta. */
  const raw = (data) => db.careCrisisProfile.create({ data: { organizationId: f.orgA.id, clientId: uus.id, level: 'SELF', dependencies: [], ...data } });
  await assert.rejects(raw({ level: 'MUU' }), /CareCrisisProfile_level_check/);
  await assert.rejects(raw({ dependencies: ['GAAS'] }), /CareCrisisProfile_dependencies_check/);
  await assert.rejects(raw({ helper: '   ' }), /CareCrisisProfile_text_check/);
  await raw({});
  await assert.rejects(raw({}), /CareCrisisProfile_active_key|Unique constraint/);

  /* AUDIT: ainult kliendi ID ja muutuse liik. */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_crisis_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual(audit.map((entry) => entry.meta.change).sort(), ['cleared', 'set', 'set', 'set', 'set']);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'organizationId']);
});

test('„kuhu suunata": asutuse loend, kes loeb ja kes muudab, versioonid ja andmebaasi reeglid', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);

  /* Algus: loendit ei ole; muuta tohib ainult kogu asutuse hooldusjuht. */
  assert.deepEqual(await getReferralContacts(anu, deps()), { referrals: [], canEditReferrals: false });
  assert.equal((await getReferralContacts(lead, deps())).canEditReferrals, true);
  assert.equal((await getReferralContacts(unitLead, deps())).canEditReferrals, false);
  const input = { contacts: [{ name: 'Valla sotsiaaltöötaja', phone: '5555 1234', note: 'tööpäeviti 8–16' }, { name: '' }, { name: 'Perearstikeskus', phone: '+372 473 0000' }] };
  await expectError(saveReferralContacts(anu, input, deps()), 403, 'org.errors.missing_capability');
  await expectError(saveReferralContacts(unitLead, input, deps()), 403, 'org.errors.missing_capability');
  await expectError(saveReferralContacts(lead, { contacts: [{ phone: '112' }] }, deps()), 400, 'home_care.errors.referral_name_required');

  const saved = await saveReferralContacts(lead, input, deps());
  assert.deepEqual(saved.referrals.map((row) => [row.position, row.name, row.phone, row.note]), [
    [1, 'Valla sotsiaaltöötaja', '5555 1234', 'tööpäeviti 8–16'],
    [2, 'Perearstikeskus', '+372 473 0000', null]
  ]);
  /* Hooldaja loeb sama loendit; teine asutus ei näe seda. */
  assert.deepEqual((await getReferralContacts(anu, deps())).referrals.map((row) => row.name), ['Valla sotsiaaltöötaja', 'Perearstikeskus']);
  assert.deepEqual((await getReferralContacts(leadB, deps())).referrals, []);
  /* Muutmata loend ei tee midagi; muudetud loend lõpetab eelmise read. */
  const again = await saveReferralContacts(lead, input, deps());
  assert.deepEqual(again.referrals.map((row) => row.id), saved.referrals.map((row) => row.id));
  const changed = await saveReferralContacts(lead, { contacts: [{ name: 'Perearstikeskus', phone: '+372 473 0000' }] }, deps(at('2026-10-09T08:05:00Z')));
  assert.deepEqual(changed.referrals.map((row) => [row.position, row.name]), [[1, 'Perearstikeskus']]);
  assert.deepEqual([await db.careReferralContact.count({ where: { organizationId: f.orgA.id } }), await db.careReferralContact.count({ where: { organizationId: f.orgA.id, endedAt: null } })], [3, 1]);
  const cleared = await saveReferralContacts(lead, { contacts: [] }, deps(at('2026-10-09T08:06:00Z')));
  assert.deepEqual(cleared.referrals, []);

  /* ANDMEBAAS hoiab reeglid ka ilma teenuseta. */
  const raw = (data) => db.careReferralContact.create({ data: { organizationId: f.orgA.id, position: 1, name: 'Koht', ...data } });
  await assert.rejects(raw({ position: 21 }), /CareReferralContact_position_check/);
  await assert.rejects(raw({ name: '   ' }), /CareReferralContact_text_check/);
  await assert.rejects(raw({ phone: '1' }), /CareReferralContact_text_check/);
  await raw({});
  await assert.rejects(raw({}), /CareReferralContact_active_key|Unique constraint/);

  /* AUDIT: ainult asutuse ID ja muutuse liik (nimesid ega numbreid seal ei ole). */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_referrals_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual(audit.map((entry) => entry.meta.change).sort(), ['cleared', 'saved', 'saved']);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'organizationId']);
});

test('ravimitoimingu märge: käigu kirjel, ainult ravimitoimingul, parandus ja päevaplaani märk', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi' }, deps())).client;
  const mari = (await createClient(lead, { displayName: 'Mari Mets' }, deps())).client;
  for (const client of [linda, peeter, mari]) await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  const pills = (await createActivity(lead, { group: 'MEDICATION', name: 'Hommikused ravimid' }, deps())).activity;
  const stove = (await createActivity(lead, { group: 'HEATING', name: 'Ahju kütmine' }, deps())).activity;
  /* Lindal ja Maril on kavas ravimitoiming, Peetril ainult kütmine. */
  const plan = async (client, lines) => {
    const draft = (await saveCarePlanDraft(lead, client.id, { goals: 'Kodus edasi elada.', lines }, deps())).draft;
    await activateCarePlan(lead, client.id, { version: draft.version }, deps());
  };
  const line = (activity) => ({ activityId: activity.id, frequencyKind: 'DAILY', frequencyCount: 1, mode: 'GUIDE' });
  await plan(linda, [line(pills), line(stove)]);
  await plan(mari, [line(pills)]);
  await plan(peeter, [line(stove)]);
  const early = deps(at('2026-10-01T08:00:00Z'));
  for (const client of [linda, peeter, mari]) {
    await createSlots(lead, client.id, { weekdays: [5], startTime: client === mari ? '08:00' : '12:00', plannedMinutes: 30, workerMembershipId: f.members.anu.id }, early);
  }
  const medicationOf = async (when) => {
    const day = await getDayPlan(lead, {}, deps(at(when)));
    const visits = day.workers.flatMap((worker) => worker.visits);
    return [Object.fromEntries(visits.map((visit) => [visit.client.displayName, visit.medication])), day.medicationOpen];
  };

  /* HOMMIK (11:00 kohaliku aja järgi): Mari kell 8 käik on tegemata, teised on ees. */
  assert.deepEqual(await medicationOf('2026-10-09T08:00:00Z'), [{ 'Linda Tamm': 'DUE', 'Peeter Põhi': null, 'Mari Mets': 'MISSED' }, 1]);

  /* MÄRGE ainult ravimitoimingul ja ainult loendist. */
  const visit = (client, activities, extra = {}) => createEntry(anu, client.id, { kind: 'NOTE', contactMode: 'VISIT', activities, ...extra }, deps(at('2026-10-09T10:00:00Z')));
  await expectError(visit(linda, [{ activityId: stove.id, mode: 'FOR', medication: 'GAVE' }]), 400, 'home_care.errors.medication_action_not_allowed');
  await expectError(visit(linda, [{ activityId: pills.id, mode: 'GUIDE', medication: 'SÜSTISIN' }]), 400, 'home_care.errors.medication_action_invalid');

  /* Linda: käik kirjas ilma ravimita (ainult kütmine) → märkimata; Peeter: ravimit kavas ei ole → märki ei ole. */
  await visit(linda, [{ activityId: stove.id, mode: 'FOR' }]);
  await visit(peeter, [{ activityId: stove.id, mode: 'FOR' }]);
  assert.deepEqual(await medicationOf('2026-10-09T10:05:00Z'), [{ 'Linda Tamm': 'UNMARKED', 'Peeter Põhi': null, 'Mari Mets': 'MISSED' }, 2]);

  /* Mari keeldus ravimist: see on märge (tegemata), mitte puuduv märge. */
  await visit(mari, [{ activityId: pills.id, outcome: 'REFUSED' }], { text: 'Ei tahtnud võtta' });
  /* Linda teine kirje samal päeval: ravim märgitud. */
  const marked = await visit(linda, [{ activityId: pills.id, mode: 'GUIDE', medication: 'SAW_TAKEN' }]);
  assert.deepEqual(marked.entry.visit.activities.map((item) => [item.name, item.outcome, item.medication]), [['Hommikused ravimid', 'DONE', 'SAW_TAKEN']]);
  assert.deepEqual(await medicationOf('2026-10-09T10:10:00Z'), [{ 'Linda Tamm': 'MARKED', 'Peeter Põhi': null, 'Mari Mets': 'NOT_DONE' }, 0]);

  /* PARANDUS: saatmata märge jääb alles; uus märge asendab; tegemata muutes märge kaob. */
  const correct = (activities, revision) =>
    correctEntry(anu, linda.id, marked.entry.id, { reason: 'Parandus', revision, activities }, deps(at('2026-10-09T10:20:00Z')));
  const kept = await correct([{ activityId: pills.id, mode: 'TOGETHER' }], marked.entry.revision);
  assert.deepEqual(kept.entry.visit.activities.map((item) => [item.mode, item.medication]), [['TOGETHER', 'SAW_TAKEN']]);
  const changed = await correct([{ activityId: pills.id, mode: 'TOGETHER', medication: 'GAVE' }], kept.entry.revision);
  assert.equal(changed.entry.visit.activities[0].medication, 'GAVE');
  const refusedLater = await correct([{ activityId: pills.id, outcome: 'COULD_NOT' }], changed.entry.revision);
  assert.deepEqual(refusedLater.entry.visit.activities.map((item) => [item.outcome, item.medication]), [['COULD_NOT', null]]);
  assert.deepEqual((await medicationOf('2026-10-09T10:30:00Z'))[0]['Linda Tamm'], 'NOT_DONE');
  /* Tühistatud kirje märget ei loe: Mari käik on kirjas, ravimi kohta enam midagi ei ole. */
  const mariEntry = await db.careClientEntry.findFirst({ where: { clientId: mari.id }, select: { id: true, revision: true } });
  await retractEntry(anu, mari.id, mariEntry.id, { reason: 'Vale klient', revision: mariEntry.revision }, deps(at('2026-10-09T10:40:00Z')));
  assert.deepEqual((await medicationOf('2026-10-09T10:45:00Z'))[0]['Mari Mets'], 'MISSED');

  /* ANDMEBAAS hoiab reegli ka ilma teenuseta. */
  const anyEntry = await db.careClientEntry.findFirst({ where: { clientId: linda.id }, select: { id: true } });
  const raw = (data) =>
    db.careEntryActivity.create({
      data: { organizationId: f.orgA.id, entryId: anyEntry.id, clientId: linda.id, activityName: 'x', activityGroup: 'MEDICATION', mode: 'GUIDE', ...data }
    });
  await assert.rejects(raw({ medicationAction: 'SÜSTISIN' }), /CareEntryActivity_medicationAction_check/);
  await assert.rejects(raw({ medicationAction: 'GAVE', activityGroup: 'HEATING' }), /CareEntryActivity_medicationAction_check/);
  await assert.rejects(raw({ medicationAction: 'GAVE', outcome: 'REFUSED' }), /CareEntryActivity_medicationAction_check/);

  /* KUU KOKKUVÕTE (K5-i): arvud kliendi kaupa; kliendil ilma ravimiridadeta võtit ei ole; tühistatud kirje ei loe. */
  const month = await getMonthSummary(lead, { month: '2026-10' }, deps(at('2026-10-09T11:00:00Z')));
  const of = (name) => month.clients.find((row) => row.client.displayName === name);
  assert.deepEqual(of('Linda Tamm').medication, { reminded: 0, sawTaken: 0, gave: 0, unmarked: 0, notDone: 1 });
  assert.equal('medication' in of('Peeter Põhi'), false);
  assert.equal('medication' in of('Mari Mets'), false);
});

test('töötaja kaart: taustakontroll ja koolitused, ainult kogu asutuse hooldusjuht, tähtaegade nimekiri', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  for (const member of [f.members.anu, f.members.bert]) await addTeamMember(lead, linda.id, { membershipId: member.id }, deps());

  /* Kaardil on hooldajad (kellegi meeskonnas olevad liikmed); alguses ridu ei ole ja taustakontrolli rida puudub. */
  const empty = await getWorkerCards(lead, deps());
  assert.deepEqual(empty.workers.map((worker) => [worker.name, worker.records.length, worker.backgroundMissing]), [
    ['Anu Hooldaja', 0, true],
    ['Bert Hooldaja', 0, true]
  ]);
  /* Ainult kogu asutuse hooldusjuht: hooldaja, üksuse hooldusjuht ja teine asutus ei näe ega kirjuta. */
  await expectError(getWorkerCards(anu, deps()), 403, 'org.errors.missing_capability');
  await expectError(getWorkerCards(unitLead, deps()), 403, 'org.errors.missing_capability');
  const check = { membershipId: f.members.anu.id, kind: 'BACKGROUND_CHECK', doneOn: '2026-01-10' };
  await expectError(addWorkerRecord(anu, check, deps()), 403, 'org.errors.missing_capability');
  await expectError(addWorkerRecord(leadB, check, deps()), 404, 'home_care.errors.worker_not_found');
  /* Liige, kes ei ole ühegi kliendi meeskonnas, ei ole hooldaja. */
  await expectError(addWorkerRecord(lead, { ...check, membershipId: f.members.clerk.id }, deps()), 404, 'home_care.errors.worker_not_found');

  await addWorkerRecord(lead, { ...check, title: 'karistusi ei ole' }, deps());
  await addWorkerRecord(lead, { membershipId: f.members.anu.id, kind: 'TRAINING', title: 'Esmaabi', doneOn: '2023-11-01', validUntil: '2026-11-01' }, deps());
  await addWorkerRecord(lead, { membershipId: f.members.anu.id, kind: 'TRAINING', title: 'Ergonoomika', doneOn: '2024-05-01', validUntil: '2026-05-01' }, deps());
  const cards = await addWorkerRecord(lead, { membershipId: f.members.anu.id, kind: 'TRAINING', title: 'Dementsus', doneOn: '2026-02-01' }, deps());
  const anuCard = cards.workers.find((worker) => worker.membershipId === f.members.anu.id);
  assert.deepEqual([anuCard.backgroundMissing, anuCard.backgroundChecked], [false, true]);
  assert.deepEqual(anuCard.records.map((record) => [record.kind, record.title, record.doneOn, record.validUntil, record.daysLeft, record.expired, record.soon]), [
    ['TRAINING', 'Dementsus', '2026-02-01', null, null, false, false],
    ['BACKGROUND_CHECK', null, '2026-01-10', null, null, false, false],
    ['TRAINING', 'Ergonoomika', '2024-05-01', '2026-05-01', -161, true, false],
    ['TRAINING', 'Esmaabi', '2023-11-01', '2026-11-01', 23, false, true]
  ]);
  /* Taustakontrolli juurde saadetud tekst ei jõudnud andmebaasi. */
  assert.equal(await db.careWorkerRecord.count({ where: { organizationId: f.orgA.id, kind: 'BACKGROUND_CHECK', title: { not: null } } }), 0);

  /* TÄHTAEGADE LEHT: aegunud enne, siis varsti aeguv, puuduva taustakontrolliga töötaja lõpus; üksuse hooldusjuhile tühi. */
  const due = (await getDeadlines(lead, deps())).workerRecordsDue;
  assert.deepEqual(due.map((item) => [item.worker.name, item.kind, item.title, item.daysLeft, item.expired]), [
    ['Anu Hooldaja', 'TRAINING', 'Ergonoomika', -161, true],
    ['Anu Hooldaja', 'TRAINING', 'Esmaabi', 23, false],
    ['Bert Hooldaja', 'MISSING_BACKGROUND', null, null, false]
  ]);
  assert.deepEqual((await getDeadlines(unitLead, deps())).workerRecordsDue, []);

  /* EEMALDAMINE: rida saab lõpu ja kaob kaardilt; teist korda ei leita. */
  const stale = anuCard.records.find((record) => record.title === 'Ergonoomika');
  const after = await endWorkerRecord(lead, stale.id, deps(at('2026-10-09T08:05:00Z')));
  assert.equal(after.workers.find((worker) => worker.membershipId === f.members.anu.id).records.length, 3);
  await expectError(endWorkerRecord(lead, stale.id, deps()), 404, 'home_care.errors.worker_record_not_found');
  await expectError(endWorkerRecord(anu, anuCard.records[0].id, deps()), 403, 'org.errors.missing_capability');
  assert.equal(await db.careWorkerRecord.count({ where: { membershipId: f.members.anu.id } }), 4);

  /* ANDMEBAAS hoiab reeglid ka ilma teenuseta. */
  const raw = (data) => db.careWorkerRecord.create({ data: { organizationId: f.orgA.id, membershipId: f.members.bert.id, kind: 'BACKGROUND_CHECK', doneOn: '2026-01-01', ...data } });
  await assert.rejects(raw({ kind: 'MUU' }), /CareWorkerRecord_kind_check/);
  await assert.rejects(raw({ title: 'tulemus' }), /CareWorkerRecord_title_check/);
  await assert.rejects(raw({ kind: 'TRAINING' }), /CareWorkerRecord_title_check/);
  await assert.rejects(raw({ doneOn: '01.01.2026' }), /CareWorkerRecord_days_check/);
  await assert.rejects(raw({ validUntil: '2025-12-31' }), /CareWorkerRecord_days_check/);

  /* AUDIT: töötaja liikmesuse ID ja muutuse liik; teemat ega kuupäeva seal ei ole. */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_worker_record_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual(audit.map((entry) => entry.meta.change).sort(), ['added', 'added', 'added', 'added', 'removed']);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'membershipId', 'organizationId']);
});

test('püsivuse näit kliendi lehel ja üle aasta vanad ohuread tähtaegade lehel', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi' }, deps())).client;
  for (const member of [f.members.anu, f.members.bert]) await addTeamMember(lead, linda.id, { membershipId: member.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.anu.id }, deps());

  /* NÄIT: käikudeta kliendil seda ei ole. */
  assert.equal((await openClient(anu, linda.id, deps())).continuity, null);
  const visit = (who, when) => createEntry(who, linda.id, { kind: 'NOTE', contactMode: 'VISIT', text: 'Käik', visitMinutes: 30, occurredAt: when }, deps(at(when)));
  for (const day of ['01', '03', '05', '07']) await visit(anu, `2026-10-${day}T09:00:00Z`);
  await visit(bert, '2026-10-02T09:00:00Z');
  /* Üle nelja nädala vana käik, telefonikõne ja tühistatud käik näitu ei lähe. */
  await visit(lead, '2026-09-01T09:00:00Z');
  await createEntry(lead, linda.id, { kind: 'NOTE', contactMode: 'PHONE', text: 'Helistas', callTopic: 'STATUS', callCaller: 'CLIENT' }, deps());
  const wrong = await visit(lead, '2026-10-08T09:00:00Z');
  await retractEntry(lead, linda.id, wrong.entry.id, { reason: 'Vale klient', revision: wrong.entry.revision }, deps());
  assert.deepEqual((await openClient(anu, linda.id, deps())).continuity, { days: 28, visits: 5, workers: 2, topWorkers: 1, topPercent: 80 });

  /* OHUREAD: üle aasta vana ohurida on nimekirjas; värske ohurida, vana muu liigi rida ja lõpetatud rida ei ole. */
  const old = at('2025-09-01T08:00:00Z');
  const line = (clientId, kind, createdAt, endedAt = null) =>
    db.careClientCardLine.create({ data: { clientId, kind, text: 'Rida', position: 0, addedByMembershipId: f.members.lead.id, createdAt, endedAt } });
  await line(linda.id, 'RISK', old);
  await line(linda.id, 'RISK', at('2026-08-01T08:00:00Z'));
  await line(linda.id, 'ACCESS', old);
  await line(peeter.id, 'RISK', old, at('2026-01-01T08:00:00Z'));
  await line(peeter.id, 'RISK', at('2026-06-01T08:00:00Z'));
  const due = (await getDeadlines(lead, deps())).riskLinesDue;
  assert.deepEqual(due.map((item) => [item.client.displayName, item.lines, item.oldestOn, item.days]), [['Linda Tamm', 2, '2025-09-01', 403]]);
});

test('külmkapileht: koostab meeskond või hooldusjuht kehtivast mustrist ja kavast; midagi ei salvestata', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const bert = await f.ctx(f.users.bert, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm', address: 'Pikk 1' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi' }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  await addTeamMember(lead, peeter.id, { membershipId: f.members.bert.id }, deps());
  const stove = (await createActivity(lead, { group: 'HEATING', name: 'Ahju kütmine' }, deps())).activity;
  const draft = (await saveCarePlanDraft(lead, linda.id, { goals: 'Kodus edasi elada.', lines: [{ activityId: stove.id, frequencyKind: 'DAILY', frequencyCount: 1, mode: 'FOR' }] }, deps())).draft;
  await activateCarePlan(lead, linda.id, { version: draft.version }, deps());
  const early = deps(at('2026-10-01T08:00:00Z'));
  await createSlots(lead, linda.id, { weekdays: [1, 4], startTime: '09:00', plannedMinutes: 30, workerMembershipId: f.members.anu.id }, early);
  /* Lõppenud mustririda lehele ei lähe. */
  await createSlots(lead, linda.id, { weekdays: [6], startTime: '15:00', plannedMinutes: 60, validUntil: '2026-10-05' }, early);
  const counts = async () => [await db.dataAuditLog.count({ where: { meta: { path: ['organizationId'], equals: f.orgA.id } } }), await db.careClientEntry.count({ where: { clientId: linda.id } })];
  const before = await counts();

  const sheet = await getFridgeSheet(anu, linda.id, { phone: ' 5555  1234 ' }, deps());
  assert.match(sheet.html, /<span class="day">Esmaspäev<\/span> kell 9\.00–9\.30 · Anu<\/li>/);
  assert.match(sheet.html, /<span class="day">Neljapäev<\/span> kell 9\.00–9\.30 · Anu<\/li>/);
  assert.equal(sheet.html.includes('Laupäev'), false);
  assert.match(sheet.html, /<li>Ahju kütmine<\/li>/);
  assert.match(sheet.html, /<p class="call">5555 1234<\/p>/);
  assert.match(sheet.html, /kehtib alates 09\.10\.2026/);
  /* Lehel ei ole aadressi, töötaja perekonnanime ega kava eesmärke. */
  for (const secret of ['Pikk 1', 'Hooldaja', 'Kodus edasi elada']) assert.equal(sheet.html.includes(secret), false, secret);
  /* Hooldusjuht saab sama lehe; telefonita lehel on joon. */
  assert.match((await getFridgeSheet(lead, linda.id, {}, deps())).html, /<span class="blank">/);
  assert.deepEqual(await counts(), before);

  /* ÕIGUSED: võõra kliendi hooldaja, kõrvaline liige ja teine asutus lehte ei saa; vigane number lükatakse tagasi. */
  await expectError(getFridgeSheet(bert, linda.id, {}, deps()), 403, 'home_care.errors.access_reason_required');
  await expectError(getFridgeSheet(clerk, linda.id, {}, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(getFridgeSheet(leadB, linda.id, {}, deps()), 404);
  await expectError(getFridgeSheet(anu, linda.id, { phone: 'helista õhtul' }, deps()), 400, 'home_care.errors.referral_phone_invalid');
});

test('„peaaegu juhtus": erijuhtumi kirje registris ja teade hooldusjuhile', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());
  const made = await createEntry(anu, linda.id, { kind: 'INCIDENT', incidentType: 'NEAR_MISS', text: 'Peaaegu juhtus: libisesin või komistasin. Trepp oli jääs.' }, depsWithNotify());
  assert.deepEqual([made.entry.kind, made.entry.incident.type, made.entry.incident.status, made.entry.coordinatorOnly], ['INCIDENT', 'NEAR_MISS', 'OPEN', false]);
  /* Hooldusjuht saab erijuhtumi teate; kirjutaja ise ei saa. */
  const count = (user) => db.notificationEvent.count({ where: { userId: user.id, type: 'HOME_CARE_INCIDENT_REPORTED' } });
  assert.deepEqual([await count(f.users.lead), await count(f.users.anu)], [1, 0]);
  /* Meeskond näeb kirjet päevikus (see ei ole ainult hooldusjuhile). */
  const page = await openClient(anu, linda.id, deps());
  assert.equal(page.entries.items.find((item) => item.id === made.entry.id).incident.type, 'NEAR_MISS');
});

test('kuu lahtised asjad: tegemata käigud ainult teenusel oldud päevadel, lahtised erijuhtumid, märkamised ja märkimata ravim', async (t) => {
  const f = await fixture(t);
  const north = await db.organizationUnit.create({ data: { organizationId: f.orgA.id, name: `Põhi ${f.tag}`, type: 'TEAM' } });
  await db.organizationCapabilityGrant.create({
    data: { membershipId: f.members.cover.id, capability: 'HOME_CARE_COORDINATOR', scopeType: 'UNIT', scopeUnitId: north.id, validFrom: at('2026-01-01T00:00:00Z') }
  });
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const unitLead = await f.ctx(f.users.cover, f.orgA);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps(at('2026-09-01T08:00:00Z')))).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi', unitId: north.id }, deps(at('2026-09-01T08:00:00Z')))).client;
  for (const client of [linda, peeter]) await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  const early = deps(at('2026-09-01T08:00:00Z'));
  /* Linda: esmaspäeviti ja neljapäeviti kell 9; Peeter: kolmapäeviti kell 10. Muster algab 28.09. */
  await createSlots(lead, linda.id, { weekdays: [1, 4], startTime: '09:00', plannedMinutes: 30, workerMembershipId: f.members.anu.id, validFrom: '2026-09-28' }, early);
  await createSlots(lead, peeter.id, { weekdays: [3], startTime: '10:00', plannedMinutes: 30, workerMembershipId: f.members.anu.id, validFrom: '2026-09-28' }, early);
  const visit = (client, when) => createEntry(anu, client.id, { kind: 'NOTE', contactMode: 'VISIT', text: 'Käik', visitMinutes: 30, occurredAt: when }, deps(at(when)));
  const version = async (client) => (await db.careClient.findUnique({ where: { id: client.id }, select: { version: true } })).version;

  /* Oktoober kuni 09.10 (reede): Linda käigud 01.10 (N), 05.10 (E), 08.10 (N); Peetri käik 07.10 (K). */
  await visit(linda, '2026-10-01T06:30:00Z');
  /* 05.10 oli Linda haiglas (ära 04.10 kuni 06.10): see käik ei ole tegemata käik. */
  await setClientStatus(lead, linda.id, { version: await version(linda), status: 'AWAY', statusReason: 'HOSPITAL' }, deps(at('2026-10-04T08:00:00Z')));
  await setClientStatus(lead, linda.id, { version: await version(linda), status: 'ACTIVE' }, deps(at('2026-10-06T08:00:00Z')));
  /* 08.10 käik jäi kirja panemata; Peetri 07.10 käik jäeti ette ära. */
  const peeterSlot = (await getClientSlots(lead, peeter.id, deps())).slots[0];
  await cancelVisit(lead, peeter.id, peeterSlot.id, { day: '2026-10-07', reason: 'CLIENT_AWAY' }, deps(at('2026-10-06T08:00:00Z')));

  const open = await getMonthOpenItems(lead, { month: '2026-10' }, deps());
  assert.deepEqual(open.missing.map((item) => [item.client.displayName, item.day, item.startTime]), [['Linda Tamm', '2026-10-08', '09:00']]);
  assert.deepEqual([open.missingCount, open.openIncidents, open.openSignals, open.medicationUnmarked, open.clear], [1, 0, 0, 0, false]);

  /* Septembris algas muster 28.09 (esmaspäev): Linda 28.09 käik ja Peetri 30.09 käik on tegemata. */
  const september = await getMonthOpenItems(lead, { month: '2026-09' }, deps());
  assert.deepEqual(september.missing.map((item) => [item.client.displayName, item.day]), [['Linda Tamm', '2026-09-28'], ['Peeter Põhi', '2026-09-30']]);
  /* Üksuse hooldusjuht näeb ainult oma üksuse kliente; tuleviku kuu on tühi; hooldaja ei näe. */
  assert.deepEqual((await getMonthOpenItems(unitLead, { month: '2026-09' }, deps())).missing.map((item) => item.client.displayName), ['Peeter Põhi']);
  assert.deepEqual(await getMonthOpenItems(lead, { month: '2026-11' }, deps()), { month: '2026-11', missing: [], missingCount: 0, openIncidents: 0, openSignals: 0, medicationUnmarked: 0, clear: true });
  await expectError(getMonthOpenItems(anu, { month: '2026-10' }, deps()), 403, 'org.errors.missing_capability');

  /* LAHTISED ASJAD: erijuhtum (lahtine), märkamine (vastuseta), ravimitoiming ilma märketa. */
  await createEntry(anu, linda.id, { kind: 'INCIDENT', incidentType: 'FALL', text: 'Kukkus köögis', occurredAt: '2026-10-08T07:00:00Z' }, deps(at('2026-10-08T07:05:00Z')));
  await createEntry(anu, linda.id, { kind: 'NOTE', contactMode: 'VISIT', text: 'Ei saanud voodist üles', visitMinutes: 30, change: { answer: 'YES', areas: ['MOBILITY'], major: true }, occurredAt: '2026-10-08T06:00:00Z' }, deps(at('2026-10-08T06:05:00Z')));
  const pills = (await createActivity(lead, { group: 'MEDICATION', name: 'Hommikused ravimid' }, deps())).activity;
  await createEntry(anu, linda.id, { kind: 'NOTE', contactMode: 'VISIT', activities: [{ activityId: pills.id, mode: 'GUIDE' }], occurredAt: '2026-10-09T06:00:00Z' }, deps(at('2026-10-09T06:05:00Z')));
  const after = await getMonthOpenItems(lead, { month: '2026-10' }, deps());
  /* 08.10 käigu kirje on nüüd olemas (märkamisega käik), seega tegemata käike enam ei ole. */
  assert.deepEqual([after.missingCount, after.openIncidents, after.openSignals, after.medicationUnmarked, after.clear], [0, 1, 1, 1, false]);
});

test('lähedased ja jagamisaste: hooldusjuht muudab, meeskond loeb, ülevaatus poole aasta järel', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const clerk = await f.ctx(f.users.clerk, f.orgA);
  const leadB = await f.ctx(f.users.leadB, f.orgB);
  const linda = (await createClient(lead, { displayName: 'Linda Tamm' }, deps())).client;
  const peeter = (await createClient(lead, { displayName: 'Peeter Põhi' }, deps())).client;
  await addTeamMember(lead, linda.id, { membershipId: f.members.anu.id }, deps());

  assert.deepEqual((await openClient(anu, linda.id, deps())).relatives, []);
  /* Ainult hooldusjuht lisab; hooldaja, kõrvaline ja teine asutus mitte. */
  const mari = { name: 'Mari Tamm', relation: 'tütar', phone: '+372 5555 1234', level: 2, noTell: 'rahaasjad' };
  await expectError(saveRelative(anu, linda.id, mari, deps()), 403, 'org.errors.missing_capability');
  await expectError(saveRelative(clerk, linda.id, mari, deps()), 404, 'home_care.errors.client_not_found');
  await expectError(saveRelative(leadB, linda.id, mari, deps()), 404);
  await expectError(saveRelative(lead, linda.id, { name: 'Mari' }, deps()), 400, 'home_care.errors.relative_level_required');

  const old = deps(at('2026-03-01T08:00:00Z'));
  await saveRelative(lead, linda.id, mari, old);
  const two = await saveRelative(lead, linda.id, { name: 'Jaan Naaber', relation: 'naaber', level: 1 }, deps());
  assert.deepEqual(two.relatives.map((row) => [row.name, row.relation, row.phone, row.level, row.noTell, row.agreedOn, row.reviewDue]), [
    ['Mari Tamm', 'tütar', '+372 5555 1234', 2, 'rahaasjad', '2026-03-01', true],
    ['Jaan Naaber', 'naaber', null, 1, null, '2026-10-09', false]
  ]);
  /* Meeskond loeb sama loendit. */
  assert.deepEqual((await openClient(anu, linda.id, deps())).relatives.map((row) => [row.name, row.level]), [['Mari Tamm', 2], ['Jaan Naaber', 1]]);

  /* TÄHTAEGADE LEHT: üle poole aasta vana kokkulepe on nimekirjas. */
  const due = (await getDeadlines(lead, deps())).relativesDue;
  assert.deepEqual(due.map((item) => [item.client.displayName, item.name, item.relation, item.agreedOn, item.days]), [['Linda Tamm', 'Mari Tamm', 'tütar', '2026-03-01', 222]]);

  /* UUESTI KINNITAMINE: vana rida lõpeb, uus kannab tänast päeva ja uut astet; ajalugu jääb. */
  const mariRow = two.relatives[0];
  const confirmed = await saveRelative(lead, linda.id, { ...mari, level: 3, relativeId: mariRow.id }, deps(at('2026-10-09T08:05:00Z')));
  assert.deepEqual(confirmed.relatives.map((row) => [row.name, row.level, row.agreedOn, row.reviewDue]).sort(), [
    ['Jaan Naaber', 1, '2026-10-09', false],
    ['Mari Tamm', 3, '2026-10-09', false]
  ]);
  assert.deepEqual((await getDeadlines(lead, deps())).relativesDue, []);
  assert.deepEqual([await db.careClientRelative.count({ where: { clientId: linda.id } }), await db.careClientRelative.count({ where: { clientId: linda.id, endedAt: null } })], [3, 2]);
  /* Lõpetatud rida ei saa uuesti asendada; teise kliendi rida selle kliendi all ei leita. */
  await expectError(saveRelative(lead, linda.id, { ...mari, relativeId: mariRow.id }, deps()), 404, 'home_care.errors.relative_not_found');
  const jaan = confirmed.relatives.find((row) => row.name === 'Jaan Naaber');
  await expectError(endRelative(lead, peeter.id, jaan.id, deps()), 404, 'home_care.errors.relative_not_found');
  await expectError(endRelative(anu, linda.id, jaan.id, deps()), 403, 'org.errors.missing_capability');
  const after = await endRelative(lead, linda.id, jaan.id, deps());
  assert.deepEqual(after.relatives.map((row) => row.name), ['Mari Tamm']);

  /* ANDMEBAAS hoiab reeglid ka ilma teenuseta. */
  const raw = (data) => db.careClientRelative.create({ data: { organizationId: f.orgA.id, clientId: peeter.id, name: 'Keegi', level: 1, agreedOn: '2026-10-09', ...data } });
  await assert.rejects(raw({ level: 0 }), /CareClientRelative_level_check/);
  await assert.rejects(raw({ level: 4 }), /CareClientRelative_level_check/);
  await assert.rejects(raw({ name: '  ' }), /CareClientRelative_text_check/);
  await assert.rejects(raw({ agreedOn: '09.10.2026' }), /CareClientRelative_agreedOn_check/);

  /* AUDIT: ainult kliendi ID ja muutuse liik (lähedase nime ega telefoni seal ei ole). */
  const audit = await db.dataAuditLog.findMany({ where: { action: 'org.home_care_relative_changed', meta: { path: ['organizationId'], equals: f.orgA.id } } });
  assert.deepEqual(audit.map((entry) => entry.meta.change).sort(), ['added', 'added', 'changed', 'removed']);
  for (const entry of audit) assert.deepEqual(Object.keys(entry.meta).sort(), ['change', 'clientId', 'organizationId']);
  assert.equal(JSON.stringify(audit).includes('Mari'), false);
});

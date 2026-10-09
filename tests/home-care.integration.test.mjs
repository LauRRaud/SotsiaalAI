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
import { randomUUID } from 'node:crypto';
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
  setIncidentStatus
} from '../lib/homeCare/entries.js';
import { getCoordinatorOverview } from '../lib/homeCare/overview.js';

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

const deps = (now = NOW) => ({ db, now, env: ENV });

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
  const late = await createEntry(anu, client.id, { text: 'Eile õhtul kukkus peaaegu', occurredAt: '2026-10-08T17:00:00Z' }, deps());
  assert.equal(late.entry.writtenLater, true);
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
  await expectError(correctEntry(bert, client.id, concern.entry.id, { text: 'x', kind: 'CONCERN', reason: 'proov' }, deps()), 404, 'home_care.errors.entry_not_found');
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
  await expectError(correctEntry(bert, client.id, entry.id, { text: 'Uus', reason: 'Tahan' }, deps()), 403, 'home_care.errors.entry_not_editable');
  /* Teise kliendi all sama kirje ID: 404. */
  await expectError(correctEntry(lead, other.id, entry.id, { text: 'Uus', reason: 'Vale klient' }, deps()), 404, 'home_care.errors.entry_not_found');

  const corrected = await correctEntry(anu, client.id, entry.id, { text: 'Tuletasin ravimeid meelde, võttis ise', reason: 'Kirjutasin valesti: ei andnud, vaid tuletasin meelde' }, deps(at('2026-10-09T09:00:00Z')));
  assert.equal(corrected.entry.revision, 2);
  assert.equal(corrected.entry.corrected, true);
  assert.equal(corrected.entry.text, 'Tuletasin ravimeid meelde, võttis ise');

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
  const retracted = await retractEntry(lead, client.id, entry.id, { reason: 'Kirje läks vale kliendi alla' }, deps(at('2026-10-09T10:00:00Z')));
  assert.equal(retracted.entry.text, null);
  assert.equal(retracted.entry.revision, 3);
  assert.ok(retracted.entry.retractedAt);
  await expectError(retractEntry(lead, client.id, entry.id, { reason: 'Uuesti' }, deps()), 409, 'home_care.errors.entry_retracted');
  await expectError(correctEntry(anu, client.id, entry.id, { text: 'Uus', reason: 'Hilja' }, deps()), 409, 'home_care.errors.entry_retracted');
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
  await expectError(correctEntry(anu, client.id, fall.entry.id, { kind: 'NOTE', text: 'Polnud midagi', reason: 'Proov' }, deps()), 400, 'home_care.errors.incident_kind_fixed');

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

  const away = await setClientStatus(lead, client.id, { version: 2, status: 'AWAY', statusNote: 'Haiglas alates 9.10' }, deps());
  assert.equal(away.client.status, 'AWAY');
  assert.equal(away.client.version, 3);
  const ended = await setClientStatus(lead, client.id, { version: 3, status: 'ENDED' }, deps());
  assert.equal(ended.client.status, 'ENDED');
  /* Lõpetatud klient ei ole vaikimisi loendis ega otsingus, aga leht avaneb. */
  assert.deepEqual((await listClients(anu, {}, deps())).clients, []);
  assert.equal((await listClients(lead, { status: 'ENDED' }, deps())).clients.length, 1);
  assert.equal((await openClient(anu, client.id, deps())).client.status, 'ENDED');
});

test('lõpetatud teenus: päevikusse kirjutab ainult hooldusjuht', async (t) => {
  const f = await fixture(t);
  const lead = await f.ctx(f.users.lead, f.orgA);
  const anu = await f.ctx(f.users.anu, f.orgA);
  const { client } = await createClient(lead, { displayName: 'Maie Kask' }, deps());
  await addTeamMember(lead, client.id, { membershipId: f.members.anu.id }, deps());
  const last = { text: 'Viimane käik.', occurredAt: '2026-10-09T07:30:00Z', clientRequestId: `end-${f.tag}-1` };
  const first = await createEntry(anu, client.id, last, deps());
  await setClientStatus(lead, client.id, { version: 1, status: 'ENDED' }, deps());

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
    'home_care.errors.client_ended'
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

/**
 * T25 ORG-FUNDING-INBOX-V1 — organisatsiooni vastuvõtulaud ja töö määramine (E7).
 *
 * NÄHTAVUSE AHEL (arenduskava §5.7) on selle faili kandev reegel:
 *
 *   pöörduja saadab KINNITATUD paketi
 *     → koordinaator näeb TÄPSELT seda paketti, mitte Teekonda ega vestlust
 *       → määratud töötaja saab TÄPSELT sama ulatuse, mitte rohkem
 *         → üleandmine EI LAIENDA ulatust
 *
 * Postkastikirje ei dubleeri lähteobjekti sisu — ta kannab viidet ja seisu.
 * Sisu loetakse alati lähteobjektist läbi `projectSourcePackage`, mis on
 * VALGE NIMEKIRI. Musta nimekirja unustatakse täiendada ja siis lekib esimene
 * uus väli.
 *
 * MIDA SIIN EI OLE: AI triaaži, prioriteediarvutust, riskiskoori ega
 * automaatset määramist (arenduskava §13). Kiireloomulisuse märge on SAATJA
 * oma tekst, mida süsteem edastab muutmata kujul.
 */

import prisma from "@/lib/prisma";

import { NOTIFICATION_EVENT_TYPES, createNotificationEvent } from "@/lib/notifications";

import {
  LIVE_WORK_ASSIGNMENT_STATUSES,
  OrganizationCapability,
  OrganizationInboxSourceType,
  OrganizationInboxStatus,
  OrganizationMembershipStatus,
  OrganizationWorkAssignmentStatus,
  canTransitionInboxStatus,
  isTerminalInboxStatus
} from "./constants.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";
import { hasCapability } from "./accessContext.js";
import { unitScopeCovers } from "./units.js";

/**
 * VALGE NIMEKIRI sellest, mida vastuvõtja eelpöördumisest näeb.
 *
 * Need on täpselt samad väljad, mida näeb tänane ISIKLIK vastuvõtja
 * (`serializePreInquiry`, `isRecipient` haru) — organisatsiooni postkast ei
 * anna rohkem. `sourceJourneyId` on TEADLIKULT välja jäetud: pöörduja Teekond
 * ei kuulu organisatsioonile ja „jaga kogu Teekond" nuppu ei ole olemas.
 */
export function projectSourcePackage(inquiry) {
  if (!inquiry) return null;

  /* TAGASIVÕETUD PAKETT EI OLE ENAM SISU, VAID AJALUGU (SOL-PRE-02).
     Tagasivõtmine on pöörduja õigus ja ta on lubadus: „see, mida ma saatsin,
     ei ole enam teie käes". Kui projektsioon kannaks pärast tagasivõtmist
     edasi teemat, olukorda ja mustandit, oleks lubadus pelk UI-silt.

     Värav on SIIN, mitte kutsujas: see funktsioon on ainus uks sisu juurde ja
     iga tulevane kutsuja pärib värava tasuta. Kutsujas oleks ta kordus, mille
     seitsmes kutsuja unustab. */
  if (inquiry.recalledAt) return null;

  return {
    id: inquiry.id,
    topic: inquiry.topic || null,
    situation: inquiry.situation || null,
    generatedDraft: inquiry.generatedDraft || null,
    userEditedDraft: inquiry.userEditedDraft || null,
    assessmentState: inquiry.assessmentState || null,
    status: inquiry.status,
    sentAt: inquiry.sentAt,
    openedAt: inquiry.openedAt,
    recalledAt: inquiry.recalledAt,
    receiverNote: inquiry.receiverNote || "",
    nextContactOn: inquiry.nextContactOn || null
  };
}

/**
 * TEHINGU OMANDUS ON SELGESÕNALINE, mitte tuletatud.
 *
 * Varem oli siin `runInTransaction`, mis nuuskis `typeof db.$transaction ===
 * "function"` ja otsustas selle põhjal, kas avada tehing. See oli VALE:
 * Prisma interaktiivsel tehingukliendil ON `$transaction` olemas (mõõdetud),
 * seega heuristika avas PESASTATUD tehingu just seal, kus ta pidi jooksma
 * juba avatud tehingu sees. Viga oli vaikne — kirje tekkis, aga mitte kutsuja
 * tehingus, ja rollback ei oleks teda tagasi keeranud.
 *
 * Reegel nüüd: `…Within(tx, …)` teeb töö ANTUD kliendis ega ava kunagi
 * tehingut. Avalik `…(input, { db })` avab tehingu ise. Kutsuja ütleb, kumba
 * ta tahab — süsteem ei arva.
 */

/**
 * Kaks teavitust, kaks eri saajat, kaks eri põhjust (arenduskava §5.7).
 *
 *   TÖÖTAJALE — „sulle määrati töö". Ilma selleta ei tea määratud inimene
 *   oma ülesandest enne, kui ta ise postkasti avab.
 *
 *   AUTORILE — „sinu pöördumisega tegeleb nüüd keegi teine". §5.7 nõuab, et
 *   „töö üleandmisel saab autor NEUTRAALSE teavituse uue vastutaja kohta".
 *   Neutraalne tähendab: ei uue vastutaja nime, ei üksust, ei põhjust — ainult
 *   see, et vastutaja muutus. Kasutame olemasolevat
 *   `PRE_INQUIRY_STATUS_CHANGED` tüüpi, mille adressaadikontroll on JUBA
 *   `authorId === userId` ja mille silt on niigi neutraalne. Uus tüüp tähendaks
 *   uut adressaadireeglit, mida keegi peaks eraldi auditeerima.
 *
 * Mõlemad on parim-pingutus: teavituse tõrge EI TOHI keerata tagasi töö
 * määramist. Seepärast kutsutakse neid PÄRAST tehingut ja vaikitakse vea korral
 * (viga läheb logisse, mitte kasutajale).
 */
/**
 * REA LUKK ENNE LUGEMIST, mitte pärast (SOL-PRE-02).
 *
 * Tagasivõtmine ja töö määramine on kaks kirjutajat sama postkastikirje peal.
 * Ilma lukuta on tulemus TOCTOU: määraja LOEB seisu enne tagasivõtmist ja
 * KIRJUTAB pärast seda, seega elav töö jääb pöördumisele, mida enam ei ole.
 * Seisukontroll üksi seda ei püüa — ta mõõdab hetke, mis on möödas enne, kui
 * ta jõuab midagi otsustada.
 *
 * `FOR UPDATE` enne lugemist serialiseerib nad: teine ootab esimese commit'i
 * ära ja loeb siis ALATI värske seisu (READ COMMITTED hindab rea luku
 * vabanemisel uuesti). LUKUJÄRJEKORD ON KÕIGIL RADADEL SAMA — kõigepealt
 * postkastikirje rida, alles siis määramised. Vastupidises järjekorras lukustaja
 * tekitaks ummikseisu.
 *
 * Fake-klient ühiktestis ei paku `$queryRaw`-d. See ei ole viga, mida vaikida:
 * lukk ON päris andmebaasi omadus ja tema puudumisel jääb alles kogu ülejäänud
 * kontroll. Seepärast `typeof`-värav, mitte `try/catch` — päris viga peab
 * jõudma kutsujani.
 */
async function lockInboxItemRow(tx, inboxItemId) {
  if (typeof tx.$queryRaw !== "function") return;
  await tx.$queryRaw`SELECT "id" FROM "OrganizationInboxItem" WHERE "id" = ${inboxItemId} FOR UPDATE`;
}

async function notifyAssignee({ db, inboxItemId, membershipId, organizationId, dedupeSuffix }) {
  try {
    const membership = await db.organizationMembership.findUnique({
      where: { id: membershipId },
      select: { userId: true, status: true }
    });
    if (!membership?.userId || membership.status !== OrganizationMembershipStatus.ACTIVE) return;
    await createNotificationEvent(
      {
        type: NOTIFICATION_EVENT_TYPES.ORG_WORK_ASSIGNED,
        userId: membership.userId,
        sourceId: inboxItemId,
        targetId: inboxItemId,
        dedupeSuffix,
        workspaceKind: "org_space",
        workspaceId: organizationId,
        emailPolicy: "OPTIONAL"
      },
      { db }
    );
  } catch (error) {
    console.error("[org-inbox] assignee notification failed", error?.message || error);
  }
}

async function notifyAuthorOfResponsibleChange({ db, sourceId, organizationId, dedupeSuffix }) {
  try {
    const inquiry = await db.preInquiry.findUnique({
      where: { id: sourceId },
      select: { authorId: true, recalledAt: true }
    });
    if (!inquiry?.authorId || inquiry.recalledAt) return;
    await createNotificationEvent(
      {
        type: NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_STATUS_CHANGED,
        userId: inquiry.authorId,
        sourceId,
        targetId: sourceId,
        dedupeSuffix,
        workspaceKind: "org_space",
        workspaceId: organizationId,
        emailPolicy: "OPTIONAL"
      },
      { db }
    );
  } catch (error) {
    console.error("[org-inbox] author notification failed", error?.message || error);
  }
}

const SOURCE_SELECT = Object.freeze({
  id: true,
  topic: true,
  situation: true,
  generatedDraft: true,
  userEditedDraft: true,
  assessmentState: true,
  status: true,
  sentAt: true,
  openedAt: true,
  recalledAt: true,
  receiverNote: true,
  nextContactOn: true,
  authorId: true
});

/**
 * Loob postkastikirje saadetud eelpöördumisest. Idempotentne:
 * `@@unique([organizationId, sourceType, sourceId])` tähendab, et sama
 * eelpöördumise korduv saatmine ei tekita teist kirjet.
 */
/** Teeb kohaletoimetamise ANTUD kliendis. Ei ava tehingut. */
export async function deliverPreInquiryToOrganizationWithin(
  tx,
  { preInquiryId, organizationId, unitId = null, urgencyDeclaredBySender = null },
  { now = new Date() } = {}
) {
  return (async () => {
    const inquiry = await tx.preInquiry.findUnique({
      where: { id: preInquiryId },
      select: { id: true, status: true, recipientOrganizationId: true, authorId: true }
    });
    if (!inquiry) throw notFound("org.errors.inbox_source_not_found");
    if (inquiry.recipientOrganizationId !== organizationId) {
      throw conflict("org.errors.inbox_source_mismatch");
    }

    const where = {
      organizationId,
      sourceType: OrganizationInboxSourceType.PRE_INQUIRY,
      sourceId: preInquiryId
    };

    /* IDEMPOTENTSUS ON KIRJUTAMISE TULEMUS, mitte eelnev `findFirst`.
       `findFirst → create` on võistlusaken: kaks samaaegset kohaletoimetamist
       (kordussaatmine või kaks serveriprotsessi) näeksid mõlemad tühjust ja
       mõlemad kirjutaksid.

       MIKS MITTE `create` + `catch (P2002)`: PostgreSQL keerab piirangu
       rikkumisel KOGU tehingu katki (`25P02 current_transaction_is_aborted`).
       Seega `catch`-i sees enam samast `tx`-ist pärida EI SAA — see „taasta
       võitja rida" haru viskaks päris baasil hoopis teise vea ja
       kohaletoimetamine kukuks just seal, kus ta pidi paranema. Ühiktest ei
       näita seda, sest fake-klient ei modelleeri katkist tehingut.

       `createMany({ skipDuplicates: true })` = `INSERT … ON CONFLICT DO
       NOTHING`: kokkupõrge EI ole erind, tehing jääb terveks ja `count` ütleb
       ausalt, kumb kirjutaja võitis. Auditikirje tekib ainult võitjal — kaotaja
       ei tohi tekitada teist „vastu võetud" sündmust samale pöördumisele. */
    const { count } = await tx.organizationInboxItem.createMany({
      data: [
        {
          ...where,
          unitId,
          status: OrganizationInboxStatus.RECEIVED,
          receivedAt: now,
          lastTransitionAt: now,
          urgencyDeclaredBySender: urgencyDeclaredBySender
            ? String(urgencyDeclaredBySender).slice(0, 200)
            : null
        }
      ],
      skipDuplicates: true
    });

    const item = await tx.organizationInboxItem.findFirst({ where, select: { id: true } });
    if (!item) throw conflict("org.errors.inbox_delivery_failed");

    /* Kaotaja (või kordussaatja) tagastab võitja rea ja lõpetab siin: sama
       pöördumine on organisatsiooni laual TÄPSELT ÜKS kord. */
    if (count === 0) return item;

    await writeOrgAudit(tx, {
      actorUserId: null,
      action: OrgAuditAction.INBOX_ITEM_RECEIVED,
      resourceType: OrgAuditResource.INBOX_ITEM,
      resourceId: item.id,
      meta: { organizationId, inboxItemId: item.id, sourceType: OrganizationInboxSourceType.PRE_INQUIRY }
    });

    return item;
  })();
}

/** Avab ise tehingu. Kutsu seda ainult väljaspool olemasolevat tehingut. */
export async function deliverPreInquiryToOrganization(input, { db = prisma, now = new Date() } = {}) {
  return db.$transaction((tx) => deliverPreInquiryToOrganizationWithin(tx, input, { now }));
}

/**
 * LEPITUS: leia `SENT` org-adressaadiga pöördumised, millel puudub
 * postkastikirje.
 *
 * Kohaletoimetamine on nüüd salvestusega samas tehingus, seega see loend PEAB
 * olema tühi. Funktsioon on olemas kahel põhjusel:
 *   1. ta on TÕEND — kontroll saab teda käivitada ja näha nulli;
 *   2. ta on võrk enne atomaarsust loodud ridade jaoks ja iga tulevase
 *      kohaletoimetamise raja jaoks, mis tehinguväliselt lisandub.
 *
 * Ta ei ole outbox: outbox eeldab, et kadu on lubatud ja hiljem järele
 * jõutakse. Siin kadu EI OLE lubatud — see funktsioon peab tagastama tühja
 * loendi ja kui ta seda ei tee, on midagi katki.
 */
export async function findUndeliveredOrganizationInquiries({ db = prisma, take = 200 } = {}) {
  const rows = await db.preInquiry.findMany({
    where: {
      status: "SENT",
      recipientOrganizationId: { not: null },
      recalledAt: null
    },
    select: { id: true, recipientOrganizationId: true, sentAt: true },
    take: Math.min(Math.max(Number(take) || 200, 1), 500)
  });
  if (!rows.length) return [];

  const delivered = await db.organizationInboxItem.findMany({
    where: {
      sourceType: OrganizationInboxSourceType.PRE_INQUIRY,
      sourceId: { in: rows.map((row) => row.id) }
    },
    select: { sourceId: true }
  });
  const deliveredIds = new Set(delivered.map((row) => row.sourceId));
  return rows.filter((row) => !deliveredIds.has(row.id));
}

/** Toimetab kohale kõik ptk-s eespool leitud ripakil pöördumised. */
export async function reconcileOrganizationDeliveries({ db = prisma, now = new Date() } = {}) {
  const pending = await findUndeliveredOrganizationInquiries({ db });
  const repaired = [];
  for (const row of pending) {
    const item = await deliverPreInquiryToOrganization(
      { preInquiryId: row.id, organizationId: row.recipientOrganizationId },
      { db, now }
    );
    repaired.push({ preInquiryId: row.id, inboxItemId: item?.id || null });
  }
  return repaired;
}

/**
 * Saatja tagasivõtmine. Kutsutakse eelpöördumise recall-rajalt.
 * Sulgeb ka elavad määramised — töö, mida enam ei ole, ei tohi jääda kellegi
 * ülesandeks.
 */
/** Teeb tagasivõtmise ANTUD kliendis. Ei ava tehingut. */
export async function recallInboxItemForSourceWithin(
  tx,
  { sourceId, sourceType = OrganizationInboxSourceType.PRE_INQUIRY },
  { now = new Date() } = {}
) {
  return (async () => {
    const found = await tx.organizationInboxItem.findFirst({
      where: { sourceType, sourceId },
      select: { id: true }
    });
    if (!found) return null;

    /* Lukk ENNE seisu lugemist ja enne määramiste sulgemist. Vana järjekord
       (loe seis → sulge määramised → kirjuta seis) jättis akna, kus samaaegne
       `assignWork` jõudis oma määramise sisse kirjutada PÄRAST seda, kui
       tagasivõtmine oli elavad määramised juba üle vaadanud. */
    await lockInboxItemRow(tx, found.id);

    const item = await tx.organizationInboxItem.findUnique({
      where: { id: found.id },
      select: { id: true, organizationId: true, status: true }
    });
    if (!item) return null;
    if (item.status === OrganizationInboxStatus.RECALLED) return item;

    await tx.organizationWorkAssignment.updateMany({
      where: { inboxItemId: item.id, status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
      data: { status: OrganizationWorkAssignmentStatus.ENDED, endedAt: now }
    });

    /* Kiireloomulisuse märge on SAATJA OMA TEKST, mis elab organisatsiooni
       tabelis koopiana. Tagasivõtmine võtab tagasi ka selle koopia — muidu
       jääks pöörduja kirjutatud lause lauale alles ka siis, kui pakett ise on
       kadunud. Auditisse jääb siire, mitte sõnad. */
    const updated = await tx.organizationInboxItem.update({
      where: { id: item.id },
      data: {
        status: OrganizationInboxStatus.RECALLED,
        lastTransitionAt: now,
        urgencyDeclaredBySender: null
      }
    });

    await writeOrgAudit(tx, {
      actorUserId: null,
      action: OrgAuditAction.INBOX_ITEM_TRANSITIONED,
      resourceType: OrgAuditResource.INBOX_ITEM,
      resourceId: item.id,
      meta: {
        organizationId: item.organizationId,
        inboxItemId: item.id,
        fromInboxStatus: item.status,
        toInboxStatus: OrganizationInboxStatus.RECALLED
      }
    });

    return updated;
  })();
}

/** Avab ise tehingu. Kutsu seda ainult väljaspool olemasolevat tehingut. */
export async function recallInboxItemForSource(input, { db = prisma, now = new Date() } = {}) {
  return db.$transaction((tx) => recallInboxItemForSourceWithin(tx, input, { now }));
}

/**
 * Milliseid postkasti kirjeid see kontekst näeb?
 *
 * KOLM TASET:
 *   - `INBOX_COORDINATOR` org-skoobis → kogu postkast;
 *   - `INBOX_COORDINATOR` üksuse skoobis → ainult selle üksuse alampuu;
 *   - tavaline liige → MITTE MIDAGI, isegi mitte kirjete arvu.
 * Lisaks näeb iga liige talle MÄÄRATUD tööd, ka ilma koordinaatori õiguseta.
 */
function inboxScopeFilter(context) {
  const organizationId = context.organization.id;
  const grants = context.capabilities.filter(
    (grant) => grant.capability === OrganizationCapability.INBOX_COORDINATOR
  );

  const orgWide = grants.some((grant) => grant.scopeType === "ORGANIZATION");
  if (orgWide) return { organizationId };

  const unitIds = new Set();
  for (const grant of grants) {
    if (!grant.scopeUnitId) continue;
    for (const unit of context._unitTree || []) {
      if (unitScopeCovers(grant.scopeUnitId, unit.id, context._unitTree || [])) unitIds.add(unit.id);
    }
  }

  const membershipId = context.membership?.id;
  const assignedClause = membershipId
    ? [{ assignments: { some: { assigneeMembershipId: membershipId, status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } } } }]
    : [];

  if (!unitIds.size && !assignedClause.length) return null;

  return {
    organizationId,
    OR: [...(unitIds.size ? [{ unitId: { in: [...unitIds] } }] : []), ...assignedClause]
  };
}

export async function listInboxItems(context, { db = prisma, includeClosed = false, take = 100 } = {}) {
  const where = inboxScopeFilter(context);
  // Tavaline liige ei näe ühist postkasti — tühi loend, mitte 403.
  // Vastasel korral paljastaks veakood postkasti olemasolu.
  if (!where) return [];

  const rows = await db.organizationInboxItem.findMany({
    where: {
      ...where,
      ...(includeClosed
        ? {}
        : { status: { notIn: [OrganizationInboxStatus.CLOSED, OrganizationInboxStatus.RECALLED] } })
    },
    select: {
      id: true,
      status: true,
      sourceType: true,
      sourceId: true,
      receivedAt: true,
      lastTransitionAt: true,
      dueAt: true,
      urgencyDeclaredBySender: true,
      unit: { select: { id: true, name: true } },
      assignments: {
        where: { status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
        select: {
          id: true,
          status: true,
          assignedAt: true,
          acceptedAt: true,
          assigneeMembershipId: true,
          assignee: {
            select: {
              id: true,
              jobTitle: true,
              user: { select: { profile: { select: { firstName: true, lastName: true } } } }
            }
          }
        }
      }
    },
    orderBy: [{ receivedAt: "desc" }],
    take: Math.min(Math.max(Number(take) || 100, 1), 200)
  });

  /* Loend EI kanna lähteobjekti sisu — ainult seisu ja vastutajat. Sisu
     avaneb ühe kirje avamisel, mis on eraldi teadlik samm ja eraldi audit. */
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    sourceType: row.sourceType,
    receivedAt: row.receivedAt,
    lastTransitionAt: row.lastTransitionAt,
    dueAt: row.dueAt,
    /* Tagasivõetud real ei ole saatja teksti ka siis, kui `includeClosed=1`
       ta ajalukku toob. Uued read on tühjaks kirjutatud juba tagasivõtmisel;
       see rida katab need, mis võeti tagasi ENNE seda parandust. */
    urgencyDeclaredBySender:
      row.status === OrganizationInboxStatus.RECALLED ? null : row.urgencyDeclaredBySender,
    unit: row.unit ? { id: row.unit.id, name: row.unit.name } : null,
    assignment: row.assignments[0]
      ? {
          id: row.assignments[0].id,
          status: row.assignments[0].status,
          assignedAt: row.assignments[0].assignedAt,
          acceptedAt: row.assignments[0].acceptedAt,
          membershipId: row.assignments[0].assigneeMembershipId,
          jobTitle: row.assignments[0].assignee?.jobTitle || null,
          firstName: row.assignments[0].assignee?.user?.profile?.firstName || null,
          lastName: row.assignments[0].assignee?.user?.profile?.lastName || null
        }
      : null
  }));
}

/**
 * Kas see kontekst tohib SEDA kirjet avada? Koordinaator oma skoobis või
 * kirjele määratud töötaja. Kõik muu on 404 — mitte 403, sest võõra üksuse
 * kirje olemasolu ei tohi lekkida.
 */
async function requireVisibleInboxItem(tx, context, inboxItemId, { lock = false } = {}) {
  /* Kirjutavad rajad lukustavad rea ENNE lugemist — vt `lockInboxItemRow`.
     Lugev rada (`getInboxItem`) seda ei tee: ta ei otsusta midagi, mida saaks
     võistlusega tühjaks teha, ja tarbetu lukk pidurdaks laua avamist. */
  if (lock) await lockInboxItemRow(tx, inboxItemId);

  const item = await tx.organizationInboxItem.findFirst({
    where: { id: inboxItemId, organizationId: context.organization.id },
    select: {
      id: true,
      organizationId: true,
      unitId: true,
      status: true,
      sourceType: true,
      sourceId: true,
      receivedAt: true,
      urgencyDeclaredBySender: true,
      assignments: {
        where: { status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
        select: { id: true, assigneeMembershipId: true, status: true }
      }
    }
  });
  if (!item) throw notFound("org.errors.inbox_item_not_found");

  const isCoordinator = hasCapability(context, OrganizationCapability.INBOX_COORDINATOR, {
    unitId: item.unitId
  });
  const isAssignee = item.assignments.some(
    (assignment) => assignment.assigneeMembershipId === context.membership?.id
  );
  if (!isCoordinator && !isAssignee) throw notFound("org.errors.inbox_item_not_found");

  return { item, isCoordinator, isAssignee };
}

/** Avab kirje koos saatja kinnitatud paketiga. */
export async function getInboxItem(context, inboxItemId, { db = prisma } = {}) {
  return db.$transaction(async (tx) => {
    const { item, isCoordinator, isAssignee } = await requireVisibleInboxItem(tx, context, inboxItemId);

    const inquiry = await tx.preInquiry.findUnique({
      where: { id: item.sourceId },
      select: SOURCE_SELECT
    });

    /* AVAMISE AJATEMPEL on pöörduja õiguste alus, mitte statistika:
       tagasivõtmine on lubatud ainult ENNE avamist (arenduskava §5.7). Kui me
       seda siin ei märgiks, saaks organisatsioon paketti lugeda ja pöörduja
       võiks selle pärast lugemist „tagasi võtta" — tagasivõtmine muutuks
       lubaduseks, mida süsteem ei suuda pidada.

       KIRJUTUS ON KOHTUNIK, mitte eelnev lugemine (SOL-PRE-02). Ülemine
       `findUnique` võib olla vananenud: samaaegne tagasivõtmine commit'ib
       lugemise ja otsuse vahel ning mälus loetud `recalledAt: null` oleks siis
       vale alus, mille peal me näitaksime sisu, mida enam ei ole. `updateMany`
       tingimusega `openedAt: null, recalledAt: null` on korraga kolm asja:
         - idempotentne (teine avaja ei nihuta esimese ajatemplit),
         - VÕISTLUSVÄRAV (tingimust hinnatakse andmebaasis, rea luku all),
         - ja TÕENDIALLIKAS — kui ta ei kirjutanud, ei ole meil õigust sisule
           enne, kui oleme värskelt üle lugenud, MIKS ta ei kirjutanud.
       Ainus haru, mis lugemist vahele jätab, on juba avatud pöördumine — teda
       ei saa enam tagasi võtta, seega vananenud lugemine ei ole seal võimalik. */
    let recalled = item.status === OrganizationInboxStatus.RECALLED;

    if (inquiry && !inquiry.openedAt && !recalled) {
      const openedAt = new Date();
      const marked = await tx.preInquiry.updateMany({
        where: { id: item.sourceId, openedAt: null, recalledAt: null },
        data: { openedAt }
      });
      if (marked.count === 1) {
        inquiry.openedAt = openedAt;
      } else {
        const fresh = await tx.preInquiry.findUnique({
          where: { id: item.sourceId },
          select: { openedAt: true, recalledAt: true }
        });
        inquiry.openedAt = fresh?.openedAt || null;
        inquiry.recalledAt = fresh?.recalledAt || null;
      }
    }
    recalled = recalled || Boolean(inquiry?.recalledAt);

    const live = item.assignments[0] || null;

    return {
      id: item.id,
      status: item.status,
      unitId: item.unitId,
      receivedAt: item.receivedAt,
      urgencyDeclaredBySender: recalled ? null : item.urgencyDeclaredBySender,
      isCoordinator,
      isAssignee,
      /* SISUTA AJALOOMARKER, mitte 404. Kirje ise jääb laual nähtavaks (loend
         näitab teda `includeClosed=1` all), seega detaili 404 oleks vastuolu:
         koordinaator näeks nimekirjas rida, mida avada ei saa. Marker ütleb
         AUSALT, miks sisu ei ole — see on ajalugu, mitte tõrge. */
      sourceWithheldReason: recalled ? OrganizationInboxStatus.RECALLED : null,
      recalledAt: inquiry?.recalledAt || null,
      /* Vastutaja on SEIS, mitte sisu — siin on ainult määramise ID, seis ja
         liikmesuse viide. Vastutaja nimi tuleb liikmete loendist, mille näeb
         niikuinii ainult see, kellel on selleks õigus. */
      assignment: live
        ? { id: live.id, status: live.status, membershipId: live.assigneeMembershipId }
        : null,
      /* Määratud töötaja saab TÄPSELT sama projektsiooni mis koordinaator —
         ei rohkem (uus sisu) ega vähem (poolik pakett). */
      source: projectSourcePackage(inquiry)
    };
  });
}

/** Postkasti seisusiire. Ainult koordinaator, ainult lubatud siirded. */
export async function transitionInboxItem(
  context,
  inboxItemId,
  { toStatus, reason },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const { item, isCoordinator } = await requireVisibleInboxItem(tx, context, inboxItemId, {
      lock: true
    });
    if (!isCoordinator) throw notFound("org.errors.inbox_item_not_found");

    if (toStatus === OrganizationInboxStatus.RECALLED) {
      // Tagasivõtmine on SAATJA õigus. Organisatsioon ei saa seda ise valida.
      throw badRequest("org.errors.inbox_recall_is_sender_right");
    }
    /* Terminalseis nimetab end ise. `canTransitionInboxStatus` ütleks ka „ei",
       aga sõnumiga „vale siire" — see saadaks koordinaatori otsima, MILLINE
       siire oleks õige. Vastus on: mitte ükski. */
    if (isTerminalInboxStatus(item.status)) {
      throw conflict("org.errors.inbox_item_terminal", { status: item.status });
    }
    if (!canTransitionInboxStatus(item.status, toStatus)) {
      throw conflict("org.errors.invalid_inbox_transition", { fromStatus: item.status, toStatus });
    }

    const closing =
      toStatus === OrganizationInboxStatus.CLOSED || toStatus === OrganizationInboxStatus.REJECTED;

    const updated = await tx.organizationInboxItem.update({
      where: { id: inboxItemId },
      data: {
        status: toStatus,
        lastTransitionAt: now,
        closedAt: closing ? now : null,
        closedReason: closing && reason ? String(reason).slice(0, 500) : null
      }
    });

    if (closing) {
      await tx.organizationWorkAssignment.updateMany({
        where: { inboxItemId, status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
        data: { status: OrganizationWorkAssignmentStatus.ENDED, endedAt: now }
      });
    }

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.INBOX_ITEM_TRANSITIONED,
      resourceType: OrgAuditResource.INBOX_ITEM,
      resourceId: inboxItemId,
      meta: {
        organizationId: item.organizationId,
        inboxItemId,
        fromInboxStatus: item.status,
        toInboxStatus: toStatus
      }
    });

    return updated;
  });
}

/**
 * Määrab töö. Nõuab `WORK_ASSIGNER` õigust kirje üksuse skoobis.
 *
 * Topeltmääramise võistlus on kaetud osalise unikaalindeksiga
 * `(inboxItemId) WHERE status IN ('PENDING','ACCEPTED')` — kaks samaaegset
 * määramist ei saa mõlemad õnnestuda ka siis, kui mõlemad nägid tühja kohta.
 */
export async function assignWork(
  context,
  inboxItemId,
  { assigneeMembershipId },
  { db = prisma, now = new Date() } = {}
) {
  const assignment = await db.$transaction(async (tx) => {
    const { item } = await requireVisibleInboxItem(tx, context, inboxItemId, { lock: true });
    if (!hasCapability(context, OrganizationCapability.WORK_ASSIGNER, { unitId: item.unitId })) {
      throw notFound("org.errors.inbox_item_not_found");
    }
    /* TERMINALSEISUS TÖÖD EI OLE (SOL-PRE-02). Varem sõltus see kaudselt
       `canTransitionInboxStatus`-ist allpool — aga see kontroll juhib ainult
       seisu UUENDAMIST: kui siire ei olnud lubatud, jäi seis muutmata ja
       määramine tekkis ikkagi. Tagasivõetud pöördumine sai nii uue vastutaja,
       ilma et laual oleks midagi muutunud. */
    if (isTerminalInboxStatus(item.status)) {
      throw conflict("org.errors.inbox_item_terminal", { status: item.status });
    }
    if (item.assignments.length) throw conflict("org.errors.work_already_assigned");

    const assignee = await tx.organizationMembership.findFirst({
      where: {
        id: assigneeMembershipId,
        organizationId: context.organization.id,
        status: OrganizationMembershipStatus.ACTIVE
      },
      select: { id: true, userId: true }
    });
    if (!assignee) throw notFound("org.errors.membership_not_found");

    const assignment = await tx.organizationWorkAssignment.create({
      data: {
        inboxItemId,
        assigneeMembershipId,
        status: OrganizationWorkAssignmentStatus.PENDING,
        assignedByUserId: context.userId,
        assignedAt: now
      }
    });

    if (canTransitionInboxStatus(item.status, OrganizationInboxStatus.ASSIGNED)) {
      await tx.organizationInboxItem.update({
        where: { id: inboxItemId },
        data: { status: OrganizationInboxStatus.ASSIGNED, lastTransitionAt: now }
      });
    }

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      targetUserId: assignee.userId,
      action: OrgAuditAction.WORK_ASSIGNED,
      resourceType: OrgAuditResource.WORK_ASSIGNMENT,
      resourceId: assignment.id,
      meta: { organizationId: item.organizationId, inboxItemId, membershipId: assigneeMembershipId }
    });

    return { ...assignment, _organizationId: item.organizationId, _sourceId: item.sourceId };
  });

  await notifyAssignee({
    db,
    inboxItemId,
    membershipId: assigneeMembershipId,
    organizationId: assignment._organizationId,
    dedupeSuffix: assignment.id
  });

  const { _organizationId, _sourceId, ...clean } = assignment;
  return clean;
}

/** Määratud töötaja võtab töö vastu või lükkab tagasi. Ainult tema ise. */
export async function respondToAssignment(
  context,
  assignmentId,
  { accept, reason },
  { db = prisma, now = new Date() } = {}
) {
  return db.$transaction(async (tx) => {
    const assignment = await tx.organizationWorkAssignment.findFirst({
      where: {
        id: assignmentId,
        inboxItem: { organizationId: context.organization.id },
        assigneeMembershipId: context.membership?.id
      },
      select: { id: true, status: true, inboxItemId: true, inboxItem: { select: { organizationId: true, status: true } } }
    });
    if (!assignment) throw notFound("org.errors.work_assignment_not_found");

    /* Sama värav kui määramisel: terminalseisus kirjet ei võeta vastu ega
       lükata tagasi. Täna sulgeb tagasivõtmine elavad määramised ja allolev
       `PENDING` kontroll püüaks selle niikuinii — aga see on TULETIS. Otsene
       kontroll ei sõltu sellest, et tagasivõtmine oma sabatöö ära teeks. */
    await lockInboxItemRow(tx, assignment.inboxItemId);
    const inboxNow = await tx.organizationInboxItem.findUnique({
      where: { id: assignment.inboxItemId },
      select: { status: true }
    });
    if (isTerminalInboxStatus(inboxNow?.status)) {
      throw conflict("org.errors.inbox_item_terminal", { status: inboxNow?.status || null });
    }

    if (assignment.status !== OrganizationWorkAssignmentStatus.PENDING) {
      throw conflict("org.errors.work_assignment_not_pending");
    }

    const updated = await tx.organizationWorkAssignment.update({
      where: { id: assignmentId },
      data: accept
        ? { status: OrganizationWorkAssignmentStatus.ACCEPTED, acceptedAt: now }
        : {
            status: OrganizationWorkAssignmentStatus.REJECTED,
            rejectedAt: now,
            rejectedReason: reason ? String(reason).slice(0, 500) : null
          }
    });

    const nextStatus = accept
      ? OrganizationInboxStatus.ACCEPTED
      : OrganizationInboxStatus.ASSIGNMENT_PENDING;
    if (canTransitionInboxStatus(assignment.inboxItem.status, nextStatus)) {
      await tx.organizationInboxItem.update({
        where: { id: assignment.inboxItemId },
        data: { status: nextStatus, lastTransitionAt: now }
      });
    }

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: accept ? OrgAuditAction.WORK_ACCEPTED : OrgAuditAction.WORK_REJECTED,
      resourceType: OrgAuditResource.WORK_ASSIGNMENT,
      resourceId: assignmentId,
      meta: {
        organizationId: assignment.inboxItem.organizationId,
        inboxItemId: assignment.inboxItemId
      }
    });

    return updated;
  });
}

/**
 * Üleandmine: vana määramine SULETAKSE ja luuakse UUS, mis viitab vanale.
 * `ownerId` vaikset ülekirjutust ei toimu ja ajalugu säilib (arenduskava §5.7).
 *
 * Jagamisulatus EI LAIENE: uus vastutaja saab täpselt sama `projectSourcePackage`
 * projektsiooni, mille sai eelmine.
 */
export async function handOverWork(
  context,
  assignmentId,
  { toMembershipId, reason },
  { db = prisma, now = new Date() } = {}
) {
  const created = await db.$transaction(async (tx) => {
    const current = await tx.organizationWorkAssignment.findFirst({
      where: { id: assignmentId, inboxItem: { organizationId: context.organization.id } },
      select: {
        id: true,
        status: true,
        inboxItemId: true,
        assigneeMembershipId: true,
        inboxItem: { select: { organizationId: true, unitId: true, status: true } }
      }
    });
    if (!current) throw notFound("org.errors.work_assignment_not_found");

    /* Üleandmine on määramine teise nimega — seega sama värav ja sama lukk.
       Tagasivõetud kirje töö ei tohi rännata edasi ka siis, kui üleandja
       vaade oli lehe laadimise hetkel veel elus. */
    await lockInboxItemRow(tx, current.inboxItemId);
    const inboxNow = await tx.organizationInboxItem.findUnique({
      where: { id: current.inboxItemId },
      select: { status: true }
    });
    if (isTerminalInboxStatus(inboxNow?.status)) {
      throw conflict("org.errors.inbox_item_terminal", { status: inboxNow?.status || null });
    }

    if (!LIVE_WORK_ASSIGNMENT_STATUSES.includes(current.status)) {
      throw conflict("org.errors.work_assignment_not_live");
    }

    /* Üle anda tohib kas töö määraja või senine vastutaja ise. Teine variant
       on tahtlik: puhkusele minev töötaja peab saama töö edasi anda ilma, et
       ta peaks juhi kätte saama. */
    const isAssigner = hasCapability(context, OrganizationCapability.WORK_ASSIGNER, {
      unitId: current.inboxItem.unitId
    });
    const isCurrentAssignee = current.assigneeMembershipId === context.membership?.id;
    if (!isAssigner && !isCurrentAssignee) throw notFound("org.errors.work_assignment_not_found");

    if (toMembershipId === current.assigneeMembershipId) throw conflict("org.errors.work_handover_same_person");

    const next = await tx.organizationMembership.findFirst({
      where: {
        id: toMembershipId,
        organizationId: context.organization.id,
        status: OrganizationMembershipStatus.ACTIVE
      },
      select: { id: true, userId: true }
    });
    if (!next) throw notFound("org.errors.membership_not_found");

    await tx.organizationWorkAssignment.update({
      where: { id: assignmentId },
      data: { status: OrganizationWorkAssignmentStatus.HANDED_OVER, endedAt: now }
    });

    const created = await tx.organizationWorkAssignment.create({
      data: {
        inboxItemId: current.inboxItemId,
        assigneeMembershipId: toMembershipId,
        status: OrganizationWorkAssignmentStatus.PENDING,
        assignedByUserId: context.userId,
        assignedAt: now,
        supersedesAssignmentId: assignmentId
      }
    });

    if (canTransitionInboxStatus(current.inboxItem.status, OrganizationInboxStatus.ASSIGNED)) {
      await tx.organizationInboxItem.update({
        where: { id: current.inboxItemId },
        data: { status: OrganizationInboxStatus.ASSIGNED, lastTransitionAt: now }
      });
    }

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      targetUserId: next.userId,
      action: OrgAuditAction.WORK_HANDED_OVER,
      resourceType: OrgAuditResource.WORK_ASSIGNMENT,
      resourceId: created.id,
      meta: {
        organizationId: current.inboxItem.organizationId,
        inboxItemId: current.inboxItemId,
        assignmentId,
        membershipId: toMembershipId,
        reason: reason ? String(reason).slice(0, 200) : null
      }
    });

    const source = await tx.organizationInboxItem.findUnique({
      where: { id: current.inboxItemId },
      select: { sourceId: true }
    });

    return {
      ...created,
      _organizationId: current.inboxItem.organizationId,
      _sourceId: source?.sourceId || null
    };
  });

  /* Kaks saajat: uus vastutaja saab ülesande, autor saab neutraalse teate,
     et vastutaja muutus. Autori teavitus on §5.7 otsene nõue. */
  await notifyAssignee({
    db,
    inboxItemId: created.inboxItemId,
    membershipId: toMembershipId,
    organizationId: created._organizationId,
    dedupeSuffix: created.id
  });
  if (created._sourceId) {
    await notifyAuthorOfResponsibleChange({
      db,
      sourceId: created._sourceId,
      organizationId: created._organizationId,
      dedupeSuffix: `handover:${created.id}`
    });
  }

  const { _organizationId, _sourceId, ...clean } = created;
  return clean;
}

/**
 * Offboardingu värav: kas sellel liikmesusel on veel elavat organisatsiooni tööd?
 *
 * Arenduskava §E7: „offboarding leiab poolelioleva töö ja nõuab üleandmist".
 * `OrganizationWorkAssignment.assignee` on `onDelete: Restrict`, seega ka DB
 * ei lase liikmesust ära kustutada nii, et töö jääks omanikuta.
 */
export async function findLiveWorkForMembership(membershipId, { db = prisma } = {}) {
  if (!membershipId) return [];
  return db.organizationWorkAssignment.findMany({
    where: { assigneeMembershipId: membershipId, status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
    select: { id: true, inboxItemId: true, status: true, assignedAt: true }
  });
}

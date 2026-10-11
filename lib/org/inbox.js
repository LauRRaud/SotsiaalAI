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
import { SharingViewKind, recordSharingView } from "@/lib/sharings/viewTrail";

import { NOTIFICATION_EVENT_TYPES, createNotificationEvent } from "@/lib/notifications";
import {
  closePreInquiryRoomWithin,
  endPreInquiryRoomMembershipWithin,
  findPreInquiryRoomForMember,
  joinPreInquiryRoomWithin
} from "@/lib/rooms/preInquiryRoom";

import {
  LIVE_WORK_ASSIGNMENT_STATUSES,
  OrganizationCapability,
  OrganizationInboxSourceType,
  OrganizationInboxStatus,
  OrganizationMembershipStatus,
  OrganizationWorkAssignmentStatus,
  canTransitionInboxStatus,
  inboxStatusAfterHandOver,
  inboxStatusFollowsAssignment,
  isTerminalInboxStatus
} from "./constants.js";
import { badRequest, conflict, notFound } from "./errors.js";
import {
  decodePageCursor,
  descendingCursorWhere,
  normalizePageSize,
  toCursorPage
} from "./pagination.js";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "./audit.js";
import { hasCapability } from "./accessContext.js";
import { lockMembershipRow } from "./members.js";
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

/**
 * ENDISELE VASTUTAJALE — „see töö ei ole enam sinu vastutusel".
 *
 * Kui koordinaator võtab töö tagasi või annab selle teisele, kaob kirje töötaja laualt ja
 * tema ligipääs vestlusele lõpeb. Ilma teateta näeks ta ainult, et töö on kadunud, ja kui
 * ta oli pöördujale midagi lubanud, ei teaks ta, et seda enam temalt ei oodata.
 *
 * Teade on neutraalne: ei tegijat, põhjust ega uut vastutajat. Kes töö ise ära andis, teadet
 * ei saa: ta tegi seda just ise. Töö sulgemine seda teadet ei saada (see on töö lõpp, mitte
 * töö äravõtmine). Üks lõppenud määramine, üks teade.
 *
 * Nagu teised teavitused siin: PÄRAST tehingut ja parima pingutusena.
 */
async function notifyFormerAssignee({ db, assignmentId, membershipId, inboxItemId, organizationId, actorUserId }) {
  try {
    const membership = await db.organizationMembership.findUnique({
      where: { id: membershipId },
      select: { userId: true, status: true }
    });
    if (!membership?.userId || membership.status !== OrganizationMembershipStatus.ACTIVE) return;
    if (membership.userId === actorUserId) return;
    await createNotificationEvent(
      {
        type: NOTIFICATION_EVENT_TYPES.ORG_WORK_WITHDRAWN,
        userId: membership.userId,
        sourceId: assignmentId,
        targetId: inboxItemId,
        workspaceKind: "org_space",
        workspaceId: organizationId,
        emailPolicy: "OPTIONAL"
      },
      { db }
    );
  } catch (error) {
    console.error("[org-inbox] former assignee notification failed", error?.message || error);
  }
}

async function notifyAuthorOfResponsibleChange({ db, sourceId, organizationId, dedupeSuffix, actorUserId = null }) {
  try {
    const inquiry = await db.preInquiry.findUnique({
      where: { id: sourceId },
      select: { authorId: true, recalledAt: true }
    });
    if (!inquiry?.authorId || inquiry.recalledAt) return;
    /* Pöörduja, kes on sama asutuse koordinaator ja võttis töö ise tagasi, teadet ei vaja. */
    if (actorUserId && inquiry.authorId === actorUserId) return;
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

/**
 * ASUTUS LÕPETAS TÖÖ: pöörduja saab teavituse.
 *
 * Sulgemisel jääb pöörduja vestlusruum ainult loetavaks (`closePreInquiryRoomWithin`). Ilma
 * teavituseta sai ta sellest teada ainult siis, kui ise ruumi või Teekonda vaatas, ja võis
 * vastust edasi oodata. Teavitus on neutraalne: ei sulgemise põhjust, ei töötaja ega asutuse
 * nime, ainult fakt ja viide tema enda pöördumisele.
 *
 * Nagu teised teavitused siin: PÄRAST tehingut ja parima pingutusena. Töö on juba suletud;
 * teavituse tõrge ei tohi seda tagasi keerata. Üks kirje, üks teavitus (`closed:<kirje>`):
 * suletud kirjet uuesti sulgeda ei saa. Kui sulgeja on pöörduja ise (ta on sama asutuse
 * koordinaator), teavitust ei saadeta: ta tegi seda just ise.
 */
async function notifyAuthorOfClosedWork({ db, sourceId, organizationId, inboxItemId, actorUserId }) {
  try {
    const inquiry = await db.preInquiry.findUnique({
      where: { id: sourceId },
      select: { authorId: true, recalledAt: true }
    });
    if (!inquiry?.authorId || inquiry.recalledAt || inquiry.authorId === actorUserId) return;
    await createNotificationEvent(
      {
        type: NOTIFICATION_EVENT_TYPES.PRE_INQUIRY_WORK_CLOSED,
        userId: inquiry.authorId,
        sourceId,
        targetId: sourceId,
        dedupeSuffix: `closed:${inboxItemId}`,
        workspaceKind: "org_space",
        workspaceId: organizationId,
        emailPolicy: "OPTIONAL"
      },
      { db }
    );
  } catch (error) {
    console.error("[org-inbox] closed work notification failed", error?.message || error);
  }
}

/**
 * VESTLUSRUUM KÄIB TÖÖGA KAASAS (omaniku otsus 11.10.2026).
 *
 * Asutuse lauale saadetud pöördumisele vastab töötaja samas ühises ruumis, mida kasutab
 * nimeline saaja (`lib/rooms/preInquiryRoom.js`). Ruumi liikmed on pöörduja ja töötaja,
 * kelle elav töömääramine on `ACCEPTED`:
 *
 *   - üleandmisel lahkub senine vastutaja ruumist; ruumi saab edasi kirjutada;
 *   - sama juhtub, kui koordinaator võtab töö tagasi (`transitionInboxItem`, „ootab
 *     määramist");
 *   - uus vastutaja liitub töö vastuvõtmisel ja näeb varasemat vestlust;
 *   - töö sulgemisel lahkub vastutaja ja ruum jääb kõigile ainult loetavaks
 *     (`closePreInquiryRoomWithin`): muidu kirjutaks pöörduja ruumi, mida asutuse poolel
 *     enam keegi ei loe;
 *   - koordinaator, kes ei ole vastutaja, ruumi ei saa.
 *
 * See EI muuda paketi reeglit: `projectSourcePackage` on sama ja Teekond ei ole asutuse
 * käes. Edasi liigub ainult vestlus, mida pöörduja ise selles ruumis asutusega pidas.
 *
 * Liikmesuse muutus tehakse SAMAS tehingus töömääramise muutusega. Vastasel korral oleks
 * hetk, kus töö on juba teise inimese käes, aga vestlust loeb veel eelmine.
 */
function isPreInquirySource(sourceType) {
  return sourceType === OrganizationInboxSourceType.PRE_INQUIRY;
}

/**
 * Ruumist lahkunud töötaja vabastatakse ka ruumi käimasolevast kõnest: muidu jääks kõnesse
 * osaleja, kes ei saa enam ise lahkuda, ja kõne ei lõpeks viimase päris osaleja lahkumisel.
 * Tehakse PÄRAST tehingut ja parima pingutusena, nagu teavitused: kõne koristuse tõrge ei
 * tohi üleandmist tagasi keerata.
 */
async function releaseFormerWorkerFromCalls(left, releaseFromCalls = null) {
  if (!left) return;
  try {
    const release = releaseFromCalls
      || (await import("@/lib/calls/roomRoutes")).createRoomCallService().releaseRoomMemberFromCalls;
    await release({ roomId: left.roomId, userId: left.userId });
  } catch (error) {
    console.error("[org-inbox] call release failed", error?.message || error);
  }
}

/**
 * Ainult loetavaks jäänud ruumis ei tohi kõne edasi käia: lõpetatakse kogu kõne, nagu ruumi
 * arhiveerimisel (`PATCH /api/rooms/<roomId>`). Kõne lõpetamine kutsub välist teenust, seega
 * tehakse see PÄRAST tehingut ja parima pingutusena: töö on juba suletud ja ruum juba ainult
 * loetav, kõne koristuse tõrge ei tohi seda tagasi keerata. Kui kogu kõnet lõpetada ei
 * õnnestu, vabastatakse vähemalt ruumist lahkunud töötaja; teised saavad kõnest ise lahkuda.
 */
async function endCallOfClosedRoom(closed, { actorUserId, endRoomCall = null, releaseFromCalls = null }) {
  if (!closed?.roomId) return;
  try {
    const end = endRoomCall
      || (await import("@/lib/calls/roomRoutes")).createRoomCallService().endActiveRoomCall;
    await end({ roomId: closed.roomId, actorUserId });
  } catch (error) {
    console.error("[org-inbox] call end failed", error?.message || error);
    await releaseFormerWorkerFromCalls(closed.left, releaseFromCalls);
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

export async function listInboxItemPage(
  context,
  { db = prisma, includeClosed = false, take = 100, cursor, status, priority, now = new Date() } = {}
) {
  const scopeWhere = inboxScopeFilter(context);
  // Tavaline liige ei näe ühist postkasti — tühi loend, mitte 403.
  // Vastasel korral paljastaks veakood postkasti olemasolu.
  if (!scopeWhere) return { items: [], hasMore: false, nextCursor: null };

  const normalizedStatus = String(status || "").trim();
  if (normalizedStatus && !Object.values(OrganizationInboxStatus).includes(normalizedStatus)) {
    throw badRequest("org.errors.invalid_payload");
  }
  const normalizedPriority = String(priority || "").trim();
  if (normalizedPriority && !["declared", "overdue"].includes(normalizedPriority)) {
    throw badRequest("org.errors.invalid_payload");
  }
  const decoded = decodePageCursor(cursor, { dateKeys: ["receivedAt"], stringKeys: ["id"] });
  const pageSize = normalizePageSize(take, 100, 200);
  const baseWhere = {
    ...scopeWhere,
    ...(normalizedStatus
      ? { status: normalizedStatus }
      : includeClosed
        ? {}
        : { status: { notIn: [OrganizationInboxStatus.CLOSED, OrganizationInboxStatus.RECALLED] } }),
    ...(normalizedPriority === "declared" ? { urgencyDeclaredBySender: { not: null } } : {}),
    ...(normalizedPriority === "overdue"
      ? {
          dueAt: { lt: now },
          AND: [{ status: { in: Object.values(OrganizationInboxStatus).filter((value) => !isTerminalInboxStatus(value)) } }]
        }
      : {})
  };

  const rows = await db.organizationInboxItem.findMany({
    where: decoded
      ? { AND: [baseWhere, descendingCursorWhere(decoded, ["receivedAt", "id"])] }
      : baseWhere,
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
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    take: pageSize + 1
  });

  /* Loend EI kanna lähteobjekti sisu — ainult seisu ja vastutajat. Sisu
     avaneb ühe kirje avamisel, mis on eraldi teadlik samm ja eraldi audit. */
  const page = toCursorPage(rows, pageSize, (row) => ({ receivedAt: row.receivedAt, id: row.id }));
  return {
    ...page,
    items: page.items.map((row) => ({
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
    }))
  };
}

export async function listInboxItems(context, options = {}) {
  return (await listInboxItemPage(context, options)).items;
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
        select: {
          id: true,
          assigneeMembershipId: true,
          status: true,
          assignee: { select: { userId: true } }
        }
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
export async function getInboxItem(context, inboxItemId, { db = prisma, now = new Date() } = {}) {
  /* „Kes on vaadanud": kelle pöördumist loeti. Täidetakse tehingu sees, kirjutatakse pärast
     seda: tehingu sees ebaõnnestunud lisamine katkestaks ka lugemise ja avamise märke. */
  let viewed = null;
  const result = await db.$transaction(async (tx) => {
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
      const openedAt = now;
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
    /* Tagasi võetud pöördumise sisu ei näidata, seega ei ole see ka vaatamine. */
    if (inquiry && !recalled) viewed = { preInquiryId: item.sourceId, authorId: inquiry.authorId || null };

    const live = item.assignments[0] || null;

    /* VESTLUSRUUM: ainult töö vastu võtnud töötajale. Koordinaator, kes ei ole vastutaja,
       ei saa ruumi ega tea ka seda, kas ruum on olemas. Ruumi ID antakse ainult selle
       aktiivsele liikmele; ruumi avamise otsustab server uuesti luku all
       (`ensureRoomForPreInquiry`), siinne väli ütleb lehele ainult, kas nuppu näidata. */
    const canOpenRoom = Boolean(
      isAssignee &&
        live?.status === OrganizationWorkAssignmentStatus.ACCEPTED &&
        isPreInquirySource(item.sourceType) &&
        !isTerminalInboxStatus(item.status) &&
        !recalled &&
        inquiry?.authorId &&
        inquiry.authorId !== context.userId
    );
    const room = canOpenRoom
      ? await findPreInquiryRoomForMember(item.sourceId, context.userId, { db: tx })
      : null;

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
      room: { canOpen: canOpenRoom, id: room?.id || null },
      /* Määratud töötaja saab TÄPSELT sama projektsiooni mis koordinaator —
         ei rohkem (uus sisu) ega vähem (poolik pakett). */
      source: projectSourcePackage(inquiry)
    };
  });
  if (viewed) {
    await recordSharingView({
      db,
      kind: SharingViewKind.PRE_INQUIRY,
      itemId: viewed.preInquiryId,
      viewerUserId: context?.userId || null,
      sharerUserIds: [viewed.authorId],
      now
    });
  }
  return result;
}

/**
 * Postkasti seisusiire koordinaatori käega. Ainult koordinaator, ainult lubatud siirded.
 *
 * KÄSITSI SEIS EI LÄHE ELAVA TÖÖMÄÄRAMISEGA VASTUOLLU (omaniku otsus 11.10.2026). Kirje seis
 * ja elav määramine ütlevad sama asja: vastust ootav määramine on „määratud" kirjel, vastu
 * võetud määramine „vastu võetud" kirjel ja vastutajata kirje ei ole kumbki. Seepärast:
 *
 *   - „määratud" ja „vastu võetud" käsitsi valida ei saa: need tekivad määramisest,
 *     üleandmisest ja töötaja vastusest (`inboxStatusFollowsAssignment`);
 *   - „ootab määramist" tähendab kirjel, millel on vastutaja, TÖÖ TAGASIVÕTMIST: elav
 *     määramine lõpetatakse samas tehingus ja töötaja lahkub vestlusruumist, nagu
 *     üleandmisel. Ruum jääb pöördujale kirjutatavaks; uus töötaja liitub sellega töö
 *     vastuvõtmisel;
 *   - „tagasi lükatud" ja „suletud" lõpetavad töö ja elava määramise nagu enne;
 *   - muu seis (täna „vaatlemisel") ei ole kirjel, millel on vastutaja, lubatud.
 *
 * Seisutabelit see ei muuda: määramine ja töötaja vastus küsivad luba samalt tabelilt.
 */
export async function transitionInboxItem(
  context,
  inboxItemId,
  { toStatus, reason },
  { db = prisma, now = new Date(), releaseFromCalls = null, endRoomCall = null } = {}
) {
  const outcome = await db.$transaction(async (tx) => {
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
    /* Sama põhjus: „määratud" ja „vastu võetud" ei ole käsitsi õige ühestki seisust, ka
       sealt, kust tabel siirde määramise jaoks lubab. */
    if (inboxStatusFollowsAssignment(toStatus)) {
      throw conflict("org.errors.inbox_status_follows_assignment", { toStatus });
    }
    if (!canTransitionInboxStatus(item.status, toStatus)) {
      throw conflict("org.errors.invalid_inbox_transition", { fromStatus: item.status, toStatus });
    }

    const closing =
      toStatus === OrganizationInboxStatus.CLOSED || toStatus === OrganizationInboxStatus.REJECTED;
    /* Elav määramine loeti kirje rea luku all (`requireVisibleInboxItem`), seega on see
       värske ka siis, kui töötaja vastas või töö anti üle samal hetkel. */
    const live = item.assignments[0] || null;
    const takingBack = Boolean(live) && toStatus === OrganizationInboxStatus.ASSIGNMENT_PENDING;
    /* Lahtisesse seisu ei minda nii, et töö jääb töötaja kätte. Kooskõlalisest seisust siia
       ei jõua (tabel lubab „vaatlemisele" ainult vastutajata seisudest); värav on ridade
       jaoks, mille seis ja määramine läksid lahku enne seda reeglit. */
    if (live && !closing && !takingBack) {
      throw conflict("org.errors.invalid_inbox_transition", { fromStatus: item.status, toStatus });
    }

    const updated = await tx.organizationInboxItem.update({
      where: { id: inboxItemId },
      data: {
        status: toStatus,
        lastTransitionAt: now,
        closedAt: closing ? now : null,
        closedReason: closing && reason ? String(reason).slice(0, 500) : null
      }
    });

    if (closing || takingBack) {
      await tx.organizationWorkAssignment.updateMany({
        where: { inboxItemId, status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
        data: { status: OrganizationWorkAssignmentStatus.ENDED, endedAt: now }
      });
    }

    let closedRoom = null;
    let left = null;
    if (closing) {
      /* Töö lõppes: vastutaja ligipääs vestlusele lõpeb ja ruum jääb kõigile ainult loetavaks.
         Ajalugu jääb pöördujale alles. Ruum suletakse ka siis, kui elavat vastutajat ei ole
         (töö anti üle, uus töötaja lükkas tagasi ja koordinaator lükkas pöördumise tagasi):
         ruumi tegi varasem vastutaja ja pöörduja kirjutaks sinna muidu edasi. */
      if (isPreInquirySource(item.sourceType)) {
        closedRoom = await closePreInquiryRoomWithin(tx, {
          inquiryId: item.sourceId,
          workerUserId: live?.assignee?.userId || null,
          actorUserId: context.userId,
          now
        });
      }
    } else if (takingBack && live.assignee?.userId && isPreInquirySource(item.sourceType)) {
      /* Töö võeti tagasi: töötaja lahkub vestlusruumist SAMAS tehingus, nagu üleandmisel.
         Töö ei lõppenud, seega ruum jääb kirjutatavaks ja ootab järgmist vastutajat. */
      left = await endPreInquiryRoomMembershipWithin(tx, {
        inquiryId: item.sourceId,
        userId: live.assignee.userId,
        now
      });
    }

    /* Üks tegu, üks auditirida. Tagasivõtmisel ütleb sama rida ka, kelle määramine lõppes. */
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      ...(takingBack && live.assignee?.userId ? { targetUserId: live.assignee.userId } : {}),
      action: OrgAuditAction.INBOX_ITEM_TRANSITIONED,
      resourceType: OrgAuditResource.INBOX_ITEM,
      resourceId: inboxItemId,
      meta: {
        organizationId: item.organizationId,
        inboxItemId,
        fromInboxStatus: item.status,
        toInboxStatus: toStatus,
        ...(takingBack ? { assignmentId: live.id, membershipId: live.assigneeMembershipId } : {})
      }
    });

    return {
      updated,
      closedRoom,
      left,
      closedSource: closing && isPreInquirySource(item.sourceType)
        ? { sourceId: item.sourceId, organizationId: item.organizationId }
        : null,
      takenBack: takingBack
        ? {
            assignmentId: live.id,
            membershipId: live.assigneeMembershipId,
            organizationId: item.organizationId,
            /* Pöördujale muutub midagi ainult siis, kui töötaja oli töö vastu võtnud: siis
               oli tal vastutaja, kes võis temaga juba vestelda. */
            sourceId:
              live.status === OrganizationWorkAssignmentStatus.ACCEPTED && isPreInquirySource(item.sourceType)
                ? item.sourceId
                : null
          }
        : null
    };
  });

  await endCallOfClosedRoom(outcome.closedRoom, { actorUserId: context.userId, endRoomCall, releaseFromCalls });
  await releaseFormerWorkerFromCalls(outcome.left, releaseFromCalls);
  if (outcome.closedSource) {
    await notifyAuthorOfClosedWork({
      db,
      ...outcome.closedSource,
      inboxItemId,
      actorUserId: context.userId
    });
  }
  /* Töö tagasivõtmine: töötaja saab teada, et töö ei ole enam tema vastutusel, ja pöörduja
     saab sama neutraalse teate mis üleandmisel („sinu eelpöördumise olek muutus"). */
  if (outcome.takenBack) {
    const { assignmentId, membershipId, organizationId, sourceId } = outcome.takenBack;
    await notifyFormerAssignee({ db, assignmentId, membershipId, inboxItemId, organizationId, actorUserId: context.userId });
    if (sourceId) {
      await notifyAuthorOfResponsibleChange({
        db,
        sourceId,
        organizationId,
        dedupeSuffix: `takeback:${assignmentId}`,
        actorUserId: context.userId
      });
    }
  }
  return outcome.updated;
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
    /* AVATUD SEISUD TULEVAD SEISUMASINAST, MITTE TEISEST LOENDIST (SOL-ORG-08).
       „Mitte-terminaalne" ei ole sama mis „määratav": `ACCEPTED` kirjel ei ole
       siiret `ASSIGNED`-isse, aga elava määramiseta jõudis ta siit läbi ja sai
       uue `PENDING` määramise, ilma et laual oleks midagi muutunud. Määramine
       ilma nähtava seisumuutuseta on täpselt see vaikne kõrvaluks, mille see
       leid kirjeldab — nüüd on ta selgesõnaline konflikt. */
    if (!canTransitionInboxStatus(item.status, OrganizationInboxStatus.ASSIGNED)) {
      throw conflict("org.errors.invalid_inbox_transition", {
        fromStatus: item.status,
        toStatus: OrganizationInboxStatus.ASSIGNED
      });
    }
    if (item.assignments.length) throw conflict("org.errors.work_already_assigned");

    /* SAAJA ELUSUS LOETAKSE LUKU ALL (SOL-ORG-10). Ilma selleta luges määramine
       aktiivsust hetkel, mil paralleelne lahkumine oli oma elava töö loenduse
       juba teinud — ja lahkunuks märgitud inimesele jäi elav juhtum. */
    await lockMembershipRow(tx, assigneeMembershipId);
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

    /* Siire on ülal juba nõutud, seega ta EI OLE siin tingimuslik: kui kirje ei
       liigu `ASSIGNED`-isse, ei ole me siia jõudnud. */
    await tx.organizationInboxItem.update({
      where: { id: inboxItemId },
      data: { status: OrganizationInboxStatus.ASSIGNED, lastTransitionAt: now }
    });

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
      select: {
        id: true,
        status: true,
        inboxItemId: true,
        inboxItem: { select: { organizationId: true, status: true, sourceType: true, sourceId: true } }
      }
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

    /* MÄÄRAMISE ELUSUS ON TINGIMUS, MITTE EELNEV LUGEMINE (SOL-ORG-08).
       `assignment.status` loeti ENNE kirje lukku. Vahepeal võis üleandmine selle
       rea `HANDED_OVER`-iks teha — see EI muuda kirje seisu terminaalseks, seega
       ülemine värav ei püüaks teda, ja tingimusteta `update` oleks äraantud töö
       tagasi ellu äratanud. `updateMany` tingimusega hindab seisu andmebaasis,
       rea luku all: kui ta ei kirjutanud, siis me kaotasime. */
    const claimed = await tx.organizationWorkAssignment.updateMany({
      where: { id: assignmentId, status: OrganizationWorkAssignmentStatus.PENDING },
      data: accept
        ? { status: OrganizationWorkAssignmentStatus.ACCEPTED, acceptedAt: now }
        : {
            status: OrganizationWorkAssignmentStatus.REJECTED,
            rejectedAt: now,
            rejectedReason: reason ? String(reason).slice(0, 500) : null
          }
    });
    if (claimed.count !== 1) throw conflict("org.errors.work_assignment_not_pending");
    const updated = await tx.organizationWorkAssignment.findUnique({ where: { id: assignmentId } });

    const nextStatus = accept
      ? OrganizationInboxStatus.ACCEPTED
      : OrganizationInboxStatus.ASSIGNMENT_PENDING;
    /* Siire arvutatakse LUKU ALL loetud seisust (`inboxNow`), mitte tehingu
       alguses loetud koopiast — muidu otsustaks vananenud alus, kuhu kirje
       liigub. */
    if (canTransitionInboxStatus(inboxNow?.status, nextStatus)) {
      await tx.organizationInboxItem.update({
        where: { id: assignment.inboxItemId },
        data: { status: nextStatus, lastTransitionAt: now }
      });
    }

    /* Kui pöördumisel on juba vestlusruum (eelmine vastutaja avas selle), liitub töö vastu
       võtnud töötaja sellega kohe ja näeb varasemat vestlust. Esimest ruumi siin ei looda. */
    if (accept && isPreInquirySource(assignment.inboxItem.sourceType)) {
      await joinPreInquiryRoomWithin(tx, {
        inquiryId: assignment.inboxItem.sourceId,
        userId: context.userId
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
 * Paketi ulatus EI LAIENE: uus vastutaja saab täpselt sama `projectSourcePackage`
 * projektsiooni, mille sai eelmine. Vestlusruum käib tööga kaasas (omaniku otsus
 * 11.10.2026, vt `isPreInquirySource` juurest): senine vastutaja lahkub siin, uus liitub
 * vastuvõtmisel.
 */
export async function handOverWork(
  context,
  assignmentId,
  { toMembershipId, reason },
  { db = prisma, now = new Date(), releaseFromCalls = null } = {}
) {
  const created = await db.$transaction(async (tx) => {
    const current = await tx.organizationWorkAssignment.findFirst({
      where: { id: assignmentId, inboxItem: { organizationId: context.organization.id } },
      select: {
        id: true,
        status: true,
        inboxItemId: true,
        assigneeMembershipId: true,
        assignee: { select: { userId: true } },
        inboxItem: {
          select: { organizationId: true, unitId: true, status: true, sourceType: true, sourceId: true }
        }
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

    /* Üleandmine on määramine teise nimega — seega ka sama liikmesuse lukk. */
    await lockMembershipRow(tx, toMembershipId);
    const next = await tx.organizationMembership.findFirst({
      where: {
        id: toMembershipId,
        organizationId: context.organization.id,
        status: OrganizationMembershipStatus.ACTIVE
      },
      select: { id: true, userId: true }
    });
    if (!next) throw notFound("org.errors.membership_not_found");

    /* Sama põhjus mis vastamisel (SOL-ORG-08): `current.status` loeti enne
       kirje lukku. Kaks samaaegset üleandmist või üleandmine ja vastamine
       nägid mõlemad elavat rida; tingimusteta `update` oleks teinud kaks elavat
       määramist ühele tööle ja lasknud otsustada osalisel unikaalindeksil, kelle
       päring kukub. Nõue on selgem: kaotaja saab konflikti, mitte P2002. */
    const claimed = await tx.organizationWorkAssignment.updateMany({
      where: { id: assignmentId, status: { in: [...LIVE_WORK_ASSIGNMENT_STATUSES] } },
      data: { status: OrganizationWorkAssignmentStatus.HANDED_OVER, endedAt: now }
    });
    if (claimed.count !== 1) throw conflict("org.errors.work_assignment_not_live");

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

    /* KIRJE SEIS KÄIB ELAVA MÄÄRAMISEGA KAASAS. Uus määramine on `PENDING`, seega on kirje
       „määratud", ka siis, kui senine vastutaja oli töö vastu võtnud. Varem küsiti siin
       `canTransitionInboxStatus`-elt, kus `ACCEPTED → ASSIGNED` puudub: kirje jäi seisu
       `ACCEPTED` ning loend, seisufilter ja eksport näitasid tööd vastu võetuna, kuigi uus
       vastutaja ei olnud veel vastanud. Reegel ja põhjus, miks see siire ei ole
       seisutabelis: `inboxStatusAfterHandOver`.

       Alus on luku all loetud seis, mitte tehingu alguse koopia — vt vastamise juurest. */
    const fromInboxStatus = inboxNow.status;
    const toInboxStatus = inboxStatusAfterHandOver(fromInboxStatus);
    const moved = toInboxStatus !== fromInboxStatus;
    if (moved) {
      await tx.organizationInboxItem.update({
        where: { id: current.inboxItemId },
        data: { status: toInboxStatus, lastTransitionAt: now }
      });
    }

    /* Üks tegu, üks auditirida, nagu määramisel ja vastuvõtmisel. Kui kirje seis liikus,
       ütleb sama rida ka kust kuhu; vastamata määramise üleandmisel seis ei liigu ja rida
       siiret ei väida. */
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
        reason: reason ? String(reason).slice(0, 200) : null,
        ...(moved ? { fromInboxStatus, toInboxStatus } : {})
      }
    });

    /* Senine vastutaja lahkub vestlusruumist SAMAS tehingus. Uus vastutaja liitub alles
       töö vastuvõtmisel (`respondToAssignment`): määramine üksi ei anna ligipääsu, sest
       ta võib töö ka tagasi lükata. */
    const left = current.assignee?.userId && isPreInquirySource(current.inboxItem.sourceType)
      ? await endPreInquiryRoomMembershipWithin(tx, {
          inquiryId: current.inboxItem.sourceId,
          userId: current.assignee.userId,
          now
        })
      : null;

    return {
      ...created,
      _organizationId: current.inboxItem.organizationId,
      _sourceId: current.inboxItem.sourceId || null,
      _left: left,
      _formerMembershipId: current.assigneeMembershipId
    };
  });

  await releaseFormerWorkerFromCalls(created._left, releaseFromCalls);

  /* Kolm saajat: uus vastutaja saab ülesande, senine vastutaja saab teada, et töö ei ole
     enam tema käes (kui ta seda ise ära ei andnud), ja autor saab neutraalse teate, et
     vastutaja muutus. Autori teavitus on §5.7 otsene nõue. */
  await notifyAssignee({
    db,
    inboxItemId: created.inboxItemId,
    membershipId: toMembershipId,
    organizationId: created._organizationId,
    dedupeSuffix: created.id
  });
  await notifyFormerAssignee({
    db,
    assignmentId,
    membershipId: created._formerMembershipId,
    inboxItemId: created.inboxItemId,
    organizationId: created._organizationId,
    actorUserId: context.userId
  });
  if (created._sourceId) {
    await notifyAuthorOfResponsibleChange({
      db,
      sourceId: created._sourceId,
      organizationId: created._organizationId,
      dedupeSuffix: `handover:${created.id}`
    });
  }

  const { _organizationId, _sourceId, _left, _formerMembershipId, ...clean } = created;
  return clean;
}

/**
 * Kas sellel liikmel on selle kirjega olnud töömääramine (elav või lõppenud)?
 *
 * Teade „töö ei ole enam sinu vastutusel" viib kirje aadressile, mida endine vastutaja enam
 * ei ava. Suunaja `/org/vastuvott/[itemId]` küsib seda, et viia ta „lehte ei leitud" asemel
 * asutuse vastuvõtulauale. Midagi uut see ei paljasta: inimene on asutuse liige ja teadis
 * kirjest juba siis, kui töö oli tema käes.
 */
export async function hadWorkOnInboxItem(context, inboxItemId, { db = prisma } = {}) {
  const membershipId = context?.membership?.id;
  if (!membershipId || !inboxItemId) return false;
  return Boolean(await db.organizationWorkAssignment.findFirst({
    where: {
      inboxItemId,
      assigneeMembershipId: membershipId,
      inboxItem: { organizationId: context.organization.id }
    },
    select: { id: true }
  }));
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

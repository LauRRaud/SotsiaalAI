/**
 * TEENUSPÄEVIK E10 — TÖÖDE MÄÄRAMINE JA ASENDUS.
 *
 * See on ainus koht kogu teenuspäevikus, kus üks inimene kirjutab TEISE inimese
 * päevikusse. Seepärast on siin reeglid rangemad kui mujal.
 *
 * NELI REEGLIT:
 *
 * 1. MÄÄRATA SAAB AINULT OMA ÜKSUSE TÖÖTAJALE. Õigus tuleb capability'st
 *    (`WORK_ASSIGNER`, `UNIT_LEAD`, `ORG_OWNER`) JA töötaja peab olema selle
 *    skoobi sees. Kaks tingimust, mitte üks: org-liikmesus üksi ei anna õigust
 *    kellelegi tööd määrata.
 *
 * 2. MÄÄRATUD TÖÖ ON PLAAN, MITTE TEHTUD TÖÖ. Juht loob `PLANNED` külastuse.
 *    Ta EI SAA märkida kohalejõudmist ega teenust tehtuks — seda teeb inimene,
 *    kes päriselt kohal käis. Juhi loodud „tehtud" oleks väljamõeldud tõend.
 *
 * 3. ALUSTATUD TÖÖD EI SAA ÜMBER MÄÄRATA. Asendus tähendab „mine sina selle
 *    asemel", mitte „kirjuta tema tehtud töö enda nimele". Kui esimene töötaja
 *    on juba teele asunud või kohal käinud, jääb tema kirje talle ja asendus
 *    saab olla ainult UUS külastus.
 *
 * 4. IGA MÄÄRAMINE JÄTAB JÄLJE. Töötaja peab saama hiljem näha, kes selle töö
 *    tema päeva pani ja millal — muidu on „ma ei teadnud sellest tööst"
 *    vaidlus, mida ei saa lahendada.
 *
 *    **Jälg on nüüd PÕHIMUUDATUSEGA SAMAS TEHINGUS** (SOL-SLOG-18). Varem oli
 *    ta `.catch(() => {})` taga: töö liikus ühelt inimeselt teisele ja audit
 *    võis vaikselt puududa. „Kes selle ära viis" on siin kogu jälje mõte —
 *    audidita ümbermääramine on halvem kui ümbermääramata jäänud töö.
 *
 * 5. TÖÖ KANNAB OMA MAJA NIME (SOL-SLOG-17, -18). Määramine kirjutab külastuse
 *    külge organisatsiooni, kelle tööna ta sünnib, ja ümbermääramine kontrollib
 *    seda ENNE kõike muud. Ilma selleta tuletas skoop end inimese kaudu — ja
 *    kahes majas töötava inimese kaudu ulatus ta teise majja.
 */

import { prisma } from "@/lib/prisma";

import { OrganizationMembershipStatus } from "@/lib/org/constants";
import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "@/lib/org/audit";
import { PROVIDER_OWNERSHIP_MODE } from "@/lib/org/profileRecipient";
import { geocodeServiceMapAddress } from "@/lib/serviceMap/geocoding";

import { assertServiceLogEnabled } from "./flags.js";
import { badRequest, conflict, forbidden, notFound } from "./errors.js";
import { VISIT_STATUS } from "./dayRouteMachine.js";
import { openRoute, serializeVisit } from "./dayRoute.js";
import { resolveBoardScope } from "./dispatchBoard.js";
import { belongsToOrganization } from "./visitOrigin.js";
import { MAX_CLIENT_NAME_LENGTH, MAX_EXTERNAL_REF_LENGTH } from "./constants.js";

const MAX_ADDRESS_LENGTH = 300;

function text(value, maxLength) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * Kas see juht tohib SELLELE töötajale tööd määrata.
 *
 * KAKS TINGIMUST. Capability annab õiguse üldse määrata; üksuse kattuvus ütleb,
 * KELLELE. Ilma teiseta saaks üksuse juht määrata tööd terve organisatsiooni
 * peale — ja tema õigus on üksuse oma, mitte maja oma.
 */
export async function assertCanAssign(
  managerUserId,
  organizationId,
  workerUserId,
  { db = prisma, now = new Date() } = {}
) {
  const scope = await resolveBoardScope(managerUserId, organizationId, { db, now });
  if (!scope.allowed) throw forbidden("service_log.errors.assign_not_allowed");

  const worker = await db.organizationMembership.findFirst({
    where: {
      userId: workerUserId,
      organizationId,
      status: OrganizationMembershipStatus.ACTIVE,
      ...(scope.wholeOrg ? {} : { units: { some: { unitId: { in: scope.unitIds }, endedAt: null } } })
    },
    select: { id: true, userId: true }
  });
  if (!worker) throw forbidden("service_log.errors.assign_not_allowed");
  return worker;
}

/**
 * Töötaja oma teenuseprofiil. Määratud töö läheb TEMA päevikusse, mitte juhi
 * omasse — juhil ei ole teenuskirjeid ja tema profiil ei ole arve alus.
 */
async function resolveWorkerProfile(workerUserId, { db = prisma } = {}) {
  const profile = await db.serviceProviderProfile.findFirst({
    where: { ownerId: workerUserId, ownershipMode: PROVIDER_OWNERSHIP_MODE.SOLO },
    select: { id: true }
  });
  /* Ilma teenuseprofiilita ei ole kuhugi määrata. See EI OLE juhi viga ja
     teade peab seda ütlema — muidu otsib ta viga oma õigustest. */
  if (!profile) throw conflict("service_log.errors.worker_has_no_profile");
  return profile;
}

/**
 * Määrab töötajale külastuse.
 *
 * @returns serialiseeritud külastus
 */
export async function assignVisit(
  managerUserId,
  {
    organizationId,
    workerUserId,
    clientDisplayName,
    clientExternalRef = null,
    address = null,
    plannedStartAt = null,
    note = null
  } = {},
  { db = prisma, env = process.env, now = new Date(), geocodeAddress = geocodeServiceMapAddress } = {}
) {
  assertServiceLogEnabled(env);
  if (!organizationId || !workerUserId) throw badRequest("service_log.errors.invalid_input");

  const membership = await assertCanAssign(managerUserId, organizationId, workerUserId, { db, now });
  const profile = await resolveWorkerProfile(workerUserId, { db });

  /* Töötaja tööpäev avatakse tema NIMEL, aga tema teadmata: ta näeb tööd, kui
     telefoni avab. Alternatiiv oleks nõuda, et ta ise päeva alustaks enne, kui
     talle tööd määrata saab — see tähendaks, et hommikune plaan ei ole tehtav. */
  const route = await openRoute(workerUserId, { now }, { db });

  const data = {
    providerProfileId: profile.id,
    routeId: route.id,
    /* `ownerUserId` on TÖÖTAJA, mitte juht: kirje kuulub sellele, kes töö teeb.
       Juht jääb auditijälge, mitte kirje omanikuks. */
    ownerUserId: workerUserId,
    /* PÄRITOLU KÜLMUTATAKSE SIIN, kus ta on TÕENDATUD: `assertCanAssign` on
       just kontrollinud, et kutsujal on selles organisatsioonis kehtiv luba ja
       et töötaja on tema skoobis. Hiljem seda tuletada ei saa. */
    assignedOrganizationId: organizationId,
    clientDisplayName: text(clientDisplayName, MAX_CLIENT_NAME_LENGTH),
    clientExternalRef: text(clientExternalRef, MAX_EXTERNAL_REF_LENGTH),
    address: text(address, MAX_ADDRESS_LENGTH),
    note: text(note, 2000),
    status: VISIT_STATUS.PLANNED,
    plannedStartAt: plannedStartAt ? new Date(plannedStartAt) : null,
    sortOrder: 0
  };
  if (!data.clientDisplayName) throw badRequest("service_log.errors.invalid_input");

  if (data.address) {
    try {
      const geo = await geocodeAddress(data.address);
      if (geo?.latitude && geo?.longitude) {
        data.addressLat = geo.latitude;
        data.addressLng = geo.longitude;
        data.addressAdsId = geo.adsObjectId || null;
      }
    } catch {
      /* Väline register ei tohi tööde jagamist blokeerida. */
    }
  }

  /* Uus töö läheb päeva LÕPPU: juht ei tea, kus töötaja parasjagu on, ja tema
     poolt keskele torgatud töö lõhuks käimasoleva järjekorra. Ümber järjestada
     saab pärast. */
  const last = await db.serviceVisit.findFirst({
    where: { routeId: route.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  data.sortOrder = (last?.sortOrder ?? -1) + 1;

  /* KIRJE JA JÄLG ÜHES TEHINGUS. Vt reegel 4: määratud töö ilma jäljeta on
     täpselt see vaidlus, mida jälg lahendama peaks. */
  const visit = await db.$transaction(async (tx) => {
    const created = await tx.serviceVisit.create({ data });
    await writeOrgAudit(tx, {
      actorUserId: managerUserId,
      targetUserId: workerUserId,
      action: OrgAuditAction.SERVICE_VISIT_ASSIGNED,
      resourceType: OrgAuditResource.SERVICE_VISIT,
      resourceId: created.id,
      meta: { organizationId, membershipId: membership.id, routeId: route.id }
    });
    return created;
  });

  return serializeVisit(visit);
}

/**
 * ASENDUS: annab plaanitud töö teisele töötajale.
 *
 * ALUSTATUD TÖÖD EI LIIGUTATA. „Mine sina selle asemel" on plaani muutmine;
 * „kirjuta tema tehtud töö enda nimele" oleks arve alusdokumendi võltsimine.
 * Kui esimene on juba teele asunud, jääb tema kirje talle ja asendus peab
 * olema uus külastus.
 */
export async function reassignVisit(
  managerUserId,
  { organizationId, visitId, toWorkerUserId, reason = null } = {},
  { db = prisma, env = process.env, now = new Date() } = {}
) {
  assertServiceLogEnabled(env);
  if (!organizationId || !visitId || !toWorkerUserId) throw badRequest("service_log.errors.invalid_input");

  const visit = await db.serviceVisit.findFirst({
    where: { id: String(visitId) },
    select: {
      id: true,
      status: true,
      ownerUserId: true,
      assignedOrganizationId: true,
      clientDisplayName: true,
      clientExternalRef: true,
      address: true,
      addressLat: true,
      addressLng: true,
      addressAdsId: true,
      plannedStartAt: true,
      note: true
    }
  });
  if (!visit) throw notFound();
  /**
   * VÕÕRA MAJA TÖÖ ON OLEMATU TÖÖ (SOL-SLOG-18).
   *
   * See kontroll on ENNE olekukontrolli ja ENNE õiguste kontrolli, ja vastus on
   * **404, mitte 403**: 403 ütleks välja, et selline külastus on olemas, ning
   * juba see on info teise organisatsiooni töö kohta. Konflikt („töö on juba
   * alustatud") ütleks veel rohkem.
   *
   * `NULL` päritolu (töötaja enda lisatud, ühemõtteliselt sidumata töö) langeb
   * samasse harusse: juht ei liiguta tööd, mille päritolu ei ole tõendatud.
   */
  if (!belongsToOrganization(visit, organizationId)) throw notFound();
  if (visit.status !== VISIT_STATUS.PLANNED) throw conflict("service_log.errors.visit_started");

  /* MÕLEMAD PEAVAD OLEMA MINU SKOOBIS. Ainult sihtmärgi kontrollimine lubaks
     võtta töö ära kellegi teise üksusest. */
  await assertCanAssign(managerUserId, organizationId, visit.ownerUserId, { db, now });
  const target = await assertCanAssign(managerUserId, organizationId, toWorkerUserId, { db, now });
  if (visit.ownerUserId === toWorkerUserId) return serializeVisit(visit);

  const profile = await resolveWorkerProfile(toWorkerUserId, { db });
  const route = await openRoute(toWorkerUserId, { now }, { db });

  const last = await db.serviceVisit.findFirst({
    where: { routeId: route.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });

  /**
   * LIIGUTUS JA JÄLG ÜHES TEHINGUS (SOL-SLOG-18 kriteerium).
   *
   * Varem oli audit `.catch(() => {})` taga: töö võis liikuda ühelt inimeselt
   * teisele nii, et „kes selle ära viis" jäi kirjutamata. Kui jälge ei saa
   * kirjutada, siis tööd ei liigutata — nii on kaks vastust („liikus ja on
   * jälg" / „ei liikunud") ja mitte kolmandat.
   *
   * Päritolu (`assignedOrganizationId`) siin EI MUUDETA: töö jääb sellele
   * majale, kelle oma ta on, ja liigub ainult inimeselt inimesele.
   */
  const moved = await db.$transaction(async (tx) => {
    const updated = await tx.serviceVisit.update({
      where: { id: visit.id },
      data: {
        providerProfileId: profile.id,
        routeId: route.id,
        ownerUserId: toWorkerUserId,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        /* PÕHJUS JÄÄB KIRJE KÜLGE, mitte ainult auditisse: töötaja, kelle päevast
           töö kadus, näeb ka ise, miks. */
        outcomeReason: text(reason, 500)
      }
    });
    await writeOrgAudit(tx, {
      actorUserId: managerUserId,
      targetUserId: toWorkerUserId,
      action: OrgAuditAction.SERVICE_VISIT_REASSIGNED,
      resourceType: OrgAuditResource.SERVICE_VISIT,
      resourceId: visit.id,
      meta: { organizationId, fromUserId: visit.ownerUserId, membershipId: target.id }
    });
    return updated;
  });

  return serializeVisit(moved);
}

/** Kellele saab tööd määrata — juhi skoobi aktiivsed liikmed. */
export async function listAssignableWorkers(
  managerUserId,
  organizationId,
  { db = prisma, now = new Date() } = {}
) {
  const scope = await resolveBoardScope(managerUserId, organizationId, { db, now });
  if (!scope.allowed) return [];

  const rows = await db.organizationMembership.findMany({
    where: {
      organizationId,
      status: OrganizationMembershipStatus.ACTIVE,
      ...(scope.wholeOrg ? {} : { units: { some: { unitId: { in: scope.unitIds }, endedAt: null } } })
    },
    select: {
      id: true,
      userId: true,
      jobTitle: true,
      user: { select: { email: true, profile: { select: { firstName: true, lastName: true } } } }
    },
    take: 200
  });

  return rows.map((row) => ({
    userId: row.userId,
    membershipId: row.id,
    jobTitle: row.jobTitle || null,
    name:
      [row.user?.profile?.firstName, row.user?.profile?.lastName].filter(Boolean).join(" ").trim() ||
      row.user?.email ||
      ""
  }));
}

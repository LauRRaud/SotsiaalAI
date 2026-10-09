/**
 * KODUTEENUS kiht 3, K3-e — hooldaja teade „Mul on takistus" (kava II.6.10).
 *
 * Hooldaja teatab ise, et tema tänane päev ei lähe plaani järgi. Hooldusjuht näeb teadet
 * päevaplaanis (`dayPlan.js`) koos selle töötaja tegemata käikudega tähtsuse järjekorras
 * (A, B, C) ja otsustab, mida ümber tõsta või ära jätta; siis märgib teate vaadatuks.
 * Teate „ei saa täna töötada" juurest saab ta samas märkida selleks päevaks puudumise.
 *
 * MIDA EI HOITA. Ainult liik viiest valikust. Vaba teksti välja ei ole ja põhjust
 * lähemalt ei küsita: see oleks sageli terviseandmed.
 *
 * TEADE ISE MIDAGI EI MUUDA. Käike ei tõsteta ega jäeta ära ja puudumist ei teki enne,
 * kui hooldusjuht seda teeb: hooldaja teade on info, otsus on hooldusjuhi oma.
 *
 * Teatab hooldaja (inimene, kes on mõne kliendi meeskonnas) ja ainult tänase päeva
 * kohta. Korraga on tal üks lahtine teade: uus võtab eelmise tagasi. Vaadatud teadet
 * tagasi võtta ei saa; kui midagi muutus, teatab ta uuesti.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";

import { markAbsentWithin } from "./absences.js";
import { assertHomeCareContext, coordinatorScope, membershipDisplayName, organizationTimeZone } from "./access.js";
import { CARE_OBSTACLE_KINDS, CareObstacleKind, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { todayText } from "./decisions.js";
import { notifyCoordinatorsOfObstacle } from "./notify.js";
import { asObject, normalizeEnum, normalizeId } from "./validation.js";

const OBSTACLE_SELECT = Object.freeze({
  id: true,
  membershipId: true,
  day: true,
  kind: true,
  createdAt: true,
  withdrawnAt: true,
  handledAt: true,
  handledByName: true
});

/** Töötaja enda vaade teatele: liik, millal teatas ja kas hooldusjuht on selle üle vaadanud. */
function serializeMine(row) {
  return row ? { id: row.id, kind: row.kind, reportedAt: row.createdAt.toISOString(), handled: Boolean(row.handledAt) } : null;
}

async function writeObstacleAudit(tx, context, obstacleId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_OBSTACLE_CHANGED,
    resourceType: OrgAuditResource.CARE_OBSTACLE,
    resourceId: obstacleId,
    meta: { organizationId: context.organization.id, obstacleId, change }
  });
}

/** Töötaja selle päeva viimane teade, mis ei ole tagasi võetud (lahtine või vaadatud). */
export async function loadMyObstacle(db, organizationId, membershipId, day) {
  if (!membershipId) return null;
  const row = await db.careObstacle.findFirst({
    where: { organizationId, membershipId, day, withdrawnAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: OBSTACLE_SELECT
  });
  return serializeMine(row);
}

/** Päevaplaani jaoks: selle päeva teated, mis ei ole tagasi võetud; iga töötaja kohta viimane. */
export async function loadObstaclesOfDay(db, organizationId, day) {
  const rows = await db.careObstacle.findMany({
    where: { organizationId, day, withdrawnAt: null },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: OBSTACLE_SELECT,
    take: HOME_CARE_LIMITS.OBSTACLES_DAY_MAX
  });
  const latest = new Map();
  for (const row of rows) latest.set(row.membershipId, row);
  return [...latest.values()];
}

/**
 * Hooldaja teatab takistusest. Sama liigi kordus lahtise teate peale uut rida ega uut
 * teavitust ei tee (topeltvajutus, kordussaatmine); teine liik võtab eelmise lahtise
 * teate tagasi ja teeb uue.
 */
export async function reportObstacle(
  context,
  input = {},
  { db = prisma, now = new Date(), env = process.env, notify = notifyCoordinatorsOfObstacle } = {}
) {
  assertHomeCareContext(context, { env });
  const kind = normalizeEnum(asObject(input).kind, CARE_OBSTACLE_KINDS, "home_care.errors.obstacle_kind_required");
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id || null;
  const day = todayText(now, organizationTimeZone(context));

  let result;
  try {
    result = await db.$transaction(async (tx) => {
      /* Teatada saab hooldaja: inimene, kes on praegu mõne kliendi meeskonnas. */
      const onTeam = membershipId
        ? await tx.careClientTeamMember.findFirst({ where: { membershipId, endedAt: null, client: { organizationId } }, select: { id: true } })
        : null;
      if (!onTeam) throw forbidden("home_care.errors.obstacle_not_worker");

      const open = await tx.careObstacle.findFirst({
        where: { organizationId, membershipId, day, withdrawnAt: null, handledAt: null },
        select: OBSTACLE_SELECT
      });
      if (open?.kind === kind) return { row: open, created: false };
      if (open) {
        await tx.careObstacle.updateMany({ where: { id: open.id, withdrawnAt: null, handledAt: null }, data: { withdrawnAt: now } });
        await writeObstacleAudit(tx, context, open.id, "withdrawn");
      }
      const row = await tx.careObstacle.create({
        data: { organizationId, membershipId, day, kind, createdAt: now },
        select: OBSTACLE_SELECT
      });
      await writeObstacleAudit(tx, context, row.id, "reported");
      return { row, created: true };
    });
  } catch (error) {
    /* Kaks samaaegset teadet: lahtise teate kordumatus hoiab teise eemal. */
    if (error?.code === "P2002") throw conflict("home_care.errors.obstacle_busy");
    throw error;
  }
  if (result.created && notify) await notify({ obstacleId: result.row.id, organizationId, membershipId }, { db, now });
  return { obstacle: serializeMine(result.row) };
}

/** Hooldaja võtab oma lahtise teate tagasi („takistus on möödas"). Vaadatud teadet tagasi võtta ei saa. */
export async function withdrawObstacle(context, obstacleId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(obstacleId, "home_care.errors.obstacle_not_found");
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id || null;

  return db.$transaction(async (tx) => {
    const row = membershipId
      ? await tx.careObstacle.findFirst({ where: { id, organizationId, membershipId }, select: OBSTACLE_SELECT })
      : null;
    if (!row) throw notFound("home_care.errors.obstacle_not_found");
    if (row.handledAt) throw conflict("home_care.errors.obstacle_handled");
    if (!row.withdrawnAt) {
      const result = await tx.careObstacle.updateMany({ where: { id, withdrawnAt: null, handledAt: null }, data: { withdrawnAt: now } });
      if (result.count !== 1) throw conflict("home_care.errors.obstacle_handled");
      await writeObstacleAudit(tx, context, id, "withdrawn");
    }
    return { obstacle: await loadMyObstacle(tx, organizationId, membershipId, row.day) };
  });
}

/**
 * Hooldusjuht märgib teate vaadatuks. Teate „ei saa täna töötada" juurest saab ta samas
 * märkida töötajale selleks päevaks ootamatu puudumise (`markAbsent`); siis lähevad
 * töötaja tegemata käigud päevaplaanis rühma „tegija puudub". Tagastab päeva, mille
 * plaani kutsuja uuesti loeb.
 */
export async function handleObstacle(context, obstacleId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  if (!coordinatorScope(context)) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  const id = normalizeId(obstacleId, "home_care.errors.obstacle_not_found");
  const markAbsent = asObject(input).markAbsent === true;
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const row = await tx.careObstacle.findFirst({ where: { id, organizationId }, select: OBSTACLE_SELECT });
    if (!row) throw notFound("home_care.errors.obstacle_not_found");
    if (row.withdrawnAt) throw conflict("home_care.errors.obstacle_withdrawn");
    if (markAbsent && row.kind !== CareObstacleKind.CANNOT_WORK) throw badRequest("home_care.errors.obstacle_absence_invalid");
    if (!row.handledAt) {
      const result = await tx.careObstacle.updateMany({
        where: { id, withdrawnAt: null, handledAt: null },
        data: {
          handledAt: now,
          handledByMembershipId: context.membership?.id || null,
          handledByName: await membershipDisplayName(tx, context)
        }
      });
      /* Töötaja võttis teate samal hetkel tagasi. */
      if (result.count !== 1) throw conflict("home_care.errors.obstacle_withdrawn");
      await writeObstacleAudit(tx, context, id, "handled");
    }
    if (markAbsent) await markAbsentWithin(tx, context, row.membershipId, row.day);
    return { day: row.day };
  });
}

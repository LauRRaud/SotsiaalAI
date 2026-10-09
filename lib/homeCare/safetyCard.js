/**
 * KODUTEENUS K5-n — ohutuskaart: kodu kui töökoht (kava II.6.4).
 *
 * Hooldaja töötab üksi võõras kodus: lahtine koer, ahi, järsk trepp, levi puudub.
 * Püsikaardi vabad ohuread sõltuvad sellest, mis kellelgi meelde tuli. Ohutuskaart KÜSIB
 * kümme asja üle; iga vastus on jah või ei ja soovi korral lühike märkus. Sõnastus on
 * faktipõhine („koer on õues lahti"), mitte hinnang inimese kohta: klient võib kaarti
 * näha ja see ei lähe pere vaatesse.
 *
 * Kaarti täidavad kliendi meeskond ja hooldusjuht (nagu püsikaarti); loeb igaüks, kes
 * tohib kliendi lehte avada: just asendaja peab seda enne minekut nägema. Üle vaadatakse
 * kord aastas. Ridu ei muudeta ega kustutata: uus vastus lõpetab eelmise.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, forbidden } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, organizationTimeZone, requireClientAccess } from "./access.js";
import { CARE_SAFETY_ANSWERS, CARE_SAFETY_TOPICS, CareClientStatus, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { asObject, normalizeId, normalizeLine } from "./validation.js";

const topicOrder = (topic) => CARE_SAFETY_TOPICS.indexOf(topic);

/**
 * Sisend on `{ items: { ANIMALS: { answer: "YES", note: "…" }, … } }`. Puuduv teema jääb
 * puutumata; tühi vastus võtab teema maha. Märkus ilma vastuseta on viga. Puhas funktsioon.
 */
export function normalizeSafetyCard(rawInput) {
  const items = asObject(asObject(rawInput).items);
  const result = {};
  for (const topic of Object.keys(items)) {
    if (!CARE_SAFETY_TOPICS.includes(topic)) throw badRequest("home_care.errors.safety_topic_invalid");
    const item = asObject(items[topic]);
    const answer = item.answer === undefined || item.answer === null || item.answer === "" ? null : item.answer;
    if (answer !== null && !CARE_SAFETY_ANSWERS.includes(answer)) throw badRequest("home_care.errors.safety_answer_invalid");
    const note = normalizeLine(item.note, HOME_CARE_LIMITS.SAFETY_NOTE_MAX) || null;
    if (!answer && note) throw badRequest("home_care.errors.safety_answer_required");
    result[topic] = { answer, note };
  }
  return result;
}

/** Kaardi seis: millal viimati hinnati ja kas on aeg üle vaadata. Puhas funktsioon. */
export function safetyReviewState(assessedOn, today) {
  if (!assessedOn) return { days: null, due: false };
  const days = daysBetween(assessedOn, today);
  return { days, due: days > HOME_CARE_LIMITS.SAFETY_REVIEW_DAYS };
}

/** Kliendi kehtiv ohutuskaart teemade kindlas järjekorras; `assessedOn` on vanima kehtiva vastuse päev. */
export async function loadSafetyCardWithin(tx, clientId, { today, timeZone }) {
  const rows = await tx.careSafetyItem.findMany({
    where: { clientId, endedAt: null },
    select: { id: true, topic: true, answer: true, note: true, createdByName: true, createdAt: true }
  });
  const items = rows
    .sort((a, b) => topicOrder(a.topic) - topicOrder(b.topic))
    .map((row) => ({ topic: row.topic, answer: row.answer, note: row.note || null, byName: row.createdByName || "", on: todayText(row.createdAt, timeZone) }));
  /* Ülevaatus loetakse VANIMA vastuse järgi: üks värske vastus ei tee kogu kaarti värskeks. */
  const assessedOn = items.length ? items.map((item) => item.on).sort()[0] : null;
  return { items, assessedOn, reviewDue: safetyReviewState(assessedOn, today).due };
}

/** Salvestab muutunud teemad: eelmine vastus lõpeb ja uus tekib. Muutmata vastus ei tee midagi. */
export async function saveSafetyCard(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const wanted = normalizeSafetyCard(input);
  const timeZone = organizationTimeZone(context);
  const today = todayText(now, timeZone);

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { lock: true, now });
    /* Põhjusega avaja loeb, aga kaarti ei muuda. */
    if (!access.isCoordinator && !access.isTeam) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });

    const current = new Map((await loadSafetyCardWithin(tx, id, { today, timeZone })).items.map((item) => [item.topic, item]));
    const changed = Object.keys(wanted).filter((topic) => {
      const old = current.get(topic);
      return (old?.answer || null) !== wanted[topic].answer || (old?.note || null) !== wanted[topic].note;
    });
    if (!changed.length) return { safety: await loadSafetyCardWithin(tx, id, { today, timeZone }) };

    const membershipId = context.membership?.id || null;
    const createdByName = await membershipDisplayName(tx, context);
    await tx.careSafetyItem.updateMany({ where: { clientId: id, endedAt: null, topic: { in: changed } }, data: { endedAt: now, endedByMembershipId: membershipId } });
    const fresh = changed.filter((topic) => wanted[topic].answer);
    if (fresh.length) {
      await tx.careSafetyItem.createMany({
        data: fresh.map((topic) => ({
          organizationId: context.organization.id,
          clientId: id,
          topic,
          answer: wanted[topic].answer,
          note: wanted[topic].note,
          createdByMembershipId: membershipId,
          createdByName,
          createdAt: now
        }))
      });
    }
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_SAFETY_CARD_CHANGED,
      resourceType: OrgAuditResource.CARE_CLIENT,
      resourceId: id,
      meta: { organizationId: context.organization.id, clientId: id, change: "saved" }
    });
    return { safety: await loadSafetyCardWithin(tx, id, { today, timeZone }) };
  });
}

/**
 * Tähtaegade lehele: teenusel olevad kliendid, kelle ohutuskaart on täitmata (`NONE`) või
 * kelle vanim vastus on üle aasta vana (`OLD`). Vanad enne, siis täitmata, nime järgi.
 */
export async function loadSafetyDue(db, organizationId, clientWhere, { today, timeZone }) {
  const rows = await db.careClient.findMany({
    where: { organizationId, status: CareClientStatus.ACTIVE, ...clientWhere },
    select: { id: true, displayName: true, status: true, safetyItems: { where: { endedAt: null }, select: { createdAt: true } } },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX
  });
  const due = [];
  for (const row of rows) {
    const client = { id: row.id, displayName: row.displayName, status: row.status };
    if (!row.safetyItems.length) {
      due.push({ client, state: "NONE", assessedOn: null, days: null });
      continue;
    }
    const assessedOn = row.safetyItems.map((item) => todayText(item.createdAt, timeZone)).sort()[0];
    const state = safetyReviewState(assessedOn, today);
    if (state.due) due.push({ client, state: "OLD", assessedOn, days: state.days });
  }
  return due.sort((a, b) => (a.state === "OLD" ? 0 : 1) - (b.state === "OLD" ? 0 : 1) || (b.days ?? 0) - (a.days ?? 0) || a.client.displayName.localeCompare(b.client.displayName, "et"));
}

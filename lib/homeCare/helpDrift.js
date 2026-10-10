/**
 * KODUTEENUS K6-d — abi rohkem või vähem kui kavas (kava II.6.2 ja II.6.13).
 *
 * Hoolduskava ütleb iga toimingu juures, kuidas seda tehakse: inimene teeb ise ja hooldaja
 * juhendab, tehakse koos, hooldaja aitab osaliselt või teeb inimese eest. Käigu kirjes on
 * vaikimisi kava viis; hooldaja muudab seda ainult siis, kui täna läks teisiti. Just see
 * erinevus on märk: kui mitmel käigul järjest tuleb teha inimese eest seda, mida kava järgi
 * tehti koos, on abivajadus kasvanud ja otsustaja peab sellest teadma.
 *
 * Siin loetakse viimase nelja nädala TEHTUD kava toimingud kokku ja võrreldakse käigul
 * märgitud viisi kava rea viisiga (rea enda viis kirje tegemise ajal, mitte praegune kava).
 * Kavaväliseid toiminguid ei loeta: neil ei ole millegagi võrrelda. Tulemus on arv, mitte
 * hinnang: mida sellega teha, otsustab hooldusjuht.
 */

import { CARE_PLAN_MODES, CareActivityOutcome, CareClientStatus, HOME_CARE_LIMITS } from "./constants.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const LEVEL = new Map(CARE_PLAN_MODES.map((mode, index) => [mode, index]));

/**
 * `rows`: `{ mode, planMode }`. Tagastab, mitu toimingut tehti kokku, mitu kavast suurema ja
 * mitu väiksema abiga. Tundmatu viisiga rida jäetakse välja. Puhas funktsioon.
 */
export function helpDrift(rows) {
  let total = 0;
  let more = 0;
  let less = 0;
  for (const row of rows || []) {
    const done = LEVEL.get(row.mode);
    const planned = LEVEL.get(row.planMode);
    if (done === undefined || planned === undefined) continue;
    total += 1;
    if (done > planned) more += 1;
    if (done < planned) less += 1;
  }
  return { total, more, less };
}

/** Kas suurema abiga toiminguid on nii palju, et hooldusjuht peaks kava üle vaatama. Puhas funktsioon. */
export function helpDriftDue({ total, more }) {
  return more >= HOME_CARE_LIMITS.HELP_DRIFT_MIN && total > 0 && more / total >= HOME_CARE_LIMITS.HELP_DRIFT_SHARE;
}

function windowOf(now) {
  return { gte: new Date(now.getTime() - HOME_CARE_LIMITS.HELP_DRIFT_DAYS * DAY_MS), lte: now };
}

const DONE_PLAN_ACTIVITY = { outcome: CareActivityOutcome.DONE, planLineId: { not: null } };

/** Kliendi viimase nelja nädala näit kliendi lehele ja teate arvudesse; `null`, kui kava toiminguid ei tehtud. */
export async function loadHelpDriftWithin(tx, clientId, now) {
  const rows = await tx.careEntryActivity.findMany({
    where: { clientId, ...DONE_PLAN_ACTIVITY, entry: { retractedAt: null, occurredAt: windowOf(now) } },
    select: { mode: true, planLine: { select: { mode: true } } },
    take: HOME_CARE_LIMITS.HELP_DRIFT_ROWS_MAX
  });
  const figure = helpDrift(rows.map((row) => ({ mode: row.mode, planMode: row.planLine?.mode })));
  return figure.total ? { days: HOME_CARE_LIMITS.HELP_DRIFT_DAYS, ...figure, due: helpDriftDue(figure) } : null;
}

/** Tähtaegade vaatele: teenusel olevad kliendid, kellel suurema abiga toiminguid on üle piiri; suurem osakaal ees. */
export async function loadHelpDriftDue(db, organizationId, clientWhere, now) {
  const rows = await db.careEntryActivity.findMany({
    where: {
      organizationId,
      ...DONE_PLAN_ACTIVITY,
      entry: { retractedAt: null, occurredAt: windowOf(now), client: { status: { in: [CareClientStatus.ACTIVE, CareClientStatus.AWAY] }, ...clientWhere } }
    },
    select: { clientId: true, mode: true, planLine: { select: { mode: true } } },
    take: HOME_CARE_LIMITS.HELP_DRIFT_ROWS_MAX
  });
  const byClient = new Map();
  for (const row of rows) {
    if (!byClient.has(row.clientId)) byClient.set(row.clientId, []);
    byClient.get(row.clientId).push({ mode: row.mode, planMode: row.planLine?.mode });
  }
  const due = [...byClient.entries()].map(([clientId, list]) => ({ clientId, ...helpDrift(list) })).filter(helpDriftDue);
  if (!due.length) return [];
  const clients = await db.careClient.findMany({ where: { organizationId, id: { in: due.map((item) => item.clientId) } }, select: { id: true, displayName: true, status: true } });
  const clientOf = new Map(clients.map((row) => [row.id, row]));
  return due
    .filter((item) => clientOf.has(item.clientId))
    .map((item) => ({ client: clientOf.get(item.clientId), total: item.total, more: item.more }))
    .sort((a, b) => b.more / b.total - a.more / a.total || a.client.displayName.localeCompare(b.client.displayName, "et"));
}

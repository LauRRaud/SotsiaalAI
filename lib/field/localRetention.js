/**
 * FIELD-V1 — SEADME KOHALIK SÄILITUS (doc 4.5 / O-FD-1, SOL-FIELD-01).
 *
 * MIKS SEE ON OMA MOODUL, MITTE HOOGI SEES. Poliitika elas `useFieldSync.js`-i
 * `useCallback`-i sees ja seetõttu ei olnud teda võimalik mõõta ilma Reactita
 * ja ilma IndexedDB-ta. Ainus asi, mida sai testida, oli PUHAS otsus — ja just
 * see jättis leidu nähtamatuks: otsus oli õige, aga teda TOITEV loendur luges
 * vale asja.
 *
 * KAKS ROLLI, MIDA EI TOHI SEGADA:
 *   - TAUSTAKÄIK (`runFieldLocalRetention`) kustutab ainult seda, mille
 *     kustutamiseks on luba olemas. Ta EI KASVATA hoiatuste loendurit.
 *   - INIMENE (`acknowledgeFieldWarning`, `confirmFieldPurge`) kinnitab, et
 *     ta nägi hoiatust, ja hiljem, et ta lubab kustutada.
 *
 * Vana kood ühendas need kaks: taustakäik kasvatas loendurit, mida keegi ei
 * kuvanud, ja kolmas käik andis kustutusloa. „Kolm hoiatust" tähendas
 * päriselt „rakendus avati kolmel eri päeval".
 */

import {
  FIELD_UNSENT_WARNINGS_REQUIRED,
  FieldPurgeDecision,
  fieldItemPurgeDecision,
  fieldPurgeAwaitingConfirmation,
  fieldWarningDue
} from "./syncMachine.js";

/**
 * Üks säilituskäik.
 *
 * @returns `{ purged, warned, awaitingConfirmation }` — `warned` on nende
 *   kirjete loend, mida kasutajale PEAB näitama; taustakäik ise ei loe neid
 *   hoiatusteks.
 */
export async function runFieldLocalRetention({ store, now = new Date() } = {}) {
  const result = { purged: [], warned: [], awaitingConfirmation: [] };
  if (!store?.listItems) return result;

  const list = await store.listItems({});
  for (const item of list) {
    const decision = fieldItemPurgeDecision(item, now);
    if (decision === FieldPurgeDecision.PURGE) {
      await store.deleteItem(item.clientItemId);
      result.purged.push(item.clientItemId);
      continue;
    }
    if (decision !== FieldPurgeDecision.WARN) continue;

    /* Hoiatus on NÄHTAV OLEK, mitte kirjutus. Taustakäik ainult NIMETAB, keda
       näidata — loenduri liigutab inimene, kes hoiatust päriselt nägi. */
    if (fieldPurgeAwaitingConfirmation(item, now)) result.awaitingConfirmation.push(item);
    else if (fieldWarningDue(item, now)) result.warned.push(item);
  }
  return result;
}

/**
 * Inimene kinnitab, et NÄGI hoiatust.
 *
 * Ööpäevane vahe on lepingu oma (`fieldWarningDue`): kolm nuppuvajutust ühe
 * minuti jooksul ei ole kolm hoiatust. Kinnitus, mis ei ole veel „ette nähtud",
 * ei tee midagi — ja see EI OLE vaikne edu, vaid vastus „ei olnud mida kinnitada".
 */
export async function acknowledgeFieldWarning({ store, clientItemId, now = new Date() } = {}) {
  if (!store?.getItem || !clientItemId) return null;
  const item = await store.getItem(clientItemId);
  if (!item) return null;
  if (!fieldWarningDue(item, now)) return item;

  const updated = {
    ...item,
    warnCount: Number(item.warnCount || 0) + 1,
    lastWarnAt: now.toISOString()
  };
  await store.putItem(updated);
  return updated;
}

/**
 * Inimene lubab kustutada.
 *
 * KOLM NÄHTUD HOIATUST EI OLE LUBA. Nad ütlevad „ma tean, et see kaob";
 * kinnitus ütleb „kustuta". Ilma selleta jääb sisu alles — vaikimisi ALLES,
 * mitte vaikimisi kustutatud.
 */
export async function confirmFieldPurge({ store, clientItemId, now = new Date() } = {}) {
  if (!store?.getItem || !clientItemId) return null;
  const item = await store.getItem(clientItemId);
  if (!item) return null;
  if (Number(item.warnCount || 0) < FIELD_UNSENT_WARNINGS_REQUIRED) return item;
  if (!fieldPurgeAwaitingConfirmation(item, now)) return item;

  const updated = { ...item, purgeConfirmedAt: now.toISOString() };
  await store.putItem(updated);
  return updated;
}

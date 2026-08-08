/**
 * JTA-V1 (E5/E6) — STAR2 mustandi olekusiirde SISEMINE PRIMITIIV.
 *
 * MIKS OMA MODUUL. Leping (L19) nõuab kaht asja korraga: primitiiv ei tohi olla
 * `caseWorkDraft.js` avalik eksport, JA teda peab saama kutsuda E6
 * `markTransferred()` teisest moodulist. Mõlemat korraga ei saa ühe faili sees
 * — seega elab ta siin, ja fail ise ütleb, et ta on primitiiv.
 *
 * KUTSUJAID ON TÄPSELT KAKS ja kolmandat ei tohi tekkida:
 *
 *   `transitionDraft()`   — kõik siirded PEALE `ULE_KANTUD`-i
 *   `markTransferred()`   — ainus tee `ULE_KANTUD`-ini, koos auditireaga (E6)
 *
 * Iga uus kutsuja on uus uks olekumasinasse. Seda kontrollib test, mitte see
 * kommentaar.
 */

import {
  canTransitionStar2,
  isStar2ReviewKind,
  isStar2TransferState,
  STAR2_TRANSFER_STATE
} from "@/lib/workspaces/provenance";

import { badRequest, conflict } from "./errors.js";

function normalizeId(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeReviewKind(value) {
  if (value === undefined || value === null || value === "") return null;
  const kind = normalizeId(value);
  if (!isStar2ReviewKind(kind)) throw badRequest("casework.errors.review_kind_unknown");
  return kind;
}

/**
 * Tingimuslik olekusiire tehingu sees.
 *
 * KOLM SAMMU, IGAÜHEL OMA VASTUTUS:
 *   1. `canTransitionStar2()` — aus **400** tundmatu või ebaseadusliku sihi peale
 *   2. tingimuslik `updateMany` — **409**, kui keegi jõudis ette (L6). Andmebaas
 *      ei oska ÜLEMINEKUT kontrollida, ainult väärtust; jõustaja on see `WHERE`
 *   3. `ULE_KANTUD` → `transferredAt` SAMAS tehingus (DB CHECK nõuab teda, ja
 *      L7 säilituskell käib täpselt sellest väljast)
 *
 * @param {object} tx tehingu klient
 */
export async function transitionDraftStateTx(tx, { draftId, expectedFrom, to, reviewKind = undefined }) {
  const from = normalizeId(expectedFrom);
  const target = normalizeId(to);

  if (!isStar2TransferState(from) || !isStar2TransferState(target)) {
    throw badRequest("casework.errors.transfer_state_unknown");
  }
  if (!canTransitionStar2(from, target)) throw badRequest("casework.errors.transfer_transition_illegal");

  const data = { transferState: target };

  /* `reviewKind` on AINULT `VAJAB_KONTROLLI` täpsustus. Igal muul siirdel ta
     NULLITAKSE — vastasel juhul jääks „kontrolliti kliendiga" märge rippuma
     mustandi külge, mis on ammu edasi liikunud, ja lugeja usuks teda. */
  data.reviewKind = target === STAR2_TRANSFER_STATE.VAJAB_KONTROLLI ? normalizeReviewKind(reviewKind) : null;

  if (target === STAR2_TRANSFER_STATE.ULE_KANTUD) data.transferredAt = new Date();

  const result = await tx.caseWorkDraft.updateMany({
    where: { id: draftId, transferState: from },
    data
  });
  if (!result?.count) throw conflict("casework.errors.transfer_state_conflict");
  return true;
}

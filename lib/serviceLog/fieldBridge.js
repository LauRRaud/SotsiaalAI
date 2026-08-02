/**
 * TEENUSPÄEVIK E2 — sild Välitöö külastuselt teenuskirjele.
 *
 * MIKS SILD, MITTE AUTOMAATIKA (leping 8.4): külastus ei ole alati arveldatav
 * teenus, ja automaatne kirje tähendaks, et ARVE ALUSDOKUMENT tekib ilma
 * inimese kinnituseta. Sild eeltäidab, inimene kinnitab.
 *
 * TULETAMINE ELAB SERVERIS. `buildEntryDraftFromFieldVisit` oli olemas juba
 * E2-st, aga teda ei kutsunud mitte keegi — pool integratsiooni, mis nägi
 * välja nagu terve. See moodul on see puuduv pool.
 *
 * SKOOP ON KAHEKORDNE ja mõlemad pooled on vajalikud:
 *   1. külastus peab olema KÜSIJA oma (`ownerUserId`);
 *   2. küsijal peab olema teenuseprofiil (`requireWritableProfile`).
 * Võõras külastus ja olematu külastus annavad MÕLEMAD 404 — sama reegel, mis
 * kogu ülejäänud teemas: vastusest ei tohi järeldada, et selline külastus on
 * olemas.
 */

import { prisma } from "@/lib/prisma";
import { assertServiceLogEnabled } from "./flags.js";
import { requireWritableProfile } from "./entries.js";
import { buildEntryDraftFromFieldVisit } from "./entryDerivation.js";
import { notFound } from "./errors.js";

const VISIT_SELECT = {
  id: true,
  arrivedConfirmedAt: true,
  departedConfirmedAt: true,
  plannedStartAt: true,
  closedAt: true,
  locationText: true
};

export async function getEntryDraftFromVisit(
  userId,
  visitId,
  { db = prisma, env = process.env } = {}
) {
  assertServiceLogEnabled(env);
  await requireWritableProfile(userId, { db });

  const id = String(visitId || "").trim();
  if (!id) throw notFound("service_log.errors.visit_not_found");

  const visit = await db.fieldVisit.findFirst({
    where: { id, ownerUserId: userId },
    select: VISIT_SELECT
  });
  if (!visit) throw notFound("service_log.errors.visit_not_found");

  const draft = buildEntryDraftFromFieldVisit(visit);
  if (!draft) throw notFound("service_log.errors.visit_not_found");

  return {
    ...draft,
    /* Asukohatekst tuleb KAASA eraldi väljana, mitte kirjesse: teenuskirjel ei
       ole veel aadressivälja (see on lahtine tooteotsus) ja märkusesse
       kirjutamine teeks temast vaikselt vaba teksti, mida hiljem ei saa
       struktuurina kätte. Kutsuja võib teda kuvada, aga ei pea salvestama. */
    locationText: visit.locationText || null,
    /* Kestus võib puududa: külastus, mille kohta ei ole kinnitatud saabumist ja
       lahkumist, ei anna kogust. See EI OLE viga — inimene kirjutab koguse ise
       ja UI peab talle seda ütlema, mitte tühja välja jätma. */
    hasDuration: Boolean(draft.arrivedAt && draft.leftAt)
  };
}

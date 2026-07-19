import { prisma as defaultPrisma } from "../prisma.js";
import { createNotificationEvent, NOTIFICATION_EVENT_TYPES } from "../notifications.js";

/* WB-V2-P2 kontrollpunkt: „järgmine samm + kontrollkuupäev" ja hiljem „kas pidas?".

   Kandev piir (ptk 3.4 p2, W-INV-4): vahelejätmine on VÕRDVÄÄRNE tulemus.
   Siin ei ole loendurit, striiki, „võlga" ega skoori — kolm ausat olekut ja
   kõik. Möödunud kontrollpunkt ei kuhju ega muutu punaseks; ta lihtsalt ootab
   vastust või jääb vastuseta. Kui keegi tahab siia hiljem „X nädalat järjest"
   lisada, on see W-INV-4 rikkumine, mitte funktsioon. */
export const CHECKPOINT_FOLLOW_UP_STATES = Object.freeze(["kept", "not_kept", "unclear"]);

const MAX_NEXT_STEP_LENGTH = 500;

function requireUserId(userId) {
  const normalized = String(userId || "").trim();
  if (!normalized) {
    const error = new Error("wellbeing.errors.unauthorized");
    error.status = 401;
    throw error;
  }
  return normalized;
}

function requireRecordId(recordId) {
  const normalized = String(recordId || "").trim();
  if (!normalized) {
    const error = new Error("wellbeing.errors.record_missing");
    error.status = 400;
    throw error;
  }
  return normalized;
}

function parseDueOn(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const error = new Error("wellbeing.errors.checkpoint_due_invalid");
    error.status = 400;
    throw error;
  }
  return date;
}

function normalizeNextStep(value) {
  const text = String(value ?? "").trim();
  if (!text) {
    const error = new Error("wellbeing.errors.checkpoint_step_missing");
    error.status = 400;
    throw error;
  }
  if (text.length > MAX_NEXT_STEP_LENGTH) {
    const error = new Error("wellbeing.errors.checkpoint_step_too_long");
    error.status = 400;
    error.details = { maxLength: MAX_NEXT_STEP_LENGTH };
    throw error;
  }
  return text;
}

/* Omanik-skoobitud kirjutus `updateMany`-ga: võõra või olematu kirje annab
   `count: 0` ilma viskamiseta, marsruut teeb sellest 404. Sama muster mis
   `deleteWellbeingRecordForUser` — olemasolu ei leki üle omanikupiiri. */
async function updateOwnedRecord(prisma, ownerUserId, id, data) {
  const result = await prisma.wellbeingRecord.updateMany({
    where: { id, ownerUserId },
    data
  });
  if (Number(result?.count) !== 1) {
    const error = new Error("wellbeing.errors.record_missing");
    error.status = 404;
    throw error;
  }
  return { updated: true };
}

export async function setWellbeingCheckpointForUser(userId, recordId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const id = requireRecordId(recordId);
  const prisma = options.prisma || defaultPrisma;
  const nextStep = normalizeNextStep(payload.nextStep);
  const dueOn = parseDueOn(payload.dueOn);
  const setAt = options.now instanceof Date ? options.now : new Date();

  /* Plaani muutmine nullib varasema järelmärke: „kas pidas?" käib konkreetse
     kokkuleppe kohta, mitte kirje kohta üldiselt. Vana vastus uue plaani küljes
     oleks vale. */
  return updateOwnedRecord(prisma, ownerUserId, id, {
    checkpointDueOn: dueOn,
    checkpoint: { nextStep, setAt: setAt.toISOString(), followUp: null }
  });
}

export async function clearWellbeingCheckpointForUser(userId, recordId, options = {}) {
  const ownerUserId = requireUserId(userId);
  const id = requireRecordId(recordId);
  const prisma = options.prisma || defaultPrisma;
  return updateOwnedRecord(prisma, ownerUserId, id, {
    checkpointDueOn: null,
    checkpoint: null
  });
}

export async function recordWellbeingCheckpointFollowUpForUser(userId, recordId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const id = requireRecordId(recordId);
  const prisma = options.prisma || defaultPrisma;
  const state = String(payload.state || "").trim();
  if (!CHECKPOINT_FOLLOW_UP_STATES.includes(state)) {
    const error = new Error("wellbeing.errors.checkpoint_follow_up_invalid");
    error.status = 400;
    error.details = { allowed: [...CHECKPOINT_FOLLOW_UP_STATES] };
    throw error;
  }

  const existing = await prisma.wellbeingRecord.findFirst({
    where: { id, ownerUserId },
    select: { checkpoint: true }
  });
  if (!existing) {
    const error = new Error("wellbeing.errors.record_missing");
    error.status = 404;
    throw error;
  }
  if (!existing.checkpoint) {
    const error = new Error("wellbeing.errors.checkpoint_missing");
    error.status = 409;
    throw error;
  }

  const notedAt = options.now instanceof Date ? options.now : new Date();
  return updateOwnedRecord(prisma, ownerUserId, id, {
    checkpoint: {
      ...existing.checkpoint,
      followUp: { state, notedAt: notedAt.toISOString() }
    }
  });
}

/* Soovituse „tehtud" olek elab `recommendedActions`-is (ptk 13 E3 p3), mitte
   kontrollpunktis: soovitus on kirje oma, kontrollpunkt on kasutaja kokkulepe.
   `workflowType` on turvaline identifikaator — kataloog on tema järgi
   võtmestatud, seega duplikaate ei teki. */
export async function markWellbeingRecommendationForUser(userId, recordId, payload = {}, options = {}) {
  const ownerUserId = requireUserId(userId);
  const id = requireRecordId(recordId);
  const prisma = options.prisma || defaultPrisma;
  const workflowType = String(payload.workflowType || "").trim();
  if (!workflowType) {
    const error = new Error("wellbeing.errors.recommendation_missing");
    error.status = 400;
    throw error;
  }
  const done = payload.done !== false;

  const existing = await prisma.wellbeingRecord.findFirst({
    where: { id, ownerUserId },
    select: { recommendedActions: true }
  });
  if (!existing) {
    const error = new Error("wellbeing.errors.record_missing");
    error.status = 404;
    throw error;
  }

  const actions = Array.isArray(existing.recommendedActions) ? existing.recommendedActions : [];
  let matched = false;
  const next = actions.map((action) => {
    if (action?.workflowType !== workflowType) return action;
    matched = true;
    /* `done: false` eemaldab märke, mitte ei kirjuta `false`-i sisse — nii jääb
       vana kirje kuju muutumatuks, kui kasutaja märke tagasi võtab. */
    if (!done) {
      const { doneAt: _doneAt, ...rest } = action;
      return rest;
    }
    const doneAt = options.now instanceof Date ? options.now : new Date();
    return { ...action, doneAt: doneAt.toISOString() };
  });
  if (!matched) {
    const error = new Error("wellbeing.errors.recommendation_not_found");
    error.status = 404;
    throw error;
  }

  return updateOwnedRecord(prisma, ownerUserId, id, { recommendedActions: next });
}

/* Puhas kirjeldaja: UI badge ja U1 taimer peavad „saabunud kontrollpunkti"
   ÜHTEMOODI otsustama, muidu läheks teavitus ja kuva lahku. Üks funktsioon,
   kaks tarbijat. */
export function describeWellbeingCheckpoint(record, now = new Date()) {
  const checkpoint = record?.checkpoint || null;
  const dueOn = record?.checkpointDueOn ? new Date(record.checkpointDueOn) : null;
  if (!checkpoint || !dueOn || Number.isNaN(dueOn.getTime())) {
    return { hasCheckpoint: false, dueOn: null, isDue: false, followUpState: null, needsFollowUp: false };
  }
  const followUpState = checkpoint.followUp?.state || null;
  const isDue = dueOn.getTime() <= now.getTime();
  return {
    hasCheckpoint: true,
    dueOn,
    isDue,
    followUpState,
    /* Badge tähendab „siin ootab sinu vastus", mitte „sa oled hiljaks jäänud". */
    needsFollowUp: isDue && !followUpState
  };
}

/* U1 taimeri allikas (E3). Indekseeritud skalaari peal, ilma JSON-skaneeringuta.
   `followUp`-i olekut EI saa SQL-is filtreerida ilma JSON-päringuta, seega
   filtreerime vastatud kontrollpunktid välja mälus — kandidaatide hulk on
   `checkpointDueOn` indeksi tõttu väike. */
export async function listDueWellbeingCheckpoints(options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const now = options.now instanceof Date ? options.now : new Date();
  const take = Math.min(Math.max(Number(options.take) || 200, 1), 1000);

  const candidates = await prisma.wellbeingRecord.findMany({
    where: { checkpointDueOn: { lte: now, not: null } },
    orderBy: { checkpointDueOn: "asc" },
    take
  });
  return candidates.filter((record) => describeWellbeingCheckpoint(record, now).needsFollowUp);
}

/* E3 (TO-2): saabunud kontrollpunkt → U1-sündmus omanikule.

   KOLM PIIRI, mis on tooteotsused, mitte tehnilised detailid:
   1. `emailPolicy: "NONE"` — e-kirja EI tule, ka mitte opt-in'i taga. TO-2.
      „NONE" tähendab `notify`-s, et `emailStatus` jääb NOT_REQUESTED ja ühtegi
      saatmiskatset ei planeerita. Ära muuda seda OPTIONAL-iks.
   2. Adressaat on ainult omanik ise (`assertNotificationRecipient` kontrollib
      seda üle ka siis, kui siinne kutse peaks eksima).
   3. Sisu ei kanta — sündmus viitab kirjele, ei ütle mida kasutaja vastas.

   Dedupe käib kontrollkuupäeva järgi, seega taimeri kordusjooks ei tekita uut
   teavitust. Uus plaan uue kuupäevaga tekitab uue — see on õige, sest tegemist
   on uue kokkuleppega. */
export async function emitDueWellbeingCheckpointNotifications(options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const now = options.now instanceof Date ? options.now : new Date();
  const due = await listDueWellbeingCheckpoints({ prisma, now, take: options.take });

  let created = 0;
  let skipped = 0;
  for (const record of due) {
    const dueOn = new Date(record.checkpointDueOn);
    try {
      const result = await createNotificationEvent({
        type: NOTIFICATION_EVENT_TYPES.WELLBEING_CHECKPOINT_DUE,
        userId: record.ownerUserId,
        sourceId: record.id,
        targetId: record.id,
        dedupeSuffix: dueOn.toISOString().slice(0, 10),
        emailPolicy: "NONE"
      }, { db: prisma, now });
      /* `createNotificationEvent` EI viska dubleerimisel — ta lahendab dedupe'i
         ise ja tagastab `created: false`. Loeme tema vastust, mitte viske
         puudumist, muidu näitaks taimer iga jooksu uusi teavitusi. */
      if (result?.created) created += 1;
      else skipped += 1;
    } catch (error) {
      /* Üks vigane kirje ei tohi kogu jooksu katkestada. */
      skipped += 1;
      console.error("[wellbeing] checkpoint notification failed", {
        recordId: record.id,
        message: error?.message
      });
    }
  }
  return { scanned: due.length, created, skipped };
}

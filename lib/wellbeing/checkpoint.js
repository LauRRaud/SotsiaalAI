import { prisma as defaultPrisma } from "../prisma.js";
import { createNotificationEvent, NOTIFICATION_EVENT_TYPES } from "../notifications.js";
import { CHECKPOINT_FOLLOW_UP_STATES, describeWellbeingCheckpoint } from "./checkpointState.js";
import { withWellbeingAdvisoryLock } from "./outputDraftLock.js";

/* WB-V2-P2 kontrollpunkt: „järgmine samm + kontrollkuupäev" ja hiljem „kas pidas?".
   Puhas olekuloogika (`CHECKPOINT_FOLLOW_UP_STATES`, `describeWellbeingCheckpoint`)
   elab `checkpointState.js`-is, et klient saaks sama otsuse ilma prismata; siit
   re-eksporditakse, nii et serveripoole imporditee ei muutu. */
export { CHECKPOINT_FOLLOW_UP_STATES, describeWellbeingCheckpoint };

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

/* SOL-WB-09: kontrollpunkti ja soovituse rajad on read-modify-write terve JSON-i
   peal. Ilma serialiseerimiseta kirjutab hiline kirjutaja vahepealse muudatuse
   vaikselt üle — UI näitab õnnestumist, kuigi teise toimingu tulemus kadus.
   Lukk on sama mehhanism, mis kirje loomisel ja parandusel juba kasutusel. */
function withCheckpointLock(prisma, recordId, callback) {
  return withWellbeingAdvisoryLock(prisma, `wellbeingRecord:checkpoint:${recordId}`, callback);
}

/* SOL-WB-09: kokkuleppel on IDENTITEET. Ilma temata ei saa eristada „vastan
   sellele plaanile" ja „vastan plaanile, mis vahepeal välja vahetati" — ja
   vastus läheks vaikselt uue, hoopis teise kokkuleppe külge. */
function nextCheckpointId(setAt) {
  return `cp_${setAt.getTime().toString(36)}_${Math.trunc(setAt.getTime() % 1000)}`;
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
  return withCheckpointLock(prisma, id, (tx) => updateOwnedRecord(tx, ownerUserId, id, {
    checkpointDueOn: dueOn,
    checkpointAnsweredAt: null,
    checkpoint: {
      id: nextCheckpointId(setAt),
      nextStep,
      setAt: setAt.toISOString(),
      followUp: null
    }
  }));
}

export async function clearWellbeingCheckpointForUser(userId, recordId, options = {}) {
  const ownerUserId = requireUserId(userId);
  const id = requireRecordId(recordId);
  const prisma = options.prisma || defaultPrisma;
  return withCheckpointLock(prisma, id, (tx) => updateOwnedRecord(tx, ownerUserId, id, {
    checkpointDueOn: null,
    checkpointAnsweredAt: null,
    checkpoint: null
  }));
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
  const expectedCheckpointId = String(payload.expectedCheckpointId || "").trim();

  return withCheckpointLock(prisma, id, async (tx) => {
    /* Lugemine on luku SEES — muidu jääks kontrolli ja kirjutuse vahele auk,
       mis ongi leiu sisu. */
    const existing = await tx.wellbeingRecord.findFirst({
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
    /* Vastus käib KOKKULEPPE, mitte kirje kohta. Kui klient ütleb, millisele
       kokkuleppele ta vastab, ja see ei ole enam käesolev, on vastus aegunud —
       409, mitte vaikne kirjutamine uue plaani külge. */
    if (expectedCheckpointId && existing.checkpoint.id && expectedCheckpointId !== existing.checkpoint.id) {
      const error = new Error("wellbeing.errors.checkpoint_conflict");
      error.status = 409;
      error.details = { currentCheckpointId: existing.checkpoint.id };
      throw error;
    }

    const notedAt = options.now instanceof Date ? options.now : new Date();
    return updateOwnedRecord(tx, ownerUserId, id, {
      checkpointAnsweredAt: notedAt,
      checkpoint: {
        ...existing.checkpoint,
        followUp: { state, notedAt: notedAt.toISOString() }
      }
    });
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

  /* SOL-WB-09: kaks soovitust järjest märgituna kirjutasid teineteise üle —
     mõlemad lugesid sama massiivi ja kirjutasid oma versiooni tagasi, seega
     alles jäi ainult viimane. Lukk teeb lugemisest ja kirjutamisest ühe
     jagamatu sammu; 409 ei ole vaja, sest hiline kirjutaja loeb nüüd VÄRSKET
     seisu ja tema muudatus lisandub, mitte ei asenda. */
  return withCheckpointLock(prisma, id, async (tx) => {
    const existing = await tx.wellbeingRecord.findFirst({
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

    return updateOwnedRecord(tx, ownerUserId, id, { recommendedActions: next });
  });
}

/* U1 taimeri allikas (E3). Indekseeritud skalaaride peal, ilma JSON-skaneeringuta.

   SOL-WB-07: `checkpointAnsweredAt: null` on WHERE-is, mitte mälus. Vana rada
   võttis 1000 VANIMAT due-rida ja viskas vastatud alles pärast `take`-i välja —
   piisav hulk vastatud vanu ridu näljutas kõik hilisemad tähtajad taimerist
   välja ja ükski hilisem kasutaja ei saanud oma meeldetuletust. Vastatud read ei
   ole nüüd kandidaadid, seega nad ei saa kedagi välja tõrjuda.

   Mälufilter JÄÄB teise väravana: ta katab pärandread, kus skalaar ja JSON
   võiksid lahku minna, ega maksa midagi. */
export async function listDueWellbeingCheckpoints(options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const now = options.now instanceof Date ? options.now : new Date();
  const take = Math.min(Math.max(Number(options.take) || 200, 1), 1000);

  const candidates = await prisma.wellbeingRecord.findMany({
    where: { checkpointDueOn: { lte: now, not: null }, checkpointAnsweredAt: null },
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
    const dueKey = dueOn.toISOString().slice(0, 10);
    /* SOL-WB-08: dedupe'i võti on `type:sourceId:userId:suffix`, seega ta on
       seotud REA id-ga. Parandus liigutab kokkuleppe uuele reale ja sama
       kokkulepe saaks uue võtme — kaks teavitust ühe kokkuleppe kohta. Märge
       elab seepärast kokkuleppe enda sees ja liigub koos temaga. */
    if (record.checkpoint?.notifiedFor === dueKey) {
      skipped += 1;
      continue;
    }
    try {
      const result = await createNotificationEvent({
        type: NOTIFICATION_EVENT_TYPES.WELLBEING_CHECKPOINT_DUE,
        userId: record.ownerUserId,
        sourceId: record.id,
        targetId: record.id,
        dedupeSuffix: dueKey,
        emailPolicy: "NONE"
      }, { db: prisma, now });
      /* `createNotificationEvent` EI viska dubleerimisel — ta lahendab dedupe'i
         ise ja tagastab `created: false`. Loeme tema vastust, mitte viske
         puudumist, muidu näitaks taimer iga jooksu uusi teavitusi. */
      if (result?.created) created += 1;
      else skipped += 1;

      /* Märge kokkuleppe sisse — luku all, sest kasutaja võib samal hetkel
         vastata. Ebaõnnestumine ei tohi teavitust olematuks teha: halvimal
         juhul jääb märge tegemata ja dedupe langeb tagasi võtmele. */
      await withCheckpointLock(prisma, record.id, (tx) => tx.wellbeingRecord.updateMany({
        where: { id: record.id, ownerUserId: record.ownerUserId },
        data: { checkpoint: { ...record.checkpoint, notifiedFor: dueKey } }
      })).catch((error) => {
        console.error("[wellbeing] checkpoint notify mark failed", {
          recordId: record.id,
          message: error?.message
        });
      });
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

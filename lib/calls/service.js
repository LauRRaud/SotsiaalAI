import crypto from "node:crypto";

import { TrackSource } from "livekit-server-sdk";

import { confirmEgressStopped, createConfiguredEgressProvider } from "./egress.js";
import {
  buildRecordingFileName,
  CALL_RECORDING_MIME_TYPE,
  createRecordingStorage,
  getRecordingLimits,
  retentionUntilFromEnv
} from "./recordingStorage.js";
import { purgeRecordingFile } from "./recordingRetention.js";
import { normalizeServerLocale, serverT } from "../i18n/serverMessages.js";

const DEFAULT_MAX_PARTICIPANTS = 8;
const CALL_CONTEXT_ROOM = "ROOM";
const CALL_CONTEXT_COVISION = "COVISION";
const CALL_MODE_AUDIO = "AUDIO";
/* SOL-CALL-07 — v1 → v2, sest LUBADUS muutus, mitte sõnastus. v1 ütles, et salvestis
   „tehakse kättesaadavaks õigustatud kasutajatele dokumentide vaates", kuigi fail
   kuulus alati ainult taotlejale ja dokumendipiir on range `ownerId`. Vana versiooni
   all antud nõusolekud jäävad puutumata: nende snapshot kannab teksti, mida inimene
   päriselt luges, ja seda ei kirjutata tagantjärele ümber. */
const CONSENT_TEXT_VERSION = "call-recording-consent-v2";
// SOL-CALL-01: `STOPPING` ja `STOP_FAILED` LOETAKSE AVATUKS. Kui eelmise salvestuse
// peatumine ei ole tõendatud, ei tohi samas kõnes uut salvestust alustada — võib-olla
// kirjutab vana egress veel. See blokeerib kõne salvestamise seniks, kuni reconcile
// asja klaarib, ja see on tahtlik: konservatiivne blokk on õige pool eksida, kui
// alternatiiv on teine salvestus tundmatu esimese kõrvale.
const OPEN_RECORDING_STATUSES = ["REQUESTED", "READY_TO_RECORD", "STARTING", "ACTIVE", "STOPPING", "STOP_FAILED"];
// E5 (5 K1): eel-ACTIVE olekud, mida puhas readiness-abiline tohib mutata.
// ACTIVE-salvestuse elutsükli omab egress-teadlik teenusekiht, mitte readiness.
const PRE_ACTIVE_RECORDING_STATUSES = ["REQUESTED", "READY_TO_RECORD"];
// E3 (audit 5 pisitäiendus): salvestuse eesmärgi vabatekst ei tohi maanduda
// piiramatult consent-snapshot'i ja iga osaleja consent-rea koopiasse.
const MAX_RECORDING_PURPOSE_TEXT = 500;
// SOL-CALL-01: uued seisud PEAVAD olema nähtavad. Kui `STOPPING`/`STOP_FAILED` siit
// puuduks, kaoks salvestus kliendi silmist täpselt sel hetkel, mil ta on kõige
// ohtlikum — st inimene ei näeks, et peatumine on kinnitamata.
const VISIBLE_RECORDING_STATUSES = ["REQUESTED", "READY_TO_RECORD", "DECLINED", "STARTING", "ACTIVE", "STOPPING", "STOP_FAILED", "STOPPED", "COMPLETED", "FAILED"];

// Viimane varuvõrk, kui tõlkekataloogist peaks võti kaduma. Päris sildid tulevad
// `calls.recording_purpose_*` võtmetest — SAMADEST, mida liides kuvab, et
// salvestatud nõusolekukirje oleks sõna-sõnalt see tekst, mida inimene nägi.
const RECORDING_PURPOSE_LABELS = {
  GENERAL_SUMMARY: "kokkuvõtte koostamine",
  CASE_SUMMARY: "juhtumikokkuvõtte mustand",
  PRE_ASSESSMENT_SUMMARY: "eelpöördumise kokkuvõte",
  STAR_HELPER: "STAR-i sisestamise abimaterjal",
  MENTORING_SUMMARY: "mentorluskohtumise kokkuvõte",
  COVISION_SUMMARY: "kovisiooni kokkuvõte",
  OTHER: "muu eesmärk"
};

function toPositiveInt(value, fallback = DEFAULT_MAX_PARTICIPANTS) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

function normalizeCallProvider(value = process.env.CALL_PROVIDER) {
  const normalized = String(value || "mock").trim().toLowerCase();
  if (normalized === "livekit") return "LIVEKIT_SELF_HOSTED";
  return "MOCK";
}

export function getCallRuntimeConfig(env = process.env) {
  const provider = normalizeCallProvider(env.CALL_PROVIDER);
  const liveKitConfigured = Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET);
  return {
    provider,
    providerKey: provider === "LIVEKIT_SELF_HOSTED" ? "livekit" : "mock",
    liveKitConfigured,
    callServiceConfigured: provider !== "LIVEKIT_SELF_HOSTED" || liveKitConfigured,
    maxParticipants: toPositiveInt(env.CALL_MAX_PARTICIPANTS, DEFAULT_MAX_PARTICIPANTS),
    recordingEnabled: String(env.RECORDING_ENABLED || "false").toLowerCase() === "true",
    liveKitEgressEnabled: String(env.LIVEKIT_EGRESS_ENABLED || "false").toLowerCase() === "true"
  };
}

function slugSegment(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function buildProviderRoomName({ roomId, contextType = CALL_CONTEXT_ROOM, contextId = roomId, callSessionId }) {
  const context = String(contextType || CALL_CONTEXT_ROOM).toLowerCase();
  return `sotsiaalai-${context}-${slugSegment(contextId || roomId)}-call-${slugSegment(callSessionId)}`;
}

export function buildLiveKitGrant({ providerRoomName }) {
  return {
    room: providerRoomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canPublishSources: [TrackSource.MICROPHONE]
  };
}

function hashOptional(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function normalizeRecordingPurpose(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(RECORDING_PURPOSE_LABELS, normalized)
    ? normalized
    : "GENERAL_SUMMARY";
}

// Nõusoleku keel. Vaikimisi `et` (MITTE serverT-i oma `en`), sest kogu senine
// salvestatud kirjevaru on eestikeelne — teadmata keelega rida peab jääma
// täpselt sinna, kus ta oli.
export function normalizeConsentLocale(value) {
  return normalizeServerLocale(value) || "et";
}

function recordingPurposeLabel(purpose, purposeText = "", locale = "et") {
  const normalized = normalizeRecordingPurpose(purpose);
  const custom = String(purposeText || "").trim();
  // Vabatekst on inimese enda sõnastus — seda ei tõlgita ega asendata.
  if (normalized === "OTHER" && custom) return custom;
  return serverT(
    normalizeConsentLocale(locale),
    `calls.recording_purpose_${normalized.toLowerCase()}`,
    undefined,
    RECORDING_PURPOSE_LABELS[normalized] || RECORDING_PURPOSE_LABELS.GENERAL_SUMMARY
  );
}

// Nõusolekutekst ehitatakse liidesega SAMADEST võtmetest. Nii ei saa tekkida
// olukorda, kus inimene luges ühte teksti ja allkirjastati teine.
export function buildRecordingConsentText({ requesterName, purpose, purposeText, locale = "et" }) {
  const resolved = normalizeConsentLocale(locale);
  const name = String(requesterName || "").trim() ||
    serverT(resolved, "calls.recording_requester_fallback", undefined, "Kõne osaleja");
  const recordingPurpose = recordingPurposeLabel(purpose, purposeText, resolved);
  return [
    serverT(resolved, "calls.recording_consent_intro", { requesterName: name },
      `${name} soovib selle helikõne salvestada.`),
    serverT(resolved, "calls.recording_consent_purpose", { recordingPurpose },
      `Salvestust kasutatakse ainult märgitud eesmärgil: ${recordingPurpose}.`),
    /* SOL-CALL-07 — KANDJA ÖELDAKSE VÄLJA. Nõusolek salvestamiseks ja koopia saamine
       on kaks eri asja ning vana tekst sulatas nad kokku („õigustatud kasutajatele").
       Inimene, kellelt luba küsitakse, peab teadma, kelle kätte tema hääl jääb. */
    serverT(resolved, "calls.recording_consent_custody", { requesterName: name },
      `Salvestis läheb ainult salvestamise taotlejale (${name}) tema SotsiaalAI dokumentide vaatesse. Sina annad nõusoleku salvestamiseks, mitte koopia saamiseks — salvestis sinuni ei jõua.`),
    serverT(resolved, "calls.recording_consent_body", undefined,
      "Salvestus võib sisaldada isikuandmeid või tundlikku infot. Salvestust ei transkribeerita ega kasutata kokkuvõtte koostamiseks automaatselt; need tegevused käivitatakse eraldi kasutaja toiminguna."),
    serverT(resolved, "calls.recording_consent_question", undefined,
      "Kas nõustud selle kõne salvestamisega?")
  ].join("\n\n");
}

function displayNameFor(entry) {
  const direct = String(entry?.displayName || "").trim();
  if (direct) return direct;
  const profileName = [entry?.user?.profile?.firstName, entry?.user?.profile?.lastName].filter(Boolean).join(" ").trim();
  if (profileName) return profileName;
  return "";
}

function serializeRecording(recording, currentUserId = "") {
  if (!recording) return null;
  const request = recording.request || recording;
  const consents = Array.isArray(recording.consents) ? recording.consents : request.consents || [];
  const files = Array.isArray(recording.files) ? recording.files : request.files || [];
  const consentedCount = consents.filter(consent => consent.status === "CONSENTED").length;
  const requiredCount = consents.length;
  const requesterName = displayNameFor(request.requestedBy) || request.requesterName || "Kõne osaleja";
  return {
    id: request.id,
    callSessionId: request.callSessionId,
    requestedByUserId: request.requestedByUserId,
    requesterName,
    purpose: request.purpose || "GENERAL_SUMMARY",
    purposeText: request.purposeText || "",
    purposeLabel: recordingPurposeLabel(request.purpose, request.purposeText),
    status: request.status || "REQUESTED",
    consentTextVersion: request.consentTextVersion,
    consentTextSnapshot: request.consentTextSnapshot,
    requestedAt: request.requestedAt,
    startedAt: request.startedAt || null,
    stoppedAt: request.stoppedAt || null,
    completedAt: request.completedAt || null,
    consentedCount,
    requiredCount,
    myConsent: currentUserId
      ? consents.find(consent => consent.userId === currentUserId) || null
      : null,
    consents: consents.map(consent => ({
      id: consent.id,
      userId: consent.userId,
      status: consent.status || "REQUESTED",
      respondedAt: consent.respondedAt || null,
      withdrawnAt: consent.withdrawnAt || null,
      displayName: displayNameFor(consent)
    })),
    files: files.map(file => ({
      id: file.id,
      status: file.status || "NOT_CREATED",
      createdDocumentId: file.createdDocumentId || null
    }))
  };
}

export function serializeCallSession(call, extras = {}) {
  if (!call) return null;
  const participants = Array.isArray(extras.participants) ? extras.participants : [];
  const speakRequests = Array.isArray(extras.speakRequests) ? extras.speakRequests : [];
  const isCovision = call.contextType === CALL_CONTEXT_COVISION;
  const participantIdForUser = userId => (
    participants.find(participant => participant.userId === userId)?.id || null
  );
  return {
    id: call.id,
    contextType: call.contextType || CALL_CONTEXT_ROOM,
    contextId: call.contextId || call.roomId || "",
    roomId: call.roomId || "",
    provider: call.provider || "MOCK",
    providerRoomName: call.providerRoomName || "",
    mode: call.mode || CALL_MODE_AUDIO,
    status: call.status || "ACTIVE",
    ...(isCovision
      ? { startedByParticipantId: participantIdForUser(call.startedByUserId) }
      : { startedByUserId: call.startedByUserId || "" }),
    startedAt: call.startedAt,
    endedAt: call.endedAt || null,
    maxParticipants: call.maxParticipants || DEFAULT_MAX_PARTICIPANTS,
    participants: participants.map(participant => ({
      id: participant.id,
      ...(!isCovision ? { userId: participant.userId } : {}),
      role: participant.role || "PARTICIPANT",
      joinedAt: participant.joinedAt,
      leftAt: participant.leftAt || null,
      micMuted: participant.micMuted === true,
      displayName: displayNameFor(participant)
    })),
    participantCount: participants.filter(participant => !participant.leftAt).length,
    speakRequests: speakRequests.map(request => ({
      id: request.id,
      ...(isCovision
        ? { participantId: participantIdForUser(request.userId) }
        : { userId: request.userId }),
      status: request.status || "ACTIVE",
      requestedAt: request.requestedAt,
      resolvedAt: request.resolvedAt || null,
      ...(isCovision
        ? { resolvedByParticipantId: participantIdForUser(request.resolvedByUserId) }
        : { resolvedByUserId: request.resolvedByUserId || null }),
      displayName: displayNameFor(request)
    })),
    activeSpeakRequestCount: speakRequests.filter(request => request.status === "ACTIVE").length,
    recordingAllowed: call.contextType !== CALL_CONTEXT_COVISION,
    recording: call.contextType === CALL_CONTEXT_COVISION ? null : serializeRecording(extras.recording, extras.currentUserId),
    providerAvailable: extras.providerAvailable !== false,
    providerKey: extras.providerKey || (call.provider === "LIVEKIT_SELF_HOSTED" ? "livekit" : "mock")
  };
}

async function findActiveRoomCall(prisma, roomId) {
  return prisma.callSession.findFirst({
    where: {
      contextType: CALL_CONTEXT_ROOM,
      roomId,
      status: "ACTIVE"
    },
    orderBy: { startedAt: "desc" }
  });
}

async function findActiveContextCall(prisma, { contextType, contextId }) {
  return prisma.callSession.findFirst({
    where: {
      contextType,
      contextId,
      status: "ACTIVE"
    },
    orderBy: { startedAt: "desc" }
  });
}

/* T12 E7: ÜKS kõneseisu laadija. Varem oli roomRoutes.js-is teine, käsitsi
   sünkroonis hoitav koopia samadest päringutest (sh oma kõvakodeeritud
   nähtavate salvestusolekute loend) — kaks laadijat tähendasid, et
   VISIBLE_RECORDING_STATUSES-i muutus jõudis ainult ühte rada pidi kliendini.
   Marsruudikiht lisab peale ainult runtime-konfi (providerAvailable/Key). */
export async function loadCallState(prisma, callSessionId) {
  const call = await prisma.callSession.findFirst({
    where: { id: callSessionId }
  });
  if (!call) return null;
  const [participants, speakRequests, recordingRequest] = await Promise.all([
    prisma.callParticipant.findMany({
      where: { callSessionId, leftAt: null },
      orderBy: { joinedAt: "asc" },
      include: {
        user: {
          select: {
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    }),
    prisma.callSpeakRequest.findMany({
      where: { callSessionId, status: "ACTIVE" },
      orderBy: { requestedAt: "asc" },
      include: {
        user: {
          select: {
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    }),
    prisma.callRecordingRequest?.findFirst({
      where: {
        callSessionId,
        status: { in: VISIBLE_RECORDING_STATUSES }
      },
      orderBy: { requestedAt: "desc" },
      include: {
        requestedBy: {
          select: {
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        consents: {
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                email: true,
                profile: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        files: true
      }
    })
  ]);
  return { call, participants, speakRequests, recording: recordingRequest ? { request: recordingRequest } : null };
}

/**
 * SOL-CALL-02 — fencing-loendi kasvatus. ÜKS koht, sest iga unustatud kutsuja tekitab
 * akna, mille kaudu käimasolev start pääseb aegunud plaaniga `ACTIVE`-ks. Kasvatus on
 * tahtlikult JÄME: ta ei küsi, kas muutus puudutas salvestust. Vale-positiivne katkestus
 * maksab ühe uuesti alustamise, vale-negatiivne maksab nõusolekuta salvestatud hääle.
 */
async function bumpRosterVersion(prisma, callSessionId) {
  if (!callSessionId || !prisma.callSession?.updateMany) return null;
  /* Tõrget EI neelata (varem `.catch(() => null)`). Kasvatamata jäänud loend
     tähendab, et fencing ei näe koosseisu muutust — ja selle leiu enda sõnadega
     „vale-negatiivne maksab nõusolekuta salvestatud hääle". Kutsujad on nüüd
     tehingus (SOL-CALL-08/-09), seega tõrge pöörab muutuse ausalt tagasi. */
  return prisma.callSession.updateMany({
    where: { id: callSessionId },
    data: { rosterVersion: { increment: 1 } }
  });
}

/**
 * SOL-CALL-08 — KÕNEPÕHINE NÕUANDELUKK.
 *
 * Osalejapiir oli „loe arv → otsusta → kirjuta" ja need kolm sammu ei olnud üks
 * toiming. Kaks ERI kasutajat, kes taotlevad viimast kohta korraga, lugesid
 * mõlemad sama arvu ja mahtusid mõlemad ära; unikaalindeks
 * (`CallParticipant_one_active_per_user_idx`) välistab ainult SAMA inimese
 * topeltosaluse, mitte ülempiiri ületamist. Loendurit veergu ei lisatud — see
 * oleks teine tõde, mida tuleks sünkroonis hoida (sama argument, mis SOL-DOC-07
 * loenduriveerul ja SOL-ROOM-07 saajate-veerul).
 *
 * Lukk on sama muster nagu `lib/rooms/ownership.js`-i `lockRoom`.
 * NB: `pg_advisory_xact_lock` AINULT `$executeRaw` kaudu.
 */
const CALL_LOCK_PREFIX = "call:";

export async function lockCall(tx, callSessionId) {
  // Ilma `$executeRaw`-ita kliendil ei saa PostgreSQL-i advisory lock'i võtta.
  if (typeof tx?.$executeRaw !== "function") return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${CALL_LOCK_PREFIX}${callSessionId}`}))`;
}

async function ensureParticipant(prisma, { callSessionId, userId, role = "PARTICIPANT", now }) {
  const existing = await prisma.callParticipant.findFirst({
    where: {
      callSessionId,
      userId,
      leftAt: null
    }
  });
  if (existing) return existing;
  try {
    return await prisma.callParticipant.create({
      data: {
        callSessionId,
        userId,
        role,
        joinedAt: now(),
        micMuted: false
      }
    });
  } catch (error) {
    // Race: osaline unikaalindeks CallParticipant_one_active_per_user_idx tabas —
    // paralleelne join lõi juba aktiivse osaluse. Tagasta see, ära topelda ega
    // lase indeksi P2002-l lekkida 500-na (sama muster nagu startRoomCall).
    const raced = await prisma.callParticipant.findFirst({
      where: { callSessionId, userId, leftAt: null }
    });
    if (raced) return raced;
    throw error;
  }
}

async function endCallAndWriteSystemMessage(prisma, { call, now }) {
  const endedAt = now();
  // Audit 4 K4: kaks viimast lahkujat (või leave ∥ end) jõuavad siia korraga,
  // mõlemad lugesid activeCount = 0 ja mõlemad kirjutasid oma „Helikõne toimus …"
  // sõnumi — ruumi tekkis nähtav duplikaat. Üleminek on nüüd tingimuslik:
  // süsteemsõnum sünnib ainult sellel kutsel, kes ACTIVE → ENDED päriselt tegi.
  const transition = await prisma.callSession.updateMany({
    where: { id: call.id, status: "ACTIVE" },
    data: {
      status: "ENDED",
      endedAt
    }
  });
  const endedHere = Number(transition?.count || 0) === 1;
  if (endedHere && call.roomId && call.startedByUserId && prisma.roomMessage?.create) {
    await prisma.roomMessage.create({
      data: {
        roomId: call.roomId,
        authorId: call.startedByUserId,
        senderType: "ASSISTANT",
        content: `Helikõne toimus ${endedAt.toLocaleString("et-EE", { timeZone: "Europe/Tallinn" })}.`
      }
    });
  }
  const current = await prisma.callSession.findFirst({ where: { id: call.id } });
  return current || { ...call, status: "ENDED", endedAt };
}

export async function createSpeakRequest({ prisma, callSessionId, userId, now = () => new Date() }) {
  const existing = await prisma.callSpeakRequest.findFirst({
    where: {
      callSessionId,
      userId,
      status: "ACTIVE"
    }
  });
  if (existing) return existing;
  return prisma.callSpeakRequest.create({
    data: {
      callSessionId,
      userId,
      status: "ACTIVE",
      requestedAt: now()
    }
  });
}

export async function cancelSpeakRequest({ prisma, callSessionId, userId, now = () => new Date() }) {
  return prisma.callSpeakRequest.updateMany({
    where: {
      callSessionId,
      userId,
      status: "ACTIVE"
    },
    data: {
      status: "CANCELLED",
      resolvedAt: now()
    }
  });
}

/**
 * SOL-CALL-09 — KOHUSTUSLIK AUDITIKIRJE.
 *
 * MIS OLI VALESTI. Kõik salvestuse elutsükli auditid — luba, nõusolek, keeldumine,
 * tagasivõtt, käivitus, peatus, kõrvaldamine, kustutus — käisid läbi funktsiooni,
 * mis püüdis vea kinni ja tagastas `null`. Mitte ükski kutsuja ei vaadanud tulemust.
 * Puuduv `dataAuditLog` mudel andis sama vaikse `null`-i. Samal ajal muutus põhiseis
 * ja füüsiline helifail edukalt: tundliku heli salvestamise loa või kustutamise kohta
 * võis kohustuslik tegevusjälg PUUDUDA, kuigi API kinnitas edu.
 *
 * MIS SIIN ON. Kirje on kohustuslik ja `db` on süstitav, seega kutsuja paneb ta
 * SAMASSE tehingusse seisumuutusega (sama muster nagu SOL-FIELD-03 `writeDataAudit`
 * ja SOL-ROOM-05 omanikuvahetus). Puuduv mudel ei ole enam vaikne pääs: tõend, mida
 * ei saa kirjutada, tähendab toimingut, mida ei tohi lõpetada.
 *
 * PIIR, MIS ON TEADLIK. Tõrke-annotatsioonid (`*_STOP_UNCONFIRMED`, `TOO_LARGE`,
 * `DELETE_FAILED`, `START_ABORTED_*`) kasutavad sama kohustuslikku kirjutajat, aga
 * nende tehingu tõrge EI asenda kasutajale minevat algset viga — sealt tuleb niikuinii
 * tõrge ja korduskatse. Reegel ühe lausega: audititõrge ei saa kunagi panna
 * ebaõnnestunud toimingut õnnestunuks ega lasta õnnestunud toimingul minna ilma
 * tõendita.
 */
async function writeRecordingAudit(db, { action, actorUserId, resourceId, callSessionId, purpose, status }) {
  return db.dataAuditLog.create({
    data: {
      actorUserId,
      action,
      resourceType: "CallRecordingRequest",
      resourceId,
      meta: {
        callSessionId,
        purpose,
        status
      }
    }
  });
}

async function activeParticipantFor(prisma, { callSessionId, userId }) {
  return prisma.callParticipant.findFirst({
    where: {
      callSessionId,
      userId,
      leftAt: null
    }
  });
}

async function activeParticipantsFor(prisma, callSessionId) {
  return prisma.callParticipant.findMany({
    where: {
      callSessionId,
      leftAt: null
    },
    orderBy: { joinedAt: "asc" }
  });
}

async function findOpenRecordingRequest(prisma, callSessionId) {
  if (!prisma.callRecordingRequest?.findFirst) return null;
  return prisma.callRecordingRequest.findFirst({
    where: {
      callSessionId,
      status: { in: OPEN_RECORDING_STATUSES }
    },
    orderBy: { requestedAt: "desc" }
  });
}

async function findActiveRecordingRequest(prisma, callSessionId) {
  if (!prisma.callRecordingRequest?.findFirst) return null;
  return prisma.callRecordingRequest.findFirst({
    where: {
      callSessionId,
      status: "ACTIVE"
    },
    orderBy: { startedAt: "desc" }
  });
}

async function ensureRecordingFilePlaceholder(prisma, { recordingRequestId, callSessionId }) {
  if (!prisma.callRecordingFile?.findFirst || !prisma.callRecordingFile?.create) return null;
  const existing = await prisma.callRecordingFile.findFirst({
    where: {
      recordingRequestId,
      callSessionId
    }
  });
  if (existing) return existing;
  return prisma.callRecordingFile.create({
    data: {
      recordingRequestId,
      callSessionId,
      status: "NOT_CREATED"
    }
  });
}

async function findRecordingFile(prisma, { recordingRequestId, callSessionId }) {
  if (!prisma.callRecordingFile?.findFirst) return null;
  return prisma.callRecordingFile.findFirst({
    where: {
      recordingRequestId,
      callSessionId
    }
  });
}

async function updateRecordingReadiness(prisma, { request, now = () => new Date() }) {
  // E5 (5 K1 d / audit 20.4): ära puuduta ACTIVE ega lõppolekuid. Varem
  // demoteeris positiivne otsus ACTIVE → READY_TO_RECORD ja withdraw/decline
  // vaigistas ACTIVE → DECLINED egress'i peatamata. ACTIVE-salvestuse peatamine
  // (egress + artefakt) käib egress-teadliku teenusekihi kaudu
  // (discardActiveRecording / stopRecording), mitte siit. Muudab AINULT
  // eel-ACTIVE readiness't.
  if (!PRE_ACTIVE_RECORDING_STATUSES.includes(request.status)) {
    return request;
  }
  const consents = await prisma.callRecordingConsent.findMany({
    where: { recordingRequestId: request.id }
  });
  if (consents.some(consent => consent.status === "DECLINED" || consent.status === "WITHDRAWN")) {
    return prisma.callRecordingRequest.update({
      where: { id: request.id },
      data: { status: "DECLINED", stoppedAt: request.stoppedAt || now() }
    });
  }
  if (consents.length > 0 && consents.every(consent => consent.status === "CONSENTED")) {
    return prisma.callRecordingRequest.update({
      where: { id: request.id },
      data: { status: "READY_TO_RECORD" }
    });
  }
  if (request.status === "READY_TO_RECORD") {
    return prisma.callRecordingRequest.update({
      where: { id: request.id },
      data: { status: "REQUESTED" }
    });
  }
  return request;
}

/**
 * SOL-CALL-05 — ÜKS koht, kus nõusolekurida sünnib.
 *
 * Vana kood tegi `findFirst → create` KAHES kohas (liitumine ja vastamine) ja
 * kummalgi ei olnud tehingut ega unikaalsuspiiri: kaks paralleelset toimingut said
 * mõlemad „ei ole rida" ja lõid mõlemad oma. Ravim on kahepoolne — andmebaasi
 * unikaalne indeks `(recordingRequestId, userId)` ja `upsert`, mis on üks lause.
 * Kaks koopiat sama otsusega lahknevad esimese muudatusega; seda õppetundi maksis
 * juba SOL-RAGADMIN-01/02 ja SOL-CALL-01.
 *
 * `update: {}` on tahtlik: olemasolevat otsust EI puudutata. Liitumine ei tohi
 * kellegi juba antud (või tagasi võetud) nõusolekut `REQUESTED`-iks tagasi keerata.
 */
async function ensureConsentRow(prisma, { request, userId, now = () => new Date() }) {
  const create = {
    recordingRequestId: request.id,
    callSessionId: request.callSessionId,
    userId,
    status: "REQUESTED",
    consentTextVersion: request.consentTextVersion,
    consentTextSnapshot: request.consentTextSnapshot,
    createdAt: now()
  };
  if (typeof prisma.callRecordingConsent?.upsert === "function") {
    return prisma.callRecordingConsent.upsert({
      where: {
        recordingRequestId_userId: {
          recordingRequestId: request.id,
          userId
        }
      },
      create,
      update: {}
    });
  }
  /* Varurada ilma `upsert`-ita: loo ja loe unikaalsuskonflikt VÕITJA reana. See ei ole
     „ignoreeri viga" — P2002 tähendab siin täpselt seda, et keegi teine jõudis ette,
     ja tema rida on see, mida me tahtsimegi. */
  const existing = await prisma.callRecordingConsent.findFirst({
    where: { recordingRequestId: request.id, userId }
  });
  if (existing) return existing;
  try {
    return await prisma.callRecordingConsent.create({ data: create });
  } catch (error) {
    const raced = await prisma.callRecordingConsent.findFirst({
      where: { recordingRequestId: request.id, userId }
    });
    if (raced) return raced;
    throw error;
  }
}

async function ensureConsentRowsForActiveParticipants(prisma, { request, participants, now = () => new Date() }) {
  for (const participant of participants) {
    await ensureConsentRow(prisma, { request, userId: participant.userId, now });
  }
  return updateRecordingReadiness(prisma, { request, now });
}

export async function createRecordingRequest({
  prisma,
  callSessionId,
  userId,
  canModerate = false,
  purpose = "GENERAL_SUMMARY",
  purposeText = "",
  requesterName = "",
  locale = "et",
  now = () => new Date()
}) {
  const state = await loadCallState(prisma, callSessionId);
  if (!state || state.call.status !== "ACTIVE") throw new Error("call.not_active");
  if (state.call.contextType === CALL_CONTEXT_COVISION) throw new Error("call.recording_not_allowed");
  const requester = await activeParticipantFor(prisma, { callSessionId, userId });
  if (!requester) throw new Error("call.participant_not_found");
  if (!canModerate && requester.role !== "HOST") throw new Error("call.recording_forbidden");

  const existing = await findOpenRecordingRequest(prisma, callSessionId);
  if (existing) return existing;

  const normalizedPurpose = normalizeRecordingPurpose(purpose);
  const boundedPurposeText = String(purposeText || "").slice(0, MAX_RECORDING_PURPOSE_TEXT);
  const boundedRequesterName = String(requesterName || "").trim().slice(0, 200);
  const snapshot = buildRecordingConsentText({
    requesterName: boundedRequesterName,
    purpose: normalizedPurpose,
    purposeText: boundedPurposeText,
    locale
  });
  /* SOL-CALL-09 — taotlus, tema nõusolekuread, failirida ja tema TÕEND sünnivad
     ühes tehingus. Vana jada kirjutas neli asja järjest ja iga vahepealne tõrge
     jättis maha taotluse, mille kohta ei olnud ühtki jälge. */
  try {
    return await prisma.$transaction(async tx => {
      const request = await tx.callRecordingRequest.create({
        data: {
          callSessionId,
          requestedByUserId: userId,
          purpose: normalizedPurpose,
          purposeText: boundedPurposeText.trim() || null,
          status: "REQUESTED",
          consentTextVersion: CONSENT_TEXT_VERSION,
          consentTextSnapshot: snapshot,
          requesterNameSnapshot: boundedRequesterName || null,
          requestedAt: now()
        }
      });
      const participants = await activeParticipantsFor(tx, callSessionId);
      await ensureConsentRowsForActiveParticipants(tx, { request, participants, now });
      await ensureRecordingFilePlaceholder(tx, { recordingRequestId: request.id, callSessionId });
      await writeRecordingAudit(tx, {
        action: "CALL_RECORDING_REQUESTED",
        actorUserId: userId,
        resourceId: request.id,
        callSessionId,
        purpose: normalizedPurpose,
        status: "REQUESTED"
      });
      return request;
    });
  } catch (error) {
    // Race: osaline unikaalindeks CallRecordingRequest_one_open_per_call_idx tabas —
    // paralleelne taotlus on juba avatud. Tagasta see ilma consent-ridu, failirida
    // ega auditit topeldamata (sama semantika kui findOpenRecordingRequest ülal).
    const raced = await findOpenRecordingRequest(prisma, callSessionId);
    if (raced) return raced;
    throw error;
  }
}

async function respondToRecordingConsent({
  prisma,
  callSessionId,
  recordingRequestId,
  userId,
  decision,
  ipAddress,
  userAgent,
  locale,
  now = () => new Date()
}) {
  const normalizedDecision = String(decision || "").trim().toUpperCase();
  if (!["CONSENTED", "DECLINED", "WITHDRAWN"].includes(normalizedDecision)) {
    throw new Error("call.recording_invalid_decision");
  }
  const participant = await activeParticipantFor(prisma, { callSessionId, userId });
  if (!participant) throw new Error("call.participant_not_found");
  const request = await prisma.callRecordingRequest.findFirst({
    where: {
      id: recordingRequestId,
      callSessionId,
      status: { in: OPEN_RECORDING_STATUSES }
    }
  });
  if (!request) throw new Error("call.recording_request_not_found");
  const status = normalizedDecision;
  const respondedLocale = normalizeConsentLocale(locale);
  const rerenderSnapshot = status !== "WITHDRAWN";

  /* SOL-CALL-09 — NÕUSOLEKUOTSUS JA TEMA TÕEND ON ÜKS TOIMING.
     See on peatüki kõige olulisem tehing: otsus salvestamise loa kohta on
     õiguslik tahteavaldus ja tema jälg ei tohi kaduda vaikselt. Kui audit ei
     õnnestu, ei jõustu ka otsus — inimene saab tõrke ja proovib uuesti, mis on
     ainus aus alternatiiv „otsus kehtib, aga keegi ei tea, kes ta tegi" kõrval. */
  const { updatedConsent, updatedRequest } = await prisma.$transaction(async tx => {
    // SOL-CALL-05: sama jagatud tee, mis liitumisel — vastamine ei tohi olla teine
    // koopia „loo, kui puudub" loogikast.
    const consent = await ensureConsentRow(tx, { request, userId, now });
    // Tõend peab olema selles keeles, milles inimene teksti luges. Tagasivõtmine
    // EI kirjuta üle seda teksti, millega ta kunagi nõustus — muidu kaoks ära,
    // millega ta tegelikult nõustus.
    const localizedSnapshot = rerenderSnapshot
      ? buildRecordingConsentText({
          requesterName: request.requesterNameSnapshot || "",
          purpose: request.purpose,
          purposeText: request.purposeText || "",
          locale: respondedLocale
        })
      : consent.consentTextSnapshot;
    const nextConsent = await tx.callRecordingConsent.update({
      where: { id: consent.id },
      data: {
        status,
        ...(rerenderSnapshot
          ? { consentTextSnapshot: localizedSnapshot, locale: respondedLocale }
          : {}),
        respondedAt: status === "WITHDRAWN" ? consent.respondedAt || now() : now(),
        withdrawnAt: status === "WITHDRAWN" ? now() : null,
        ipAddressHash: hashOptional(ipAddress),
        userAgentHash: hashOptional(userAgent)
      }
    });
    /* SOL-CALL-02 — iga nõusolekuotsus muudab pilti, mille alusel start otsustas.
       Kasvatus käib ENNE readiness't, et käimasolev start näeks teda kindlasti. */
    await bumpRosterVersion(tx, callSessionId);
    const nextRequest = await updateRecordingReadiness(tx, { request, now });
    await writeRecordingAudit(tx, {
      action: status === "CONSENTED" ? "CALL_RECORDING_CONSENTED" : status === "DECLINED" ? "CALL_RECORDING_DECLINED" : "CALL_RECORDING_WITHDRAWN",
      actorUserId: userId,
      resourceId: request.id,
      callSessionId,
      purpose: request.purpose,
      status: nextRequest.status
    });
    return { updatedConsent: nextConsent, updatedRequest: nextRequest };
  });
  return {
    ...updatedRequest,
    consent: updatedConsent
  };
}

async function cancelRecordingRequest({
  prisma,
  callSessionId,
  recordingRequestId,
  userId,
  canModerate = false,
  now = () => new Date()
}) {
  // E5 (5 K1 a): tühistus puudutab AINULT eel-ACTIVE taotlust. ACTIVE salvestust
  // ei tohi „tühistada" vaikse STOPPED-lipuga, mis jätaks egress'i tööle — selleks
  // on stop (egress-peatus + finaliseerimine) või withdraw (katkesta + kõrvalda).
  const request = await prisma.callRecordingRequest.findFirst({
    where: {
      id: recordingRequestId,
      callSessionId,
      status: { in: PRE_ACTIVE_RECORDING_STATUSES }
    }
  });
  if (!request) throw new Error("call.recording_request_not_found");
  if (request.requestedByUserId !== userId && !canModerate) throw new Error("call.forbidden");
  // SOL-CALL-09: tühistus ja tema jälg ühes tehingus.
  return prisma.$transaction(async tx => {
    const updated = await tx.callRecordingRequest.update({
      where: { id: request.id },
      data: {
        status: "STOPPED",
        stoppedAt: now()
      }
    });
    await writeRecordingAudit(tx, {
      action: "CALL_RECORDING_CANCELLED",
      actorUserId: userId,
      resourceId: request.id,
      callSessionId,
      purpose: request.purpose,
      status: "STOPPED"
    });
    return updated;
  });
}

// Jagatud kõneosaluse vabastus: kui osaleja lahkub kõnest, liige ruumist või
// (tulevikus) moderaator eemaldab liikme. Üks koht, nii et fantoom-osalejat ei
// teki (audit 16 K3) ega lahkuja vastamata consent-rida ei lukusta readiness't
// (audit 4 K2). Tulevane „eemalda liige" pärib selle sünnist.
async function releaseParticipantFromCall(prisma, { callSessionId, userId, now = () => new Date() }) {
  await prisma.callParticipant.updateMany({
    where: { callSessionId, userId, leftAt: null },
    data: { leftAt: now() }
  });
  await cancelSpeakRequest({ prisma, callSessionId, userId, now });
  const open = await findOpenRecordingRequest(prisma, callSessionId);
  if (open) {
    // Ainult vastamata (REQUESTED) consent-rida kaob. CONSENTED/DECLINED/WITHDRAWN
    // on lahkuja seisukoht salvestatud lõigu kohta ja jääb alles (E5 omab seda edasi).
    await prisma.callRecordingConsent.deleteMany({
      where: { recordingRequestId: open.id, userId, status: "REQUESTED" }
    });
    await updateRecordingReadiness(prisma, { request: open, now });
  }
}

export function createCallService({
  prisma,
  provider = null,
  egress = null,
  recordingStorage = null,
  now = () => new Date(),
  maxParticipants = getCallRuntimeConfig().maxParticipants,
  /* SOL-CALL-10 — süstitav, sest kvoodi lugemine puudutab kolme tabelit ja tema
     päris teostus elab `lib/storageUsage.js`-is. Vaikeväärtus laaditakse LAISALT
     ja saab kaasa SELLE teenuse prisma-kliendi: globaalne singleton teeks
     testides vaikselt teist andmebaasi. */
  readStorageBudget = null,
  recordingLimits = () => getRecordingLimits()
}) {
  if (!prisma) throw new Error("call.prisma_required");
  const resolvedProvider = provider || {
    provider: normalizeCallProvider(),
    async createJoinToken() {
      return null;
    }
  };
  const resolvedEgress = egress || createConfiguredEgressProvider();
  const resolvedRecordingStorage = recordingStorage || createRecordingStorage();

  /* SOL-CALL-10 — kvoodilugeja. Tagastab `null`, kui kvooti EI SAA mõõta, ja
     kutsuja jätab siis reservi vahele. See on teadlik valik ühes kitsas kohas:
     salvestuse kvoot ei ole nõusolekupiir ja mõõtmatu kvoodi peale kõne
     salvestamise blokeerimine teeks tööriista kasutuskõlbmatuks siis, kui viga on
     meie mõõdikus. Nõusolekupiirid seevastu jäävad fail-closed'iks. */
  async function readRecordingStorageBudget({ userId }) {
    if (readStorageBudget) return readStorageBudget({ userId });
    if (!userId || !prisma.userDocument?.aggregate) return null;
    const [{ getStorageQuotaBytes }, { getUserStorageUsageBytes }] = await Promise.all([
      import("../storageGuardrails.js"),
      import("../storageUsage.js")
    ]);
    const owner = prisma.user?.findFirst
      ? await prisma.user.findFirst({ where: { id: userId }, select: { role: true } }).catch(() => null)
      : null;
    const usage = await getUserStorageUsageBytes(userId, { db: prisma }).catch(() => null);
    if (!usage) return null;
    return { usedBytes: Number(usage.totalBytes || 0), quotaBytes: getStorageQuotaBytes(owner?.role) };
  }

  /**
   * SOL-CALL-09 — TÕRKESEISU KIRJUTUS KOOS TEMA JÄLJEGA.
   *
   * Neli rada annoteerivad tõrget, mis on kasutajale JUBA teel (kinnitamata stop,
   * üle lae kasvanud fail, kukkunud kustutus, katkestatud start). Seisukirjutus ja
   * audit käivad ka seal ühes tehingus — aga selle tehingu enda tõrge ei tohi
   * asendada algset viga, sest siis kaoks kasutaja eest ära see, mis päriselt
   * juhtus. Vaikne see rada ei ole: tõrge läheb serveri logisse ja toiming ise
   * lõpeb niikuinii veaga ning korduskatsega.
   */
  async function writeFailureState(work, context) {
    try {
      return await prisma.$transaction(work);
    } catch (error) {
      console.error("[call recording] failure-state write failed", context, error?.message || error);
      return null;
    }
  }

  async function requireRecordingController({ callSessionId, recordingRequest, userId, canModerate }) {
    const participant = await activeParticipantFor(prisma, { callSessionId, userId });
    const isHost = participant?.role === "HOST";
    const isRequester = recordingRequest?.requestedByUserId === userId;
    if (!participant && !canModerate) throw new Error("call.participant_not_found");
    if (!isRequester && !isHost && !canModerate) throw new Error("call.recording_forbidden");
    return participant;
  }

  async function allRequiredConsentsPresent({ recordingRequestId, callSessionId }) {
    const [participants, consents] = await Promise.all([
      activeParticipantsFor(prisma, callSessionId),
      prisma.callRecordingConsent.findMany({ where: { recordingRequestId } })
    ]);
    if (participants.length < 1) return false;
    const byUserId = new Map(consents.map(consent => [consent.userId, consent]));
    return participants.every(participant => byUserId.get(participant.userId)?.status === "CONSENTED");
  }

  async function createRecordingDocument(db, { recordingRequest, fileName, finalized }) {
    if (!db.userDocument?.create) return null;
    return db.userDocument.create({
      data: {
        ownerId: recordingRequest.requestedByUserId,
        title: `Helikõne salvestus – ${now().toLocaleDateString("et-EE", { timeZone: "Europe/Tallinn" })}`,
        originalName: fileName,
        kind: "CALL_AUDIO_RECORDING",
        templateFor: null,
        agentAllowed: false,
        mime: finalized.mimeType,
        size: finalized.fileSizeBytes,
        sha256: finalized.checksum,
        storagePath: finalized.storagePath
      }
    });
  }

  /**
   * SOL-CALL-01 — kinnitusloogika ise elab `lib/calls/egress.js`-is, sest sama
   * küsimust küsib ka püsiv taasproov (`CALL_EGRESS_STOP`). Siin on ainult side
   * failirea ja providerini; teine koopia loogikast oleks halvim variant, sest
   * kaks kinnitusreeglit lahkneksid esimese muudatusega ja üks pool jääks nõrgemaks.
   */
  async function confirmProviderStop({ file, callSessionId, recordingRequestId }) {
    return confirmEgressStopped({
      provider: resolvedEgress,
      egressId: file?.egressId || null,
      callSessionId,
      recordingRequestId
    });
  }

  /**
   * Püsiv taasproov läheb OLEMASOLEVASSE `DataDeletionJob` järjekorda (action
   * `CALL_EGRESS_STOP`). Teist töölist ei ehitata: sama tabel kannab juba
   * `RAG_DELETE`-i ja `RAG_INGEST`-i ning tal on `nextAttemptAt`, `attempts` ja
   * `maxAttempts` olemas.
   *
   * Kordust ei tekitata: kui sama egress'i kohta on juba lahtine rida, jääb tema.
   */
  async function enqueueEgressStopJob({ file, userId, errorCode }) {
    if (!prisma.dataDeletionJob?.create) return null;
    const externalRef = file?.egressId || null;
    if (!externalRef) return null;
    try {
      const existing = await prisma.dataDeletionJob.findFirst?.({
        where: {
          action: "CALL_EGRESS_STOP",
          externalRef,
          status: { in: ["pending", "failed"] }
        }
      });
      if (existing) return existing;
      return await prisma.dataDeletionJob.create({
        data: {
          actorUserId: userId || null,
          action: "CALL_EGRESS_STOP",
          resourceType: "CallRecordingFile",
          resourceId: file?.id || null,
          externalRef,
          storagePath: file?.filePath || null,
          status: "pending",
          attempts: 0,
          lastErrorCode: errorCode ? String(errorCode).slice(0, 80) : null,
          nextAttemptAt: now()
        }
      });
    } catch {
      /* Järjekorda panek ise võib tõrkuda. Seda EI neelata vaikides: kutsuja saab
         `null`-i ja kirjutab auditisse `reconcileQueued: false`. Ohutuse kannab
         nähtav `STOP_FAILED` seis, mitte see rida — järjekorra kadu maksab
         automaatse taastumise, mitte aususe. */
      return null;
    }
  }

  /**
   * SOL-CALL-03 — start aegus ja vastus kadus, seega egressId-d me EI TEA. Ainus tee
   * temani on ruumi kaudu: orvukontroll loetleb providerilt selle ruumi egress'id ja
   * peatab mitteterminaalse. Ilma selleta oleks timeout ainus koht, kus salvestus saab
   * jääda igaveseks käima ilma ühegi jäljeta andmebaasis.
   */
  async function enqueueOrphanEgressCheck({ callSessionId, providerRoomName, userId, errorCode }) {
    if (!prisma.dataDeletionJob?.create) return null;
    if (!providerRoomName) return null;
    try {
      const existing = await prisma.dataDeletionJob.findFirst?.({
        where: {
          action: "CALL_EGRESS_ORPHAN_STOP",
          resourceId: callSessionId,
          status: { in: ["pending", "failed"] }
        }
      });
      if (existing) return existing;
      return await prisma.dataDeletionJob.create({
        data: {
          actorUserId: userId || null,
          action: "CALL_EGRESS_ORPHAN_STOP",
          resourceType: "CallSession",
          resourceId: callSessionId,
          storagePath: providerRoomName,
          status: "pending",
          attempts: 0,
          lastErrorCode: errorCode ? String(errorCode).slice(0, 80) : null,
          nextAttemptAt: now()
        }
      });
    } catch {
      return null;
    }
  }

  /**
   * SOL-CALL-01 — ÜKS koht, kuhu stopi tõrge maandub.
   *
   * MIKS SEE FUNKTSIOON SÜNDIS. Pime `FAILED`-catch elas KAHES kohas:
   * `stopActiveRecordingForCall`-is ja `joinCall`-is. Esimese parandasin, teise jätsin
   * märkamata — ja päris jooks toodangus leidis ta kohe üles. `FAILED` on väide LÕPPENUD
   * töö kohta; kui `stopRecording` on just kirjutanud ausa `STOP_FAILED`-i ja pannud
   * taasproovi järjekorda, kustutab pime ülekirjutus selle info ära ja teeb salvestusest,
   * mis võib VEEL KÄIA, tavalise ebaõnnestunud salvestise.
   *
   * Kaks koopiat sama otsusega lahknevad esimese muudatusega — mida nad ka tegid, minu
   * enda paranduse sees. Seepärast on otsus nüüd ühes kohas.
   */
  async function markStopFailure({ requestId, error }) {
    if (error?.code === "call.recording_stop_unconfirmed") return null;
    await prisma.callRecordingRequest.update({
      where: { id: requestId },
      data: { status: "FAILED", stoppedAt: now() }
    }).catch(() => null);
    return null;
  }

  async function stopActiveRecordingForCall({ callSessionId, userId }) {
    const activeRecording = await findActiveRecordingRequest(prisma, callSessionId);
    if (!activeRecording) return null;
    return stopRecording({
      callSessionId,
      recordingRequestId: activeRecording.id,
      userId,
      canModerate: true
    }).catch(error => markStopFailure({ requestId: activeRecording.id, error }));
  }

  /**
   * Claim vabastatakse TINGIMUSLIKULT: ainult siis, kui rida kannab endiselt seda
   * katset. Tingimusteta vabastus kustutaks teise starteri claim'i, kui meie oma
   * vahepeal aegus ja keegi ta varastas.
   */
  async function releaseStartClaim({ requestId, startClaimId, status = "READY_TO_RECORD", db = prisma }) {
    const released = await db.callRecordingRequest.updateMany({
      where: { id: requestId, startClaimId },
      data: { status, startClaimId: null, startClaimedAt: null, rosterVersionAtStart: null }
    }).catch(() => null);
    if (!released?.count) return released;
    /* Claim'i ajal saabunud nõusolekumuudatused EI JÕUDNUD reale: `updateRecordingReadiness`
       ei puutu `STARTING`-ut, sest selle rea omab starter. Nüüd, kui claim on vabastatud,
       tuleb pilt uuesti arvutada — muidu jääks tagasi võetud nõusolekuga taotlus
       `READY_TO_RECORD`-iks ja järgmine start alustaks kohe uuesti, nagu midagi poleks
       juhtunud. */
    const fresh = await db.callRecordingRequest.findFirst({ where: { id: requestId } });
    if (fresh) await updateRecordingReadiness(db, { request: fresh, now });
    return released;
  }

  /**
   * SOL-CALL-03 — egress käivitus, aga meil ei ole õigust teda ACTIVE-ks lugeda.
   * Peatame ja TÕENDAME; kinnitamata jäänud stop läheb püsivasse järjekorda. Vana
   * kood ei saatnud siin providerile midagi ja tagastas lihtsalt 500.
   */
  async function abandonStartedEgress({ egressId, file, userId, reason }) {
    if (!egressId) return { stopped: true, status: "EGRESS_NONE", errorCode: null };
    const stop = await confirmEgressStopped({ provider: resolvedEgress, egressId });
    if (!stop.stopped) {
      await enqueueEgressStopJob({
        file: { ...(file || {}), egressId },
        userId,
        errorCode: stop.errorCode || reason
      });
    }
    return stop;
  }

  /**
   * SOL-CALL-02 + SOL-CALL-03 — start on nüüd CLAIM, mitte kavatsus.
   *
   * MIS OLI KATKI. Taotlus jäi `READY_TO_RECORD`-iks kogu välise providerikutse ajaks
   * ja `ACTIVE` kirjutati lõpus TINGIMUSETA `update`-iga. Selles aknas ei näinud
   * paralleelne `joinCall()` midagi peatatavat (ta otsib ainult `ACTIVE`-t) ja andis
   * uuele osalejale tokeni; nõusoleku tagasivõtt viis rea `DECLINED`-iks, aga start
   * kirjutas hiljem `ACTIVE` peale. Kaks kontrolli ilma lukuta ei ole lukk.
   *
   * KOLM VÄRAVAT, MIS SELLE SULEVAD.
   *   1. CLAIM — tingimuslik üleminek `READY_TO_RECORD` → `STARTING`. `count = 0`
   *      tähendab, et rida ei olnud enam võetav, ja siis EI minda edasi.
   *   2. NÕUSOLEK PÄRAST CLAIM'i — enne claim'i tehtud kontroll on sama aegunud pilt,
   *      mis vanas koodis. Claim on see, mis pildi kinnitab.
   *   3. FENCING enne `ACTIVE`-t — kui `rosterVersion` on vahepeal muutunud, oli plaan
   *      aegunud. Egress juba käib, seega ainus aus valik on ta peatada.
   *
   * Liituja EI PEA starti „püüdma" — tal piisab `rosterVersion`-i kasvatamisest.
   * Püüdmisel oleks alati aken; kasvatamisel ei ole.
   */
  async function startRecording({ callSessionId, recordingRequestId, userId, canModerate = false }) {
    const state = await loadCallState(prisma, callSessionId);
    if (!state || state.call.status !== "ACTIVE") throw new Error("call.not_active");
    if (state.call.mode !== CALL_MODE_AUDIO) throw new Error("call.recording_audio_only_required");
    const request = await prisma.callRecordingRequest.findFirst({
      where: {
        id: recordingRequestId,
        callSessionId
      }
    });
    if (!request) throw new Error("call.recording_not_ready");
    /* SOL-CALL-04 — KORDUS TAGASTAB OLEMASOLEVA STARDI. Topeltklõps, kaks moderaatorit
       või kliendipoolne retry ei tohi tähendada teist egress'i ega teist auditirida.
       CAS hoolitseb selle eest, et providerini jõuab üks katse; see haru hoolitseb
       selle eest, et kaotaja saab AUSA vastuse („salvestus juba käib") ja mitte
       `call.recording_not_ready`, mis tähendab vastupidist asja.
       `ACTIVE` ilma egressId-ta EI OLE start, mida korrata — sinna me ei valeta. */
    if (request.status === "ACTIVE") {
      await requireRecordingController({ callSessionId, recordingRequest: request, userId, canModerate });
      const activeFile = await findRecordingFile(prisma, { recordingRequestId, callSessionId });
      if (activeFile?.egressId) return request;
      throw new Error("call.recording_not_ready");
    }
    if (request.status !== "READY_TO_RECORD") throw new Error("call.recording_not_ready");
    await requireRecordingController({ callSessionId, recordingRequest: request, userId, canModerate });
    if (resolvedEgress.configured === false) throw new Error("call.recording_disabled");

    const startClaimId = crypto.randomUUID();
    const claimedAt = now();
    const rosterVersionAtStart = Number(state.call.rosterVersion || 0);
    const claim = await prisma.callRecordingRequest.updateMany({
      where: { id: request.id, status: "READY_TO_RECORD" },
      data: {
        status: "STARTING",
        startClaimId,
        startClaimedAt: claimedAt,
        rosterVersionAtStart
      }
    });
    if (!claim?.count) throw new Error("call.recording_not_ready");

    const consentReady = await allRequiredConsentsPresent({ recordingRequestId, callSessionId });
    if (!consentReady) {
      await releaseStartClaim({ requestId: request.id, startClaimId });
      throw new Error("call.recording_not_ready");
    }

    /* SOL-CALL-10 — RESERVEERI ENNE, MITTE MÕÕDA PÄRAST. Salvestis muutub lõpuks
       `UserDocument`-iks ja läheb sama kvoodi alla, mis üleslaaditud failid, aga
       kvooti ei vaadatud kordagi: ei enne egressi, ei finaliseerimisel. Ainus koht,
       kus keeldumine on veel odav ja aus, on siin — pärast salvestamist oleks valik
       „ületa kvoot" või „kustuta nõusolekuga saadud heli", ja kumbki ei ole meie
       otsustada. Reserv on ülempiiri hinnang (kestuselagi × bitikiirus), mitte
       tegelik maht; tegelik commit'itakse `fileSizeBytes`-ina finaliseerimisel. */
    const budget = await readRecordingStorageBudget({ userId: request.requestedByUserId });
    if (budget && budget.usedBytes + recordingLimits().projectedBytes > budget.quotaBytes) {
      await releaseStartClaim({ requestId: request.id, startClaimId });
      const error = new Error("call.recording_storage_quota_exceeded");
      error.quota = { limit: budget.quotaBytes, used: budget.usedBytes, needed: recordingLimits().projectedBytes };
      throw error;
    }

    await resolvedRecordingStorage.ensureReady?.();
    const startedAt = now();
    // SOL-CALL-04: failinimi kannab KATSE id-d, mitte ainult sekundit — kaks katset
    // sama sekundi sees oleksid muidu kirjutanud sama faili peale.
    const fileName = buildRecordingFileName({
      callSessionId,
      recordingRequestId,
      attemptId: startClaimId,
      now: startedAt
    });
    const retentionUntil = retentionUntilFromEnv(process.env, startedAt);
    const existingFile = await ensureRecordingFilePlaceholder(prisma, { recordingRequestId, callSessionId });
    await prisma.callRecordingFile.update({
      where: { id: existingFile.id },
      data: {
        status: "PROCESSING",
        filePath: fileName,
        mimeType: CALL_RECORDING_MIME_TYPE,
        retentionUntil
      }
    });

    let egressInfo;
    try {
      egressInfo = await resolvedEgress.startAudioRecording({
        callSessionId,
        recordingRequestId,
        providerRoomName: state.call.providerRoomName,
        fileName,
        audioOnly: true,
        videoOnly: false
      });
    } catch (error) {
      await prisma.callRecordingFile.update({
        where: { id: existingFile.id },
        data: { status: "FAILED" }
      }).catch(() => null);
      await releaseStartClaim({ requestId: request.id, startClaimId });
      /* Timeout EI OLE tõend, et start ei jõudnud kohale — vastus võis lihtsalt kaduda.
         Sel juhul otsib orvukontroll ruumi pealt üles egress'i, mille id-d me kunagi
         teada ei saanud. Päris tõrke korral (5xx, autentimine) ei ole midagi otsida. */
      if (error?.isTimeout) {
        await enqueueOrphanEgressCheck({
          callSessionId,
          providerRoomName: state.call.providerRoomName,
          userId,
          errorCode: error?.code || "call.egress_start_timeout"
        });
      }
      throw error;
    }

    const egressId = egressInfo?.egressId || null;

    /* egressId kirjutatakse ENNE seisu. Kui see kirjutus kukub, ei ole meil hiljem
       midagi, mille järgi egress'i üles leida — seepärast kompenseeritakse ta kohe,
       mitte ei jäeta 500-ga poolikuks. */
    const fileWritten = await prisma.callRecordingFile.update({
      where: { id: existingFile.id },
      data: {
        egressId,
        status: "PROCESSING",
        filePath: fileName,
        mimeType: CALL_RECORDING_MIME_TYPE,
        retentionUntil
      }
    }).catch(() => null);
    if (!fileWritten) {
      await abandonStartedEgress({ egressId, file: existingFile, userId, reason: "start_file_write_failed" });
      await releaseStartClaim({ requestId: request.id, startClaimId });
      throw new Error("call.recording_start_failed");
    }

    const fresh = await prisma.callSession.findFirst({ where: { id: callSessionId } });
    if (Number(fresh?.rosterVersion || 0) !== rosterVersionAtStart) {
      await abandonStartedEgress({ egressId, file: fileWritten, userId, reason: "roster_changed_during_start" });
      await writeFailureState(async tx => {
        await tx.callRecordingFile.update({
          where: { id: existingFile.id },
          data: { status: "QUARANTINED", retentionUntil: startedAt }
        });
        await releaseStartClaim({ requestId: request.id, startClaimId, db: tx });
        await writeRecordingAudit(tx, {
          action: "CALL_RECORDING_START_ABORTED_ROSTER_CHANGED",
          actorUserId: userId,
          resourceId: request.id,
          callSessionId,
          purpose: request.purpose,
          status: "READY_TO_RECORD"
        });
      }, "start_aborted_roster_changed");
      throw new Error("call.recording_roster_changed");
    }

    /* Lõppüleminek on samuti TINGIMUSLIK. `count = 0` tähendab, et keegi tühistas või
       varastas claim'i, kuni me providerit ootasime — siis ei tohi ACTIVE-t kirjutada
       ja äsja käivitatud egress tuleb peatada. */
    /* SOL-CALL-09 — ÜLEMINEK JA TÕEND ÜHES TEHINGUS. Auditi tõrge langeb siin
       samasse harusse, kus DB enda tõrge: `null` → egress peatatakse ja claim
       vabastatakse. Salvestamine, mille kohta ei saa kirjutada „algas", EI TOHI
       jääda käima — see on nõusolekupiir, mitte raamatupidamine. */
    const finished = await prisma.$transaction(async tx => {
      const claimed = await tx.callRecordingRequest.updateMany({
        where: { id: request.id, status: "STARTING", startClaimId },
        data: {
          status: "ACTIVE",
          startedAt,
          startClaimId: null,
          startClaimedAt: null
        }
      });
      // Claim kadus: kirjutamist ei toimunud, seega ei ole ka mida auditeerida.
      if (!claimed?.count) return claimed;
      await writeRecordingAudit(tx, {
        action: "CALL_RECORDING_STARTED",
        actorUserId: userId,
        resourceId: request.id,
        callSessionId,
        purpose: request.purpose,
        status: "ACTIVE"
      });
      return claimed;
    }).catch(() => null);
    if (!finished?.count) {
      /* Kaks eri põhjust, üks kohustus. `count === 0` = keegi tühistas või varastas
         claim'i; `null` = DB ise kukkus. Mõlemal juhul EI OLE meil õigust lugeda
         salvestust käimasolevaks ja äsja käivitatud egress tuleb peatada — vana kood
         jättis siin providerile käima jäänud töö ja tagastas 500. */
      await abandonStartedEgress({
        egressId,
        file: fileWritten,
        userId,
        reason: finished === null ? "start_state_write_failed" : "start_claim_lost"
      });
      await releaseStartClaim({ requestId: request.id, startClaimId });
      throw new Error(finished === null ? "call.recording_start_failed" : "call.recording_not_ready");
    }

    return prisma.callRecordingRequest.findFirst({ where: { id: request.id } });
  }

  async function stopRecording({ callSessionId, recordingRequestId, userId, canModerate = false }) {
    const state = await loadCallState(prisma, callSessionId);
    if (!state) throw new Error("call.not_active");
    const request = await prisma.callRecordingRequest.findFirst({
      where: {
        id: recordingRequestId,
        callSessionId
      }
    });
    if (!request || request.status !== "ACTIVE") throw new Error("call.recording_not_active");
    await requireRecordingController({ callSessionId, recordingRequest: request, userId, canModerate });
    const stoppedAt = now();
    const file = await findRecordingFile(prisma, { recordingRequestId, callSessionId });
    if (!file) throw new Error("call.recording_file_not_found");

    /* SOL-CALL-01 — kaks täiesti erinevat tõrget, mis vanas koodis said sama vastuse.
       (1) provider EI peatunud → salvestamine võib jätkuda, see on nõusolekupiir;
       (2) provider peatus, aga finaliseerimine/dokument/DB kukkus → salvestamine ON
       lõppenud ja alles jääb ainult koristustöö. Vana `catch` kirjutas mõlemal juhul
       `FAILED`, mille järel start/stop route ei leidnud enam ACTIVE salvestust — st
       esimesel juhul kadus ainus nupp, millega oleks saanud uuesti peatada. */
    await prisma.callRecordingRequest.update({
      where: { id: request.id },
      data: { status: "STOPPING" }
    });

    const stop = await confirmProviderStop({ file, callSessionId, recordingRequestId });
    if (!stop.stopped) {
      /* Taasproovi järjekord kirjutatakse VÄLJASPOOL annotatsioonitehingut: ta on
         püsiv töökäsk, mis peab ellu jääma ka siis, kui seisu ja jälje kirjutus
         kukub. Ilma temata ei otsiks keegi kinnitamata egress'i enam kunagi üles. */
      const job = await enqueueEgressStopJob({ file, userId, errorCode: stop.errorCode });
      await writeFailureState(async tx => {
        await tx.callRecordingFile.update({
          where: { id: file.id },
          data: { status: "QUARANTINED", retentionUntil: file.retentionUntil || retentionUntilFromEnv(process.env, stoppedAt) }
        });
        await tx.callRecordingRequest.update({
          where: { id: request.id },
          data: { status: "STOP_FAILED", stoppedAt }
        });
        await writeRecordingAudit(tx, {
          action: "CALL_RECORDING_STOP_UNCONFIRMED",
          actorUserId: userId,
          resourceId: request.id,
          callSessionId,
          purpose: request.purpose,
          status: "STOP_FAILED"
        });
      }, "stop_unconfirmed");
      const unconfirmed = new Error("call.recording_stop_unconfirmed");
      unconfirmed.code = "call.recording_stop_unconfirmed";
      unconfirmed.providerStopStatus = stop.status;
      unconfirmed.stopErrorCode = stop.errorCode;
      unconfirmed.reconcileQueued = Boolean(job);
      throw unconfirmed;
    }

    /* Kinnitus kirjutatakse KOHE, mitte lõpus. Kui finaliseerimine allpool kukub, on
       fakt „provider lõpetas" sellegipoolest jäädvustatud ja reconcile ei hakka
       otsima egress'i, mida enam ei ole. */
    await prisma.callRecordingFile.update({
      where: { id: file.id },
      data: { providerStopConfirmedAt: stoppedAt }
    }).catch(() => null);

    let finalized = null;
    try {
      finalized = await resolvedRecordingStorage.finalizeRecordingFile({
        fileName: file.filePath,
        startedAt: request.startedAt,
        stoppedAt
      });
      const retentionUntil = file.retentionUntil || retentionUntilFromEnv(process.env, stoppedAt);
      /* SOL-CALL-09 — SALVESTISE SÜND ON ÜKS TOIMING. Dokument, failirida, taotluse
         lõppseis ja tema jälg olid neli järjestikust kirjutust: vahepealne tõrge
         võis jätta maha dokumendi, millele ükski failirida ei viita, või
         `COMPLETED` salvestise, mille käivitamisest ja peatamisest ei ole jälge.
         Nüüd langevad kõik neli kokku või mitte ükski neist — ja tõrke korral
         maandub asi allpool `catch`-i, kus `FAILED` on aus. */
      const updated = await prisma.$transaction(async tx => {
        const document = await createRecordingDocument(tx, {
          recordingRequest: request,
          fileName: file.filePath,
          finalized
        });
        await tx.callRecordingFile.update({
          where: { id: file.id },
          data: {
            status: "AVAILABLE",
            filePath: finalized.storagePath,
            mimeType: finalized.mimeType,
            fileSizeBytes: finalized.fileSizeBytes,
            durationSeconds: finalized.durationSeconds,
            checksum: finalized.checksum,
            createdDocumentId: document?.id || null,
            retentionUntil
          }
        });
        const completed = await tx.callRecordingRequest.update({
          where: { id: request.id },
          data: {
            status: "COMPLETED",
            stoppedAt,
            completedAt: stoppedAt
          }
        });
        await writeRecordingAudit(tx, {
          action: "CALL_RECORDING_STOPPED",
          actorUserId: userId,
          resourceId: request.id,
          callSessionId,
          purpose: request.purpose,
          status: "COMPLETED"
        });
        return completed;
      });
      return updated;
    } catch (error) {
      /* Siia jõuab AINULT stopi-järgne tõrge: provider on juba kinnitanud, et egress
         lõppes (`providerStopConfirmedAt` on kirjas). `FAILED` on siin aus — ta
         tähendab „salvestis ei saanud valmis", mitte „ei tea, kas salvestatakse".
         Kinnitamata stop ei tule kunagi siia, ta lahkus ülal `STOP_FAILED`-iga. */
      /* SOL-CALL-10 — üle lae kasvanud fail koristatakse KOHE, mitte alles
         retentsiooni ajal. `FAILED` rida ootaks muidu `retentionUntil`-ini (90
         päeva) ja just see fail on see, mille suurus meile probleem oli. */
      const tooLarge = error?.message === "call.recording_too_large";
      if (tooLarge) {
        await resolvedRecordingStorage.discardEgressArtifact?.({ fileName: file.filePath }).catch(() => {});
      }
      /* Finaliseerimine liigutas heli juba dokumendisalvestusse enne DB-tehingut.
         Kui tehing (sh kohustuslik audit) tagasi pöördub, ei tohi see kõrvalmõju
         jääda omanikuta. Kustutame objekti kohe; kustutustõrkel säilitame tema tee
         DELETE_PENDING real, et retention-worker saaks sama sammu idempotentselt
         korrata. Ilma teeta oleks tundlik heli rakendusele enam leidmatu. */
      let finalizedArtifactDeleted = !finalized?.storagePath;
      if (finalized?.storagePath && resolvedRecordingStorage.deleteStoredArtifact) {
        finalizedArtifactDeleted = await resolvedRecordingStorage
          .deleteStoredArtifact({ storagePath: finalized.storagePath })
          .then(() => true, () => false);
      }
      await writeFailureState(async tx => {
        await tx.callRecordingFile.update({
          where: { id: file.id },
          data: finalizedArtifactDeleted
            ? { status: "FAILED" }
            : {
                status: "DELETE_PENDING",
                filePath: finalized.storagePath,
                retentionUntil: stoppedAt
              }
        });
        if (tooLarge) {
          await writeRecordingAudit(tx, {
            action: "CALL_RECORDING_TOO_LARGE",
            actorUserId: userId,
            resourceId: request.id,
            callSessionId,
            purpose: request.purpose,
            status: "FAILED"
          });
        }
        await tx.callRecordingRequest.update({
          where: { id: request.id },
          data: {
            status: "FAILED",
            stoppedAt
          }
        });
      }, tooLarge ? "recording_too_large" : "finalize_failed");
      throw error;
    }
  }

  /**
   * SOL-CALL-10 — KESTUSELAE JÕUSTUS. Piir, mida keegi ei jõusta, ei ole piir:
   * LiveKit'i egress ei tunne „maksimaalset kestust" ja kirjutab seni, kuni ruum
   * elab või keegi ütleb stopp. Kui salvestuse alustaja lihtsalt lahkub, kasvab
   * fail edasi. Seepärast peab peatamise ütlema server, perioodiliselt.
   *
   * Peatamine käib TÄPSELT sama teed nagu inimese vajutatud stopp — sama
   * provider-kinnitus, sama finaliseerimine, sama audit — sest teine tee tähendaks
   * teist käitumist tõrke korral. Tegija on taotluse esitaja: tema on kontroller,
   * kelle nõusolekuahel selle salvestuse üldse lubas.
   *
   * Latents on ausalt selle sweep'i kutsumise sagedus (retention'i tsükkel), mitte
   * sekund. Lagi on seetõttu „kestus + tsükkel", ja just sellepärast on failimahu
   * lagi olemas eraldi — tema ei sõltu ajastusest.
   */
  async function stopOverdueRecordings({ limit = 20 } = {}) {
    const limits = recordingLimits();
    if (!limits?.maxDurationSeconds || !prisma.callRecordingRequest?.findMany) {
      return { scanned: 0, stopped: 0, failed: 0 };
    }
    const cutoff = new Date(now().getTime() - limits.maxDurationSeconds * 1000);
    const overdue = await prisma.callRecordingRequest.findMany({
      where: { status: "ACTIVE", startedAt: { lte: cutoff } },
      take: limit
    });
    let stopped = 0;
    let failed = 0;
    for (const request of overdue) {
      try {
        await writeRecordingAudit(prisma, {
          action: "CALL_RECORDING_AUTO_STOPPED",
          actorUserId: request.requestedByUserId,
          resourceId: request.id,
          callSessionId: request.callSessionId,
          purpose: request.purpose,
          status: "ACTIVE"
        });
        await stopRecording({
          callSessionId: request.callSessionId,
          recordingRequestId: request.id,
          userId: request.requestedByUserId,
          canModerate: true
        });
        stopped += 1;
      } catch (error) {
        /* Tõrge EI vaikita: kinnitamata stopi rada (`STOP_FAILED` + taasproovi
           järjekord) on juba `stopRecording`-us olemas ja tema teeb oma töö.
           Siin loeme ainult kokku, et sweep'i raport ei näeks välja nagu
           „polnudki midagi teha". */
        failed += 1;
        console.error("[call recording] auto-stop failed", request.id, error?.message || error);
      }
    }
    return { scanned: overdue.length, stopped, failed };
  }

  // E5 (5 K1 c): nõusoleku tagasivõtt/keeldumine ACTIVE salvestuse ajal peatab
  // egress'i ja kõrvaldab artefakti (fail-closed). Jagatud helikõne = üks segatud
  // OGG — tagasivõtja hääl on juba failis, seega ei tehta seda kättesaadavaks:
  // taotlus läheb STOPPED (mitte COMPLETED) ja dokumenti ei looda.
  //
  // MIDA SOL-CALL-01 SIIN MUUTIS. Varem neelati NII provider-stopi kui artefakti
  // kustutuse tõrge alla (`.catch(() => null)`) ja kirjutati sellegipoolest taotlusele
  // STOPPED ning failile DELETED. Mõlemad on VÄITED maailma kohta — „ei salvestata
  // enam" ja „faili ei ole" — ja tõrke korral olid nad valed: LiveKit võis kõiki
  // osalejaid edasi lindistada, samal ajal kui UI ei pakkunud enam peatamist, sest
  // taotlus ei olnud enam ACTIVE.
  //
  // Vana kommentaar ütles „Egress-tõrge ei tohi jätta taotlust ACTIVE-ks" ja see oli
  // õige mure — ummikusse jäänud ACTIVE on halb. Aga valik tehti kahe halva vahel,
  // sest kolmas puudus. Nüüd on lõppseis TINGIMUSLIK ja kinnitamata stop kannab
  // oma nime.
  async function discardActiveRecording({ callSessionId, recordingRequestId, userId }) {
    const request = await prisma.callRecordingRequest.findFirst({
      where: { id: recordingRequestId, callSessionId, status: "ACTIVE" }
    });
    if (!request) return null;
    const stoppedAt = now();
    const file = await findRecordingFile(prisma, { recordingRequestId, callSessionId });

    /* STOPPING kirjutatakse ENNE providerikutset. Kui protsess sureb kutse ajal, jääb
       maha seis, mis ütleb ausalt „stoppi käskisin, kinnitust ei ole" — vana kood
       jättis sellisel juhul maha ACTIVE-i, mis näeb välja nagu tavaline salvestus. */
    await prisma.callRecordingRequest.update({
      where: { id: request.id },
      data: { status: "STOPPING" }
    });

    const stop = await confirmProviderStop({ file, callSessionId, recordingRequestId });

    if (!stop.stopped) {
      // Vt stopRecording: püsiv töökäsk kirjutatakse annotatsioonist väljaspool.
      const job = await enqueueEgressStopJob({ file, userId, errorCode: stop.errorCode });
      const updated = await prisma.$transaction(async tx => {
        if (file) {
          await tx.callRecordingFile.update({
            where: { id: file.id },
            data: { status: "QUARANTINED", retentionUntil: stoppedAt }
          });
        }
        const marked = await tx.callRecordingRequest.update({
          where: { id: request.id },
          data: { status: "STOP_FAILED", stoppedAt }
        });
        await writeRecordingAudit(tx, {
          action: "CALL_RECORDING_DISCARD_STOP_UNCONFIRMED",
          actorUserId: userId,
          resourceId: request.id,
          callSessionId,
          purpose: request.purpose,
          status: "STOP_FAILED"
        });
        return marked;
      });
      return {
        ...updated,
        providerStopConfirmed: false,
        providerStopStatus: stop.status,
        stopErrorCode: stop.errorCode,
        reconcileQueued: Boolean(job)
      };
    }

    /* Stop on KINNITATUD. Alles nüüd tohib artefakti puutuda — enne seda võiks egress
       samasse faili veel kirjutada ja kustutus sünnitaks uue partiaali. */
    let artifactRemoved = true;
    if (file?.filePath && resolvedRecordingStorage.discardEgressArtifact) {
      artifactRemoved = await resolvedRecordingStorage
        .discardEgressArtifact({ fileName: file.filePath })
        .then(() => true)
        .catch(() => false);
    }
    // SOL-CALL-09: failiseis, taotluse lõppseis ja jälg ühes tehingus.
    const updated = await prisma.$transaction(async tx => {
      if (file) {
        await tx.callRecordingFile.update({
          where: { id: file.id },
          data: {
            /* Kustutuse tõrge EI anna õigust kirjutada DELETED — see oleks väide faili
               puudumise kohta. Karantiin ütleb tõtt ja retention-koristus võtab ta
               hiljem üles (stop on kinnitatud, seega koristus on ohutu). */
            status: artifactRemoved ? "DELETED" : "QUARANTINED",
            retentionUntil: stoppedAt,
            providerStopConfirmedAt: stoppedAt
          }
        });
      }
      const discarded = await tx.callRecordingRequest.update({
        where: { id: request.id },
        data: { status: "STOPPED", stoppedAt }
      });
      await writeRecordingAudit(tx, {
        action: "CALL_RECORDING_DISCARDED",
        actorUserId: userId,
        resourceId: request.id,
        callSessionId,
        purpose: request.purpose,
        status: "STOPPED"
      });
      return discarded;
    });
    return {
      ...updated,
      providerStopConfirmed: true,
      providerStopStatus: stop.status,
      artifactRemoved
    };
  }

  // E6 (12 K1): omaniku/moderaatori käsitsi salvestise kustutus. Sama purge-tuum
  // nagu auto-retention (füüsiline objekt + seotud dokument + rida DELETED).
  // Lubatud taotluse loojale (salvestise dokumendi omanik) või moderaatorile
  // (ruumi omanik). Idempotentne.
  async function deleteRecordingFile({ callSessionId, recordingRequestId, userId, canModerate = false }) {
    const request = await prisma.callRecordingRequest.findFirst({
      where: { id: recordingRequestId, callSessionId }
    });
    if (!request) throw new Error("call.recording_request_not_found");
    if (request.requestedByUserId !== userId && !canModerate) throw new Error("call.recording_forbidden");
    const file = await findRecordingFile(prisma, { recordingRequestId, callSessionId });
    if (!file) throw new Error("call.recording_file_not_found");
    /* SOL-CALL-09: kustutuse jälg sünnib SAMAS tehingus viimase astmega. Vt
       `purgeRecordingFile` päist — siin ei ole „kirjuta pärast" varianti, sest
       fail on selleks hetkeks juba kettalt kadunud. */
    const result = await purgeRecordingFile({
      db: prisma,
      file,
      storage: resolvedRecordingStorage,
      finalize: tx => writeRecordingAudit(tx, {
        action: "CALL_RECORDING_DELETED",
        actorUserId: userId,
        resourceId: request.id,
        callSessionId,
        purpose: request.purpose,
        status: "DELETED"
      })
    });
    /* SOL-CALL-06 — TÕRGE JÄÄB NÄHTAVAKS. Vana kood ei vaadanud tulemust ja vastas
       `ok:true` ka siis, kui füüsiline fail, dokument või DB-kirjutus ei õnnestunud.
       „Kustutatud" on tundliku heli puhul lubadus, mitte kavatsuse kirjeldus: kui me
       teda tõendada ei suuda, peab inimene seda TEADMA. Rida jääb `DELETE_PENDING`-iks
       ja retention-koristus proovib uuesti. */
    if (!result.purged) {
      await writeFailureState(tx => writeRecordingAudit(tx, {
        action: "CALL_RECORDING_DELETE_FAILED",
        actorUserId: userId,
        resourceId: request.id,
        callSessionId,
        purpose: request.purpose,
        status: "DELETE_PENDING"
      }), "delete_failed");
      const error = new Error("call.recording_delete_failed");
      error.step = result.step;
      error.errorCode = result.errorCode;
      throw error;
    }
    return { ok: true };
  }

  async function getRoomCall({ roomId }) {
    const call = await findActiveRoomCall(prisma, roomId);
    if (!call) return null;
    const state = await loadCallState(prisma, call.id);
    return serializeCallSession(state.call, {
      participants: state.participants,
      speakRequests: state.speakRequests,
      recording: state.recording,
      providerKey: resolvedProvider.provider === "LIVEKIT_SELF_HOSTED" ? "livekit" : "mock"
    });
  }

  async function getContextCall({ contextType, contextId }) {
    const call = await findActiveContextCall(prisma, { contextType, contextId });
    if (!call) return null;
    const state = await loadCallState(prisma, call.id);
    return serializeCallSession(state.call, {
      participants: state.participants,
      speakRequests: state.speakRequests,
      recording: state.call.contextType === CALL_CONTEXT_COVISION ? null : state.recording,
      providerKey: resolvedProvider.provider === "LIVEKIT_SELF_HOSTED" ? "livekit" : "mock"
    });
  }

  /**
   * SOL-CALL-08 — KÕNE SÜNNIB TERVIKUNA VÕI EI SÜNNI ÜLDSE.
   *
   * Vana loomine oli kolm sammu: `create` tühja `providerRoomName`-iga → nime
   * kirjutus → HOST-osalus. Teise või kolmanda sammu tõrge jättis maha ACTIVE
   * kõne, mille providerinimi oli tühi või millel ei olnud hosti — ja järgmine
   * start tagastas just selle rea muutmata kujul, seega katkine seis oli
   * PÜSIV. Ühe sammu tegemiseks genereerime id ise: nimi on id-st tuletatav,
   * seega teda ei pea enam tagantjärele juurde kirjutama.
   */
  async function createCallWithHost({ contextType, contextId, roomId, userId }) {
    const callSessionId = crypto.randomUUID();
    const providerRoomName = buildProviderRoomName({ roomId, contextType, contextId, callSessionId });
    return prisma.$transaction(async tx => {
      const call = await tx.callSession.create({
        data: {
          id: callSessionId,
          contextType,
          contextId,
          roomId,
          provider: resolvedProvider.provider || normalizeCallProvider(),
          providerRoomName,
          mode: CALL_MODE_AUDIO,
          status: "ACTIVE",
          startedByUserId: userId,
          startedAt: now(),
          maxParticipants: toPositiveInt(maxParticipants, DEFAULT_MAX_PARTICIPANTS)
        }
      });
      await ensureParticipant(tx, { callSessionId: call.id, userId, role: "HOST", now });
      return call;
    });
  }

  /**
   * Vana koodi jäetud tühi `providerRoomName` on toodangus juba võimalik ja uus
   * tehing teda tagantjärele ei paranda. Nimi on ID-dest tuletatav, seega
   * parandame ta esimesel puutumisel. Hostita kõne paraneb ise: `joinCall` annab
   * alustajale HOST-rolli.
   */
  async function repairCallProviderRoom(call) {
    if (!call || String(call.providerRoomName || "").trim()) return call;
    const repaired = await prisma.callSession.update({
      where: { id: call.id },
      data: {
        providerRoomName: buildProviderRoomName({
          roomId: call.roomId,
          contextType: call.contextType,
          contextId: call.contextId,
          callSessionId: call.id
        })
      }
    }).catch(() => null);
    // Ebaõnnestunud parandus tagastab ORIGINAALI: mälus paikneva nime tagastamine
    // annaks kutsujale nime, mida andmebaasis ei ole, ja tokenid läheksid lahku.
    return repaired || call;
  }

  async function startRoomCall({ roomId, userId }) {
    const existing = await findActiveRoomCall(prisma, roomId);
    if (existing) return repairCallProviderRoom(existing);
    try {
      return await createCallWithHost({
        contextType: CALL_CONTEXT_ROOM,
        contextId: roomId,
        roomId,
        userId
      });
    } catch (error) {
      // Osaline unikaalindeks tabas: paralleelne start jõudis ette. Võitja kõne on
      // tervik (tehing), seega teda ei ole vaja kokku lappida.
      const active = await findActiveRoomCall(prisma, roomId);
      if (active) return repairCallProviderRoom(active);
      throw error;
    }
  }

  async function startContextCall({ contextType, contextId, userId }) {
    const existing = await findActiveContextCall(prisma, { contextType, contextId });
    if (existing) return repairCallProviderRoom(existing);
    try {
      return await createCallWithHost({
        contextType,
        contextId,
        roomId: contextType === CALL_CONTEXT_ROOM ? contextId : null,
        userId
      });
    } catch (error) {
      const active = await findActiveContextCall(prisma, { contextType, contextId });
      if (active) return repairCallProviderRoom(active);
      throw error;
    }
  }

  /**
   * SOL-CALL-08 — KOHT VÕETAKSE, MITTE MÕÕDETAKSE.
   *
   * Kogu otsus (kas kõne käib · kas ma olen juba sees · kas ruumi on · osalusrida ·
   * koosseisu loend) elab ühe kõneluku sees. Ilma lukuta on lugemise ja kirjutuse
   * vahel aken, kuhu mahub teine liituja — ja seda akent ei saa sulgeda kirjutuse
   * tingimusega, sest „aktiivseid osalejaid on alla piiri" ei ole ühegi ÜHE rea
   * omadus.
   *
   * `rosterVersion` kasvab SAMAS tehingus: SOL-CALL-02 fencing eeldab, et uus
   * koosseis ja tema number muutuvad nähtavaks korraga.
   */
  async function reserveParticipantSeat({ callSessionId, userId }) {
    return prisma.$transaction(async tx => {
      await lockCall(tx, callSessionId);
      const call = await tx.callSession.findFirst({ where: { id: callSessionId } });
      if (!call || call.status !== "ACTIVE") throw new Error("call.not_active");
      const existing = await tx.callParticipant.findFirst({
        where: { callSessionId, userId, leftAt: null }
      });
      if (existing) return { participant: existing, joinedNow: false };
      const activeCount = await tx.callParticipant.count({ where: { callSessionId, leftAt: null } });
      if (activeCount >= toPositiveInt(call.maxParticipants, DEFAULT_MAX_PARTICIPANTS)) {
        throw new Error("call.participants_full");
      }
      const participant = await ensureParticipant(tx, {
        callSessionId,
        userId,
        role: call.startedByUserId === userId ? "HOST" : "PARTICIPANT",
        now
      });
      /* SOL-CALL-02 — uus koosseis. Kasvatus käib KOHE pärast osaleja lisamist ja ENNE
         tokeni väljastamist, sest just see järjekord teeb hilise liituja nähtavaks
         start'ile, mis parasjagu providerit ootab. */
      await bumpRosterVersion(tx, callSessionId);
      return { participant, joinedNow: true };
    });
  }

  async function joinCall({ callSessionId, userId }) {
    const seat = await reserveParticipantSeat({ callSessionId, userId });
    const state = await loadCallState(prisma, callSessionId);
    if (!state || state.call.status !== "ACTIVE") throw new Error("call.not_active");
    /* Parandatud rida läheb `state.call`-i TAGASI, sest tokeni grant ehitatakse
       just sellest objektist — vana kood oleks väljastanud tokeni tühja
       providerinimega ja liitumine oleks vaikselt valesse ruumi läinud. */
    state.call = await repairCallProviderRoom(state.call);
    const existing = seat.joinedNow ? null : seat.participant;
    const openRecording = await findOpenRecordingRequest(prisma, callSessionId);
    if (openRecording) {
      await ensureConsentRowsForActiveParticipants(prisma, {
        request: openRecording,
        participants: await activeParticipantsFor(prisma, callSessionId),
        now
      });
    }
    // E5 (4 K1 / 5 K1 b): hiline liituja ei salvestu küsimata. Kui liitumise hetkel
    // käib ACTIVE salvestus ja koosseis pole enam täisnõusolekus (uus osaleja pole
    // nõustunud), peatub salvestus KOHE (fail-closed). Room-composite egress
    // salvestab kõiki — valikuline väljajätt pole võimalik, seega ainus aus valik on
    // peatada. Seni salvestatud lõigul oli täisnõusolek → normaalne stop
    // (finaliseeritakse AVAILABLE-ks); uus consent-ring saab alata värske koosseisuga.
    if (!existing) {
      const activeRecording = await findActiveRecordingRequest(prisma, callSessionId);
      if (activeRecording) {
        const consentReady = await allRequiredConsentsPresent({ recordingRequestId: activeRecording.id, callSessionId });
        if (!consentReady) {
          await stopRecording({
            callSessionId,
            recordingRequestId: activeRecording.id,
            userId,
            canModerate: true
          }).catch(error => markStopFailure({ requestId: activeRecording.id, error }));
        }
      }
    }
    const token = await resolvedProvider.createJoinToken?.({
      callSession: state.call,
      userId
    });
    const refreshed = await loadCallState(prisma, callSessionId);
    return {
      call: serializeCallSession(refreshed.call, {
        participants: refreshed.participants,
        speakRequests: refreshed.speakRequests,
        recording: refreshed.recording,
        currentUserId: userId,
        providerKey: resolvedProvider.provider === "LIVEKIT_SELF_HOSTED" ? "livekit" : "mock"
      }),
      token
    };
  }

  async function leaveCall({ callSessionId, userId }) {
    const state = await loadCallState(prisma, callSessionId);
    if (!state || state.call.status !== "ACTIVE") throw new Error("call.not_active");
    await releaseParticipantFromCall(prisma, { callSessionId, userId, now });
    await bumpRosterVersion(prisma, callSessionId);
    const activeCount = await prisma.callParticipant.count({
      where: {
        callSessionId,
        leftAt: null
      }
    });
    if (activeCount < 1) {
      await stopActiveRecordingForCall({ callSessionId, userId });
      return endCallAndWriteSystemMessage(prisma, { call: state.call, now });
    }
    return state.call;
  }

  async function endCall({ callSessionId, userId, canModerate = false }) {
    const state = await loadCallState(prisma, callSessionId);
    if (!state || state.call.status !== "ACTIVE") throw new Error("call.not_active");
    if (state.call.startedByUserId !== userId && !canModerate) throw new Error("call.forbidden");
    await stopActiveRecordingForCall({ callSessionId, userId });
    await prisma.callParticipant.updateMany({
      where: {
        callSessionId,
        leftAt: null
      },
      data: { leftAt: now() }
    });
    await prisma.callSpeakRequest.updateMany({
      where: {
        callSessionId,
        status: "ACTIVE"
      },
      data: {
        status: "CANCELLED",
        resolvedAt: now()
      }
    });
    return endCallAndWriteSystemMessage(prisma, { call: state.call, now });
  }

  async function setMuted({ callSessionId, userId, micMuted }) {
    const participant = await prisma.callParticipant.findFirst({
      where: {
        callSessionId,
        userId,
        leftAt: null
      }
    });
    if (!participant) throw new Error("call.participant_not_found");
    return prisma.callParticipant.update({
      where: { id: participant.id },
      data: { micMuted: micMuted === true }
    });
  }

  async function resolveSpeakRequest({ callSessionId, requestId, userId, canModerate = false }) {
    if (!canModerate) throw new Error("call.forbidden");
    const request = await prisma.callSpeakRequest.findFirst({
      where: {
        id: requestId,
        callSessionId,
        status: "ACTIVE"
      }
    });
    if (!request) throw new Error("call.speak_request_not_found");
    return prisma.callSpeakRequest.update({
      where: { id: requestId },
      data: {
        status: "RESOLVED",
        resolvedAt: now(),
        resolvedByUserId: userId
      }
    });
  }

  // E1 elutsükli ristkoristus: ruumi DELETE lõpetab enne kustutust kõik aktiivsed
  // kõned (koristab osalejad, sõnavõtusoovid, salvestuse) — omanik ei jää kinni
  // ja egress ei jää orvuks (audit 16 K1). canModerate=true, sest kutsuja on ruumi
  // omanik/moderaator, kes ei pruukinud kõnet ise alustada.
  async function endActiveRoomCall({ roomId, actorUserId }) {
    const active = await findActiveRoomCall(prisma, roomId);
    if (!active) return null;
    try {
      return await endCall({ callSessionId: active.id, userId: actorUserId, canModerate: true });
    } catch (error) {
      // Kõne lõppes find'i ja endCall'i vahel (race) — see on soovitud lõppseisund,
      // mitte viga. Ära lase omanikul kustutamisel kinni jääda.
      if (String(error?.message) === "call.not_active") return null;
      throw error;
    }
  }

  // Liige lahkub ruumist (või tulevikus kick): vabasta ta ruumi aktiivsest kõnest
  // jagatud koristusega. Viimase päris-osaleja lahkumisel käivitub auto-lõpp
  // (audit 16 K3, 4 K2).
  async function releaseRoomMemberFromCalls({ roomId, userId }) {
    const active = await findActiveRoomCall(prisma, roomId);
    if (!active) return null;
    await releaseParticipantFromCall(prisma, { callSessionId: active.id, userId, now });
    const activeCount = await prisma.callParticipant.count({
      where: { callSessionId: active.id, leftAt: null }
    });
    if (activeCount < 1) {
      await stopActiveRecordingForCall({ callSessionId: active.id, userId });
      await endCallAndWriteSystemMessage(prisma, { call: active, now });
    }
    return active;
  }

  return {
    getRoomCall,
    getContextCall,
    startRoomCall,
    startContextCall,
    joinCall,
    leaveCall,
    endCall,
    endActiveRoomCall,
    releaseRoomMemberFromCalls,
    setMuted,
    createSpeakRequest: ({ callSessionId, userId }) => createSpeakRequest({ prisma, callSessionId, userId, now }),
    cancelSpeakRequest: ({ callSessionId, userId }) => cancelSpeakRequest({ prisma, callSessionId, userId, now }),
    resolveSpeakRequest,
    createRecordingRequest: ({ callSessionId, userId, canModerate, purpose, purposeText, requesterName, locale }) => createRecordingRequest({
      prisma,
      callSessionId,
      userId,
      canModerate,
      purpose,
      purposeText,
      requesterName,
      locale,
      now
    }),
    respondToRecordingConsent: async ({ callSessionId, recordingRequestId, userId, decision, ipAddress, userAgent, locale }) => {
      const result = await respondToRecordingConsent({
        prisma,
        callSessionId,
        recordingRequestId,
        userId,
        decision,
        ipAddress,
        userAgent,
        locale,
        now
      });
      // E5 (5 K1 c): tagasivõtt/keeldumine ACTIVE salvestuse ajal peatab egress'i +
      // kõrvaldab artefakti egress-teadlikus kihis. updateRecordingReadiness jätab
      // ACTIVE puutumata, seega vaigistatud lõppu ei teki — stopp tehakse siin.
      const normalizedDecision = String(decision || "").trim().toUpperCase();
      if (result?.status === "ACTIVE" && (normalizedDecision === "WITHDRAWN" || normalizedDecision === "DECLINED")) {
        const discarded = await discardActiveRecording({ callSessionId, recordingRequestId, userId });
        if (discarded) return { ...discarded, consent: result.consent };
      }
      return result;
    },
    cancelRecordingRequest: ({ callSessionId, recordingRequestId, userId, canModerate }) => cancelRecordingRequest({
      prisma,
      callSessionId,
      recordingRequestId,
      userId,
      canModerate,
      now
    }),
    startRecording,
    stopRecording,
    stopOverdueRecordings,
    deleteRecordingFile: ({ callSessionId, recordingRequestId, userId, canModerate }) => deleteRecordingFile({
      callSessionId,
      recordingRequestId,
      userId,
      canModerate
    })
  };
}

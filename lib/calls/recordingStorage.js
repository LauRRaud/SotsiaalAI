import crypto from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

export const CALL_RECORDING_MIME_TYPE = "audio/ogg";
const CALL_RECORDING_EXTENSION = ".ogg";
const DEFAULT_FINALIZE_WAIT_MS = 15000;
const DEFAULT_FINALIZE_POLL_MS = 250;

/* SOL-CALL-10 — kõnel ja salvestusel EI OLNUD ühtegi ülemist piiri. Ainsad
   serveripoolsed arvud olid provider ja osalejate arv; kestus, failimaht ja
   salvestuskvoot puudusid täielikult. Finaliseerimine luges kogu faili
   `fs.readFile`-ga Node'i mällu, hashis sama Bufferi pealt ja kirjutas selle
   teise faili — st tipphetkel oli mälus VÄHEMALT kogu salvestis. Pikk kõne =
   frontend-protsessi OOM.

   Kolm piiri, sest kumbki üksi jätab augu:
   - `maxDurationSeconds` — allikas. Ilma temata kasvab fail lõputult, ükskõik
     kui hästi me teda hiljem loeme.
   - `maxFileBytes` — tagavara. Kestuse valve käib perioodiliselt ja provider
     võib kirjutada oodatust tihedamalt; see lagi on kettal mõõdetud fakt.
   - `bytesPerSecond` — hinnang, millega saab ENNE salvestust öelda, kui palju
     ruumi tuleb reserveerida. Egress kirjutab OGG/Opus heli, vaikimisi ~32 kbps.

   Vaikeväärtused on tahtlikult konservatiivsed: 120 min × 32 kbps ≈ 28,8 MB,
   mis mahub ka kliendirolli 50 MB kvooti, ja 50 MB lagi jääb kestuse taha
   varuks. */
const DEFAULT_MAX_DURATION_MINUTES = 120;
const DEFAULT_MAX_FILE_MB = 50;
const DEFAULT_BITRATE_KBPS = 32;

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getRecordingLimits(env = process.env) {
  const maxDurationSeconds = Math.floor(
    positiveNumber(env.RECORDING_MAX_DURATION_MINUTES, DEFAULT_MAX_DURATION_MINUTES) * 60
  );
  const maxFileBytes = Math.floor(positiveNumber(env.RECORDING_MAX_FILE_MB, DEFAULT_MAX_FILE_MB) * 1024 * 1024);
  const bytesPerSecond = Math.ceil(
    (positiveNumber(env.RECORDING_ESTIMATED_BITRATE_KBPS, DEFAULT_BITRATE_KBPS) * 1000) / 8
  );
  return {
    maxDurationSeconds,
    maxFileBytes,
    bytesPerSecond,
    /* Reserveeritav maht on VÄIKSEIM kahest lubatud maksimumist: kumbki piir
       üksinda lubaks reserveerida rohkem, kui tegelikult sündida saab. */
    projectedBytes: Math.min(maxDurationSeconds * bytesPerSecond, maxFileBytes)
  };
}

function tooLargeError(fileSizeBytes, maxFileBytes) {
  const error = new Error("call.recording_too_large");
  error.fileSizeBytes = fileSizeBytes;
  error.maxFileBytes = maxFileBytes;
  return error;
}

function resolveRuntimeStorageDir(rawPath) {
  return path.resolve(/*turbopackIgnore: true*/ rawPath);
}

async function loadDocumentsStorage() {
  return import("../documents/server.js");
}

function resolveLocalDocsStorageDir(env = process.env) {
  const raw = String(env.DOCS_STORAGE_DIR || "").trim();
  if (env.NODE_ENV === "production" && !raw) {
    throw new Error("documents.errors.storage_dir_missing");
  }
  if (raw) return resolveRuntimeStorageDir(raw);
  return path.resolve("tmp", "documents");
}

function sanitizeId(value, fallback = "unknown") {
  const cleaned = String(value || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  return cleaned || fallback;
}

function safeTimestamp(value) {
  return new Date(value).toISOString().replace(/[^0-9]/g, "").slice(0, 14);
}

/**
 * SOL-CALL-04 — igal KATSEL peab olema oma failivõti.
 *
 * `safeTimestamp` on sekundi täpsusega, seega kaks katset sama sekundi sees andsid
 * TÄPSELT sama nime: kaks egress'i oleksid kirjutanud üksteise faili peale ja
 * viimane oleks võitnud vaikides. Katse-ID (start-claim'i oma) teeb nime katsepõhiseks.
 * Lõikame ta 12 märgini, sest failinime piir on ext4-s 255 BAITI (vt varasemat
 * deploy-tõrget) ja täispikk UUID ei osta siin midagi juurde.
 */
export function buildRecordingFileName({ callSessionId, recordingRequestId, attemptId = "", now = new Date() }) {
  const attempt = attemptId ? `-${sanitizeId(attemptId, "attempt").slice(0, 12)}` : "";
  return `call-recording-${sanitizeId(callSessionId, "call")}-${sanitizeId(recordingRequestId, "request")}-${safeTimestamp(now)}${attempt}${CALL_RECORDING_EXTENSION}`;
}

function resolveRecordingStorageDir(env = process.env) {
  const raw = String(env.RECORDING_STORAGE_DIR || "").trim();
  if (raw) return resolveRuntimeStorageDir(raw);
  return path.join(resolveLocalDocsStorageDir(env), "call-recordings");
}

export function resolveEgressOutputFilePath(fileName, env = process.env) {
  const egressRoot = String(env.RECORDING_EGRESS_OUTPUT_DIR || "").trim();
  const outputRoot = egressRoot ? resolveRuntimeStorageDir(egressRoot) : resolveRecordingStorageDir(env);
  return path.join(outputRoot, path.basename(fileName));
}

function resolveRecordingSourcePath(fileName, env = process.env) {
  const root = resolveRecordingStorageDir(env);
  const absoluteRoot = path.resolve(/*turbopackIgnore: true*/ root);
  const absolutePath = path.resolve(/*turbopackIgnore: true*/ root, path.basename(fileName));
  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error("call.recording_storage_path_invalid");
  }
  return absolutePath;
}

function durationSecondsBetween(startedAt, stoppedAt) {
  const start = startedAt ? new Date(startedAt).getTime() : 0;
  const stop = stoppedAt ? new Date(stoppedAt).getTime() : 0;
  if (!Number.isFinite(start) || !Number.isFinite(stop) || stop <= start) return null;
  return Math.round((stop - start) / 1000);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitForReadableStableFile(filePath, env = process.env) {
  const timeoutMs = Number(env.RECORDING_FINALIZE_WAIT_MS || DEFAULT_FINALIZE_WAIT_MS);
  const pollMs = Number(env.RECORDING_FINALIZE_POLL_MS || DEFAULT_FINALIZE_POLL_MS);
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_FINALIZE_WAIT_MS;
  const safePollMs = Number.isFinite(pollMs) && pollMs > 0 ? pollMs : DEFAULT_FINALIZE_POLL_MS;
  const deadline = Date.now() + safeTimeoutMs;
  let lastError = null;

  while (Date.now() <= deadline) {
    try {
      const first = await fs.stat(/*turbopackIgnore: true*/ filePath);
      if (first.isFile() && first.size > 0) {
        await wait(Math.min(safePollMs, 500));
        const second = await fs.stat(/*turbopackIgnore: true*/ filePath);
        if (second.isFile() && second.size === first.size && second.size > 0) {
          return second;
        }
      }
    } catch (error) {
      lastError = error;
    }
    await wait(safePollMs);
  }

  if (lastError) throw lastError;
  throw new Error("call.recording_file_not_ready");
}

export function retentionUntilFromEnv(env = process.env, now = new Date()) {
  const days = Number(env.RECORDING_DEFAULT_RETENTION_DAYS || 90);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 90;
  return new Date(now.getTime() + safeDays * 24 * 60 * 60 * 1000);
}

/**
 * SOL-CALL-10 — `documentsStorage` on süstitav, et voogedastust saaks ÜHIKUNA mõõta.
 * Päris `lib/documents/server.js` tõmbab kaasa `next/server`, `next-auth` ja `@/auth`;
 * ilma selle süstita mõõdaks „suure faili" test seda ahelat, mitte meie voogu — ja
 * mälulae tõendamine on siin kogu mõte. Vaikeväärtus on endine laisk import.
 */
export function createRecordingStorage(env = process.env, { documentsStorage = null } = {}) {
  const loadStorage = documentsStorage ? async () => documentsStorage : loadDocumentsStorage;
  return {
    async ensureReady() {
      await fs.mkdir(/*turbopackIgnore: true*/ resolveRecordingStorageDir(env), { recursive: true });
      const { ensureDocumentsStorage } = await loadStorage();
      await ensureDocumentsStorage();
    },

    async finalizeRecordingFile({ fileName, startedAt, stoppedAt }) {
      const {
        ensureDocumentsStorage,
        getStoredDocumentPath,
        resolveAbsoluteDocumentPath
      } = await loadStorage();
      await ensureDocumentsStorage();
      const sourcePath = resolveRecordingSourcePath(fileName, env);
      await waitForReadableStableFile(sourcePath, env);
      const limits = getRecordingLimits(env);

      /* SOL-CALL-10 — lagi on ÜKS mehhanism, mitte kaks. Kiusatus on kontrollida
         `stat`-i pealt enne lugemist, sest see säästaks kirjutuse. Aga siis on lagi
         kahes kohas ja voo pool ei käivitu KUNAGI — `stat`-värav kukutaks faili
         alati enne teda. Kaks teostust ühe reegli jaoks lahknevad esimese
         muudatusega ja üks neist on tõendamatu. Voog loeb suuruse ise kokku ja
         katkestab lae peal; kulu on ülempiirilt tõkestatud (max `maxFileBytes`
         kopeeritud baiti, mis kohe kustutatakse). */
      const storagePath = getStoredDocumentPath(fileName);
      const destinationPath = resolveAbsoluteDocumentPath(storagePath);
      const samePath = path.resolve(sourcePath) === path.resolve(destinationPath);
      const hash = crypto.createHash("sha256");
      let fileSizeBytes = 0;

      /* Voog, mitte `readFile` + `writeFile`. Mälus on korraga ainult üks tükk
         (vaikimisi 64 KB), seega mälukulu ei sõltu enam salvestise pikkusest.
         Suurus loetakse kokku voost endast, mitte `stat`-ist: kui fail on lugemise
         ajal veel kasvanud, on TÕDE see, mille me päriselt kirjutasime. */
      async function* measure(chunks) {
        for await (const chunk of chunks) {
          fileSizeBytes += chunk.byteLength;
          if (fileSizeBytes > limits.maxFileBytes) throw tooLargeError(fileSizeBytes, limits.maxFileBytes);
          hash.update(chunk);
          yield chunk;
        }
      }

      try {
        if (samePath) {
          /* Sama tee (egress kirjutab otse dokumendisalvestusse): kopeerida ei
             tohi — `createWriteStream` kärbiks allika nulli. Loeme ainult hashi. */
          await pipeline(createReadStream(sourcePath), measure, async chunks => {
            for await (const _chunk of chunks) { /* neelame: kirjutamist ei toimu */ }
          });
        } else {
          await pipeline(createReadStream(sourcePath), measure, createWriteStream(destinationPath));
        }
      } catch (error) {
        /* Poolik sihtfail on halvem kui puuduv: ta näeb välja nagu salvestis.
           Allikat EI kustutata — tema pealt saab uuesti proovida. */
        if (!samePath) await fs.unlink(/*turbopackIgnore: true*/ destinationPath).catch(() => {});
        throw error;
      }

      if (!samePath) {
        await fs.unlink(/*turbopackIgnore: true*/ sourcePath).catch(() => {});
      }
      return {
        storagePath,
        mimeType: CALL_RECORDING_MIME_TYPE,
        fileSizeBytes,
        durationSeconds: durationSecondsBetween(startedAt, stoppedAt),
        checksum: hash.digest("hex")
      };
    },

    // E6 (12 K1): kustuta finaliseeritud salvestise failiobjekt dokumendisalvestusest.
    // Idempotentne — puuduv fail ei ole viga (parim pingutus purge/kustutuse jaoks).
    async deleteStoredArtifact({ storagePath }) {
      if (!storagePath) return;
      const { deleteStoredDocument } = await loadStorage();
      await deleteStoredDocument(storagePath);
    },

    /* E6 (5 K1 c / 12 K2): kustuta toores egress-väljundfail (finaliseerimise-eelne
       osaline) ACTIVE-salvestuse kõrvaldamisel, et partiaali ei jääks järelevalveta.

       SOL-CALL-06 — VIGA EI NEELATA ENAM. Vana `.catch(() => {})` tegi kutsuja poolel
       oleva ohutusharu SURNUD KOODIKS: `discardActiveRecording` valis `DELETED` ja
       `QUARANTINED` vahel selle järgi, kas see funktsioon viskas — ja ta ei visanud
       kunagi. St „kustutuse tõrge ei anna õigust kirjutada DELETED" oli kommentaar
       ilma mehhanismita. ENOENT jääb õnnestumiseks: puuduv fail ON soovitud lõppseis. */
    async discardEgressArtifact({ fileName }) {
      if (!fileName) return;
      const sourcePath = resolveEgressOutputFilePath(path.basename(fileName), env);
      try {
        await fs.unlink(/*turbopackIgnore: true*/ sourcePath);
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
  };
}

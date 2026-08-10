import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createRecordingStorage, getRecordingLimits } from "../../lib/calls/recordingStorage.js";

/**
 * SOL-CALL-10 — kolm piiri, mida enne EI OLNUD: kestus, failimaht ja
 * salvestuskvoot. Selle faili osa on kaks alumist: mälulagi finaliseerimisel ja
 * mahulagi. Kestuse valve ja kvoot on `service.test.js`-is, sest nemad elavad
 * teenuses.
 */

const MB = 1024 * 1024;

async function withTempStorage(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sotsiaalai-call-limits-"));
  const recordingDir = path.join(root, "recordings");
  const documentsDir = path.join(root, "documents");
  await fs.mkdir(recordingDir, { recursive: true });
  await fs.mkdir(documentsDir, { recursive: true });
  try {
    return await run({ root, recordingDir, documentsDir });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

/* Päris `lib/documents/server.js` tõmbaks kaasa next-auth'i ja `@/auth`-i. Meid
   huvitab siin AINULT see, kuidas baidid failist faili liiguvad. */
function fakeDocumentsStorage(documentsDir) {
  return {
    async ensureDocumentsStorage() {},
    getStoredDocumentPath: fileName => `uploads/${fileName}`,
    resolveAbsoluteDocumentPath: storagePath => path.join(documentsDir, path.basename(storagePath)),
    async deleteStoredDocument() {}
  };
}

function envFor({ recordingDir, maxFileMb = 50 }) {
  return {
    RECORDING_STORAGE_DIR: recordingDir,
    RECORDING_MAX_FILE_MB: String(maxFileMb),
    RECORDING_FINALIZE_WAIT_MS: "4000",
    RECORDING_FINALIZE_POLL_MS: "25"
  };
}

test("SOL-CALL-10: reserveeritav maht on väiksem kahest laest, mitte nende korrutis", () => {
  const limits = getRecordingLimits({});
  assert.equal(limits.maxDurationSeconds, 120 * 60);
  assert.equal(limits.maxFileBytes, 50 * MB);
  assert.equal(limits.bytesPerSecond, 4000);
  assert.equal(limits.projectedBytes, 120 * 60 * 4000, "kestus on siin siduv piir");

  // Kui kestuselagi tõsta, hakkab siduma failimaht — reserv ei tohi lakke üle minna.
  const long = getRecordingLimits({ RECORDING_MAX_DURATION_MINUTES: "600" });
  assert.equal(long.projectedBytes, 50 * MB);

  // Vigane või negatiivne konfiguratsioon ei tohi piiri ÄRA võtta.
  const broken = getRecordingLimits({ RECORDING_MAX_FILE_MB: "-3", RECORDING_MAX_DURATION_MINUTES: "abc" });
  assert.equal(broken.maxFileBytes, 50 * MB);
  assert.equal(broken.maxDurationSeconds, 120 * 60);
});

/* Vana rada tegi `fs.readFile` → hash → `fs.writeFile`, seega tipphetkel oli
   mälus VÄHEMALT kogu salvestis (tegelikult kaks korda: Buffer + kirjutuspuhver).
   See test mõõdab kuhja kasvu, mitte koodikuju: 24 MB fail peab läbi minema nii,
   et kuhi kasvab murdosa sellest. */
test("SOL-CALL-10: 24 MB salvestis finaliseerub ilma faili mällu lugemata", async () => {
  await withTempStorage(async ({ recordingDir, documentsDir }) => {
    const fileName = "call-recording-big.ogg";
    const chunk = Buffer.alloc(MB, 7);
    const handle = await fs.open(path.join(recordingDir, fileName), "w");
    const hash = crypto.createHash("sha256");
    try {
      for (let i = 0; i < 24; i += 1) {
        await handle.write(chunk);
        hash.update(chunk);
      }
    } finally {
      await handle.close();
    }
    const expectedChecksum = hash.digest("hex");

    const storage = createRecordingStorage(envFor({ recordingDir }), {
      documentsStorage: fakeDocumentsStorage(documentsDir)
    });

    global.gc?.();
    const before = process.memoryUsage().heapUsed;
    const finalized = await storage.finalizeRecordingFile({
      fileName,
      startedAt: new Date("2026-08-10T10:00:00Z"),
      stoppedAt: new Date("2026-08-10T10:20:00Z")
    });
    const peakGrowth = process.memoryUsage().heapUsed - before;

    assert.equal(finalized.fileSizeBytes, 24 * MB);
    assert.equal(finalized.checksum, expectedChecksum, "voog peab andma SAMA hashi mis lugemine");
    assert.equal(finalized.durationSeconds, 1200);

    /* Lagi on 8 MB — kolmandik failist. Vana teostus oleks siia kindlasti jäänud:
       tema Buffer üksi on 24 MB. Lai varu on tahtlik: test peab mõõtma klassi
       (O(1) vs O(faili suurus)), mitte GC ajastust. */
    assert.ok(
      peakGrowth < 8 * MB,
      `kuhi kasvas ${Math.round(peakGrowth / MB)} MB — voog loeb faili ikka tervikuna mällu`
    );

    const copied = await fs.stat(path.join(documentsDir, fileName));
    assert.equal(copied.size, 24 * MB, "sihtfail peab olema terve");
    await assert.rejects(() => fs.stat(path.join(recordingDir, fileName)), "toores fail koristatakse");
  });
});

test("SOL-CALL-10: üle lae fail ei jõua kordagi mällu ega jäta poolikut sihtfaili", async () => {
  await withTempStorage(async ({ recordingDir, documentsDir }) => {
    const fileName = "call-recording-oversize.ogg";
    await fs.writeFile(path.join(recordingDir, fileName), Buffer.alloc(3 * MB, 1));

    const storage = createRecordingStorage(envFor({ recordingDir, maxFileMb: 1 }), {
      documentsStorage: fakeDocumentsStorage(documentsDir)
    });

    await assert.rejects(
      () =>
        storage.finalizeRecordingFile({
          fileName,
          startedAt: new Date("2026-08-10T10:00:00Z"),
          stoppedAt: new Date("2026-08-10T11:00:00Z")
        }),
      /call\.recording_too_large/
    );

    await assert.rejects(
      () => fs.stat(path.join(documentsDir, fileName)),
      "poolik sihtfail on halvem kui puuduv — ta näeb välja nagu salvestis"
    );
    const source = await fs.stat(path.join(recordingDir, fileName));
    assert.equal(source.size, 3 * MB, "allikat ei kustutata: tema pealt saab olukorda uurida");
  });
});

/* Katkestus tuleb VOO seest, mitte `stat`-ist: suurus, mille peale me otsustame,
   on see, mille me päriselt lugesime. Tõend on kopeeritud baitide arv — ta jääb
   lae lähedale, mitte faili suuruse peale. */
test("SOL-CALL-10: katkestus tuleb voost ja kopeeritud maht jääb lae lähedale", async () => {
  await withTempStorage(async ({ recordingDir, documentsDir }) => {
    const fileName = "call-recording-stream-abort.ogg";
    await fs.writeFile(path.join(recordingDir, fileName), Buffer.alloc(6 * MB, 4));

    let copiedBytes = 0;
    const documents = fakeDocumentsStorage(documentsDir);
    const storage = createRecordingStorage(envFor({ recordingDir, maxFileMb: 1 }), {
      documentsStorage: {
        ...documents,
        resolveAbsoluteDocumentPath: storagePath => {
          copiedBytes = 0;
          return documents.resolveAbsoluteDocumentPath(storagePath);
        }
      }
    });

    const error = await storage
      .finalizeRecordingFile({
        fileName,
        startedAt: new Date("2026-08-10T10:00:00Z"),
        stoppedAt: new Date("2026-08-10T10:30:00Z")
      })
      .then(() => null, err => err);

    assert.equal(error?.message, "call.recording_too_large");
    assert.equal(error.maxFileBytes, MB);
    /* Vahemik, mitte täpne arv: voog katkeb esimese tüki peal, mis lae ületab,
       seega kopeeritud maht on lagi + kuni üks tükk. 6 MB failist ei ole loetud
       kordagi rohkem kui ~1 MB — just see vahe teebki mälulae. */
    assert.ok(error.fileSizeBytes > MB, "katkestus käib pärast lae ületamist");
    assert.ok(error.fileSizeBytes <= MB + 1024 * 1024, `loeti ${error.fileSizeBytes} baiti — voog ei katke lae peal`);
    assert.equal(copiedBytes, 0);

    await assert.rejects(() => fs.stat(path.join(documentsDir, fileName)), "poolik sihtfail koristatakse");
  });
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  attemptServiceProfileRagDeletion,
  queueServiceProfileRagDeletionWithin,
  removeServiceProfileFromRag,
  serviceProfileRemovalMetadata
} from "../../lib/privacy/serviceProfileRagRemoval.js";

/**
 * SOL-SPROF-01 ja SOL-SPROF-02 — „eemaldatud" peab tähendama eemaldatut.
 *
 * Need testid katavad PROTOKOLLI: mis järjekorras töö ja katse käivad ning mida
 * kirje pärast ütleb. Päris retry-worker ja päris RAG-teenus on eraldi rajad.
 */

function fakeDb({ existingJob = null } = {}) {
  const jobs = [];
  const updates = [];
  return {
    jobs,
    updates,
    dataDeletionJob: {
      findFirst: async () => existingJob,
      create: async ({ data }) => {
        jobs.push(data);
        return { id: `job_${jobs.length}` };
      },
      update: async (input) => {
        updates.push(input);
        return { id: input.where.id };
      }
    }
  };
}

test("kustutustöö kirjutatakse ENNE kustutuskatset", async () => {
  const db = fakeDb();
  const order = [];
  const origCreate = db.dataDeletionJob.create;
  db.dataDeletionJob.create = async (input) => {
    order.push("job");
    return origCreate(input);
  };
  await removeServiceProfileFromRag(
    { profileId: "p1", ragSourceId: "doc-1", reason: "profile_not_published" },
    {
      db,
      deleteDocument: async () => {
        order.push("delete");
        return { ok: true };
      }
    }
  );
  assert.deepEqual(order, ["job", "delete"], "surev protsess peab jätma jälje, mitte orvu");
});

test("kinnitatud kustutus kustutab viida ja ütleb removed", async () => {
  const db = fakeDb();
  const result = await removeServiceProfileFromRag(
    { profileId: "p1", ragSourceId: "doc-1", reason: "profile_not_published" },
    { db, deleteDocument: async () => ({ ok: true }) }
  );
  assert.equal(result.confirmed, true);
  assert.equal(result.data.ragSourceId, null);
  assert.equal(result.data.ragMetadata.syncStatus, "removed");
  assert.equal(db.updates[0].data.status, "done", "kinnitatud kustutus sulgeb ka töö");
});

/* SOL-SPROF-02 SÜDA: kinnitamata kustutus EI TOHI öelda „removed" ega kaotada
   viita — just see kadumine muutis orvu nähtamatuks. */
test("kinnitamata kustutus HOIAB viida ja ütleb pending_removal", async () => {
  const db = fakeDb();
  const result = await removeServiceProfileFromRag(
    { profileId: "p1", ragSourceId: "doc-1", reason: "assistant_recommendation_not_allowed" },
    { db, deleteDocument: async () => ({ ok: false, error: new Error("boom") }) }
  );
  assert.equal(result.confirmed, false);
  assert.equal("ragSourceId" in result.data, false, "viit peab jääma, muidu on orb leidmatu");
  assert.equal(result.data.ragMetadata.syncStatus, "pending_removal");
  assert.equal(result.data.ragMetadata.pendingDocId, "doc-1");
  assert.ok(result.data.ragMetadata.pendingJobId, "pending seis peab nimetama töö, mis teda taga ajab");
  assert.equal(db.updates.length, 0, "kinnitamata kustutus ei tohi tööd valmis märkida");
});

test("puuduv RAG-võti EI OLE edu — töö jääb järjekorda", async () => {
  const db = fakeDb();
  const result = await removeServiceProfileFromRag(
    { profileId: "p1", ragSourceId: "doc-1", reason: "assistant_recommendation_not_allowed", ragKeyPresent: false },
    { db, deleteDocument: async () => ({ ok: true }) }
  );
  assert.equal(result.confirmed, false);
  assert.equal(result.data.ragMetadata.reason, "rag_key_missing");
  assert.equal(db.jobs.length, 1, "nõusoleku tagasivõtmine peab jõudma järjekorda ka ilma võtmeta");
});

test("puuduv kaugdokument (404) on soovitud tulemus, mitte tõrge", async () => {
  const attempt = await attemptServiceProfileRagDeletion("doc-1", {
    deleteDocument: async () => ({ ok: true, missing: true })
  });
  assert.equal(attempt.confirmed, true);
  assert.equal(attempt.reason, "already_absent");
});

test("seadistamata kustutusteenus ei anna vaikset edu", async () => {
  const attempt = await attemptServiceProfileRagDeletion("doc-1", { deleteDocument: null });
  assert.equal(attempt.confirmed, false);
  assert.equal(attempt.reason, "rag_delete_not_configured");
});

test("sama dokumendi kohta ei teki teist ootel tööd", async () => {
  const db = fakeDb({ existingJob: { id: "job_olemas" } });
  const job = await queueServiceProfileRagDeletionWithin(db, {
    profileId: "p1",
    ragSourceId: "doc-1",
    reason: "profile_not_published"
  });
  assert.equal(job.id, "job_olemas");
  assert.equal(db.jobs.length, 0);
});

test("dokumendita profiil on kohe puhas — tööd ei teki", async () => {
  const db = fakeDb();
  const result = await removeServiceProfileFromRag(
    { profileId: "p1", ragSourceId: null, reason: "profile_not_published" },
    { db, deleteDocument: async () => ({ ok: true }) }
  );
  assert.equal(result.confirmed, true);
  assert.equal(db.jobs.length, 0);
  assert.equal(result.data.ragMetadata.reason, "no_document");
});

test("pending-metaandmed ei kanna kunagi kasutaja teksti", () => {
  const meta = serviceProfileRemovalMetadata({
    confirmed: false,
    reason: "x".repeat(400),
    jobId: "job_1",
    docId: "doc-1"
  });
  assert.equal(meta.reason.length, 120, "põhjus on masinloetav märksõna, mitte vabatekst");
});

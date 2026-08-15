import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// T07 DOCUMENTS-RESEARCH-V1 — server-boundary contracts asserted against source (the same static
// style used by tests/rag/agentDocumentIsolation.test.js), because these routes have no unit
// harness and the guarantees live in the request path, not in an isolated function.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

// --- Contract 2: owner-404. A foreign id must be indistinguishable from a missing id. ---

test("document + artifact detail routes owner-scope the lookup instead of throwing an ownership 403", () => {
  const documentRoute = read("app/api/documents/[id]/route.js");
  assert.match(documentRoute, /findFirst\(\{\s*where:\s*\{\s*id,\s*ownerId\b/);
  assert.doesNotMatch(documentRoute, /assertOwnedByUser/);

  const artifactRoute = read("app/api/documents/artifacts/[id]/route.js");
  assert.match(artifactRoute, /findFirst\(\{\s*where:\s*\{\s*id,\s*ownerId:\s*userId\b/);
  assert.doesNotMatch(artifactRoute, /assertOwnedByUser/);

  for (const rel of [
    "app/api/documents/[id]/summary/route.js",
    "app/api/documents/[id]/transcribe/route.js",
    "app/api/documents/[id]/audio-select/route.js",
    "app/api/documents/[id]/download/route.js",
    "app/api/documents/artifacts/refine/route.js",
    "app/api/documents/artifacts/[id]/approve/route.js"
  ]) {
    const src = read(rel);
    assert.match(src, /findFirst\(/, `${rel} should owner-scope its fetch`);
    assert.doesNotMatch(src, /assertOwnedByUser/, `${rel} should no longer assert ownership with a 403`);
  }
  const artifactDownload = read("app/api/documents/artifacts/[id]/download/route.js");
  const finalization = read("lib/documents/artifactFinalization.js");
  assert.match(artifactDownload, /readFinalArtifactDownload/);
  assert.match(finalization, /findFirst\(\{\s*where:\s*\{\s*id:\s*artifactId,\s*ownerId\b/);
});

test("store-fetched routes convert the ownership-fail branch to the resource's own 404", () => {
  const research = read("app/api/research/jobs/[id]/route.js");
  assert.match(research, /assertResearchAccess[\s\S]{0,160}research\.error\.not_found/);
  assert.doesNotMatch(research, /api\.common\.forbidden/);

  const stream = read("app/api/research/jobs/[id]/stream/route.js");
  assert.match(stream, /assertResearchAccess[\s\S]{0,200}research\.error\.not_found/);
  assert.doesNotMatch(stream, /api\.common\.forbidden/);

  const meeting = read("app/api/documents/meeting-summary/jobs/[id]/route.js");
  assert.match(meeting, /assertMeetingSummaryAccess[\s\S]{0,220}meeting_summary\.not_found/);
  assert.doesNotMatch(meeting, /api\.common\.forbidden/);
});

// --- Contract 3: a generated draft is persisted immediately and idempotently. ---

test("generation persists a durable DRAFT (no transient result) and both entry points share the idempotent helper", () => {
  const generate = read("app/api/documents/artifacts/generate/route.js");
  assert.match(generate, /persistArtifactDraft/);
  assert.match(generate, /draft:\s*persisted\.artifact/, "the persisted artifact is returned to the workspace client as draft");
  assert.doesNotMatch(generate, /isTransient:\s*true/, "no transient, cost-losing draft is returned");

  const create = read("app/api/documents/artifacts/route.js");
  assert.match(create, /persistArtifactDraft/);

  const helper = read("lib/documents/persistDraft.js");
  assert.match(helper, /idempotencyKey/);
  assert.match(helper, /P2002/, "a concurrent retry with the same key resolves to the existing draft");
  assert.match(helper, /findFirst\(\{\s*where:\s*\{\s*ownerId:\s*userId,\s*idempotencyKey:\s*key\s*\}/);
});

// SOL-DOC-01. Järjekord ise on marsruudi kõige kergemini katkev omadus — ta elab ainult ridade
// järjestuses. Moodulitestid tõendavad reeglit, see siin tõendab, et marsruudid ka kasutavad
// teda: vana viga oli täpselt „genereerimine õnnestus" lipp, mis keelas hilisema vabastuse.
test("the three paid document routes settle usage through the shared paid-result order", () => {
  for (const rel of [
    "app/api/documents/artifacts/generate/route.js",
    "app/api/documents/artifacts/route.js",
    "app/api/documents/artifacts/refine/route.js"
  ]) {
    const src = read(rel);
    assert.match(src, /runPaidResult\(/, `${rel} must settle usage through lib/usage/paidResult`);
    assert.doesNotMatch(
      src,
      /generationCompleted|refinementCompleted/,
      `${rel} must not gate the release on a "work finished" flag`
    );
  }

  const refine = read("app/api/documents/artifacts/refine/route.js");
  const durableRefinement = read("lib/documents/artifactRefinements.js");
  assert.match(
    durableRefinement,
    /documentAudit\.update\([\s\S]{0,500}agentArtifactRefinement\.update\([\s\S]{0,700}commitUsage\(db\)/,
    "the durable result, mandatory audit row and charge must land in one transaction"
  );
  assert.match(refine, /commitUsage:\s*\(db\)\s*=>\s*commitUsageForRequest\(handle,\s*\{\s*tx:\s*db\s*\}\)/);
});

test("generated artifact quota failures cannot refund completed provider work", () => {
  const create = read("app/api/documents/artifacts/route.js");
  assert.match(create, /commitOnPersistError:\s*\(error\)\s*=>\s*Number\(error\?\.status\)\s*===\s*413/);
});

// SOL-DOC-02. Kaks otsepunkti, kus tekkis päris väline kulu ilma ühegi perioodikvoodita:
// helifaili transkriptsioon (STT_SECONDS) ja transkripti kokkuvõte (DOCUMENT_GENERATE).
// Mõlemal oli ainult minutipõhine mälupõhine rate-limit, mis ei ole lepinguline piir.
test("the transcription and transcript-summary routes are inside the usage contract", () => {
  const transcribe = read("app/api/documents/[id]/transcribe/route.js");
  assert.match(transcribe, /metric:\s*"STT_SECONDS"/, "transcription must reserve STT capacity");
  assert.match(transcribe, /amount:\s*reservationSeconds/, "the reservation must be the measured upper bound");
  assert.match(
    transcribe,
    /commitUsageForRequest\(handle,\s*\{[\s\S]{0,120}resolveSttCommittedSeconds/,
    "the commit must carry the actual duration, not the reserved upper bound"
  );
  assert.match(transcribe, /runPaidResult\(/);

  const summary = read("app/api/documents/[id]/summary/route.js");
  assert.match(summary, /metric:\s*"DOCUMENT_GENERATE"/, "the summary is document generation like any other");
  assert.match(summary, /runPaidResult\(/);

  // Olemasoleva transkripti tagastamine ei kutsu teenusepakkujat, seega ei tohi ka
  // reserveerida: reuse-haru väljub enne kvoodirida.
  const reuseIndex = transcribe.indexOf("reused: true");
  const reserveCallIndex = transcribe.indexOf("await reserveUsageForRequest({");
  assert.ok(reuseIndex > 0, "the reuse branch must exist");
  assert.ok(reserveCallIndex > reuseIndex, "the reuse branch must return before any reservation");

  // Piiri ületamise negatiivne rada on ahel: teenus VISKAB piiril (service.test.js),
  // deskriptor teeb sellest 429 (routeAdapter.test.js), ja siin mõõdetakse ahela viimane
  // lüli — et marsruut ka päriselt seda kaardistust kasutab, mitte ei neela viga.
  for (const src of [transcribe, summary]) {
    assert.match(src, /catch \(error\) \{\s*return usageErrorJson\(error,/);
  }
});

// SOL-DOC-03. Leid ei olnud „unustatud kontroll" — kontroll oli olemas, aga ta oli MÄLUS ja
// kirjutus toimus hiljem tingimusteta. Seepärast mõõdetakse siin just seda: kirjutus ei tohi
// enam sihtida ainult id-d.
test("artifact write and approve are conditional, not read-then-write-by-id", () => {
  const detail = read("app/api/documents/artifacts/[id]/route.js");
  const approve = read("app/api/documents/artifacts/[id]/approve/route.js");

  assert.match(detail, /updateDraftArtifact\(/);
  assert.match(approve, /finalizeArtifact\(/);
  for (const [rel, src] of [["detail", detail], ["approve", approve]]) {
    assert.doesNotMatch(
      src,
      /agentArtifact\.update\(\{\s*where:\s*\{\s*id\s*\}/,
      `${rel} route must not write by id alone`
    );
    assert.match(src, /expectedUpdatedAt/, `${rel} route must accept the version the client saw`);
  }

  const mutation = read("lib/documents/artifactMutation.js");
  assert.match(mutation, /updateMany\(\{\s*where,\s*data\s*\}\)/);
  assert.match(mutation, /status:\s*DRAFT/);
  assert.match(mutation, /where\.updatedAt = expectedUpdatedAt/);
});

// SOL-DOC-04. Leid on KETTA JA ANDMEBAASI JÄRJEKORRA kohta, ja järjekord elab ainult ridade
// järjestuses. Kumbki rada ei tohi enam kirjutada hoidlasse otse.
test("transcript writes stage the file and publish it only after the database", () => {
  for (const rel of [
    "app/api/documents/[id]/route.js",
    "app/api/documents/[id]/transcribe/route.js"
  ]) {
    const src = read(rel);
    assert.doesNotMatch(
      src,
      /writeStoredTextDocument\(/,
      `${rel} must not write storage directly before the database`
    );
    assert.match(src, /(update|create)(Owned)?DocumentWithStagedText\(/, `${rel} must publish through the staged writer`);
  }

  const staging = read("lib/documents/transcriptContent.js");
  // Avaldamine on tehingu SEES ja viimane samm — muidu ei kaitseks teda rollback.
  assert.match(staging, /\$transaction\([\s\S]{0,400}staged\.publish\(\)/);
  assert.match(staging, /catch[\s\S]{0,80}staged\.rollback\(\)/);
});

// SOL-DOC-05. Piir oli loendus ENNE kutset ja auditirida lisandus alles PÄRAST — kaks
// samaaegset päringut lugesid sama arvu ja mõlemad said läbi. Koht peab olema võetud enne kutset.
test("the refinement limit claims a durable slot before the model call", () => {
  const refine = read("app/api/documents/artifacts/refine/route.js");
  const slots = read("lib/documents/artifactRefinements.js");

  const claimIndex = refine.indexOf("claimArtifactRefinement(");
  const produceIndex = refine.indexOf("refineArtifactDraftContent(");
  assert.ok(claimIndex > 0, "the route must claim a slot");
  assert.ok(claimIndex < produceIndex, "the slot must be claimed before the model call");
  assert.match(refine, /failArtifactRefinement\(/, "a failed refinement must give the slot back");
  assert.doesNotMatch(
    refine,
    /documentAudit\.count\(/,
    "the route must not decide the limit by counting outside the claim transaction"
  );

  // Otsus ja kirjutus ühes tehingus, mille serialiseerib artefaktipõhine nõuandelukk.
  assert.match(slots, /\$transaction\([\s\S]{0,300}pg_advisory_xact_lock/);
  assert.match(slots, /\$executeRaw/, "advisory lock only through $executeRaw");
  assert.match(slots, /meta: \{ path: \["pending"\], equals: true \}/, "only an unconfirmed claim may be deleted");
  assert.match(slots, /leaseExpiresAt/);
  assert.match(slots, /claimToken/);
});

// SOL-DOC-06. Kaks paralleelset esmakutset nägid mõlemad tühja lauda, kutsusid mõlemad
// teenusepakkujat ja lõid mõlemad eri transkripti. Otsus peab olema lukustatud tehingus.
test("one audio source can only have one transcription in flight", () => {
  const route = read("app/api/documents/[id]/transcribe/route.js");
  const claim = read("lib/documents/transcriptionClaim.js");

  const claimIndex = route.indexOf("claimTranscription(");
  const providerIndex = route.indexOf("transcribeAudioFile(");
  assert.ok(claimIndex > 0 && claimIndex < providerIndex, "the claim must precede the provider call");
  assert.match(route, /claim\.outcome === "busy"[\s\S]{0,160}409/, "a competing request must get 409");
  assert.doesNotMatch(route, /createTranscriptionJob\(/, "the job must be created inside the claim, not beside it");

  assert.match(claim, /\$transaction\([\s\S]{0,200}pg_advisory_xact_lock/);
  assert.match(claim, /\$executeRaw/, "advisory lock only through $executeRaw");
  // Vananemisaken on lepingu osa: ilma temata lukustaks surnud protsess allika igaveseks.
  assert.match(claim, /TRANSCRIPTION_CLAIM_STALE_MS/);
});

// SOL-DOC-07. Kvoot oli piir ainult ühe päringu jaoks korraga: summa loeti eraldi ja rida loodi
// hiljem. Mõõtmine ja kirjutus peavad olema ühes kasutajapõhise lukuga tehingus.
test("storage quota is measured and written inside one locked transaction", () => {
  for (const rel of [
    "app/api/documents/route.js",
    "app/api/documents/audio-sources/route.js",
    "app/api/documents/artifacts/[id]/route.js",
    "lib/documents/persistDraft.js"
  ]) {
    const src = read(rel);
    assert.match(src, /withStorageQuota\(/, `${rel} must decide the quota inside the write transaction`);
    assert.doesNotMatch(
      src,
      /getUserStorageUsageBytes\(/,
      `${rel} must not read the sum outside the locked transaction`
    );
  }

  const quota = read("lib/documents/storageQuota.js");
  assert.match(quota, /\$transaction\([\s\S]{0,200}pg_advisory_xact_lock/);
  assert.match(quota, /\$executeRaw/, "advisory lock only through $executeRaw");
  assert.match(quota, /return write\(tx/, "the write must run inside the same transaction");

  // SOL-DOC-08: salvestatud analüüsid kuuluvad kanoonilisse summasse. Ilma selleta kontrollis
  // `createSavedAnalysis` mahtu summa vastu, mida ta ise ei kasvatanud.
  const usage = read("lib/storageUsage.js");
  assert.match(usage, /savedAnalysis\.findMany/, "SavedAnalysis belongs to the canonical sum");
  assert.match(usage, /analysisBytes/);
  assert.match(usage, /agentArtifactFinalSnapshot\.aggregate/);
  assert.match(usage, /totalBytes: documentBytes \+ materialBytes \+ artifactBytes \+ artifactSnapshotBytes \+ analysisBytes/);

  const analysis = read("lib/documents/savedAnalysis.js");
  assert.match(analysis, /withStorageQuota\(/, "saving an analysis uses the same atomic reservation");
  assert.doesNotMatch(analysis, /getUserStorageUsageBytes\(/);
});

// SOL-RES-01. Kaks eri asja olid ühte aetud: kogu uuringupind oli tellimusvärava taga, ja DELETE
// tähendas tühistamist, mitte kustutamist. Nüüd on lugemine tellimusest sõltumatu ning peatamisel
// ja kustutamisel on oma marsruudid.
test("research reads are subscription-free and delete really deletes", () => {
  const detail = read("app/api/research/jobs/[id]/route.js");
  const list = read("app/api/research/jobs/route.js");
  const stream = read("app/api/research/jobs/[id]/stream/route.js");
  const stop = read("app/api/research/jobs/[id]/stop/route.js");

  for (const [rel, src] of [["detail", detail], ["stream", stream], ["stop", stop]]) {
    assert.match(
      src,
      /requireResearchAuth\(\{ allowWithoutSubscription: true \}\)/,
      `${rel} must not gate the owner's own data behind a subscription`
    );
    assert.doesNotMatch(src, /requireResearchAuth\(\)/, `${rel} must not keep the old hard gate`);
  }

  // Loend on tellimusevaba, aga UUE töö käivitamine jääb värava taha — mõlemad ühes failis.
  assert.match(list, /GET\(req\) \{\s*\/\/[^\n]*\n\s*const auth = await requireResearchAuth\(\{ allowWithoutSubscription: true \}\)/);
  assert.match(list, /export async function POST\(req\)[\s\S]{0,600}requireResearchAuth\(\)/);

  // DELETE ei tohi enam olla tühistus.
  assert.match(detail, /deleteResearchJobForOwner\(/);
  assert.doesNotMatch(detail, /await cancelResearchJob\(/, "cancelling is the stop route's job, not delete's");
  assert.match(detail, /research\.error\.stop_before_delete[\s\S]{0,40}409/);
  assert.match(stop, /cancelResearchJob\(/);

  // Klient: Stop läheb stop-marsruudile, mitte DELETE-le.
  const hook = read("components/chat/hooks/useChatStream.js");
  assert.match(hook, /\/stop`, \{\s*method: "POST"/);
  assert.doesNotMatch(hook, /research\/jobs\/\$\{encodeURIComponent\(activeResearchJobId\)\}`, \{\s*method: "DELETE"/);
});

// SOL-RES-02. Idempotentsus toimis kahes kihis vastupidise tähendusega: võti sidus kasutusühikut,
// aga töö loodi alati uue UUID-ga, ja tavaklient ei saatnud võtit üldse.
test("one client intent binds one research job", () => {
  const route = read("app/api/research/jobs/route.js");
  const store = read("lib/research/jobStore.js");
  const hook = read("components/chat/hooks/useChatStream.js");

  assert.match(route, /claimResearchJobForIntent\(/, "the route must claim the job by intent key");
  assert.doesNotMatch(route, /await createResearchJob\(/, "the raw create must not bypass the intent claim");
  assert.match(route, /clientIntentKey: payload\?\.idempotencyKey/);
  assert.match(route, /INTENT_CONFLICT[\s\S]{0,400}research\.error\.intent_conflict", 409/, "same key with a different payload is a conflict");
  assert.match(route, /if \(reusedIntent\)[\s\S]{0,160}reused: true/, "a retry must not start a second run");

  assert.match(store, /clientIntentKey: clientIntentKey \|\| null/);
  // Kaks eri unikaalsust ei tohi ühe veateate alla suruda.
  assert.match(store, /target\.includes\("clientIntentKey"\)/);

  // Klient saadab stabiilse võtme ja kustutab ta alles serveri kindla vastuse peale.
  assert.match(hook, /createAttempt\.intentKey = researchIntentRef\.current\.key/);
  assert.match(hook, /idempotencyKey: createAttempt\.intentKey/);
  assert.match(hook, /researchIntentRef\.current = null/);
});

// SOL-RES-03. Päritoluprotsess hoidis IGA töö kohta runtime-objekti, ka siis kui teda jooksutas
// hoopis teine protsess — ja kõik lugejad eelistasid seda objekti andmebaasile.
test("only the process that actually runs a job keeps a runtime object for it", () => {
  const store = read("lib/research/jobStore.js");

  assert.match(store, /RESEARCH_JOB_MODE/, "the store must know whether this process runs jobs");
  assert.match(store, /ownedByThisProcess: RESEARCH_JOB_MODE !== "worker"/);
  assert.match(
    store,
    /if \(job\.ownedByThisProcess\) \{\s*jobs\.set\(id, job\);/,
    "a job this process will not run must not enter the local map"
  );
  // Võõra protsessi objekt ei tohi jääda igaveseks, kui ta kuidagi tekib.
  assert.match(store, /if \(job\.ownedByThisProcess === false\) return true;/);
  // Taaskasutatud kavatsuse lõppseis tuleb andmebaasist, mitte mälust.
  assert.match(store, /const local = jobs\.get\(record\.id\);\s*if \(local && !terminalStatus\(record\.status\)\) return local;/);
});

// SOL-RES-04. Heartbeat ei vaadanud kunagi `count` väärtust, progress kirjutas tingimusteta ja
// terminalsiire nõudis ainult aktiivset staatust — seega kaotatud lease ei peatanud mitte midagi.
test("a worker that lost its lease can no longer write", () => {
  const store = read("lib/research/jobStore.js");

  assert.match(store, /function leaseFence\(job\)[\s\S]{0,120}workerId: job\?\.workerId \|\| null/);
  // Progressi kirjutus on tingimuslik ja count === 0 katkestab töö.
  assert.match(store, /updateMany\(\{\s*where: \{ id: job\.id, \.\.\.leaseFence\(job\) \}/);
  assert.match(store, /if \(!result\?\.count\) \{\s*abandonLostLease\(job\);/);
  // Terminaalne TULEMUS on fence'itud, TÜHISTUS mitte — muidu kukuks omaniku Stop alati läbi.
  assert.match(store, /\.\.\.\(fence \? leaseFence\(job\) : \{\}\)/);
  assert.match(store, /status: "cancelled",[\s\S]{0,200}\{ fence: false \}/);
  // Heartbeat peab count'i lugema ja töö katkestama.
  assert.match(store, /const result = await prisma\.researchJob\.updateMany\([\s\S]{0,400}abandonLostLease\(job\)/);
  // Pipeline'i „kas tohin jätkata" küsimus peab nägema ka lease'i kaotust, mitte ainult tühistust.
  assert.match(store, /select: \{ status: true, error: true, workerId: true \}/);
  assert.match(store, /String\(record\.workerId \|\| ""\) !== String\(job\.workerId \|\| ""\)/);
});

// SOL-RES-05. Persistence neelas kõik vead ja pipeline ei vaadanud tagastusväärtust: uuring
// märgiti `done` ja kasutus commit'iti ka siis, kui vestlusse ei jäänud raportist jälgegi.
test("research completion requires a confirmed durable copy in the conversation", () => {
  const pipeline = read("lib/research/pipeline.js");
  const persistence = read("lib/chat/persistence.js");

  // Lõpp on seotud kinnitatud koopiaga, mitte kutse tegemisega.
  assert.match(pipeline, /conversationCopyConfirmed = Boolean\(persisted\?\.assistantMessageId\)/);
  const guardIndex = pipeline.indexOf("if (!conversationCopyConfirmed)");
  const doneIndex = pipeline.indexOf("await markResearchDone(");
  assert.ok(guardIndex > 0 && guardIndex < doneIndex, "the guard must come before markResearchDone");
  assert.match(pipeline, /if \(!conversationCopyConfirmed\)[\s\S]{0,600}return;/, "an unconfirmed copy must not fall through to done");

  // Kirjutus on job-idempotentne (ühtlasi SOL-RES-04 kriteeriumi viimane lause).
  assert.match(pipeline, /persistKey = `research:\$\{job\.id\}`/);
  assert.match(persistence, /metadata: \{ path: \["persistKey"\], equals: idempotencyKey \}/);
  assert.match(persistence, /return \{ assistantMessageId: existing\.id, reused: true \}/);
});

// SOL-RES-06. Arveldus oli best-effort: vead neelati täielikult, seega edukaks märgitud töö võis
// jääda arvestamata ja tühistatud töö hoidis kvooti TTL-ini kinni.
test("usage settlement leaves a durable mark and is retried", () => {
  const store = read("lib/research/jobStore.js");

  // Võti on leitav ka siis, kui objekt tuli snapshot'ist ilma payload'ita.
  assert.match(store, /async function resolveResearchUsageKey\(job\)[\s\S]{0,400}researchJob\.findUnique/);
  // Õnnestumine ja ebaõnnestumine jäävad mõlemad reale kirja.
  assert.match(store, /usageSettledAt: nowIso\(\)/);
  assert.match(store, /usageSettlePending: \{ action, reason: reason \|\| null, at: nowIso\(\) \}/);
  // Pooleli arveldust korratakse.
  assert.match(store, /export async function retryPendingResearchUsageSettlements/);
  assert.match(store, /path: \["usageSettlePending", "action"\], not: Prisma\.DbNull/);
  assert.match(store, /await maybeRetryPendingSettlements\(\);/);
});

// SOL-RES-07. `detach()` jätab serveritöö teadlikult käima; taasavamisel leitakse sama vestluse
// aktiivne töö, tarbitakse tema elavat voogu ja seotakse Stop uuesti sama töö ID-ga.
test("an active research job can be found again and stopped after a soft nav", () => {
  const store = read("lib/research/jobStore.js");
  const route = read("app/api/research/jobs/route.js");
  const hook = read("components/chat/hooks/useChatStream.js");
  const chatBody = read("components/alalehed/ChatBody.jsx");
  const chatRun = read("app/api/chat/run/route.js");
  const documents = read("components/documents/DocumentsPage.jsx");

  // Server oskab anda sama vestluse aktiivse töö.
  assert.match(store, /convId = null,[\s\S]{0,80}activeOnly = false/);
  assert.match(store, /payload: \{ path: \["convId"\], equals: conversationId \}/);
  assert.match(store, /activeOnly \? \{ status: \{ in: ACTIVE_STATUSES \} \}/);
  assert.match(route, /convId: requestUrl\.searchParams\.get\("convId"\)/);
  assert.match(route, /intentKey: requestUrl\.searchParams\.get\("intentKey"\)/);
  assert.match(store, /clientIntentKey: normalizedIntentKey/);

  // Vestluse avamisel seotakse Stop uuesti selle töö ID-ga ja avatakse olemasoleva töö GET-voog.
  assert.match(hook, /const lookupAttempt = researchLookupGateRef\.current\.begin\(convId\)/);
  assert.match(hook, /signal: withRequestTimeout\(lookupAttempt\.signal, RESEARCH_ACTIVE_LOOKUP_TIMEOUT_MS\)/);
  assert.match(hook, /claimActiveResearchLookupResult\(\{/);
  assert.match(hook, /researchLookupGateRef\.current\?\.invalidate\(\)/);
  assert.match(hook, /startResearchJobStream\(\{/);
  assert.match(hook, /researchJobIdRef\.current = id/);
  assert.equal(
    (hook.match(/\/api\/research\/jobs\/\$\{encodeURIComponent\(id\)\}\/stream/g) || []).length,
    1,
    "fresh and resumed jobs must share one stream consumer"
  );
  assert.match(chatRun, /researchJobId: readResearchJobId\(currentAssistant\?\.metadata\)/);
  assert.match(hook, /expectedResearchJobId: id/);
  assert.match(chatBody, /researchResumeEnabled: !workspaceOpen/);
  assert.match(hook, /const researchResumeEnabled = config\?\.researchResumeEnabled !== false/);
  assert.match(hook, /if \(!researchResumeEnabled\) \{[\s\S]{0,400}teardownLocalStream\(\);/);

  // „Minu dokumentide" aktiivsel real on nüüd Stop, mitte ainult vestluse link.
  assert.match(documents, /async function stopResearch\(id\)/);
  assert.match(documents, /\/stop`, \{ method: "POST" \}/);
  assert.match(documents, /research_stop"\)/);
});

// --- Contract 5: deep research survives soft navigation; only an explicit Stop cancels it. ---

test("the chat stream hook cancels the durable job only on explicit stop, never on soft detach", () => {
  const hook = read("components/chat/hooks/useChatStream.js");
  assert.match(hook, /const teardownLocalStream = useCallback/);
  assert.match(hook, /const detach = useCallback\(\(\) => \{\s*teardownLocalStream\(\);/);
  // SOL-RES-01: tühistus läheb nüüd stop-marsruudile, mitte DELETE-le (DELETE kustutab).
  assert.match(hook, /createResearchActiveStopRegistry\(\)/);
  assert.match(hook, /researchActiveStopRegistryRef\.current\.requestStop\(\{/);
  assert.match(hook, /currentClaim === target\.claim/);
  assert.match(hook, /currentClaim\.jobId === target\.jobId/);
  assert.match(hook, /currentClaim\.convId === target\.convId/);
  assert.match(hook, /requestResearchJobStop[\s\S]*?\/stop`, \{\s*method: "POST"/);
  assert.match(hook, /pendingCreate\.stopRequested = true;\s*void pendingCreate\.requestStop\?\.\(\)/);
  assert.match(hook, /createResearchCreateStopCoordinator\(\{\s*convId: createAttempt\.convId/);
  assert.match(hook, /createResearchJobRequest\(\{\s*controller,\s*payload:/);
  assert.match(hook, /signal: timeoutSignalImpl\(controller\?\.signal \|\| null, timeoutMs\)/);
  assert.match(hook, /createAttempt\.stopCoordinator\.recordCreateJob\(\{/);
  assert.match(hook, /createAttempt\.stopCoordinator\?\.recordCreateFailure\(\)/);
  assert.match(hook, /if \(createAttempt\.stopRecoveryPromise\) return createAttempt\.stopRecoveryPromise/);
  assert.match(hook, /stopAttemptGate: createResearchExplicitStopAttemptGate\(\)/);
  assert.match(hook, /stopAttemptGate\.begin\(\{ explicit \}\)/);
  assert.match(hook, /createAttempt\.requestStop = \(\) => requestPendingCreateStop\(null, \{ explicit: true \}\)/);
  // detach ei tohi tühistada: ainus stop-kutse failis on selle sees.
  assert.equal((hook.match(/\/stop`, \{\s*method: "POST"/g) || []).length, 1, "there is exactly one stop call (the explicit stop)");
  assert.equal((hook.match(/method:\s*"DELETE"/g) || []).length, 0, "the hook must never delete a research job");
  assert.match(hook, /detach\s*\n?\s*\};\s*\}/, "detach is returned from the hook");
});

test("ChatBody leaves the research job running on unmount and conversation switch", () => {
  const chatBody = read("components/alalehed/ChatBody.jsx");
  assert.match(chatBody, /detach:\s*detachChatStream/);
  // Unmount cleanup detaches (was stop()).
  assert.match(chatBody, /return \(\) => \{\s*detach\(\);\s*\};\s*\}, \[detach\]\)/);
  // Fresh conversation / soft-nav detaches too.
  assert.match(chatBody, /detach\(\);\s*setErrorBanner\(null\)/);
});

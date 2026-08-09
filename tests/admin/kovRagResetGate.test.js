/**
 * SOL-RAGADMIN-04 — hävitav KOV RAG reset ei tohi joosta ilma serveripoolse
 * kinnitusega.
 *
 * MIDA SIIN TÕENDATAKSE. Reset kirjutas pelga `confirmReset: true` peale. Kogu
 * kaitse elas brauseris (dry-run + `window.confirm`), seega **otsene API-kutse
 * jättis kinnitamise täielikult vahele** ja kinnitamise ning kirjutuse vahel
 * muutunud plaan võis kustutada rohkem, kui admin nägi.
 *
 * TESTI KUJU TULEB KRITEERIUMIST: „test peab tõendama, et muutunud plaan,
 * aegunud/kasutatud token ja kinnitamata otsekutse ei tee kõrvalmõjusid."
 * Seepärast on siin maailmamudel (auditiread + tehtud resetid) ja iga stsenaarium
 * lõpeb SAMA kontrolliga — `assertInvariant()`.
 *
 * INVARIANT: **iga tehtud reset kannab kehtivat, ühekordselt broneeritud
 * eelvaadet.** Reset ilma auditireata või kaks resetit ühe broneeringu peale
 * tähendab, et värav ei pidanud.
 *
 * NEGATIIVKONTROLL ON SISSE EHITATUD: sama kutse käib läbi ka VANA raja
 * (`legacyReset`) ja seal peab invariant KATKEMA.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { DangerousActionError } from "../../lib/admin/dangerousActionGate.js";
import {
  assertKovRagResetGate,
  KOV_RAG_RESET_AUDIT_ACTION,
  kovRagResetConfirmation,
  kovRagResetImpact,
  previewKovRagReset,
  recordKovRagResetOutcome
} from "../../lib/admin/rag/kov/resetGate.js";

const NOW = new Date("2026-08-09T12:00:00.000Z");
const ENV = { NODE_ENV: "test", ADMIN_DANGEROUS_ACTION_PREVIEW_SECRET: "test-preview-secret" };
const REQUEST = {
  headers: new Map([
    ["x-forwarded-for", "127.0.0.1"],
    ["user-agent", "ragadmin-04-test"]
  ])
};
const REASON = "Jõgeva pakett tuli valede allikatega sisse";

function planFor({
  slug = "harku-vald",
  docIds = ["kov-harku", "kov-rt-harku"],
  snapshotIds = ["snap_1"],
  adminId = "kov_1",
  layer = "all"
} = {}) {
  return {
    municipality: { slug },
    cleanup_layer: layer,
    planned_actions: {
      delete_rag_documents_via_service: docIds,
      archive_active_source_package_snapshots: snapshotIds,
      reset_kov_admin_state: adminId ? { admin_id: adminId, changes: ["ingestStatus"] } : null
    }
  };
}

/** Maailm: auditiread (= broneeringud) + päriselt tehtud resetid. */
function world() {
  const state = {
    audits: new Map(),
    resets: []
  };
  state.db = {
    dataAuditLog: {
      async create({ data }) {
        if (state.audits.has(data.id)) {
          const error = new Error("Unique constraint failed");
          error.code = "P2002";
          throw error;
        }
        state.audits.set(data.id, { ...data });
        return { ...data };
      },
      async findUnique({ where }) {
        return state.audits.get(where.id) || null;
      },
      async update({ where, data }) {
        const current = state.audits.get(where.id);
        if (!current) throw new Error("not found");
        const next = { ...current, ...data };
        state.audits.set(where.id, next);
        return next;
      }
    }
  };
  return state;
}

/**
 * INVARIANT: iga tehtud reset kannab kehtivat, ühekordset broneeringut.
 */
function assertInvariant(state, label) {
  for (const reset of state.resets) {
    assert.ok(
      reset.jti && state.audits.has(reset.jti),
      `${label}: reset tehti ilma auditireata (jti ${reset.jti || "puudub"})`
    );
  }
  const usedJtis = state.resets.map(reset => reset.jti);
  assert.equal(
    new Set(usedJtis).size,
    usedJtis.length,
    `${label}: sama broneeringu peale tehti mitu resetit`
  );
}

/** UUS rada, sama kuju mis marsruudil: värav → alles siis töö. */
async function runGatedReset(state, { plan, body, now = NOW }) {
  const gate = await assertKovRagResetGate({
    db: state.db,
    plan,
    body,
    actorUserId: "admin_1",
    request: REQUEST,
    now,
    env: ENV
  });
  state.resets.push({ slug: plan.municipality.slug, jti: gate.jti, reason: gate.reason });
  return gate;
}

/** VANA rada, sõna-sõnalt: `confirmReset: true` ja ei midagi muud. */
function legacyReset(state, { plan, body }) {
  if (body?.confirmReset !== true) return { ok: false };
  state.resets.push({ slug: plan.municipality.slug, jti: null });
  return { ok: true };
}

function preview(plan, { reason = REASON, now = NOW } = {}) {
  return previewKovRagReset({ plan, body: { reason }, now, env: ENV }).reset_gate;
}

function executionBody(gate, overrides = {}) {
  return {
    confirmReset: true,
    reason: REASON,
    confirmation: gate.confirmation,
    previewToken: gate.previewToken,
    ...overrides
  };
}

async function rejectsWith(state, promise, code, status = 400) {
  await assert.rejects(
    promise,
    error => error instanceof DangerousActionError && error.code === code && error.status === status,
    `oodatud ${code} (${status})`
  );
}

/* ── 1. terve rada ──────────────────────────────────────────────────────── */

test("SOL-RAGADMIN-04: eelvaade → täpne kinnitus → reset käib läbi ja jätab jälje", async () => {
  const state = world();
  const plan = planFor();
  const gate = preview(plan);

  assert.equal(kovRagResetImpact(plan), 4, "mõju = 2 dokumenti + 1 snapshot + 1 admini rida");
  assert.equal(gate.confirmation, "RESET KOV RAG harku-vald 4");
  assert.equal(gate.confirmation, kovRagResetConfirmation("harku-vald", 4));

  await runGatedReset(state, { plan, body: executionBody(gate) });

  assert.equal(state.resets.length, 1);
  const audit = [...state.audits.values()][0];
  assert.equal(audit.action, KOV_RAG_RESET_AUDIT_ACTION);
  assert.equal(audit.resourceType, "MunicipalityKovAdmin");
  assert.equal(audit.resourceId, "harku-vald");
  assert.equal(audit.actorUserId, "admin_1");
  assert.equal(audit.meta.reason, REASON, "põhjus ei jõudnud auditisse");
  assert.equal(audit.meta.impact, 4);
  assert.equal(audit.meta.result.status, "started", "jälg peab sündima ENNE tööd");
  assertInvariant(state, "1");
});

test("SOL-RAGADMIN-04: tulemus kirjutatakse SAMALE auditireale", async () => {
  const state = world();
  const plan = planFor();
  const gate = await runGatedReset(state, { plan, body: executionBody(preview(plan)) });

  await recordKovRagResetOutcome({
    db: state.db,
    jti: gate.jti,
    result: { status: "success", deletedDocCount: 2 }
  });

  const audit = state.audits.get(gate.jti);
  assert.equal(audit.meta.result.status, "success");
  assert.equal(audit.meta.result.deletedDocCount, 2);
  assert.equal(audit.meta.reason, REASON, "tulemuse kirjapanek kustutas põhjuse");
  assert.equal(state.audits.size, 1, "tulemus tekitas uue rea, mitte ei täiendanud vana");
  assertInvariant(state, "2");
});

/* ── 2. kinnitamata otsekutse — leiu tuum ──────────────────────────────── */

test("SOL-RAGADMIN-04: paljas confirmReset EI tee midagi", async () => {
  const state = world();
  const plan = planFor();

  await rejectsWith(
    state,
    runGatedReset(state, { plan, body: { confirmReset: true } }),
    "DANGEROUS_REASON_REQUIRED"
  );

  assert.deepEqual(state.resets, [], "reset tehti ilma igasuguse kinnitusega");
  assert.equal(state.audits.size, 0);
  assertInvariant(state, "3");
});

test("SOL-RAGADMIN-04: puuduv kinnitustekst ja puuduv token lükatakse eraldi tagasi", async () => {
  const state = world();
  const plan = planFor();

  await rejectsWith(
    state,
    runGatedReset(state, { plan, body: { confirmReset: true, reason: REASON } }),
    "DANGEROUS_CONFIRMATION_REQUIRED"
  );
  await rejectsWith(
    state,
    runGatedReset(state, { plan, body: { confirmReset: true, reason: REASON, confirmation: "RESET KOV RAG harku-vald 4" } }),
    "DANGEROUS_PREVIEW_REQUIRED"
  );

  assert.deepEqual(state.resets, []);
  assertInvariant(state, "4");
});

test("SOL-RAGADMIN-04: NEGATIIVKONTROLL — VANA rada teeb reseti sama kutse peale", async () => {
  const state = world();
  const plan = planFor();

  legacyReset(state, { plan, body: { confirmReset: true } });

  assert.equal(state.resets.length, 1, "vana rada EI teinud resetit — süst ei reprodutseeri leidu");
  assert.throws(
    () => assertInvariant(state, "negatiiv"),
    /reset tehti ilma auditireata/u,
    "vana rada EI rikkunud invarianti"
  );
});

/* ── 3. muutunud plaan ─────────────────────────────────────────────────── */

test("SOL-RAGADMIN-04: vahepeal MUUTUNUD plaan ei kehti", async () => {
  const state = world();
  const previewed = planFor();
  const gate = preview(previewed);

  /* Kinnitamise ja kirjutuse vahel tekkis üks dokument juurde. */
  const changed = planFor({ docIds: ["kov-harku", "kov-rt-harku", "kov-uus"] });

  await rejectsWith(state, runGatedReset(state, { plan: changed, body: executionBody(gate) }), "DANGEROUS_CONFIRMATION_INVALID");

  /* Ka siis, kui admin kirjutab UUE mõju arvu — token ise ei kehti. */
  await rejectsWith(
    state,
    runGatedReset(state, {
      plan: changed,
      body: executionBody(gate, { confirmation: kovRagResetConfirmation("harku-vald", 5) })
    }),
    "DANGEROUS_PREVIEW_STALE"
  );

  assert.deepEqual(state.resets, []);
  assertInvariant(state, "5");
});

test("SOL-RAGADMIN-04: SAMA ARVU juures vahetunud doc_id ei kehti samuti", async () => {
  /* Kogu sõrmejälje mõte: „13 dokumenti" jääb „13-ks" ka siis, kui üks dokument
     vahetub teise vastu. Paljas arv laseks siit läbi vale kustutuse. */
  const state = world();
  const gate = preview(planFor());
  const swapped = planFor({ docIds: ["kov-harku", "kov-hoopis-teine"] });

  assert.equal(kovRagResetImpact(swapped), 4, "stsenaarium ei mõõda leidu, kui mõju arv muutus");
  await rejectsWith(state, runGatedReset(state, { plan: swapped, body: executionBody(gate) }), "DANGEROUS_PREVIEW_STALE");

  assert.deepEqual(state.resets, []);
  assertInvariant(state, "6");
});

test("SOL-RAGADMIN-04: teise KOV-i plaan ei kehti — kinnitustekst kannab slug'i", async () => {
  const state = world();
  const gate = preview(planFor());
  const otherKov = planFor({ slug: "jogeva-vald" });

  /* Kinnitustekst ise kannab slug'i, seega vale KOV põrkab juba seal. */
  await rejectsWith(state, runGatedReset(state, { plan: otherKov, body: executionBody(gate) }), "DANGEROUS_CONFIRMATION_INVALID");

  /* Ja kui õige tekst kirjutada, ei kehti token — slug on ka sõrmejäljes. */
  await rejectsWith(
    state,
    runGatedReset(state, {
      plan: otherKov,
      body: executionBody(gate, { confirmation: kovRagResetConfirmation("jogeva-vald", 4) })
    }),
    "DANGEROUS_PREVIEW_STALE"
  );

  assert.deepEqual(state.resets, []);
  assertInvariant(state, "7");
});

test("SOL-RAGADMIN-04: muudetud põhjus ei kehti — kinnitati üks põhjus, mitte suvaline", async () => {
  const state = world();
  const plan = planFor();
  const gate = preview(plan);

  await rejectsWith(
    state,
    runGatedReset(state, { plan, body: executionBody(gate, { reason: "hoopis muu põhjus" }) }),
    "DANGEROUS_PREVIEW_STALE"
  );
  assertInvariant(state, "8");
});

/* ── 4. aegunud ja juba kasutatud token ────────────────────────────────── */

test("SOL-RAGADMIN-04: AEGUNUD eelvaade ei kehti", async () => {
  const state = world();
  const plan = planFor();
  const gate = preview(plan);

  const tooLate = new Date(NOW.getTime() + 5 * 60 * 1000 + 1);
  await rejectsWith(state, runGatedReset(state, { plan, body: executionBody(gate), now: tooLate }), "DANGEROUS_PREVIEW_STALE");

  /* Ja üks millisekund varem kehtib veel — piir on tegelik piir. */
  const justInTime = new Date(NOW.getTime() + 5 * 60 * 1000 - 1);
  await runGatedReset(state, { plan, body: executionBody(gate), now: justInTime });
  assert.equal(state.resets.length, 1);
  assertInvariant(state, "9");
});

test("SOL-RAGADMIN-04: JUBA KASUTATUD eelvaadet ei saa teist korda kasutada", async () => {
  const state = world();
  const plan = planFor();
  const gate = preview(plan);
  const body = executionBody(gate);

  await runGatedReset(state, { plan, body });
  await rejectsWith(state, runGatedReset(state, { plan, body }), "DANGEROUS_PREVIEW_ALREADY_USED", 409);

  assert.equal(state.resets.length, 1, "sama token tegi kaks resetit");
  assert.equal(state.audits.size, 1);
  assertInvariant(state, "10");
});

/* ── 5. token ise ──────────────────────────────────────────────────────── */

test("SOL-RAGADMIN-04: vale kinnitustekst, rikutud allkiri ja võõra saladusega token", async () => {
  const state = world();
  const plan = planFor();
  const gate = preview(plan);

  await rejectsWith(
    state,
    runGatedReset(state, { plan, body: executionBody(gate, { confirmation: "RESET KOV RAG harku-vald 3" }) }),
    "DANGEROUS_CONFIRMATION_INVALID"
  );

  const [payload, signature] = gate.previewToken.split(".");
  await rejectsWith(
    state,
    runGatedReset(state, { plan, body: executionBody(gate, { previewToken: `${payload}.${signature}x` }) }),
    "DANGEROUS_PREVIEW_INVALID"
  );
  await rejectsWith(
    state,
    runGatedReset(state, { plan, body: executionBody(gate, { previewToken: payload }) }),
    "DANGEROUS_PREVIEW_INVALID"
  );

  /* Võõra saladusega allkirjastatud token ei kehti — allkiri ON värav. */
  const foreign = previewKovRagReset({
    plan,
    body: { reason: REASON },
    now: NOW,
    env: { NODE_ENV: "test", ADMIN_DANGEROUS_ACTION_PREVIEW_SECRET: "hoopis-teine-saladus" }
  }).reset_gate;
  await rejectsWith(
    state,
    runGatedReset(state, { plan, body: executionBody(gate, { previewToken: foreign.previewToken }) }),
    "DANGEROUS_PREVIEW_INVALID"
  );

  assert.deepEqual(state.resets, []);
  assertInvariant(state, "11");
});

/* ── 6. marsruudi leping ───────────────────────────────────────────────── */

test("SOL-RAGADMIN-04: marsruut kasutab väravat ja täidab TÄPSELT üle vaadatud plaani", async () => {
  /* Ainus viis marsruuti katta ilma teda importimata (ta veab kaasa
     serveri-ainult ahelat). Kaitse selle vastu, et keegi ehitab väravata raja
     tagasi sisse. */
  const route = await readFile(
    new URL("../../app/api/admin/rag/kov/[slug]/reset-rag-state/route.js", import.meta.url),
    "utf8"
  );

  assert.match(route, /previewKovRagReset/, "dry-run ei anna kinnitusväravat");
  assert.match(route, /assertKovRagResetGate/, "kirjutusrada ei käi väravast läbi");
  assert.match(route, /executeKovRagStateResetBySlug\(slug, \{ plan \}\)/, "täitmisele ei lähe üle vaadatud plaan");
  assert.match(route, /DangerousActionError/, "värava tagasilükkamine ei jõua kasutajani");
  assert.match(route, /recordKovRagResetOutcome/, "tulemus ei jõua auditireale");
});

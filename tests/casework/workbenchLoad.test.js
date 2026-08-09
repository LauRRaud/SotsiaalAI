/**
 * JTA-V1 (E2) / SOL-CW-18 — laua TÄHTAEG ja KOORMUSPIIR.
 *
 * MIDA SIIN TÕENDATAKSE. Leid ei olnud „tähtaega ei ole" — `Promise.race` oli
 * olemas ja andis `TIMEOUT`-i. Leid oli, et **race ei katkesta midagi**: algne
 * päring jooksis edasi ja üks HTTP vastus võis jätta kuni kümme tööd ühendusi
 * ja CPU-d kasutama. Seepärast on siin kolme liiki teste:
 *
 *   1. andmebaasi katkestus (`57014`) muutub `TIMEOUT`-iks, mitte `ERROR`-iks
 *   2. laua pesa LEPING — statement-timeout, ülempiir, ühenduse ootamise piir
 *   3. sama kasutaja paralleelpäringute piir, sh loenduri LEKE
 *
 * Päris katkestust — et backend on pärast vastust KADUNUD — need testid ei
 * tõenda ega saagi tõendada: fake-Prisma ei ava ühtegi ühendust. Seda tõendab
 * `npm run casework:workbench:probe` päris PostgreSQL-i vastu.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { getCaseWorkbench, SECTION_STATE, WORKBENCH_SECTIONS } from "../../lib/casework/workbench.js";
import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";
import {
  WORKBENCH_DB_POOL_MAX,
  WORKBENCH_MAX_CONCURRENT_PER_USER,
  WORKBENCH_SECTION_DEADLINE_MS
} from "../../lib/casework/workbenchLimits.js";
import { WORKBENCH_APPLICATION_NAME, workbenchPoolConfig } from "../../lib/casework/workbenchDb.js";
import {
  acquireWorkbenchSlot,
  resetWorkbenchSlots,
  workbenchInFlightCount
} from "../../lib/casework/workbenchConcurrency.js";

const WORKER = { effectiveRole: "SOCIAL_WORKER" };
const NOW = new Date("2026-08-08T09:00:00.000Z");

function withFeature(value, fn) {
  return async (...args) => {
    const previous = process.env[CASEWORK_FLAG_KEYS.ENABLED];
    if (value === null) delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
    else process.env[CASEWORK_FLAG_KEYS.ENABLED] = value;
    try {
      return await fn(...args);
    } finally {
      if (previous === undefined) delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
      else process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous;
    }
  };
}

/**
 * Klient, mille IGA kutse kukub sama erindiga.
 *
 * Proxy, mitte käsitsi kirjutatud mudelid: sektsioonid kutsuvad kümmet eri
 * lugejat ja iga uus lugeja tooks käsitsi fake'i juurde ühe vaikselt katmata
 * raja. Siin kukub kõik, mida üldse puudutatakse.
 */
function rejectingDb(error) {
  const make = () => {
    const call = async () => {
      throw error;
    };
    return new Proxy(call, {
      /* `then` peab jääma määramata — muidu peaks `await` seda objekti
         lubaduseks ja test mõõdaks Proxy iseärasust, mitte lugejat. */
      get: (_target, prop) => (prop === "then" ? undefined : make()),
      apply: () => Promise.reject(error)
    });
  };
  return make();
}

/** Prisma 7 + `@prisma/adapter-pg` päris kuju, mõõdetud `pg_sleep`-iga. */
function statementTimeoutError() {
  const error = new Error("Raw query failed. Code: `57014`.");
  error.name = "PrismaClientKnownRequestError";
  error.code = "P2010";
  error.meta = {
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: { kind: "postgres", code: "57014", originalCode: "57014" }
    }
  };
  return error;
}

/** Kogub `console.error`/`console.warn` read, et test saaks nende üle otsustada. */
async function captureConsole(fn) {
  const errors = [];
  const warnings = [];
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = (...args) => errors.push(args);
  console.warn = (...args) => warnings.push(args);
  try {
    return { value: await fn(), errors, warnings };
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
}

/* ── 1. andmebaasi katkestus on TIMEOUT, mitte ERROR ────────────────────── */

test(
  "SOL-CW-18: andmebaasi katkestus (57014) annab TIMEOUT-i, mitte ERROR-i",
  withFeature("1", async () => {
    const { value, errors } = await captureConsole(() =>
      getCaseWorkbench({
        userId: "w1",
        roleState: WORKER,
        now: NOW,
        db: rejectingDb(statementTimeoutError())
      })
    );

    for (const key of WORKBENCH_SECTIONS) {
      const state = value.sections[key].state;
      /* `networkPreparation` on ainus, mis võib enne päringut FORBIDDEN-i anda;
         siin on roll töötaja, seega ka tema peab jõudma päringuni. */
      assert.equal(state, SECTION_STATE.TIMEOUT, `${key} ei ole TIMEOUT vaid ${state}`);
    }

    /* Katkestus ei ole „ootamatu viga": ta ei tohi minna vealogisse. */
    assert.equal(errors.length, 0, "statement-timeout logiti veana");
  })
);

test(
  "SOL-CW-18: NEGATIIVKONTROLL — muu erind annab endiselt ERROR-i",
  withFeature("1", async () => {
    /* Ilma selleta tõendaks eelmine test ainult seda, et miski annab TIMEOUT-i. */
    const plain = Object.assign(new Error("midagi muud"), { name: "PrismaClientKnownRequestError", code: "P2002" });
    const { value, errors } = await captureConsole(() =>
      getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: rejectingDb(plain) })
    );

    for (const key of WORKBENCH_SECTIONS) {
      assert.equal(value.sections[key].state, SECTION_STATE.ERROR, `${key} ei ole ERROR`);
    }
    assert.ok(errors.length > 0, "ootamatu viga jäi logimata");
  })
);

test(
  "SOL-CW-18: katkestus ja JS-tähtaeg on logis ERISTATAVAD",
  withFeature("1", async () => {
    /* Pärast seda parandust tähendab `deadline` hoopis teist viga kui
       `database`: rippumist, mis EI OLE päring. Ühine silt peidaks selle ära. */
    const fromDb = await captureConsole(() =>
      getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW, db: rejectingDb(statementTimeoutError()) })
    );
    const sources = fromDb.warnings.map(args => args[1]?.source);
    assert.ok(sources.length > 0, "katkestus ei jätnud logisse midagi");
    assert.ok(
      sources.every(source => source === "database"),
      `andmebaasi katkestus kandis vale allika: ${[...new Set(sources)].join(",")}`
    );
  })
);

test(
  "SOL-CW-18: väljas värav EI AVA ühendustepesa",
  withFeature(null, async () => {
    /* Klienti EI ANTA ette. Kui lugeja lahendaks pesa vaikeväärtusena, tekiks
       ta ka selle kutse jaoks — pesa funktsiooni jaoks, mida ei ole olemas. */
    const { value, errors } = await captureConsole(() =>
      getCaseWorkbench({ userId: "w1", roleState: WORKER, now: NOW })
    );
    for (const key of WORKBENCH_SECTIONS) {
      assert.equal(value.sections[key].state, SECTION_STATE.EMPTY);
    }
    assert.equal(errors.length, 0);
  })
);

/* ── 2. pesa leping ─────────────────────────────────────────────────────── */

test("SOL-CW-18: laua pesa kannab PÄRIS statement-timeout'i", () => {
  const config = workbenchPoolConfig("postgresql://user:pw@localhost:5432/db");

  /* SAMA ARV mis sektsiooni tähtaeg: päring ei tohi elada üle lubaduse, mille
     laud kasutajale annab. */
  assert.equal(config.statement_timeout, WORKBENCH_SECTION_DEADLINE_MS);
  assert.equal(config.max, WORKBENCH_DB_POOL_MAX);
  assert.equal(config.application_name, WORKBENCH_APPLICATION_NAME);

  /* Ammendunud pesa ei tohi oodata igavesti — muidu on rippumine tagasi, ainult
     ühenduse ootamise kujul. */
  assert.equal(config.connectionTimeoutMillis, WORKBENCH_SECTION_DEADLINE_MS);

  /* `query_timeout` on VALE tööriist: ta lükkab lubaduse tagasi kliendi pool ja
     server jätkab päringut edasi — täpselt see viga, mida leid kirjeldab. */
  assert.equal(config.query_timeout, undefined, "query_timeout jäljendaks parandust, aga ei katkestaks midagi");
});

test("SOL-CW-18: tähtaeg on ÜKS arv, mitte kaks kirjapanekut", async () => {
  /* Kaks numbrit läheksid esimese muudatusega lahku ja tagajärg oleks vaikne:
     laud lubaks 2,5 s, andmebaas laseks päringul edasi joosta. */
  const source = readFileSync(fileURLToPath(new URL("../../lib/casework/workbench.js", import.meta.url)), "utf8");
  assert.doesNotMatch(source, /WORKBENCH_SECTION_DEADLINE_MS\s*=\s*\d/, "tähtaeg on workbench.js-is uuesti kirjas");
  assert.match(source, /from "\.\/workbenchLimits\.js"/);

  const { WORKBENCH_SECTION_DEADLINE_MS: reexported } = await import("../../lib/casework/workbench.js");
  assert.equal(reexported, WORKBENCH_SECTION_DEADLINE_MS);
});

/* ── 3. kasutaja paralleelpäringute piir ────────────────────────────────── */

test("SOL-CW-18: piir lubab sama kasutajat ainult N korda korraga", () => {
  const registry = new Map();
  const held = [];
  for (let index = 0; index < WORKBENCH_MAX_CONCURRENT_PER_USER; index += 1) {
    const release = acquireWorkbenchSlot("w1", { registry });
    assert.ok(release, `${index + 1}. päring oleks pidanud läbi minema`);
    held.push(release);
  }

  assert.equal(acquireWorkbenchSlot("w1", { registry }), null, "piiri ületav päring läks läbi");

  /* Teine kasutaja ei tohi esimese piiri taha jääda — muidu oleks üks aeglane
     inimene kõigi teiste väravavaht. */
  const other = acquireWorkbenchSlot("w2", { registry });
  assert.ok(other, "võõras kasutaja jäi teise kvoodi taha");

  held.pop()();
  assert.ok(acquireWorkbenchSlot("w1", { registry }), "vabastatud slott ei vabanenud");
});

test("SOL-CW-18: KAKS KORDA vabastamine ei tõsta piiri vaikselt üles", () => {
  const registry = new Map();
  const release = acquireWorkbenchSlot("w1", { registry });
  release();
  release();
  release();

  assert.equal(workbenchInFlightCount("w1", { registry }), 0);

  const held = [];
  for (let index = 0; index < WORKBENCH_MAX_CONCURRENT_PER_USER; index += 1) {
    held.push(acquireWorkbenchSlot("w1", { registry }));
  }
  assert.ok(held.every(Boolean));
  /* Kui topeltvabastus oleks loenduri miinusesse viinud, mahuks siia veel üks. */
  assert.equal(acquireWorkbenchSlot("w1", { registry }), null, "loendur läks topeltvabastusega miinusesse");
});

test("SOL-CW-18: vabastatud kasutaja ei jäta rida mällu", () => {
  const registry = new Map();
  for (let index = 0; index < 50; index += 1) {
    const release = acquireWorkbenchSlot(`user_${index}`, { registry });
    release();
  }
  /* `0` seisma jätmine tähendaks, et iga kunagi lauda avanud kasutaja jääb
     protsessi mällu igaveseks. */
  assert.equal(registry.size, 0, `registrisse jäi ${registry.size} rida`);
});

test("SOL-CW-18: kasutajata päring ei võta kellegi slotti", () => {
  const registry = new Map();
  assert.equal(acquireWorkbenchSlot("", { registry }), null);
  assert.equal(acquireWorkbenchSlot(null, { registry }), null);
  assert.equal(registry.size, 0);
  resetWorkbenchSlots({ registry });
});

test("SOL-CW-18: koormussond on olemas ja tal on NEGATIIVKONTROLL", () => {
  /* Sond, mis mõõdab ainult uut rada, ei tõenda midagi: kui `pg_sleep` juhtumisi
     lõpeb, on ka katkestamata töö „kadunud". Vana rada peab samas jooksus olema
     tõendatult ELUS. */
  const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"));
  assert.ok(pkg.scripts["casework:workbench:probe"], "koormussondi käsku ei ole");

  const probe = readFileSync(
    fileURLToPath(new URL("../../scripts/casework-workbench-probe.mjs", import.meta.url)),
    "utf8"
  );
  assert.match(probe, /pg_stat_activity/, "sond ei vaata päris backend'e");
  assert.match(probe, /leiu-eelne seis/, "sondil puudub vana raja negatiivkontroll");
  assert.match(probe, /workbenchPoolConfig\(/, "sond ei mõõda PÄRIS pesa konfiguratsiooni");
  assert.match(probe, /DROP DATABASE IF EXISTS/, "sond ei kustuta oma andmebaasi");
  assert.match(probe, /SELECT 1 FROM pg_database WHERE datname/, "koristust ei kontrollita");
});

test("SOL-CW-18: marsruut võtab sloti PÄRAST väravat ja vabastab `finally`-s", () => {
  const route = readFileSync(
    fileURLToPath(new URL("../../app/api/casework/workbench/route.js", import.meta.url)),
    "utf8"
  );

  const guardAt = route.indexOf("guardCaseWorkRequest");
  const acquireAt = route.indexOf("acquireWorkbenchSlot(");
  assert.ok(guardAt > -1 && acquireAt > guardAt, "slott võetakse enne väravat — autentimata päring kulutaks kvooti");

  assert.match(route, /tooManyRequests\(\)/, "piiri ületamine ei anna 429");
  /* Vabastamata slott jätaks kasutaja igaveseks 429 taha ja seda ei parandaks
     ükski järgmine päring. */
  assert.match(route, /finally\s*\{\s*[^}]*release\(\)/s, "slotti ei vabastata `finally`-s");
});

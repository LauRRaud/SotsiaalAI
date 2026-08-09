/**
 * JTA-V1 / SOL-CW-14 — säilitustöö ajastuse ja järelevalve leping.
 *
 * MIDA SIIN TÕENDATAKSE. Leid ei olnud „loogika on katki" — `runRetention()` oli
 * olemas ja testitud. Leid oli, et **koodis olev säilitusreegel ei muutu
 * iseenesest päris tööks**: cron oli näide skripti päises ja keegi ei saanud
 * vastata kolmele küsimusele — millal töö viimati õnnestus, millal ta järgmine
 * kord käib, kas keegi märkab, kui ta lakkab käimast.
 *
 * Seepärast on siin kaks liiki teste:
 *   1. tervisefunktsiooni käitumine MÕLEMAST otsast (roheline JA alarm)
 *   2. ajastuse enda LEPING — unit-failide sisu, sest ajastus, mida ei ole
 *      repositooriumis, ei ole platvormi oma
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  RETENTION_ALARM_MISSED_INTERVALS,
  RETENTION_HEALTH,
  RETENTION_INTERVAL_MINUTES,
  evaluateRetentionHealth,
  finishRetentionRun,
  getRetentionHealth,
  startRetentionRun
} from "../../lib/casework/retentionRuns.js";

const MINUTE = 60_000;
const NOW = new Date("2026-08-09T12:00:00.000Z");

function minutesAgo(minutes) {
  return new Date(NOW.getTime() - minutes * MINUTE);
}

async function readRepoFile(relative) {
  return readFile(new URL(`../../${relative}`, import.meta.url), "utf8");
}

/* ── tervis: roheline ja alarm ──────────────────────────────────────────── */

test("SOL-CW-14: värske edukas jooks on OK ja ütleb järgmise jooksu VÄLJA", () => {
  const health = evaluateRetentionHealth({
    lastSuccessAt: minutesAgo(10),
    lastRunAt: minutesAgo(10),
    lastRunOk: true,
    now: NOW
  });

  assert.equal(health.state, RETENTION_HEALTH.OK);
  assert.equal(health.reason, null);
  assert.equal(health.staleMinutes, 10);
  /* Järgmine jooks tuleb VIIMASEST JOOKSUST, mitte viimasest õnnestumisest. */
  assert.equal(health.nextRunAt.toISOString(), new Date(minutesAgo(10).getTime() + 60 * MINUTE).toISOString());
});

test("SOL-CW-14: üks vahelejäänud jooks EI OLE alarm, kaks on", () => {
  /* Üks vahelejäänud jooks on taaskäivitus või aeglane host; temast alarmi
     tegemine õpetab inimest alarmi eirama. */
  const üks = evaluateRetentionHealth({ lastSuccessAt: minutesAgo(90), lastRunAt: minutesAgo(90), now: NOW });
  assert.equal(üks.state, RETENTION_HEALTH.OK, "üks vahelejäänud jooks tegi alarmi");

  const kaks = evaluateRetentionHealth({ lastSuccessAt: minutesAgo(200), lastRunAt: minutesAgo(200), now: NOW });
  assert.equal(kaks.state, RETENTION_HEALTH.ALARM);
  assert.equal(kaks.reason, "casework.retention.health.stale");

  /* Lävi on AJAS ja tuleb intervallist — ajastuse muutmine ei tohi järelevalvet
     vaikselt katki teha. */
  const lävi = RETENTION_INTERVAL_MINUTES * RETENTION_ALARM_MISSED_INTERVALS;
  assert.equal(evaluateRetentionHealth({ lastSuccessAt: minutesAgo(lävi), lastRunAt: minutesAgo(lävi), now: NOW }).state, RETENTION_HEALTH.OK);
  assert.equal(
    evaluateRetentionHealth({ lastSuccessAt: minutesAgo(lävi + 1), lastRunAt: minutesAgo(lävi + 1), now: NOW }).state,
    RETENTION_HEALTH.ALARM
  );
});

test("SOL-CW-14: ükski jooks kunagi = NEVER_RUN, mitte vaikne OK", () => {
  /* See ONGI leiu seis: ajastust ei ole paigaldatud. Vaikne OK oleks siin kõige
     halvem vastus — ta ütleks, et töö käib. */
  const health = evaluateRetentionHealth({ lastSuccessAt: null, lastRunAt: null, now: NOW });
  assert.equal(health.state, RETENTION_HEALTH.NEVER_RUN);
  assert.equal(health.nextRunAt, null, "järgmine jooks mõeldi välja ilma ühegi jooksuta");
  assert.equal(health.lastSuccessAt, null);
});

test("SOL-CW-14: jooksud käivad, aga ükski ei õnnestu → ALARM", () => {
  /* Kukkuv töö on halvem kui puuduv töö, sest ta näeb logis välja nagu töö. */
  const health = evaluateRetentionHealth({ lastSuccessAt: null, lastRunAt: minutesAgo(5), lastRunOk: false, now: NOW });
  assert.equal(health.state, RETENTION_HEALTH.ALARM);
  assert.equal(health.reason, "casework.retention.health.never_succeeded");
  assert.equal(health.lastRunOk, false);
  assert.ok(health.nextRunAt, "järgmine jooks peab olema teada ka siis, kui viimane kukkus");
});

/* ── jooksurida: enne tööd, mitte pärast ────────────────────────────────── */

function runsDb(rows = []) {
  let sequence = 0;
  return {
    rows,
    caseWorkRetentionRun: {
      async create({ data }) {
        const row = { id: `run_${++sequence}`, finishedAt: null, ok: false, failed: 0, ...data };
        rows.push(row);
        return row;
      },
      async updateMany({ where, data }) {
        const matching = rows.filter((row) => row.id === where.id);
        for (const row of matching) Object.assign(row, data);
        return { count: matching.length };
      },
      async findFirst({ where = {}, orderBy }) {
        const sorted = [...rows].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
        void orderBy;
        return (
          sorted.find((row) =>
            Object.entries(where).every(([field, value]) => row[field] === value)
          ) || null
        );
      }
    }
  };
}

test("SOL-CW-14: rida tekib ENNE tööd ja pooleli jäänud jooks ei ole `ok`", async () => {
  /* Rida, mis kirjutatakse alles lõpus, ei jäta protsessi tapmisest mingit
     jälge — surnud töö näeks välja täpselt nagu töö, mis ei käivitunudki. */
  const store = runsDb();
  const run = await startRetentionRun({ startedAt: NOW, db: store });

  assert.equal(store.rows.length, 1, "jooksu rida tekkis alles pärast tööd");
  assert.equal(store.rows[0].ok, false);
  assert.equal(store.rows[0].finishedAt, null);

  const health = await getRetentionHealth({ now: NOW, db: store });
  assert.equal(health.state, RETENTION_HEALTH.ALARM, "pooleli jäänud jooks luges end edukaks");
  assert.ok(run.id);
});

test("SOL-CW-14: tõrgetega partii EI OLE edukas jooks", async () => {
  /* `runRetention()` teadlikult ei peata end ühe kukkunud rea peale — aga see
     tähendab, et rida jäi töötlemata, ja täpselt see peab järelevalveni jõudma. */
  const store = runsDb();
  const run = await startRetentionRun({ startedAt: NOW, db: store });
  await finishRetentionRun({ runId: run.id, result: { draftsPurged: 3, failed: 1 }, db: store });

  assert.equal(store.rows[0].ok, false);
  assert.equal(store.rows[0].failed, 1);
  assert.equal(store.rows[0].draftsPurged, 3);

  const health = await getRetentionHealth({ now: NOW, db: store });
  assert.equal(health.state, RETENTION_HEALTH.ALARM);
  assert.equal(health.lastRun.failed, 1);
});

test("SOL-CW-14: erindi TEADET ei salvestata, ainult klass ja kood", async () => {
  /* Prisma paneb ebaõnnestunud päringu argumendid teatesse ja mõni teenuskiht
     kirje teksti — sama põhjendus mis laual (L13). */
  const store = runsDb();
  const run = await startRetentionRun({ startedAt: NOW, db: store });
  const error = Object.assign(new Error("kliendi nimi Mari Tamm ja tema juhtumi sisu"), {
    name: "PrismaClientKnownRequestError",
    code: "P2002"
  });
  await finishRetentionRun({ runId: run.id, error, db: store });

  const serialized = JSON.stringify(store.rows[0]);
  assert.equal(serialized.includes("Mari Tamm"), false, "erindi teade jõudis jooksuritta");
  assert.equal(store.rows[0].errorName, "PrismaClientKnownRequestError");
  assert.equal(store.rows[0].errorCode, "P2002");
  assert.equal(store.rows[0].ok, false);
});

test("SOL-CW-14: KUIV käivitus ei kõlba tõendiks, et töö toimib", async () => {
  const store = runsDb();
  const dry = await startRetentionRun({ startedAt: minutesAgo(5), dryRun: true, db: store });
  await finishRetentionRun({ runId: dry.id, result: { draftsPurged: 2, failed: 0 }, db: store });

  assert.equal(store.rows[0].ok, true, "kuiv jooks ise õnnestus");
  const health = await getRetentionHealth({ now: NOW, db: store });
  assert.equal(health.state, RETENTION_HEALTH.ALARM, "kuiv käivitus luges end päris tõendiks");
  assert.equal(health.lastSuccessAt, null);
});

test("SOL-CW-14: päris edukas jooks teeb tervise roheliseks", async () => {
  const store = runsDb();
  const run = await startRetentionRun({ startedAt: minutesAgo(5), db: store });
  await finishRetentionRun({
    runId: run.id,
    result: { draftsPurged: 1, draftFieldsDeleted: 4, warningsSent: 2, casesDeleted: 0, failed: 0 },
    finishedAt: minutesAgo(4),
    db: store
  });

  const health = await getRetentionHealth({ now: NOW, db: store });
  assert.equal(health.state, RETENTION_HEALTH.OK);
  assert.equal(health.lastSuccessAt.toISOString(), minutesAgo(4).toISOString());
  assert.ok(health.nextRunAt, "järgmine jooks puudub");
});

/* ── ajastuse leping ────────────────────────────────────────────────────── */

test("SOL-CW-14: ajastus ELAB REPOSITOORIUMIS ja on lukustatud", async () => {
  /* Ajastus, mis elab ainult ühe masina crontabis, ei ole platvormi oma — ja
     just tema puudumine jäi märkamatuks. */
  const service = await readRepoFile("deploy/systemd/sotsiaalai-casework-retention.service");
  const timer = await readRepoFile("deploy/systemd/sotsiaalai-casework-retention.timer");

  /* LUKK: kaks korraga käivitunud partiid võitleksid samade ridade pärast. */
  assert.match(service, /flock -n \/var\/lock\/sotsiaalai-casework-retention\.lock/, "lukku ei ole");
  assert.match(service, /npm run casework:retention/, "teenus ei käivita säilitustööd");
  /* Env tuleb serverist, mitte skripti seest. */
  assert.match(service, /EnvironmentFile=\/etc\/sotsiaalai\/frontend\.env/, "env-fail puudub");
  /* Kinni jäänud jooks hoiaks LUKKU ja kõik järgmised jooksud jääksid tegemata. */
  assert.match(service, /TimeoutStartSec=\d+/, "ühe jooksu ülempiir puudub");

  /* RETRY tuleb taimerilt, sest `oneshot` ei tohi `Restart`-i kanda. */
  assert.match(timer, /OnCalendar=hourly/, "ajastus ei ole tunnipõhine");
  assert.match(timer, /Persistent=true/, "vahelejäänud jooksu ei tehta järele");
  assert.doesNotMatch(service, /^Restart=/m, "`oneshot` + `Restart` ei ole lubatud kombinatsioon");
});

test("SOL-CW-14: deploy PAIGALDAB unit-failid, aga EI LUBA taimerit sisse", async () => {
  /* `SotsiaalAI.md` S1 lukustab järjekorra: andmekaitseanalüüs → cron →
     kuivjooks → aktiveerimine. Unit-failide olemasolu ei aktiveeri midagi. */
  const deploy = await readRepoFile("scripts/deploy-server.mjs");
  assert.match(deploy, /deploy\/systemd/, "deploy ei paigalda unit-faile");
  assert.match(deploy, /systemctl daemon-reload/, "daemon-reload puudub");
  assert.doesNotMatch(deploy, /systemctl enable[^\n]*\.timer/, "deploy lubab taimeri ise sisse");

  /* Ja lubamine on dokumenteeritud — mehhanism ilma juhiseta jääb paigaldamata. */
  const readme = await readRepoFile("deploy/systemd/README.md");
  assert.match(readme, /systemctl enable --now sotsiaalai-casework-retention\.timer/);
  assert.match(readme, /casework:retention:smoke/);
});

test("SOL-CW-14: smoke on olemas, käivitatav ja alarm annab MITTE-NULLI", async () => {
  /* Smoke, mis lõpeb alati koodiga 0, ütleb monitooringule „kõik hästi" ka siis,
     kui töö on kuu aega seisnud. */
  const pkg = JSON.parse(await readRepoFile("package.json"));
  assert.ok(pkg.scripts["casework:retention:smoke"], "smoke-käsku ei ole");

  const smoke = await readRepoFile("scripts/casework-retention-smoke.mjs");
  assert.match(smoke, /process\.exitCode = 1/, "alarm ei jõua väljumiskoodi");
  assert.match(smoke, /lastSuccessAt/, "smoke ei ütle viimast edukat jooksu");
  assert.match(smoke, /nextRunAt/, "smoke ei ütle järgmist jooksu");
  /* Väljas värav ei ole alarm — muidu õpib inimene alarmi eirama. */
  assert.match(smoke, /isCaseWorkEnabled/, "väljas värav teeks alarmi");
});

test("SOL-CW-14: käivitaja kirjutab jooksurea ka siis, kui töö KUKUB", async () => {
  const runner = await readRepoFile("scripts/casework-retention.mjs");
  assert.match(runner, /startRetentionRun/, "jooksurida ei alustata");
  /* Kaks kutset: õnnestumisel ja `catch`-is. Ilma teiseta jääks kukkunud jooks
     igaveseks „algas ja ei lõpetanud" seisu. */
  assert.equal((runner.match(/finishRetentionRun/g) || []).length >= 2, true, "kukkumisel jooksurida ei suleta");
});

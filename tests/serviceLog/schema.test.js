/**
 * TEENUSPÄEVIK-V1 E1 — skeemi ja migratsiooni lepingutestid.
 *
 * Miks skeemitestid: teenuskirje on arve alusdokument 7-aastase säilitusega.
 * Kui keegi hiljem muudab mõne inimeseviite `Cascade`-iks või langetab
 * `retentionClass` vaikeväärtust, kaob raamatupidamisdokument VAIKSELT — ilma
 * ühegi veateateta. Need testid teevad sellest valju vea.
 *
 * Leping: docs/platvormi arendus/aruandlus-teenuskirje-disain.md ptk 8.1, 5.1, 8.9.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
const migration = readFileSync(
  join(root, "prisma/migrations/20260802100000_service_log_v1/migration.sql"),
  "utf8"
);

const MODELS = ["ServiceReferral", "ServiceEntry", "ServiceMonthlyNarrative"];

function modelBlock(name) {
  return schema.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`))?.[0] || "";
}

test("kolm mudelit on nii skeemis kui migratsioonis", () => {
  for (const model of MODELS) {
    assert.match(schema, new RegExp(`model ${model} \\{`), `${model} puudub skeemist`);
    assert.match(
      migration,
      new RegExp(`CREATE TABLE "${model}"`),
      `${model} puudub migratsioonist`
    );
  }
});

test("tegevuskataloog lisandub olemasolevale teenusele, mitte uude tabelisse", () => {
  // Mall B (hoolduspäevik) nõuab tegevuste valimist LOETELUST. Kataloog kuulub
  // teenuse juurde, sest toimingud on teenusepõhised.
  assert.match(modelBlock("ServiceProviderService"), /activityCatalog\s+String\[\]\s+@default\(\[\]\)/);
  assert.match(migration, /ALTER TABLE "ServiceProviderService" ADD COLUMN\s+"activityCatalog"/);
});

test("kõik kolm mudelit kannavad 7a säilitusklassi juba sünnihetkest", () => {
  for (const model of MODELS) {
    assert.match(
      modelBlock(model),
      /retentionClass\s+String\s+@default\("accounting7y"\)/,
      `${model}: säilitusklass puudub või ei ole accounting7y`
    );
  }
});

test("konto kustutamine kustutab INIMESE, mitte raamatupidamisdokumendi", () => {
  // Iga User-viide on SetNull + eraldi ...ErasedAt märge. Kui mõni neist muutub
  // Cascade'iks, kaob 7a kirje koos kontoga.
  for (const model of MODELS) {
    const block = modelBlock(model);
    /* MUSTER KÜSIB `User`-i VÄLJA, mitte ainult seose nime.
       Vana kuju `/@relation\("Service[^"]*"[^)]*\)/` püüdis kinni ka
       TAGASISEOSED (`sourceVisit ServiceVisit? @relation("ServiceVisitEntry")`),
       millel `onDelete` ei saagi olla — ta elab omaval poolel. Test kukkus siis
       millegi peale, mida ta väita ei tahtnudki, ja päris regressiooni
       (`SetNull` → `Cascade` mõnel User-seosel) oleks ta ikka püüdnud. */
    const userRelations = block.match(/User\??\s+@relation\("Service[^"]*"[^)]*\)/g) || [];
    assert.ok(userRelations.length > 0, `${model}: User-seoseid ei leitud`);
    for (const relation of userRelations) {
      assert.match(
        relation,
        /onDelete:\s*SetNull/,
        `${model}: User-seos ei ole SetNull → 7a kirje kaoks konto kustutamisel`
      );
    }
    assert.match(block, /clientErasedAt\s+DateTime\?/, `${model}: clientErasedAt puudub`);
  }
  assert.match(modelBlock("ServiceEntry"), /ownerErasedAt\s+DateTime\?/);
});

test("osutaja profiili kustutamine on RESTRICT, mitte vaikne kaskaad", () => {
  // Leping 8.9 jätab lahtiseks, kas lahendus on anonüümitud säilitus või
  // eksport-ja-kustutus. Kuni otsust ei ole, ütleb DB valjult „ei".
  for (const model of MODELS) {
    assert.match(
      modelBlock(model),
      /providerProfile\s+ServiceProviderProfile\s+@relation\([^)]*onDelete:\s*Restrict\)/,
      `${model}: profiiliseos ei ole Restrict`
    );
    assert.match(
      migration,
      new RegExp(
        `ALTER TABLE "${model}" ADD CONSTRAINT "${model}_providerProfileId_fkey"[\\s\\S]*?ON DELETE RESTRICT`
      ),
      `${model}: migratsioonis ei ole RESTRICT`
    );
  }
});

test("tehtud töö jääb alles ka siis, kui suunamine kaob", () => {
  // Maht võib ära kukkuda, osutatud teenus mitte.
  assert.match(
    modelBlock("ServiceEntry"),
    /referral\s+ServiceReferral\?\s+@relation\([^)]*onDelete:\s*SetNull\)/
  );
});

test("migratsioon on puhtalt additiivne — ei muuda ega kustuta olemasolevat", () => {
  assert.doesNotMatch(migration, /DROP TABLE/i);
  assert.doesNotMatch(migration, /DROP COLUMN/i);
  assert.doesNotMatch(migration, /DROP CONSTRAINT/i);
  assert.doesNotMatch(migration, /ALTER COLUMN/i);
  assert.doesNotMatch(migration, /\bUPDATE\s+"/i);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM/i);

  // Ainus olemasolevat tabelit puudutav rida tohib olla activityCatalog'i lisamine.
  const alterTargets = [...migration.matchAll(/ALTER TABLE "([^"]+)"([^;]*)/g)];
  for (const [, table, rest] of alterTargets) {
    if (MODELS.includes(table)) continue;
    assert.equal(
      table,
      "ServiceProviderService",
      `migratsioon puudutab ootamatut olemasolevat tabelit: ${table}`
    );
    assert.match(rest, /ADD COLUMN\s+"activityCatalog"/);
  }
});

test("K1 reegel: ükski uus elutsükkel ei muutu Postgresi enum'iks", () => {
  // Ühikud, staatused ja päritolu elavad rakenduskihis (vt lib/workspaces/provenance.js).
  assert.doesNotMatch(migration, /CREATE TYPE/i);
  for (const field of ["unit", "status", "allocationPeriod"]) {
    assert.match(
      modelBlock("ServiceReferral"),
      new RegExp(`${field}\\s+String`),
      `${field} peab olema String, mitte enum`
    );
  }
  assert.match(modelBlock("ServiceEntry"), /noteProvenance\s+String\?/);
});

test("päritolusõnastikku ei dubleerita skeemi", () => {
  // Ainus sõnastik on lib/workspaces/provenance.js; skeemis ei tohi olla
  // teist koopiat, mis eraldi vananeks.
  assert.doesNotMatch(schema, /enum\s+\w*Provenance\w*\s*\{/);
});

test("teenuse kuupäev on kalendripäev, mitte ajahetk", () => {
  // Kuuaruande piir on täpselt see koht, kus ajavööndiga DateTime nihutaks
  // kirjeid vale kuu alla.
  assert.match(modelBlock("ServiceEntry"), /date\s+DateTime\s+@db\.Date/);
});

test("nelja märke voog on mudelis olemas ja asukoht on punkt, mitte jada", () => {
  const entry = modelBlock("ServiceEntry");
  for (const stamp of ["departedForVisitAt", "arrivedAt", "leftAt", "returnedAt"]) {
    assert.match(entry, new RegExp(`${stamp}\\s+DateTime\\?`), `${stamp} puudub`);
  }
  // Üks Json-väli ühekordsete templite jaoks — mitte eraldi asukohatabel, mis
  // kutsuks jada kogumist.
  assert.match(entry, /locationStamps\s+Json\?/);
  assert.doesNotMatch(schema, /model ServiceEntryLocation/);
});

test("üks kuunarratiiv kliendi kohta kuus — ka ilma suunamiseta", () => {
  assert.match(
    modelBlock("ServiceMonthlyNarrative"),
    /@@unique\(\[providerProfileId, referralId, periodYear, periodMonth\]\)/
  );
  // Prisma @@unique katab ainult suunamisega rea (NULL != NULL), seega
  // suunamiseta read vajavad osalisi indekseid — kaks rada, kaks indeksit.
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "ServiceMonthlyNarrative_noreferral_clientuser_key"[\s\S]*?WHERE "referralId" IS NULL AND "clientUserId" IS NOT NULL/
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "ServiceMonthlyNarrative_noreferral_clientname_key"[\s\S]*?WHERE "referralId" IS NULL AND "clientUserId" IS NULL/
  );
});

test("suunamine kannab mahtu JA perioodiloogikat — ilma nendeta ei saa saldot arvutada", () => {
  const referral = modelBlock("ServiceReferral");
  assert.match(referral, /allocatedQuantity\s+Decimal\?\s+@db\.Decimal\(10, 2\)/);
  assert.match(referral, /allocationPeriod\s+String\s+@default\("MONTH"\)/);
  assert.match(referral, /goalsText\s+String\?\s+@db\.Text/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source() {
  return readFile(
    new URL("../../components/benefits/SubsistenceCalculator.jsx", import.meta.url),
    "utf8"
  );
}

test("kalkulaator arvutab BRAUSERIS — sissetulek ei lahku seadmest", async () => {
  const s = await source();
  // Ükski fetch/XHR ei tohi siit välja minna. Sissetulek, pere koosseis ja
  // eluasemekulud on kõige tundlikum osa ja parim kaitse on mitte saata.
  assert.doesNotMatch(s, /fetch\(/);
  assert.doesNotMatch(s, /XMLHttpRequest|navigator\.sendBeacon/);
  assert.match(s, /import \{ estimateSubsistenceBenefit \}/);
});

test("kalkulaator ei salvesta midagi ega jäta jälge", async () => {
  const s = await source();
  assert.doesNotMatch(s, /localStorage|sessionStorage|document\.cookie/);
});

test("mõlemad lubadused seisavad ENNE vormi, mitte tulemuse juures", async () => {
  const s = await source();
  const notDecision = s.indexOf("subsistence.not_a_decision");
  const staysOnDevice = s.indexOf("subsistence.stays_on_device");
  const firstField = s.indexOf("subsistence.fields.adults");
  assert.ok(notDecision > -1 && notDecision < firstField, "'ei ole otsus' peab olema enne esimest välja");
  assert.ok(staysOnDevice > -1 && staysOnDevice < firstField, "'jääb seadmesse' peab olema enne esimest välja");
});

test("kasutamatu tulemuse korral summat EI kuvata", async () => {
  const s = await source();
  // Summa on ainult `usable` haru sees.
  const usableBranch = s.slice(s.indexOf("result.usable ? ("), s.indexOf("subsistence.result.incomplete"));
  assert.match(usableBranch, /result\.estimate\.toFixed/);
  const unusableBranch = s.slice(s.indexOf("subsistence.result.incomplete"));
  assert.doesNotMatch(unusableBranch, /result\.estimate/);
});

test("KOV piirmäärade hoiatus on nähtav tekst, mitte ainult koodikood", async () => {
  const s = await source();
  assert.match(s, /KOV_HOUSING_LIMITS_UNKNOWN/);
  assert.match(s, /subsistence\.caveat\.kov_limits/);
});

test("sama puudujääk ei kuvata kaks korda", async () => {
  const s = await source();
  // Kaks vastamata väravat annavad sama teate — kordus näeb välja nagu viga.
  assert.match(s, /new Set\(result\.issues\.map/);
});

test("kalkulaator NÕUAB kontot — autentimata kasutajale vormi ei näidata", async () => {
  const s = await source();
  assert.match(s, /useSession\(\)/);
  assert.match(s, /status !== "authenticated"/);
  // Vorm on auth-haru JÄREL: autentimata kasutaja ei näe ühtki välja.
  const authGate = s.indexOf('status !== "authenticated"');
  const firstField = s.indexOf("subsistence.fields.adults");
  assert.ok(authGate > -1 && authGate < firstField, "auth-värav peab olema enne vormi");
});

test("konto nõue EI vii arvutust serverisse — see vahe peab püsima", async () => {
  const s = await source();
  // Sisselogimine avab lehe; ta ei tohi teha sisestatud andmeid serverile
  // nähtavaks. Kui siia ilmub fetch, kaob see vahe ära.
  assert.doesNotMatch(s, /fetch\(/);
});

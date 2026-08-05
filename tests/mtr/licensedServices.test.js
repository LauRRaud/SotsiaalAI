import test from "node:test";
import assert from "node:assert/strict";

import {
  LICENCE_COVERAGE,
  LICENCE_REQUIREMENT,
  LICENSED_SERVICES,
  LICENSED_SERVICE_CATALOGUE_VERSION,
  MAPPING_STATUS,
  MATCH_CONFIDENCE,
  MTR_SOCIAL_ACTIVITIES,
  NON_LICENSED_SERVICES,
  allCatalogueRows,
  detectServiceCandidates,
  findServiceByKey,
  licenceCoverageForService,
  licenceRequirementFor
} from "../../lib/mtr/licensedServices.js";

test("iga rida kannab õigusviidet, võtit ja korrektseid aliaseid", () => {
  const keys = new Set();
  for (const row of allCatalogueRows()) {
    assert.match(row.legalBasis, /^SHS §/u, `${row.key} vajab õigusviidet`);
    assert.ok(row.label && row.key, "rida vajab võtit ja nime");
    assert.equal(keys.has(row.key), false, `võti ${row.key} kordub`);
    keys.add(row.key);
    assert.ok(Array.isArray(row.aliases) && row.aliases.length, `${row.key} vajab aliaseid`);
    for (const alias of row.aliases) {
      assert.ok(alias.value, `${row.key} alias vajab väärtust`);
      assert.ok(
        [MATCH_CONFIDENCE.HIGH, MATCH_CONFIDENCE.LOW].includes(alias.confidence),
        `${row.key}/${alias.value} vajab kindlusastet`
      );
      if (alias.confidence === MATCH_CONFIDENCE.LOW) {
        assert.ok(alias.note, `madala kindlusega alias ${alias.value} peab ütlema, millega teda segi aetakse`);
      }
    }
  }
});

test("loakohustuslikel ridadel on MTR tegevusala ja teralisus", () => {
  const known = new Set(Object.values(MTR_SOCIAL_ACTIVITIES).map((activity) => activity.id));
  for (const row of LICENSED_SERVICES) {
    assert.ok(known.has(row.activity?.id), `${row.key} viitab tundmatule tegevusalale`);
    assert.ok(["EXACT", "COARSE"].includes(row.granularity), `${row.key} vajab teralisust`);
  }
});

test("SHS § 151 loetelu on täies mahus kaetud", () => {
  const bases = LICENSED_SERVICES.map((row) => row.legalBasis);
  for (const point of ["p 1", "p 2", "p 3", "p 4", "p 5", "p 6", "p 7", "p 8", "p 8¹", "p 9"]) {
    assert.ok(bases.includes(`SHS § 151 ${point}`), `§ 151 ${point} puudub tabelist`);
  }
  assert.ok(bases.includes("SHS § 147"), "rehabilitatsiooniteenus puudub");
});

test("KUUS erihoolekandeteenust jagavad üht MTR tegevusala ja on jämedad", () => {
  const erihoolekanne = LICENSED_SERVICES.filter((row) => row.activity.id === MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE.id);
  assert.equal(erihoolekanne.length, 6, "§ 151 p 5, 6, 7, 8, 8¹ ja 9");
  for (const row of erihoolekanne) assert.equal(row.granularity, "COARSE");
});

test("jämeda teralisusega vaste EI ole konkreetse alateenuse tõend", () => {
  const licence = { activity: "Erihoolekandeteenus" };

  /* Kõige tähtsam rida selles failis: MTR ütleb ainult, et erihoolekandeluba on
     olemas — mitte, et just toetatud elamine on kaetud. */
  assert.equal(licenceCoverageForService(licence, "TOETATUD_ELAMINE"), LICENCE_COVERAGE.ACTIVITY_MATCH_ONLY);

  assert.equal(
    licenceCoverageForService({ activity: "Väljaspool kodu osutatav üldhooldusteenus" }, "YLDHOOLDUS_VALJASPOOL_KODU"),
    LICENCE_COVERAGE.EXACT_MATCH
  );
  assert.equal(licenceCoverageForService(licence, "YLDHOOLDUS_VALJASPOOL_KODU"), LICENCE_COVERAGE.NO_MATCH);
  assert.equal(licenceCoverageForService({ activity: "Taksoveo tegevusluba" }, "TOETATUD_ELAMINE"), LICENCE_COVERAGE.NO_MATCH);
  assert.equal(licenceCoverageForService(licence, "TUGIISIK"), LICENCE_COVERAGE.UNCONFIRMED);
  assert.equal(licenceCoverageForService(licence, "PUUDUB"), LICENCE_COVERAGE.UNCONFIRMED);
  assert.equal(licenceCoverageForService(null, "TOETATUD_ELAMINE"), LICENCE_COVERAGE.NO_MATCH);
});

test("kontrollimata kaardistus on koodiga blokeeritud, mitte kommentaariga", () => {
  const unverified = LICENSED_SERVICES.filter((row) => row.needsVerification).map((row) => row.key);
  assert.deepEqual(unverified, ["PAEVA_JA_NADALAHOID"]);

  const result = licenceRequirementFor({ serviceKey: "PAEVA_JA_NADALAHOID" });
  /* Loakohustus jääb — seadus on selge (§ 151 p 8¹). Kontrollimata on ainult
     seos MTR tegevusalaga, seega tegevusala on null ja kontrolli ei käivitata. */
  assert.equal(result.requirement, LICENCE_REQUIREMENT.REQUIRED);
  assert.equal(result.mappingStatus, MAPPING_STATUS.NEEDS_VERIFICATION);
  assert.equal(result.activity, null, "ilma tegevusalata ei saa MTR-ist küsida");
  assert.equal(result.granularity, null);

  assert.equal(
    licenceCoverageForService({ activity: "Erihoolekandeteenus" }, "PAEVA_JA_NADALAHOID"),
    LICENCE_COVERAGE.UNCONFIRMED
  );
});

test("selge seos annab otsuse, vabatekst mitte kunagi", () => {
  const mapped = licenceRequirementFor({ serviceKey: "YLDHOOLDUS_VALJASPOOL_KODU" });
  assert.equal(mapped.requirement, LICENCE_REQUIREMENT.REQUIRED);
  assert.equal(mapped.mappingStatus, MAPPING_STATUS.MAPPED);
  assert.equal(mapped.activity.label, "Väljaspool kodu osutatav üldhooldusteenus");
  assert.equal(mapped.catalogueVersion, LICENSED_SERVICE_CATALOGUE_VERSION);

  /* Väide piirdub SHS-iga: muude seaduste lube see tabel ei tõenda. */
  assert.equal(licenceRequirementFor({ serviceKey: "TUGIISIK" }).requirement, LICENCE_REQUIREMENT.NO_SHS_LICENCE_REQUIRED);

  const guessed = licenceRequirementFor({ freeText: "Meie hooldekodu Pärnus" });
  assert.equal(guessed.requirement, LICENCE_REQUIREMENT.UNKNOWN);
  assert.equal(guessed.mappingStatus, MAPPING_STATUS.UNMAPPED);
  assert.equal(guessed.candidates[0].key, "YLDHOOLDUS_VALJASPOOL_KODU");

  const nothing = licenceRequirementFor({ freeText: "Kohvik ja käsitöö" });
  assert.equal(nothing.requirement, LICENCE_REQUIREMENT.UNKNOWN);
  assert.deepEqual(nothing.candidates, []);
});

test("kandidaat kannab vaste põhjust ja kindlusastet", () => {
  const [candidate] = detectServiceCandidates("Pakume lapsehoidu");
  assert.equal(candidate.key, "LAPSEHOID_SUURE_VAJADUSEGA");
  assert.equal(candidate.matchedText, "lapsehoid");
  assert.equal(candidate.matchedBy, "ALIAS");
  assert.equal(candidate.confidence, MATCH_CONFIDENCE.LOW);
  assert.match(candidate.note, /haridus/iu, "põhjus peab ütlema, millega segi aetakse");
  assert.equal(candidate.legalBasis, "SHS § 151 p 1");

  const [exact] = detectServiceCandidates("Väljaspool kodu osutatav üldhooldusteenus");
  assert.equal(exact.matchedBy, "LABEL");
  assert.equal(exact.confidence, MATCH_CONFIDENCE.HIGH);
});

test("tuvastaja eelistab pikimat vastet, mitte esimest", () => {
  const candidates = detectServiceCandidates("Ööpäevaringne erihooldusteenus täiskasvanutele");
  assert.equal(candidates[0].key, "OOPAEVARINGNE_ERIHOOLDUS");

  const home = detectServiceCandidates("koduteenus ja tugiisikuteenus").map((row) => row.key);
  assert.deepEqual(home.sort(), ["KODUTEENUS", "TUGIISIK"]);

  assert.deepEqual(detectServiceCandidates(""), []);
  assert.deepEqual(detectServiceCandidates(null), []);
});

test("naiste tugikeskus ei ole turvakoduteenuse alias", () => {
  /* Naiste tugikeskuse teenus on ohvriabi seaduse alusel eraldi tervikteenus. */
  for (const row of allCatalogueRows()) {
    for (const alias of row.aliases) {
      assert.doesNotMatch(alias.value, /naiste tugikeskus/iu, `${row.key} ei tohi seda aliast kanda`);
    }
  }
  assert.deepEqual(detectServiceCandidates("Naiste tugikeskus"), []);
});

test("mitmetähenduslikud aliased on madala kindlusega", () => {
  const lowByService = {
    LAPSEHOID_SUURE_VAJADUSEGA: "lapsehoid",
    YLDHOOLDUS_VALJASPOOL_KODU: "hooldushaigla",
    REHABILITATSIOON: "rehabilitatsioon",
    SOTSIAALTRANSPORT: "sotsiaaltransport"
  };
  for (const [key, value] of Object.entries(lowByService)) {
    const alias = findServiceByKey(key).aliases.find((entry) => entry.value === value);
    assert.ok(alias, `${key}/${value} puudub`);
    assert.equal(alias.confidence, MATCH_CONFIDENCE.LOW, `${value} peab olema madala kindlusega`);
  }
});

test("kataloog on sügavkülmutatud — äriloogikat ei saa jooksvalt muuta", () => {
  assert.throws(() => {
    LICENSED_SERVICES[0].label = "MUTEERITUD";
  }, TypeError);
  assert.throws(() => {
    findServiceByKey("ASENDUSHOOLDUS").activity.label = "Vale tegevusala";
  }, TypeError);
  assert.throws(() => {
    MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE.id = "t_999";
  }, TypeError);
  assert.throws(() => {
    findServiceByKey("TURVAKODU").aliases.push({ value: "x", confidence: "HIGH" });
  }, TypeError);
  assert.equal(LICENSED_SERVICES[0].label, "Suure hooldus- ja abivajadusega lapse hoiu teenus");
});

test("versioon kannab ka sama päeva kordust", () => {
  assert.match(LICENSED_SERVICE_CATALOGUE_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/u);
});

test("loata teenuste read on olemas ja leitavad võtme järgi", () => {
  assert.ok(NON_LICENSED_SERVICES.length >= 6);
  assert.equal(findServiceByKey("KODUTEENUS").requirement, LICENCE_REQUIREMENT.NO_SHS_LICENCE_REQUIRED);
  assert.equal(findServiceByKey("PUUDUB"), null);
});

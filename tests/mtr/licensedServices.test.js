import test from "node:test";
import assert from "node:assert/strict";

import {
  LICENCE_REQUIREMENT,
  LICENSED_SERVICES,
  LICENSED_SERVICE_CATALOGUE_VERSION,
  MTR_SOCIAL_ACTIVITIES,
  NON_LICENSED_SERVICES,
  detectServiceCandidates,
  findServiceByKey,
  licenceCoversService,
  licenceRequirementFor
} from "../../lib/mtr/licensedServices.js";

test("iga loakohustuslik rida kannab õigusviidet ja MTR tegevusala", () => {
  assert.ok(LICENSED_SERVICES.length >= 11);
  for (const row of LICENSED_SERVICES) {
    assert.match(row.legalBasis, /^SHS §/u, `${row.key} vajab õigusviidet`);
    assert.ok(row.activity?.id && row.activity?.label, `${row.key} vajab MTR tegevusala`);
    assert.ok(["EXACT", "COARSE"].includes(row.granularity), `${row.key} vajab teralisust`);
  }
  /* Tabel viitab ainult tegevusaladele, mis registris päriselt olemas on. */
  const known = new Set(Object.values(MTR_SOCIAL_ACTIVITIES).map((activity) => activity.id));
  for (const row of LICENSED_SERVICES) assert.ok(known.has(row.activity.id));
});

test("SHS § 151 loetelu on täies mahus kaetud", () => {
  const bases = LICENSED_SERVICES.map((row) => row.legalBasis);
  for (const point of ["p 1", "p 2", "p 3", "p 4", "p 5", "p 6", "p 7", "p 8", "p 8¹", "p 9"]) {
    assert.ok(
      bases.some((basis) => basis === `SHS § 151 ${point}`),
      `§ 151 ${point} puudub tabelist`
    );
  }
  assert.ok(bases.includes("SHS § 147"), "rehabilitatsiooniteenus puudub");
});

test("viis erihoolekandeteenust jagavad ÜHT MTR tegevusala ja on märgitud jämedaks", () => {
  const erihoolekanne = LICENSED_SERVICES.filter((row) => row.activity.id === MTR_SOCIAL_ACTIVITIES.ERIHOOLEKANNE.id);
  assert.equal(erihoolekanne.length, 6, "viis § 151 p 5–9 teenust + päeva- ja nädalahoid");
  for (const row of erihoolekanne) assert.equal(row.granularity, "COARSE");
});

test("kontrollimata rida on eraldi märgitud, mitte vaikselt usaldusväärne", () => {
  const unverified = LICENSED_SERVICES.filter((row) => row.needsVerification);
  assert.deepEqual(
    unverified.map((row) => row.key),
    ["PAEVA_JA_NADALAHOID"]
  );
  assert.equal(licenceRequirementFor({ serviceKey: "PAEVA_JA_NADALAHOID" }).needsVerification, true);
});

test("selge seos annab otsuse, vabatekst mitte kunagi", () => {
  const mapped = licenceRequirementFor({ serviceKey: "YLDHOOLDUS_VALJASPOOL_KODU" });
  assert.equal(mapped.requirement, LICENCE_REQUIREMENT.REQUIRED);
  assert.equal(mapped.activity.label, "Väljaspool kodu osutatav üldhooldusteenus");
  assert.equal(mapped.catalogueVersion, LICENSED_SERVICE_CATALOGUE_VERSION);

  const mappedFree = licenceRequirementFor({ serviceKey: "TUGIISIK" });
  assert.equal(mappedFree.requirement, LICENCE_REQUIREMENT.NOT_REQUIRED);

  /* Vabatekst = kandidaadid, aga otsust EI OLE. „Ei vaja luba" on avalik
     rahustus ja seda ei tohi oletusest tuletada. */
  const guessed = licenceRequirementFor({ freeText: "Meie hooldekodu Pärnus" });
  assert.equal(guessed.requirement, LICENCE_REQUIREMENT.UNKNOWN);
  assert.equal(guessed.candidates[0].key, "YLDHOOLDUS_VALJASPOOL_KODU");

  const nothing = licenceRequirementFor({ freeText: "Kohvik ja käsitöö" });
  assert.equal(nothing.requirement, LICENCE_REQUIREMENT.UNKNOWN);
  assert.deepEqual(nothing.candidates, []);
});

test("tuvastaja eelistab pikimat vastet, mitte esimest", () => {
  const candidates = detectServiceCandidates("Ööpäevaringne erihooldusteenus täiskasvanutele");
  assert.equal(candidates[0].key, "OOPAEVARINGNE_ERIHOOLDUS");

  const home = detectServiceCandidates("koduteenus ja tugiisikuteenus").map((row) => row.key);
  assert.deepEqual(home.sort(), ["KODUTEENUS", "TUGIISIK"]);

  assert.deepEqual(detectServiceCandidates(""), []);
  assert.deepEqual(detectServiceCandidates(null), []);
});

test("loakirje katab teenuse ainult sama tegevusala korral", () => {
  const licence = { activity: "Erihoolekandeteenus" };
  assert.equal(licenceCoversService(licence, "TOETATUD_ELAMINE"), true);
  assert.equal(licenceCoversService(licence, "YLDHOOLDUS_VALJASPOOL_KODU"), false);
  assert.equal(licenceCoversService({ activity: "Taksoveo tegevusluba" }, "TOETATUD_ELAMINE"), false);
  assert.equal(licenceCoversService(licence, "TUGIISIK"), false, "loata teenusel ei ole tegevusala");
  assert.equal(licenceCoversService(null, "TOETATUD_ELAMINE"), false);
});

test("loata teenuste read on olemas ja leitavad võtme järgi", () => {
  assert.ok(NON_LICENSED_SERVICES.length >= 6);
  for (const row of NON_LICENSED_SERVICES) assert.match(row.legalBasis, /^SHS §/u);
  assert.equal(findServiceByKey("KODUTEENUS").requirement, LICENCE_REQUIREMENT.NOT_REQUIRED);
  assert.equal(findServiceByKey("PUUDUB"), null);
});

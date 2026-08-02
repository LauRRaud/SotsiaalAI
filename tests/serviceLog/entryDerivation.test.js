/**
 * TEENUSPÄEVIK-V1 E2 — tuletamisreeglite lepingutestid.
 *
 * DoD punkt 1 on „kirje sisestus alla 30 sekundiga". Seda ei võida UI, vaid
 * need reeglid: iga küsimus, mida EI esitata, on võidetud aeg. Testid
 * kirjeldavad täpselt, millal küsimus kaob ja millal ta PEAB jääma.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEntryDraftFromFieldVisit,
  deriveQuantityFromStamps,
  deriveServiceSelection,
  deriveTravelMinutes,
  resolveQuantity,
  validateStampOrder
} from "../../lib/serviceLog/entryDerivation.js";
import { SERVICE_UNIT } from "../../lib/serviceLog/constants.js";

/* --- teenuse tuletamine ------------------------------------------------- */

test("üks aktiivne suunamine annab teenuse, mahu ja ühiku — küsimust ei ole", () => {
  const result = deriveServiceSelection({
    activeReferrals: [{ id: "ref-1", serviceId: "svc-1", unit: SERVICE_UNIT.HOUR }],
    providerServices: [{ id: "svc-1" }, { id: "svc-2" }]
  });
  assert.equal(result.askService, false);
  assert.equal(result.serviceId, "svc-1");
  assert.equal(result.referralId, "ref-1");
  assert.equal(result.source, "referral");
});

test("MITU aktiivset suunamist on ainus koht, kus küsitakse", () => {
  // Vale suunamine tähendab valele KOV-ile esitatud mahtu — masin ei tohi
  // inimese eest valida.
  const result = deriveServiceSelection({
    activeReferrals: [
      { id: "ref-1", serviceId: "svc-1" },
      { id: "ref-2", serviceId: "svc-2" }
    ],
    providerServices: [{ id: "svc-1" }, { id: "svc-2" }]
  });
  assert.equal(result.askService, true);
  assert.equal(result.askReferral, true);
  assert.equal(result.serviceId, null);
});

test("kui osutajal on ÜKS teenus, ei küsita teenust kunagi", () => {
  const result = deriveServiceSelection({
    activeReferrals: [],
    providerServices: [{ id: "svc-only" }],
    lastUsedServiceId: "svc-other"
  });
  assert.equal(result.askService, false);
  assert.equal(result.serviceId, "svc-only");
  assert.equal(result.source, "only_service");
});

test("üheainsa teenuse reegel on TUGEVAM kui ajalugu", () => {
  // Kui valida ei ole millegi vahel, ei tohi küsimust näidata isegi siis, kui
  // viimati kasutatud teenus ütleks midagi muud.
  const result = deriveServiceSelection({
    providerServices: [{ id: "svc-only" }],
    lastUsedServiceId: "svc-vana"
  });
  assert.equal(result.serviceId, "svc-only");
});

test("viimati kasutatud teenus eeltäidetakse, kui ta on veel kataloogis", () => {
  const result = deriveServiceSelection({
    providerServices: [{ id: "svc-1" }, { id: "svc-2" }],
    lastUsedServiceId: "svc-2"
  });
  assert.equal(result.askService, false);
  assert.equal(result.serviceId, "svc-2");
  assert.equal(result.source, "last_used");
});

test("kadunud ajalugu ei eeltäida midagi — küsitakse", () => {
  const result = deriveServiceSelection({
    providerServices: [{ id: "svc-1" }, { id: "svc-2" }],
    lastUsedServiceId: "svc-kustutatud"
  });
  assert.equal(result.askService, true);
  assert.equal(result.serviceId, null);
});

/* --- kestus ja kogus ---------------------------------------------------- */

test("KOHAL–LAHKUSIN annab tundides koguse ise", () => {
  const quantity = deriveQuantityFromStamps({
    arrivedAt: "2026-08-02T09:00:00Z",
    leftAt: "2026-08-02T10:30:00Z",
    unit: SERVICE_UNIT.HOUR
  });
  assert.equal(quantity, 1.5);
});

test("SESSION on loendatav kord, mitte kestus", () => {
  // 20-minutiline külastus ja kolmetunnine on MÕLEMAD üks kord. Kestusest
  // koguse arvutamine annaks arvel vale numbri.
  for (const unit of [SERVICE_UNIT.SESSION, SERVICE_UNIT.DAY, SERVICE_UNIT.MONTH]) {
    assert.equal(
      deriveQuantityFromStamps({
        arrivedAt: "2026-08-02T09:00:00Z",
        leftAt: "2026-08-02T09:20:00Z",
        unit
      }),
      null,
      `${unit} ei tohi olla kestusest tuletatav`
    );
  }
});

test("puuduv või tagurpidi tempel ei tuleta kogust", () => {
  assert.equal(deriveQuantityFromStamps({ arrivedAt: "2026-08-02T09:00:00Z" }), null);
  assert.equal(
    deriveQuantityFromStamps({
      arrivedAt: "2026-08-02T10:00:00Z",
      leftAt: "2026-08-02T09:00:00Z"
    }),
    null
  );
});

test("kasutaja sisestatud kogus VÕIDAB tuletatu", () => {
  // Kohtumine võis alata enne, kui nupp vajutati — inimese number on õigem.
  const result = resolveQuantity({
    quantity: 2,
    arrivedAt: "2026-08-02T09:00:00Z",
    leftAt: "2026-08-02T10:30:00Z",
    unit: SERVICE_UNIT.HOUR
  });
  assert.equal(result.ok, true);
  assert.equal(result.quantity, 2);
  assert.equal(result.derived, false);
});

test("tuletamine täidab ainult TÜHJA koguse", () => {
  const result = resolveQuantity({
    arrivedAt: "2026-08-02T09:00:00Z",
    leftAt: "2026-08-02T09:45:00Z",
    unit: SERVICE_UNIT.HOUR
  });
  assert.equal(result.quantity, 0.75);
  assert.equal(result.derived, true);
});

test("kogus ilma koguse ja kellaaegadeta on viga, mitte vaikiv null", () => {
  assert.equal(resolveQuantity({ unit: SERVICE_UNIT.HOUR }).ok, false);
  assert.equal(resolveQuantity({ quantity: 0 }).ok, false);
  assert.equal(resolveQuantity({ quantity: -3 }).ok, false);
  assert.equal(resolveQuantity({ quantity: "kaks" }).ok, false);
});

test("ebausutavalt suur kogus peatatakse enne arvet", () => {
  // Näpuviga „1.5 h" -> „15000 h" rikuks kuuaruande summa vaikselt.
  const result = resolveQuantity({ quantity: 15000 });
  assert.equal(result.ok, false);
  assert.equal(result.messageKey, "service_log.errors.quantity_too_large");
});

/* --- sõiduaeg ja templite järjekord ------------------------------------- */

test("sõiduaeg on mõlemad lõigud kokku, kilomeetreid ei arvutata", () => {
  const minutes = deriveTravelMinutes({
    departedForVisitAt: "2026-08-02T08:40:00Z",
    arrivedAt: "2026-08-02T09:00:00Z",
    leftAt: "2026-08-02T10:00:00Z",
    returnedAt: "2026-08-02T10:25:00Z"
  });
  assert.equal(minutes, 45);
});

test("järjestikuste klientide puhul ei ole TAGASI kohustuslik", () => {
  const minutes = deriveTravelMinutes({
    departedForVisitAt: "2026-08-02T08:40:00Z",
    arrivedAt: "2026-08-02T09:00:00Z",
    leftAt: "2026-08-02T10:00:00Z"
  });
  assert.equal(minutes, 20);
});

test("ilma ühegi lõiguta ei ole sõiduaeg 0, vaid teadmata", () => {
  // 0 tähendaks „sõitu ei olnud"; null tähendab „ei tea". Mall A veerus on
  // need kaks eri asja.
  assert.equal(deriveTravelMinutes({ arrivedAt: "2026-08-02T09:00:00Z" }), null);
});

test("templid peavad kasvama", () => {
  const bad = validateStampOrder({
    arrivedAt: "2026-08-02T10:00:00Z",
    leftAt: "2026-08-02T09:00:00Z"
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.messageKey, "service_log.errors.stamp_order");
});

test("vahepealne tempel tohib puududa", () => {
  // Kasutaja võib vajutada ainult KOHAL ja LAHKUSIN või lisada templid
  // tagantjärele — see ei ole viga.
  assert.equal(
    validateStampOrder({
      arrivedAt: "2026-08-02T09:00:00Z",
      leftAt: "2026-08-02T10:00:00Z"
    }).ok,
    true
  );
  assert.equal(validateStampOrder({}).ok, true);
});

/* --- välitöö sild -------------------------------------------------------- */

test("lõpetatud külastusest saab EELTÄIDIS, mitte kirje", () => {
  const draft = buildEntryDraftFromFieldVisit({
    id: "visit-1",
    arrivedConfirmedAt: "2026-08-02T09:00:00Z",
    departedConfirmedAt: "2026-08-02T11:00:00Z"
  });
  assert.equal(draft.sourceFieldVisitId, "visit-1");
  assert.equal(draft.quantity, 2);
  assert.equal(draft.arrivedAt.toISOString(), "2026-08-02T09:00:00.000Z");
});

test("külastuse märkmeid EI tõsteta teenuskirjesse", () => {
  // Eri tundlikkus, eri säilitus. Kirje märge kirjutatakse eraldi ja lühidalt.
  const draft = buildEntryDraftFromFieldVisit({
    id: "visit-1",
    arrivedConfirmedAt: "2026-08-02T09:00:00Z",
    departedConfirmedAt: "2026-08-02T10:00:00Z",
    goal: "tundlik eesmärk",
    packSummaryText: "tundlik kokkuvõte"
  });
  assert.equal(draft.note, null);
  assert.equal(JSON.stringify(draft).includes("tundlik"), false);
});

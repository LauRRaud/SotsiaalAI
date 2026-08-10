/**
 * TEEKOND → EELPÖÖRDUMINE: jagamisvalik peab juhtima KOGU teksti (SOL-JOUR-01, P0).
 *
 * MIS OLI KATKI. Valikuid oli kaks. Esimene (Teekonna detailis) käis serveri
 * projektsioonist läbi; teine — see, mida kasutaja näeb vahetult enne adressaadi
 * valikut — filtreeris ainult manifesti koopiat. `topic`, `situation` ja
 * kirjamustand jäid ESIMESE projektsiooni kujule. Kasutaja võttis linnukese
 * maha, ekraan näitas valikut kitsenemas — ja sama tekst läks adressaadile.
 *
 * MIDA SEE FAIL MÕÕDAB. Iga jagamisvõtme jaoks on Teekonnas UNIKAALNE
 * markertekst. Testid küsivad projektsiooni ilma selle võtmeta ja nõuavad, et
 * marker ei esine MITTE KUSAGIL vastuses — ei olukorra kirjelduses, ei
 * kirjamustandis, ei manifestis. Nii ei sõltu test sellest, millisesse välja
 * tekst juhtub kokku pandama; ta mõõdab lubadust ennast.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  JOURNEY_SHARE_KEYS,
  buildPreInquiryPrefillFromJourney
} from "../../lib/journey/preInquiryHandoff.js";

/** Iga võtme taga on oma marker — nii on näha, KUMB võti lekkis. */
const MARKER = Object.freeze({
  summary: "MARKERSUMMARY",
  domains: "MARKERDOMAIN",
  missingInfo: "MARKERMISSING",
  wish: "MARKERWISH",
  personContext: "MARKERPERSON",
  assistiveDevices: "MARKERDEVICE",
  serviceContinuity: "MARKERCONTINUITY",
  municipality: "MARKERMUNICIPALITY",
  document: "MARKERDOCUMENT",
  title: "MARKERTITLE"
});

const JOURNEY = Object.freeze({
  id: "journey-1",
  title: MARKER.title,
  primaryPath: MARKER.title,
  summary: MARKER.summary,
  domains: [MARKER.domains],
  missingInfo: [MARKER.missingInfo],
  suggestedActions: [],
  context: {
    personWish: MARKER.wish,
    personContext: MARKER.personContext,
    contextNote: MARKER.document,
    municipalityName: MARKER.municipality,
    assistiveDevices: [{ name: MARKER.assistiveDevices }],
    serviceContinuity: {
      serviceName: MARKER.serviceContinuity,
      currentProvider: `${MARKER.serviceContinuity}-provider`,
      endDate: "2026-09-01",
      userGoal: `${MARKER.serviceContinuity}-goal`
    }
  }
});

const project = (keys) => buildPreInquiryPrefillFromJourney(JOURNEY, { shareKeys: keys });
const whole = (prefill) => JSON.stringify(prefill);

/* Positiivne rada ESIMESENA: ilma temata läheks „keela kõik" testist läbi ja
   eelpöördumine jääks igaveseks tühjaks. */
test("kinnitatud võti jõuab projektsiooni", () => {
  const prefill = project([...JOURNEY_SHARE_KEYS]);
  for (const key of JOURNEY_SHARE_KEYS) {
    assert.ok(
      whole(prefill).includes(MARKER[key]),
      `võti ${key} oli valitud, aga tema sisu ei jõudnud projektsiooni`
    );
  }
});

/* SEE ON LEID ISE. Iga eemaldatud võti peab kaduma KOGU vastusest, mitte
   ainult manifestist. */
test("eemaldatud võtme sisu ei esine kusagil projektsioonis", () => {
  for (const removed of JOURNEY_SHARE_KEYS) {
    const keys = JOURNEY_SHARE_KEYS.filter((key) => key !== removed);
    const prefill = project(keys);
    const text = whole(prefill);
    assert.ok(
      !text.includes(MARKER[removed]),
      `võti ${removed} võeti maha, aga tema sisu jäi projektsiooni: ${text.slice(0, 400)}`
    );
  }
});

/* Olukorra kirjeldus ja KIRJAMUSTAND eraldi, sest just nemad jäid vanas koodis
   esimese valiku kujule ja just nemad lähevad adressaadile. */
test("olukord ja kirjamustand kitsenevad koos valikuga", () => {
  const prefill = project(["title"]);
  assert.ok(!prefill.situation.includes(MARKER.summary), "kokkuvõte jäi olukorra kirjeldusse");
  assert.ok(
    !prefill.suggestedMessageDraft.includes(MARKER.summary),
    "kokkuvõte jäi kirjamustandisse — täpselt see tekst läheks adressaadile"
  );
  assert.ok(!prefill.suggestedMessageDraft.includes(MARKER.missingInfo), "puuduolev info jäi kirja");
});

/* Manifest peab kirjeldama TÄPSELT seda projektsiooni: ei rohkem (vale
   nõusolekuväide) ega vähem (audit ei leia hiljem üles, mis jagati). */
test("confirmedKeys kirjeldab täpselt valitud hulka", () => {
  const keys = ["summary", "domains"];
  const prefill = project(keys);
  assert.deepEqual([...prefill.sharedJourneyInfo.confirmedKeys].sort(), [...keys].sort());

  const empty = project([]);
  assert.deepEqual(empty.sharedJourneyInfo?.confirmedKeys ?? [], []);
});

/* Tundmatu võti ei tohi midagi avada — allowlist on fail-closed. */
test("tundmatu võti ei ava midagi", () => {
  const prefill = project(["summary", "personWish", "kõik", "__proto__"]);
  assert.deepEqual(prefill.sharedJourneyInfo.confirmedKeys, ["summary"]);
  /* `personWish` oli vana UI võti, mida serveri sõnavaras EI OLE — tema
     valimine ei tohi anda `wish` sisu. */
  assert.ok(!whole(prefill).includes(MARKER.wish), "tundmatu võti avas `wish` sisu");
});

/* Tühi valik = tühi jagamine, mitte „kõik". Vaikimisi kinni. */
test("tühi valik ei jaga midagi", () => {
  const prefill = project([]);
  const text = whole(prefill);
  for (const key of JOURNEY_SHARE_KEYS) {
    assert.ok(!text.includes(MARKER[key]), `tühja valikuga lekkis ${key}`);
  }
  assert.equal(prefill.situation, "");
  assert.equal(prefill.topic, "");
});

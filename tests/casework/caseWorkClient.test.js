/**
 * JUHTUM-V1 (CASEWORK-P7) E6 — pinna ja API vahekihi teisendused.
 *
 * Need on väikesed funktsioonid, mille viga on VAIKNE: vale kuvanimi näeb välja
 * nagu andmeviga, vale ajavöönd nagu töötaja enda eksitus.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  caseLabelText,
  fromLocalInputValue,
  missingInfoStatusKey,
  retentionLabelKey,
  targetTypeKey,
  toLocalInputValue
} from "../../components/casework/caseWorkClient.js";

/** Sõnastiku asemel — test ei tõlgi, vaid vaatab, MILLIST võtit küsitakse. */
const t = (key) => key;

test("kuvanimi: tekst võidab võtme, tühjal real tuleb võti", () => {
  assert.equal(caseLabelText({ source: "DISPLAY_NAME", text: "perearst R", labelKey: null }, t), "perearst R");
  /* Kustutatud kliendiviide EI TOHI kuvada vana nime — teenuskiht annab siis
     ainult võtme ja tekst on `null`. */
  assert.equal(
    caseLabelText({ source: "ERASED", text: null, labelKey: "casework.label.erased_client" }, t),
    "casework.label.erased_client"
  );
  assert.equal(caseLabelText(null, t), "casework.label.untitled");
});

test("seisusildid ei kuva kunagi toorest enum'i nime", () => {
  assert.equal(retentionLabelKey("ACTIVE"), "casework.page.retention_active");
  assert.equal(retentionLabelKey("READ_ONLY"), "casework.page.retention_read_only");
  assert.equal(retentionLabelKey("ARCHIVED"), "casework.page.retention_archived");
  /* Tundmatu seis langeb tagasi „aktiivsele" sildile, mitte andmebaasi
     stringile: kuvatav enum oleks korraga inetu ja tõlkimata. */
  assert.equal(retentionLabelKey("MIDAGI_MUUD"), "casework.page.retention_active");

  assert.equal(missingInfoStatusKey("OPEN"), "casework.page.status_open");
  assert.equal(missingInfoStatusKey("RESOLVED"), "casework.page.status_resolved");
  assert.equal(missingInfoStatusKey("NOT_APPLICABLE"), "casework.page.status_not_applicable");

  assert.equal(targetTypeKey("USER_DOCUMENT"), "casework.page.target_user_document");
  assert.equal(targetTypeKey("AGENT_ARTIFACT"), "casework.page.target_agent_artifact");
  assert.equal(targetTypeKey("FIELD_VISIT"), "casework.page.target_field_visit");
});

test("järgmine kontakt liigub vormi ja tagasi ILMA ajavööndinihketa", () => {
  /* `toISOString().slice(0,16)` oleks UTC ja nihutaks suvel kella kolm tundi
     tahapoole — töötaja näeks kella 9 asemel kella 6. */
  const local = new Date(2026, 7, 14, 9, 30);
  const inputValue = toLocalInputValue(local.toISOString());
  assert.equal(inputValue, "2026-08-14T09:30");
  assert.equal(new Date(fromLocalInputValue(inputValue)).getTime(), local.getTime());
});

test("tühi kuupäev tähendab eemaldamist, mitte muutmata jätmist", () => {
  /* `null` on see, mida teenuskiht ootab järgmise kontakti eemaldamiseks
     (E6 operatsioon 3). Tühi string jõuaks `new Date("")`-ini ja annaks
     `Invalid Date`. */
  assert.equal(fromLocalInputValue(""), null);
  assert.equal(fromLocalInputValue(null), null);
  assert.equal(fromLocalInputValue("mitte kuupäev"), null);
  assert.equal(toLocalInputValue(null), "");
  assert.equal(toLocalInputValue("mitte kuupäev"), "");
});

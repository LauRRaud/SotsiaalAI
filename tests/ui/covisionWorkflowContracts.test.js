import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("covision home separates start, own cases and practice examples", () => {
  const source = read("components/covision/CovisionPage.jsx");
  const messages = JSON.parse(read("messages/et.json"));

  assert.equal(typeof messages.covision.overview.new_covision, "string");
  assert.equal(typeof messages.covision.overview.practice_example, "string");
  assert.match(source, /covision\.overview\.new_covision/);
  assert.match(source, /Minu kovisioonid/);
  assert.match(source, /covision\.overview\.practice_example/);
  assert.match(source, /startCase/);
  assert.match(source, /view === "overview"/);
});

test("covision creation is a single stepped panel flow", () => {
  const source = read("components/covision/CovisionPage.jsx");
  const messages = JSON.parse(read("messages/et.json"));

  assert.match(source, /caseCreationSteps/);
  assert.equal(messages.covision.workflow.steps.basic, "Põhiinfo");
  assert.equal(messages.covision.workflow.steps.anonymous_description, "Anonüümne olukorrakirjeldus");
  assert.equal(messages.covision.workflow.steps.process_flow, "Olukorra kulg");
  assert.equal(messages.covision.workflow.steps.central_question, "Keskne küsimus ja ootus");
  assert.equal(messages.covision.workflow.steps.review, "Ülevaade ja salvesta");
  assert.match(source, /setCaseStep/);
});

test("covision creation does not expose client journey terminology", () => {
  const source = read("components/covision/CovisionPage.jsx");
  const messages = JSON.parse(read("messages/et.json"));

  assert.doesNotMatch(source, /Kliendi teekond/);
  assert.equal(messages.covision.workflow.steps.process_flow, "Olukorra kulg");
  assert.match(messages.covision.workflow.process_flow_empty_hint, /etapid/);
  assert.match(source, /covision\.workflow\.process_flow_empty_hint/);
});

test("covision cannot be saved without explicit anonymity confirmation", () => {
  const source = read("components/covision/CovisionPage.jsx");
  const domain = read("lib/covision.js");
  const messages = JSON.parse(read("messages/et.json"));

  assert.equal(
    messages.covision.workflow.anonymity_confirmation,
    "Kinnitan, et juhtumipüstitus on anonüümne ja ei sisalda tahtlikult tuvastatavaid kliendiandmeid."
  );
  assert.match(source, /caseForm\.anonymityConfirmed/);
  assert.match(source, /covision\.workflow\.save_open_room/);
  assert.match(source, /!caseForm\.anonymityConfirmed/);
  assert.match(domain, /anonymityConfirmed_required/);
});

test("covision room centers a case canvas and typed contributions", () => {
  const source = read("components/covision/CovisionPage.jsx");
  const messages = JSON.parse(read("messages/et.json"));

  assert.equal(typeof messages.covision.room.canvas, "string");
  assert.match(source, /Kolleegide/);
  assert.match(source, /Peegeldused/);
  assert.match(source, /Ettepanekud/);
  assert.match(source, /next_steps/);
  assert.match(source, /Lahtised/);
  assert.match(source, /messageType/);
  assert.match(source, /ADDED_TO_CANVAS|covision\.room\.added_to_canvas/i);
  assert.match(source, /CONVERTED_TO_NEXT_STEP|covision\.room\.converted_to_next_step/i);
});

test("covision room has invite, audio and request-to-speak surfaces outside creation", () => {
  const source = read("components/covision/CovisionPage.jsx");
  const messages = JSON.parse(read("messages/et.json"));

  assert.equal(messages.covision.room.invite_participant, "Kutsu osaleja");
  assert.match(source, /CovisionCallBar/);
  assert.match(source, /contextType="COVISION"/);
  assert.equal(typeof messages.covision.room.request_to_speak, "string");
  assert.match(source, /S(?:Ćµ|õ)nasoovid/);
  assert.doesNotMatch(source, /SectionPanel title="7\. Keda kutsun arutelusse\?"/);
});

test("covision wellbeing input handoff has real translations and only working actions", () => {
  const source = read("components/covision/CovisionPage.jsx");
  const locales = ["et", "en", "ru"].map((locale) => JSON.parse(read(`messages/${locale}.json`)));

  for (const messages of locales) {
    // NB: start_from_wellbeing võtit ei ole kunagi koodis kasutatud ega
    // lokaalidesse lisatud (kontrollitud 2026-07-06); sissepääsu silt elab
    // covision.overview.from_wellbeing all.
    assert.equal(typeof messages.covision?.overview?.from_wellbeing, "string");
    assert.equal(typeof messages.covision?.wellbeing_inputs?.section_title, "string");
    assert.equal(typeof messages.covision?.wellbeing_inputs?.empty, "string");
    assert.equal(typeof messages.covision?.wellbeing_inputs?.use, "string");
    assert.equal(typeof messages.covision?.wellbeing_inputs?.privacy_note, "string");
  }

  assert.match(source, /covision\.wellbeing_inputs\.privacy_note/);
  assert.doesNotMatch(source, /covision\.wellbeing_inputs\.open/);
  assert.doesNotMatch(source, /covision\.wellbeing_inputs\.edit/);
  assert.doesNotMatch(source, /covision\.wellbeing_inputs\.keep_private/);
});

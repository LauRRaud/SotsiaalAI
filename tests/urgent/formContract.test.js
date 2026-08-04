import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source() {
  return readFile(new URL("../../components/urgent/UrgentRequestForm.jsx", import.meta.url), "utf8");
}

test("piirkonna valik tuleb AVATUD laudade loendist, mitte omavalitsuste registrist", async () => {
  const s = await source();
  assert.match(s, /\/api\/urgent-requests\/regions/);
  // Kui valik tuleks üldisest registrist, saaks inimene valida piirkonna, kus
  // rada ei ole, ja nupp viiks veateateni — täpselt selleni, mida haru B keelab.
  assert.doesNotMatch(s, /\/api\/municipalities/);
});

test("tühja loendi korral ei ole vormi ega saatmisnuppu", async () => {
  const s = await source();
  const emptyBranch = s.slice(s.indexOf("if (!regions.length)"), s.indexOf("async function act("));
  assert.match(emptyBranch, /urgent\.unavailable\.title/);
  assert.doesNotMatch(emptyBranch, /type="submit"/);
  assert.doesNotMatch(emptyBranch, /<textarea/);
  // Aus vastus pakub seda, mis ASEMEL olemas on.
  assert.match(emptyBranch, /urgent\.unavailable\.services_link/);
  assert.match(emptyBranch, /urgent\.unavailable\.pre_inquiry_link/);
});

test("kriisilukk käib ENNE väljade valideerimist", async () => {
  const s = await source();
  const review = s.slice(s.indexOf("function review("), s.indexOf("async function send("));
  const crisis = review.indexOf("detectCrisis(");
  const firstValidation = review.indexOf("urgent.errors.municipality_required");
  assert.ok(crisis > -1, "detectCrisis puudub");
  assert.ok(crisis < firstValidation, "kriisikontroll peab olema enne valideerimist");
  assert.match(review, /form\.safetyAnswer === true/);
});

test("„keegi on ohus: jah“ viib kohe 112 ekraanile, ilma saatmiseta", async () => {
  const s = await source();
  const safetyBlock = s.slice(s.indexOf('name="urgent-safety"'), s.indexOf("urgent.form.situation_label"));
  assert.match(safetyBlock, /setStage\("emergency"\)/);
});

test("112 ekraan ei paku ühtegi teed saatmise juurde", async () => {
  const s = await source();
  const emergency = s.slice(s.indexOf('stage === "emergency"'), s.indexOf('stage === "sent"'));
  assert.doesNotMatch(emergency, /fetch\(/);
  assert.doesNotMatch(emergency, /urgent\.form\.submit/);
  // Kriisitekst tuleb olemasolevast kriisirajast, mitte uuest numbrikomplektist.
  assert.match(emergency, /chat\.crisis\.notice/);
});

test("vorm küsib TÄPSELT neli asja", async () => {
  const s = await source();
  const form = s.slice(s.indexOf("<form onSubmit={review}>"));
  const fields = [
    "urgent.form.municipality_label",
    "urgent.form.safety_label",
    "urgent.form.situation_label",
    "urgent.form.contact_name_label",
    "urgent.form.contact_phone_label"
  ];
  for (const field of fields) assert.match(form, new RegExp(field.replace(/\./g, "\\.")));
  // Pikk küsimustik kell 23.47 ei ole eelinfo kogumine, vaid filter. Need neli
  // ei tohi vaikselt kasvada: sissetulek, leibkond ja eluase on vastuvõtja töö.
  assert.doesNotMatch(form, /income|sissetulek|leibkond|household|eluase/i);
  const inputCount = (form.match(/<Input|<textarea|<select/g) || []).length;
  assert.equal(inputCount, 4, `oodati 4 sisestusvälja, leiti ${inputCount}`);
});

test("saatmisele eelneb kinnitusekraan, kus on näha KUHU ja MIS läheb", async () => {
  const s = await source();
  const confirm = s.slice(s.indexOf('stage === "confirm"'), s.indexOf('<section aria-labelledby="urgent-title">'));
  assert.match(confirm, /<DeskCard/);
  assert.match(confirm, /form\.situationVerbatim/);
  assert.match(confirm, /urgent\.form\.consent_note/);
});

test("laua kaart näitab lugemisaega ja 112 piiri, mitte reageerimisaega", async () => {
  const s = await source();
  const card = s.slice(s.indexOf("function DeskCard("), s.indexOf("export default function"));
  assert.match(card, /readingTimePromise/);
  assert.match(card, /emergencyBoundary/);
  assert.match(card, /urgent\.desk\.reading_time_note/);
  // Kuvatavas osas ei tohi olla reageerimisaega ega „abi on teel" — platvorm
  // seda ei luba. Kommentaar, mis seda vahet SELGITAB, on lubatud, seega
  // mõõdame renderdatavaid ridu, mitte kogu faili.
  const rendered = card.slice(card.indexOf("const rows = ["), card.indexOf("];"));
  assert.doesNotMatch(rendered, /responseTime|reageerimisaeg|abi on teel/i);
  assert.doesNotMatch(rendered, /desk\.(ownerUserId|lastVerifiedAt|isActive)/);
});

test("server saab safetyAnswer'i kaasa — klient ei otsusta kriisi üksinda", async () => {
  const s = await source();
  const send = s.slice(s.indexOf("async function send("), s.indexOf('if (stage === "confirm")'));
  assert.match(send, /safetyAnswer: form\.safetyAnswer === true/);
  // Serveri eluohu-vastus viib samale ekraanile — kliendipoolne kontroll on
  // kiirus, mitte kaitse.
  assert.match(send, /payload\?\.emergency/);
});

test("vorm nõuab kontot ja autentimata kasutaja ei näe ühtegi välja", async () => {
  const s = await source();
  assert.match(s, /useSession\(\)/);
  const gate = s.indexOf('status !== "authenticated"');
  const firstField = s.indexOf("urgent.form.municipality_label");
  assert.ok(gate > -1 && gate < firstField, "auth-värav peab olema enne vormi");
});

test("„see ei ole hädaabinumber“ seisab igal ekraanil, kus vorm või selle puudumine on", async () => {
  const s = await source();
  const occurrences = (s.match(/urgent\.not_emergency/g) || []).length;
  assert.ok(occurrences >= 3, `oodati vähemalt 3 kohta, leiti ${occurrences}`);
});

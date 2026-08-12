import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const PANEL = readFileSync(
  path.join(process.cwd(), "components", "wellbeing", "SupportRequestPanel.jsx"),
  "utf8"
);

/** Paneeli valikute deklaratsioon lähtekoodist — ilma komponenti renderdamata. */
function supportOptions() {
  const block = PANEL.match(/const supportOptions = \[([\s\S]*?)\n\];/u)[1];
  return block
    .split(/\}\s*,\s*\{/u)
    .map((chunk) => ({
      recipientType: chunk.match(/recipientType:\s*"([^"]+)"/u)?.[1] || null,
      handoff: chunk.match(/handoff:\s*"([^"]+)"/u)?.[1] || null,
      copyOnly: /copyOnly:\s*true/u.test(chunk),
      descriptionFallback: chunk.match(/descriptionFallback:\s*"([^"]+)"/u)?.[1] || ""
    }))
    .filter((option) => option.recipientType);
}

/* SOL-WB-17 kriteerium: „Iga nähtav valik peab viima konkreetsesse, õigustega
   piiratud adressaadi-/ruumivoo toimingusse VÕI olema ausalt nimetatud ainult
   kopeeritavaks privaatmustandiks." Kolmandat varianti — „lubab adressaati,
   aga ei tee midagi" — ei tohi olla ühtki. */
test("every visible support option either has a handoff rail or is named as copy-only", () => {
  const options = supportOptions();
  assert.ok(options.length >= 4, `valikuid leiti ainult ${options.length}`);

  const undecided = options.filter((option) => !option.handoff && !option.copyOnly);
  assert.deepEqual(
    undecided.map((option) => option.recipientType),
    [],
    "need valikud ei vii kuhugi ega ütle seda välja"
  );

  const both = options.filter((option) => option.handoff && option.copyOnly);
  assert.deepEqual(both.map((option) => option.recipientType), [], "valik ei saa olla korraga mõlemat");
});

test("a copy-only option says in its own description that the platform sends nothing", () => {
  for (const option of supportOptions().filter((item) => item.copyOnly)) {
    assert.match(
      option.descriptionFallback,
      /ise|platvorm seda ei saada/u,
      `${option.recipientType}: kirjeldus ei ütle, et adressaati ei ole`
    );
  }
});

/* Supervisiooni rada oli SERVERIS olemas ja liidesest kättesaamatu — see oli
   leiu kõige teravam osa. */
test("the supervision option uses the existing server contract, not a new one", () => {
  const supervisor = supportOptions().find((option) => option.recipientType === "supervisor");
  assert.ok(supervisor, "supervisori valikut ei ole");
  assert.equal(supervisor.handoff, "supervision");

  assert.match(PANEL, /output-drafts\/\$\{encodeURIComponent\(draft\.id\)\}\/supervision/u);
  /* Protsess on KOHUSTUSLIK: üleandmine käib konkreetsesse protsessi, mitte
     „supervisioonile" üldiselt — server nõuab sama. */
  assert.match(PANEL, /processId: supervisionProcessId/u);
  assert.match(PANEL, /expectedUpdatedAt: draft\.updatedAt/u, "CAS-sõrmejälg käib kaasa");
  assert.match(PANEL, /disabled=\{!supervisionProcessId \|\| isBusy\}/u, "ilma protsessita ei saa üle anda");
});

test("the covision rail is unchanged and still the only one that needs the identifier confirmation", () => {
  const covision = supportOptions().find((option) => option.recipientType === "covision");
  assert.equal(covision.handoff, "covision");
  assert.match(PANEL, /confirmedNoIdentifiers/u);
});

/* Negatiivkontroll: vana paneel EI läbiks ülemist väravat — kolm valikut olid
   ilma rajata ja ilma ausa nimetuseta. Ilma selleta mõõdaks test seda, et
   deklaratsioonis on üldse väljad. */
test("the old option set would fail the honesty gate", () => {
  const legacy = [
    { recipientType: "manager", handoff: null, copyOnly: false },
    { recipientType: "covision", handoff: "covision", copyOnly: false },
    { recipientType: "pilot_support_contact", handoff: null, copyOnly: false },
    { recipientType: "mentor", handoff: null, copyOnly: false }
  ];
  const undecided = legacy.filter((option) => !option.handoff && !option.copyOnly);
  assert.deepEqual(undecided.map((option) => option.recipientType), [
    "manager",
    "pilot_support_contact",
    "mentor"
  ]);
});

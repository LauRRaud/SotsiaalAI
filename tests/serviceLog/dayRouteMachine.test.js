/**
 * TEENUSPÄEVIK E2c — päevateekonna olekumasin.
 *
 * DoD-2 esimene punkt sõnastab kogu asja mõtte: „töötaja läbib vähemalt kolme
 * järjestikuse kliendiga päeva ILMA FIKTIIVSE „tagasi kontorisse” märketa".
 * Esimene test on täpselt see päev.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_STALE_VISIT_MINUTES,
  VISIT_ACTION,
  VISIT_STATUS,
  allowedActions,
  evaluateTransition,
  isActiveVisit,
  isTerminalVisit,
  serviceMinutesOf,
  staleVisits,
  summarizeRoute,
  travelMinutesOf
} from "../../lib/serviceLog/dayRouteMachine.js";

const t = (hhmm) => `2026-08-03T${hhmm}:00.000Z`;

/** Läbib ühe külastuse lõpuni ja tagastab tema lõppkuju. */
function runVisit({ enRoute, arrive, complete }) {
  let visit = { status: VISIT_STATUS.PLANNED };
  const apply = (action, at) => {
    const result = evaluateTransition(visit, action, { at });
    assert.equal(result.ok, true, `${action} pidi olema lubatud seisus ${visit.status}`);
    visit = {
      ...visit,
      status: result.status,
      ...(result.timestampField ? { [result.timestampField]: at } : {})
    };
  };
  if (enRoute) apply(VISIT_ACTION.DEPART, enRoute);
  if (arrive) apply(VISIT_ACTION.ARRIVE, arrive);
  if (complete) apply(VISIT_ACTION.COMPLETE, complete);
  return visit;
}

/* ========================================================================== */

test("kolm järjestikust klienti ilma ühegi „tagasi” märketa (DoD-2)", () => {
  const day = [
    runVisit({ enRoute: t("08:00"), arrive: t("08:15"), complete: t("09:00") }),
    /* TEINE KÜLASTUS ALGAB SEALT, KUS ESIMENE LÕPPES. Vana voog oleks siin
       nõudnud esimeselt külastuselt „tagasi” märget, mida ei juhtunud. */
    runVisit({ enRoute: t("09:00"), arrive: t("09:20"), complete: t("10:05") }),
    runVisit({ enRoute: t("10:05"), arrive: t("10:35"), complete: t("11:30") })
  ];

  for (const visit of day) assert.equal(visit.status, VISIT_STATUS.COMPLETED);

  const summary = summarizeRoute(day);
  assert.equal(summary.visits, 3);
  assert.equal(summary.travelMinutes, 15 + 20 + 30, "kolm sõidulõiku, kõik päris");
  assert.equal(summary.serviceMinutes, 45 + 45 + 55);
  assert.equal(summary.counts[VISIT_STATUS.COMPLETED], 3);
});

test("sõidulõik on enRoute→arrived, teenus arrived→completed", () => {
  const visit = runVisit({ enRoute: t("08:00"), arrive: t("08:15"), complete: t("09:00") });
  assert.equal(travelMinutesOf(visit), 15);
  assert.equal(serviceMinutesOf(visit), 45);
});

/* Töötaja võib olla juba kohal (kõrvalmaja, jalgsi, unustas vajutada). Sundida
   teda vajutama „läksin teele” pärast kohalejõudmist õpetaks talle, et nupud on
   formaalsus. Sõidulõik jääb mõõtmata — aus tulemus, erinevalt väljamõeldust. */
test("PLANNED → ARRIVED ilma teeleasumiseta on lubatud", () => {
  const visit = runVisit({ arrive: t("08:15"), complete: t("09:00") });
  assert.equal(visit.status, VISIT_STATUS.COMPLETED);
  assert.equal(travelMinutesOf(visit), null, "mõõtmata sõit ei ole null-minutiline sõit");
  assert.equal(serviceMinutesOf(visit), 45);
});

test("aeg ei liigu tagasi", () => {
  const visit = { status: VISIT_STATUS.EN_ROUTE, enRouteAt: t("09:00") };
  const back = evaluateTransition(visit, VISIT_ACTION.ARRIVE, { at: t("08:30") });
  assert.equal(back.ok, false);
  assert.equal(back.reason, "timestamp_backwards", "negatiivne kestus jõuaks arve alusdokumenti");
});

/* Puuduv vahepealne tempel ei tohi lubada hilisemal templil varasemast ette
   hiilida: kontrollime KÕIGI olemasolevate vastu, mitte ainult eelmise vastu. */
test("puuduv vahetempel ei ava auku ajakontrolli", () => {
  const visit = { status: VISIT_STATUS.ARRIVED, arrivedAt: t("10:00") };
  const result = evaluateTransition(visit, VISIT_ACTION.COMPLETE, { at: t("09:30") });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "timestamp_backwards");
});

/* PÄRIS JUHTUM, mille peale esimene versioon kukkus: töötaja jõuab kohale,
   klienti ei ole kodus, ta märgib „tegemata”. `cancelledAt` puudus templite
   järjekorrast ja `indexOf` andis −1, mistõttu kontroll nõudis, et tühistamine
   toimuks ENNE saabumist. */
test("klienti ei olnud kodus: tegemata pärast saabumist on lubatud", () => {
  const visit = { status: VISIT_STATUS.ARRIVED, enRouteAt: t("09:00"), arrivedAt: t("09:20") };
  const result = evaluateTransition(visit, VISIT_ACTION.NOT_DONE, {
    at: t("09:25"),
    reason: "Klient ei olnud kodus, uks lukus."
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, VISIT_STATUS.NOT_DONE);
  assert.equal(result.timestampField, "cancelledAt");
});

test("ärajäämine ja tegematajäämine nõuavad PÕHJUST", () => {
  const visit = { status: VISIT_STATUS.EN_ROUTE, enRouteAt: t("09:00") };
  for (const action of [VISIT_ACTION.NOT_DONE, VISIT_ACTION.CANCEL]) {
    const without = evaluateTransition(visit, action, { at: t("09:25") });
    assert.equal(without.ok, false, `${action} ilma põhjuseta`);
    assert.equal(without.reason, "reason_required");
    const withReason = evaluateTransition(visit, action, { at: t("09:25"), reason: "Klient haiglas." });
    assert.equal(withReason.ok, true);
  }
});

/* Sõiduaeg on tehtud töö ka siis, kui teenust ei osutatud — töötaja sõitis
   päriselt. Teenuse kestust tal aga ei ole. */
test("ärajäänud külastuse SÕIT loeb, teenus mitte", () => {
  const day = [
    runVisit({ enRoute: t("08:00"), arrive: t("08:15"), complete: t("09:00") }),
    { status: VISIT_STATUS.NOT_DONE, enRouteAt: t("09:00"), arrivedAt: t("09:20"), cancelledAt: t("09:25") }
  ];
  const summary = summarizeRoute(day);
  assert.equal(summary.travelMinutes, 15 + 20);
  assert.equal(summary.serviceMinutes, 45, "tegemata töö ei anna teenuse minuteid");
  assert.equal(summary.counts[VISIT_STATUS.NOT_DONE], 1);
});

test("lõpetatud külastust ei muudeta tagasi — ainult paranduse kaudu", () => {
  const done = { status: VISIT_STATUS.COMPLETED, arrivedAt: t("09:00"), completedAt: t("10:00") };
  assert.deepEqual(allowedActions(VISIT_STATUS.COMPLETED), [VISIT_ACTION.FLAG_CORRECTION]);
  assert.equal(evaluateTransition(done, VISIT_ACTION.ARRIVE, { at: t("11:00") }).ok, false);

  const flagged = evaluateTransition(done, VISIT_ACTION.FLAG_CORRECTION, { reason: "Vale kestus." });
  assert.equal(flagged.ok, true);
  assert.equal(flagged.status, VISIT_STATUS.NEEDS_CORRECTION);
  assert.equal(flagged.timestampField, null, "märgistus ei kirjuta ajatemplit");

  const resolved = evaluateTransition({ ...done, status: flagged.status }, VISIT_ACTION.RESOLVE_CORRECTION, {});
  assert.equal(resolved.ok, true);
  assert.equal(resolved.status, VISIT_STATUS.COMPLETED);
});

test("tundmatu olek ja lubamatu üleminek eristuvad veakoodiga", () => {
  assert.equal(evaluateTransition({ status: "MIDAGI" }, VISIT_ACTION.ARRIVE, {}).reason, "unknown_status");
  assert.equal(
    evaluateTransition({ status: VISIT_STATUS.PLANNED }, VISIT_ACTION.COMPLETE, { at: t("09:00") }).reason,
    "transition_not_allowed",
    "teenust ei saa lõpetada enne kohalejõudmist"
  );
  assert.equal(
    evaluateTransition({ status: VISIT_STATUS.PLANNED }, VISIT_ACTION.ARRIVE, { at: "ei ole aeg" }).reason,
    "timestamp_invalid"
  );
});

test("käigus ja lõppseisud eristuvad", () => {
  assert.equal(isActiveVisit(VISIT_STATUS.EN_ROUTE), true);
  assert.equal(isActiveVisit(VISIT_STATUS.ARRIVED), true);
  assert.equal(isActiveVisit(VISIT_STATUS.COMPLETED), false);
  assert.equal(isTerminalVisit(VISIT_STATUS.NOT_DONE), true);
  assert.equal(isTerminalVisit(VISIT_STATUS.NEEDS_CORRECTION), false, "parandus ei ole lõpp");
});

/**
 * TURVASIGNAALI SULGUR. See ei ole jälgimine: me ei tea, kus inimene on, ja me
 * ei küsi. Me teame ainult, et üks nupp jäi vajutamata kauemaks kui ükski
 * külastus kestab.
 */
test("liiga kaua lahti jäänud külastus vajab kontrolli", () => {
  const now = new Date(t("14:00"));
  const visits = [
    { id: "a", status: VISIT_STATUS.ARRIVED, arrivedAt: t("09:00") },
    { id: "b", status: VISIT_STATUS.ARRIVED, arrivedAt: t("13:30") },
    { id: "c", status: VISIT_STATUS.COMPLETED, arrivedAt: t("06:00"), completedAt: t("07:00") }
  ];
  const stale = staleVisits(visits, { now });
  assert.deepEqual(stale.map((v) => v.id), ["a"], "ainult see, mis on 5 h lahti");
  assert.equal(DEFAULT_STALE_VISIT_MINUTES, 240);
});

test("paus ei lähe tööajaks", () => {
  const summary = summarizeRoute([], { breakMinutes: 30 });
  assert.equal(summary.breakMinutes, 30);
  assert.equal(summary.serviceMinutes, 0);
  assert.equal(summary.travelMinutes, 0);
});

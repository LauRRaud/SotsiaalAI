import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("mitme aktiivse suunamise valik on kohustuslik ka noValidate vormil", () => {
  const day = read("components", "serviceLog", "ServiceLogDay.jsx");

  assert.match(day, /defaults\?\.askReferral\s*&&\s*!referralId/);
  assert.match(day, /setFormError\(t\("service_log\.errors\.referral_required"/);
});

test("SOL-SLOG-J-01: kuuvaates on paranduse, kustutuse, tühistuse ja ajaloo kasutajatee", () => {
  const month = read("components", "serviceLog", "ServiceLogMonth.jsx");
  const actionsPath = path.join(root, "components", "serviceLog", "ServiceLogEntryActions.jsx");
  const historyPath = path.join(
    root,
    "app",
    "api",
    "service-entries",
    "[id]",
    "corrections",
    "route.js"
  );

  assert.match(month, /ServiceLogEntryActions/);
  assert.equal(fs.existsSync(actionsPath), true, "kirje toimingute komponent puudub");
  assert.equal(fs.existsSync(historyPath), true, "parandusajaloo owner-API puudub");

  const actions = read("components", "serviceLog", "ServiceLogEntryActions.jsx");
  const history = fs.readFileSync(historyPath, "utf8");
  assert.match(actions, /method:\s*"PATCH"/);
  assert.match(actions, /method:\s*"DELETE"/);
  assert.match(actions, /action:\s*"void"/);
  assert.match(actions, /\/corrections/);
  assert.match(history, /listEntryCorrections/);
});

test("SOL-SLOG-J-02: aktiivsel suunamisel on muutmise ja teadliku lõpetamise tee", () => {
  const referrals = read("components", "serviceLog", "ServiceLogReferrals.jsx");
  assert.match(referrals, /method:\s*"PATCH"/);
  assert.match(referrals, /action:\s*"end"/);
  assert.match(referrals, /end_confirm/);
  assert.match(referrals, /referral\.status\s*===\s*"ENDED"/);
});

test("SOL-SLOG-J-02: kirje loomine ja suunamise lõpetamine võtavad sama DB-luku", () => {
  const entries = read("lib", "serviceLog", "entries.js");
  const referrals = read("lib", "serviceLog", "referrals.js");
  const lockPath = path.join(root, "lib", "serviceLog", "referralLock.js");

  assert.equal(fs.existsSync(lockPath), true, "sama suunamise jagatud lukk puudub");
  const lock = fs.readFileSync(lockPath, "utf8");
  assert.match(lock, /FOR UPDATE/);
  assert.match(entries, /withLockedReferral/);
  assert.match(referrals, /withLockedReferral/);
});

test("SOL-SLOG-J-03/04: AI-algus säilib toimetamisel ja narratiiv kannab revision/CAS lepingut", () => {
  const ui = read("components/serviceLog/ServiceLogNarrative.jsx");
  const service = read("lib/serviceLog/narratives.js");
  const route = read("app/api/service-narratives/route.js");

  assert.match(ui, /expectedUpdatedAt:\s*loadedUpdatedAt/);
  assert.match(ui, /conflictNarrative/);
  assert.doesNotMatch(ui, /onChange=\{\(event\) => \{\s*setBodyText\(event\.target\.value\);\s*setIsAiDraft\(false\)/s);
  assert.match(service, /serviceMonthlyNarrative\.updateMany/);
  assert.match(service, /narrative_version_conflict/);
  assert.match(route, /error\.details \|\| \{\}/);
});

test("päevateekond ei küsi ega saada asukohta, kui asukohatempli UI-värav on väljas", () => {
  const route = read("components", "serviceLog", "ServiceLogRoute.jsx");
  const gate = "isServiceLogLocationStampUiEnabled()";
  const gateIndex = route.indexOf(gate, route.indexOf("async (visitId, action)"));
  const captureIndex = route.indexOf("captureLocationPoint(", route.indexOf("async (visitId, action)"));

  assert.match(route, /import \{ isServiceLogLocationStampUiEnabled \} from "@\/lib\/serviceLog\/flags"/);
  assert.notEqual(gateIndex, -1, "päevateekonna asukohavärav puudub");
  assert.ok(gateIndex < captureIndex, "asukohaväravat peab kontrollima enne brauseri geolokatsiooni küsimist");
});

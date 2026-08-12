import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { runUrgentExpirySweep } from "../../lib/urgent/sweep.js";
import { createClient, createModel, NOW } from "./fakePrisma.js";

function createPrisma(requests = []) {
  // SOL-URG-05 järel käib iga aegumine oma tehingus — fake peab seda oskama.
  return createClient({
    urgentRequest: createModel(requests, "req"),
    urgentRequestEvent: createModel([], "evt")
  });
}

const overdue = (overrides = {}) => ({
  id: "req_overdue",
  status: "SENT",
  expiresAt: new Date("2026-08-05T20:00:00Z"),
  ...overrides
});

test("korje lõpetab vastuseta jäänud abipalve ja jätab sündmuse", async () => {
  const prisma = createPrisma([overdue()]);
  const result = await runUrgentExpirySweep({ db: prisma, now: NOW });

  assert.equal(result.expired, 1);
  assert.equal(prisma.urgentRequest.rows[0].status, "EXPIRED");
  assert.equal(prisma.urgentRequestEvent.rows.filter((row) => row.kind === "EXPIRED").length, 1);
});

test("kuivkäik loeb, aga ei liiguta", async () => {
  const prisma = createPrisma([overdue()]);
  const result = await runUrgentExpirySweep({ db: prisma, now: NOW, dryRun: true });

  assert.equal(result.dryRun, true);
  assert.equal(result.due, 1);
  assert.equal(result.expired, 0);
  assert.equal(prisma.urgentRequest.rows[0].status, "SENT");
  assert.equal(prisma.urgentRequestEvent.rows.length, 0);
});

test("võetud pöördumine ei aegu — seal töö käib", async () => {
  const prisma = createPrisma([overdue({ status: "TAKEN" })]);
  const result = await runUrgentExpirySweep({ db: prisma, now: NOW });
  assert.equal(result.expired, 0);
  assert.equal(prisma.urgentRequest.rows[0].status, "TAKEN");
});

test("juba lõppenud pöördumist ei puututa uuesti", async () => {
  const prisma = createPrisma([
    overdue({ id: "req_declined", status: "DECLINED" }),
    overdue({ id: "req_recalled", status: "RECALLED" }),
    overdue({ id: "req_expired", status: "EXPIRED" })
  ]);
  const result = await runUrgentExpirySweep({ db: prisma, now: NOW });
  assert.equal(result.expired, 0);
});

test("korje sõidab olemasoleval toodangutaimeril — uut ops-pinda ei looda", async () => {
  const route = await readFile(new URL("../../app/api/jobs/notifications/route.js", import.meta.url), "utf8");
  assert.match(route, /runUrgentExpirySweep/);
  assert.match(route, /urgentExpiry/);
  // Uut võtit, uut marsruuti ega uut teenust ei tohi tekkida: aegumine on üks
  // lisatoiming ahelas, mis niikuinii iga 5 minuti tagant käib.
  assert.match(route, /x-notification-job-key/);
});

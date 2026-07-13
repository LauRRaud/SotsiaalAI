import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  createPreInquiry,
  resolveSourceJourneyId,
  serializePreInquiry
} from "../../lib/preInquiries.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..");

// A1: Teekond -> eelpöördumine persistent link.
//
// NOTE ON SCOPE: these are dependency-injected fake-Prisma tests of the SERVER
// LOGIC (ownership check, link write, no-leak serialization). They are NOT a
// test of the real database's referential ON DELETE SET NULL behaviour — that
// is verified separately by the Prisma schema + migration SQL assertions below
// and by the clean-DB migration chain (`npm run db:migrate:check`).

const OWNER = "user_owner";
const OTHER = "user_other";

function createFakeDb({ journeys = [] } = {}) {
  const created = [];
  return {
    created,
    journey: {
      async findFirst({ where }) {
        const row = journeys.find(
          (j) => j.id === where.id && j.ownerUserId === where.ownerUserId
        );
        return row ? { id: row.id } : null;
      }
    },
    preInquiry: {
      async create({ data }) {
        const row = {
          id: `pi_${created.length + 1}`,
          createdAt: new Date("2026-07-13T12:00:00.000Z"),
          updatedAt: new Date("2026-07-13T12:00:00.000Z"),
          sentAt: null,
          externalSendConfirmedAt: null,
          receiverNote: null,
          receiverChecklist: null,
          recipientEntry: null,
          author: null,
          recipientOwner: null,
          ...data
        };
        created.push(row);
        return row;
      }
    },
    // resolveRecipient only touches these when a recipient is supplied; the
    // create inputs below never supply one, so any call here is a bug.
    serviceMapEntry: {
      async findUnique() {
        throw new Error("serviceMapEntry.findUnique must not be called here");
      }
    },
    user: {
      async findUnique() {
        throw new Error("user.findUnique must not be called here");
      }
    }
  };
}

function ownedJourneyDb() {
  return createFakeDb({ journeys: [{ id: "journey_a", ownerUserId: OWNER }] });
}

const baseInput = {
  topic: "Eluase",
  situation: "Vajan abi eluaseme leidmisel uues elukohas."
};

// --- resolveSourceJourneyId -------------------------------------------------

test("resolveSourceJourneyId returns null for a missing/empty id and never hits the DB", async () => {
  const db = {
    journey: {
      async findFirst() {
        throw new Error("findFirst must not run for an empty id");
      }
    }
  };
  assert.equal(await resolveSourceJourneyId(OWNER, "", { db }), null);
  assert.equal(await resolveSourceJourneyId(OWNER, "   ", { db }), null);
  assert.equal(await resolveSourceJourneyId(OWNER, null, { db }), null);
  assert.equal(await resolveSourceJourneyId(OWNER, undefined, { db }), null);
});

test("resolveSourceJourneyId returns the id when the journey belongs to the author", async () => {
  const db = ownedJourneyDb();
  assert.equal(await resolveSourceJourneyId(OWNER, "journey_a", { db }), "journey_a");
});

test("resolveSourceJourneyId yields the SAME generic 404 for a foreign vs a missing journey (no existence leak)", async () => {
  // journey_a exists but belongs to OWNER; OTHER must not be able to tell it apart
  // from a journey id that does not exist at all.
  const db = createFakeDb({ journeys: [{ id: "journey_a", ownerUserId: OWNER }] });

  const foreign = await resolveSourceJourneyId(OTHER, "journey_a", { db }).then(
    () => null,
    (error) => error
  );
  const missing = await resolveSourceJourneyId(OTHER, "does_not_exist", { db }).then(
    () => null,
    (error) => error
  );

  assert.ok(foreign instanceof Error);
  assert.ok(missing instanceof Error);
  assert.equal(foreign.status, 404);
  assert.equal(missing.status, 404);
  assert.equal(foreign.message, "journeys.errors.not_found");
  assert.equal(missing.message, "journeys.errors.not_found");
});

// --- createPreInquiry: link write ------------------------------------------

test("#1 owner creates a pre-inquiry from their own journey and the link is saved", async () => {
  const db = ownedJourneyDb();
  const result = await createPreInquiry(OWNER, { ...baseInput, sourceJourneyId: "journey_a" }, { db });

  assert.equal(db.created.length, 1);
  assert.equal(db.created[0].sourceJourneyId, "journey_a");
  assert.equal(db.created[0].authorId, OWNER);
  assert.ok(result?.id);
});

test("#2 a pre-inquiry without a journey id still works and stores a null link", async () => {
  const db = ownedJourneyDb();
  const result = await createPreInquiry(OWNER, { ...baseInput }, { db });

  assert.equal(db.created.length, 1);
  assert.equal(db.created[0].sourceJourneyId, null);
  assert.ok(result?.id);
});

test("#3 another user's journey id creates no link, no pre-inquiry, and does not reveal the journey", async () => {
  const db = ownedJourneyDb(); // journey_a belongs to OWNER

  const error = await createPreInquiry(OTHER, { ...baseInput, sourceJourneyId: "journey_a" }, { db }).then(
    () => null,
    (err) => err
  );

  assert.ok(error instanceof Error);
  assert.equal(error.status, 404);
  assert.equal(error.message, "journeys.errors.not_found");
  assert.equal(db.created.length, 0, "no pre-inquiry must be created on a rejected link");
});

test("#4 (write side) the journey link is never exposed through the pre-inquiry serializer", async () => {
  const db = ownedJourneyDb();
  const result = await createPreInquiry(OWNER, { ...baseInput, sourceJourneyId: "journey_a" }, { db });

  // The stored row carries the scalar, but the shared response never does — so
  // neither the author nor the recipient can open the private journey from it.
  assert.equal(db.created[0].sourceJourneyId, "journey_a");
  assert.ok(!("sourceJourneyId" in result), "serialized pre-inquiry must not include sourceJourneyId");

  const reserialized = serializePreInquiry({
    id: "pi_x",
    authorId: OWNER,
    status: "DRAFT",
    situation: "x",
    sourceJourneyId: "journey_a"
  });
  assert.ok(!("sourceJourneyId" in reserialized));
});

test("#8 repeated submits create distinct pre-inquiries, each with a single scalar link (no hidden double-link)", async () => {
  // Documents the EXISTING create behaviour: there is no idempotency key, so a
  // retried form submit creates a second pre-inquiry. Each pre-inquiry still
  // holds exactly one sourceJourneyId scalar — a single row can never carry a
  // hidden duplicate link. Handoff risk noted in the progress diary.
  const db = ownedJourneyDb();
  await createPreInquiry(OWNER, { ...baseInput, sourceJourneyId: "journey_a" }, { db });
  await createPreInquiry(OWNER, { ...baseInput, sourceJourneyId: "journey_a" }, { db });

  assert.equal(db.created.length, 2);
  assert.notEqual(db.created[0].id, db.created[1].id);
  assert.equal(db.created[0].sourceJourneyId, "journey_a");
  assert.equal(db.created[1].sourceJourneyId, "journey_a");
});

// --- schema + migration contract (foundation for #6) ------------------------

test("#6 (schema/SQL contract) PreInquiry.sourceJourneyId is a nullable SetNull relation with an index", () => {
  const schema = readFileSync(resolve(repoRoot, "prisma", "schema.prisma"), "utf8");

  assert.match(schema, /sourceJourneyId\s+String\?/, "nullable sourceJourneyId column");
  assert.match(
    schema,
    /sourceJourney\s+Journey\?\s+@relation\(fields:\s*\[sourceJourneyId\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/,
    "SetNull relation to Journey"
  );
  assert.match(schema, /@@index\(\[sourceJourneyId\]\)/, "index on sourceJourneyId");
  assert.match(schema, /model Journey \{[\s\S]*?preInquiries\s+PreInquiry\[\][\s\S]*?\}/, "Journey back-relation");
});

test("#6 (schema/SQL contract) the migration creates the FK with ON DELETE SET NULL", () => {
  const migration = readFileSync(
    resolve(
      repoRoot,
      "prisma",
      "migrations",
      "20260713153000_pre_inquiry_source_journey",
      "migration.sql"
    ),
    "utf8"
  );

  assert.match(migration, /ALTER TABLE "PreInquiry" ADD COLUMN "sourceJourneyId" TEXT;/);
  assert.match(migration, /CREATE INDEX "PreInquiry_sourceJourneyId_idx" ON "PreInquiry"\("sourceJourneyId"\);/);
  assert.match(
    migration,
    /ADD CONSTRAINT "PreInquiry_sourceJourneyId_fkey" FOREIGN KEY \("sourceJourneyId"\) REFERENCES "Journey"\("id"\) ON DELETE SET NULL ON UPDATE CASCADE;/
  );
});

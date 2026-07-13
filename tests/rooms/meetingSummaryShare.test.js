import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  canShareMeetingSummaryRole,
  resolveConfirmedMeetingSummaryContent
} from "../../lib/rooms/meetingSummaryShare.js";

// U10: only a specialist-confirmed (FINAL) MEETING_SUMMARY artifact the caller
// owns may be shared into a room. Dependency-injected fake-Prisma.

const OWNER = "user_specialist";
const OTHER = "user_other";

function createFakeDb(artifacts = []) {
  return {
    agentArtifact: {
      async findFirst({ where, select }) {
        const row = artifacts.find((a) => a.id === where.id && a.ownerId === where.ownerId);
        if (!row) return null;
        const keys = Object.keys(select || {});
        return Object.fromEntries(keys.map((k) => [k, row[k]]));
      }
    }
  };
}

const finalSummary = {
  id: "art_1",
  ownerId: OWNER,
  type: "MEETING_SUMMARY",
  status: "FINAL",
  content: "Kokkulepe: järgmine kohtumine 2 nädala pärast; klient toob dokumendid."
};

async function expectStatus(promise, status, message) {
  const error = await promise.then(() => null, (e) => e);
  assert.ok(error instanceof Error, "expected a throw");
  assert.equal(error.status, status);
  if (message) assert.equal(error.message, message);
  return error;
}

test("returns the content of an owned confirmed meeting summary", async () => {
  const db = createFakeDb([finalSummary]);
  const content = await resolveConfirmedMeetingSummaryContent(OWNER, "art_1", { db, role: "SOCIAL_WORKER" });
  assert.equal(content, finalSummary.content);
});

test("a foreign or missing artifact both yield the same generic 404 (no existence leak)", async () => {
  const db = createFakeDb([finalSummary]); // art_1 belongs to OWNER
  await expectStatus(resolveConfirmedMeetingSummaryContent(OTHER, "art_1", { db, role: "SOCIAL_WORKER" }), 404, "api.common.not_found");
  await expectStatus(resolveConfirmedMeetingSummaryContent(OWNER, "does_not_exist", { db, role: "SOCIAL_WORKER" }), 404, "api.common.not_found");
});

test("a non-meeting-summary artifact is rejected with 400", async () => {
  const db = createFakeDb([{ ...finalSummary, type: "SERVICE_APPLICATION" }]);
  await expectStatus(resolveConfirmedMeetingSummaryContent(OWNER, "art_1", { db, role: "SOCIAL_WORKER" }), 400, "api.rooms.summary_wrong_type");
});

test("an unconfirmed (DRAFT) summary is rejected with 409 — only FINAL may be shared", async () => {
  const db = createFakeDb([{ ...finalSummary, status: "DRAFT" }]);
  await expectStatus(resolveConfirmedMeetingSummaryContent(OWNER, "art_1", { db, role: "SOCIAL_WORKER" }), 409, "api.rooms.summary_not_confirmed");
});

test("an empty confirmed summary is rejected with 400", async () => {
  const db = createFakeDb([{ ...finalSummary, content: "   " }]);
  await expectStatus(resolveConfirmedMeetingSummaryContent(OWNER, "art_1", { db, role: "SOCIAL_WORKER" }), 400, "api.rooms.summary_empty");
});

test("missing user or artifact id yields 404 without a DB call", async () => {
  let queried = false;
  const db = { agentArtifact: { async findFirst() { queried = true; return null; } } };
  await expectStatus(resolveConfirmedMeetingSummaryContent("", "art_1", { db, role: "SOCIAL_WORKER" }), 404);
  await expectStatus(resolveConfirmedMeetingSummaryContent(OWNER, "", { db, role: "SOCIAL_WORKER" }), 404);
  assert.equal(queried, false);
});

test("only specialist roles may share a meeting summary", async () => {
  assert.equal(canShareMeetingSummaryRole("SOCIAL_WORKER"), true);
  assert.equal(canShareMeetingSummaryRole("SERVICE_PROVIDER"), true);
  assert.equal(canShareMeetingSummaryRole("ADMIN"), true);
  assert.equal(canShareMeetingSummaryRole("CLIENT"), false);

  let queried = false;
  const db = { agentArtifact: { async findFirst() { queried = true; return finalSummary; } } };
  await expectStatus(
    resolveConfirmedMeetingSummaryContent(OWNER, "art_1", { db, role: "CLIENT" }),
    403,
    "api.common.forbidden"
  );
  assert.equal(queried, false, "reject the role before reading the artifact");
});

test("share UI requires an explicit shared-room choice and confirms the approved text", async () => {
  const source = await readFile(
    new URL("../../components/documents/MeetingSummaryRoomShare.jsx", import.meta.url),
    "utf8"
  );

  assert.match(source, /Number\(room\?\.memberCount\) > 1/u);
  assert.match(source, /setSelectedRoomId\(""\)/u);
  assert.match(source, /privacyDecision:\s*\{ action: "send_original" \}/u);
  assert.doesNotMatch(source, /summaryArtifactId:\s*artifactId[\s\S]*artifactId:/u);
});

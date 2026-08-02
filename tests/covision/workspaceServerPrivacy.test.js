import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertCovisionLegacyWriteAllowed,
  assertCovisionLegacyPatchAllowed,
  canCreateCovision,
  covisionParticipantIdentityOr,
  findCovisionParticipantForActor,
  normalizeCovisionLegacyPatchStatus,
  serializeCovisionWorkspaceCase
} from "../../lib/covisionAccessShared.js";
import { buildCovisionInviteLink } from "../../lib/covisionInvites.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const serverSource = fs.readFileSync(path.join(root, "lib/covision.js"), "utf8");

function caseRow(inviteStatus) {
  return {
    id: "case_secret",
    ownerId: "owner",
    title: "Tundlik pealkiri",
    summary: "Tundlik kokkuvõte",
    centralQuestion: "Tundlik küsimus",
    status: "ACTIVE",
    lastActivityAt: "2026-07-14T12:00:00.000Z",
    updatedAt: "2026-07-14T12:00:00.000Z",
    owner: { email: "owner@example.test" },
    messages: [{ body: "salajane sõnum" }],
    participants: [{
      userId: null,
      email: "invited@example.test",
      role: "OBSERVER",
      inviteStatus
    }, {
      userId: "someone_else",
      email: "someone@example.test",
      role: "PARTICIPANT",
      inviteStatus: "ACCEPTED"
    }]
  };
}

test("workspace invitation card exposes no case content, people or email addresses", () => {
  const card = serializeCovisionWorkspaceCase(caseRow("INVITED"), {
    userId: "new_user",
    email: "invited@example.test"
  });
  assert.equal(card.id, "case_secret");
  assert.equal(card.isInvitation, true);
  assert.equal(card.contentRestricted, true);
  assert.equal(card.title, null);
  assert.equal(card.summary, null);
  assert.equal(card.centralQuestion, null);
  const serialized = JSON.stringify(card);
  for (const secret of [
    "Tundlik pealkiri", "Tundlik kokkuvõte", "Tundlik küsimus",
    "salajane sõnum", "invited@example.test", "owner@example.test"
  ]) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.equal("participants" in card, false);
  assert.equal("owner" in card, false);
  assert.equal("messages" in card, false);
});

test("accepted participant gets only the minimal workspace card fields", () => {
  const card = serializeCovisionWorkspaceCase(caseRow("ACCEPTED"), {
    userId: "accepted_user",
    email: "invited@example.test"
  });
  assert.equal(card.isInvitation, false);
  assert.equal(card.contentRestricted, false);
  assert.equal(card.title, "Tundlik pealkiri");
  assert.equal(card.currentUserRole, "observer");
  assert.equal(JSON.stringify(card).includes("invited@example.test"), false);
  assert.deepEqual(Object.keys(card).sort(), [
    "centralQuestion", "contentRestricted", "currentUserRole", "id", "inviteStatus",
    "isInvitation", "lastActivityAt", "status", "summary", "title", "updatedAt"
  ]);
});

test("a reused email never inherits a participant record already bound to another account", () => {
  const row = caseRow("ACCEPTED");
  row.participants[0].userId = "former_account";
  assert.equal(findCovisionParticipantForActor(row, "new_account", "invited@example.test"), null);
  assert.equal(serializeCovisionWorkspaceCase(row, {
    userId: "new_account",
    email: "invited@example.test"
  }), null);
  assert.deepEqual(covisionParticipantIdentityOr({
    userId: "new_account",
    email: "Invited@Example.Test"
  }), [
    { userId: "new_account" },
    { userId: null, email: "invited@example.test" }
  ]);
});

test("workspace exposes only the create capability boolean", () => {
  // Mõlemad spetsialistirollid tohivad juhtumi luua (omanik 02.08).
  assert.equal(canCreateCovision({ role: "SOCIAL_WORKER" }), true);
  assert.equal(canCreateCovision({ role: "SERVICE_PROVIDER" }), true);
  assert.equal(canCreateCovision({ role: "SERVICE_PROVIDER", isAdmin: true }), true);
  // Klient ei tohi — see piir on kovisiooni oma, mitte paketi oma.
  assert.equal(canCreateCovision({ role: "CLIENT" }), false);
  assert.equal(canCreateCovision({}), false);
});

test("legacy case lifecycle cannot mint closure states or rewrite a live session", () => {
  assert.equal(normalizeCovisionLegacyPatchStatus(undefined, "ACTIVE"), "ACTIVE");
  assert.equal(normalizeCovisionLegacyPatchStatus("summary_ready", "ACTIVE"), "SUMMARY_READY");
  for (const status of ["closed", "ARCHIVED"]) {
    assert.throws(
      () => normalizeCovisionLegacyPatchStatus(status, "ACTIVE"),
      (error) => error.status === 409
    );
  }
  assert.throws(
    () => assertCovisionLegacyPatchAllowed({ sessionState: { id: "session_1" } }),
    (error) => error.status === 409
  );
  assert.doesNotThrow(() => assertCovisionLegacyPatchAllowed({ sessionState: null }));
});

test("legacy messages and summaries reject every terminal case shape", () => {
  for (const terminal of [
    { status: "CLOSED" },
    { status: "ARCHIVED" },
    { status: "ACTIVE", sessionState: { phase: "complete" } },
    { status: "ACTIVE", closure: { id: "closure_1" } }
  ]) {
    assert.throws(
      () => assertCovisionLegacyWriteAllowed(terminal),
      (error) => error.status === 409 && error.message === "covision.errors.case_read_only"
    );
  }
  assert.doesNotThrow(() => assertCovisionLegacyWriteAllowed({
    status: "ACTIVE",
    sessionState: { phase: "story_sharing" },
    closure: null
  }));
});

test("server contracts keep invited workspace access separate from accepted content access", () => {
  assert.match(serverSource, /inviteStatus:\s*"ACCEPTED"/);
  assert.match(serverSource, /inviteStatus:\s*\{\s*in:\s*\["INVITED",\s*"ACCEPTED"\]\s*\}/);
  assert.match(serverSource, /select:\s*workspaceCaseSelect\(auth\)/);
  assert.doesNotMatch(
    serverSource.slice(
      serverSource.indexOf("export async function listCovisionWorkspace"),
      serverSource.indexOf("export async function listVisibleEffectivePractices")
    ),
    /serializeCovisionCase|effectivePractice/
  );
});

test("legacy case-detail serialization never returns account or invitation emails", () => {
  const userSerializer = serverSource.slice(
    serverSource.indexOf("function serializeUser"),
    serverSource.indexOf("export function serializeCovisionCase")
  );
  const caseSerializer = serverSource.slice(
    serverSource.indexOf("export function serializeCovisionCase"),
    serverSource.indexOf("export async function listCovisionWorkspace")
  );
  assert.doesNotMatch(userSerializer, /\bemail\s*:/);
  assert.doesNotMatch(caseSerializer, /\bemail\s*:/);
  assert.match(caseSerializer, /owner:\s*serializeUser/);
  assert.match(caseSerializer, /user:\s*serializeUser\(participant\.user\)/);
  for (const forbiddenKey of ["ownerId", "currentUserId", "userId", "authorId"]) {
    assert.doesNotMatch(caseSerializer, new RegExp(`\\b${forbiddenKey}\\s*:`));
  }
  assert.match(caseSerializer, /covisionCase\.ownerId === userId[\s\S]*sourcePreInquiryId/);
});

test("generic create ignores a caller supplied source pre-inquiry id", () => {
  const createSource = serverSource.slice(
    serverSource.indexOf("export async function createCovisionCase"),
    serverSource.indexOf("export async function updateCovisionCase")
  );
  assert.match(createSource, /options\.sourcePreInquiryId/);
  assert.doesNotMatch(createSource, /input\.sourcePreInquiryId/);
});

test("generic create starts as DRAFT with a version-zero waiting-room session", () => {
  const createSource = serverSource.slice(
    serverSource.indexOf("export async function createCovisionCase"),
    serverSource.indexOf("export async function updateCovisionCase")
  );
  assert.match(serverSource, /existing\s*\?\s*normalizeCovisionLegacyPatchStatus[\s\S]*:\s*"DRAFT"/);
  assert.match(createSource, /covisionSessionState\.create/);
  assert.match(createSource, /phase:\s*"waiting_room"/);
  assert.match(createSource, /version:\s*0/);
  assert.match(createSource, /covisionParticipantState\.create/);

  const updateSource = serverSource.slice(
    serverSource.indexOf("export async function updateCovisionCase"),
    serverSource.indexOf("export async function addCovisionMessage")
  );
  assert.match(updateSource, /withCovisionLegacyWriteLock\(/);
  assert.ok(updateSource.indexOf("assertCovisionLegacyPatchAllowed(existing)")
    < updateSource.indexOf("deleteMany"));
  assert.ok(updateSource.indexOf("normalizeCaseInput(input, existing)")
    < updateSource.indexOf("deleteMany"));
});

test("invite links address the exact case without embedding case content", () => {
  const link = buildCovisionInviteLink("case / õ", "https://example.test/");
  assert.equal(link, "https://example.test/kovisioon?case=case%20%2F%20%C3%B5");
  assert.match(serverSource, /covisionCaseId:\s*covisionCase\.id/);
});

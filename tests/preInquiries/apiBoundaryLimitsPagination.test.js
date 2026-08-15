import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  PRE_INQUIRY_LIMITS,
  publicPreInquiryError,
  preInquiryRateLimitDecision
} from "../../lib/preInquiryApiBoundary.js";
import {
  assertPreInquiryInputLimits,
  listVisiblePreInquiryPage
} from "../../lib/preInquiries.js";
import { assertPreInquiryAssessmentLimits } from "../../lib/preInquiriesQuestionnaire.js";
import { listReceivedCaseWorkPage } from "../../lib/workspaces/adapters/preInquiryReceiverAdapter.js";
import { loadMySharings } from "../../lib/mySharings.js";

test("SOL-PRE-15 unknown database and mail errors never cross the public API boundary", () => {
  const marker = "postgresql://secret@db/internal SMTP_PASS=hunter2";
  assert.deepEqual(publicPreInquiryError(Object.assign(new Error(marker), { status: 400 })), {
    status: 500,
    messageKey: "pre_inquiries.errors.save_failed",
    payload: {}
  });
  assert.equal(JSON.stringify(publicPreInquiryError(new Error(marker))).includes(marker), false);
  assert.deepEqual(publicPreInquiryError(Object.assign(new Error("pre_inquiries.errors.edit_conflict"), { status: 409 })), {
    status: 409,
    messageKey: "pre_inquiries.errors.edit_conflict",
    payload: {}
  });
});

test("SOL-PRE-15/16 every pre-inquiry mutation is rate limited and raw errors are absent from public routes", () => {
  const routes = [
    "route.js", "assist/route.js", "[id]/route.js", "[id]/accept/route.js",
    "[id]/corrections/route.js", "[id]/covision/route.js", "[id]/downloaded/route.js",
    "[id]/recall/route.js", "[id]/reopen/route.js", "[id]/room/route.js",
    "[id]/send/route.js", "[id]/workflow/route.js"
  ];
  for (const route of routes) {
    const source = readFileSync(resolve("app/api/pre-inquiries", route), "utf8");
    assert.match(source, /enforcePreInquiryRateLimit/u, `${route} must enforce an action bucket`);
  }
  for (const route of ["route.js", "[id]/route.js", "[id]/send/route.js", "[id]/workflow/route.js"]) {
    const source = readFileSync(resolve("app/api/pre-inquiries", route), "utf8");
    assert.doesNotMatch(source, /error\?\.message\s*\|\|/u, `${route} must not publish raw error messages`);
  }
});

test("pre-inquiry shared abuse budget only uses the trusted proxy IP boundary", () => {
  const source = readFileSync(resolve("lib/preInquiryApiBoundary.js"), "utf8");
  assert.match(source, /getTrustedRequestIpFromRequest/u);
  assert.doesNotMatch(source, /\bgetRequestIpFromRequest\b/u);

  const seen = [];
  preInquiryRateLimitDecision({
    action: "create",
    userId: "user-a",
    ip: null,
    consume(key) {
      seen.push(key);
      return { allowed: true, remaining: 1, retryAfterSec: 0 };
    }
  });
  assert.deepEqual(seen, ["pre-inquiry:create:user:user-a"]);
});

test("SOL-PRE-16 user and IP action buckets expose retry metadata and fail on the first over-limit call", () => {
  const seen = [];
  const consume = (key, limit, windowMs) => {
    seen.push({ key, limit, windowMs });
    return key.includes(":ip:")
      ? { allowed: false, remaining: 0, retryAfterSec: 17, resetAt: Date.now() + 17_000 }
      : { allowed: true, remaining: 2, retryAfterSec: 0, resetAt: Date.now() + 60_000 };
  };
  const result = preInquiryRateLimitDecision({
    action: "assist",
    userId: "user-a",
    ip: "192.0.2.7",
    consume
  });
  assert.equal(result.allowed, false);
  assert.equal(result.retryAfterSec, 17);
  assert.match(result.headers["Retry-After"], /^17$/u);
  assert.equal(seen.length, 2);
  assert.equal(PRE_INQUIRY_LIMITS.assist.limit > 0, true);
});

test("SOL-PRE-17 boundary, boundary+1 and tail marker are validated without truncation", () => {
  const topic = "x".repeat(1_000);
  assert.doesNotThrow(() => assertPreInquiryInputLimits({ topic, situation: "ok", userEditedDraft: "y".repeat(12_000) }));
  assert.throws(
    () => assertPreInquiryInputLimits({ topic: `${topic}TAIL`, situation: "ok" }),
    (error) => error.status === 413 && error.message === "pre_inquiries.errors.topic_too_long"
  );
  const assessment = { subject: { municipalityText: `${"m".repeat(180)}TAIL` } };
  assert.throws(
    () => assertPreInquiryAssessmentLimits(assessment),
    (error) => error.status === 413 && error.message === "pre_inquiries.errors.assessment_municipality_too_long"
  );
});

test("SOL-PRE-17/18 browser contracts expose limits, remaining capacity and cursor continuation", () => {
  const workspace = readFileSync(resolve("components/workspace/WorkspaceFeaturePage.jsx"), "utf8");
  assert.match(workspace, /ServiceProfileInput maxLength=\{1000\}/u);
  assert.match(workspace, /ServiceProfileTextarea maxLength=\{12000\}/u);
  assert.match(workspace, /1000 - topic\.length/u);
  assert.match(workspace, /12000 - draft\.length/u);
  assert.match(workspace, /page\?\.hasMore/u);
  assert.match(workspace, /page\.nextCursor/u);

  const sharings = readFileSync(resolve("components/sharings/MySharingsPage.jsx"), "utf8");
  assert.match(sharings, /paging\?\.hasMore/u);
  assert.match(sharings, /paging\.nextCursor/u);
  assert.match(sharings, /append: true/u);
});

function pagedDb(rows) {
  return {
    preInquiry: {
      async count() { return rows.length; },
      async findMany({ where, take }) {
        let list = rows;
        const cursorClause = where?.AND?.find((part) => Array.isArray(part?.OR));
        if (cursorClause) {
          const beforeDate = cursorClause.OR[0].updatedAt.lt;
          const beforeId = cursorClause.OR[1].id.lt;
          list = list.filter((row) => row.updatedAt < beforeDate || (row.updatedAt.getTime() === beforeDate.getTime() && row.id < beforeId));
        }
        return list.slice(0, take);
      }
    }
  };
}

test("SOL-PRE-18 root and K1 readers page past 250 with equal timestamps and no duplicates", async () => {
  const updatedAt = new Date("2026-08-13T12:00:00.000Z");
  const rows = Array.from({ length: 257 }, (_, index) => ({
    id: `pi_${String(999 - index).padStart(4, "0")}`,
    authorId: "author",
    recipientOwnerId: "receiver",
    status: index === 256 ? "ARCHIVED" : "SENT",
    nextContactOn: null,
    recalledAt: null,
    updatedAt,
    createdAt: updatedAt,
    recipientType: "KOV_CONTACT",
    deliveryChannel: "INTERNAL",
    situation: "safe",
    author: null,
    recipientOwner: null,
    recipientEntry: null,
    recipientOrganization: null
  }));
  rows[249].sentAt = updatedAt;
  rows[249].openedAt = updatedAt;
  rows[249].supersededById = rows[250].id;
  rows[250].sentAt = updatedAt;
  rows[250].openedAt = updatedAt;
  rows[250].supersedes = { id: rows[249].id };
  const db = pagedDb(rows);
  const first = await listVisiblePreInquiryPage("author", { db, limit: 250 });
  const second = await listVisiblePreInquiryPage("author", { db, limit: 250, cursor: first.nextCursor });
  assert.equal(first.items.length, 250);
  assert.equal(first.hasMore, true);
  assert.equal(first.total, 257);
  assert.equal(second.items.length, 7);
  assert.equal(new Set([...first.items, ...second.items].map((row) => row.id)).size, 257);

  const k1 = await listReceivedCaseWorkPage("receiver", { db, limit: 250 });
  assert.equal(k1.items.length, 250);
  assert.equal(k1.hasMore, true);
  assert.ok(k1.items.some((row) => row.lifecycle === "ACTIVE"));

  const sharingDb = {
    ...db,
    roomMember: { async findMany() { return []; } }
  };
  const sharingFirst = await loadMySharings("author", { db: sharingDb, sections: "preInquiries" });
  const sharingSecond = await loadMySharings("author", {
    db: sharingDb,
    sections: "preInquiries",
    cursors: { preInquiries: sharingFirst.preInquiries.paging.nextCursor }
  });
  assert.equal(sharingFirst.preInquiries.items.length, 250);
  assert.equal(sharingSecond.preInquiries.items.length, 7);
  assert.equal(sharingFirst.preInquiries.paging.total, 257);
  assert.equal(new Set([...sharingFirst.preInquiries.items, ...sharingSecond.preInquiries.items].map((row) => row.id)).size, 257);
  assert.equal(sharingFirst.preInquiries.items.at(-1).supersededById, rows[250].id);
  assert.equal(sharingSecond.preInquiries.items[0].supersedesId, rows[249].id);
});

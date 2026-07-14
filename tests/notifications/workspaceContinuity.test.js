import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getWorkspaceContinuity } from "../../lib/workspaceContinuity.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");

function createDb() {
  const calls = [];
  const track = (model, rows) => async (query) => {
    calls.push({ model, query: structuredClone(query) });
    return structuredClone(rows);
  };
  return {
    calls,
    client: {
      preInquiry: {
        findMany: async (query) => {
          calls.push({ model: "preInquiry", query: structuredClone(query) });
          if (query.where.authorId) {
            return [{ id: "draft-1", updatedAt: "2026-07-10T10:00:00.000Z" }];
          }
          return [
            {
              id: "received-overdue",
              status: "READY",
              nextContactOn: "2026-07-13",
              updatedAt: "2026-07-14T09:00:00.000Z"
            },
            {
              id: "received-2",
              status: "SENT",
              nextContactOn: null,
              updatedAt: "2026-07-14T08:00:00.000Z"
            }
          ];
        }
      },
      roomMember: {
        findMany: track("roomMember", [
          { roomId: "room-1", lastReadAt: "2026-07-14T07:00:00.000Z" }
        ])
      },
      roomMessage: {
        async count(query) {
          calls.push({ model: "roomMessage", query: structuredClone(query) });
          return 3;
        }
      },
      wellbeingOutputDraft: {
        findMany: track("wellbeingOutputDraft", [
          { id: "wellbeing-1", updatedAt: "2026-07-09T10:00:00.000Z" }
        ])
      },
      journey: {
        findMany: track("journey", [
          { id: "journey-1", updatedAt: "2026-07-08T10:00:00.000Z" }
        ])
      },
      effectivePracticeReviewAssignment: {
        findMany: track("assignment", [
          {
            id: "assignment-1",
            practiceId: "practice-1",
            assignedAt: "2026-07-01T10:00:00.000Z",
            updatedAt: "2026-07-01T10:00:00.000Z"
          }
        ])
      },
      serviceProviderService: {
        findMany: track("service", [
          {
            id: "service-1",
            providerProfileId: "profile-1",
            availabilityCheckedAt: null,
            updatedAt: "2026-07-02T10:00:00.000Z"
          }
        ])
      }
    }
  };
}

test("continuity is owner-scoped, deterministic, content-free, deduplicated, and capped at seven", async () => {
  const db = createDb();
  const result = await getWorkspaceContinuity("user-1", { db: db.client, now: NOW });

  assert.ok(result.items.length <= 7);
  assert.equal(result.items[0].kind, "next_contact");
  assert.equal(result.items[0].overdue, true);
  assert.equal(result.items[1].kind, "practice_review");
  assert.equal(result.items[2].kind, "pre_inquiry_received");
  assert.equal(result.items[3].kind, "room_unread");
  assert.equal(
    result.items.filter((item) => item.href.includes("received-overdue")).length,
    1,
    "the due action must replace the lower-priority received card for the same target"
  );
  assert.equal(JSON.stringify(result).includes("topic"), false);
  assert.equal(JSON.stringify(result).includes("situation"), false);
  assert.deepEqual(result.badges.effective_practices, { type: "number", value: 1, label: "1" });
  assert.deepEqual(result.badges.add_person, { type: "number", value: 1, label: "1" });

  const serializedCalls = JSON.stringify(db.calls);
  assert.match(serializedCalls, /"authorId":"user-1"/u);
  assert.match(serializedCalls, /"recipientOwnerId":"user-1"/u);
  assert.match(serializedCalls, /"userId":"user-1"/u);
  assert.match(serializedCalls, /"ownerUserId":"user-1"/u);
  assert.match(serializedCalls, /"reviewerId":"user-1"/u);
  assert.match(serializedCalls, /"ownerId":"user-1"/u);
});

test("continuity API authenticates before querying and returns private no-store responses", async () => {
  const route = await readFile(
    new URL("../../app/api/workspace/continuity/route.js", import.meta.url),
    "utf8"
  );
  assert.ok(route.indexOf("getServerSession") < route.indexOf("getWorkspaceContinuity(userId)"));
  assert.match(route, /private, no-store/u);
  assert.doesNotMatch(route, /searchParams\.get\(["']userId/u);
});

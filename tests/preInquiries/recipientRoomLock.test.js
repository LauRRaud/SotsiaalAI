import test from "node:test";
import assert from "node:assert/strict";

import { assertRecipientChangeAllowed } from "../../lib/preInquiries.js";

// A2 privacy guard: once a shared (canonical) room exists for a pre-inquiry, the
// recipient is locked. assertRecipientChangeAllowed runs against the caller's
// transaction client so the existence check and the update are atomic under the
// shared advisory lock. Reassigning recipientOwnerId is rejected with a generic
// 409 so a new recipient can never inherit the previous recipient's room.

function fakeClient(room, onFindFirst) {
  return {
    room: {
      async findFirst() {
        if (onFindFirst) onFindFirst();
        return room;
      }
    }
  };
}

test("no-op when the recipient owner is unchanged — the canonical room is not even queried", async () => {
  let queried = false;
  const client = fakeClient({ id: "room_1" }, () => { queried = true; });
  await assertRecipientChangeAllowed(client, {
    inquiryId: "inq_1",
    previousRecipientOwnerId: "u1",
    nextRecipientOwnerId: "u1"
  });
  assert.equal(queried, false);
});

test("null and empty recipient owners are treated as unchanged", async () => {
  let queried = false;
  const client = fakeClient({ id: "room_1" }, () => { queried = true; });
  await assertRecipientChangeAllowed(client, {
    inquiryId: "inq_1",
    previousRecipientOwnerId: null,
    nextRecipientOwnerId: ""
  });
  assert.equal(queried, false);
});

test("blocks a recipient change with a generic 409 once a canonical room exists", async () => {
  const client = fakeClient({ id: "room_1" });
  const error = await assertRecipientChangeAllowed(client, {
    inquiryId: "inq_1",
    previousRecipientOwnerId: "u1",
    nextRecipientOwnerId: "u2"
  }).then(() => null, (err) => err);

  assert.ok(error instanceof Error);
  assert.equal(error.status, 409);
  assert.equal(error.message, "pre_inquiries.errors.recipient_locked_by_room");
});

test("allows a recipient change before any canonical room exists", async () => {
  const client = fakeClient(null);
  await assertRecipientChangeAllowed(client, {
    inquiryId: "inq_1",
    previousRecipientOwnerId: "u1",
    nextRecipientOwnerId: "u2"
  });
  assert.ok(true, "no throw when there is no room yet");
});

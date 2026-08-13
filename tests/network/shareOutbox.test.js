import assert from "node:assert/strict";
import test from "node:test";

import { createNetworkShareOutbox } from "../../lib/network/shareOutbox.js";
import { NOTIFICATION_EVENT_TYPES, notificationSpec } from "../../lib/notifications.js";
import { buildActionHref, ActionKind } from "../../lib/actions/registry.js";

test("SOL-NET-03: saatmise outbox kannab ainult viidet ja aegub pärast osaluse lõpp-päeva", async () => {
  let data = null;
  const db = {
    notificationEvent: {
      async create(input) {
        data = input.data;
        return { id: "notification-1", ...input.data };
      }
    }
  };
  const result = await createNetworkShareOutbox({
    share: {
      id: "share-1",
      recipientUserId: "recipient-1",
      sourcePreInquiryId: "pre-private",
      participationEndsOn: new Date("2026-08-13T00:00:00.000Z")
    },
    db,
    now: new Date("2026-08-10T12:00:00.000Z")
  });
  assert.equal(result.created, true);
  assert.equal(data.type, NOTIFICATION_EVENT_TYPES.NETWORK_SHARE_RECEIVED);
  assert.equal(data.sourceId, "share-1");
  assert.equal(data.targetId, "share-1");
  assert.equal(data.userId, "recipient-1");
  assert.equal(data.expiresAt.toISOString(), "2026-08-14T00:00:00.000Z");
  assert.doesNotMatch(JSON.stringify(data), /pre-private|summary|purpose|boundary/i);
});

test("SOL-NET-03: outboxi tegevus viib võrgustikujagamise pinnale, mitte lähtepöördumisse", () => {
  const spec = notificationSpec(NOTIFICATION_EVENT_TYPES.NETWORK_SHARE_RECEIVED);
  assert.equal(spec.targetKind, "NETWORK_SHARE");
  assert.equal(spec.actionKind, ActionKind.OPEN_NETWORK_SHARE);
  assert.equal(
    buildActionHref(spec.actionKind, "network_share:share-1"),
    "/eelpoordumised?networkShare=share-1"
  );
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import * as share from "../../lib/network/share.js";
import * as routes from "../../lib/network/shareRoutes.js";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("NET-07: recalled and superseded pre-inquiries are not active network-share sources", () => {
  assert.equal(typeof share.isActiveNetworkShareSource, "function");
  const base = {
    recipientOwnerId: "worker_1",
    status: "SENT",
    sentAt: new Date("2026-08-01T10:00:00Z"),
    recalledAt: null,
    supersededById: null
  };
  assert.equal(share.isActiveNetworkShareSource(base, { workerId: "worker_1" }), true);
  assert.equal(share.isActiveNetworkShareSource({ ...base, recalledAt: new Date() }, { workerId: "worker_1" }), false);
  assert.equal(share.isActiveNetworkShareSource({ ...base, supersededById: "new" }, { workerId: "worker_1" }), false);
  assert.equal(share.isActiveNetworkShareSource({ ...base, sentAt: null }, { workerId: "worker_1" }), false);
});

test("NET-08: every worker detail or mutation route has a current-role gate", () => {
  const workerRoutes = [
    "app/api/network-shares/[shareId]/route.js",
    "app/api/network-shares/[shareId]/attest/route.js",
    "app/api/network-shares/[shareId]/submit/route.js",
    "app/api/network-shares/[shareId]/send/route.js",
    "app/api/network-shares/[shareId]/recall/route.js"
  ];
  for (const path of workerRoutes) {
    assert.match(read(path), /isNetworkWorker\(auth\)/u, path);
  }
  assert.equal(routes.isNetworkWorker({ userRole: "CLIENT" }), false);
});

test("NET-09: client projection is shared by list/detail and hides DRAFT fail-closed", () => {
  assert.equal(typeof share.clientProjection, "function");
  assert.equal(share.clientProjection({ id: "s1", clientUserId: "c1", status: "DRAFT" }, { viewerUserId: "c1" }), null);
  const detail = read("app/api/network-shares/[shareId]/route.js");
  const list = read("app/api/network-shares/route.js");
  assert.match(detail, /clientProjection\(/u);
  assert.match(list, /clientProjection\(/u);
});

test("NET-10/11: all network-share handlers use the persistent request guard and lifecycle outbox", () => {
  const paths = [
    "app/api/network-shares/route.js",
    "app/api/network-shares/[shareId]/route.js",
    "app/api/network-shares/[shareId]/attest/route.js",
    "app/api/network-shares/[shareId]/decision/route.js",
    "app/api/network-shares/[shareId]/open/route.js",
    "app/api/network-shares/[shareId]/recall/route.js",
    "app/api/network-shares/[shareId]/send/route.js",
    "app/api/network-shares/[shareId]/submit/route.js"
  ];
  for (const path of paths) assert.match(read(path), /guardShareRequest\(/u, path);
  assert.match(read("lib/network/share.js"), /recordNetworkShareLifecycle/u);
  assert.match(read("lib/network/shareExpiry.js"), /recordNetworkShareLifecycle/u);
});

test("NET-12: list endpoint is cursor-paged and server-filters source and status", () => {
  const root = read("app/api/network-shares/route.js");
  assert.match(root, /listNetworkShares\(/u);
  assert.match(root, /nextCursor/u);
  assert.match(root, /sourcePreInquiryId/u);
  assert.match(root, /status/u);
  assert.match(root, /\["worker", "client", "recipient"\]\.includes\(role\)/u);
  assert.doesNotMatch(root, /take:\s*100/u);
  assert.match(read("components/network/NetworkShareComposer.jsx"), /payload\.nextCursor/u);
  assert.match(read("components/network/NetworkShareInbox.jsx"), /payload\.nextCursor/u);
});

test("NET-12: 103 equal-timestamp rows page without gaps or duplicates", async () => {
  const stamp = new Date("2026-08-13T10:00:00.000Z");
  const rows = Array.from({ length: 103 }, (_, index) => ({
    id: `share-${String(index + 1).padStart(3, "0")}`,
    workerId: "worker-1",
    sourcePreInquiryId: "source-1",
    status: "SENT",
    updatedAt: stamp
  })).sort((a, b) => b.id.localeCompare(a.id));
  const db = {
    networkShare: {
      async findMany(query) {
        assert.equal(query.where.workerId, "worker-1");
        assert.equal(query.where.sourcePreInquiryId, "source-1");
        assert.equal(query.where.status, "SENT");
        const cursorId = query.where.OR?.[1]?.id?.lt || null;
        return rows.filter((row) => !cursorId || row.id < cursorId).slice(0, query.take);
      }
    }
  };
  const first = await share.listNetworkShares({
    prisma: db,
    viewerUserId: "worker-1",
    role: "worker",
    sourcePreInquiryId: "source-1",
    status: "SENT",
    limit: 100
  });
  const second = await share.listNetworkShares({
    prisma: db,
    viewerUserId: "worker-1",
    role: "worker",
    sourcePreInquiryId: "source-1",
    status: "SENT",
    limit: 100,
    cursor: first.nextCursor
  });
  assert.equal(first.rows.length, 100);
  assert.equal(second.rows.length, 3);
  assert.equal(new Set([...first.rows, ...second.rows].map((row) => row.id)).size, 103);
});

test("NET-13: first room response advances its network share in the message transaction", () => {
  const messages = read("app/api/rooms/[roomId]/messages/route.js");
  assert.match(messages, /markNetworkShareRespondedByRoom/u);
  assert.match(messages, /markNetworkShareRespondedByRoom\([\s\S]*db:\s*tx/u);
});

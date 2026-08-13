import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { deleteHelpOffer } from "../../lib/help/offers.js";
import { deleteHelpRequest } from "../../lib/help/requests.js";

function createAcceptedDeleteDb(kind, { failAudit = 0, accepted = true, status = null } = {}) {
  let remainingAuditFailures = failAudit;
  const state = {
    listings: [{ id: `${kind}-1`, userId: "owner-1", status: "MATCHED" }],
    mapEntries: [{ id: "map-1", [`${kind}Id`]: `${kind}-1`, mapVisible: true, status: "PUBLISHED" }],
    matches: [{
      id: "match-1",
      requestId: "request-1",
      offerId: "offer-1",
      requesterId: "requester-1",
      offererId: "offerer-1",
      initiatedByUserId: "requester-1",
      roomId: accepted ? "room-1" : null,
      status: status || (accepted ? "ACCEPTED" : "DECLINED")
    }],
    rooms: [{ id: "room-1", archivedAt: null }],
    members: [
      { id: "member-1", roomId: "room-1", userId: "requester-1", leftAt: null },
      { id: "member-2", roomId: "room-1", userId: "offerer-1", leftAt: null }
    ],
    audits: []
  };
  function makeClient(target, transactional = false) {
    const listingModel = {
      async findUnique({ where }) {
        return structuredClone(target.listings.find((row) => row.id === where.id) || null);
      },
      async update({ where, data }) {
        const row = target.listings.find((item) => item.id === where.id);
        Object.assign(row, structuredClone(data));
        return { id: row.id };
      },
      async delete({ where }) {
        target.listings = target.listings.filter((row) => row.id !== where.id);
        return { id: where.id };
      }
    };
    const client = {
      async $queryRawUnsafe() { return []; },
      helpRequest: kind === "request" ? listingModel : {},
      helpOffer: kind === "offer" ? listingModel : {},
      helpMatch: {
        async findMany({ where }) {
          return structuredClone(target.matches.filter((row) => (
            row[`${kind}Id`] === where[`${kind}Id`]
            && row.roomId !== null
            && where.status.in.includes(row.status)
          )));
        },
        async deleteMany({ where }) {
          const before = target.matches.length;
          target.matches = target.matches.filter((row) => !(
            row[`${kind}Id`] === where[`${kind}Id`] && row.roomId === null
          ));
          return { count: before - target.matches.length };
        }
      },
      room: {
        async findMany({ where }) {
          return structuredClone(target.rooms.filter((room) => where.id.in.includes(room.id)));
        }
      },
      roomMember: {
        async findMany({ where }) {
          return structuredClone(target.members.filter((member) => where.roomId.in.includes(member.roomId)));
        }
      },
      helpMapEntry: {
        async updateMany({ where, data }) {
          let count = 0;
          for (const row of target.mapEntries) {
            if (row[`${kind}Id`] !== where[`${kind}Id`]) continue;
            Object.assign(row, structuredClone(data));
            count += 1;
          }
          return { count };
        }
      },
      dataAuditLog: {
        async findFirst({ where }) {
          return structuredClone(target.audits.find((row) => (
            row.action === where.action
            && row.resourceType === where.resourceType
            && row.resourceId === where.resourceId
          )) || null);
        },
        async create({ data }) {
          if (remainingAuditFailures > 0) {
            remainingAuditFailures -= 1;
            throw new Error("AUDIT_WRITE_INJECTED");
          }
          const row = { id: `audit-${target.audits.length + 1}`, ...structuredClone(data) };
          target.audits.push(row);
          return structuredClone(row);
        }
      }
    };
    if (!transactional) {
      client.$transaction = async (callback) => {
        const draft = structuredClone(target);
        const result = await callback(makeClient(draft, true));
        Object.assign(target, draft);
        return result;
      };
    }
    return client;
  }
  return {
    state,
    client: makeClient(state)
  };
}

test("SOL-HELP-09 negatiivtõend: ACCEPTED sobituse allikat ei kõvakustutata", async () => {
  for (const kind of ["request", "offer"]) {
    const db = createAcceptedDeleteDb(kind);
    const remove = kind === "request" ? deleteHelpRequest : deleteHelpOffer;
    await remove(`${kind}-1`, db.client);

    assert.equal(db.state.listings[0]?.status, "CLOSED", `${kind}: kuulutus peab säilima CLOSED tõendina`);
    assert.equal(db.state.matches.length, 1, `${kind}: nõusolekutõend peab säilima`);
    assert.equal(db.state.rooms.length, 1, `${kind}: teadlikult säilitatav ruum peab säilima`);
    assert.equal(db.state.members.length, 2, `${kind}: liikmesuste ajalugu peab säilima`);
    assert.equal(db.state.audits.length, 1, `${kind}: sulgemine peab jätma ühe auditi`);
    assert.equal(db.state.mapEntries[0].mapVisible, false, `${kind}: suletud allikas kaob kaardilt`);
    assert.equal(db.state.mapEntries[0].status, "HIDDEN", `${kind}: kaardikirje muutub peidetuks`);
  }
});

test("SOL-HELP-13: CONTACTED ja ruumiga CLOSED sobitus säilitavad nõusolekutõendi", async () => {
  for (const status of ["CONTACTED", "CLOSED"]) {
    const db = createAcceptedDeleteDb("request", { status });
    const result = await deleteHelpRequest("request-1", db.client);
    assert.equal(result.disposition, "CLOSED_ACCEPTED_MATCH", status);
    assert.equal(db.state.matches[0].status, status);
    assert.equal(db.state.rooms.length, 1);
    assert.equal(db.state.members.length, 2);
  }
});

test("SOL-HELP-09: auditivea korral rollback'ivad kuulutus, kaart ja tõend koos", async () => {
  const db = createAcceptedDeleteDb("request", { failAudit: 1 });
  await assert.rejects(
    deleteHelpRequest("request-1", {
      actorUserId: "owner-1",
      ipAddress: "127.0.0.1"
    }, db.client),
    /AUDIT_WRITE_INJECTED/
  );
  assert.equal(db.state.listings[0].status, "MATCHED");
  assert.equal(db.state.mapEntries[0].status, "PUBLISHED");
  assert.equal(db.state.matches[0].status, "ACCEPTED");
  assert.equal(db.state.rooms.length, 1);
  assert.equal(db.state.members.length, 2);
  assert.equal(db.state.audits.length, 0);
});

test("SOL-HELP-09: accepted sulgemise kordus ei dubleeri auditit", async () => {
  const db = createAcceptedDeleteDb("offer");
  const first = await deleteHelpOffer("offer-1", { actorUserId: "owner-1" }, db.client);
  const second = await deleteHelpOffer("offer-1", { actorUserId: "owner-1" }, db.client);
  assert.equal(first.disposition, "CLOSED_ACCEPTED_MATCH");
  assert.equal(second.disposition, "CLOSED_ACCEPTED_MATCH");
  assert.equal(first.auditCreated, true);
  assert.equal(second.auditCreated, false);
  assert.equal(db.state.audits.length, 1);
});

test("SOL-HELP-09: accepted sobitus ilma ruumi või osalise liikmesuseta peatab sulgemise", async () => {
  for (const mutate of [
    (state) => { state.rooms.length = 0; },
    (state) => { state.members.pop(); }
  ]) {
    const db = createAcceptedDeleteDb("request");
    mutate(db.state);
    await assert.rejects(
      deleteHelpRequest("request-1", { actorUserId: "owner-1" }, db.client),
      (error) => error?.code === "HELP_LISTING_ACCEPTED_MATCH_INCONSISTENT"
    );
    assert.equal(db.state.listings[0].status, "MATCHED");
    assert.equal(db.state.audits.length, 0);
  }
});

test("SOL-HELP-09: accepted sobituseta kuulutus ja terminalne match kustutatakse endiselt", async () => {
  const db = createAcceptedDeleteDb("request", { accepted: false });
  const result = await deleteHelpRequest("request-1", db.client);
  assert.equal(result.disposition, "HARD_DELETED");
  assert.equal(db.state.listings.length, 0);
  assert.equal(db.state.matches.length, 0);
});

test("SOL-HELP-09 API/UI: route tagastab disposition'i ja kinnitus selgitab säilitatavat tõendit", () => {
  const route = readFileSync("app/api/help/listings/[kind]/[id]/route.js", "utf8");
  const chat = readFileSync("components/alalehed/ChatBody.jsx", "utf8");
  const et = JSON.parse(readFileSync("messages/et.json", "utf8"));
  const en = JSON.parse(readFileSync("messages/en.json", "utf8"));
  const ru = JSON.parse(readFileSync("messages/ru.json", "utf8"));

  assert.match(route, /actorUserId:\s*auth\.userId/);
  assert.match(route, /isAdmin:\s*auth\.isAdmin/);
  assert.match(route, /ipAddress:\s*getRequestIpFromRequest/);
  assert.match(route, /ok:\s*true,[\s\S]*\.\.\.result/);
  assert.match(chat, /message=\{helpUi\.deleteConfirm\}/);
  assert.match(et.chat.help.deleteConfirm, /nõusolekutõend/);
  assert.match(et.chat.help.deleteConfirm, /vestlus/);
  assert.match(en.chat.help.deleteConfirm, /consent record/);
  assert.match(en.chat.help.deleteConfirm, /conversation/);
  assert.match(ru.chat.help.deleteConfirm, /подтверждение согласия/);
  assert.match(ru.chat.help.deleteConfirm, /чат/);
});

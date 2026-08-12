import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  issueSponsoredInviteDelivery,
  restoreMissingSponsoredInviteDelivery,
  sponsoredInviteDedupeKey
} from "../../lib/payments/sponsoredInviteDelivery.js";

/* SOL-PAY-07 — TASUTUD KUTSE LINK EI TOHI KADUDA.

   Toortoken sündis tehingu sees, salvestati ainult räsi, ja outbox-rida loodi
   alles pärast commit'i — enqueue-viga neelati logiks ja webhook vastas 200.
   Räsist toortokenit tagasi ei saa: makse ja kutse `SENT` seis jäid alles, link
   kadus. Nende testide kandev väide: kandja ja räsi ei saa lahku minna. */

const HOUR = 60 * 60 * 1000;

function fakeTx({ invite, outboxRow = null, enqueueFails = false } = {}) {
  const state = {
    invite: { ...invite },
    outbox: outboxRow ? { ...outboxRow } : null,
    enqueued: [],
    inviteUpdates: []
  };
  return {
    state,
    invite: {
      async findUnique() {
        return state.invite ? { ...state.invite } : null;
      },
      async update({ data }) {
        state.inviteUpdates.push(data);
        state.invite = { ...state.invite, ...data };
        return { ...state.invite };
      }
    },
    paymentEmailOutbox: {
      async findUnique() {
        return state.outbox ? { ...state.outbox } : null;
      },
      async create({ data }) {
        if (enqueueFails) throw Object.assign(new Error("outbox down"), { code: "P1001" });
        if (state.outbox) throw Object.assign(new Error("duplicate"), { code: "P2002" });
        state.outbox = { ...data };
        state.enqueued.push(data);
        return { id: "outbox_1", ...data };
      }
    }
  };
}

const INVITE = {
  id: "invite_1",
  status: "PENDING_PAYMENT",
  expiresAt: new Date(Date.now() + 24 * HOUR),
  sponsoredRole: "CLIENT",
  inviteeEmail: "guest@probe.invalid",
  room: { title: "Ruum" },
  inviter: { email: "host@probe.invalid" }
};

test("KANDEV: räsi ja kandja sünnivad koos", async () => {
  const tx = fakeTx({ invite: INVITE });
  const result = await issueSponsoredInviteDelivery(tx, {
    paymentId: "pay_1",
    inviteId: "invite_1",
    locale: "et",
    activate: true
  });

  assert.equal(result.delivered, true);
  assert.equal(tx.state.enqueued.length, 1);
  const row = tx.state.enqueued[0];
  assert.equal(row.dedupeKey, sponsoredInviteDedupeKey("pay_1"));
  assert.equal(row.template, "invite_sponsored");
  assert.equal(row.toEmail, "guest@probe.invalid");
  assert.ok(row.payload.joinToken, "kandja kannab TOORTOKENIT — räsist teda tagasi ei saa");
  assert.equal(row.payload.roomTitle, "Ruum");
  assert.equal(tx.state.invite.status, "SENT");
  assert.ok(tx.state.invite.tokenHash, "räsi kirjutati");
  assert.ok(tx.state.invite.sponsoredPaidAt);
});

test("KANDEV: kui kandjat ei saa luua, ei jõustu ka räsi (erind pöörab tehingu)", async () => {
  const tx = fakeTx({ invite: INVITE, enqueueFails: true });
  await assert.rejects(
    () =>
      issueSponsoredInviteDelivery(tx, {
        paymentId: "pay_1",
        inviteId: "invite_1",
        activate: true
      }),
    (error) => error.code === "INVITE_DELIVERY_UNAVAILABLE"
  );
});

test("olemasolev kandja: õigus jõustub, aga räsi EI rotreeru", async () => {
  const tx = fakeTx({
    invite: { ...INVITE, tokenHash: "olemasolev" },
    outboxRow: { dedupeKey: sponsoredInviteDedupeKey("pay_1") }
  });
  const result = await issueSponsoredInviteDelivery(tx, {
    paymentId: "pay_1",
    inviteId: "invite_1",
    activate: true
  });
  assert.equal(result.delivered, true);
  assert.equal(result.reason, "already_queued");
  assert.equal(tx.state.invite.status, "SENT", "õigus on makse tagajärg, mitte kirja oma");
  assert.equal(
    tx.state.invite.tokenHash,
    "olemasolev",
    "kandja kannab just seda tokenit, millele praegune räsi vastab"
  );
});

/* Sond tabas selle päris PostgreSQL-is: unikaalsuse rikkumine MÜRGITAB tehingu,
   seega `catch (P2002)` ei päästa siin midagi — kutse jäi `PENDING_PAYMENT`-i,
   kuigi logi ütles „activated". Olemasolu tuleb kontrollida ENNE kirjutamist. */
test("kandja olemasolu kontrollitakse ENNE kirjutamist, mitte erindi kaudu", () => {
  const source = readFileSync(
    new URL("../../lib/payments/sponsoredInviteDelivery.js", import.meta.url),
    "utf8"
  );
  const lookupIndex = source.indexOf("paymentEmailOutbox.findUnique");
  const createIndex = source.indexOf("enqueuePaymentEmail(tx");
  assert.ok(lookupIndex > 0 && createIndex > lookupIndex, "kontroll peab tulema enne loomist");
});

test("KANDEV: kordus taastab kadunud kandja ilma uue õiguse või makseta", async () => {
  const tx = fakeTx({ invite: { ...INVITE, status: "SENT", tokenHash: "vana" } });
  const restored = await restoreMissingSponsoredInviteDelivery(tx, {
    payment: { id: "pay_1", status: "PAID", inviteId: "invite_1" },
    locale: "et"
  });

  assert.equal(restored, true);
  assert.equal(tx.state.enqueued.length, 1);
  assert.ok(tx.state.enqueued[0].payload.joinToken);
  assert.equal(tx.state.invite.status, "SENT", "seis ei liigu — uut õigust ei anta");
  assert.notEqual(tx.state.invite.tokenHash, "vana", "uus link, sest vana ei läinud kunagi välja");
});

test("olemasoleva kandja peale ei rotreerita midagi", async () => {
  const tx = fakeTx({
    invite: { ...INVITE, status: "SENT", tokenHash: "elus" },
    outboxRow: { dedupeKey: sponsoredInviteDedupeKey("pay_1") }
  });
  const restored = await restoreMissingSponsoredInviteDelivery(tx, {
    payment: { id: "pay_1", status: "PAID", inviteId: "invite_1" }
  });
  assert.equal(restored, false);
  assert.equal(tx.state.invite.tokenHash, "elus", "postkastis olev link jääb elama");
});

test("terminaalset või aegunud kutset ei ärata keegi", async () => {
  for (const status of ["ACCEPTED", "REVOKED", "EXPIRED", "PENDING_PAYMENT"]) {
    const tx = fakeTx({ invite: { ...INVITE, status } });
    const restored = await restoreMissingSponsoredInviteDelivery(tx, {
      payment: { id: "pay_1", status: "PAID", inviteId: "invite_1" }
    });
    assert.equal(restored, false, status);
  }

  const expired = fakeTx({
    invite: { ...INVITE, status: "SENT", expiresAt: new Date(Date.now() - HOUR) }
  });
  assert.equal(
    await restoreMissingSponsoredInviteDelivery(expired, {
      payment: { id: "pay_1", status: "PAID", inviteId: "invite_1" }
    }),
    false,
    "aegunud kutse"
  );
});

test("maksmata makse peale ei taastata midagi", async () => {
  const tx = fakeTx({ invite: { ...INVITE, status: "SENT" } });
  const restored = await restoreMissingSponsoredInviteDelivery(tx, {
    payment: { id: "pay_1", status: "INITIATED", inviteId: "invite_1" }
  });
  assert.equal(restored, false);
});

/* LEPING: webhook peab kutse kirja looma TEHINGU SEES. */
test("kutse-kiri ei sünni enam pärast commit'i", () => {
  const source = readFileSync(
    new URL("../../app/api/subscription/webhook/route.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /issueSponsoredInviteDelivery\(tx, \{/);
  assert.match(source, /restoreMissingSponsoredInviteDelivery\(tx, \{/);
  assert.ok(
    !/dedupeKey: `invite:\$\{result\.paymentId\}`/.test(source),
    "vana kuju: kandja loodi tehingust väljas ja viga neelati logiks"
  );
  assert.ok(
    !/crypto\.randomBytes\(48\)/.test(source),
    "toortokenit ei mindita enam marsruudis"
  );
});

test("välja läinud kiri ei jäta toortokenit andmebaasi vedelema", () => {
  const source = readFileSync(new URL("../../lib/payments/emailOutbox.js", import.meta.url), "utf8");
  assert.match(source, /stripDeliverySecrets/);
  assert.match(source, /joinTokenDelivered: true/);
});

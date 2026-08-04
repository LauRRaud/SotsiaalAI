import assert from "node:assert/strict";
import test from "node:test";

import {
  clientRespondToShare,
  createNetworkShare,
  markShareOpened,
  NetworkShareStatus,
  recallNetworkShare,
  recipientProjection,
  RECIPIENT_VISIBLE_FIELDS,
  sendNetworkShare,
  submitToClient,
  updateNetworkShareDraft
} from "../../lib/network/share.js";

// --- Fake prisma -------------------------------------------------------------

function createModel(initial = []) {
  const rows = [...initial];
  return {
    rows,
    async findFirst({ where } = {}) {
      return rows.find((row) => Object.entries(where || {}).every(([k, v]) => row[k] === v)) || null;
    },
    async create({ data }) {
      const row = { id: data.id || `row_${rows.length + 1}`, ...data };
      rows.push(row);
      return row;
    },
    async update({ where, data }) {
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error("not_found");
      Object.assign(row, data);
      return row;
    }
  };
}

function createPrisma() {
  return {
    networkShare: createModel(),
    preInquiry: createModel([{ id: "pre_1", authorId: "client_1" }]),
    user: createModel([
      { id: "worker_1" },
      { id: "client_1" },
      { id: "provider_1" }
    ])
  };
}

const NOW = new Date("2026-08-04T10:00:00Z");
const now = () => NOW;

function baseInput(prisma, overrides = {}) {
  return {
    prisma,
    workerId: "worker_1",
    sourcePreInquiryId: "pre_1",
    clientUserId: "client_1",
    recipientUserId: "provider_1",
    summaryText: "Perel on eluasemevõlg ja vaja on võlanõustamist.",
    purpose: "Võlanõustaja kaasamine.",
    sharingBoundary: "Ainult võlaolukorra kokkuvõte. Terviseinfot ei jagata.",
    participationEndsOn: "2026-12-31",
    now,
    ...overrides
  };
}

async function draftedShare(prisma, overrides = {}) {
  return createNetworkShare(baseInput(prisma, overrides));
}

async function confirmedShare(prisma) {
  const share = await draftedShare(prisma);
  await submitToClient({ prisma, shareId: share.id, workerId: "worker_1", now });
  return clientRespondToShare({
    prisma,
    shareId: share.id,
    clientUserId: "client_1",
    decision: "CONFIRMED",
    now
  });
}

// --- O-CO-6 värav: saaja PEAB olema kasutaja ---------------------------------

test("VÄRAV: tundmatule saajale ei saa jagada — mittekasutaja rada on suletud", async () => {
  const prisma = createPrisma();
  await assert.rejects(
    () => draftedShare(prisma, { recipientUserId: "keegi_valjastpoolt" }),
    (err) => err.code === "network_share.recipient_not_a_user"
  );
});

test("VÄRAV: saaja ei saa olla määramata", async () => {
  const prisma = createPrisma();
  await assert.rejects(
    () => draftedShare(prisma, { recipientUserId: null }),
    (err) => err.code === "network_share.recipient_required"
  );
});

test("VÄRAV: klient ja saaja ei saa olla sama inimene", async () => {
  const prisma = createPrisma();
  await assert.rejects(
    () => draftedShare(prisma, { recipientUserId: "client_1" }),
    (err) => err.code === "network_share.client_cannot_be_recipient"
  );
});

// --- Kaardistamise lõpp on kohustuslik ---------------------------------------

test("kaardistamise lõputa jagamist ei saa luua — 'igavesti vaikimisi' on keelatud", async () => {
  const prisma = createPrisma();
  await assert.rejects(
    () => draftedShare(prisma, { participationEndsOn: null }),
    (err) => err.code === "network_share.participation_end_required"
  );
});

test("minevikku jääv lõppkuupäev ei kõlba", async () => {
  const prisma = createPrisma();
  await assert.rejects(
    () => draftedShare(prisma, { participationEndsOn: "2026-01-01" }),
    (err) => err.code === "network_share.participation_end_in_past"
  );
});

test("jagamispiir ja eesmärk on kohustuslikud väljad", async () => {
  const prisma = createPrisma();
  await assert.rejects(
    () => draftedShare(prisma, { sharingBoundary: "   " }),
    (err) => err.code === "network_share.sharing_boundary_required"
  );
  await assert.rejects(
    () => draftedShare(prisma, { purpose: "" }),
    (err) => err.code === "network_share.purpose_required"
  );
});

// --- Kliendi kinnitus on saatmise eeltingimus --------------------------------

test("kinnitamata jagamist EI SAA saata", async () => {
  const prisma = createPrisma();
  const share = await draftedShare(prisma);
  await assert.rejects(
    () => sendNetworkShare({ prisma, shareId: share.id, workerId: "worker_1", now }),
    (err) => err.code === "network_share.client_confirmation_required"
  );
});

test("kliendi ülevaatuses olevat jagamist ei saa samuti saata", async () => {
  const prisma = createPrisma();
  const share = await draftedShare(prisma);
  await submitToClient({ prisma, shareId: share.id, workerId: "worker_1", now });
  await assert.rejects(
    () => sendNetworkShare({ prisma, shareId: share.id, workerId: "worker_1", now }),
    (err) => err.code === "network_share.client_confirmation_required"
  );
});

test("töötaja EI SAA kliendi eest kinnitada", async () => {
  const prisma = createPrisma();
  const share = await draftedShare(prisma);
  await submitToClient({ prisma, shareId: share.id, workerId: "worker_1", now });
  await assert.rejects(
    () => clientRespondToShare({
      prisma,
      shareId: share.id,
      clientUserId: "worker_1",
      decision: "CONFIRMED",
      now
    }),
    (err) => err.code === "network_share.forbidden"
  );
});

test("kliendi keeldumine jätab jagamise saatmata", async () => {
  const prisma = createPrisma();
  const share = await draftedShare(prisma);
  await submitToClient({ prisma, shareId: share.id, workerId: "worker_1", now });
  const declined = await clientRespondToShare({
    prisma,
    shareId: share.id,
    clientUserId: "client_1",
    decision: "DECLINED",
    note: "Ei soovi seda osapoolt kaasata.",
    now
  });
  assert.equal(declined.status, NetworkShareStatus.DECLINED);
  await assert.rejects(
    () => sendNetworkShare({ prisma, shareId: share.id, workerId: "worker_1", now }),
    (err) => err.code === "network_share.client_confirmation_required"
  );
});

// --- Kokkuvõte külmub kinnitamisel -------------------------------------------

test("teksti muutmine pärast kinnitust TÜHISTAB kinnituse", async () => {
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  assert.equal(confirmed.status, NetworkShareStatus.CONFIRMED);
  assert.ok(confirmed.clientConfirmedAt);

  const edited = await updateNetworkShareDraft({
    prisma,
    shareId: confirmed.id,
    workerId: "worker_1",
    summaryText: "Hoopis teine tekst, mida klient ei ole näinud.",
    now
  });
  assert.equal(edited.status, NetworkShareStatus.DRAFT);
  assert.equal(edited.clientConfirmedAt, null);

  // Ja seda ei saa nüüd saata enne uut kinnitust.
  await assert.rejects(
    () => sendNetworkShare({ prisma, shareId: confirmed.id, workerId: "worker_1", now }),
    (err) => err.code === "network_share.client_confirmation_required"
  );
});

// --- Saatmine ja ruum --------------------------------------------------------

test("saatmine avab ruumi ja alles siis, mitte mustandi loomisel", async () => {
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  assert.equal(confirmed.roomId ?? null, null);

  const sent = await sendNetworkShare({
    prisma,
    shareId: confirmed.id,
    workerId: "worker_1",
    createRoom: async () => ({ id: "room_1" }),
    now
  });
  assert.equal(sent.status, NetworkShareStatus.SENT);
  assert.equal(sent.roomId, "room_1");
  assert.equal(sent.sentAt, NOW);
});

test("võõras töötaja ei saa jagamist saata ega muuta", async () => {
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  await assert.rejects(
    () => sendNetworkShare({ prisma, shareId: confirmed.id, workerId: "worker_2", now }),
    (err) => err.code === "network_share.forbidden"
  );
});

// --- Tagasivõtmine -----------------------------------------------------------

test("tagasi saab võtta enne avamist", async () => {
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  await sendNetworkShare({ prisma, shareId: confirmed.id, workerId: "worker_1", now });
  const recalled = await recallNetworkShare({ prisma, shareId: confirmed.id, workerId: "worker_1", now });
  assert.equal(recalled.status, NetworkShareStatus.RECALLED);
});

test("pärast avamist tagasi võtta EI SAA — loetut ei saa lugemata teha", async () => {
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  await sendNetworkShare({ prisma, shareId: confirmed.id, workerId: "worker_1", now });
  await markShareOpened({ prisma, shareId: confirmed.id, recipientUserId: "provider_1", now });
  await assert.rejects(
    () => recallNetworkShare({ prisma, shareId: confirmed.id, workerId: "worker_1", now }),
    (err) => err.code === "network_share.not_recallable"
  );
});

test("võõras kasutaja ei saa jagamist avatuks märkida", async () => {
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  await sendNetworkShare({ prisma, shareId: confirmed.id, workerId: "worker_1", now });
  await assert.rejects(
    () => markShareOpened({ prisma, shareId: confirmed.id, recipientUserId: "keegi_muu", now }),
    (err) => err.code === "network_share.forbidden"
  );
});

// --- Saaja näeb AINULT talle jagatut -----------------------------------------

test("saaja projektsioon ei kanna lähteallikat ega osapoolte identiteete", async () => {
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  const sent = await sendNetworkShare({ prisma, shareId: confirmed.id, workerId: "worker_1", now });

  const view = recipientProjection(sent, { viewerUserId: "provider_1" });
  assert.deepEqual(Object.keys(view).sort(), [...RECIPIENT_VISIBLE_FIELDS].sort());

  // Nimeliselt: need EI TOHI kunagi saajani jõuda.
  for (const forbidden of ["sourcePreInquiryId", "workerId", "clientUserId", "clientDecisionNote"]) {
    assert.equal(forbidden in view, false, `${forbidden} lekkis saaja vaatesse`);
  }
  const serialized = JSON.stringify(view);
  assert.doesNotMatch(serialized, /pre_1|worker_1|client_1/);
});

test("saaja ei näe kinnitamata ega tagasivõetud jagamist", async () => {
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  assert.equal(recipientProjection(confirmed, { viewerUserId: "provider_1" }), null);

  await sendNetworkShare({ prisma, shareId: confirmed.id, workerId: "worker_1", now });
  const recalled = await recallNetworkShare({ prisma, shareId: confirmed.id, workerId: "worker_1", now });
  assert.equal(recipientProjection(recalled, { viewerUserId: "provider_1" }), null);
});

test("keegi teine ei näe saaja vaadet", async () => {
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  const sent = await sendNetworkShare({ prisma, shareId: confirmed.id, workerId: "worker_1", now });
  assert.equal(recipientProjection(sent, { viewerUserId: "keegi_muu" }), null);
  // Ka töötaja ise ei kasuta seda vaadet — tal on oma täisvaade.
  assert.equal(recipientProjection(sent, { viewerUserId: "worker_1" }), null);
});

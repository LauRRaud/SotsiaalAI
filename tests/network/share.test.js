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
    preInquiry: createModel([
      // Autoriga pöördumine -> klient on kasutaja ja tuletatakse siit.
      { id: "pre_1", authorId: "client_1" },
      // Autorita pöördumine -> väline klient, kuvanimi tuleb töötajalt.
      { id: "pre_ext", authorId: null }
    ]),
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

// --- Ruumi avamine (COLLAB-P4 V2) -------------------------------------------

test("ruum avaneb kolme liikmega: klient, töötaja omanikuna ja saaja", async () => {
  const { createRoomForNetworkShare } = await import("../../lib/network/shareRoom.js");
  const created = [];
  const db = {
    room: {
      async findFirst() { return null; },
      async create({ data }) { created.push(data); return { id: "room_9", title: data.title }; }
    }
  };
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  const room = await createRoomForNetworkShare({ share: confirmed, db });

  assert.equal(room.id, "room_9");
  assert.equal(created[0].ownerId, "worker_1");
  // Klient on ruumis: ruum sündis tema loost ja tema kinnitatud kokkuvõttest.
  assert.deepEqual(
    created[0].members.create.map((member) => [member.userId, member.role]).sort(),
    [["client_1", "MEMBER"], ["provider_1", "MEMBER"], ["worker_1", "OWNER"]]
  );
  assert.equal(created[0].originType, "NETWORK_SHARE");
  assert.equal(created[0].originId, confirmed.id);
});

test("ruumi kirjeldusse ega pealkirja EI panda jagatud kokkuvõtte teksti", async () => {
  const { createRoomForNetworkShare } = await import("../../lib/network/shareRoom.js");
  const created = [];
  const db = {
    room: {
      async findFirst() { return null; },
      async create({ data }) { created.push(data); return { id: "room_9", title: data.title }; }
    }
  };
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  await createRoomForNetworkShare({ share: confirmed, db });

  const metaBlob = JSON.stringify({
    title: created[0].title,
    description: created[0].description,
    originMeta: created[0].originMeta
  });
  assert.doesNotMatch(metaBlob, /eluasemevõlg/i);
});

test("olemasoleva ruumiga jagamine ei loo teist ruumi", async () => {
  const { createRoomForNetworkShare } = await import("../../lib/network/shareRoom.js");
  let creates = 0;
  const db = {
    room: {
      async findFirst() { return { id: "room_existing", title: "olemas" }; },
      async create() { creates += 1; return { id: "room_new" }; }
    }
  };
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  const room = await createRoomForNetworkShare({ share: { ...confirmed, roomId: "room_existing" }, db });
  assert.equal(room.id, "room_existing");
  assert.equal(creates, 0);
});

test("klient EI SAA ruumist välja jääda — tema loo ümber käiv arutelu ei ole tema eest varjatud", async () => {
  const { createRoomForNetworkShare } = await import("../../lib/network/shareRoom.js");
  const created = [];
  const db = {
    room: {
      async findFirst() { return null; },
      async create({ data }) { created.push(data); return { id: "room_9", title: data.title }; }
    }
  };
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  await createRoomForNetworkShare({ share: confirmed, db });
  const memberIds = created[0].members.create.map((member) => member.userId);
  assert.ok(memberIds.includes(confirmed.clientUserId));
});

test("kontota kliendi puhul avaneb ruum kahe liikmega, mitte ei kuku", async () => {
  const { createRoomForNetworkShare } = await import("../../lib/network/shareRoom.js");
  const created = [];
  const db = {
    room: {
      async findFirst() { return null; },
      async create({ data }) { created.push(data); return { id: "room_ext", title: data.title }; }
    }
  };
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  const room = await createRoomForNetworkShare({
    share: { ...confirmed, clientUserId: null, clientDisplayName: "Mari M." },
    db
  });
  assert.equal(room.id, "room_ext");
  assert.deepEqual(
    created[0].members.create.map((member) => member.userId).sort(),
    ["provider_1", "worker_1"]
  );
});

// --- Väline klient: kaks rada, kumbki ei teeskle teist ----------------------

const frameworkOk = async () => true;

test("klient EI PEA olema kasutaja — kuvanimega väline klient sobib", async () => {
  const prisma = createPrisma();
  const share = await createNetworkShare(baseInput(prisma, {
    sourcePreInquiryId: "pre_ext",
    clientUserId: null,
    clientDisplayName: "Mari M.",
    clientExternalRef: "juhtum 2026/144",
    hasFrameworkAcceptance: frameworkOk
  }));
  assert.equal(share.clientUserId, null);
  assert.equal(share.clientDisplayName, "Mari M.");
});

test("kliendita ja kuvanimeta jagamist siiski ei saa luua", async () => {
  const prisma = createPrisma();
  await assert.rejects(
    () => createNetworkShare(baseInput(prisma, {
      sourcePreInquiryId: "pre_ext",
      clientUserId: null,
      clientDisplayName: "",
      hasFrameworkAcceptance: frameworkOk
    })),
    (err) => err.code === "network_share.client_required"
  );
});

test("O-CO-6 VÄRAV: väline klient nõuab raamlepingut töötajal JA saajal", async () => {
  const prisma = createPrisma();
  await assert.rejects(
    () => createNetworkShare(baseInput(prisma, {
      sourcePreInquiryId: "pre_ext",
      clientUserId: null,
      clientDisplayName: "Mari M.",
      hasFrameworkAcceptance: async (userId) => userId !== "worker_1"
    })),
    (err) => err.code === "network_share.worker_framework_agreement_required"
  );
  await assert.rejects(
    () => createNetworkShare(baseInput(prisma, {
      sourcePreInquiryId: "pre_ext",
      clientUserId: null,
      clientDisplayName: "Mari M.",
      hasFrameworkAcceptance: async (userId) => userId !== "provider_1"
    })),
    (err) => err.code === "network_share.recipient_framework_agreement_required"
  );
});

test("O-CO-6 VÄRAV: ilma kontrollivõimaluseta välist rada ei avata", async () => {
  const prisma = createPrisma();
  await assert.rejects(
    () => createNetworkShare(baseInput(prisma, {
      sourcePreInquiryId: "pre_ext",
      clientUserId: null,
      clientDisplayName: "Mari M.",
      hasFrameworkAcceptance: null
    })),
    (err) => err.code === "network_share.framework_check_unavailable"
  );
});

test("kontoga kliendi rada EI nõua raamlepingu kontrolli", async () => {
  const prisma = createPrisma();
  const share = await draftedShare(prisma);
  assert.equal(share.clientUserId, "client_1");
});

test("töötaja saab välise kliendi otsuse üle kanda, aga see jääb ERISTATAVAKS", async () => {
  const { attestClientDecision, isClientOwnConfirmation, ClientConfirmationMethod } =
    await import("../../lib/network/share.js");
  const prisma = createPrisma();
  const share = await createNetworkShare(baseInput(prisma, {
    sourcePreInquiryId: "pre_ext",
    clientUserId: null,
    clientDisplayName: "Mari M.",
    hasFrameworkAcceptance: frameworkOk
  }));
  await submitToClient({ prisma, shareId: share.id, workerId: "worker_1", now });

  const attested = await attestClientDecision({
    prisma,
    shareId: share.id,
    workerId: "worker_1",
    decision: "CONFIRMED",
    method: "IN_PERSON",
    note: "Kinnitas kodukülastusel.",
    now
  });

  assert.equal(attested.status, NetworkShareStatus.CONFIRMED);
  assert.equal(attested.clientConfirmationMethod, ClientConfirmationMethod.IN_PERSON);
  assert.equal(attested.clientConfirmationAttestedById, "worker_1");
  // Kõige olulisem rida: ülekantud kinnitus EI OLE kliendi enda toiming.
  assert.equal(isClientOwnConfirmation(attested), false);
});

test("kliendi enda kinnitus märgitakse IN_APP-ina ja on eristatavalt tema oma", async () => {
  const { isClientOwnConfirmation, ClientConfirmationMethod } =
    await import("../../lib/network/share.js");
  const prisma = createPrisma();
  const confirmed = await confirmedShare(prisma);
  assert.equal(confirmed.clientConfirmationMethod, ClientConfirmationMethod.IN_APP);
  assert.equal(confirmed.clientConfirmationAttestedById, null);
  assert.equal(isClientOwnConfirmation(confirmed), true);
});

test("KONTOGA kliendi eest ei saa töötaja üle kanda", async () => {
  const { attestClientDecision } = await import("../../lib/network/share.js");
  const prisma = createPrisma();
  const share = await draftedShare(prisma);
  await submitToClient({ prisma, shareId: share.id, workerId: "worker_1", now });
  await assert.rejects(
    () => attestClientDecision({
      prisma,
      shareId: share.id,
      workerId: "worker_1",
      decision: "CONFIRMED",
      method: "IN_PERSON",
      now
    }),
    (err) => err.code === "network_share.client_must_confirm_themselves"
  );
});

test("ülekandmine nõuab päris meetodit — IN_APP-i ei saa võltsida", async () => {
  const { attestClientDecision } = await import("../../lib/network/share.js");
  const prisma = createPrisma();
  const share = await createNetworkShare(baseInput(prisma, {
    sourcePreInquiryId: "pre_ext",
    clientUserId: null,
    clientDisplayName: "Mari M.",
    hasFrameworkAcceptance: frameworkOk
  }));
  await submitToClient({ prisma, shareId: share.id, workerId: "worker_1", now });
  await assert.rejects(
    () => attestClientDecision({
      prisma,
      shareId: share.id,
      workerId: "worker_1",
      decision: "CONFIRMED",
      method: "IN_APP",
      now
    }),
    (err) => err.code === "network_share.attested_method_required"
  );
});

test("välist klienti ei saa kontorajal kinnitada", async () => {
  const prisma = createPrisma();
  const share = await createNetworkShare(baseInput(prisma, {
    sourcePreInquiryId: "pre_ext",
    clientUserId: null,
    clientDisplayName: "Mari M.",
    hasFrameworkAcceptance: frameworkOk
  }));
  await submitToClient({ prisma, shareId: share.id, workerId: "worker_1", now });
  await assert.rejects(
    () => clientRespondToShare({
      prisma,
      shareId: share.id,
      clientUserId: "client_1",
      decision: "CONFIRMED",
      now
    }),
    (err) => err.code === "network_share.client_is_external"
  );
});

// --- Klient tuletatakse lähteallikast, mitte liidesest ----------------------

test("klient TULETATAKSE eelpöördumise autorist — liides ei pea teda nimetama", async () => {
  const prisma = createPrisma();
  // Ei anna clientUserId'd üldse; pre_1 autor on client_1.
  const share = await createNetworkShare(baseInput(prisma, { clientUserId: null }));
  assert.equal(share.clientUserId, "client_1");
});

test("autorita eelpöördumine annab välise kliendi raja", async () => {
  const prisma = createPrisma();
  prisma.preInquiry.rows.push({ id: "pre_anon", authorId: null });
  const share = await createNetworkShare(baseInput(prisma, {
    sourcePreInquiryId: "pre_anon",
    sourcePreInquiryId: "pre_ext",
    clientUserId: null,
    clientDisplayName: "Mari M.",
    hasFrameworkAcceptance: async () => true
  }));
  assert.equal(share.clientUserId, null);
  assert.equal(share.clientDisplayName, "Mari M.");
});

test("autorita eelpöördumine ilma kuvanimeta keeldub", async () => {
  const prisma = createPrisma();
  prisma.preInquiry.rows.push({ id: "pre_anon2", authorId: null });
  await assert.rejects(
    () => createNetworkShare(baseInput(prisma, {
      sourcePreInquiryId: "pre_anon2",
      sourcePreInquiryId: "pre_ext",
      clientUserId: null,
      clientDisplayName: "",
      hasFrameworkAcceptance: async () => true
    })),
    (err) => err.code === "network_share.client_required"
  );
});

test("autoriga eelpöördumise puhul EI nõuta raamlepingut — klient on kasutaja", async () => {
  const prisma = createPrisma();
  let asked = false;
  await createNetworkShare(baseInput(prisma, {
    clientUserId: null,
    hasFrameworkAcceptance: async () => { asked = true; return true; }
  }));
  assert.equal(asked, false);
});

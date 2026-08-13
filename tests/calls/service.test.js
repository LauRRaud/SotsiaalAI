import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { AccessToken, TrackSource } from "livekit-server-sdk";

import {
  buildLiveKitGrant,
  buildRecordingConsentText,
  cancelSpeakRequest,
  createCallService,
  createRecordingRequest,
  createSpeakRequest,
  normalizeConsentLocale,
  serializeCallSession
} from "../../lib/calls/service.js";
import { buildRecordingFileName } from "../../lib/calls/recordingStorage.js";
import et from "../../messages/et.json" with { type: "json" };
import en from "../../messages/en.json" with { type: "json" };
import ru from "../../messages/ru.json" with { type: "json" };

/**
 * SOL-CALL-02 — `where` võrreldakse nüüd ÜLDISELT, mitte kõvakodeeritud võtmeloendi
 * järgi. Vana matcher tundis kuut võtit ja LASKIS KÕIK ÜLEJÄÄNUD VAIKIDES LÄBI. Uued
 * tingimuslikud üleminekud (`where: { startClaimId }`, `where: { action, externalRef }`)
 * oleksid seetõttu testis kaitsnud mitte millegi eest ja roheline sviit oleks
 * tõendanud lukku, mida ei ole. Fake peab mõõtma koodi, mitte oma puudust.
 */
function matchRows(rows, where = {}) {
  return rows.filter(row => {
    if (where?.status != null && typeof where.status !== "object" && row.status !== where.status) return false;
    if (where?.status?.in && !where.status.in.includes(row.status)) return false;
    for (const [key, value] of Object.entries(where || {})) {
      if (key === "status") continue;
      if (value === null) {
        if (row[key] != null) return false;
        continue;
      }
      /* SOL-CALL-10: võrdlusoperaatorid on nüüd MODELLEERITUD. Varem lasti nad
         `continue`-ga läbi, st `startedAt: { lte: cutoff }` ei filtreerinud MITTE
         MIDAGI — kestuselae test oleks olnud roheline ka siis, kui kood valib kõik
         käimasolevad salvestused, ka äsja alustatud. Fake, mis tingimuse ära neelab,
         tõendab oma puudust, mitte koodi. */
      if (value && typeof value === "object" && !(value instanceof Date)) {
        const actual = row[key];
        const time = candidate => (candidate instanceof Date ? candidate.getTime() : candidate);
        if ("lte" in value && !(time(actual) <= time(value.lte))) return false;
        if ("lt" in value && !(time(actual) < time(value.lt))) return false;
        if ("gte" in value && !(time(actual) >= time(value.gte))) return false;
        if ("gt" in value && !(time(actual) > time(value.gt))) return false;
        if ("in" in value && !value.in.includes(actual)) return false;
        if ("not" in value && actual === value.not) return false;
        continue;
      }
      if (row[key] !== value) return false;
    }
    return true;
  });
}

/**
 * Prisma `{ increment: n }` on aatomiline lisamine, mitte väärtus. `Object.assign`
 * kirjutas ta objektina reale ja `rosterVersion` muutus objektiks — fencing oleks
 * vaikides surnud.
 */
function applyData(row, data = {}) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !(value instanceof Date) && "increment" in value) {
      row[key] = Number(row[key] || 0) + Number(value.increment || 0);
      continue;
    }
    row[key] = value;
  }
  row.updatedAt = new Date();
  return row;
}

function createModel(initial = []) {
  const rows = [...initial];
  return {
    rows,
    async findFirst({ where, orderBy } = {}) {
      const filtered = matchRows(rows, where);
      if (orderBy?.requestedAt === "asc") {
        filtered.sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
      }
      return filtered[0] || null;
    },
    async findMany({ where, orderBy } = {}) {
      let filtered = matchRows(rows, where);
      if (orderBy?.requestedAt === "asc") {
        filtered = [...filtered].sort((a, b) => new Date(a.requestedAt) - new Date(b.requestedAt));
      }
      return filtered;
    },
    async count({ where } = {}) {
      return (await this.findMany({ where })).length;
    },
    async create({ data }) {
      const row = {
        id: data.id || `row_${rows.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data
      };
      rows.push(row);
      return row;
    },
    /**
     * SOL-CALL-05 — fake peab modelleerima LIITUNIKAALSUST, muidu mõõdab test fake'i
     * lubadust, mitte koodi. `where` on Prisma liitvõtme kuju
     * (`{ recordingRequestId_userId: { … } }`); rea leidmine ja loomine käivad ühes
     * sünkroonses lõigus, nii et kaks paralleelset kutset ei saa mõlemad luua.
     */
    upsert({ where, create, update }) {
      const compound = Object.values(where || {}).find(value => value && typeof value === "object") || where;
      const existing = matchRows(rows, compound)[0] || null;
      if (existing) {
        if (update && Object.keys(update).length) applyData(existing, update);
        return Promise.resolve(existing);
      }
      const row = {
        id: create?.id || `row_${rows.length + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...create
      };
      rows.push(row);
      return Promise.resolve(row);
    },
    async update({ where, data }) {
      const row = rows.find(candidate => candidate.id === where.id);
      if (!row) throw new Error("not_found");
      applyData(row, data);
      return row;
    },
    updateMany({ where, data }) {
      // Üks UPDATE ... WHERE on andmebaasis atomaarne: sobivate ridade leidmine ja
      // muutmine ei ole eraldi samme, mille vahele teine kutse mahub. Varem tegi
      // see fake `await this.findMany(...)` ENNE mutatsiooni, nii et kaks
      // paralleelset kutset said mõlemad sama rea kätte ja tingimuslik üleminek
      // (`where: { status: "ACTIVE" }`) ei kaitsnud millegi eest. Match + mutatsioon
      // käivad nüüd ühes sünkroonses lõigus, nii et testid mõõdavad koodi, mitte
      // fake'i puudust. Tagastab Promise'i, sest kutsujad await'ivad.
      const matches = matchRows(rows, where);
      matches.forEach(row => applyData(row, data));
      return Promise.resolve({ count: matches.length });
    },
    async deleteMany({ where } = {}) {
      const matches = await this.findMany({ where });
      let count = 0;
      for (const match of matches) {
        const index = rows.findIndex(row => row.id === match.id);
        if (index >= 0) {
          rows.splice(index, 1);
          count += 1;
        }
      }
      return { count };
    },
    /* SOL-CALL-10: kvoodilugeja kasutab `aggregate`-i. Ilma temata oleks
       `readRecordingStorageBudget` fake'i peal alati `null` tagastanud ja
       kvoodikontroll oleks testides VAIKSELT vahele jäänud — täpselt see
       „fake ei valideeri" klass, mis 09.08 SOL-SCHEMA-01-t tabas. */
    async aggregate({ where, _sum } = {}) {
      const field = Object.keys(_sum || {})[0];
      const matches = matchRows(rows, where);
      const total = field ? matches.reduce((sum, row) => sum + Number(row?.[field] || 0), 0) : 0;
      return { _sum: field ? { [field]: total } : {} };
    }
  };
}

function createPrisma() {
  const db = {
    callSession: createModel(),
    callParticipant: createModel(),
    callSpeakRequest: createModel(),
    callRecordingRequest: createModel(),
    callRecordingConsent: createModel(),
    callRecordingFile: createModel(),
    // SOL-CALL-01: püsiva taasproovi järjekord. Ilma selleta ei saaks test tõendada,
    // et kinnitamata stop üldse kuhugi kirja läheb — `enqueueEgressStopJob` on
    // valikuline (`prisma.dataDeletionJob?.create`) ja vaikiks fake'i puudumise maha.
    dataDeletionJob: createModel(),
    dataAuditLog: createModel(),
    userDocument: createModel(),
    // SOL-CALL-10: kvoodilugeja potid + rolli lugemine. SOL-DOC-08 lisas neljanda poti
    // (salvestatud analüüsid) — puuduv mudel ei anna siin nulli, vaid krahhi, ja krahh
    // maskeeriks kvoodikeeldu millekski muuks.
    materialSubmission: createModel(),
    agentArtifact: createModel(),
    agentArtifactFinalSnapshot: createModel(),
    savedAnalysis: createModel(),
    user: createModel(),
    roomMessage: createModel()
  };
  /**
   * SOL-CALL-08/-09 — TEHING PEAB NÄGEMA SAMU ANDMEID, PÖÖRAMA TAGASI JA LUKUSTAMA.
   *
   * Siin seisis `callback(createPrisma())`, mis andis tehingu sisse VÄRSKE TÜHJA
   * andmebaasi: iga tehingus tehtud lugemine oleks tagastanud `null` ja iga
   * kirjutus oleks kadunud koos ajutise objektiga. Tehingusse kolinud koht oleks
   * testis „töötanud" täpselt vastupidiselt sellele, mida ta päriselt teeb.
   *
   * Kolm asja on nüüd modelleeritud, sest ilma igaüheta jääks üks leid
   * tõendamatuks:
   *   1. sama andmestik — muidu ei mõõda tehingutest MITTE MIDAGI;
   *   2. TAGASIPÖÖRAMINE — SOL-CALL-09 kandev väide on „audititõrge pöörab
   *      seisumuutuse tagasi", ja läbilaskev fake teeks sellest rohelise müra;
   *   3. `pg_advisory_xact_lock` võtmepõhise mutex'ina — SOL-CALL-08 osalejapiir
   *      on lukk, mitte tingimuslik kirjutus, ja no-op lukuga oleks kahe liituja
   *      võidujooks fake'i peal PÄRIS võidujooks (mõlemad mahuksid ära).
   *
   * TAGASIPÖÖRAMINE EI TOHI OLLA JÄME. Kaks korda tegi liiga lai tõmmis testid
   * vaikselt valeks: tehingu alguses võetud tõmmis kustutas paralleeltestis ka
   * VÕITJA rea, ja kogu tabeli ennistus kustutas võõra tehingu commit'itud rea
   * (P2002 võidujooksu test). Ennistus puudutab seetõttu ainult neid ridu, mis
   * olid tõmmise hetkel olemas, ja kustutab ainult need, mille SEE tehing lõi —
   * võõras rida jääb puutumata, täpselt nagu päris isolatsioonis.
   *
   * AUS PIIR: see on ikkagi mudel. Päris isolatsiooni ja päris tagasipööramist
   * tõendab sond PostgreSQL-i vastu.
   */
  const WRITE_METHODS = ["create", "update", "updateMany", "deleteMany", "upsert"];
  const lockTails = new Map();
  const acquireLock = async key => {
    const previous = lockTails.get(key) || Promise.resolve();
    let release;
    const mine = new Promise(resolve => { release = resolve; });
    lockTails.set(key, previous.then(() => mine));
    await previous;
    return release;
  };
  db.$transaction = async callback => {
    const models = Object.values(db).filter(value => value && Array.isArray(value.rows));
    const releases = [];
    const mine = new Set();
    let snapshot = null;
    const takeSnapshot = () => {
      if (!snapshot) {
        snapshot = models.map(model => [
          model,
          model.rows.map(row => ({ ...row })),
          new Set(model.rows.map(row => row.id))
        ]);
      }
    };
    const tx = Object.create(db);
    tx.$executeRaw = async (_strings, ...values) => {
      releases.push(await acquireLock(values.map(String).join("|")));
      return 1;
    };
    for (const [name, model] of Object.entries(db)) {
      if (!model || !Array.isArray(model.rows)) continue;
      const wrapped = Object.create(model);
      for (const method of WRITE_METHODS) {
        if (typeof model[method] !== "function") continue;
        wrapped[method] = async (...args) => {
          takeSnapshot();
          const result = await model[method](...args);
          if (result?.id) mine.add(result.id);
          return result;
        };
      }
      tx[name] = wrapped;
    }
    try {
      return await callback(tx);
    } catch (error) {
      for (const [model, rows, known] of snapshot || []) {
        const foreign = model.rows.filter(row => !known.has(row.id) && !mine.has(row.id));
        model.rows.length = 0;
        model.rows.push(...rows, ...foreign);
      }
      throw error;
    } finally {
      // Nõuandelukk on tehingupõhine: ta vabaneb tehingu lõpus, ka tõrke korral.
      for (const release of releases) release();
    }
  };
  return db;
}

test("Covision call payload exposes only opaque participant identifiers", () => {
  const call = serializeCallSession(
    {
      id: "call_covision",
      contextType: "COVISION",
      contextId: "case_1",
      status: "ACTIVE",
      startedByUserId: "user_owner"
    },
    {
      participants: [
        {
          id: "call_participant_owner",
          userId: "user_owner",
          joinedAt: new Date("2026-07-14T10:00:00.000Z"),
          user: { email: "owner@example.test", profile: {} }
        },
        {
          id: "call_participant_guest",
          userId: "user_guest",
          joinedAt: new Date("2026-07-14T10:01:00.000Z"),
          user: { email: "guest@example.test", profile: { firstName: "Mari", lastName: "Mets" } }
        }
      ],
      speakRequests: [
        {
          id: "speak_1",
          userId: "user_guest",
          resolvedByUserId: "user_owner",
          status: "RESOLVED",
          requestedAt: new Date("2026-07-14T10:02:00.000Z"),
          user: { email: "guest@example.test", profile: { firstName: "Mari", lastName: "Mets" } }
        }
      ]
    }
  );

  assert.equal(call.startedByParticipantId, "call_participant_owner");
  assert.equal("startedByUserId" in call, false);
  assert.deepEqual(call.participants.map(participant => participant.id), [
    "call_participant_owner",
    "call_participant_guest"
  ]);
  assert.equal(call.participants.every(participant => !("userId" in participant)), true);
  assert.equal(call.participants[0].displayName, "");
  assert.equal(call.participants[1].displayName, "Mari Mets");
  assert.equal(call.speakRequests[0].participantId, "call_participant_guest");
  assert.equal(call.speakRequests[0].resolvedByParticipantId, "call_participant_owner");
  assert.equal("userId" in call.speakRequests[0], false);
  assert.equal("resolvedByUserId" in call.speakRequests[0], false);
  assert.doesNotMatch(JSON.stringify(call), /owner@example\.test|guest@example\.test|user_owner|user_guest/);
});

test("room call payload retains its user identifier contract", () => {
  const call = serializeCallSession(
    {
      id: "call_room",
      contextType: "ROOM",
      roomId: "room_1",
      status: "ACTIVE",
      startedByUserId: "user_owner"
    },
    {
      participants: [{ id: "participant_1", userId: "user_owner" }],
      speakRequests: [{
        id: "speak_1",
        userId: "user_owner",
        resolvedByUserId: "user_owner",
        status: "RESOLVED"
      }]
    }
  );

  assert.equal(call.startedByUserId, "user_owner");
  assert.equal(call.participants[0].userId, "user_owner");
  assert.equal(call.speakRequests[0].userId, "user_owner");
  assert.equal(call.speakRequests[0].resolvedByUserId, "user_owner");
});

test("starting a room call reuses the existing active session", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-05-24T09:00:00Z") });

  const first = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });
  const second = await service.startRoomCall({ roomId: "room_1", userId: "user_2" });

  assert.equal(first.id, second.id);
  assert.equal(prisma.callSession.rows.length, 1);
  assert.equal(first.provider, "MOCK");
  assert.equal(first.mode, "AUDIO");
});

test("joining respects max active participants", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, maxParticipants: 1 });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });

  await assert.rejects(
    () => service.joinCall({ callSessionId: call.id, userId: "user_2" }),
    /call.participants_full/
  );
});

/* SOL-CALL-08 — OSALEJAPIIR JA KÕNE ALGSEIS.
   Piir oli „loe arv → otsusta → kirjuta" ja kõne sündis kolmes eraldi sammus.
   Need testid mõõdavad mõlemat poolt: viimase koha võistlust ja seda, et poolik
   kõne ei jää alles. Lukk on fake'is modelleeritud võtmepõhise mutex'ina (vt
   `createPrisma`), päris `pg_advisory_xact_lock` tõendab sond. */

test("SOL-CALL-08: kõne sünnib tervikuna — providerinimi ja HOST tulevad koos", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });

  const call = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });

  assert.ok(call.providerRoomName.includes(call.id), "providerinimi peab kandma kõne id-d");
  assert.equal(prisma.callSession.rows[0].providerRoomName, call.providerRoomName);
  const host = prisma.callParticipant.rows.find(row => row.callSessionId === call.id);
  assert.equal(host?.role, "HOST");
  assert.equal(host?.userId, "user_1");
});

test("SOL-CALL-08: HOST-osaluse tõrge ei jäta maha hostita ACTIVE kõnet", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  prisma.callParticipant.create = async () => {
    throw new Error("db down");
  };

  await assert.rejects(() => service.startRoomCall({ roomId: "room_1", userId: "user_1" }), /db down/);

  // Vana kood jättis siia ACTIVE kõne, mille järgmine start tagastas muutmata —
  // katkine seis oli püsiv ja iseparanevat teed ei olnud.
  assert.equal(prisma.callSession.rows.length, 0);
  assert.equal(prisma.callParticipant.rows.length, 0);
});

test("SOL-CALL-08: kaks eri kasutajat viimasele kohale — täpselt üks mahub", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, maxParticipants: 2 });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });

  const results = await Promise.allSettled([
    service.joinCall({ callSessionId: call.id, userId: "user_a" }),
    service.joinCall({ callSessionId: call.id, userId: "user_b" })
  ]);

  const accepted = results.filter(entry => entry.status === "fulfilled");
  const rejected = results.filter(entry => entry.status === "rejected");
  assert.equal(accepted.length, 1, "täpselt üks liituja mahub");
  assert.match(String(rejected[0].reason?.message), /call.participants_full/);
  const active = prisma.callParticipant.rows.filter(row => row.leftAt == null);
  assert.equal(active.length, 2, `aktiivseid osalejaid ${active.length}, piir on 2`);
});

test("SOL-CALL-08: juba liitunu kordusliitumine ei võta teist kohta", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, maxParticipants: 2 });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_a" });

  await service.joinCall({ callSessionId: call.id, userId: "user_a" });

  const active = prisma.callParticipant.rows.filter(row => row.leftAt == null);
  assert.equal(active.length, 2);
});

test("SOL-CALL-08: vana tühja providerinimega kõne parandatakse esimesel puutumisel", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  // Vana kolmesammulise loomise jäänuk: ACTIVE kõne, mille nimekirjutus kukkus.
  const legacy = await prisma.callSession.create({
    data: {
      id: "call_legacy",
      contextType: "ROOM",
      contextId: "room_1",
      roomId: "room_1",
      provider: "MOCK",
      providerRoomName: "",
      mode: "AUDIO",
      status: "ACTIVE",
      startedByUserId: "host",
      startedAt: new Date("2026-08-01T09:00:00Z"),
      maxParticipants: 8
    }
  });

  const started = await service.startRoomCall({ roomId: "room_1", userId: "host" });

  assert.equal(started.id, legacy.id);
  assert.ok(started.providerRoomName.includes(legacy.id));
  assert.equal(prisma.callSession.rows[0].providerRoomName, started.providerRoomName);
});

test("leaving as the last active participant ends the call and writes a system message", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-05-24T10:15:00Z") });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });

  const result = await service.leaveCall({ callSessionId: call.id, userId: "user_1" });

  assert.equal(result.status, "ENDED");
  assert.equal(prisma.callSession.rows[0].status, "ENDED");
  assert.match(prisma.roomMessage.rows[0].content, /Helikõne toimus/);
});

test("speak requests are active once per user, ordered by requested time, and cancellable", async () => {
  const prisma = createPrisma();
  const call = await prisma.callSession.create({
    data: {
      id: "call_1",
      roomId: "room_1",
      status: "ACTIVE",
      maxParticipants: 8,
      startedByUserId: "host"
    }
  });

  await createSpeakRequest({ prisma, callSessionId: call.id, userId: "user_2", now: () => new Date("2026-05-24T09:00:02Z") });
  await createSpeakRequest({ prisma, callSessionId: call.id, userId: "user_1", now: () => new Date("2026-05-24T09:00:01Z") });
  const duplicate = await createSpeakRequest({ prisma, callSessionId: call.id, userId: "user_1", now: () => new Date("2026-05-24T09:00:03Z") });

  assert.equal(duplicate.userId, "user_1");
  const active = await prisma.callSpeakRequest.findMany({ where: { callSessionId: call.id, status: "ACTIVE" }, orderBy: { requestedAt: "asc" } });
  assert.deepEqual(active.map(request => request.userId), ["user_1", "user_2"]);

  await cancelSpeakRequest({ prisma, callSessionId: call.id, userId: "user_1", now: () => new Date("2026-05-24T09:00:04Z") });
  const remaining = await prisma.callSpeakRequest.findMany({ where: { callSessionId: call.id, status: "ACTIVE" }, orderBy: { requestedAt: "asc" } });
  assert.deepEqual(remaining.map(request => request.userId), ["user_2"]);
});

test("LiveKit grants are audio-only and scoped to a concrete room", () => {
  const grant = buildLiveKitGrant({ providerRoomName: "sotsiaalai-room-room_1-call-call_1" });

  assert.deepEqual(grant, {
    room: "sotsiaalai-room-room_1-call-call_1",
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canPublishSources: [TrackSource.MICROPHONE]
  });
});

test("LiveKit grants can be serialized by the SDK", async () => {
  const token = new AccessToken("test-key", "test-secret", {
    identity: "user_1",
    ttl: "10m"
  });

  token.addGrant(buildLiveKitGrant({ providerRoomName: "sotsiaalai-room-room_1-call-call_1" }));

  const jwt = await token.toJwt();
  assert.equal(typeof jwt, "string");
  assert.ok(jwt.length > 0);
});

test("a call does not create recording requests or files by default", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });

  await service.startRoomCall({ roomId: "room_1", userId: "host" });

  assert.equal(prisma.callRecordingRequest.rows.length, 0);
  assert.equal(prisma.callRecordingConsent.rows.length, 0);
  assert.equal(prisma.callRecordingFile.rows.length, 0);
});

test("moderator can request recording consent and every active participant gets a consent row", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-05-24T12:00:00Z") });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  const request = await createRecordingRequest({
    prisma,
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "CASE_SUMMARY",
    purposeText: "Juhtumikokkuvotte mustand",
    requesterName: "Test Admin",
    now: () => new Date("2026-05-24T12:01:00Z")
  });

  assert.equal(request.status, "REQUESTED");
  assert.equal(prisma.callRecordingConsent.rows.length, 2);
  assert.deepEqual(prisma.callRecordingConsent.rows.map(consent => consent.userId).sort(), ["host", "user_2"]);
  assert.match(request.consentTextSnapshot, /Test Admin soovib selle helikõne salvestada/);
  // SOL-CALL-07: uus lubadus = uus versioon. Vana all antud nõusolekud jäävad v1-ks.
  assert.equal(request.consentTextVersion, "call-recording-consent-v2");
  assert.equal(prisma.callRecordingFile.rows.length, 1);
  assert.equal(prisma.callRecordingFile.rows[0].status, "NOT_CREATED");
});

test("non-moderator cannot request recording consent", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  await assert.rejects(
    () => createRecordingRequest({
      prisma,
      callSessionId: call.id,
      userId: "user_2",
      canModerate: false,
      purpose: "GENERAL_SUMMARY",
      requesterName: "Osaleja"
    }),
    /call.recording_forbidden/
  );
});

test("all participants consenting moves recording request to READY_TO_RECORD without transcription or audio file", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  const request = await createRecordingRequest({
    prisma,
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "GENERAL_SUMMARY",
    requesterName: "Test Admin"
  });

  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  const updated = await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });

  assert.equal(updated.status, "READY_TO_RECORD");
  assert.equal(prisma.callRecordingFile.rows.length, 1);
  assert.equal(prisma.callRecordingFile.rows[0].status, "NOT_CREATED");
  assert.equal(prisma.callRecordingFile.rows[0].filePath, undefined);
});

test("one participant declining prevents recording from starting", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  const request = await createRecordingRequest({
    prisma,
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "OTHER",
    purposeText: "Muu eesmark",
    requesterName: "Test Admin"
  });

  const updated = await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "DECLINED" });

  assert.equal(updated.status, "DECLINED");
  assert.equal(prisma.callRecordingConsent.rows.find(consent => consent.userId === "user_2").status, "DECLINED");
});

test("recording cannot start before READY_TO_RECORD or when consent is missing", async () => {
  const prisma = createPrisma();
  const egress = { startAudioRecording: async () => ({ egressId: "egress_1" }) };
  const service = createCallService({ prisma, egress });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({
    prisma,
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "GENERAL_SUMMARY",
    requesterName: "Host"
  });

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call.recording_not_ready/
  );

  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call.recording_not_ready/
  );
});

test("declined recording request cannot start", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, egress: { startAudioRecording: async () => ({ egressId: "egress_1" }) } });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({
    prisma,
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "GENERAL_SUMMARY",
    requesterName: "Host"
  });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "DECLINED" });

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call.recording_not_ready/
  );
});

test("READY_TO_RECORD starts audio-only Egress and marks file processing", async () => {
  const prisma = createPrisma();
  const egressCalls = [];
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async payload => {
        egressCalls.push(payload);
        return { egressId: "egress_audio_1" };
      }
    },
    recordingStorage: {
      ensureReady: async () => {}
    }
  });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });

  const started = await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  assert.equal(started.status, "ACTIVE");
  assert.equal(prisma.callRecordingFile.rows[0].status, "PROCESSING");
  assert.equal(prisma.callRecordingFile.rows[0].egressId, "egress_audio_1");
  assert.equal(egressCalls[0].audioOnly, true);
  assert.equal(egressCalls[0].videoOnly, false);
  assert.match(egressCalls[0].fileName, /^call-recording-/);
});

test("stopping an active recording finalizes file and creates a call audio document without transcription", async () => {
  const prisma = createPrisma();
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => ({ egressId: "egress_audio_1" }),
      stopRecording: async () => ({ ok: true })
    },
    recordingStorage: {
      finalizeRecordingFile: async ({ fileName }) => ({
        storagePath: `uploads/${fileName}`,
        mimeType: "audio/webm",
        fileSizeBytes: 1234,
        durationSeconds: 42,
        checksum: "sha256-test"
      })
    }
  });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  const stopped = await service.stopRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  assert.equal(stopped.status, "COMPLETED");
  assert.equal(prisma.callRecordingFile.rows[0].status, "AVAILABLE");
  assert.equal(prisma.callRecordingFile.rows[0].createdDocumentId, prisma.userDocument.rows[0].id);
  assert.equal(prisma.userDocument.rows[0].kind, "CALL_AUDIO_RECORDING");
  assert.equal(prisma.userDocument.rows[0].ownerId, "host");
  assert.equal(prisma.userDocument.rows[0].mime, "audio/webm");
  assert.equal(prisma.dataAuditLog.rows.some(row => row.action === "CALL_RECORDING_STARTED"), true);
  assert.equal(prisma.dataAuditLog.rows.some(row => row.action === "CALL_RECORDING_STOPPED"), true);
  assert.equal(prisma.dataAuditLog.rows.some(row => row.action === "CALL_TRANSCRIPTION_STARTED"), false);
});

/**
 * SOL-CALL-01 — kinnitamata stop ei tohi kanda terminaalset seisu.
 *
 * MIDA SEE TEST VAREM KINNITAS. Sama nime all elas siin test, mis nõudis, et
 * provider-stopi erind märgib taotluse ja faili `FAILED`-iks. `FAILED` on väide
 * LÕPPENUD töö kohta („salvestis ei saanud valmis"), mille järel start/stop route ei
 * leia enam ACTIVE salvestust ja peatamise nuppu ei ole. Kui egress tegelikult
 * kirjutas edasi, oli see väide vale JA ainus tee tagasi kadus koos sellega. Test oli
 * roheline, sest ta mõõtis koodi kavatsust, mitte maailma seisu.
 *
 * Terminaalsete seiside loend on siin invariandina välja kirjutatud, et uue seisu
 * lisaja peaks teadlikult otsustama, kummale poole ta kuulub.
 */
const TERMINAL_RECORDING_STATUSES = ["STOPPED", "COMPLETED", "FAILED", "DELETED"];

function unconfirmedStopService(prisma, { statusProbe = null } = {}) {
  return createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => ({ egressId: "egress_failed_1" }),
      stopRecording: async () => {
        throw new Error("egress with status EGRESS_FAILED cannot be stopped");
      },
      ...(statusProbe ? { getEgressStatus: statusProbe } : {})
    },
    recordingStorage: {
      finalizeRecordingFile: async () => {
        throw new Error("should not finalize after an unconfirmed stop");
      },
      discardEgressArtifact: async () => {
        throw new Error("should not discard the artifact before the stop is confirmed");
      }
    }
  });
}

async function startedRecording(prisma, service) {
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  return { call, request };
}

test("SOL-CALL-01: kinnitamata egress-stop jätab STOP_FAILED, karantiini ja taasproovi, mitte terminaalse seisu", async () => {
  const prisma = createPrisma();
  const service = unconfirmedStopService(prisma);
  const { call, request } = await startedRecording(prisma, service);

  await assert.rejects(
    () => service.stopRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call\.recording_stop_unconfirmed/
  );

  const stored = prisma.callRecordingRequest.rows[0];
  assert.equal(stored.status, "STOP_FAILED");
  assert.equal(
    TERMINAL_RECORDING_STATUSES.includes(stored.status),
    false,
    "kinnitamata stop ei tohi kanda terminaalset seisu"
  );
  assert.equal(prisma.callRecordingFile.rows[0].status, "QUARANTINED");
  assert.equal(
    prisma.callRecordingFile.rows[0].providerStopConfirmedAt ?? null,
    null,
    "kinnitusaeg tohib tekkida ainult providerikinnituse peale"
  );

  const job = prisma.dataDeletionJob.rows.find(row => row.action === "CALL_EGRESS_STOP");
  assert.ok(job, "kinnitamata stop peab jõudma püsivasse taasproovi järjekorda");
  assert.equal(job.externalRef, "egress_failed_1");
  assert.equal(job.status, "pending");
  assert.equal(
    prisma.dataAuditLog.rows.some(row => row.action === "CALL_RECORDING_STOP_UNCONFIRMED"),
    true
  );
});

test("SOL-CALL-01: kontrollpäring päästab tõrkunud stopi, kui provider kinnitab lõppemise", async () => {
  const prisma = createPrisma();
  /* Stop viskab erindi, aga kontrollpäring ütleb, et egress on terminaalses seisus.
     See ON tõend ja lõppseisu tohib kirjutada — muidu läheks iga võrgusärin
     asjatult STOP_FAILED-i ja aus seis muutuks müraks, mida keegi ei loe. */
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => ({ egressId: "egress_failed_1" }),
      stopRecording: async () => {
        throw new Error("connection reset");
      },
      getEgressStatus: async () => ({ known: true, stopped: true, status: "EGRESS_COMPLETE" })
    },
    recordingStorage: {
      finalizeRecordingFile: async () => ({
        storagePath: "recordings/final.ogg",
        mimeType: "audio/ogg",
        fileSizeBytes: 10,
        durationSeconds: 1,
        checksum: "abc"
      })
    }
  });
  const { call, request } = await startedRecording(prisma, service);

  const stopped = await service.stopRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  assert.equal(stopped.status, "COMPLETED");
  assert.ok(prisma.callRecordingFile.rows[0].providerStopConfirmedAt, "kinnitus peab olema jäädvustatud");
  assert.equal(
    prisma.dataDeletionJob.rows.some(row => row.action === "CALL_EGRESS_STOP"),
    false,
    "kinnitatud stop ei tohi jätta taasproovi järjekorda prügi"
  );
});

test("SOL-CALL-01: nõusoleku tagasivõtt kinnitamata stopi korral EI raporteeri edu ega kustuta faili", async () => {
  const prisma = createPrisma();
  const service = unconfirmedStopService(prisma);
  const { call, request } = await startedRecording(prisma, service);

  /* See on leiu tuum: inimene võtab nõusoleku tagasi, egress ei kinnita peatumist.
     Vana kood kirjutas siin STOPPED + DELETED ja route vastas ok:true. */
  const outcome = await service.respondToRecordingConsent({
    callSessionId: call.id,
    recordingRequestId: request.id,
    userId: "host",
    decision: "WITHDRAWN"
  });

  assert.equal(outcome.providerStopConfirmed, false);
  assert.equal(outcome.reconcileQueued, true);
  assert.equal(prisma.callRecordingRequest.rows[0].status, "STOP_FAILED");
  assert.equal(prisma.callRecordingFile.rows[0].status, "QUARANTINED");
  assert.notEqual(
    prisma.callRecordingFile.rows[0].status,
    "DELETED",
    "DELETED on väide faili puudumise kohta ja seda ei tohi teha kinnitamata kustutuse peale"
  );
});

/**
 * SOL-CALL-02 + SOL-CALL-03 — start on claim, mitte kavatsus.
 *
 * VÕIDUJOOKS SÜSTITAKSE PROVIDERI SISSE, sest just seal oli aken: taotlus jäi
 * `READY_TO_RECORD`-iks kogu välise kutse ajaks. Kui teine osaleja liitub või keegi
 * võtab nõusoleku tagasi TÄPSELT siis, peab start katkema ja äsja käivitatud egress
 * peatuma. Kunstlik `await` ei tõendaks midagi — aken peab olema päris kutse sees.
 */
function racingStartService(prisma, { stops, duringStart }) {
  return createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => {
        await duringStart();
        return { egressId: "egress_race_1" };
      },
      stopRecording: async ({ egressId }) => {
        stops.push(egressId);
        return { ok: true, stopped: true, status: "EGRESS_COMPLETE" };
      }
    },
    recordingStorage: {
      finalizeRecordingFile: async () => {
        throw new Error("should not finalize an aborted start");
      }
    }
  });
}

async function readyRecording(prisma, service) {
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  return { call, request };
}

test("SOL-CALL-01: hiline liituja ei kirjuta kinnitamata stopi FAILED-iga üle", async () => {
  /* SEE TEST SÜNDIS PÄRIS JOOKSUST. Pime `FAILED`-catch elas KAHES kohas ja mu esimene
     parandus katkas ainult ühe: `joinCall` kirjutas ausa `STOP_FAILED`-i endiselt üle.
     Ükski varasem test seda ei näinud, sest nad jõudsid `stopRecording`-ini otse või
     nõusolekuraja kaudu — mitte kunagi liitumise kaudu. */
  const prisma = createPrisma();
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => ({ egressId: "egress_join_1" }),
      stopRecording: async () => {
        throw new Error("livekit unreachable");
      }
      // getEgressStatus puudub → stoppi EI SAA kinnitada
    },
    recordingStorage: {
      finalizeRecordingFile: async () => {
        throw new Error("should not finalize an unconfirmed stop");
      }
    }
  });
  const { call, request } = await readyRecording(prisma, service);
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  await service.joinCall({ callSessionId: call.id, userId: "late_user" });

  const stored = prisma.callRecordingRequest.rows[0];
  assert.equal(stored.status, "STOP_FAILED", "aus seis peab liitumise järel alles jääma");
  assert.notEqual(stored.status, "FAILED", "pime ülekirjutus kustutaks taasproovi info");
  assert.equal(prisma.callRecordingFile.rows[0].status, "QUARANTINED");
  assert.ok(
    prisma.dataDeletionJob.rows.some(row => row.action === "CALL_EGRESS_STOP"),
    "taasproov peab järjekorda jääma ka siis, kui stopi käivitas liitumine"
  );
});

test("SOL-CALL-02: hiline liituja katkestab käimasoleva stardi ja äsja käivitatud egress peatatakse", async () => {
  const prisma = createPrisma();
  const holder = {};
  const stops = [];
  const service = racingStartService(prisma, {
    stops,
    duringStart: () => holder.service.joinCall({ callSessionId: holder.callId, userId: "late_user" })
  });
  holder.service = service;
  const { call, request } = await readyRecording(prisma, service);
  holder.callId = call.id;

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call\.recording_roster_changed/
  );

  const stored = prisma.callRecordingRequest.rows[0];
  assert.notEqual(stored.status, "ACTIVE", "nõusolekuta osalejaga koosseis ei tohi jõuda ACTIVE-ni");
  assert.equal(stored.startClaimId ?? null, null, "claim tuleb vabastada");
  assert.deepEqual(stops, ["egress_race_1"], "katkestatud start peab egress'i peatama");
  assert.equal(prisma.callRecordingFile.rows[0].status, "QUARANTINED");
});

test("SOL-CALL-02: stardi ajal tagasi võetud nõusolek ei kao hilise ACTIVE-kirjutuse alla", async () => {
  const prisma = createPrisma();
  const holder = {};
  const stops = [];
  const service = racingStartService(prisma, {
    stops,
    duringStart: () => holder.service.respondToRecordingConsent({
      callSessionId: holder.callId,
      recordingRequestId: holder.requestId,
      userId: "host",
      decision: "WITHDRAWN"
    })
  });
  holder.service = service;
  const { call, request } = await readyRecording(prisma, service);
  holder.callId = call.id;
  holder.requestId = request.id;

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true })
  );

  /* Vana kood kirjutas siia tingimusteta ACTIVE ja tagasivõtt kadus. Nüüd peab
     tagasivõtt olema real NÄHTAV — mitte lihtsalt „mitte-ACTIVE". */
  assert.equal(prisma.callRecordingRequest.rows[0].status, "DECLINED");
  assert.deepEqual(stops, ["egress_race_1"]);
});

test("SOL-CALL-03: DB-tõrge pärast provideri starti peatab egress'i, ei jäta orbu", async () => {
  const prisma = createPrisma();
  const stops = [];
  let failNextFileWrite = false;
  const realUpdate = prisma.callRecordingFile.update.bind(prisma.callRecordingFile);
  prisma.callRecordingFile.update = async args => {
    if (failNextFileWrite && args?.data?.egressId) throw new Error("db down");
    return realUpdate(args);
  };
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => {
        failNextFileWrite = true;
        return { egressId: "egress_orphan_1" };
      },
      stopRecording: async ({ egressId }) => {
        stops.push(egressId);
        return { ok: true, stopped: true, status: "EGRESS_COMPLETE" };
      }
    }
  });
  const { call, request } = await readyRecording(prisma, service);

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call\.recording_start_failed/
  );

  assert.deepEqual(stops, ["egress_orphan_1"], "kirjutuse tõrge peab providerile stopi saatma");
  assert.notEqual(prisma.callRecordingRequest.rows[0].status, "ACTIVE");
  assert.equal(prisma.callRecordingRequest.rows[0].startClaimId ?? null, null);
});

test("SOL-CALL-03: seisukirjutuse tõrge pärast provideri starti peatab samuti egress'i", async () => {
  /* Kriteerium ütleb „MÕLEMAD DB update'id". Eelmine test katkestab failikirjutuse,
     see katkestab taotluse seisukirjutuse — teine haru, sama kohustus. */
  const prisma = createPrisma();
  const stops = [];
  let failStateWrite = false;
  const realUpdateMany = prisma.callRecordingRequest.updateMany.bind(prisma.callRecordingRequest);
  prisma.callRecordingRequest.updateMany = args => {
    if (failStateWrite && args?.data?.status === "ACTIVE") return Promise.reject(new Error("db down"));
    return realUpdateMany(args);
  };
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => {
        failStateWrite = true;
        return { egressId: "egress_state_1" };
      },
      stopRecording: async ({ egressId }) => {
        stops.push(egressId);
        return { ok: true, stopped: true, status: "EGRESS_COMPLETE" };
      }
    }
  });
  const { call, request } = await readyRecording(prisma, service);

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call\.recording_start_failed/
  );

  assert.deepEqual(stops, ["egress_state_1"], "tundmatut egress'i ei tohi jääda");
  assert.notEqual(prisma.callRecordingRequest.rows[0].status, "ACTIVE");
});

test("SOL-CALL-03: aegunud start paneb ruumipõhise orvukontrolli järjekorda", async () => {
  const prisma = createPrisma();
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => {
        /* Timeout EI OLE tõend, et start ei jõudnud kohale — vastus võis lihtsalt
           kaduda. Siis on ainus tee orvuni ruum, sest egressId-d me ei tea. */
        const error = new Error("call.egress_start_timeout");
        error.code = "call.egress_start_timeout";
        error.isTimeout = true;
        throw error;
      }
    }
  });
  const { call, request } = await readyRecording(prisma, service);

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /egress_start_timeout/
  );

  const job = prisma.dataDeletionJob.rows.find(row => row.action === "CALL_EGRESS_ORPHAN_STOP");
  assert.ok(job, "aegunud start peab jätma ruumipõhise orvukontrolli");
  assert.equal(job.resourceId, call.id);
  assert.ok(job.storagePath, "orvukontroll vajab providerRoomName-i");
  assert.equal(prisma.callRecordingRequest.rows[0].status, "READY_TO_RECORD");
});

test("SOL-CALL-04 (kõrvalsaak): kaks paralleelset starti annavad ÜHE egress'i", async () => {
  const prisma = createPrisma();
  let starts = 0;
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => {
        starts += 1;
        return { egressId: `egress_parallel_${starts}` };
      },
      stopRecording: async () => ({ ok: true, stopped: true, status: "EGRESS_COMPLETE" })
    }
  });
  const { call, request } = await readyRecording(prisma, service);

  const results = await Promise.allSettled([
    service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true })
  ]);

  assert.equal(results.filter(r => r.status === "fulfilled").length, 1, "ainult üks start tohib võita");
  assert.equal(starts, 1, "kaotaja ei tohi providerini jõuda");
  assert.equal(prisma.callRecordingRequest.rows[0].status, "ACTIVE");
});

test("SOL-CALL-04: kordus pärast ACTIVE-t tagastab sama stardi, ei kutsu providerit ega kirjuta teist auditit", async () => {
  const prisma = createPrisma();
  let starts = 0;
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => {
        starts += 1;
        return { egressId: `egress_repeat_${starts}` };
      },
      stopRecording: async () => ({ ok: true, stopped: true, status: "EGRESS_COMPLETE" })
    }
  });
  const { call, request } = await readyRecording(prisma, service);
  const first = await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  const repeat = await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  assert.equal(repeat.id, first.id, "kordus peab tagastama OLEMASOLEVA stardi");
  assert.equal(repeat.status, "ACTIVE");
  assert.equal(starts, 1, "kordus ei tohi providerini jõuda");
  assert.equal(prisma.callRecordingFile.rows.length, 1, "üks fail");
  assert.equal(
    prisma.dataAuditLog.rows.filter(row => row.action === "CALL_RECORDING_STARTED").length,
    1,
    "üks tegu = üks auditirida"
  );
});

test("SOL-CALL-04: ACTIVE ilma egressId-ta EI ole start, mida korrata", async () => {
  // Aus piir: kui me ei tea egress'i, ei ole meil ka midagi, mille kohta öelda
  // „salvestus juba käib". Siia ei valeta.
  const prisma = createPrisma();
  const service = createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => ({ egressId: "egress_no_id" }),
      stopRecording: async () => ({ ok: true, stopped: true, status: "EGRESS_COMPLETE" })
    }
  });
  const { call, request } = await readyRecording(prisma, service);
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  prisma.callRecordingFile.rows[0].egressId = null;

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call.recording_not_ready/
  );
});

test("SOL-CALL-04: kahel katsel on eri failivõti ka samas sekundis", async () => {
  /* NEGATIIVKONTROLL on kell: mõlemal katsel on TÄPSELT sama `now`, seega vana
     nimevalem (call + request + sekund) oleks andnud kaks identset nime ja teine
     egress oleks kirjutanud esimese faili peale. Erinevuse saab teha ainult katse-ID. */
  const frozen = new Date("2026-08-10T09:00:00.000Z");
  const prisma = createPrisma();
  let attempt = 0;
  const service = createCallService({
    prisma,
    now: () => frozen,
    egress: {
      configured: true,
      startAudioRecording: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error("provider down");
        return { egressId: "egress_second_attempt" };
      },
      stopRecording: async () => ({ ok: true, stopped: true, status: "EGRESS_COMPLETE" })
    }
  });
  const { call, request } = await readyRecording(prisma, service);

  await assert.rejects(() => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }));
  const firstName = prisma.callRecordingFile.rows[0].filePath;
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  const secondName = prisma.callRecordingFile.rows[0].filePath;

  assert.ok(firstName && secondName, "mõlemal katsel peab olema failinimi");
  assert.notEqual(firstName, secondName, "sama sekundi kaks katset ei tohi jagada failivõtit");
  assert.equal(
    buildRecordingFileName({ callSessionId: call.id, recordingRequestId: request.id, now: frozen }),
    buildRecordingFileName({ callSessionId: call.id, recordingRequestId: request.id, now: frozen }),
    "ilma katse-ID-ta on nimi sama — just see oli vana viga"
  );
});

test("SOL-CALL-05: nõusolekurida sünnib ÜHE atomaarse lausega, mitte findFirst → create", async () => {
  const prisma = createPrisma();
  const consentModel = prisma.callRecordingConsent;
  let creates = 0;
  let upserts = 0;
  const realCreate = consentModel.create.bind(consentModel);
  const realUpsert = consentModel.upsert.bind(consentModel);
  consentModel.create = async args => {
    creates += 1;
    return realCreate(args);
  };
  consentModel.upsert = args => {
    upserts += 1;
    return realUpsert(args);
  };
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "guest" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });

  // Sama inimene kahel korral: liitumine uuesti + vastamine.
  await service.joinCall({ callSessionId: call.id, userId: "guest" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "guest", decision: "CONSENTED" });

  const guestRows = prisma.callRecordingConsent.rows.filter(row => row.userId === "guest");
  assert.equal(guestRows.length, 1, "üks inimene, üks rida");
  assert.equal(guestRows[0].status, "CONSENTED", "korduv liitumine ei tohi antud otsust REQUESTED-iks tagasi keerata");
  assert.ok(upserts > 0, "rida peab sündima upsert'iga");
  assert.equal(creates, 0, "findFirst → create rada ei tohi enam nõusolekuridu luua");
});

test("SOL-CALL-05: liitunikaalsus on skeemis ja migratsioonis, mitte ainult koodis", async () => {
  const schema = await readFile(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  const consentModel = schema.slice(schema.indexOf("model CallRecordingConsent"));
  assert.match(consentModel.slice(0, consentModel.indexOf("\n}")), /@@unique\(\[recordingRequestId, userId\]\)/);

  const migration = await readFile(
    new URL("../../prisma/migrations/20260810120000_sol_call_05_consent_one_row_per_person/migration.sql", import.meta.url),
    "utf8"
  );
  assert.match(migration, /CREATE UNIQUE INDEX/);
  // Duplikaate ei tohi vaikides kustutada — nõusolek on õiguslik tõend.
  assert.match(migration, /RAISE EXCEPTION/);
  assert.doesNotMatch(migration, /DELETE FROM "CallRecordingConsent"/);
});

// --- T12 ROOMS-CALLS-V1 ---

test("T12 E1: ending an active room call clears active participants and marks it ended (audit 16 K1)", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  const ended = await service.endActiveRoomCall({ roomId: "room_1", actorUserId: "user_1" });

  assert.equal(ended.status, "ENDED");
  assert.equal(prisma.callSession.rows[0].status, "ENDED");
  const active = prisma.callParticipant.rows.filter(row => row.leftAt == null);
  assert.equal(active.length, 0, "no active participants remain after room-call end");
});

test("T12 E1: endActiveRoomCall is a no-op when the room has no active call", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const result = await service.endActiveRoomCall({ roomId: "room_without_call", actorUserId: "user_1" });
  assert.equal(result, null);
});

test("T12 E1: releasing a room member from calls clears their participation and auto-ends when last (audit 16 K3)", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  await service.startRoomCall({ roomId: "room_1", userId: "user_1" });

  await service.releaseRoomMemberFromCalls({ roomId: "room_1", userId: "user_1" });

  const participant = prisma.callParticipant.rows.find(row => row.userId === "user_1");
  assert.ok(participant.leftAt, "leaving member's participation is marked left");
  assert.equal(prisma.callSession.rows[0].status, "ENDED", "last participant leaving auto-ends the call");
});

test("T12 E1: leaving a call drops the leaver's unanswered consent so the request unlocks (audit 4 K2)", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  // Host consents; user_2 has not answered → request stays locked at REQUESTED.
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  assert.equal(prisma.callRecordingRequest.rows[0].status, "REQUESTED");

  // user_2 leaves before answering → their pending consent row must not lock it forever.
  await service.leaveCall({ callSessionId: call.id, userId: "user_2" });

  const leftoverConsent = prisma.callRecordingConsent.rows.find(row => row.userId === "user_2");
  assert.equal(leftoverConsent, undefined, "leaver's unanswered consent row is removed");
  assert.equal(prisma.callRecordingRequest.rows[0].status, "READY_TO_RECORD", "request unlocks over the remaining consenters");
});

test("T12 E2: a second recording request while one is open returns the same request without duplicating", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const first = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  const second = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  assert.equal(second.id, first.id);
  assert.equal(prisma.callRecordingRequest.rows.length, 1);
});

test("T12 E2: a racing recording request that hits the unique index returns the winner, not a 500", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const realCreate = prisma.callRecordingRequest.create.bind(prisma.callRecordingRequest);
  // Simulate the TOCTOU window: pre-check sees no open request, then a concurrent
  // winner inserts one and our create hits the partial-unique index (P2002).
  prisma.callRecordingRequest.create = async ({ data }) => {
    await realCreate({ data: { ...data, id: "raced_open_request" } });
    const error = new Error("Unique constraint failed on the fields: (`callSessionId`)");
    error.code = "P2002";
    throw error;
  };

  const result = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });

  assert.equal(result.id, "raced_open_request", "returns the concurrent winner instead of throwing");
  const openRows = prisma.callRecordingRequest.rows.filter(row => ["REQUESTED", "READY_TO_RECORD", "ACTIVE"].includes(row.status));
  assert.equal(openRows.length, 1, "no duplicate open request survives the race");
});

function activeRecordingService(prisma, { egressStops, finalize = false } = {}) {
  return createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => ({ egressId: "egress_active_1" }),
      stopRecording: async payload => {
        if (egressStops) egressStops.push(payload);
        return { ok: true };
      }
    },
    recordingStorage: {
      ensureReady: async () => {},
      ...(finalize
        ? {
            finalizeRecordingFile: async ({ fileName }) => ({
              storagePath: `uploads/${fileName}`,
              mimeType: "audio/ogg",
              fileSizeBytes: 2048,
              durationSeconds: 30,
              checksum: "sha256-e5"
            })
          }
        : {})
    }
  });
}

test("T12 E5: a positive consent decision during an ACTIVE recording does not demote it (audit 5 K1 d)", async () => {
  const prisma = createPrisma();
  const service = activeRecordingService(prisma);
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });
  const started = await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  assert.equal(started.status, "ACTIVE");

  // Re-affirming consent while ACTIVE must NOT flip the request back to READY_TO_RECORD.
  const afterReconsent = await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });

  assert.equal(afterReconsent.status, "ACTIVE", "positive consent keeps the recording ACTIVE");
  assert.equal(prisma.callRecordingRequest.rows[0].status, "ACTIVE");
});

test("T12 E5: withdrawing consent during an ACTIVE recording stops egress and discards the artifact (audit 5 K1 c)", async () => {
  const prisma = createPrisma();
  const egressStops = [];
  const service = activeRecordingService(prisma, { egressStops });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  const afterWithdraw = await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "WITHDRAWN" });

  assert.equal(afterWithdraw.status, "STOPPED", "withdraw during ACTIVE stops the request");
  assert.equal(egressStops.length, 1, "egress was stopped exactly once");
  assert.equal(egressStops[0].egressId, "egress_active_1");
  assert.equal(prisma.callRecordingFile.rows[0].status, "DELETED", "the mixed artifact is discarded, not made available");
  assert.equal(prisma.userDocument.rows.length, 0, "no recording document is created on discard");
  assert.equal(prisma.dataAuditLog.rows.some(row => row.action === "CALL_RECORDING_DISCARDED"), true);
});

test("T12 E5: a late joiner during an ACTIVE recording halts it before they are recorded (audit 4 K1)", async () => {
  const prisma = createPrisma();
  const egressStops = [];
  const service = activeRecordingService(prisma, { egressStops, finalize: true });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  assert.equal(prisma.callRecordingRequest.rows[0].status, "ACTIVE");

  // A third participant joins mid-recording without having consented.
  await service.joinCall({ callSessionId: call.id, userId: "user_3" });

  assert.equal(egressStops.length, 1, "the late join halted egress");
  assert.equal(prisma.callRecordingRequest.rows[0].status, "COMPLETED", "the fully-consented portion is finalized, not left running");
  assert.equal(prisma.callRecordingFile.rows[0].status, "AVAILABLE");
});

test("T12 E5: cancelling cannot silently stop an ACTIVE recording and orphan egress (audit 5 K1 a)", async () => {
  const prisma = createPrisma();
  const egressStops = [];
  const service = activeRecordingService(prisma, { egressStops });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  // Cancel targets only pre-ACTIVE requests; an ACTIVE one must be stopped (egress + finalize), not cancelled.
  await assert.rejects(
    () => service.cancelRecordingRequest({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call\.recording_request_not_found/
  );
  assert.equal(prisma.callRecordingRequest.rows[0].status, "ACTIVE", "the ACTIVE recording is untouched by cancel");
  assert.equal(egressStops.length, 0, "cancel did not touch egress");
});

function completedRecordingService(prisma, { deleted } = {}) {
  return createCallService({
    prisma,
    egress: {
      configured: true,
      startAudioRecording: async () => ({ egressId: "egress_active_1" }),
      stopRecording: async () => ({ ok: true })
    },
    recordingStorage: {
      ensureReady: async () => {},
      finalizeRecordingFile: async ({ fileName }) => ({
        storagePath: `uploads/${fileName}`,
        mimeType: "audio/ogg",
        fileSizeBytes: 1024,
        durationSeconds: 12,
        checksum: "sha256-e6"
      }),
      deleteStoredArtifact: async ({ storagePath }) => {
        if (deleted) deleted.push(storagePath);
      }
    }
  });
}

async function completeARecording(service, prisma) {
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const request = await createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" });
  await service.respondToRecordingConsent({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", decision: "CONSENTED" });
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  await service.stopRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  return { call, request };
}

test("T12 E6: the recording owner can manually delete a completed recording (audit 12 K1)", async () => {
  const prisma = createPrisma();
  const deleted = [];
  const service = completedRecordingService(prisma, { deleted });
  const { call, request } = await completeARecording(service, prisma);
  assert.equal(prisma.callRecordingFile.rows[0].status, "AVAILABLE");

  await service.deleteRecordingFile({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: false });

  assert.equal(prisma.callRecordingFile.rows[0].status, "DELETED");
  assert.equal(deleted.length, 1, "physical artifact is deleted");
  assert.equal(prisma.userDocument.rows.length, 0, "recording document is removed");
  assert.equal(prisma.dataAuditLog.rows.some(row => row.action === "CALL_RECORDING_DELETED"), true);
});

test("T12 E6: a non-owner non-moderator cannot delete a recording", async () => {
  const prisma = createPrisma();
  const service = completedRecordingService(prisma, {});
  const { call, request } = await completeARecording(service, prisma);

  await assert.rejects(
    () => service.deleteRecordingFile({ callSessionId: call.id, recordingRequestId: request.id, userId: "intruder", canModerate: false }),
    /call\.recording_forbidden/
  );
  assert.equal(prisma.callRecordingFile.rows[0].status, "AVAILABLE", "a forbidden delete leaves the recording intact");
});

/* SOL-CALL-06 — käsitsi kustutus ei tohi kinnitada seda, mida ta ei suutnud teha.
   Vana rada kutsus purge'i tulemust vaatamata ja vastas `ok:true` ka siis, kui
   füüsiline fail jäi kettale. Tundliku heli puhul on „kustutatud" lubadus: kui me
   teda tõendada ei suuda, peab inimene seda TEADMA ja rida peab jääma seisu, mille
   retention uuesti üles korjab. */
test("SOL-CALL-06: kustutamata fail annab vea, mitte ok:true", async () => {
  const prisma = createPrisma();
  const service = completedRecordingService(prisma, {});
  const { call, request } = await completeARecording(service, prisma);
  const failing = createCallService({
    prisma,
    recordingStorage: {
      ensureReady: async () => {},
      deleteStoredArtifact: async () => {
        const error = new Error("EACCES: permission denied");
        error.code = "EACCES";
        throw error;
      }
    }
  });

  await assert.rejects(
    () => failing.deleteRecordingFile({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: false }),
    /call\.recording_delete_failed/
  );

  assert.equal(prisma.callRecordingFile.rows[0].status, "DELETE_PENDING", "rida ei tohi väita, et faili ei ole");
  assert.equal(prisma.userDocument.rows.length, 1, "dokumendirida jääb alles, kuni objekt on tõesti kadunud");
  const actions = prisma.dataAuditLog.rows.map(row => row.action);
  assert.equal(actions.includes("CALL_RECORDING_DELETED"), false, "õnnestumise auditit ei tohi kirjutada");
  assert.equal(actions.includes("CALL_RECORDING_DELETE_FAILED"), true, "tõrge peab jälje jätma");
});

test("SOL-CALL-06: kustutuse tõrge kaardistub 503-ks, mitte vaikseks 200-ks", async () => {
  const source = await readFile(new URL("../../lib/calls/roomRoutes.js", import.meta.url), "utf8");
  assert.match(source, /call\.recording_delete_failed"\) return \{ message, status: 503 \}/);
});

/* SOL-CALL-10 — kvoot ja kestus. Mõlemad on piirid, mida enne EI OLNUD: salvestus
   võis kasvada lõputult ja lõpuks kirjutati `UserDocument` ilma ühegi mahupilguta. */

const RECORDING_MB = 1024 * 1024;

function recordingReadyService(prisma, { egressStarts = [], now = () => new Date("2026-08-10T10:00:00Z") } = {}) {
  return createCallService({
    prisma,
    now,
    egress: {
      configured: true,
      startAudioRecording: async ({ fileName }) => {
        egressStarts.push(fileName);
        return { egressId: "egress_limits_1" };
      },
      stopRecording: async () => ({ ok: true })
    },
    recordingStorage: {
      ensureReady: async () => {},
      finalizeRecordingFile: async ({ fileName }) => ({
        storagePath: `uploads/${fileName}`,
        mimeType: "audio/ogg",
        fileSizeBytes: 2048,
        durationSeconds: 7200,
        checksum: "sha256-limits"
      }),
      deleteStoredArtifact: async () => {}
    }
  });
}

async function consentedRecording(service, prisma) {
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  const request = await createRecordingRequest({
    prisma,
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    requesterName: "Host"
  });
  await service.respondToRecordingConsent({
    callSessionId: call.id,
    recordingRequestId: request.id,
    userId: "host",
    decision: "CONSENTED"
  });
  return { call, request };
}

test("SOL-CALL-10: täis salvestusruum peatab salvestuse ENNE egressi", async () => {
  const prisma = createPrisma();
  const egressStarts = [];
  const service = recordingReadyService(prisma, { egressStarts });
  const { call, request } = await consentedRecording(service, prisma);

  // Kliendirolli kvoot on 50 MB; reserv on 120 min × 32 kbps ≈ 28,8 MB.
  prisma.user.rows.push({ id: "host", role: "CLIENT" });
  prisma.userDocument.rows.push({ id: "doc_full", ownerId: "host", size: 40 * RECORDING_MB });

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call\.recording_storage_quota_exceeded/
  );

  assert.equal(egressStarts.length, 0, "keeldumine peab tulema ENNE providerit — pärast oleks valik 'ületa kvoot' või 'kustuta nõusolekuga saadud heli'");
  const stored = prisma.callRecordingRequest.rows.find(row => row.id === request.id);
  assert.equal(stored.status, "READY_TO_RECORD", "start-claim vabastatakse, muidu jääks taotlus igaveseks STARTING-uks");
});

test("SOL-CALL-10: mahtuv salvestus ei jää kvoodi taha kinni", async () => {
  const prisma = createPrisma();
  const egressStarts = [];
  const service = recordingReadyService(prisma, { egressStarts });
  const { call, request } = await consentedRecording(service, prisma);
  prisma.user.rows.push({ id: "host", role: "SOCIAL_WORKER" });
  prisma.userDocument.rows.push({ id: "doc_small", ownerId: "host", size: 10 * RECORDING_MB });

  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  assert.equal(egressStarts.length, 1);
});

test("SOL-CALL-10: kestuselae ületanud salvestus peatatakse automaatselt", async () => {
  const prisma = createPrisma();
  let clock = new Date("2026-08-10T10:00:00Z");
  const service = recordingReadyService(prisma, { now: () => clock });
  const { call, request } = await consentedRecording(service, prisma);
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });

  // Kaks tundi ei ole veel möödas: valve ei tohi töötavat salvestust katkestada.
  clock = new Date("2026-08-10T11:30:00Z");
  const early = await service.stopOverdueRecordings({});
  assert.equal(early.scanned, 0, "cutoff peab päriselt filtreerima");
  assert.equal(prisma.callRecordingRequest.rows.find(row => row.id === request.id).status, "ACTIVE");

  clock = new Date("2026-08-10T13:00:00Z");
  const swept = await service.stopOverdueRecordings({});
  assert.equal(swept.scanned, 1);
  assert.equal(swept.stopped, 1);
  assert.equal(swept.failed, 0);

  const stopped = prisma.callRecordingRequest.rows.find(row => row.id === request.id);
  assert.equal(stopped.status, "COMPLETED", "peatamine käib sama teed nagu inimese vajutatud stopp");
  const actions = prisma.dataAuditLog.rows.map(row => row.action);
  assert.equal(actions.includes("CALL_RECORDING_AUTO_STOPPED"), true, "automaatne peatamine peab olema eristatav inimese omast");
  assert.equal(actions.includes("CALL_RECORDING_STOPPED"), true);
});

test("SOL-CALL-10: kestuse valve elab retention-tsüklis, mitte kommentaaris", async () => {
  const source = await readFile(new URL("../../lib/retention.js", import.meta.url), "utf8");
  assert.match(source, /stopOverdueRecordings/);
});

test("T12: two simultaneous last-leavers end the call once and write one system message (audit 4 K4)", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-08-03T20:00:00Z") });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });

  // Mõlemad lahkuvad korraga: mõlemad loevad activeCount = 0 ja mõlemad jõuavad
  // lõpetamiseni. Varem kirjutas kumbki oma „Helikõne toimus …" sõnumi.
  const [first, second] = await Promise.all([
    service.leaveCall({ callSessionId: call.id, userId: "user_1" }),
    service.leaveCall({ callSessionId: call.id, userId: "user_2" })
  ]);

  assert.equal(first.status, "ENDED");
  assert.equal(second.status, "ENDED");
  assert.equal(prisma.callSession.rows.filter(row => row.status === "ENDED").length, 1);
  const systemMessages = prisma.roomMessage.rows.filter(row => /Helikõne toimus/.test(row.content || ""));
  assert.equal(systemMessages.length, 1);
});

test("T12: ending an already ended call does not add a second system message (audit 4 K4)", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-08-03T20:05:00Z") });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "user_1" });

  await service.endCall({ callSessionId: call.id, userId: "user_1" });
  await assert.rejects(
    () => service.endCall({ callSessionId: call.id, userId: "user_1" }),
    /call.not_active/
  );

  const systemMessages = prisma.roomMessage.rows.filter(row => /Helikõne toimus/.test(row.content || ""));
  assert.equal(systemMessages.length, 1);
});

// --- Salvestuse nõusolek osaleja enda keeles (04.08.2026) ---------------------
// Kuvatav dialoog oli kolmes keeles juba varem, aga SALVESTATUD tõend ehitati
// eestikeelsest kõvakodeeritud tekstist: vene- või ingliskeelne osaleja luges
// üht teksti ja tema nõusolekukirjesse jäi teine. Need testid lukustavad, et
// kirje tekib selles keeles, milles inimene teksti luges.

test("nõusolekutekst ehitatakse tõlkekataloogist, mitte koodi kõvakodeeritud eesti keelest", () => {
  const ruText = buildRecordingConsentText({
    requesterName: "Ivan",
    purpose: "CASE_SUMMARY",
    locale: "ru"
  });
  assert.match(ruText, /Ivan/);
  assert.ok(ruText.includes(ru.calls.recording_purpose_case_summary));
  assert.ok(ruText.includes(ru.calls.recording_consent_question));
  assert.ok(!ruText.includes("Kas nõustud selle kõne salvestamisega?"));

  const enText = buildRecordingConsentText({
    requesterName: "Anna",
    purpose: "STAR_HELPER",
    locale: "en"
  });
  assert.ok(enText.includes(en.calls.recording_purpose_star_helper));
  assert.ok(enText.includes(en.calls.recording_consent_question));
});

test("tundmatu või puuduv keel jääb eesti keelde, mitte ei kuku serveri en-vaikimisele", () => {
  assert.equal(normalizeConsentLocale(""), "et");
  assert.equal(normalizeConsentLocale(undefined), "et");
  assert.equal(normalizeConsentLocale("de"), "et");
  assert.equal(normalizeConsentLocale("ru-RU"), "ru");
  const fallback = buildRecordingConsentText({ requesterName: "Mari", purpose: "GENERAL_SUMMARY" });
  assert.ok(fallback.includes(et.calls.recording_purpose_general_summary));
  assert.match(fallback, /Mari soovib selle helikõne salvestada/);
});

/* SOL-CALL-07 — NÕUSOLEKUTEKST ÜTLEB KANDJA VÄLJA.
   Vana tekst lubas kõigis kolmes keeles, et salvestis „tehakse kättesaadavaks
   õigustatud kasutajatele dokumentide vaates". Ligipääsu ei olnud kunagi kellelgi
   peale taotleja — see lause oli tõendiks salvestatud lubadus, mida süsteem ei
   täitnud. Test lukustab, et lubadus on nüüd sama, mis mehhanism. */
test("nõusolekutekst nimetab salvestise kandja ega luba ligipääsu, mida ei ole", () => {
  const cases = [["et", et], ["en", en], ["ru", ru]];
  for (const [locale, catalog] of cases) {
    const consentText = buildRecordingConsentText({
      requesterName: "Mari Mets",
      purpose: "GENERAL_SUMMARY",
      locale
    });
    assert.ok(
      consentText.includes(catalog.calls.recording_consent_custody.replaceAll("{requesterName}", "Mari Mets")),
      `${locale}: kandja lõik puudub`
    );
  }

  const etText = buildRecordingConsentText({ requesterName: "Mari Mets", purpose: "GENERAL_SUMMARY", locale: "et" });
  assert.ok(!/õigustatud kasutajatele/.test(etText));
  const enText = buildRecordingConsentText({ requesterName: "Mari Mets", purpose: "GENERAL_SUMMARY", locale: "en" });
  assert.ok(!/authorised users/.test(enText));
  const ruText = buildRecordingConsentText({ requesterName: "Mari Mets", purpose: "GENERAL_SUMMARY", locale: "ru" });
  assert.ok(!/авторизованным пользователям/.test(ruText));
});

test("nimeta küsija saab keelekohase üldnimetuse, mitte eestikeelse 'Kõne osaleja'", () => {
  const ruText = buildRecordingConsentText({ requesterName: "", purpose: "GENERAL_SUMMARY", locale: "ru" });
  assert.ok(ruText.includes(ru.calls.recording_requester_fallback));
  assert.ok(!ruText.includes("Kõne osaleja"));
});

test("iga osaleja nõusolekukirje salvestub tema enda keeles ja keel jääb kirje juurde", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-08-04T09:00:00Z") });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await service.createRecordingRequest({
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "CASE_SUMMARY",
    requesterName: "Test Admin",
    locale: "et"
  });
  // Küsija nimi jääb eraldi väljana alles, et sama teksti saaks teises keeles
  // uuesti renderdada ilma nime tekstist välja parsimata.
  assert.equal(prisma.callRecordingRequest.rows[0].requesterNameSnapshot, "Test Admin");

  await service.respondToRecordingConsent({
    callSessionId: call.id,
    recordingRequestId: request.id,
    userId: "host",
    decision: "CONSENTED",
    locale: "et"
  });
  await service.respondToRecordingConsent({
    callSessionId: call.id,
    recordingRequestId: request.id,
    userId: "user_2",
    decision: "CONSENTED",
    locale: "ru"
  });

  const hostConsent = prisma.callRecordingConsent.rows.find(row => row.userId === "host");
  const ruConsent = prisma.callRecordingConsent.rows.find(row => row.userId === "user_2");

  assert.equal(hostConsent.locale, "et");
  assert.ok(hostConsent.consentTextSnapshot.includes(et.calls.recording_purpose_case_summary));

  assert.equal(ruConsent.locale, "ru");
  assert.ok(ruConsent.consentTextSnapshot.includes(ru.calls.recording_purpose_case_summary));
  assert.ok(ruConsent.consentTextSnapshot.includes(ru.calls.recording_consent_question));
  // Kõige olulisem rida: venekeelse osaleja tõend EI tohi olla eestikeelne.
  assert.ok(!ruConsent.consentTextSnapshot.includes("Kas nõustud selle kõne salvestamisega?"));
  // Mõlemad nimetavad sama küsijat — tõlgitakse tekst, mitte inimese nimi.
  assert.match(ruConsent.consentTextSnapshot, /Test Admin/);
});

test("tagasivõtmine ei kirjuta üle teksti, millega inimene kunagi nõustus", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma, now: () => new Date("2026-08-04T09:00:00Z") });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await service.createRecordingRequest({
    callSessionId: call.id,
    userId: "host",
    canModerate: true,
    purpose: "GENERAL_SUMMARY",
    requesterName: "Test Admin",
    locale: "et"
  });
  await service.respondToRecordingConsent({
    callSessionId: call.id,
    recordingRequestId: request.id,
    userId: "user_2",
    decision: "CONSENTED",
    locale: "ru"
  });
  const afterConsent = prisma.callRecordingConsent.rows.find(row => row.userId === "user_2").consentTextSnapshot;

  // Tagasivõtmine tuleb teise seadme pealt, kus liides on eesti keeles.
  await service.respondToRecordingConsent({
    callSessionId: call.id,
    recordingRequestId: request.id,
    userId: "user_2",
    decision: "WITHDRAWN",
    locale: "et"
  });
  const withdrawn = prisma.callRecordingConsent.rows.find(row => row.userId === "user_2");

  assert.equal(withdrawn.status, "WITHDRAWN");
  assert.equal(withdrawn.consentTextSnapshot, afterConsent);
  assert.equal(withdrawn.locale, "ru");
});

test("salvestuse eesmärgi rippmenüü sildid tulevad tõlkevõtmetest, mitte kõvakodeeritud loendist", async () => {
  const source = await readFile(new URL("../../components/rooms/RoomCallBar.jsx", import.meta.url), "utf8");
  assert.match(source, /options=\{recordingPurposeOptions\(t\)\}/);
  assert.match(source, /calls\.recording_purpose_\$\{value\.toLowerCase\(\)\}/);
});

/* SOL-CALL-09 — AUDIT ON KOHUSTUSLIK JA ELAB SAMAS TEHINGUS.

   Kõik salvestuse elutsükli auditid käisid läbi funktsiooni, mis püüdis vea kinni
   ja tagastas `null`; ükski kutsuja ei vaadanud tulemust ja puuduv `dataAuditLog`
   andis sama vaikse `null`-i. Samal ajal muutus põhiseis ja füüsiline helifail
   edukalt — st loa, tagasivõtu, käivituse ja kustutuse kohta võis kohustuslik jälg
   PUUDUDA, kuigi API kinnitas edu.

   Need testid süstivad audititõrke igasse elutsüklitoimingusse ja mõõdavad, mida
   toiming ENDAST maha jättis. Fake pöörab tehingu tagasi (vt `createPrisma`), päris
   tagasipööramist tõendab `npm run call:seat:probe`. */

async function readyToRecord(prisma, service, { participants = [] } = {}) {
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  for (const userId of participants) {
    await service.joinCall({ callSessionId: call.id, userId });
  }
  const request = await createRecordingRequest({
    prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host"
  });
  for (const userId of ["host", ...participants]) {
    await service.respondToRecordingConsent({
      callSessionId: call.id, recordingRequestId: request.id, userId, decision: "CONSENTED"
    });
  }
  return { call, request };
}

function breakAudit(prisma) {
  prisma.dataAuditLog.create = async () => {
    throw new Error("audit down");
  };
}

test("SOL-CALL-09: taotluse audititõrge ei jäta maha taotlust, nõusolekuridu ega failirida", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  breakAudit(prisma);

  await assert.rejects(
    () => createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" }),
    /audit down/
  );

  assert.equal(prisma.callRecordingRequest.rows.length, 0, "taotlust ilma jäljeta ei jää");
  assert.equal(prisma.callRecordingConsent.rows.length, 0);
  assert.equal(prisma.callRecordingFile.rows.length, 0);
});

test("SOL-CALL-09: nõusolekuotsuse audititõrge pöörab otsuse tagasi", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  await service.joinCall({ callSessionId: call.id, userId: "user_2" });
  const request = await createRecordingRequest({
    prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host"
  });
  const rosterBefore = prisma.callSession.rows[0].rosterVersion;
  breakAudit(prisma);

  await assert.rejects(
    () => service.respondToRecordingConsent({
      callSessionId: call.id, recordingRequestId: request.id, userId: "user_2", decision: "CONSENTED"
    }),
    /audit down/
  );

  const consent = prisma.callRecordingConsent.rows.find(row => row.userId === "user_2");
  assert.equal(consent.status, "REQUESTED", "salvestamise luba ei jõustu ilma tõendita");
  assert.equal(prisma.callSession.rows[0].rosterVersion, rosterBefore, "koosseisu loend ei liigu poolikult");
});

test("SOL-CALL-09: käivituse audititõrge peatab egressi ega jäta ACTIVE salvestust", async () => {
  const prisma = createPrisma();
  const egressStops = [];
  const service = activeRecordingService(prisma, { egressStops });
  const { call, request } = await readyToRecord(prisma, service);
  breakAudit(prisma);

  await assert.rejects(
    () => service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /call\.recording_start_failed/
  );

  assert.notEqual(prisma.callRecordingRequest.rows[0].status, "ACTIVE", "salvestust, mille algusest ei ole jälge, ei loeta käimasolevaks");
  assert.equal(egressStops.length, 1, "käivitatud egress peatatakse, mitte ei jäeta käima");
});

test("SOL-CALL-09: lõpetamise audititõrge ei jäta maha orvuks jäänud dokumenti", async () => {
  const prisma = createPrisma();
  const service = activeRecordingService(prisma, { finalize: true });
  const { call, request } = await readyToRecord(prisma, service);
  await service.startRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true });
  breakAudit(prisma);

  await assert.rejects(
    () => service.stopRecording({ callSessionId: call.id, recordingRequestId: request.id, userId: "host", canModerate: true }),
    /audit down/
  );

  assert.equal(prisma.userDocument.rows.length, 0, "dokument, millele ükski failirida ei viita, ei jää alles");
  assert.equal(prisma.callRecordingRequest.rows[0].status, "FAILED");
  assert.notEqual(prisma.callRecordingFile.rows[0].status, "AVAILABLE");
});

test("SOL-CALL-09: kustutuse jälg sünnib koos DELETED reaga", async () => {
  const prisma = createPrisma();
  const service = completedRecordingService(prisma, { deleted: [] });
  const { call, request } = await completeARecording(service, prisma);
  breakAudit(prisma);

  await assert.rejects(
    () => service.deleteRecordingFile({ callSessionId: call.id, recordingRequestId: request.id, userId: "host" }),
    /call\.recording_delete_failed/
  );

  assert.equal(
    prisma.callRecordingFile.rows[0].status,
    "DELETE_PENDING",
    "jäljeta kustutus jääb pooleli ja sweep proovib uuesti"
  );
});

test("SOL-CALL-09: puuduv auditikiht ei ole enam vaikne pääs", async () => {
  const prisma = createPrisma();
  const service = createCallService({ prisma });
  const call = await service.startRoomCall({ roomId: "room_1", userId: "host" });
  delete prisma.dataAuditLog;

  await assert.rejects(
    () => createRecordingRequest({ prisma, callSessionId: call.id, userId: "host", canModerate: true, requesterName: "Host" })
  );

  assert.equal(prisma.callRecordingRequest.rows.length, 0);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as offerService from "../../lib/help/offers.js";
import * as requestService from "../../lib/help/requests.js";
import { HELP_LISTING_TEXT_LIMITS } from "../../lib/help/listingLimits.js";

const BASE_UPDATED_AT = new Date("2026-08-13T09:00:00.000Z");
const CATEGORY = Object.freeze({
  id: "category-other",
  code: "OTHER",
  labelEt: "Muu abi",
  labelEn: "Other help",
  labelRu: "Другая помощь"
});

function clone(value) {
  return structuredClone(value);
}

function applyData(row, data = {}) {
  for (const [key, value] of Object.entries(data)) {
    if (key === "targetGroupLinks") continue;
    row[key] = clone(value);
  }
  if (!Object.prototype.hasOwnProperty.call(data, "updatedAt")) {
    row.updatedAt = new Date(Math.max(Date.now(), new Date(row.updatedAt).getTime() + 1));
  }
}

function sameDate(left, right) {
  return new Date(left).getTime() === new Date(right).getTime();
}

function listingRecord(kind, overrides = {}) {
  const isRequest = kind === "request";
  return {
    id: `${kind}-1`,
    userId: "owner-1",
    municipalityId: null,
    primaryCategoryId: CATEGORY.id,
    title: isRequest ? "Vajan abi" : "Pakun abi",
    description: isRequest ? "Vajan igapäevast abi." : "Pakun igapäevast abi.",
    structuredSummary: "Igapäevane abi",
    roleLabel: null,
    beneficiaryLabel: isRequest ? null : undefined,
    providerScopeOrConditions: isRequest ? undefined : null,
    urgency: isRequest ? null : undefined,
    availabilityOrStart: null,
    compensationDetails: null,
    conditions: null,
    skillsOrBackground: null,
    rawPlace: "Paide",
    helpType: "VOLUNTARY",
    timeType: "FLEXIBLE",
    status: "OPEN",
    classificationSource: "USER",
    classificationConfidence: null,
    userConfirmedAt: new Date("2026-08-13T08:00:00.000Z"),
    expiresAt: new Date("2026-09-20T00:00:00.000Z"),
    createdAt: new Date("2026-08-13T08:00:00.000Z"),
    updatedAt: BASE_UPDATED_AT,
    municipality: null,
    primaryCategory: CATEGORY,
    categoryLinks: [],
    targetGroupLinks: [],
    ...overrides
  };
}

function mapEntry(kind, overrides = {}) {
  const isRequest = kind === "request";
  return {
    id: `map-${kind}-1`,
    kind: isRequest ? "HELP_REQUEST" : "HELP_OFFER",
    requestId: isRequest ? `${kind}-1` : null,
    offerId: isRequest ? null : `${kind}-1`,
    mapVisible: false,
    mapMode: "PHYSICAL",
    address: "Paide linn",
    normalizedAddress: "Paide linn, Järva maakond",
    latitude: 58.8856,
    longitude: 25.5572,
    geocodingStatus: "MATCHED",
    geocodingRaw: { provider: "test" },
    county: "Järva maakond",
    municipalityIds: ["municipality-a", "municipality-b"],
    serviceArea: "Paide",
    categoryCode: "OTHER",
    helpType: "VOLUNTARY",
    targetGroupCodes: [],
    needTags: ["igapäevane abi"],
    deliveryModes: ["ON_SITE"],
    contactMode: "EMAIL",
    status: "HIDDEN",
    expiresAt: new Date("2026-09-20T00:00:00.000Z"),
    privacyNote: "Kasutaja lubas täpse asukoha kaardil kuvada.",
    createdAt: new Date("2026-08-13T08:00:00.000Z"),
    updatedAt: BASE_UPDATED_AT,
    ...overrides
  };
}

function createHelpDb({ kind = "request", record = listingRecord(kind), entry = mapEntry(kind), failMapWrites = 0 } = {}) {
  let remainingMapWriteFailures = failMapWrites;
  let transactionTail = Promise.resolve();
  const state = {
    requests: kind === "request" && record ? [clone(record)] : [],
    offers: kind === "offer" && record ? [clone(record)] : [],
    mapEntries: entry ? [clone(entry)] : [],
    audits: [],
    failMapWrites
  };

  function makeClient(target, transactional = false) {
    const hydrate = (row, rowKind) => {
      if (!row) return null;
      const relationKey = rowKind === "request" ? "requestId" : "offerId";
      const relatedMap = target.mapEntries.find((item) => item[relationKey] === row.id) || null;
      return clone({ ...row, mapEntry: relatedMap });
    };

    const model = (rowKind) => {
      const rows = rowKind === "request" ? target.requests : target.offers;
      return {
        async create({ data }) {
          const id = `${rowKind}-${rows.length + 1}`;
          const created = listingRecord(rowKind, {
            ...clone(data),
            id,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          rows.push(created);
          return hydrate(created, rowKind);
        },
        async findUnique({ where }) {
          return hydrate(rows.find((item) => item.id === where.id) || null, rowKind);
        },
        async update({ where, data }) {
          const row = rows.find((item) => item.id === where.id);
          if (!row) throw Object.assign(new Error("P2025"), { code: "P2025" });
          applyData(row, data);
          return hydrate(row, rowKind);
        },
        async updateMany({ where, data }) {
          const row = rows.find((item) => (
            item.id === where.id
            && (!where.userId || item.userId === where.userId)
            && (!where.updatedAt || sameDate(item.updatedAt, where.updatedAt))
            && (!where.status?.in || where.status.in.includes(item.status))
          ));
          if (!row) return { count: 0 };
          applyData(row, data);
          return { count: 1 };
        }
      };
    };

    const client = {
      helpRequest: model("request"),
      helpOffer: model("offer"),
      helpCategory: {
        async findUnique({ where }) {
          return where.id === CATEGORY.id || where.code === CATEGORY.code ? clone(CATEGORY) : null;
        }
      },
      targetGroup: {
        async findMany() {
          return [];
        }
      },
      helpMapEntry: {
        async upsert({ where, create, update }) {
          if (remainingMapWriteFailures > 0) {
            remainingMapWriteFailures -= 1;
            throw Object.assign(new Error("HELP_MAP_WRITE_INJECTED"), { code: "HELP_MAP_WRITE_INJECTED" });
          }
          const relationKey = Object.prototype.hasOwnProperty.call(where, "requestId") ? "requestId" : "offerId";
          let row = target.mapEntries.find((item) => item[relationKey] === where[relationKey]);
          if (row) applyData(row, update);
          else {
            row = {
              id: `map-${target.mapEntries.length + 1}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              ...clone(create)
            };
            target.mapEntries.push(row);
          }
          return clone(row);
        }
      },
      dataAuditLog: {
        async create({ data }) {
          const row = { id: `audit-${target.audits.length + 1}`, createdAt: new Date(), ...clone(data) };
          target.audits.push(row);
          return clone(row);
        }
      }
    };

    if (!transactional) {
      client.$transaction = (callback) => {
        const run = transactionTail.then(async () => {
          const draft = clone(target);
          const tx = makeClient(draft, true);
          const result = await callback(tx);
          for (const key of Object.keys(target)) target[key] = draft[key];
          return result;
        });
        transactionTail = run.then(() => undefined, () => undefined);
        return run;
      };
    }
    return client;
  }

  return {
    client: makeClient(state),
    state,
    setMapWriteFailures(count) {
      remainingMapWriteFailures = count;
      state.failMapWrites = count;
    }
  };
}

function servicesFor(kind) {
  return kind === "request"
    ? {
        create: requestService.createHelpRequest,
        update: requestService.updateHelpRequest,
        transition: requestService.transitionHelpRequestStatus
      }
    : {
        create: offerService.createHelpOffer,
        update: offerService.updateHelpOffer,
        transition: offerService.transitionHelpOfferStatus
      };
}

test("SOL-HELP-01: tekstiparandus säilitab peidetud kaardikirje kõik seaded ja kontaktiviisid", async () => {
  for (const kind of ["request", "offer"]) {
    for (const contactMode of ["PLATFORM", "PHONE", "EMAIL", "OTHER"]) {
      const db = createHelpDb({ kind, entry: mapEntry(kind, { contactMode }) });
      const service = servicesFor(kind);
      await service.update(`${kind}-1`, {
        title: "Parandatud pealkiri",
        expectedUpdatedAt: BASE_UPDATED_AT.toISOString()
      }, db.client);
      const saved = db.state.mapEntries[0];
      assert.equal(saved.mapVisible, false, `${kind}/${contactMode}: mapVisible`);
      assert.equal(saved.mapMode, "PHYSICAL", `${kind}/${contactMode}: mapMode`);
      assert.equal(saved.contactMode, contactMode, `${kind}/${contactMode}: contactMode`);
      assert.equal(saved.status, "HIDDEN", `${kind}/${contactMode}: status`);
      assert.equal(saved.address, "Paide linn", `${kind}/${contactMode}: address`);
      assert.deepEqual(saved.deliveryModes, ["ON_SITE"], `${kind}/${contactMode}: deliveryModes`);
      assert.deepEqual(saved.municipalityIds, ["municipality-a", "municipality-b"], `${kind}/${contactMode}: municipalityIds`);
    }
  }
});

test("SOL-HELP-02: map-upserti viga pöörab põhikirje update'i tagasi", async () => {
  for (const kind of ["request", "offer"]) {
    const db = createHelpDb({ kind, failMapWrites: 1 });
    const service = servicesFor(kind);
    await assert.rejects(
      service.update(`${kind}-1`, {
        title: "Ei tohi püsima jääda",
        expectedUpdatedAt: BASE_UPDATED_AT.toISOString()
      }, db.client),
      /HELP_MAP_WRITE_INJECTED/
    );
    const rows = kind === "request" ? db.state.requests : db.state.offers;
    assert.notEqual(rows[0].title, "Ei tohi püsima jääda", `${kind}: põhikirje peab rollback'ima`);
  }
});

test("SOL-HELP-02: create rollback'ib ja sama korduspäring jätab täpselt ühe kuulutuse", async () => {
  for (const kind of ["request", "offer"]) {
    const db = createHelpDb({ kind, record: null, entry: null, failMapWrites: 1 });
    const service = servicesFor(kind);
    const input = {
      userId: "owner-1",
      primaryCategoryCode: "OTHER",
      title: "Uus kuulutus",
      description: "Uue kuulutuse sisu",
      mapMode: "ONLINE_PHONE"
    };
    await assert.rejects(service.create(input, db.client), /HELP_MAP_WRITE_INJECTED/);
    const rows = () => kind === "request" ? db.state.requests : db.state.offers;
    assert.equal(rows().length, 0, `${kind}: nurjunud create ei tohi põhikirjet jätta`);
    await service.create(input, db.client);
    assert.equal(rows().length, 1, `${kind}: korduspäring loob ühe kuulutuse`);
    assert.equal(db.state.mapEntries.length, 1, `${kind}: korduspäring loob ühe kaardikirje`);
  }
});

test("SOL-HELP-03: kaks sama revisjoniga parandust annavad ühe võitja ja ühe konflikti", async () => {
  for (const kind of ["request", "offer"]) {
    const db = createHelpDb({ kind });
    const service = servicesFor(kind);
    const outcomes = await Promise.allSettled([
      service.update(`${kind}-1`, { title: "Esimene", expectedUpdatedAt: BASE_UPDATED_AT.toISOString() }, db.client),
      service.update(`${kind}-1`, { title: "Teine", expectedUpdatedAt: BASE_UPDATED_AT.toISOString() }, db.client)
    ]);
    assert.equal(outcomes.filter((item) => item.status === "fulfilled").length, 1, `${kind}: üks võitja`);
    const rejected = outcomes.find((item) => item.status === "rejected");
    assert.match(String(rejected?.reason?.code || ""), /_CONFLICT$/, `${kind}: stale kaotaja on konflikt`);
    assert.equal(rejected?.reason?.current?.id, `${kind}-1`, `${kind}: konflikt kannab värsket kirjet`);
  }
});

test("SOL-HELP-03: expectedUpdatedAt on kohustuslik ja peab olema kehtiv", async () => {
  for (const kind of ["request", "offer"]) {
    for (const expectedUpdatedAt of [undefined, null, "not-a-date"]) {
      const db = createHelpDb({ kind });
      await assert.rejects(
        servicesFor(kind).update(`${kind}-1`, { title: "Parandus", expectedUpdatedAt }, db.client),
        (error) => /EXPECTED_UPDATED_AT_(REQUIRED|INVALID)$/.test(String(error?.code || ""))
      );
    }
  }
});

const TRANSITIONS = Object.freeze({
  PUBLISH: { from: ["DRAFT"], to: "OPEN" },
  MARK_MATCHED: { from: ["OPEN"], to: "MATCHED" },
  CLOSE: { from: ["OPEN", "MATCHED"], to: "CLOSED" },
  CANCEL: { from: ["DRAFT", "OPEN"], to: "CANCELLED" },
  ARCHIVE: { from: ["MATCHED", "CLOSED", "CANCELLED"], to: "ARCHIVED" },
  REOPEN: { from: ["CLOSED", "CANCELLED"], to: "OPEN" }
});

test("SOL-HELP-04: üld-PATCH ei võta vastu ühtegi status-väärtust", async () => {
  for (const kind of ["request", "offer"]) {
    for (const status of ["DRAFT", "OPEN", "MATCHED", "CLOSED", "CANCELLED", "ARCHIVED"]) {
      const db = createHelpDb({ kind });
      await assert.rejects(
        servicesFor(kind).update(`${kind}-1`, { status, expectedUpdatedAt: BASE_UPDATED_AT.toISOString() }, db.client),
        (error) => /STATUS_PATCH_INVALID$/.test(String(error?.code || "")),
        `${kind}: üld-PATCH status=${status}`
      );
    }
  }
});

test("SOL-HELP-04: nimetatud toimingud järgivad olekumasinat ja kirjutavad põhjusega auditi", async () => {
  for (const kind of ["request", "offer"]) {
    const transition = servicesFor(kind).transition;
    assert.equal(typeof transition, "function", `${kind}: nimetatud olekutoiming puudub`);
    for (const [action, rule] of Object.entries(TRANSITIONS)) {
      for (const sourceStatus of rule.from) {
        const db = createHelpDb({
          kind,
          record: listingRecord(kind, { status: sourceStatus }),
          entry: mapEntry(kind, { status: sourceStatus === "DRAFT" ? "DRAFT" : "HIDDEN" })
        });
        const updated = await transition(`${kind}-1`, {
          action,
          reason: `Põhjus ${action}`,
          expectedUpdatedAt: BASE_UPDATED_AT.toISOString()
        }, db.client);
        assert.equal(updated.status, rule.to, `${kind}: ${sourceStatus} --${action}--> ${rule.to}`);
        assert.equal(db.state.audits.length, 1, `${kind}/${action}: üks audit`);
        assert.equal(db.state.audits[0].meta.reason, `Põhjus ${action}`, `${kind}/${action}: põhjus auditis`);
      }
    }
  }
});

test("SOL-HELP-04: iga olekumasinaväline siire on keelatud", async () => {
  const statuses = ["DRAFT", "OPEN", "MATCHED", "CLOSED", "CANCELLED", "ARCHIVED"];
  for (const kind of ["request", "offer"]) {
    const transition = servicesFor(kind).transition;
    assert.equal(typeof transition, "function", `${kind}: nimetatud olekutoiming puudub`);
    for (const [action, rule] of Object.entries(TRANSITIONS)) {
      for (const sourceStatus of statuses.filter((status) => !rule.from.includes(status))) {
        const db = createHelpDb({ kind, record: listingRecord(kind, { status: sourceStatus }) });
        await assert.rejects(
          transition(`${kind}-1`, {
            action,
            reason: "Lubamatu siirde kontroll",
            expectedUpdatedAt: BASE_UPDATED_AT.toISOString()
          }, db.client),
          (error) => /TRANSITION_CONFLICT$/.test(String(error?.code || "")),
          `${kind}: ${sourceStatus} --${action}--> keelatud`
        );
        assert.equal(db.state.audits.length, 0, `${kind}: keelatud siire ei auditeeri edu`);
      }
    }
  }
});

test("SOL-HELP-04: nimetatud olekutoiming nõuab põhjust", async () => {
  for (const kind of ["request", "offer"]) {
    const db = createHelpDb({ kind, record: listingRecord(kind, { status: "OPEN" }) });
    await assert.rejects(
      servicesFor(kind).transition(`${kind}-1`, {
        action: "CLOSE",
        expectedUpdatedAt: BASE_UPDATED_AT.toISOString()
      }, db.client),
      (error) => /TRANSITION_REASON_REQUIRED$/.test(String(error?.code || ""))
    );
  }
});

test("SOL-HELP-11: iga kasutajateksti väli lubab piiri ja lükkab +1 terviklikult tagasi", async () => {
  const fieldsByKind = {
    request: ["title", "description", "structuredSummary", "roleLabel", "beneficiaryLabel", "urgency", "availabilityOrStart", "compensationDetails", "conditions", "skillsOrBackground", "rawPlace"],
    offer: ["title", "description", "structuredSummary", "roleLabel", "providerScopeOrConditions", "availabilityOrStart", "compensationDetails", "conditions", "skillsOrBackground", "rawPlace"]
  };
  for (const kind of ["request", "offer"]) {
    for (const field of fieldsByKind[kind]) {
      const limit = HELP_LISTING_TEXT_LIMITS[field];
      for (const length of [limit - 1, limit]) {
        const db = createHelpDb({ kind });
        await servicesFor(kind).update(`${kind}-1`, {
          [field]: "x".repeat(length),
          expectedUpdatedAt: BASE_UPDATED_AT.toISOString()
        }, db.client);
        const row = (kind === "request" ? db.state.requests : db.state.offers)[0];
        assert.equal(row[field].length, length, `${kind}/${field}/${length}`);
      }

      const db = createHelpDb({ kind });
      const marker = "!";
      const tooLong = `${"x".repeat(limit)}${marker}`;
      await assert.rejects(
        servicesFor(kind).update(`${kind}-1`, {
          [field]: tooLong,
          expectedUpdatedAt: BASE_UPDATED_AT.toISOString()
        }, db.client),
        (error) => (
          error?.code === "HELP_LISTING_FIELD_TOO_LONG"
          && error?.field === field
          && error?.limit === limit
          && error?.actual === tooLong.length
        ),
        `${kind}/${field}: +1 peab andma väljapõhise vea`
      );
      const row = (kind === "request" ? db.state.requests : db.state.offers)[0];
      assert.doesNotMatch(String(row[field] || ""), new RegExp(marker), `${kind}/${field}: saba ei tohi kärbitult salvestuda`);
    }
  }
});

test("detail-PATCH leping nõuab revisjoni, eristab nimetatud olekutoimingu ja tagastab 409 värske vaate", () => {
  const route = readFileSync("app/api/help/listings/[kind]/[id]/route.js", "utf8");
  assert.match(route, /expectedUpdatedAt/);
  assert.match(route, /statusAction/);
  assert.match(route, /\b409\b/);
  assert.match(route, /current/);
  assert.match(route, /HELP_LISTING_FIELD_TOO_LONG/);
  assert.match(route, /\b413\b/);
});

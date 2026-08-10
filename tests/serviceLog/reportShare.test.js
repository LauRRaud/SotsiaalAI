import assert from "node:assert/strict";
import test from "node:test";

import { listShareRecipients } from "../../lib/serviceLog/reportShare.js";

/**
 * SOL-SLOG-13 ja -14 — kes tohib saada kliendinimede, teenuste, mahtude ja
 * märkmetega kuuaruande.
 *
 * MIKS SEE FAKE HINDAB `AND`/`OR`-i PÄRISELT. Mõlemad leiud on VAIKSELT KADUNUD
 * TINGIMUSED: SLOG-14 kaotas `validUntil` kontrolli objektivõtme ülekirjutamisega,
 * SLOG-13 lasi capability't asendada pelga juhiseosega. Fake, mis `where`-i sisu
 * ära neelab, annaks mõlemal juhul sama vastuse nii vana kui uue koodiga — ta
 * tõendaks oma puudust. Seepärast on siin päris avaldise-hindaja.
 */

function evaluate(row, where, resolve) {
  if (!where) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === "AND") return condition.every((branch) => evaluate(row, branch, resolve));
    if (key === "OR") return condition.some((branch) => evaluate(row, branch, resolve));
    if (key === "NOT") return !evaluate(row, condition, resolve);

    const related = resolve?.(key, row);
    if (related !== undefined) return related === null ? false : evaluate(related, condition, resolve);

    const value = row[key];
    if (condition === null) return value === null || value === undefined;
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if ("in" in condition) return condition.in.includes(value);
      if ("lte" in condition) return value != null && new Date(value) <= new Date(condition.lte);
      if ("lt" in condition) return value != null && new Date(value) < new Date(condition.lt);
      if ("gte" in condition) return value != null && new Date(value) >= new Date(condition.gte);
      if ("gt" in condition) return value != null && new Date(value) > new Date(condition.gt);
      if ("not" in condition) return value !== condition.not;
      throw new Error(`fake ei tunne operaatorit: ${JSON.stringify(condition)}`);
    }
    return value === condition;
  });
}

const NOW = new Date("2026-08-10T12:00:00Z");
const YESTERDAY = new Date("2026-08-09T12:00:00Z");
const LAST_MONTH = new Date("2026-07-01T00:00:00Z");
const NEXT_YEAR = new Date("2027-08-10T12:00:00Z");

function membership(overrides = {}) {
  return {
    id: "m_tootaja",
    userId: "user_tootaja",
    organizationId: "org_a",
    status: "ACTIVE",
    jobTitle: "Sotsiaaltöötaja",
    organization: { id: "org_a", displayName: "Harku vald" },
    units: [{ unitId: "unit_1", isPrimary: true, endedAt: null }],
    user: { id: "user_tootaja", email: "tootaja@example.test", profile: { firstName: "Mari", lastName: "Mets" } },
    ...overrides
  };
}

function createDb({ memberships = [], reportingLines = [], grants = [] } = {}) {
  const byId = new Map(memberships.map((row) => [row.id, row]));
  const resolveMembership = (key, row) => {
    if (key === "membership") return byId.get(row.membershipId) || null;
    return undefined;
  };
  return {
    organizationMembership: {
      async findMany({ where }) {
        return memberships.filter((row) => evaluate(row, where)).map((row) => ({ ...row }));
      }
    },
    organizationReportingLine: {
      async findMany({ where }) {
        return reportingLines
          .filter((row) => evaluate(row, where))
          .map((row) => ({ ...row, manager: byId.get(row.managerMembershipId) || null }));
      }
    },
    organizationCapabilityGrant: {
      async findMany({ where }) {
        return grants
          .filter((row) => evaluate(row, where, resolveMembership))
          .map((row) => ({ ...row, membership: byId.get(row.membershipId) || null }));
      }
    }
  };
}

const leadMembership = membership({
  id: "m_juht",
  userId: "user_juht",
  jobTitle: "Osakonna juhataja",
  user: { id: "user_juht", email: "juht@example.test", profile: { firstName: "Tiit", lastName: "Tamm" } }
});

const grant = (overrides = {}) => ({
  id: "grant_1",
  capability: "UNIT_LEAD",
  membershipId: "m_juht",
  scopeType: "UNIT",
  scopeUnitId: "unit_1",
  revokedAt: null,
  validFrom: LAST_MONTH,
  validUntil: null,
  ...overrides
});

const reportingLine = (overrides = {}) => ({
  id: "line_1",
  memberMembershipId: "m_tootaja",
  managerMembershipId: "m_juht",
  validFrom: LAST_MONTH,
  validUntil: null,
  ...overrides
});

test("kehtiv üksuse juht on saaja ja juhiseos annab talle täpsema nimetuse", async () => {
  const db = createDb({
    memberships: [membership(), leadMembership],
    grants: [grant()],
    reportingLines: [reportingLine()]
  });

  const recipients = await listShareRecipients("user_tootaja", { db, now: NOW });

  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].membershipId, "m_juht");
  assert.equal(recipients[0].name, "Tiit Tamm");
  /* Juhiseos ei tee teda saajaks — capability teeb. Seos ütleb ainult, et
     „juht" on täpsem sõna kui „üksuse juht". */
  assert.equal(recipients[0].relation, "manager");
});

/* SOL-SLOG-13: Prisma mudeli enda invariant ütleb, et otsese juhi seos EI ANNA
   SISUÕIGUSI ja teda ei tohi kasutada üheski capability-kontrollis. */
test("SOL-SLOG-13: juhiseos ILMA capability-ta ei anna kliendiaruande sisuõigust", async () => {
  const db = createDb({
    memberships: [membership(), leadMembership],
    grants: [],
    reportingLines: [reportingLine()]
  });

  const recipients = await listShareRecipients("user_tootaja", { db, now: NOW });

  assert.deepEqual(recipients, [], "juht ilma loata ei tohi loendis olla");
});

test("SOL-SLOG-13: teise üksuse juht ei satu saajaks juhiseose kaudu", async () => {
  const db = createDb({
    memberships: [membership(), leadMembership],
    // Luba on OLEMAS, aga ta katab teise üksuse.
    grants: [grant({ scopeUnitId: "unit_9" })],
    reportingLines: [reportingLine()]
  });

  const recipients = await listShareRecipients("user_tootaja", { db, now: NOW });
  assert.deepEqual(recipients, []);
});

/* SOL-SLOG-14: kaks `OR`-i ühes objektis — teine kirjutas esimese üle ja
   `validUntil` kontroll kadus päris Prisma WHERE-st. */
test("SOL-SLOG-14: AEGUNUD luba ei anna enam õigust", async () => {
  const db = createDb({
    memberships: [membership(), leadMembership],
    grants: [grant({ validUntil: YESTERDAY })],
    reportingLines: []
  });

  const recipients = await listShareRecipients("user_tootaja", { db, now: NOW });
  assert.deepEqual(recipients, [], "eile lõppenud luba on lõppenud luba");
});

test("SOL-SLOG-14: tulevikus algav ja tagasi võetud luba jäävad samuti välja", async () => {
  const future = createDb({
    memberships: [membership(), leadMembership],
    grants: [grant({ validFrom: NEXT_YEAR })]
  });
  assert.deepEqual(await listShareRecipients("user_tootaja", { db: future, now: NOW }), []);

  const revoked = createDb({
    memberships: [membership(), leadMembership],
    grants: [grant({ revokedAt: YESTERDAY })]
  });
  assert.deepEqual(await listShareRecipients("user_tootaja", { db: revoked, now: NOW }), []);
});

test("SOL-SLOG-14: tähtajaline aga veel kehtiv luba TÖÖTAB — kehtivuskontroll ei tohi üle pingutada", async () => {
  const db = createDb({
    memberships: [membership(), leadMembership],
    grants: [grant({ validUntil: NEXT_YEAR })]
  });

  const recipients = await listShareRecipients("user_tootaja", { db, now: NOW });
  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].relation, "unit_lead");
});

test("organisatsiooniülene ORG_OWNER katab ka ilma üksuseta töötaja", async () => {
  const owner = membership({
    id: "m_omanik",
    userId: "user_omanik",
    jobTitle: "Juhatuse liige",
    user: { id: "user_omanik", email: "omanik@example.test", profile: { firstName: "Anu", lastName: "Org" } }
  });
  const db = createDb({
    memberships: [membership({ units: [] }), owner],
    grants: [grant({ id: "grant_org", capability: "ORG_OWNER", membershipId: "m_omanik", scopeType: "ORGANIZATION", scopeUnitId: null })]
  });

  const recipients = await listShareRecipients("user_tootaja", { db, now: NOW });
  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].relation, "org_owner");
});

test("teise organisatsiooni juht ei ole saaja", async () => {
  const foreign = membership({
    id: "m_voeras",
    userId: "user_voeras",
    organizationId: "org_b",
    organization: { id: "org_b", displayName: "Teine vald" }
  });
  const db = createDb({
    memberships: [membership(), foreign],
    grants: [grant({ membershipId: "m_voeras", scopeType: "ORGANIZATION", scopeUnitId: null })]
  });

  assert.deepEqual(await listShareRecipients("user_tootaja", { db, now: NOW }), []);
});

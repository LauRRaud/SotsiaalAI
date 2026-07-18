/**
 * FIELD-V1 test database (repo convention: node:test + injected fake db, no
 * live Postgres). It models only what lib/field/service.js actually calls:
 * owner-scoped findFirst, CAS updateMany, the (visitId, clientItemId) unique
 * index and a pass-through $transaction.
 */

const clone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value), reviveDates));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
function reviveDates(key, value) {
  return typeof value === "string" && ISO_DATE.test(value) ? new Date(value) : value;
}

function matchesCondition(actual, condition) {
  if (condition && typeof condition === "object" && !(condition instanceof Date) && !Array.isArray(condition)) {
    if ("in" in condition) return condition.in.some((candidate) => matchesCondition(actual, candidate));
    if ("not" in condition) return !matchesCondition(actual, condition.not);
    if ("gt" in condition) return actual != null && new Date(actual) > new Date(condition.gt);
    if ("gte" in condition) return actual != null && new Date(actual) >= new Date(condition.gte);
    if ("lt" in condition) return actual != null && new Date(actual) < new Date(condition.lt);
    if ("lte" in condition) return actual != null && new Date(actual) <= new Date(condition.lte);
    throw new Error(`fieldDb: unsupported condition ${JSON.stringify(condition)}`);
  }
  if (condition instanceof Date) return actual != null && new Date(actual).getTime() === condition.getTime();
  return actual === condition;
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => matchesCondition(row[key], condition));
}

function applyData(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !(value instanceof Date) && "increment" in value) {
      row[key] = Number(row[key] || 0) + Number(value.increment);
    } else {
      row[key] = value;
    }
  }
  return row;
}

function project(row, select) {
  if (!row) return null;
  if (!select) return clone(row);
  const out = {};
  for (const [key, want] of Object.entries(select)) {
    if (want === true) out[key] = clone(row[key]);
  }
  return out;
}

function sortRows(rows, orderBy) {
  if (!orderBy) return rows;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      const [key, direction] = Object.entries(clause)[0];
      const left = a[key] instanceof Date ? a[key].getTime() : a[key];
      const right = b[key] instanceof Date ? b[key].getTime() : b[key];
      if (left === right) continue;
      const order = left > right ? 1 : -1;
      return direction === "desc" ? -order : order;
    }
    return 0;
  });
}

let sequence = 0;
const nextId = (prefix) => `${prefix}_${(sequence += 1).toString().padStart(4, "0")}`;

function table(rows, { idPrefix = "row", unique = null } = {}) {
  return {
    rows,
    async findFirst({ where = {}, select } = {}) {
      return project(rows.find((row) => matches(row, where)) || null, select);
    },
    async findUnique({ where = {}, select } = {}) {
      return project(rows.find((row) => matches(row, where)) || null, select);
    },
    async findMany({ where = {}, select, orderBy, take } = {}) {
      let found = rows.filter((row) => matches(row, where));
      found = sortRows(found, orderBy);
      if (take) found = found.slice(0, take);
      return found.map((row) => project(row, select));
    },
    async create({ data, select } = {}) {
      if (unique && rows.some((row) => unique.every((key) => row[key] === data[key]))) {
        const error = new Error("Unique constraint failed");
        error.code = "P2002";
        throw error;
      }
      const row = { id: data.id || nextId(idPrefix), ...data };
      rows.push(row);
      return project(row, select);
    },
    async updateMany({ where = {}, data } = {}) {
      const found = rows.filter((row) => matches(row, where));
      for (const row of found) applyData(row, data);
      return { count: found.length };
    },
    async update({ where = {}, data, select } = {}) {
      const row = rows.find((candidate) => matches(candidate, where));
      if (!row) {
        const error = new Error("Record to update not found");
        error.code = "P2025";
        throw error;
      }
      applyData(row, data);
      return project(row, select);
    },
    async deleteMany({ where = {} } = {}) {
      const keep = rows.filter((row) => !matches(row, where));
      const removed = rows.length - keep.length;
      rows.length = 0;
      rows.push(...keep);
      return { count: removed };
    },
    async count({ where = {} } = {}) {
      return rows.filter((row) => matches(row, where)).length;
    }
  };
}

export function createFieldDb({
  visits = [],
  notes = [],
  attachments = [],
  preInquiries = [],
  artifacts = [],
  documents = []
} = {}) {
  const store = { visits, notes, attachments, preInquiries, artifacts, documents };
  const db = {
    store,
    async $transaction(callback) {
      return typeof callback === "function" ? callback(db) : Promise.all(callback);
    },
    fieldVisit: table(visits, { idPrefix: "visit" }),
    fieldVisitNote: table(notes, { idPrefix: "note", unique: ["visitId", "clientItemId"] }),
    fieldVisitAttachment: table(attachments, { idPrefix: "att", unique: ["visitId", "clientItemId"] }),
    preInquiry: table(preInquiries, { idPrefix: "inq" }),
    agentArtifact: table(artifacts, { idPrefix: "artifact" }),
    userDocument: table(documents, { idPrefix: "doc" })
  };
  return db;
}

export function makeVisit(overrides = {}) {
  const now = new Date("2026-07-18T10:00:00.000Z");
  return {
    id: "visit-1",
    ownerUserId: "user-1",
    status: "IN_PROGRESS",
    version: 1,
    goal: "Kodukülastus",
    locationText: "Näidise tänav 1",
    plannedStartAt: now,
    plannedEndAt: now,
    preInquiryId: null,
    packKeyQuestions: [],
    packSummaryText: null,
    packTakenAt: null,
    packSourceUpdatedAt: null,
    arrivedConfirmedAt: null,
    departedConfirmedAt: null,
    safetyArmedAt: null,
    safetyDeadlineAt: null,
    safetyContactName: null,
    safetyContactEmail: null,
    safetyInstructions: null,
    safetyRemindedAt: null,
    safetyEscalatedAt: null,
    safetyEscalationAttempts: 0,
    safetyEscalationNextAttemptAt: null,
    safetyEscalationStatus: null,
    safetyResolvedNotifiedAt: null,
    safetyCancelledAt: null,
    handoverArtifactAt: null,
    handoverPreInquiryAt: null,
    closedAt: null,
    cancelledAt: null,
    retentionClass: "standard90",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

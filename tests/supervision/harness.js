/**
 * In-memory Prisma double for the supervision service layer (lib/supervision/**).
 * Supports the query shapes those services issue: where matching with
 * OR/AND/NOT/in/notIn/gt/gte/lt/lte/has, null-checks, @default columns, partial
 * unique constraints (throwing P2002), a small set of include relations, and
 * transactional rollback. NOT a general Prisma emulator — only what the
 * supervision services use. Mirrors tests/mentoring/harness.js.
 */

let idCounter = 0;
// Monotoonne kell: iga create/update saab rangelt kasvava ajatempli, et
// updatedAt/createdAt järjekord oleks testides deterministlik (päris @updatedAt
// peegel). Algab fikseeritud hetkest, et jooksud oleks korratavad.
let clockMs = Date.parse("2026-07-01T00:00:00.000Z");
function tick() {
  clockMs += 1;
  return new Date(clockMs);
}
export function resetIds() {
  idCounter = 0;
  clockMs = Date.parse("2026-07-01T00:00:00.000Z");
}

// Tabelid, mille mudelil on @updatedAt (peab create'il ja update'il uuenema).
const HAS_UPDATED_AT = new Set([
  "supervisorGrant", "supervisionProcess", "supervisionParticipation", "supervisionPrivateItem",
  "supervisionSharedTopic", "supervisionMeeting", "supervisionSummary", "wellbeingOutputDraft"
]);
function nextId(prefix) {
  idCounter += 1;
  // No underscore: notification source/target ids must match SAFE_ID
  // (/^[A-Za-z0-9._:-]+$/), mirroring real cuid() output.
  return `${prefix}${idCounter}`;
}

function toTime(value) {
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.getTime() : NaN;
}

const OPERATORS = ["not", "in", "notIn", "gt", "gte", "lt", "lte", "has"];

function matchOperators(rowVal, cond) {
  for (const [op, v] of Object.entries(cond)) {
    if (op === "not") {
      if (v === null) {
        if (rowVal === null || rowVal === undefined) return false;
      } else if (rowVal === v) {
        return false;
      }
    } else if (op === "in") {
      if (!v.includes(rowVal)) return false;
    } else if (op === "notIn") {
      if (v.includes(rowVal)) return false;
    } else if (op === "gt") {
      if (!(toTime(rowVal) > toTime(v))) return false;
    } else if (op === "gte") {
      if (!(toTime(rowVal) >= toTime(v))) return false;
    } else if (op === "lt") {
      if (!(toTime(rowVal) < toTime(v))) return false;
    } else if (op === "lte") {
      if (!(toTime(rowVal) <= toTime(v))) return false;
    } else if (op === "has") {
      if (!Array.isArray(rowVal) || !rowVal.includes(v)) return false;
    } else {
      return false;
    }
  }
  return true;
}

function isOperatorObject(cond) {
  if (!cond || typeof cond !== "object" || cond instanceof Date || Array.isArray(cond)) return false;
  const keys = Object.keys(cond);
  return keys.length > 0 && keys.every((key) => OPERATORS.includes(key));
}

function matchWhere(row, where) {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      if (!cond.some((sub) => matchWhere(row, sub))) return false;
      continue;
    }
    if (key === "AND") {
      if (!cond.every((sub) => matchWhere(row, sub))) return false;
      continue;
    }
    if (key === "NOT") {
      if (matchWhere(row, cond)) return false;
      continue;
    }
    const rowVal = row[key];
    if (cond === null) {
      if (rowVal !== null && rowVal !== undefined) return false;
    } else if (isOperatorObject(cond)) {
      if (!matchOperators(rowVal, cond)) return false;
    } else if (cond instanceof Date) {
      if (toTime(rowVal) !== cond.getTime()) return false;
    } else if (rowVal instanceof Date) {
      if (toTime(rowVal) !== toTime(cond)) return false;
    } else if (rowVal !== cond) {
      return false;
    }
  }
  return true;
}

function applyOrderBy(rows, orderBy) {
  if (!orderBy) return rows;
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const clause of clauses) {
      const [field, dir] = Object.entries(clause)[0];
      const av = a[field];
      const bv = b[field];
      const at = av instanceof Date ? av.getTime() : av;
      const bt = bv instanceof Date ? bv.getTime() : bv;
      if (at === bt) continue;
      if (at === undefined || at === null) return dir === "desc" ? 1 : -1;
      if (bt === undefined || bt === null) return dir === "desc" ? -1 : 1;
      const cmp = at > bt ? 1 : -1;
      return dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

// Partial-unique constraints enforced in create()/update(). when(row) decides
// whether the row participates in the index (mirrors Postgres partial unique).
const UNIQUE_INDEXES = {
  supervisionProcess: [
    { fields: ["activeContractVersionId"], when: (r) => r.activeContractVersionId != null }
  ],
  supervisionContractVersion: [
    { fields: ["processId", "versionNumber"], when: () => true }
  ],
  supervisionParticipation: [
    { fields: ["processId", "userId"], when: () => true }
  ],
  supervisionContractAcceptance: [
    { fields: ["participationId", "contractVersionId"], when: () => true }
  ],
  supervisionPrivateItem: [
    { fields: ["sourceWellbeingDraftId"], when: (r) => r.sourceWellbeingDraftId != null }
  ],
  supervisionMeeting: [
    { fields: ["processId", "seq"], when: () => true }
  ],
  supervisionSummary: [
    { fields: ["meetingId"], when: (r) => r.meetingId != null && r.status !== "DISCARDED" },
    { fields: ["processId"], when: (r) => r.kind === "FINAL" && r.status !== "DISCARDED" }
  ],
  supervisionSummaryApproval: [
    { fields: ["summaryId", "participationId"], when: () => true }
  ],
  supervisionClosure: [
    { fields: ["processId"], when: () => true }
  ],
  supervisionPersonalOutcome: [
    { fields: ["processId", "ownerUserId"], when: (r) => r.processId != null }
  ],
  notificationEvent: [
    { fields: ["dedupeKey"], when: () => true }
  ]
};

const DEFAULTS = {
  supervisorGrant: { revokedAt: null, validUntil: null },
  supervisionProcess: {
    status: "DRAFT", plannedMeetingCount: 5, version: 0, activeContractVersionId: null, closedAt: null
  },
  supervisionContractVersion: { status: "DRAFT", activatedAt: null },
  supervisionParticipation: { status: "INVITED", respondedAt: null, leftAt: null },
  supervisionPrivateItem: { sourceKind: "MANUAL", version: 0, sharedTopicId: null, sourceWellbeingDraftId: null },
  supervisionSharedTopic: { status: "SHARED", version: 0, withdrawnAt: null },
  supervisionMeeting: {
    status: "PLANNED", agendaTopicIds: [], version: 0, plannedAt: null, heldAt: null,
    note: null, topicCountAtClose: null, markedHeldByUserId: null
  },
  supervisionSummary: {
    status: "DRAFT", version: 0, meetingId: null, submittedAt: null, approvedAt: null
  },
  supervisionClosure: { retentionStatus: "AWAITING_POLICY" }
};

const STORE_TABLES = [
  "user",
  "supervisorGrant",
  "supervisionProcess",
  "supervisionContractVersion",
  "supervisionParticipation",
  "supervisionContractAcceptance",
  "supervisionPrivateItem",
  "supervisionSharedTopic",
  "supervisionMeeting",
  "supervisionSummary",
  "supervisionSummaryApproval",
  "supervisionClosure",
  "supervisionPersonalOutcome",
  "supervisionAuditEvent",
  "notificationEvent",
  "wellbeingOutputDraft"
];

const ID_PREFIX = {
  user: "user",
  supervisorGrant: "grant",
  supervisionProcess: "proc",
  supervisionContractVersion: "ctr",
  supervisionParticipation: "part",
  supervisionContractAcceptance: "acc",
  supervisionPrivateItem: "priv",
  supervisionSharedTopic: "topic",
  supervisionMeeting: "meet",
  supervisionSummary: "sum",
  supervisionSummaryApproval: "appr",
  supervisionClosure: "clo",
  supervisionPersonalOutcome: "pack",
  supervisionAuditEvent: "audit",
  notificationEvent: "notif",
  wellbeingOutputDraft: "draft"
};

function reviveDates(row) {
  const out = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)) {
      const d = new Date(v);
      if (Number.isFinite(d.getTime())) out[k] = d;
    }
  }
  return out;
}

export function createSupervisionDb() {
  const store = {};
  for (const table of STORE_TABLES) store[table] = [];
  const calls = { advisoryLocks: 0, transactions: 0, rollbacks: 0 };

  function checkUnique(table, candidate, ignoreId = null) {
    const indexes = UNIQUE_INDEXES[table] || [];
    for (const index of indexes) {
      if (!index.when(candidate)) continue;
      const clash = store[table].some((row) => {
        if (row.id === ignoreId) return false;
        if (!index.when(row)) return false;
        return index.fields.every((field) => row[field] === candidate[field]);
      });
      if (clash) {
        const error = new Error(`Unique constraint failed on ${table}`);
        error.code = "P2002";
        throw error;
      }
    }
  }

  function applyDataUpdate(row, data) {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && !(value instanceof Date) && !Array.isArray(value) && "increment" in value) {
        row[key] = (row[key] || 0) + value.increment;
      } else {
        row[key] = value;
      }
    }
  }

  function projectSelect(row, select) {
    const out = {};
    for (const [k, v] of Object.entries(select)) {
      if (v === true) out[k] = row[k];
    }
    return out;
  }

  function makeTable(table) {
    const prefix = ID_PREFIX[table] || table;
    return {
      async findFirst({ where, orderBy, select } = {}) {
        let rows = store[table].filter((row) => matchWhere(row, where));
        rows = applyOrderBy(rows, orderBy);
        const row = rows[0] || null;
        if (!row) return null;
        return select ? projectSelect(row, select) : { ...row };
      },
      async findUnique({ where, select } = {}) {
        // where may be { id } or a single-field unique
        const row = store[table].find((r) => matchWhere(r, where)) || null;
        if (!row) return null;
        return select ? projectSelect(row, select) : { ...row };
      },
      async findMany({ where, orderBy, take, select } = {}) {
        let rows = store[table].filter((row) => matchWhere(row, where));
        rows = applyOrderBy(rows, orderBy);
        if (take) rows = rows.slice(0, take);
        return rows.map((row) => (select ? projectSelect(row, select) : { ...row }));
      },
      async count({ where } = {}) {
        return store[table].filter((row) => matchWhere(row, where)).length;
      },
      async create({ data }) {
        const row = { id: data.id || nextId(prefix), ...(DEFAULTS[table] || {}), ...data };
        for (const [k, v] of Object.entries(row)) {
          if (v && typeof v === "object" && !(v instanceof Date) && !Array.isArray(v) && "increment" in v) {
            row[k] = v.increment;
          }
        }
        // @default(now)/@updatedAt peegel: sea ajatemplid, kui teenus neid ei andnud.
        if (table !== "user" && row.createdAt === undefined) row.createdAt = tick();
        if (HAS_UPDATED_AT.has(table) && row.updatedAt === undefined) row.updatedAt = tick();
        checkUnique(table, row);
        store[table].push(row);
        return { ...row };
      },
      async update({ where, data }) {
        const row = store[table].find((r) => r.id === where.id);
        if (!row) {
          const error = new Error("Record not found");
          error.code = "P2025";
          throw error;
        }
        const candidate = { ...row };
        applyDataUpdate(candidate, data);
        checkUnique(table, candidate, row.id);
        applyDataUpdate(row, data);
        // @updatedAt peegel: iga update tõstab updatedAt-i, kui seda ei antud käsitsi.
        if (HAS_UPDATED_AT.has(table) && data.updatedAt === undefined) row.updatedAt = tick();
        return { ...row };
      },
      async updateMany({ where, data }) {
        const rows = store[table].filter((row) => matchWhere(row, where));
        for (const row of rows) {
          const candidate = { ...row };
          applyDataUpdate(candidate, data);
          checkUnique(table, candidate, row.id);
        }
        for (const row of rows) applyDataUpdate(row, data);
        return { count: rows.length };
      },
      async delete({ where }) {
        const idx = store[table].findIndex((r) => r.id === where.id);
        if (idx === -1) {
          const error = new Error("Record not found");
          error.code = "P2025";
          throw error;
        }
        const [removed] = store[table].splice(idx, 1);
        return { ...removed };
      },
      async deleteMany({ where } = {}) {
        const kept = [];
        let count = 0;
        for (const row of store[table]) {
          if (matchWhere(row, where)) count += 1;
          else kept.push(row);
        }
        store[table] = kept;
        return { count };
      }
    };
  }

  const db = { store, calls };
  for (const table of STORE_TABLES) db[table] = makeTable(table);

  db.$executeRaw = async () => {
    calls.advisoryLocks += 1;
    return 1;
  };
  db.$transaction = async (arg) => {
    calls.transactions += 1;
    const snapshot = JSON.parse(JSON.stringify(store));
    const idBefore = idCounter;
    try {
      if (typeof arg === "function") return await arg(db);
      // array form
      return await Promise.all(arg);
    } catch (error) {
      for (const key of Object.keys(store)) {
        store[key] = (snapshot[key] || []).map((row) => reviveDates(row));
      }
      idCounter = idBefore;
      calls.rollbacks += 1;
      throw error;
    }
  };
  return db;
}

export function seedUser(db, id, role = "SOCIAL_WORKER", overrides = {}) {
  const user = {
    id,
    email: `${id}@example.test`,
    role,
    isAdmin: role === "ADMIN",
    notificationEmailEnabled: false,
    ...overrides
  };
  db.store.user.push(user);
  return user;
}

export function adminSession(userId = "admin1") {
  return { user: { id: userId, role: "ADMIN", isAdmin: true } };
}

export function memberSession(userId, role = "SOCIAL_WORKER") {
  return { user: { id: userId, role } };
}

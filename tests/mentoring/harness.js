/**
 * Lightweight in-memory Prisma double for the mentoring service layer.
 * Supports the exact query shapes lib/mentoring/** issues: where matching with
 * OR/not/in/gt/gte/lt/lte/has, one-level relation filters, partial unique
 * constraints (throwing P2002), include for confirmations, and transactional
 * rollback. It is NOT a general Prisma emulator — only what these services use.
 */

let idCounter = 0;
export function resetIds() {
  idCounter = 0;
}
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

const RELATION_KEYS = new Set(["relation", "mentorProfile", "providerProfile", "confirmations"]);

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
  return Object.keys(cond).every((key) =>
    ["not", "in", "notIn", "gt", "gte", "lt", "lte", "has"].includes(key)
  );
}

export function createMentoringDb() {
  const store = {
    user: [],
    mentorProfile: [],
    mentoringRequest: [],
    mentoringRelation: [],
    mentoringAgreementAcceptance: [],
    mentoringMeeting: [],
    mentoringSummary: [],
    mentoringSummaryConfirmation: [],
    mentoringPrivateNote: [],
    mentoringAuditEvent: [],
    notificationEvent: [],
    wellbeingOutputDraft: [],
    room: [],
    roomMember: []
  };
  const uniqueIndexes = {
    // partial unique — enforced in create()
    mentoringRequest: [
      { fields: ["menteeId", "mentorUserId"], when: (row) => row.status === "PENDING" }
    ],
    mentoringRelation: [
      { fields: ["mentorUserId", "menteeUserId"], when: (row) => row.status !== "CLOSED" }
    ],
    mentoringAgreementAcceptance: [
      { fields: ["relationId", "userId", "agreementVersion"], when: () => true }
    ],
    mentoringSummaryConfirmation: [
      { fields: ["summaryId", "userId"], when: () => true }
    ],
    mentoringPrivateNote: [
      { fields: ["sourceDraftId"], when: (row) => row.sourceDraftId != null }
    ],
    mentorProfile: [
      { fields: ["externalSlug"], when: (row) => row.externalSlug != null },
      { fields: ["userId"], when: (row) => row.userId != null }
    ],
    notificationEvent: [
      { fields: ["dedupeKey"], when: () => true }
    ]
  };

  // Column defaults that Prisma would apply (@default). The fake must mirror
  // these so services that read back version/status/arrays behave correctly.
  const defaults = {
    mentorProfile: {
      origin: "SELF", status: "DRAFT", capacity: "OPEN", contactDisplayAllowed: false, version: 0,
      fields: [], topics: [], languages: [], formats: []
    },
    mentoringRequest: { status: "PENDING", version: 0 },
    mentoringRelation: { status: "DRAFT", agreementVersion: 0, version: 0 },
    mentoringMeeting: { mode: "EXTERNAL", status: "PLANNED", version: 0 },
    mentoringSummary: { kind: "MEETING", status: "DRAFT", version: 0 },
    mentoringPrivateNote: { kind: "NOTE", version: 0 },
    mentoringAgreementAcceptance: { locale: "et" }
  };

  const calls = { advisoryLocks: 0, transactions: 0, rollbacks: 0 };

  function resolveRelation(table, key, row) {
    if (key === "relation") {
      return store.mentoringRelation.find((r) => r.id === row.relationId) || null;
    }
    if (key === "mentorProfile") {
      return store.mentorProfile.find((p) => p.id === row.mentorProfileId) || null;
    }
    if (key === "room") return store.room.find((room) => room.id === row.roomId) || null;
    if (key === "providerProfile") return null;
    return null;
  }

  function matchWhere(table, row, where) {
    if (!where) return true;
    for (const [key, cond] of Object.entries(where)) {
      if (key === "OR") {
        if (!cond.some((sub) => matchWhere(table, row, sub))) return false;
        continue;
      }
      if (key === "AND") {
        if (!cond.every((sub) => matchWhere(table, row, sub))) return false;
        continue;
      }
      if (key === "NOT") {
        if (matchWhere(table, row, cond)) return false;
        continue;
      }
      if (RELATION_KEYS.has(key) && cond && typeof cond === "object" && !Array.isArray(cond)) {
        if (key === "confirmations") {
          const rows = store.mentoringSummaryConfirmation.filter((c) => c.summaryId === row.id);
          if (cond.none) {
            if (rows.some((r) => matchWhere("mentoringSummaryConfirmation", r, cond.none))) return false;
          }
          if (cond.some) {
            if (!rows.some((r) => matchWhere("mentoringSummaryConfirmation", r, cond.some))) return false;
          }
          continue;
        }
        const related = resolveRelation(table, key, row);
        if (!related || !matchWhere(key, related, cond)) return false;
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
        const cmp = at > bt ? 1 : -1;
        return dir === "desc" ? -cmp : cmp;
      }
      return 0;
    });
  }

  function withIncludes(table, row, include) {
    if (!row || !include) return row ? { ...row } : row;
    const out = { ...row };
    if (include.confirmations) {
      out.confirmations = store.mentoringSummaryConfirmation.filter((c) => c.summaryId === row.id).map((c) => ({ ...c }));
    }
    if (include.mentorProfile) {
      const p = store.mentorProfile.find((mp) => mp.id === row.mentorProfileId);
      out.mentorProfile = p ? { ...p } : null;
    }
    if (include.mentee) {
      const u = store.user.find((usr) => usr.id === row.menteeId);
      out.mentee = u ? { ...u } : null;
    }
    if (include.mentorUser) {
      const u = store.user.find((usr) => usr.id === row.mentorUserId);
      out.mentorUser = u ? { ...u } : null;
    }
    if (include.menteeUser) {
      const u = store.user.find((usr) => usr.id === row.menteeUserId);
      out.menteeUser = u ? { ...u } : null;
    }
    if (include.agreementAcceptances) {
      out.agreementAcceptances = store.mentoringAgreementAcceptance
        .filter((a) => a.relationId === row.id && matchWhere("mentoringAgreementAcceptance", a, include.agreementAcceptances.where))
        .map((a) => ({ ...a }));
    }
    if (include.meetings) {
      let rows = store.mentoringMeeting.filter((m) => m.relationId === row.id);
      if (include.meetings.where) rows = rows.filter((m) => matchWhere("mentoringMeeting", m, include.meetings.where));
      rows = applyOrderBy(rows, include.meetings.orderBy);
      if (include.meetings.take) rows = rows.slice(0, include.meetings.take);
      out.meetings = rows.map((m) => ({ ...m }));
    }
    return out;
  }

  function checkUnique(table, candidate, ignoreId = null) {
    const indexes = uniqueIndexes[table] || [];
    for (const index of indexes) {
      if (!index.when(candidate)) continue;
      const clash = store[table].some((row) => {
        if (row.id === ignoreId) return false;
        if (!index.when(row)) return false;
        return index.fields.every((field) => row[field] === candidate[field]);
      });
      if (clash) {
        const error = new Error("Unique constraint failed");
        error.code = "P2002";
        throw error;
      }
    }
  }

  function applyDataUpdate(row, data) {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === "object" && !(value instanceof Date) && "increment" in value) {
        row[key] = (row[key] || 0) + value.increment;
      } else {
        row[key] = value;
      }
    }
  }

  function makeTable(table, idPrefix) {
    return {
      async findFirst({ where, include, orderBy, select } = {}) {
        let rows = store[table].filter((row) => matchWhere(table, row, where));
        rows = applyOrderBy(rows, orderBy);
        const row = rows[0] || null;
        if (!row) return null;
        if (include) return withIncludes(table, row, include);
        if (select) {
          return Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]]));
        }
        return { ...row };
      },
      async findUnique({ where, include, select } = {}) {
        return this.findFirst({ where, include, select });
      },
      async findMany({ where, include, orderBy, take, select } = {}) {
        let rows = store[table].filter((row) => matchWhere(table, row, where));
        rows = applyOrderBy(rows, orderBy);
        if (take) rows = rows.slice(0, take);
        return rows.map((row) => {
          if (include) return withIncludes(table, row, include);
          if (select) {
            const base = Object.fromEntries(Object.keys(select).filter((k) => select[k] === true).map((k) => [k, row[k]]));
            // nested select for relations used by continuity
            for (const [k, v] of Object.entries(select)) {
              if (v && typeof v === "object") {
                if (k === "agreementAcceptances") {
                  base[k] = store.mentoringAgreementAcceptance
                    .filter((a) => a.relationId === row.id && matchWhere("mentoringAgreementAcceptance", a, v.where))
                    .map((a) => ({ agreementVersion: a.agreementVersion }));
                } else if (k === "relation") {
                  const relation = store.mentoringRelation.find((candidate) => candidate.id === row.relationId);
                  base[k] = relation
                    ? Object.fromEntries(Object.keys(v.select || {}).filter((field) => v.select[field] === true).map((field) => [field, relation[field]]))
                    : null;
                }
              }
            }
            return base;
          }
          return { ...row };
        });
      },
      async count({ where } = {}) {
        return store[table].filter((row) => matchWhere(table, row, where)).length;
      },
      async create({ data }) {
        const row = { id: data.id || nextId(idPrefix), ...(defaults[table] || {}), ...data };
        for (const [k, v] of Object.entries(row)) {
          if (v && typeof v === "object" && !(v instanceof Date) && "increment" in v) {
            row[k] = v.increment;
          }
        }
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
        applyDataUpdate(row, data);
        return { ...row };
      },
      async updateMany({ where, data }) {
        const rows = store[table].filter((row) => matchWhere(table, row, where));
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
          if (matchWhere(table, row, where)) count += 1;
          else kept.push(row);
        }
        store[table] = kept;
        return { count };
      }
    };
  }

  const db = {
    store,
    calls,
    user: makeTable("user", "user"),
    mentorProfile: makeTable("mentorProfile", "profile"),
    mentoringRequest: makeTable("mentoringRequest", "req"),
    mentoringRelation: makeTable("mentoringRelation", "rel"),
    mentoringAgreementAcceptance: makeTable("mentoringAgreementAcceptance", "agr"),
    mentoringMeeting: makeTable("mentoringMeeting", "meet"),
    mentoringSummary: makeTable("mentoringSummary", "sum"),
    mentoringSummaryConfirmation: makeTable("mentoringSummaryConfirmation", "conf"),
    mentoringPrivateNote: makeTable("mentoringPrivateNote", "note"),
    mentoringAuditEvent: makeTable("mentoringAuditEvent", "audit"),
    notificationEvent: makeTable("notificationEvent", "notif"),
    wellbeingOutputDraft: makeTable("wellbeingOutputDraft", "draft"),
    room: makeTable("room", "room"),
    roomMember: makeTable("roomMember", "member"),
    async $executeRaw() {
      calls.advisoryLocks += 1;
      return 1;
    },
    async $transaction(callback) {
      calls.transactions += 1;
      const snapshot = JSON.parse(JSON.stringify(store, (key, value) => value));
      const idBefore = idCounter;
      try {
        return await callback(db);
      } catch (error) {
        for (const key of Object.keys(store)) {
          store[key] = (snapshot[key] || []).map((row) => reviveDates(row));
        }
        idCounter = idBefore;
        calls.rollbacks += 1;
        throw error;
      }
    }
  };
  return db;
}

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

export function seedUser(db, id, role = "SOCIAL_WORKER", overrides = {}) {
  const user = {
    id,
    email: `${id}@example.test`,
    role,
    isAdmin: role === "ADMIN",
    notificationEmailEnabled: false,
    profile: { firstName: id, lastName: "Test" },
    ...overrides
  };
  db.store.user.push(user);
  return user;
}

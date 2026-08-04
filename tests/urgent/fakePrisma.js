// SK-V1 testide jagatud fake-prisma.
//
// NB: fake ei valideeri skeemi. Roheline sviit siin tõendab domeeniloogikat —
// ligipääsupiiri ja päris andmebaasi käitumist tõendab ainult autenditud
// läbisõit. See on kirjas ka lõpparuandes.

function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if ("in" in condition) return condition.in.includes(value);
      if ("lte" in condition) return value != null && new Date(value) <= new Date(condition.lte);
      if ("gt" in condition) return value != null && new Date(value) > new Date(condition.gt);
      if ("equals" in condition) return value === condition.equals;
      if ("not" in condition) return value !== condition.not;
    }
    return value === condition;
  });
}

export function createModel(initial = [], prefix = "row") {
  // Koopia, mitte viide: näidislaud on külmutatud ja testid peavad saama teda
  // muuta (nt „KOV muutis lugemisaega") ilma näidist rikkumata.
  const rows = initial.map((row) => ({ ...row }));
  let counter = rows.length;
  return {
    rows,
    async findFirst({ where } = {}) {
      return rows.find((row) => matches(row, where)) || null;
    },
    async findMany({ where, take } = {}) {
      const found = rows.filter((row) => matches(row, where));
      return typeof take === "number" ? found.slice(0, take) : found;
    },
    async count({ where } = {}) {
      return rows.filter((row) => matches(row, where)).length;
    },
    async create({ data }) {
      counter += 1;
      const row = { id: data.id || `${prefix}_${counter}`, ...data };
      rows.push(row);
      return { ...row };
    },
    async update({ where, data }) {
      const row = rows.find((candidate) => candidate.id === where.id);
      if (!row) throw new Error("not_found");
      Object.assign(row, data);
      return { ...row };
    }
  };
}

export const READY_DESK = Object.freeze({
  id: "desk_kov",
  municipalityId: "muni_1",
  recipientType: "KOV_CONTACT",
  publicName: "Harku valla kiireloomuline abipalve",
  ownerUserId: "desk_owner",
  serviceEntryId: null,
  openingHours: "E–P 17.00–09.00",
  whoMayContact: "Iga Harku valla elanik, ka ilma eelneva hindamiseta.",
  preAssessmentRequired: false,
  costToPerson: "Tasuta.",
  readingTimePromise: "Loeme läbi hiljemalt 2 tunni jooksul.",
  contactChannel: "Vastuvõtulaud platvormil.",
  emergencyBoundary: "Kui on vahetu oht elule või tervisele, helista 112.",
  requestLifetimeHours: 12,
  directContactAllowed: true,
  isActive: true,
  lastVerifiedAt: new Date("2026-07-01T08:00:00Z")
});

export function createPrisma({ desks = [READY_DESK], members = [{ id: "m1", deskId: "desk_kov", userId: "staff_1", isActive: true }] } = {}) {
  return {
    urgentDesk: createModel(desks, "desk"),
    urgentDeskMember: createModel(members, "member"),
    urgentRequest: createModel([], "req"),
    urgentRequestEvent: createModel([], "evt"),
    preInquiry: createModel([], "pre")
  };
}

export const NOW = new Date("2026-08-05T22:00:00Z");
export const now = () => NOW;

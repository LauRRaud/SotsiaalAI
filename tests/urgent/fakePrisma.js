// SK-V1 testide jagatud fake-prisma.
//
// NB: fake ei valideeri skeemi. Roheline sviit siin tõendab domeeniloogikat —
// ligipääsupiiri ja päris andmebaasi käitumist tõendab ainult autenditud
// läbisõit. See on kirjas ka lõpparuandes.

function compareValues(a, b) {
  if (a instanceof Date || b instanceof Date) {
    const left = new Date(a).getTime();
    const right = new Date(b).getTime();
    return left === right ? 0 : left < right ? -1 : 1;
  }
  return a === b ? 0 : a < b ? -1 : 1;
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    const value = row[key];
    if (key === "organization" && condition && typeof condition === "object") {
      return matches(row.organization || {}, condition);
    }
    if (condition && typeof condition === "object" && !(condition instanceof Date)) {
      if ("in" in condition) return condition.in.includes(value);
      if ("notIn" in condition) return !condition.notIn.includes(value);
      /* Võrdlus ei tohi eeldada kuupäeva: `id` on string ja SOL-URG-11
         lehekülgitamine küsib `id: { gt: cursor }`. `new Date("req_7")` on
         `NaN` ja iga võrdlus temaga on `false` — kursor oleks vaikselt seisma
         jäänud ja koond oleks lugenud ainult esimese lehekülje. */
      if ("lte" in condition) return value != null && compareValues(value, condition.lte) <= 0;
      if ("gt" in condition) return value != null && compareValues(value, condition.gt) > 0;
      if ("equals" in condition) return value === condition.equals;
      if ("not" in condition) return value !== condition.not;
    }
    /* SOL-URG-06: Postgresis ei ole `undefined`-it — kirjutamata veerg ON NULL.
       Fake hoidis puuduvat välja `undefined`-ina, seega `readAt: null` tingimus ei
       oleks kunagi tabanud ja tingimuslik siire oleks testis vaikselt „ei leidnud
       rida". Võrdlus peab käituma nagu andmebaas. */
    if (condition === null) return value === null || value === undefined;
    // Kuupäevad võrreldakse VÄÄRTUSE, mitte viite järgi — nagu andmebaasis.
    if (condition instanceof Date) return value instanceof Date && value.getTime() === condition.getTime();
    return value === condition;
  });
}

/**
 * SOL-URG-01 — `orderBy` ja `skip` on nüüd MODELLEERITUD.
 *
 * Varem neelas fake mõlemad alla ja `findMany` tagastas read sisestusjärjekorras.
 * See tähendas, et lehekülgitamise test oleks mõõtnud, mis järjekorras TEST ise
 * read lisas — mitte seda, mida kood küsib. Roheline sviit oleks tõendanud
 * paginatsiooni, mida ei ole. Sama klass tabas 09.08 SOL-SCHEMA-01-t ja 10.08
 * SOL-CALL-10 kestuselage.
 */
function compareBy(orderBy) {
  const clauses = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
  return (a, b) => {
    for (const clause of clauses) {
      for (const [key, direction] of Object.entries(clause || {})) {
        const left = a[key] instanceof Date ? a[key].getTime() : a[key];
        const right = b[key] instanceof Date ? b[key].getTime() : b[key];
        if (left === right) continue;
        // `null` läheb lõppu, nagu Postgresis vaikimisi ASC puhul.
        if (left == null) return 1;
        if (right == null) return -1;
        const order = left < right ? -1 : 1;
        return direction === "desc" ? -order : order;
      }
    }
    return 0;
  };
}

export function createModel(initial = [], prefix = "row") {
  // Koopia, mitte viide: näidislaud on külmutatud ja testid peavad saama teda
  // muuta (nt „KOV muutis lugemisaega") ilma näidist rikkumata.
  const rows = initial.map((row) => ({ ...row }));
  let counter = rows.length;
  return {
    rows,
    /* Päring tagastab KOOPIA, mitte elava rea. Päris Prisma annab lahtiühendatud
       objekti ja just see teeb „loe → kontrolli → kirjuta" akna nähtavaks: elava
       viite peal muutuks juba loetud rida vaikselt kaasa ja võistlustest mõõdaks
       JavaScripti viidet, mitte andmebaasi seisu. */
    async findFirst({ where } = {}) {
      const row = rows.find((candidate) => matches(candidate, where));
      return row ? { ...row } : null;
    },
    async findMany({ where, take, orderBy, skip } = {}) {
      const found = rows.filter((row) => matches(row, where));
      if (orderBy) found.sort(compareBy(orderBy));
      const start = Number.isInteger(skip) && skip > 0 ? skip : 0;
      const sliced = found.slice(start);
      const page = typeof take === "number" ? sliced.slice(0, take) : sliced;
      return page.map((row) => ({ ...row }));
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
    },
    /* SOL-URG-06: tingimuslik kirjutus on nüüd siirete AINUS kuju, seega fake peab
       teda oskama — ja tagastama LOENDI, sest just loend ütleb, kas võistlus
       võideti. `update({ where: { id } })` ei saa seda kunagi öelda. */
    async updateMany({ where, data } = {}) {
      const found = rows.filter((row) => matches(row, where));
      for (const row of found) Object.assign(row, data);
      return { count: found.length };
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

/**
 * SOL-URG-05: TAGASIVEEREMINE ON PÄRIS — hetktõmmis enne, taastamine erindi
 * korral. Ilma selleta mõõdaks „seis ja jälg sünnivad koos" test ainult seda, et
 * kood kutsub `$transaction`-it; kukkuv jälg jätaks seisu ikka alles ja roheline
 * sviit tõendaks aatomsust, mida ei ole.
 */
export function createClient(models) {
  const client = {
    ...models,
    txRuns: 0,
    /* Reavastane lukk on ÜHES LÕIMES MÕÕTMATU: fake ei saa teda modelleerida ja
       tema päris mõju tõendab ainult sond (`urgent:race:probe`). Meetod peab
       siiski olemas olema — `lockDeskRow` nõuab teda ja viskab muidu vea, et
       lukk ei kaoks vaikselt esimese refaktori peale. */
    rawCalls: [],
    async $queryRaw(strings, ...values) {
      client.rawCalls.push({ sql: Array.isArray(strings) ? strings.join("?") : String(strings), values });
      return [];
    },
    async $transaction(fn) {
      client.txRuns += 1;
      const snapshot = Object.values(models).map((model) => [model, model.rows.map((row) => ({ ...row }))]);
      try {
        return await fn(client);
      } catch (error) {
        for (const [model, rows] of snapshot) {
          model.rows.length = 0;
          model.rows.push(...rows);
        }
        throw error;
      }
    }
  };
  return client;
}

export function createPrisma({ desks = [READY_DESK], members = [{ id: "m1", deskId: "desk_kov", userId: "staff_1", isActive: true }] } = {}) {
  return createClient({
    urgentDesk: createModel(desks, "desk"),
    urgentDeskMember: createModel(members, "member"),
    urgentRequest: createModel([], "req"),
    urgentRequestEvent: createModel([], "evt"),
    preInquiry: createModel([], "pre")
  });
}

export const NOW = new Date("2026-08-05T22:00:00Z");
export const now = () => NOW;

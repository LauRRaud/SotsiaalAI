/**
 * Koduteenuse laua (`/org/<id>/koduteenus`) reeglid ilma joonistamiseta: mis
 * plaadid on laual, mis rühmas ja mis järjekorras, ning mis vaatega koduteenus
 * inimesele avaneb.
 *
 * Leht (`../HomeCareHome.jsx`) hoiab olekut, vaated (`./DeskViews.jsx`)
 * joonistavad. Kes mida näeb, on sama reegel, mis oli vana lingirea ümber
 * (hooldusjuhi lingid, väljavõtte ja töötajate õigus, otsingu õigus).
 */

const coordinator = (who) => who.isCoordinator;

/**
 * Plaadid. `path`: koduteenuse alaleht (oma marsruut, serveri värav jääb ette);
 * `view`: avalehe enda vaade (andmed tulevad avalehe laadimisega kaasa).
 * `name`: nime võti; `see`: kes plaati näeb.
 */
const TILES = Object.freeze({
  today: { view: "today", name: "home_care.slots.today_title", see: (who) => who.hasDay },
  overview: { path: "ulevaade", name: "home_care.desk.names.overview", see: coordinator },
  day: { path: "paev", name: "home_care.day.link", see: coordinator },
  week: { path: "nadal", name: "home_care.week.link", see: coordinator },
  absences: { path: "puudumised", name: "home_care.absences.link", see: coordinator },
  deadlines: { path: "tahtajad", name: "home_care.deadlines.link", see: coordinator },
  clients: { view: "clients", name: "home_care.home.all_clients", see: () => true },
  incidents: { path: "erijuhtumid", name: "home_care.desk.names.incidents", see: coordinator },
  keys: { path: "votmed", name: "home_care.keys.link", see: coordinator },
  crisis: { path: "kriis", name: "home_care.crisis.link", see: coordinator },
  workers: { path: "tootajad", name: "home_care.workers.link", see: (who) => who.isCoordinator && who.canEditReferrals },
  refer: { view: "refer", name: "home_care.referrals.title", see: (who) => who.hasReferrals || (who.writable && who.canEditReferrals) },
  month: { path: "kuu", name: "home_care.month.link", see: coordinator },
  trips: { path: "soidud", name: "home_care.trips.link", see: (who) => who.canSearch },
  calls: { path: "koned", name: "home_care.calls.link", see: coordinator },
  releases: { path: "valjastused", name: "home_care.releases.link", see: coordinator },
  activities: { path: "toimingud", name: "home_care.activities.link", see: coordinator },
  export: { path: "valjavote", name: "home_care.export.link", see: (who) => who.isCoordinator && who.canExport }
});

/**
 * Hooldusjuhi laud: kolm rühma, igapäevane töö ees. Rühmas on kuni kuus plaati:
 * nii mahub laud 522 px paneeli (mõõdetud 1536 × 640 aknas).
 */
export const DESK_GROUPS = Object.freeze([
  Object.freeze({ key: "daily", tiles: Object.freeze(["today", "overview", "day", "week", "absences", "deadlines"]) }),
  Object.freeze({ key: "people", tiles: Object.freeze(["clients", "incidents", "keys", "crisis", "workers", "refer"]) }),
  Object.freeze({ key: "month", tiles: Object.freeze(["month", "trips", "calls", "releases", "activities", "export"]) })
]);

/** Hooldaja laud: üks rühm ilma pealkirjata. */
export const WORKER_TILES = Object.freeze(["today", "clients", "trips", "refer"]);

/** Avalehe enda vaated ja nende nime võti kiirmenüüs. */
export const HOME_VIEWS = Object.freeze({
  today: "home_care.slots.today_title",
  /* Vaate „Täna" alavaated kannavad sama nime: nelja ruuduga nupp viib neist lauale, „Tagasi" vaatesse „Täna". */
  all: "home_care.slots.today_title",
  mine: "home_care.slots.today_title",
  obstacle: "home_care.slots.today_title",
  next: "home_care.slots.next_title",
  clients: "home_care.home.all_clients",
  add: "home_care.home.add_client",
  /* Kõne märkimine otsingu tulemuse realt. */
  call: "home_care.entry_steps.quick_call",
  refer: "home_care.referrals.title",
  name: "home_care.desk.names.name",
  /* Seadmes ootavate kirjete loend: avaneb realt laua ja vaate „Täna" kohal. */
  outbox: "home_care.outbox.name"
});

/** Kas inimesel on täna või lähipäevil midagi oma: käik, võti, raha, puudumine või takistuse teade. */
export function hasOwnDay(myDay) {
  const day = myDay || {};
  return Boolean(day.absent || day.obstacle || day.visits?.length || day.keys?.length || day.money?.length || day.next?.length);
}

/** Kes lauda vaatab: õigused ja seis ühes kohas, lehe andmetest. */
export function deskViewer({ context, initial, myDay, referrals, ownName } = {}) {
  return {
    isCoordinator: Boolean(initial?.isCoordinator),
    canSearch: Boolean(initial?.canSearch),
    canExport: Boolean(initial?.canExport),
    canEditReferrals: Boolean(referrals?.canEditReferrals),
    hasReferrals: Boolean(referrals?.referrals?.length),
    writable: Boolean(context?.writable),
    hasDay: hasOwnDay(myDay),
    needsName: Boolean(ownName && !ownName.complete)
  };
}

/* Hooldaja näeb ainult oma kliente: plaadi nimi ja rida ütlevad seda. */
const nameKey = (key, who) => (key === "clients" && !who.isCoordinator ? "home_care.home.my_clients" : TILES[key].name);
const lineKey = (key, who) => `home_care.desk.lines.${key === "clients" && !who.isCoordinator ? "my_clients" : key}`;

function tile(key, who, { t, organizationId }) {
  const spec = TILES[key];
  return {
    key,
    view: spec.view || "",
    href: spec.path ? `/org/${organizationId}/koduteenus/${spec.path}` : "",
    name: t(nameKey(key, who)),
    line: t(lineKey(key, who))
  };
}

/**
 * Laua rühmad: `[{ key, title, tiles: [{ key, name, line, href, view }] }]`.
 * Hooldusjuhil kolm pealkirjaga rühma, teistel üks pealkirjata rühm. Tühi rühm
 * jääb välja.
 */
export function deskGroups(who, { t, organizationId }) {
  const seen = (key) => TILES[key].see(who);
  if (!who.isCoordinator) {
    const tiles = WORKER_TILES.filter(seen).map((key) => tile(key, who, { t, organizationId }));
    return tiles.length ? [{ key: "mine", title: "", tiles }] : [];
  }
  return DESK_GROUPS.map((group) => ({
    key: group.key,
    title: t(`home_care.desk.groups.${group.key}`),
    tiles: group.tiles.filter(seen).map((key) => tile(key, who, { t, organizationId }))
  })).filter((group) => group.tiles.length > 0);
}

/**
 * Mis vaatega koduteenus avaneb. Nimeta inimesel on nime vorm kohe ees
 * (kolleegid näeksid tema kohal kriipsu). Hooldajal, kellel on täna või
 * lähipäevil midagi oma, avaneb „Täna" (ta avab lehe ukse taga); hooldusjuhil
 * ja kõigil teistel laud (tühi sõne).
 */
export function landingView(who) {
  if (who.needsName) return "name";
  return !who.isCoordinator && who.hasDay ? "today" : "";
}

/** Avalehe vaate nimi kiirmenüüs. */
export function viewName(view, who, { t }) {
  if (!HOME_VIEWS[view]) return "";
  return t(view === "clients" && !who.isCoordinator ? "home_care.home.my_clients" : HOME_VIEWS[view]);
}

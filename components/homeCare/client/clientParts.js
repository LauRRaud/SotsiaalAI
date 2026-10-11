/**
 * Kliendi lehe (`/org/<id>/koduteenus/kliendid/<klient>`) reeglid ilma
 * joonistamiseta: mis osad lehel on, kes mida näeb, mis vaatega leht avaneb,
 * mis seisab osa plaadil ja mis on vaates „Ukse taga" ees.
 *
 * Leht (`../HomeCareClientPage.jsx`) hoiab olekut ja päringuid, vaated
 * (`./ClientViews.jsx`) joonistavad. Plaadi rida tuleb andmetest, mille leht
 * niikuinii laeb: uut päringut plaadi jaoks ei tehta.
 */

/** Osad selles järjekorras, nagu need osade laual on. */
export const CLIENT_PARTS = Object.freeze(["door", "entry", "diary", "plan", "slots", "decision", "safety", "keys", "money", "supplies", "transport", "relatives", "team", "manage"]);

/**
 * Leht avaneb kõigil vaatega „Ukse taga" (omanik 11.10): hooldaja avab lehe
 * ukse taga ühe käega ja peab enne sisenemist nägema kaarti „Enne kui lähed" ja
 * eelmise hooldaja teadet. Tühi sõne on osade laud.
 */
export const CLIENT_LANDING = "door";

/** Osa „Ukse taga" alavaated: kaardi muutmine, „Kui uks ei avane" ja kõik viimased teated. */
export const DOOR_VIEWS = Object.freeze(["card", "no_answer", "handovers"]);

/** Osa „Uus kirje" alavaated: kirjed, mis vormi ei vaja (kõne märkimine ja „Peaaegu juhtus"). */
export const ENTRY_VIEWS = Object.freeze(["call", "near_miss"]);

/** Osa „Päevik" alavaated: otsing, avatud kirje, selle parandus, tabamused varasemast ajaloost ja varasem ajalugu ise. */
export const DIARY_VIEWS = Object.freeze(["diary_search", "diary_item", "diary_correct", "history_hits", "history"]);

/** Seadmes ootavate kirjete loend: avaneb realt osade laua ja vaate „Ukse taga" kohal. */
export const OUTBOX_VIEW = "outbox";

/** Osa nime võti (plaadil ja kiirmenüüs). */
const NAMES = Object.freeze({
  door: "home_care.parts.names.door",
  entry: "home_care.entry.new_title",
  diary: "home_care.filter.title",
  plan: "home_care.plan.title",
  slots: "home_care.parts.names.slots",
  decision: "home_care.decision.title",
  safety: "home_care.parts.names.safety",
  keys: "home_care.keys.title",
  money: "home_care.money.title",
  supplies: "home_care.supplies.title",
  transport: "home_care.transport.title",
  relatives: "home_care.parts.names.relatives",
  team: "home_care.team.title",
  manage: "home_care.parts.names.manage"
});

const has = (list) => Array.isArray(list) && list.length > 0;

/**
 * Kes lehte vaatab: õigused ühes kohas, lehe andmetest. Lõpetatud kliendile
 * kirjutab kirje ainult hooldusjuht.
 */
export function clientViewer(data) {
  const access = data?.access || {};
  const ended = data?.client?.status === "ENDED";
  const canWrite = Boolean(access.canWrite);
  const isCoordinator = Boolean(access.isCoordinator);
  return {
    isCoordinator,
    /* Kaarti ja kokkuleppeid muudavad meeskond ja hooldusjuht; põhjusega avaja loeb. */
    isTeam: Boolean(access.canEditCard),
    canWrite,
    ended,
    canAddEntry: canWrite && (!ended || isCoordinator),
    membershipId: access.membershipId || null
  };
}

/**
 * Kas osas on sellele inimesele midagi näha või teha. Osa, kus ei ole kumbagi,
 * laual ei ole: plaat ei tohi avada tühja vaadet.
 */
const SEE = Object.freeze({
  door: () => true,
  entry: (who) => who.canAddEntry,
  diary: () => true,
  plan: () => true,
  slots: () => true,
  decision: () => true,
  safety: (who, data) =>
    has(data.safety?.items) || has(data.usualState) || has(data.preconditions) || Boolean(data.workNature) || Boolean(data.crisis) || (who.canWrite && who.isTeam),
  keys: (who, data) => has(data.keys) || who.isCoordinator,
  money: (who, data) => (who.canWrite && !who.ended) || has(data.money?.entries) || has(data.money?.holders),
  supplies: (who, data) => has(data.supplies) || who.isCoordinator,
  transport: (who, data) => has(data.transport?.requests) || (who.canWrite && who.isTeam && !who.ended),
  relatives: (who, data) => has(data.relatives) || has(data.representatives) || (who.canWrite && who.isTeam),
  team: () => true,
  manage: (who) => who.isCoordinator
});

export function partVisible(part, who, data) {
  return Boolean(SEE[part]?.(who, data || {}));
}

/** Kas vaate tohib avada: osade laud, nähtav osa või osa alavaade. */
export function viewAllowed(view, who, data) {
  if (view === "" || view === OUTBOX_VIEW) return true;
  if (DOOR_VIEWS.includes(view)) return view !== "no_answer" || canOpenNoAnswer(who, data);
  if (ENTRY_VIEWS.includes(view)) return partVisible("entry", who, data);
  if (DIARY_VIEWS.includes(view)) return partVisible("diary", who, data);
  return partVisible(view, who, data);
}

/** Vaate nime võti kiirmenüüs; alavaade kannab oma osa nime. */
export function viewNameKey(view) {
  if (view === OUTBOX_VIEW) return "home_care.outbox.name";
  if (DOOR_VIEWS.includes(view)) return NAMES.door;
  if (ENTRY_VIEWS.includes(view)) return NAMES.entry;
  if (DIARY_VIEWS.includes(view)) return NAMES.diary;
  return NAMES[view] || "";
}

/** „Kui uks ei avane": sammud on kokku lepitud või inimene saab neid kirja panna või käigu ebaõnnestumist märkida. */
export function canOpenNoAnswer(who, data) {
  return has(data?.doorSteps) || (who.canWrite && who.isTeam) || who.canAddEntry;
}

/* --- Plaadi rida ------------------------------------------------------------- */

const SUPPLY_ORDER = Object.freeze(["OUT", "LOW"]);

function keysLine(who, data, { t }) {
  const keys = data.keys || [];
  if (!keys.length) return { text: t("home_care.parts.lines.keys_none") };
  const mine = keys.filter((key) => who.membershipId && key.holder?.membershipId === who.membershipId).length;
  if (keys.length > 1) {
    return { text: mine ? t("home_care.parts.lines.keys_count_mine", { count: keys.length, mine }) : t("home_care.parts.lines.keys_count", { count: keys.length }) };
  }
  const [key] = keys;
  if (mine) return { text: t("home_care.parts.lines.key_mine", { tag: key.tag }) };
  return { text: key.holder ? t("home_care.parts.lines.key_held", { tag: key.tag, name: key.holder.name || "—" }) : t("home_care.parts.lines.key_office", { tag: key.tag }) };
}

function moneyLine(who, data, { t, euro }) {
  const money = data.money || {};
  if (money.balanceCents > 0) return { text: t("home_care.parts.lines.money_mine", { amount: euro(money.balanceCents) }) };
  const held = heldCents(data);
  if (who.isCoordinator && held > 0) return { text: t("home_care.parts.lines.money_held", { amount: euro(held) }) };
  return { text: t("home_care.parts.lines.money_none") };
}

function suppliesLine(who, data, { t }) {
  const supplies = data.supplies || [];
  if (!supplies.length) return { text: t("home_care.parts.lines.supplies_none") };
  /* Kõige halvem seis ees: otsas enne lõppemist. */
  for (const state of SUPPLY_ORDER) {
    const short = supplies.filter((supply) => supply.state === state);
    if (short.length) {
      return {
        text: t("home_care.parts.lines.supply_state", { kind: t(`home_care.supplies.kinds.${short[0].kind}`), state: t(`home_care.supplies.states.${state}`) }),
        wait: true
      };
    }
  }
  return { text: t(supplies.some((supply) => !supply.state) ? "home_care.parts.lines.supplies_unmarked" : "home_care.parts.lines.supplies_ok") };
}

function transportLine(who, data, { t, day }) {
  const transport = data.transport || {};
  /* Vastuseta soov on hooldusjuhi teha; teistele ütleb rida sama ilma rõhuta. */
  if ((transport.requests || []).some((item) => item.state === "REQUESTED")) return { text: t("home_care.parts.lines.transport_waiting"), wait: who.isCoordinator };
  if (transport.next) return { text: t("home_care.parts.lines.transport_next", { date: day(transport.next.wantedOn) }) };
  return { text: t("home_care.parts.lines.transport_none") };
}

function teamLine(who, data, { t }) {
  const names = (data.team || []).filter((member) => member.active).map((member) => member.name || "—");
  if (!names.length) return { text: t("home_care.parts.lines.team_none") };
  /* Plaadil on kaks rida: üks nimi ja mitu on veel. Kõik nimed on osa vaates. */
  if (names.length === 1) return { text: names[0] };
  return { text: t("home_care.parts.lines.team_more", { name: names[0], count: names.length - 1 }) };
}

function manageLine(who, data, { t }) {
  const open = data.changeSignals?.open?.length || 0;
  if (open) return { text: t("home_care.parts.lines.manage_signals", { count: open }), wait: true };
  if (reviewKeys(data).length) return { text: t("home_care.parts.lines.manage_review"), wait: true };
  return { text: t("home_care.parts.lines.manage") };
}

const LINES = Object.freeze({
  door: (who, data, { t }) => ({ text: t("home_care.parts.lines.door") }),
  entry: (who, data, { t }) => ({ text: t("home_care.parts.lines.entry") }),
  diary: (who, data, { t, moment }) => ({ text: data.latestEntryAt ? t("home_care.parts.lines.diary_last", { date: moment(data.latestEntryAt) }) : t("home_care.parts.lines.diary_none") }),
  plan: (who, data, { t, day }) => {
    if (!data.plan) return { text: t("home_care.parts.lines.plan_none") };
    return { text: data.plan.reviewOn ? t("home_care.parts.lines.plan_review", { date: day(data.plan.reviewOn) }) : t("home_care.parts.lines.plan_no_review") };
  },
  slots: (who, data, { t }) => ({ text: has(data.slots) ? t("home_care.parts.lines.slots", { count: data.slots.length }) : t("home_care.parts.lines.slots_none") }),
  decision: (who, data, { t, volume }) => {
    if (!data.decision) return { text: t("home_care.parts.lines.decision_none") };
    return { text: volume(data.decision) || t("home_care.parts.lines.decision_no_volume") };
  },
  /* Täitmata eeltingimus tähendab, et teenust ei alustata: see on plaadil ees. */
  safety: (who, data, { t }) =>
    has(data.preconditions) ? { text: t("home_care.parts.lines.safety_preconditions", { count: data.preconditions.length }), wait: true } : { text: t("home_care.parts.lines.safety") },
  keys: keysLine,
  money: moneyLine,
  supplies: suppliesLine,
  transport: transportLine,
  relatives: (who, data, { t }) => {
    const relatives = data.relatives || [];
    if (!relatives.length) return { text: t("home_care.parts.lines.relatives_none") };
    return { text: relatives.length === 1 ? relatives[0].name : t("home_care.parts.lines.relatives_count", { count: relatives.length }) };
  },
  team: teamLine,
  manage: manageLine
});

/**
 * Osade laua plaadid: `[{ key, name, line, wait }]`. `wait` on plaat, kus midagi
 * ootab (tugevam raam ja kaal). Vormindajad annab leht: `t`, `day` (päev kujul
 * 2026-10-14), `moment` (ajahetk), `euro` (sendid), `volume` (otsuse maht).
 */
export function clientTiles(who, data, format) {
  const source = data || {};
  return CLIENT_PARTS.filter((part) => partVisible(part, who, source)).map((part) => {
    const line = LINES[part](who, source, format);
    return { key: part, name: format.t(NAMES[part]), line: line.text, wait: Boolean(line.wait) };
  });
}

/* --- Lahtised asjad ---------------------------------------------------------- */

/** Kui palju selle kliendi raha on töötajate käes kokku (sentides). */
export function heldCents(data) {
  return (data?.money?.holders || []).reduce((sum, holder) => sum + (holder.balanceCents || 0), 0);
}

/**
 * Mis on peatatud või lõpetatud kliendi juures veel lahti (K4-g), lehe enda
 * andmetest. Aktiivsel kliendil tühi. Lõpetamisel: võtmed, raha, käigumuster,
 * varud ja eeltingimused; ära oleku ajal: võtmed ja raha (teade peatatud
 * käikude kohta käib sinna juurde, vt `reviewItems`).
 */
function reviewKeys(data) {
  const status = data?.client?.status;
  if (!status || status === "ACTIVE") return [];
  const ended = status === "ENDED";
  return [
    has(data.keys) ? "keys" : null,
    heldCents(data) > 0 ? "money" : null,
    ended && has(data.slots) ? "slots" : null,
    ended && has(data.supplies) ? "supplies" : null,
    ended && has(data.preconditions) ? "preconditions" : null
  ].filter(Boolean);
}

/** Ülevaatuse read hooldusjuhile: `[{ key, text }]`. `euro` vormindab sendid. */
export function reviewItems(data, { t, euro }) {
  const status = data?.client?.status;
  if (!status || status === "ACTIVE") return [];
  const ended = status === "ENDED";
  const text = {
    keys: () => t(ended ? "home_care.review.keys_return" : "home_care.review.away_keys", { count: data.keys.length }),
    money: () => t("home_care.review.money_return", { amount: euro(heldCents(data)) }),
    slots: () => t("home_care.review.slots_end", { count: data.slots.length }),
    supplies: () => t("home_care.review.supplies_end", { count: data.supplies.length }),
    preconditions: () => t("home_care.review.preconditions_open", { count: data.preconditions.length })
  };
  const rows = reviewKeys(data).map((key) => ({ key, text: text[key]() }));
  return ended ? rows : [{ key: "paused", text: t("home_care.review.away_paused") }, ...rows];
}

/* --- Vaade „Ukse taga" ------------------------------------------------------- */

/**
 * Teated vaate ülaservas: `[{ key, text }]`. Järjekord on tähtsuse järgi: mida
 * enne sisenemist teadma peab, on ees. `day` vormindab päeva.
 */
export function doorNotices(who, data, { t, day }) {
  const client = data?.client || {};
  const homecoming = data?.homecoming;
  return [
    data?.talkToCoordinator ? { key: "talk", text: t("home_care.client.talk_to_coordinator") } : null,
    client.status === "AWAY" ? { key: "away", text: t("home_care.client.away_notice") } : null,
    /* Kojutulek (K6-f): klient on äraolekult tagasi ja pärast seda ei ole käiku kirjas. */
    homecoming
      ? {
          key: "homecoming",
          text: [
            `${t("home_care.homecoming.notice", { date: day(homecoming.returnedOn), from: day(homecoming.awayFrom) })}${homecoming.reason ? ` (${t(`home_care.status_reason.AWAY.${homecoming.reason}`)})` : ""}.`,
            t("home_care.homecoming.first_visit"),
            who.isCoordinator ? t("home_care.homecoming.coordinator") : null
          ]
            .filter(Boolean)
            .join(" ")
        }
      : null,
    who.ended ? { key: "ended", text: t("home_care.client.ended_notice") } : null,
    who.canWrite ? null : { key: "read_only", text: t("home_care.client.read_only") }
  ].filter(Boolean);
}

/**
 * Read, mis viivad vaatest „Ukse taga" otse osasse, kus midagi ootab:
 * `[{ key, view, text }]`. Täitmata eeltingimus on kõigile (teenust ei alustata
 * enne); märkamised, mis ootavad vastust, on hooldusjuhi teha.
 */
export function doorAlerts(who, data, { t }) {
  const open = data?.changeSignals?.open?.length || 0;
  return [
    has(data?.preconditions) && partVisible("safety", who, data) ? { key: "preconditions", view: "safety", text: t("home_care.parts.lines.safety_preconditions", { count: data.preconditions.length }) } : null,
    who.isCoordinator && open ? { key: "signals", view: "manage", text: t("home_care.parts.lines.manage_signals", { count: open }) } : null
  ].filter(Boolean);
}

/**
 * Viimane teade järgmisele ja mitu neid veel on. Vaates on ees üks teade: kaart
 * „Enne kui lähed" peab jääma esimesele ekraanile; ülejäänud on rea taga.
 */
export function doorHandover(data) {
  const list = Array.isArray(data?.recentHandovers) ? data.recentHandovers : [];
  return { latest: list[0] || null, more: Math.max(list.length - 1, 0) };
}
